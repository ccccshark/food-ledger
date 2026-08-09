import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import type { AiConfig } from '@/services/ai';

// 照片形状
export type PhotoShape = 'square' | 'circle' | 'rounded' | 'heart';

export const PHOTO_SHAPES: PhotoShape[] = ['square', 'rounded', 'circle', 'heart'];

export const PHOTO_SHAPE_LABELS: Record<PhotoShape, string> = {
  square: '方形',
  rounded: '圆角',
  circle: '圆形',
  heart: '心形',
};

// 最大边长，超过则自动缩小
const MAX_DIMENSION = 1080;

/**
 * 自动缩小大图（避免占用过多存储与内存），返回新文件 URI。
 * 小图则原样返回。
 */
export async function autoShrink(uri: string): Promise<string> {
  try {
    const img = await ImageManipulator.manipulateAsync(uri, [], {});
    const w = img.width;
    const h = img.height;
    if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
      return uri;
    }
    const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: Math.round(w * ratio) } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
}

/**
 * 按比例裁剪为正方形（居中裁切），用于圆形/心形等需要正方形的形状。
 */
export async function cropToSquare(uri: string): Promise<string> {
  try {
    const img = await ImageManipulator.manipulateAsync(uri, [], {});
    const size = Math.min(img.width, img.height);
    const originX = Math.round((img.width - size) / 2);
    const originY = Math.round((img.height - size) / 2);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: size, height: size } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
}

interface FoodBox {
  x: number; // 左上角 x（归一化 0-1）
  y: number; // 左上角 y（归一化 0-1）
  w: number; // 宽（归一化 0-1）
  h: number; // 高（归一化 0-1）
}

// 调用 Vision API 识别食物在图中的边界框（归一化坐标）
async function detectFoodBox(config: AiConfig, imageUri: string): Promise<FoodBox | null> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = (imageUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${base64}`;

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const prompt = `请找出这张图中主体美食所在的边界框，返回严格 JSON（不要其他文字）：
{"x": 左上角x(0-1归一化), "y": 左上角y(0-1归一化), "w": 宽(0-1归一化), "h": 高(0-1归一化)}
只返回 JSON。如果图中没有食物或无法判断，返回 {"x":0,"y":0,"w":1,"h":1}。`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!resp.ok) {
    throw new Error(`API ${resp.status}`);
  }
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    const box: FoodBox = {
      x: clamp(Number(obj.x) || 0),
      y: clamp(Number(obj.y) || 0),
      w: clamp(Number(obj.w) || 1),
      h: clamp(Number(obj.h) || 1),
    };
    return box;
  } catch {
    return null;
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * AI 抠图：识别食物边界框并裁剪出主体，自动缩小保存。
 * 返回裁剪后的新照片 URI。
 */
export async function cutoutFood(
  config: AiConfig,
  imageUri: string
): Promise<string> {
  // 先缩小原图
  const shrunk = await autoShrink(imageUri);
  const img = await ImageManipulator.manipulateAsync(shrunk, [], {});
  const box = await detectFoodBox(config, shrunk);
  if (!box) {
    // 识别失败，返回缩小后的原图
    return shrunk;
  }
  // 边界框外扩 10% 留白，避免裁太紧
  const pad = 0.1;
  const x = clamp(box.x - box.w * pad);
  const y = clamp(box.y - box.h * pad);
  const w = clamp(box.w * (1 + 2 * pad));
  const h = clamp(box.h * (1 + 2 * pad));
  // 确保不超出图片
  const finalW = Math.min(w, 1 - x);
  const finalH = Math.min(h, 1 - y);

  const cropX = Math.round(x * img.width);
  const cropY = Math.round(y * img.height);
  const cropW = Math.round(finalW * img.width);
  const cropH = Math.round(finalH * img.height);

  // 裁剪后若太大，再缩小
  const result = await ImageManipulator.manipulateAsync(
    shrunk,
    [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 持久化到 food_photos
  const dir = `${FileSystem.documentDirectory}food_photos/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    /* 目录已存在 */
  }
  const dest = `${dir}cutout_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return dest;
}
