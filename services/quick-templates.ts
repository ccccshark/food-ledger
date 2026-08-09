import type { MealType } from '@/types';

// 本地速记模板（AI 平替方案，无需 API）
export interface FoodTemplate {
  key: string;
  name: string;        // 食物名（填入备注）
  meal: MealType;
  amount: number;      // 默认参考价（元）
  tags: string[];
  icon: string;        // Ionicons 图标名
}

export const QUICK_TEMPLATES: FoodTemplate[] = [
  // 早餐
  { key: 'b1', name: '豆浆油条', meal: 'breakfast', amount: 6, tags: ['早餐', '传统'], icon: 'cafe-outline' },
  { key: 'b2', name: '包子馒头', meal: 'breakfast', amount: 5, tags: ['早餐'], icon: 'nutrition-outline' },
  { key: 'b3', name: '白粥小菜', meal: 'breakfast', amount: 8, tags: ['早餐', '清淡'], icon: 'restaurant-outline' },
  { key: 'b4', name: '煎饼果子', meal: 'breakfast', amount: 7, tags: ['早餐', '街边'], icon: 'fast-food-outline' },
  { key: 'b5', name: '面包牛奶', meal: 'breakfast', amount: 10, tags: ['早餐', '西式'], icon: 'cafe-outline' },
  // 午餐
  { key: 'l1', name: '盒饭快餐', meal: 'lunch', amount: 18, tags: ['午餐', '外卖'], icon: 'fast-food-outline' },
  { key: 'l2', name: '面条米粉', meal: 'lunch', amount: 15, tags: ['午餐', '面食'], icon: 'restaurant-outline' },
  { key: 'l3', name: '麻辣烫', meal: 'lunch', amount: 22, tags: ['午餐', '辣'], icon: 'flame-outline' },
  { key: 'l4', name: '沙拉轻食', meal: 'lunch', amount: 25, tags: ['午餐', '健康'], icon: 'leaf-outline' },
  { key: 'l5', name: '汉堡套餐', meal: 'lunch', amount: 30, tags: ['午餐', '西式'], icon: 'fast-food-outline' },
  // 晚餐
  { key: 'd1', name: '家常便饭', meal: 'dinner', amount: 20, tags: ['晚餐', '家常'], icon: 'restaurant-outline' },
  { key: 'd2', name: '炒菜米饭', meal: 'dinner', amount: 25, tags: ['晚餐'], icon: 'restaurant-outline' },
  { key: 'd3', name: '火锅聚餐', meal: 'dinner', amount: 80, tags: ['晚餐', '聚餐'], icon: 'flame-outline' },
  { key: 'd4', name: '烧烤撸串', meal: 'dinner', amount: 60, tags: ['晚餐', '聚会'], icon: 'flame-outline' },
  { key: 'd5', name: '外卖套餐', meal: 'dinner', amount: 28, tags: ['晚餐', '外卖'], icon: 'bicycle-outline' },
  // 零食
  { key: 's1', name: '奶茶', meal: 'snack', amount: 16, tags: ['奶茶', '下午茶'], icon: 'cafe-outline' },
  { key: 's2', name: '咖啡', meal: 'snack', amount: 22, tags: ['咖啡', '提神'], icon: 'cafe-outline' },
  { key: 's3', name: '水果', meal: 'snack', amount: 15, tags: ['健康'], icon: 'nutrition-outline' },
  { key: 's4', name: '零食小吃', meal: 'snack', amount: 10, tags: ['零食'], icon: 'cube-outline' },
  { key: 's5', name: '蛋糕甜点', meal: 'snack', amount: 18, tags: ['甜点', '下午茶'], icon: 'ice-cream-outline' },
  // 夜宵
  { key: 'n1', name: '宵夜面', meal: 'supper', amount: 15, tags: ['夜宵', '面食'], icon: 'restaurant-outline' },
  { key: 'n2', name: '烧烤串串', meal: 'supper', amount: 45, tags: ['夜宵', '聚会'], icon: 'flame-outline' },
  { key: 'n3', name: '啤酒小酌', meal: 'supper', amount: 30, tags: ['夜宵', '酒'], icon: 'wine-outline' },
  { key: 'n4', name: '泡面速食', meal: 'supper', amount: 8, tags: ['夜宵', '速食'], icon: 'fast-food-outline' },
];

// 按餐次分组
export const TEMPLATES_BY_MEAL: Record<MealType, FoodTemplate[]> = {
  breakfast: QUICK_TEMPLATES.filter((t) => t.meal === 'breakfast'),
  lunch: QUICK_TEMPLATES.filter((t) => t.meal === 'lunch'),
  dinner: QUICK_TEMPLATES.filter((t) => t.meal === 'dinner'),
  snack: QUICK_TEMPLATES.filter((t) => t.meal === 'snack'),
  supper: QUICK_TEMPLATES.filter((t) => t.meal === 'supper'),
};

// 根据当前小时推断餐次
export function guessMealByHour(date: Date = new Date()): MealType {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 10 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 21) return 'dinner';
  return 'supper';
}
