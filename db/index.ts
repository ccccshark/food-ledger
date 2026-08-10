import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import type {
  LedgerRecord,
  RecordInput,
  MonthSummary,
  DaySummary,
  MealType,
  LocationAgg,
  PhotoStyle,
  PhotoShape,
  Book,
  BookKind,
  Recipe,
  RecipeInput,
} from '@/types';
import { MEAL_ORDER } from '@/types';

const DB_NAME = 'food_ledger.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await initSchema(dbInstance);
    await migrate(dbInstance);
    await seedDefaultBooks(dbInstance);
  }
  return dbInstance;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      meal TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
    CREATE INDEX IF NOT EXISTS idx_records_meal ON records(meal);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'default',
      color TEXT NOT NULL DEFAULT 'yellow',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ingredients TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '',
      photo_uri TEXT,
      servings INTEGER NOT NULL DEFAULT 1,
      linked_record_id INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_linked ON recipes(linked_record_id);
  `);
}

// 迁移：增量加列（幂等，已存在则跳过）
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(records)`);
  const names = new Set(cols.map((c) => c.name));

  const additions: { col: string; sql: string }[] = [
    { col: 'photo_uri', sql: `ALTER TABLE records ADD COLUMN photo_uri TEXT` },
    { col: 'latitude', sql: `ALTER TABLE records ADD COLUMN latitude REAL` },
    { col: 'longitude', sql: `ALTER TABLE records ADD COLUMN longitude REAL` },
    { col: 'location_name', sql: `ALTER TABLE records ADD COLUMN location_name TEXT` },
    { col: 'rating', sql: `ALTER TABLE records ADD COLUMN rating INTEGER DEFAULT 0` },
    { col: 'photo_style', sql: `ALTER TABLE records ADD COLUMN photo_style TEXT DEFAULT 'polaroid'` },
    { col: 'photo_shape', sql: `ALTER TABLE records ADD COLUMN photo_shape TEXT DEFAULT 'square'` },
    { col: 'photos_extra', sql: `ALTER TABLE records ADD COLUMN photos_extra TEXT DEFAULT '[]'` },
    { col: 'stickers', sql: `ALTER TABLE records ADD COLUMN stickers TEXT` },
    { col: 'book_id', sql: `ALTER TABLE records ADD COLUMN book_id INTEGER DEFAULT 1` },
  ];

  for (const a of additions) {
    if (!names.has(a.col)) {
      await db.execAsync(a.sql);
    }
  }

  // 索引（地点查询 + 账本过滤）
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_records_location ON records(location_name);
    CREATE INDEX IF NOT EXISTS idx_records_book ON records(book_id);
  `);
}

// 首次启动初始化默认账本（若 books 表为空）
async function seedDefaultBooks(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM books`);
  if ((row?.c ?? 0) > 0) return;
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO books (name, kind, color, created_at) VALUES (?, ?, ?, ?)`,
    ['日常账本', 'default', 'yellow', now]
  );
  await db.runAsync(
    `INSERT INTO books (name, kind, color, created_at) VALUES (?, ?, ?, ?)`,
    ['家庭美食', 'family', 'pink', now]
  );
  await db.runAsync(
    `INSERT INTO books (name, kind, color, created_at) VALUES (?, ?, ?, ?)`,
    ['减脂餐', 'diet', 'green', now]
  );
}

// ---------- 记录 CRUD ----------

function mapRow(r: any): LedgerRecord {
  let photosExtra: string[] = [];
  try {
    const parsed = r.photos_extra ? JSON.parse(r.photos_extra) : [];
    if (Array.isArray(parsed)) photosExtra = parsed.filter((x: unknown) => typeof x === 'string');
  } catch {
    photosExtra = [];
  }
  return {
    ...r,
    photo_uri: r.photo_uri ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    location_name: r.location_name ?? null,
    rating: r.rating ?? 0,
    photo_style: (r.photo_style as PhotoStyle) ?? 'polaroid',
    photo_shape: (r.photo_shape as PhotoShape) ?? 'square',
    photos_extra: photosExtra,
    stickers: r.stickers ?? null,
    book_id: r.book_id ?? 1,
  };
}

// 账本过滤片段：未传 bookId 则不过滤；否则返回 WHERE 子句与参数
function bookClause(bookId: number | undefined, prefix = ''): { sql: string; params: any[] } {
  if (bookId == null) return { sql: '', params: [] };
  return { sql: `${prefix}book_id = ?`, params: [bookId] };
}

export async function insertRecord(input: RecordInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO records
      (amount, meal, tags, date, note, created_at, photo_uri, latitude, longitude, location_name, rating, photo_style, photo_shape, photos_extra, stickers, book_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.amount,
      input.meal,
      input.tags ?? '',
      input.date,
      input.note ?? '',
      now,
      input.photo_uri ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.location_name ?? null,
      input.rating ?? 0,
      input.photo_style ?? 'polaroid',
      input.photo_shape ?? 'square',
      JSON.stringify(input.photos_extra ?? []),
      input.stickers ?? null,
      input.book_id ?? 1,
    ]
  );
  return result.lastInsertRowId as number;
}

export async function updateRecord(id: number, input: RecordInput): Promise<void> {
  const db = await getDb();
  // 若更换或清空了照片，删除旧照片文件避免残留
  if (input.photo_uri !== undefined) {
    const old = await db.getFirstAsync<{ photo_uri: string | null; photos_extra: string | null }>(
      `SELECT photo_uri, photos_extra FROM records WHERE id = ?`,
      [id]
    );
    // 旧封面被替换：删除
    if (old?.photo_uri && old.photo_uri !== input.photo_uri) {
      // 旧封面若不在新集合中，则删除文件
      const newAll = [input.photo_uri, ...(input.photos_extra ?? [])];
      if (!newAll.includes(old.photo_uri)) {
        try {
          await FileSystem.deleteAsync(old.photo_uri, { idempotent: true });
        } catch {
          /* 忽略 */
        }
      }
    }
    // 旧附加图被移除：删除
    if (old?.photos_extra) {
      try {
        const oldExtras: string[] = JSON.parse(old.photos_extra);
        const newAll = [input.photo_uri, ...(input.photos_extra ?? [])];
        for (const u of oldExtras) {
          if (!newAll.includes(u)) {
            try {
              await FileSystem.deleteAsync(u, { idempotent: true });
            } catch {
              /* 忽略 */
            }
          }
        }
      } catch {
        /* 解析失败忽略 */
      }
    }
  }
  await db.runAsync(
    `UPDATE records SET
      amount = ?, meal = ?, tags = ?, date = ?, note = ?,
      photo_uri = ?, latitude = ?, longitude = ?, location_name = ?, rating = ?, photo_style = ?, photo_shape = ?, photos_extra = ?, stickers = ?, book_id = ?
     WHERE id = ?`,
    [
      input.amount,
      input.meal,
      input.tags ?? '',
      input.date,
      input.note ?? '',
      input.photo_uri ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.location_name ?? null,
      input.rating ?? 0,
      input.photo_style ?? 'polaroid',
      input.photo_shape ?? 'square',
      JSON.stringify(input.photos_extra ?? []),
      input.stickers ?? null,
      input.book_id ?? 1,
      id,
    ]
  );
}

export async function deleteRecord(id: number): Promise<void> {
  const db = await getDb();
  // 删除关联照片文件（封面 + 附加图）
  const row = await db.getFirstAsync<{ photo_uri: string | null; photos_extra: string | null }>(
    `SELECT photo_uri, photos_extra FROM records WHERE id = ?`,
    [id]
  );
  const toDelete: string[] = [];
  if (row?.photo_uri) toDelete.push(row.photo_uri);
  if (row?.photos_extra) {
    try {
      const extras: string[] = JSON.parse(row.photos_extra);
      toDelete.push(...extras);
    } catch {
      /* 忽略 */
    }
  }
  for (const u of toDelete) {
    try {
      await FileSystem.deleteAsync(u, { idempotent: true });
    } catch {
      /* 忽略文件删除失败 */
    }
  }
  await db.runAsync(`DELETE FROM records WHERE id = ?`, [id]);
}

export async function getRecord(id: number): Promise<LedgerRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM records WHERE id = ?`,
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function listRecordsByMonth(
  month: string,
  bookId?: number
): Promise<LedgerRecord[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT * FROM records WHERE date LIKE ? AND ${f.sql} ORDER BY date DESC, created_at DESC`
    : `SELECT * FROM records WHERE date LIKE ? ORDER BY date DESC, created_at DESC`;
  const rows = await db.getAllAsync<any>(sql, [`${month}%`, ...f.params]);
  return rows.map(mapRow);
}

export async function listAllRecords(bookId?: number): Promise<LedgerRecord[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT * FROM records WHERE ${f.sql} ORDER BY date DESC, created_at DESC`
    : `SELECT * FROM records ORDER BY date DESC, created_at DESC`;
  const rows = await db.getAllAsync<any>(sql, f.params);
  return rows.map(mapRow);
}

// 月历视图：某月每日聚合
export async function getMonthCalendar(month: string, bookId?: number): Promise<DaySummary[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT date, SUM(amount) AS total, COUNT(*) AS count
       FROM records WHERE date LIKE ? AND ${f.sql} GROUP BY date ORDER BY date ASC`
    : `SELECT date, SUM(amount) AS total, COUNT(*) AS count
       FROM records WHERE date LIKE ? GROUP BY date ORDER BY date ASC`;
  const rows = await db.getAllAsync<DaySummary>(sql, [`${month}%`, ...f.params]);
  return rows;
}

// ---------- 聚合统计 ----------

export async function getDaySummary(date: string, bookId?: number): Promise<DaySummary> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date = ? AND ${f.sql}`
    : `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date = ?`;
  const row = await db.getFirstAsync<{ total: number; count: number }>(sql, [date, ...f.params]);
  return { date, total: row?.total ?? 0, count: row?.count ?? 0 };
}

// 最近 N 天每日聚合（用于趋势图）
export async function getRecentDailyTotals(days = 7, bookId?: number): Promise<DaySummary[]> {
  const db = await getDb();
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  const startStr = fmt(start);
  const endStr = fmt(end);
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT date, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM records WHERE date BETWEEN ? AND ? AND ${f.sql} GROUP BY date ORDER BY date ASC`
    : `SELECT date, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM records WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date ASC`;
  const rows = await db.getAllAsync<DaySummary>(sql, [startStr, endStr, ...f.params]);
  return rows;
}

export async function getMonthSummary(month: string, bookId?: number): Promise<MonthSummary> {
  const db = await getDb();
  const f = bookClause(bookId);
  const likeParam = `${month}%`;

  const totalRow = await db.getFirstAsync<{ total: number; count: number }>(
    f.sql
      ? `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date LIKE ? AND ${f.sql}`
      : `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date LIKE ?`,
    [likeParam, ...f.params]
  );

  const mealRows = await db.getAllAsync<{ meal: MealType; total: number }>(
    f.sql
      ? `SELECT meal, SUM(amount) AS total FROM records WHERE date LIKE ? AND ${f.sql} GROUP BY meal`
      : `SELECT meal, SUM(amount) AS total FROM records WHERE date LIKE ? GROUP BY meal`,
    [likeParam, ...f.params]
  );
  const byMeal = {} as Record<MealType, number>;
  for (const m of MEAL_ORDER) byMeal[m] = 0;
  for (const r of mealRows) byMeal[r.meal] = r.total ?? 0;

  // 标签聚合在 JS 层完成，避免 SQL 拼接 JSON 在标签含特殊字符时破坏
  const tagRows = await db.getAllAsync<{ tags: string; amount: number }>(
    f.sql
      ? `SELECT tags, amount FROM records WHERE date LIKE ? AND tags != '' AND ${f.sql}`
      : `SELECT tags, amount FROM records WHERE date LIKE ? AND tags != ''`,
    [likeParam, ...f.params]
  );
  const tagMap = new Map<string, number>();
  for (const r of tagRows) {
    for (const t of r.tags.split(',')) {
      const trimmed = t.trim();
      if (trimmed) tagMap.set(trimmed, (tagMap.get(trimmed) ?? 0) + r.amount);
    }
  }
  const topTags = Array.from(tagMap.entries())
    .map(([tag, total]) => ({ tag, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    month,
    total: totalRow?.total ?? 0,
    count: totalRow?.count ?? 0,
    byMeal,
    topTags,
  };
}

export async function getMonthlyTotals(bookId?: number): Promise<{ month: string; total: number }[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
       FROM records WHERE ${f.sql} GROUP BY month ORDER BY month DESC`
    : `SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
       FROM records GROUP BY month ORDER BY month DESC`;
  const rows = await db.getAllAsync<{ month: string; total: number }>(sql, f.params);
  return rows;
}

// ---------- 地点聚合（足迹页） ----------

export async function getLocations(bookId?: number): Promise<LocationAgg[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const baseWhere = `location_name IS NOT NULL AND location_name != ''
      AND latitude IS NOT NULL AND longitude IS NOT NULL`;
  const sql = f.sql
    ? `SELECT
      location_name AS location_name,
      latitude AS latitude,
      longitude AS longitude,
      COUNT(*) AS count,
      SUM(amount) AS total,
      MAX(date) AS last_date,
      (SELECT photo_uri FROM records r2
       WHERE r2.location_name = records.location_name AND r2.photo_uri IS NOT NULL
       ${f.sql ? `AND ${f.sql}` : ''}
       LIMIT 1) AS sample_photo
    FROM records
    WHERE ${baseWhere} AND ${f.sql}
    GROUP BY location_name, latitude, longitude
    ORDER BY last_date DESC`
    : `SELECT
      location_name AS location_name,
      latitude AS latitude,
      longitude AS longitude,
      COUNT(*) AS count,
      SUM(amount) AS total,
      MAX(date) AS last_date,
      (SELECT photo_uri FROM records r2
       WHERE r2.location_name = records.location_name AND r2.photo_uri IS NOT NULL
       LIMIT 1) AS sample_photo
    FROM records
    WHERE ${baseWhere}
    GROUP BY location_name, latitude, longitude
    ORDER BY last_date DESC`;
  const rows = await db.getAllAsync<LocationAgg>(sql, f.params);
  return rows.map((r) => ({
    ...r,
    sample_photo: r.sample_photo ?? null,
  }));
}

// ---------- 设置 ----------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// 标签联想
export async function getExistingTags(bookId?: number): Promise<string[]> {
  const db = await getDb();
  const f = bookClause(bookId);
  const sql = f.sql
    ? `SELECT DISTINCT tags FROM records WHERE tags != '' AND ${f.sql}`
    : `SELECT DISTINCT tags FROM records WHERE tags != ''`;
  const rows = await db.getAllAsync<{ tags: string }>(sql, f.params);
  const set = new Set<string>();
  for (const r of rows) {
    for (const t of r.tags.split(',')) {
      const trimmed = t.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set);
}

// ---------- 账本 CRUD ----------

function mapBook(r: any): Book {
  return {
    id: r.id,
    name: r.name,
    kind: (r.kind as BookKind) ?? 'default',
    color: r.color ?? 'yellow',
    created_at: r.created_at,
  };
}

export async function listBooks(): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM books ORDER BY id ASC`
  );
  return rows.map(mapBook);
}

export async function getBook(id: number): Promise<Book | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM books WHERE id = ?`, [id]);
  return row ? mapBook(row) : null;
}

export async function addBook(input: { name: string; kind?: BookKind; color?: string }): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO books (name, kind, color, created_at) VALUES (?, ?, ?, ?)`,
    [input.name, input.kind ?? 'default', input.color ?? 'yellow', Date.now()]
  );
  return result.lastInsertRowId as number;
}

export async function updateBook(id: number, input: Partial<{ name: string; kind: BookKind; color: string }>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: any[] = [];
  if (input.name != null) { sets.push('name = ?'); params.push(input.name); }
  if (input.kind != null) { sets.push('kind = ?'); params.push(input.kind); }
  if (input.color != null) { sets.push('color = ?'); params.push(input.color); }
  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteBook(id: number): Promise<void> {
  if (id === 1) throw new Error('默认账本不可删除');
  const db = await getDb();
  // 将该账本下的记录迁移回默认账本（id=1），避免数据丢失
  await db.runAsync(`UPDATE records SET book_id = 1 WHERE book_id = ?`, [id]);
  await db.runAsync(`DELETE FROM books WHERE id = ?`, [id]);
}

// ---------- 食谱 CRUD ----------

function mapRecipe(r: any): Recipe {
  return {
    id: r.id,
    name: r.name,
    ingredients: r.ingredients ?? '',
    steps: r.steps ?? '',
    photo_uri: r.photo_uri ?? null,
    servings: r.servings ?? 1,
    linked_record_id: r.linked_record_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM recipes ORDER BY updated_at DESC`
  );
  return rows.map(mapRecipe);
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM recipes WHERE id = ?`, [id]);
  return row ? mapRecipe(row) : null;
}

export async function getRecipeByRecord(recordId: number): Promise<Recipe | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM recipes WHERE linked_record_id = ? LIMIT 1`,
    [recordId]
  );
  return row ? mapRecipe(row) : null;
}

export async function insertRecipe(input: RecipeInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO recipes (name, ingredients, steps, photo_uri, servings, linked_record_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.ingredients ?? '',
      input.steps ?? '',
      input.photo_uri ?? null,
      input.servings ?? 1,
      input.linked_record_id ?? null,
      now,
      now,
    ]
  );
  return result.lastInsertRowId as number;
}

export async function updateRecipe(id: number, input: Partial<RecipeInput>): Promise<void> {
  const db = await getDb();
  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [Date.now()];
  if (input.name != null) { sets.push('name = ?'); params.push(input.name); }
  if (input.ingredients != null) { sets.push('ingredients = ?'); params.push(input.ingredients); }
  if (input.steps != null) { sets.push('steps = ?'); params.push(input.steps); }
  if (input.photo_uri !== undefined) { sets.push('photo_uri = ?'); params.push(input.photo_uri); }
  if (input.servings != null) { sets.push('servings = ?'); params.push(input.servings); }
  if (input.linked_record_id !== undefined) { sets.push('linked_record_id = ?'); params.push(input.linked_record_id); }
  params.push(id);
  await db.runAsync(`UPDATE recipes SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteRecipe(id: number): Promise<void> {
  const db = await getDb();
  // 若有关联照片，删除文件
  const row = await db.getFirstAsync<{ photo_uri: string | null }>(
    `SELECT photo_uri FROM recipes WHERE id = ?`,
    [id]
  );
  if (row?.photo_uri) {
    try {
      await FileSystem.deleteAsync(row.photo_uri, { idempotent: true });
    } catch {
      /* 忽略 */
    }
  }
  await db.runAsync(`DELETE FROM recipes WHERE id = ?`, [id]);
}
