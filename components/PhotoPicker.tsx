import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { showDialog } from '@/stores/dialog';
import { pickPhoto, takePhoto } from '@/utils/media';
import { StyledPhoto } from './StyledPhoto';
import { DrawingCanvas } from './DrawingCanvas';
import { useLedgerStore } from '@/stores/ledger';
import { cutoutFood } from '@/utils/image';
import {
  PHOTO_STYLES,
  PHOTO_STYLE_LABELS,
  PHOTO_SHAPES,
  PHOTO_SHAPE_LABELS,
  type PhotoStyle,
  type PhotoShape,
} from '@/types';

// 照片选择器：支持拍照/相册/自绘，应用手账风格框与裁切形状，支持 AI 抠图
export function PhotoPicker({
  uri,
  onChange,
  style,
  onStyleChange,
  shape,
  onShapeChange,
  accent,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  style: PhotoStyle;
  onStyleChange: (s: PhotoStyle) => void;
  shape: PhotoShape;
  onShapeChange: (s: PhotoShape) => void;
  accent?: string;
}) {
  const [drawing, setDrawing] = useState(false);
  const [cutting, setCutting] = useState(false);
  const aiConfig = useLedgerStore((s) => s.aiConfig);

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

  // AI 抠图：识别食物边界框并裁剪
  const doCutout = async () => {
    if (!uri) return;
    if (!aiConfig.enabled || !aiConfig.apiKey) {
      showDialog({
        title: '未启用 AI',
        message: '请先在「我的 · AI 助手」中配置并启用 AI，再使用抠图功能',
        icon: 'sparkles-outline',
        buttons: [{ text: '知道了' }],
      });
      return;
    }
    setCutting(true);
    try {
      const newUri = await cutoutFood(aiConfig, uri);
      onChange(newUri);
      showDialog({
        title: '抠图完成',
        message: '已裁剪出美食主体',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: '抠图失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setCutting(false);
    }
  };

  // 空状态：四宫格入口
  if (!uri) {
    return (
      <>
        <View style={styles.emptyGrid}>
          <EntryCard icon="camera" label="拍照" tint={Colors.olive} onPress={doTake} />
          <EntryCard icon="images-outline" label="相册" tint={Colors.stamp} onPress={doPick} />
          <EntryCard icon="brush" label="自绘" tint={Colors.ochre} onPress={() => setDrawing(true)} />
          <EntryCard icon="restaurant-outline" label="暂不添加" tint={Colors.inkLight} onPress={() => {}} muted />
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

  // 已选照片：预览 + 风格/形状选择 + 操作
  return (
    <>
      <View style={styles.previewWrap}>
        <View style={styles.previewBox}>
          <StyledPhoto
            uri={uri}
            style={style}
            shape={shape}
            height={200}
            accent={accent ?? Colors.olive}
          />
        </View>

        {/* 操作按钮 */}
        <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(null)}>
          <Ionicons name="close-circle" size={24} color={Colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.changeBtn} onPress={choose}>
          <Text style={styles.changeText}>换一张</Text>
        </TouchableOpacity>
      </View>

      {/* 风格选择条 */}
      <ChipRow
        icon="color-palette-outline"
        label="贴图样式"
        items={PHOTO_STYLES}
        labels={PHOTO_STYLE_LABELS}
        value={style}
        onChange={(v) => onStyleChange(v as PhotoStyle)}
      />

      {/* 形状选择条 */}
      <ChipRow
        icon="crop-outline"
        label="照片形状"
        items={PHOTO_SHAPES}
        labels={PHOTO_SHAPE_LABELS}
        value={shape}
        onChange={(v) => onShapeChange(v as PhotoShape)}
      />

      {/* AI 抠图按钮 */}
      <TouchableOpacity
        style={[styles.cutoutBtn, cutting && styles.cutoutBtnDisabled]}
        onPress={doCutout}
        disabled={cutting}
      >
        {cutting ? (
          <ActivityIndicator color={Colors.note} size="small" />
        ) : (
          <Ionicons name="sparkles" size={16} color={Colors.note} />
        )}
        <Text style={styles.cutoutText}>
          {cutting ? 'AI 抠图中…' : 'AI 抠出美食主体'}
        </Text>
      </TouchableOpacity>

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

// 横向可滚动小标签条
function ChipRow({
  icon,
  label,
  items,
  labels,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  items: readonly string[];
  labels: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.styleRow}>
      <View style={styles.styleLabelWrap}>
        <Ionicons name={icon} size={13} color={Colors.inkSoft} />
        <Text style={styles.styleLabel}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleScroll}>
        {items.map((s) => {
          const active = value === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.styleChip,
                active && { borderColor: Colors.stamp, backgroundColor: Colors.stamp + '1A' },
              ]}
              onPress={() => onChange(s)}
            >
              <Text
                style={[
                  styles.styleChipText,
                  active && { color: Colors.stamp, fontWeight: '700' },
                ]}
              >
                {labels[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
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

  // 选择条
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

  // AI 抠图
  cutoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: Colors.olive,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  cutoutBtnDisabled: {
    opacity: 0.6,
  },
  cutoutText: {
    color: Colors.note,
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
