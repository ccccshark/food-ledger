import * as FileSystem from 'expo-file-system';
import type { MealType } from '@/types';
import { MEAL_LABELS } from '@/types';

// AI 配置（存于本地 settings）
export interface AiConfig {
  baseUrl: string;     // 如 https://api.openai.com/v1
  apiKey: string;
  model: string;       // 如 gpt-4o
  enabled: boolean;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  enabled: false,
};

// AI 识别结果
export interface AiRecognizeResult {
  amount?: number;
  meal?: MealType;
  tags?: string[];
  note?: string;
  rating?: number;
}

// 把本地图片转为 base64 data URL
async function imageToDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = (uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

// 提取 AI 返回内容里的 JSON（容错：可能包在 ```json``` 里）
function extractJson(text: string): any | null {
  // 去掉 ```json ... ``` 包裹
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  // 找第一个 { 到最后一个 }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// 校验餐次合法性
function normalizeMeal(m: any): MealType | undefined {
  if (!m || typeof m !== 'string') return undefined;
  const map: Record<string, MealType> = {
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
    snack: 'snack',
    supper: 'supper',
    早餐: 'breakfast',
    午餐: 'lunch',
    晚餐: 'dinner',
    零食: 'snack',
    夜宵: 'supper',
  };
  return map[m.toLowerCase()] ?? map[m] ?? undefined;
}

interface CallVisionParams {
  config: AiConfig;
  imageUri: string;
  prompt: string;
}

// 调用 OpenAI 兼容的 Vision API
async function callVision({ config, imageUri, prompt }: CallVisionParams): Promise<string> {
  const dataUrl = await imageToDataUrl(imageUri);
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

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
      temperature: 0.2,
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${errText.slice(0, 200) || resp.statusText}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('API 返回格式异常');
  }
  return content;
}

// AI 拍照识别美食
export async function recognizeFood(
  config: AiConfig,
  imageUri: string
): Promise<AiRecognizeResult> {
  const prompt = `你是一个美食记账助手（味笺）。请识别这张图片中的美食，返回严格的 JSON（不要其他文字）：
{
  "amount": 估算金额(数字，单位元，无法判断则省略字段),
  "meal": 餐次(从 breakfast/lunch/dinner/snack/supper 中选一个，根据食物类型和时段判断，无法判断则省略),
  "tags": [标签数组，如["奶茶","外卖"]，最多3个],
  "note": 简短描述食物(如"一杯拿铁")，最多15字,
  "rating": 美味度评分(1-5整数，仅根据外观判断，不确定则省略)
}
只返回 JSON，不要解释。`;

  const content = await callVision({ config, imageUri, prompt });
  const obj = extractJson(content);
  if (!obj) throw new Error('AI 返回内容无法解析');

  const result: AiRecognizeResult = {};
  if (typeof obj.amount === 'number' && obj.amount > 0) result.amount = obj.amount;
  const meal = normalizeMeal(obj.meal);
  if (meal) result.meal = meal;
  if (Array.isArray(obj.tags)) {
    result.tags = obj.tags
      .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t: string) => t.trim())
      .slice(0, 3);
  }
  if (typeof obj.note === 'string' && obj.note.trim()) result.note = obj.note.trim().slice(0, 30);
  if (typeof obj.rating === 'number' && obj.rating >= 1 && obj.rating <= 5) {
    result.rating = Math.round(obj.rating);
  }
  return result;
}

// 账单 OCR：从支付截图提取金额
export async function ocrReceipt(
  config: AiConfig,
  imageUri: string
): Promise<AiRecognizeResult> {
  const prompt = `这是一张支付/账单截图。请提取支付金额，返回严格 JSON（不要其他文字）：
{
  "amount": 支付金额(数字，单位元),
  "note": 备注或商品名(最多20字，无则省略)
}
只返回 JSON。`;

  const content = await callVision({ config, imageUri, prompt });
  const obj = extractJson(content);
  if (!obj) throw new Error('AI 返回内容无法解析');

  const result: AiRecognizeResult = {};
  if (typeof obj.amount === 'number' && obj.amount > 0) result.amount = obj.amount;
  if (typeof obj.note === 'string' && obj.note.trim()) result.note = obj.note.trim().slice(0, 30);
  return result;
}

// 格式化识别结果为可读文字（用于预览/确认）
export function describeResult(r: AiRecognizeResult): string {
  const parts: string[] = [];
  if (r.amount != null) parts.push(`金额 ¥${r.amount.toFixed(2)}`);
  if (r.meal) parts.push(MEAL_LABELS[r.meal]);
  if (r.tags && r.tags.length) parts.push(r.tags.join('/'));
  if (r.rating) parts.push(`${r.rating}星`);
  if (r.note) parts.push(r.note);
  return parts.join(' · ');
}
