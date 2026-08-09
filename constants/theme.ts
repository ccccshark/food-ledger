// ===== 复古牛皮纸手账风 主题 =====

export const Colors = {
  // 纸张
  paper: '#E8D5B0',          // 牛皮纸主底色
  paperDeep: '#D9C29A',      // 纸张深色（边缘做旧）
  paperLight: '#F0E2C4',     // 纸张浅色高光
  note: '#FBF5E8',           // 白纸片（微黄）
  noteDeep: '#F4EAD3',       // 白纸片阴影色

  // 墨色
  ink: '#3D2E1F',            // 主文字（深棕墨）
  inkSoft: '#6B5340',        // 次文字
  inkLight: '#9A8466',       // 弱文字

  // 强调色
  stamp: '#B5392F',          // 印章红
  stampSoft: '#D96056',
  olive: '#6B7A3A',          // 橄榄绿
  ochre: '#C8862E',          // 赭黄
  berry: '#8B3A4A',          // 莓红

  // 胶带色（半透明使用）
  tapeYellow: '#E8C547',
  tapePink: '#D49A8A',
  tapeGreen: '#9DB87A',
  tapeBlue: '#8AA9B8',

  // 线条
  line: '#BFA888',           // 分割线/边框
  lineSoft: '#D4C4A0',
  dotted: '#A89070',         // 虚线色

  // 功能色
  success: '#6B7A3A',
  warning: '#C8862E',
  danger: '#B5392F',
  primary: '#B5392F',        // 主操作色用印章红
};

// 餐次配置（手账风配色）
export const Meals = {
  breakfast: { label: '早餐', color: '#C8862E', icon: 'coffee' as const, stamp: '朝食' },
  lunch: { label: '午餐', color: '#6B7A3A', icon: 'cutlery' as const, stamp: '午食' },
  dinner: { label: '晚餐', color: '#8B3A4A', icon: 'moon-o' as const, stamp: '夕食' },
  snack: { label: '零食', color: '#8B5A8C', icon: 'cookie' as const, stamp: '茶点' },
  supper: { label: '夜宵', color: '#4A6B7A', icon: 'glass' as const, stamp: '夜宵' },
};

// 字体规范（标题用衬线体，模拟手写账本感）
export const Fonts = {
  serif: 'serif',              // 系统衬线，模拟账本标题
  serifBold: 'serif',
  hand: 'MaShanZheng_400Regular',   // 中文手写体（标题/装饰文字）
  handEn: 'Caveat_600SemiBold',     // 英文/数字装饰手写
};

// 金额格式化
export function formatMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

// 中文日期
export function formatDateCN(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function monthLabelCN(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

// 农历感数字（简单版：阿拉伯数字转中文用于日期点缀）
export function toCNNumber(n: number): string {
  const cn = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (n <= 10) return cn[n];
  if (n < 20) return '十' + cn[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return cn[t] + '十' + (o ? cn[o] : '');
  }
  return String(n);
}
