import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { showDialog } from '@/stores/dialog';
import { pickPhoto, takePhoto } from '@/utils/media';

// 照片选择器：显示已选照片或"拍照/相册"入口
export function PhotoPicker({
  uri,
  onChange,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
}) {
  const choose = () => {
    showDialog({
      title: '添加照片',
      message: '选择拍照或从相册选取',
      icon: 'camera-outline',
      buttons: [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: () => doTake() },
        { text: '相册', onPress: () => doPick() },
      ],
    });
  };

  const doPick = async () => {
    const u = await pickPhoto();
    if (u) onChange(u);
  };

  const doTake = async () => {
    const u = await takePhoto();
    if (u) onChange(u);
  };

  if (uri) {
    return (
      <View style={styles.previewWrap}>
        <Image source={{ uri }} style={styles.preview} />
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onChange(null)}
        >
          <Ionicons name="close-circle" size={24} color={Colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.changeBtn} onPress={choose}>
          <Text style={styles.changeText}>换一张</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.empty} onPress={choose}>
      <Ionicons name="camera" size={26} color={Colors.inkLight} />
      <Text style={styles.emptyText}>添加美食照片</Text>
      <Text style={styles.emptyHint}>拍照或从相册选择</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 140,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif, marginTop: 4 },
  emptyHint: { fontSize: 11, color: Colors.inkLight, fontStyle: 'italic' },
  previewWrap: {
    position: 'relative',
    height: 200,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  preview: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(251,245,232,0.85)',
    borderRadius: 12,
  },
  changeBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(61,46,31,0.7)',
    borderRadius: 3,
  },
  changeText: { color: Colors.note, fontSize: 11, fontFamily: Fonts.serif },
});
