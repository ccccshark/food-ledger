import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import type {
  LedgerRecord,
  RecordInput,
  MonthSummary,
  DaySummary,
  MealType,
  LocationAgg,
} from '@/types';
import { MEAL_ORDER } from '@/types';

const DB_NAME = 'food_ledger.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await initSchema(dbInstance);
    await migrate(dbInstance);
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
  ];

  for (const a of additions) {
    if (!names.has(a.col)) {
      await db.execAsync(a.sql);
    }
  }

  // 索引（地点查询）
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_records_location ON records(location_name);
  `);
}

// ---------- 记录 CRUD ----------

function mapRow(r: any): LedgerRecord {
  return {
    ...r,
    photo_uri: r.photo_uri ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    location_name: r.location_name ?? null,
    rating: r.rating ?? 0,
  };
}

export async function insertRecord(input: RecordInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO records
      (amount, meal, tags, date, note, created_at, photo_uri, latitude, longitude, location_name, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return result.lastInsertRowId as number;
}

export async function updateRecord(id: number, input: RecordInput): Promise<void> {
  const db = await getDb();
  // 若更换或清空了照片，删除旧照片文件避免残留
  if (input.photo_uri !== undefined) {
    const old = await db.getFirstAsync<{ photo_uri: string | null }>(
      `SELECT photo_uri FROM records WHERE id = ?`,
      [id]
    );
    if (old?.photo_uri && old.photo_uri !== input.photo_uri) {
      try {
        await FileSystem.deleteAsync(old.photo_uri, { idempotent: true });
      } catch {
        /* 忽略文件删除失败 */
      }
    }
  }
  await db.runAsync(
    `UPDATE records SET
      amount = ?, meal = ?, tags = ?, date = ?, note = ?,
      photo_uri = ?, latitude = ?, longitude = ?, location_name = ?, rating = ?
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
      id,
    ]
  );
}

export async function deleteRecord(id: number): Promise<void> {
  const db = await getDb();
  // 删除关联照片文件
  const row = await db.getFirstAsync<{ photo_uri: string | null }>(
    `SELECT photo_uri FROM records WHERE id = ?`,
    [id]
  );
  if (row?.photo_uri) {
    try {
      await FileSystem.deleteAsync(row.photo_uri, { idempotent: true });
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

export async function listRecordsByMonth(month: string): Promise<LedgerRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM records WHERE date LIKE ? ORDER BY date DESC, created_at DESC`,
    [`${month}%`]
  );
  return rows.map(mapRow);
}

export async function listAllRecords(): Promise<LedgerRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM records ORDER BY date DESC, created_at DESC`
  );
  return rows.map(mapRow);
}

// 月历视图：某月每日聚合
export async function getMonthCalendar(month: string): Promise<DaySummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DaySummary>(
    `SELECT date, SUM(amount) AS total, COUNT(*) AS count
     FROM records WHERE date LIKE ?
     GROUP BY date ORDER BY date ASC`,
    [`${month}%`]
  );
  return rows;
}

// ---------- 聚合统计 ----------

export async function getDaySummary(date: string): Promise<DaySummary> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date = ?`,
    [date]
  );
  return { date, total: row?.total ?? 0, count: row?.count ?? 0 };
}

// 最近 N 天每日聚合（用于趋势图）
export async function getRecentDailyTotals(days = 7): Promise<DaySummary[]> {
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
  const rows = await db.getAllAsync<DaySummary>(
    `SELECT date, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM records WHERE date BETWEEN ? AND ?
     GROUP BY date ORDER BY date ASC`,
    [startStr, endStr]
  );
  return rows;
}

export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const db = await getDb();

  const totalRow = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM records WHERE date LIKE ?`,
    [`${month}%`]
  );

  const mealRows = await db.getAllAsync<{ meal: MealType; total: number }>(
    `SELECT meal, SUM(amount) AS total FROM records WHERE date LIKE ? GROUP BY meal`,
    [`${month}%`]
  );
  const byMeal = {} as Record<MealType, number>;
  for (const m of MEAL_ORDER) byMeal[m] = 0;
  for (const r of mealRows) byMeal[r.meal] = r.total ?? 0;

  // 标签聚合在 JS 层完成，避免 SQL 拼接 JSON 在标签含特殊字符时破坏
  const tagRows = await db.getAllAsync<{ tags: string; amount: number }>(
    `SELECT tags, amount FROM records WHERE date LIKE ? AND tags != ''`,
    [`${month}%`]
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

export async function getMonthlyTotals(): Promise<{ month: string; total: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ month: string; total: number }>(`
    SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
    FROM records GROUP BY month ORDER BY month DESC
  `);
  return rows;
}

// ---------- 地点聚合（足迹页） ----------

export async function getLocations(): Promise<LocationAgg[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LocationAgg>(`
    SELECT
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
    WHERE location_name IS NOT NULL AND location_name != ''
      AND latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY location_name, latitude, longitude
    ORDER BY last_date DESC
  `);
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
export async function getExistingTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tags: string }>(
    `SELECT DISTINCT tags FROM records WHERE tags != ''`
  );
  const set = new Set<string>();
  for (const r of rows) {
    for (const t of r.tags.split(',')) {
      const trimmed = t.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return Array.from(set);
}
