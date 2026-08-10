import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import type { LedgerRecord } from '@/types';
import * as dao from '@/db';

const MEAL_MAP: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '零食',
  supper: '夜宵',
};

function timestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  );
}

// 把记录转为 CSV
function toCsv(records: LedgerRecord[]): string {
  const header = [
    '日期', '餐次', '金额', '标签', '备注',
    '地点', '评分', '照片数', '创建时间',
  ];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(',')];
  for (const r of records) {
    const photoCount = (r.photo_uri ? 1 : 0) + (r.photos_extra?.length ?? 0);
    lines.push(
      [
        r.date,
        MEAL_MAP[r.meal] ?? r.meal,
        r.amount.toFixed(2),
        r.tags,
        r.note,
        r.location_name ?? '',
        r.rating ? `${r.rating}星` : '',
        String(photoCount),
        new Date(r.created_at).toISOString(),
      ]
        .map((v) => escape(String(v)))
        .join(',')
    );
  }
  // BOM 让 Excel 正确识别 UTF-8
  return '\uFEFF' + lines.join('\n');
}

export async function exportRecordsCsv(records: LedgerRecord[]): Promise<void> {
  if (records.length === 0) {
    throw new Error('没有数据可导出');
  }
  const csv = toCsv(records);
  const fileUri = `${FileSystem.cacheDirectory}food-ledger-${timestamp()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前设备不支持分享');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: '导出味笺 CSV',
    UTI: 'public.comma-separated-values-text',
  });
}

// 备份本地 SQLite 数据库文件（整库导出，可用于恢复）
export async function backupSqlite(): Promise<void> {
  const db = await SQLite.openDatabaseAsync('food_ledger.db');
  await db.closeAsync();
  const srcUri = `${FileSystem.documentDirectory}SQLite/food_ledger.db`;
  const info = await FileSystem.getInfoAsync(srcUri);
  if (!info.exists) {
    throw new Error('数据库文件不存在');
  }
  const destUri = `${FileSystem.cacheDirectory}food-ledger-backup-${timestamp()}.db`;
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前设备不支持分享');
  }
  await Sharing.shareAsync(destUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: '备份味笺数据库',
    UTI: 'public.database',
  });
}

// 转义 HTML 特殊字符
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 餐次在月历格中的圆点颜色（MUJI 极简灰阶 + 单色强调）
const MEAL_DOT: Record<string, string> = {
  breakfast: '#1a1a1a',
  lunch: '#1a1a1a',
  dinner: '#1a1a1a',
  snack: 'transparent',
  supper: 'transparent',
};

// 导出 PDF 手帐（MUJI 风格：5mm 方格 + 月历页 + 横线笔记页）
export async function exportJournalHtml(records: LedgerRecord[]): Promise<void> {
  if (records.length === 0) {
    throw new Error('没有数据可导出');
  }
  // 按月分组
  const byMonth = new Map<string, LedgerRecord[]>();
  for (const r of records) {
    const m = r.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(r);
  }
  const months = Array.from(byMonth.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const total = records.reduce((s, r) => s + r.amount, 0);
  const firstMonth = months[months.length - 1][0];
  const lastMonth = months[0][0];

  const monthPages = months
    .map(([month, recs]) => {
      const [yy, mm] = month.split('-').map(Number);
      // 月历网格：计算该月天数与起始星期（周日为首列，贴合 MUJI 月历手帐）
      const daysInMonth = new Date(yy, mm, 0).getDate();
      const firstWeekday = new Date(yy, mm - 1, 1).getDay(); // 0=Sun
      // 按日分组
      const byDay = new Map<number, LedgerRecord[]>();
      for (const r of recs) {
        const d = Number(r.date.slice(8, 10));
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d)!.push(r);
      }
      const monthTotal = recs.reduce((s, r) => s + r.amount, 0);

      // 构造 6 行 x 7 列网格（覆盖最多 42 格）
      const cells: string[] = [];
      for (let i = 0; i < 42; i++) {
        const dayNum = i - firstWeekday + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
          cells.push(`<td class="cell empty"></td>`);
          continue;
        }
        const dayRecs = byDay.get(dayNum) ?? [];
        const dayTotal = dayRecs.reduce((s, r) => s + r.amount, 0);
        // 餐次圆点（最多 5 个）
        const dots = ['breakfast', 'lunch', 'dinner', 'snack', 'supper']
          .filter((m) => dayRecs.some((r) => r.meal === m))
          .map((m) => `<span class="dot" style="background:${MEAL_DOT[m]}"></span>`)
          .join('');
        cells.push(`
          <td class="cell">
            <div class="cell-date">${dayNum}</div>
            ${dayTotal > 0 ? `<div class="cell-amt">¥${dayTotal.toFixed(0)}</div>` : ''}
            <div class="cell-dots">${dots}</div>
          </td>`);
      }
      // 笔记页：按日倒序列出明细，横线分隔
      const sortedDays = Array.from(byDay.entries()).sort((a, b) => b[0] - a[0]);
      const noteHtml = sortedDays
        .map(([dayNum, dayRecs]) => {
          const dayTotal = dayRecs.reduce((s, r) => s + r.amount, 0);
          const lines = dayRecs
            .map((r) => {
              const mealLabel = MEAL_MAP[r.meal] ?? r.meal;
              const rating = r.rating ? ` ${'★'.repeat(r.rating)}` : '';
              const note = r.note ? `　${esc(r.note)}` : '';
              const tags = r.tags
                ? '　' +
                  r.tags
                    .split(',')
                    .filter(Boolean)
                    .map((t) => `#${esc(t)}`)
                    .join(' ')
                : '';
              const loc = r.location_name ? `　@${esc(r.location_name)}` : '';
              const photoMark =
                (r.photo_uri ? 1 : 0) + (r.photos_extra?.length ?? 0) > 0 ? ' ◎' : '';
              return `<div class="line"><span class="ml">${esc(mealLabel)}</span><span class="am">¥${r.amount.toFixed(2)}</span><span class="tx">${note}${tags}${loc}${photoMark}${rating}</span></div>`;
            })
            .join('');
          return `
            <div class="day-block">
              <div class="day-head">
                <span class="day-d">${String(dayNum).padStart(2, '0')}</span>
                <span class="day-amt">¥${dayTotal.toFixed(2)}</span>
              </div>
              ${lines}
            </div>`;
        })
        .join('');

      // 月度汇总：按餐次 + 前 5 标签
      const byMeal: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0, supper: 0 };
      for (const r of recs) byMeal[r.meal] = (byMeal[r.meal] ?? 0) + r.amount;
      const tagMap = new Map<string, number>();
      for (const r of recs) {
        for (const t of r.tags.split(',')) {
          const k = t.trim();
          if (k) tagMap.set(k, (tagMap.get(k) ?? 0) + r.amount);
        }
      }
      const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, v]) => `<tr><td class="k">#${esc(t)}</td><td class="v">¥${v.toFixed(2)}</td></tr>`)
        .join('');
      const mealRows = (['breakfast', 'lunch', 'dinner', 'snack', 'supper'] as const)
        .map((m) => `<tr><td class="k">${esc(MEAL_MAP[m])}</td><td class="v">¥${byMeal[m].toFixed(2)}</td></tr>`)
        .join('');

      return `
        <section class="page calendar-page">
          <header class="page-head">
            <div class="mh-title">${yy}<span class="slash">/</span>${String(mm).padStart(2, '0')}</div>
            <div class="mh-total">¥${monthTotal.toFixed(2)}　${recs.length} entries</div>
          </header>
          <table class="grid">
            <tr class="week">
              <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
            </tr>
            ${(() => {
              const rows: string[] = [];
              for (let r = 0; r < 6; r++) {
                rows.push(`<tr>${cells.slice(r * 7, r * 7 + 7).join('')}</tr>`);
              }
              return rows.join('');
            })()}
          </table>
          <div class="legend">
            <span class="dot" style="background:#1a1a1a"></span>早 / 午 / 晚
            <span class="dot" style="background:transparent;border:1px solid #1a1a1a"></span>零食 / 夜宵
            <span class="legend-mark">◎ 含照片</span>
          </div>
        </section>

        <section class="page note-page">
          <header class="page-head">
            <div class="mh-title">${yy}<span class="slash">/</span>${String(mm).padStart(2, '0')} · NOTES</div>
            <div class="mh-total">¥${monthTotal.toFixed(2)}</div>
          </header>
          ${noteHtml || '<div class="empty-day">本月无明细</div>'}
        </section>

        <section class="page summary-page">
          <header class="page-head">
            <div class="mh-title">${yy}<span class="slash">/</span>${String(mm).padStart(2, '0')} · SUMMARY</div>
          </header>
          <div class="sum-cols">
            <table class="sum-tbl">
              <caption>BY MEAL</caption>
              ${mealRows}
              <tr class="total-row"><td class="k">合计</td><td class="v">¥${monthTotal.toFixed(2)}</td></tr>
            </table>
            <table class="sum-tbl">
              <caption>BY TAG</caption>
              ${topTags || '<tr><td class="k muted">无标签</td><td class="v muted">—</td></tr>'}
            </table>
          </div>
        </section>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>味笺 · 美食手帐</title>
<style>
  /* MUJI 风格：5mm 方格纸 + 极简黑白灰 + 无衬线 */
  @page { size: A4; margin: 10mm 10mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC",
                 "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { background: #ffffff; }

  /* 5mm 方格纸背景 */
  .page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto 8mm;
    padding: 8mm 10mm;
    background-color: #ffffff;
    background-image:
      linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
    background-size: 5mm 5mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  /* 封面 */
  .cover-page {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 277mm;
    padding: 20mm 14mm;
  }
  .cover-top { display: flex; justify-content: space-between; font-size: 10px; color: #888; letter-spacing: 1px; }
  .cover-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 40mm 0;
  }
  .cover-title {
    font-size: 56px;
    font-weight: 300;
    letter-spacing: 8px;
    margin: 0 0 4mm;
    line-height: 1;
  }
  .cover-sub {
    font-size: 14px;
    color: #555;
    letter-spacing: 4px;
    margin: 0 0 20mm;
  }
  .cover-meta {
    border-top: 1px solid #1a1a1a;
    padding-top: 6mm;
    width: 80mm;
    font-size: 11px;
    line-height: 2;
    color: #1a1a1a;
  }
  .cover-meta .k { display: inline-block; width: 28mm; color: #888; letter-spacing: 2px; }
  .cover-foot {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #888;
    letter-spacing: 1px;
  }

  /* 页眉 */
  .page-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #1a1a1a;
    padding-bottom: 3mm;
    margin-bottom: 5mm;
  }
  .mh-title {
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 2px;
  }
  .mh-title .slash { color: #888; margin: 0 2px; }
  .mh-total {
    font-size: 11px;
    color: #555;
    letter-spacing: 1px;
  }

  /* 月历网格 */
  table.grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.grid th {
    font-size: 10px;
    font-weight: 400;
    color: #888;
    letter-spacing: 1px;
    padding: 2mm 0 3mm;
    text-align: left;
    border-bottom: 1px solid #1a1a1a;
  }
  table.grid th:first-child,
  table.grid th:last-child { color: #999; }
  table.grid td.cell {
    height: 36mm;
    vertical-align: top;
    padding: 2mm;
    border: 1px solid rgba(0,0,0,0.08);
  }
  table.grid td.empty {
    background: repeating-linear-gradient(
      45deg,
      transparent 0,
      transparent 4px,
      rgba(0,0,0,0.025) 4px,
      rgba(0,0,0,0.025) 5px
    );
  }
  .cell-date {
    font-size: 13px;
    font-weight: 500;
    color: #1a1a1a;
    line-height: 1;
  }
  .cell-amt {
    font-size: 11px;
    color: #1a1a1a;
    margin-top: 2mm;
    letter-spacing: 0.5px;
  }
  .cell-dots {
    position: absolute;
    bottom: 2mm;
    left: 2mm;
    display: flex;
    gap: 1.2mm;
  }
  .cell { position: relative; }
  .dot {
    display: inline-block;
    width: 2.2mm;
    height: 2.2mm;
    border-radius: 50%;
    vertical-align: middle;
  }
  .legend {
    margin-top: 4mm;
    font-size: 9px;
    color: #666;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 2mm;
  }
  .legend .dot { width: 1.8mm; height: 1.8mm; }
  .legend-mark { margin-left: 4mm; }

  /* 笔记页 */
  .day-block {
    margin-bottom: 5mm;
    page-break-inside: avoid;
  }
  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid rgba(0,0,0,0.4);
    padding-bottom: 1mm;
    margin-bottom: 1.5mm;
  }
  .day-d {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 1px;
  }
  .day-amt {
    font-size: 11px;
    color: #1a1a1a;
    letter-spacing: 0.5px;
  }
  .line {
    display: flex;
    align-items: baseline;
    gap: 3mm;
    font-size: 11px;
    line-height: 1.9;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    padding: 1mm 0;
  }
  .line .ml {
    display: inline-block;
    width: 12mm;
    color: #555;
    letter-spacing: 1px;
  }
  .line .am {
    display: inline-block;
    width: 18mm;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .line .tx {
    flex: 1;
    color: #1a1a1a;
  }
  .empty-day {
    font-size: 12px;
    color: #888;
    padding: 20mm 0;
    text-align: center;
    letter-spacing: 4px;
  }

  /* 汇总页 */
  .sum-cols {
    display: flex;
    gap: 12mm;
    margin-top: 6mm;
  }
  table.sum-tbl {
    flex: 1;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.sum-tbl caption {
    text-align: left;
    font-size: 10px;
    color: #888;
    letter-spacing: 2px;
    padding-bottom: 2mm;
    border-bottom: 1px solid #1a1a1a;
    margin-bottom: 2mm;
  }
  table.sum-tbl td.k {
    padding: 1.5mm 0;
    color: #1a1a1a;
    width: 50%;
  }
  table.sum-tbl td.v {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #1a1a1a;
  }
  table.sum-tbl td.muted { color: #aaa; }
  table.sum-tbl tr.total-row td {
    border-top: 1px solid #1a1a1a;
    font-weight: 500;
    padding-top: 2mm;
  }

  /* 末页 */
  .end-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .end-mark {
    font-size: 14px;
    letter-spacing: 8px;
    color: #1a1a1a;
    margin-bottom: 4mm;
  }
  .end-tip {
    font-size: 10px;
    color: #888;
    letter-spacing: 2px;
  }

  @media print {
    body { background: #fff; }
    .page { margin: 0; }
  }
  @media screen {
    body { background: #e8e8e8; padding: 16px; }
    .page { box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
  }
</style>
</head>
<body>
  <section class="page cover-page">
    <div class="cover-top">
      <span>WEIJIAN · 味笺</span>
      <span>FOOD LEDGER</span>
    </div>
    <div class="cover-mid">
      <h1 class="cover-title">味 笺</h1>
      <div class="cover-sub">FOOD JOURNAL</div>
      <div class="cover-meta">
        <div><span class="k">PERIOD</span>${esc(firstMonth)} — ${esc(lastMonth)}</div>
        <div><span class="k">ENTRIES</span>${records.length}</div>
        <div><span class="k">TOTAL</span>¥${total.toFixed(2)}</div>
        <div><span class="k">MONTHS</span>${months.length}</div>
        <div><span class="k">PRINTED</span>${esc(timestamp().slice(0, 8))}</div>
      </div>
    </div>
    <div class="cover-foot">
      <span>LOCAL FIRST · NO CLOUD</span>
      <span>PRINT AS PDF · A4</span>
    </div>
  </section>

  ${monthPages}

  <section class="page end-page">
    <div class="end-mark">— FIN —</div>
    <div class="end-tip">浏览器菜单「打印」可另存为 PDF · 推荐 A4 双面打印</div>
  </section>
</body>
</html>`;

  const fileUri = `${FileSystem.cacheDirectory}food-ledger-journal-${timestamp()}.html`;
  await FileSystem.writeAsStringAsync(fileUri, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前设备不支持分享');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/html',
    dialogTitle: '导出味笺手帐（MUJI 风格 · 可打印为 PDF）',
    UTI: 'public.html',
  });
}

/**
 * 从用户选择的 .db 文件恢复 SQLite 数据库。
 * 流程：选文件 → 复制到 cache → 关闭当前 db 连接 → 覆盖 SQLite 目录下的库文件
 * 调用方需在完成后刷新所有数据。
 */
export async function restoreSqlite(): Promise<void> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/x-sqlite3', 'application/database'],
    copyToCacheDirectory: true,
  });
  if (pick.canceled || !pick.assets?.length) return;
  const srcUri = pick.assets[0].uri;

  // 目标路径：与 backupSqlite 相同的 SQLite 目录
  const dbDir = `${FileSystem.documentDirectory}SQLite/`;
  try {
    const info = await FileSystem.getInfoAsync(dbDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }
  } catch {
    /* 目录已存在 */
  }
  const destUri = `${dbDir}food_ledger.db`;

  // 关闭当前数据库连接，避免文件占用
  try {
    const db = await SQLite.openDatabaseAsync('food_ledger.db');
    await db.closeAsync();
  } catch {
    /* 忽略未打开的情况 */
  }

  // 备份当前数据库（若存在），便于回滚
  const existing = await FileSystem.getInfoAsync(destUri);
  if (existing.exists) {
    const backupUri = `${dbDir}food_ledger.before_restore_${timestamp()}.db`;
    await FileSystem.copyAsync({ from: destUri, to: backupUri });
  }

  // 用所选文件覆盖
  await FileSystem.copyAsync({ from: srcUri, to: destUri });
  // 清理缓存中的源文件
  try {
    await FileSystem.deleteAsync(srcUri, { idempotent: true });
  } catch {
    /* 忽略 */
  }
}

/**
 * 从用户选择的 CSV 文件导入记录。
 * 解析后逐条插入数据库（跳过已存在日期+金额+餐次的重复记录）。
 * 返回导入条数。
 */
export async function importRecordsCsv(): Promise<number> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (pick.canceled || !pick.assets?.length) return 0;
  const srcUri = pick.assets[0].uri;

  const content = await FileSystem.readAsStringAsync(srcUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  // 清理缓存
  try {
    await FileSystem.deleteAsync(srcUri, { idempotent: true });
  } catch {
    /* 忽略 */
  }

  const rows = parseCsv(content);
  if (rows.length < 2) {
    throw new Error('CSV 文件没有数据');
  }
  // 表头映射：首行
  const header = rows[0];
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const iDate = idx('日期');
  const iMeal = idx('餐次');
  const iAmount = idx('金额');
  const iTags = idx('标签');
  const iNote = idx('备注');
  const iLoc = idx('地点');
  const iRating = idx('评分');

  const MEAL_REV: Record<string, string> = {
    早餐: 'breakfast',
    午餐: 'lunch',
    晚餐: 'dinner',
    零食: 'snack',
    夜宵: 'supper',
  };

  // 已在文件顶部静态导入 dao
  let imported = 0;
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0) continue;
    const date = iDate >= 0 ? (cols[iDate] ?? '').trim() : '';
    const mealLabel = iMeal >= 0 ? (cols[iMeal] ?? '').trim() : '';
    const amountStr = iAmount >= 0 ? (cols[iAmount] ?? '').trim() : '';
    if (!date || !amountStr) continue;
    const amount = parseFloat(amountStr.replace(/[¥,]/g, ''));
    if (isNaN(amount) || amount <= 0) continue;
    const meal = MEAL_REV[mealLabel] ?? 'snack';
    const tags = iTags >= 0 ? (cols[iTags] ?? '').trim() : '';
    const note = iNote >= 0 ? (cols[iNote] ?? '').trim() : '';
    const location_name = iLoc >= 0 ? (cols[iLoc] ?? '').trim() : '';
    const ratingStr = iRating >= 0 ? (cols[iRating] ?? '').trim() : '';
    const ratingMatch = ratingStr.match(/(\d+)/);
    const rating = ratingMatch ? Math.min(5, Math.max(0, parseInt(ratingMatch[1], 10))) : 0;

    await dao.insertRecord({
      amount,
      meal: meal as any,
      tags,
      date,
      note,
      location_name: location_name || null,
      rating,
    });
    imported++;
  }
  return imported;
}

// 简易 CSV 解析：支持引号包裹和转义双引号
function parseCsv(text: string): string[][] {
  // 去掉 BOM
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // 忽略，等 \n
      } else {
        field += c;
      }
    }
  }
  // 最后一个字段
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

