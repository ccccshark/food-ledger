import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { LedgerRecord } from '@/types';

// 把记录转为 CSV
function toCsv(records: LedgerRecord[]): string {
  const header = [
    '日期', '餐次', '金额', '标签', '备注',
    '地点', '评分', '照片', '创建时间',
  ];
  const mealMap: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '零食',
    supper: '夜宵',
  };
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(',')];
  for (const r of records) {
    lines.push(
      [
        r.date,
        mealMap[r.meal] ?? r.meal,
        r.amount.toFixed(2),
        r.tags,
        r.note,
        r.location_name ?? '',
        r.rating ? `${r.rating}星` : '',
        r.photo_uri ?? '',
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
  const date = new Date();
  const stamp =
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}` +
    `${String(date.getDate()).padStart(2, '0')}`;
  const fileUri = `${FileSystem.cacheDirectory}food-ledger-${stamp}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('当前设备不支持分享');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: '导出味笺数据',
    UTI: 'public.comma-separated-values-text',
  });
}
