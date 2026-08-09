// 餐次类型
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'supper';

// 用餐场景（Phase 2 用，先定义）
export type SceneType = 'dineIn' | 'takeout' | 'home' | 'gathering';

// 记账记录（注意：避免覆盖 TS 内置 Record 工具类型，命名为 LedgerRecord）
export interface LedgerRecord {
  id: number;
  amount: number;
  meal: MealType;
  tags: string;       // 逗号分隔，如 "奶茶,外卖"
  date: string;       // YYYY-MM-DD
  note: string;
  created_at: number; // 毫秒时间戳
  // Phase 2 新增
  photo_uri?: string | null;       // 本地照片文件路径
  latitude?: number | null;        // 纬度
  longitude?: number | null;       // 经度
  location_name?: string | null;   // 地点名称（手动输入或获取）
  rating?: number;                 // 0-5 评分，0 表示未评
}

// 新建记录入参
export interface RecordInput {
  amount: number;
  meal: MealType;
  tags?: string;
  date: string;
  note?: string;
  photo_uri?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  rating?: number;
}

// 月度统计聚合
export interface MonthSummary {
  month: string;          // YYYY-MM
  total: number;
  count: number;
  byMeal: Record<MealType, number>;
  topTags: { tag: string; total: number }[];
}

// 日统计
export interface DaySummary {
  date: string;
  total: number;
  count: number;
}

// 设置项
export interface Settings {
  monthlyBudget: number; // 0 表示未设置
}

// 快捷记账入口配置
export interface QuickEntry {
  meal: MealType;
  label: string;
  icon: string;  // FontAwesome 图标名
  color: string;
}

// 地点聚合（足迹页用）
export interface LocationAgg {
  location_name: string;
  latitude: number;
  longitude: number;
  count: number;
  total: number;
  last_date: string;
  sample_photo?: string | null;
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '零食',
  supper: '夜宵',
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'supper'];

export const QUICK_ENTRIES: QuickEntry[] = [
  { meal: 'breakfast', label: '早餐', icon: 'coffee', color: '#F59E0B' },
  { meal: 'lunch', label: '午餐', icon: 'cutlery', color: '#10B981' },
  { meal: 'dinner', label: '晚餐', icon: 'moon-o', color: '#6366F1' },
  { meal: 'snack', label: '零食', icon: 'cookie', color: '#EC4899' },
  { meal: 'supper', label: '夜宵', icon: 'glass', color: '#8B5CF6' },
];
