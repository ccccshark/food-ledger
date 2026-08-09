import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { autoShrink } from './image';

/**
 * 选择照片：从相册选取，自动缩小大图后持久化保存。
 * 返回持久化后的 file:// URI（避免临时缓存被清理）。
 */
export async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;

  const src = result.assets[0].uri;
  return persistImage(src);
}

/**
 * 拍照
 */
export async function takePhoto(): Promise<string | null> {
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;
  return persistImage(result.assets[0].uri);
}

// 复制到持久目录，并自动缩小大图
async function persistImage(srcUri: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}food_photos/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    /* 目录已存在等 */
  }
  const ext = srcUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${dir}photo_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  // 自动缩小大图，减少存储与内存占用
  return autoShrink(dest);
}

export interface LocInfo {
  latitude: number;
  longitude: number;
  name: string;
}

// 把反向地理编码结果拼成简短地名
function formatAddress(addr: Location.LocationGeocodedAddress): string {
  const parts = [
    addr.city || addr.region || '',
    addr.district || addr.subregion || '',
    addr.street || addr.name || '',
  ].filter((p) => p.length > 0);
  // 去重相邻
  const unique: string[] = [];
  for (const p of parts) {
    if (unique[unique.length - 1] !== p) unique.push(p);
  }
  return unique.join('').slice(0, 40);
}

/**
 * 获取当前位置，并反向地理编码得到地名。
 */
export async function getCurrentLocation(): Promise<LocInfo | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = loc.coords;
    let name = '';
    try {
      const addrs = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addrs && addrs.length > 0) {
        name = formatAddress(addrs[0]);
      }
    } catch {
      /* 反向地理编码失败时地名留空，用户可手动填写 */
    }
    return { latitude, longitude, name };
  } catch {
    return null;
  }
}
