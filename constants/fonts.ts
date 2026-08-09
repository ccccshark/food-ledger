import {
  useFonts,
  MaShanZheng_400Regular,
} from '@expo-google-fonts/ma-shan-zheng';
import { Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Colors } from '@/constants/theme';

// 字体名常量
export const FONT_HAND = 'MaShanZheng_400Regular'; // 中文手写体
export const FONT_HAND_EN = 'Caveat_600SemiBold';  // 英文装饰手写
export const FONT_SERIF = 'serif';                  // 兜底衬线

// 在根布局调用一次
export function useAppFonts(): { ready: boolean } {
  const [loaded] = useFonts({
    MaShanZheng_400Regular,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });
  return { ready: loaded };
}

// 解析字体：中文走 Ma Shan Zheng，纯英文/数字走 Caveat
export function pickFont(text?: string): string {
  if (!text) return FONT_HAND;
  // 含中文字符 → 中文手写体
  if (/[\u4e00-\u9fff]/.test(text)) return FONT_HAND;
  return FONT_HAND_EN;
}
