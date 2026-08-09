import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import type { LedgerRecord } from '@/types';

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

// 导出 PDF 手帐（生成可打印为 PDF 的 HTML，浏览器/打印对话框可另存为 PDF）
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

  const monthBlocks = months
    .map(([month, recs]) => {
      const sorted = [...recs].sort((a, b) => (a.date < b.date ? 1 : -1));
      const monthTotal = sorted.reduce((s, r) => s + r.amount, 0);
      const rows = sorted
        .map((r) => {
          const photoCount = (r.photo_uri ? 1 : 0) + (r.photos_extra?.length ?? 0);
          const tags = r.tags
            ? r.tags
                .split(',')
                .filter(Boolean)
                .map((t) => `<span class="tag">#${esc(t)}</span>`)
                .join('')
            : '';
          return `
            <div class="entry">
              <div class="entry-head">
                <span class="date">${esc(r.date)}</span>
                <span class="meal">${esc(MEAL_MAP[r.meal] ?? r.meal)}</span>
                <span class="amount">¥${r.amount.toFixed(2)}</span>
                ${r.rating ? `<span class="rating">${'★'.repeat(r.rating)}</span>` : ''}
                ${photoCount ? `<span class="photo">📷 ${photoCount}</span>` : ''}
              </div>
              ${r.location_name ? `<div class="loc">📍 ${esc(r.location_name)}</div>` : ''}
              ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
              ${tags ? `<div class="tags">${tags}</div>` : ''}
            </div>`;
        })
        .join('');
      return `
        <section class="month">
          <h2>${esc(month)} · 合计 ¥${monthTotal.toFixed(2)} · ${sorted.length} 笔</h2>
          ${rows}
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
  @page { size: A4; margin: 18mm 16mm; }
  body {
    font-family: "Songti SC", "Noto Serif SC", "SimSun", serif;
    color: #3D2E1F;
    background: #FBF5E8;
    line-height: 1.7;
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
  }
  .cover {
    text-align: center;
    padding: 40px 0 30px;
    border-bottom: 2px dashed #BFA888;
    margin-bottom: 24px;
  }
  .cover h1 {
    font-size: 34px;
    letter-spacing: 12px;
    margin: 0 0 8px;
    color: #B5392F;
  }
  .cover .sub {
    font-size: 13px;
    color: #9A8466;
    font-style: italic;
  }
  .summary {
    display: flex;
    justify-content: space-around;
    background: #F0E2C4;
    border: 1px dashed #BFA888;
    border-radius: 6px;
    padding: 14px;
    margin-bottom: 28px;
    font-size: 13px;
  }
  .summary .item { text-align: center; }
  .summary .v { font-size: 20px; font-weight: 700; color: #3D2E1F; }
  .summary .l { color: #9A8466; font-size: 11px; }
  section.month { margin-bottom: 32px; page-break-inside: avoid; }
  section.month h2 {
    font-size: 18px;
    color: #6B7A3A;
    border-left: 4px solid #6B7A3A;
    padding-left: 10px;
    margin: 0 0 14px;
  }
  .entry {
    background: #fff;
    border: 1px solid rgba(61,46,31,0.12);
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .entry-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .entry-head .date { color: #6B5340; }
  .entry-head .meal {
    background: #F0E2C4;
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 11px;
  }
  .entry-head .amount {
    margin-left: auto;
    font-weight: 700;
    color: #B5392F;
    font-size: 15px;
  }
  .entry-head .rating { color: #C8862E; font-size: 12px; }
  .entry-head .photo { color: #9A8466; font-size: 11px; }
  .loc { color: #6B7A3A; font-size: 12px; margin-top: 4px; }
  .note {
    font-family: "Ma Shan Zheng", "Kaiti SC", cursive;
    font-size: 14px;
    color: #3D2E1F;
    margin-top: 6px;
    padding: 6px 10px;
    background: rgba(232,197,71,0.12);
    border-left: 3px solid #E8C547;
  }
  .tags { margin-top: 6px; }
  .tag {
    display: inline-block;
    font-size: 11px;
    color: #6B5340;
    border: 1px dashed #BFA888;
    border-radius: 3px;
    padding: 1px 6px;
    margin-right: 4px;
  }
  .footer {
    text-align: center;
    color: #9A8466;
    font-size: 11px;
    font-style: italic;
    margin-top: 30px;
    padding-top: 16px;
    border-top: 1px dashed #BFA888;
  }
  @media print {
    body { background: #fff; }
    .entry { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="cover">
    <h1>味 笺</h1>
    <div class="sub">美食手帐 · ${esc(timestamp().slice(0, 8))}</div>
  </div>
  <div class="summary">
    <div class="item"><div class="v">${records.length}</div><div class="l">笔记录</div></div>
    <div class="item"><div class="v">¥${total.toFixed(2)}</div><div class="l">累计支出</div></div>
    <div class="item"><div class="v">${months.length}</div><div class="l">记账月数</div></div>
  </div>
  ${monthBlocks}
  <div class="footer">— 味笺 · 本地优先 · 数据仅存于本机 —<br/>浏览器菜单「打印」可另存为 PDF</div>
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
    dialogTitle: '导出味笺手帐（可在浏览器打印为 PDF）',
    UTI: 'public.html',
  });
}

