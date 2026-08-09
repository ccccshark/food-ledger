import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';

/**
 * 选择照片：优先弹出"拍照/相册"选择，最终复制到 app 私有目录持久化保存。
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

// 复制到持久目录
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
  return dest;
}

export interface LocInfo {
  latitude: number;
  longitude: number;
  name: string;
}

/**
 * 获取当前位置。不依赖反向地理编码 API，地名留空由用户手动填写。
 */
export async function getCurrentLocation(): Promise<LocInfo | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      name: '',
    };
  } catch {
    return null;
  }
}
