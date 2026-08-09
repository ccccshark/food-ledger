import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { showDialog } from '@/stores/dialog';
import { pickPhoto, takePhoto } from '@/utils/media';
import { StyledPhoto } from './StyledPhoto';
import { DrawingCanvas } from './DrawingCanvas';
import {
  PHOTO_STYLES,
  PHOTO_STYLE_LABELS,
  type PhotoStyle,
} from '@/types';

// 照片选择器：支持拍照/相册/自绘，并对照片应用多种手账风格框
export function PhotoPicker({
  uri,
  onChange,
  style,
  onStyleChange,
  accent,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  style: PhotoStyle;
  onStyleChange: (s: PhotoStyle) => void;
  accent?: string;
}) {
  const [drawing, setDrawing] = useState(false);

  const choose = () => {
    showDialog({
      title: '添加美食照片',
      message: '选择拍照、相册选取或亲手绘制',
      icon: 'camera-outline',
      buttons: [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: () => doTake() },
        { text: '相册', onPress: () => doPick() },
        { text: '自绘', onPress: () => setDrawing(true) },
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

  // 空状态：四宫格入口（拍照/相册/自绘/示意图）
  if (!uri) {
    return (
      <>
        <View style={styles.emptyGrid}>
          <EntryCard
            icon="camera"
            label="拍照"
            tint={Colors.olive}
            onPress={doTake}
          />
          <EntryCard
            icon="images-outline"
            label="相册"
            tint={Colors.stamp}
            onPress={doPick}
          />
          <EntryCard
            icon="brush"
            label="自绘"
            tint={Colors.ochre}
            onPress={() => setDrawing(true)}
          />
          <EntryCard
            icon="restaurant-outline"
            label="暂不添加"
            tint={Colors.inkLight}
            onPress={() => {}}
            muted
          />
        </View>
        <DrawingCanvas
          visible={drawing}
          onClose={() => setDrawing(false)}
          onSave={(u) => {
            onChange(u);
            setDrawing(false);
          }}
        />
      </>
    );
  }

  // 已选照片：风格预览 + 风格选择 + 操作
  return (
    <>
      <View style={styles.previewWrap}>
        <View style={styles.previewBox}>
          <StyledPhoto
            uri={uri}
            style={style}
            height={200}
            accent={accent ?? Colors.olive}
          />
        </View>

        {/* 操作按钮 */}
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

      {/* 风格选择条 */}
      <View style={styles.styleRow}>
        <View style={styles.styleLabelWrap}>
          <Ionicons name="color-palette-outline" size={13} color={Colors.inkSoft} />
          <Text style={styles.styleLabel}>贴图样式</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleScroll}>
          {PHOTO_STYLES.map((s) => {
            const active = style === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.styleChip,
                  active && { borderColor: Colors.stamp, backgroundColor: Colors.stamp + '1A' },
                ]}
                onPress={() => onStyleChange(s)}
              >
                <Text
                  style={[
                    styles.styleChipText,
                    active && { color: Colors.stamp, fontWeight: '700' },
                  ]}
                >
                  {PHOTO_STYLE_LABELS[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <DrawingCanvas
        visible={drawing}
        onClose={() => setDrawing(false)}
        onSave={(u) => {
          onChange(u);
          setDrawing(false);
        }}
      />
    </>
  );
}

// 四宫格入口卡片
function EntryCard({
  icon,
  label,
  tint,
  onPress,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.entryCard,
        { borderColor: muted ? Colors.line : tint },
        muted && { backgroundColor: Colors.paperLight },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.entryIconBox, { borderColor: tint }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={[styles.entryLabel, { color: tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // 空状态四宫格
  emptyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  entryCard: {
    width: '48%',
    flexGrow: 1,
    paddingVertical: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: Colors.note,
    alignItems: 'center',
    gap: 8,
  },
  entryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
  },
  entryLabel: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },

  // 预览
  previewWrap: {
    position: 'relative',
  },
  previewBox: {
    padding: 10,
    backgroundColor: Colors.paperLight,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(251,245,232,0.9)',
    borderRadius: 12,
    zIndex: 3,
  },
  changeBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(61,46,31,0.7)',
    borderRadius: 3,
    zIndex: 3,
  },
  changeText: { color: Colors.note, fontSize: 11, fontFamily: Fonts.serif },

  // 风格选择条
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  styleLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  styleLabel: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
  },
  styleScroll: {
    gap: 6,
    paddingRight: 8,
  },
  styleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  styleChipText: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
  },
});
