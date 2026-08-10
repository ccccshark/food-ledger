import * as FileSystem from 'expo-file-system';
import type { Book } from '@/types';

// 桌面小组件共享数据文件（与原生 AppWidget 共享，路径：/data/data/{pkg}/files/widget_data.json）
const WIDGET_FILE = `${FileSystem.documentDirectory}widget_data.json`;

export interface WidgetData {
  todayTotal: number;
  todayCount: number;
  bookName: string;
  updatedAt: number;
}

/**
 * 更新桌面小组件显示的数据。
 * 由原生 AppWidget 读取此 JSON 文件渲染今日支出。
 */
export async function updateWidgetData(data: WidgetData): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(WIDGET_FILE, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    /* 忽略：小组件数据更新失败不影响主流程 */
  }
}

/**
 * 从今日汇总 + 当前账本构造小组件数据并写入。
 */
export async function syncWidgetFromState(params: {
  todayTotal: number;
  todayCount: number;
  currentBook?: Book;
}): Promise<void> {
  await updateWidgetData({
    todayTotal: params.todayTotal,
    todayCount: params.todayCount,
    bookName: params.currentBook?.name ?? '味笺',
    updatedAt: Date.now(),
  });
}
