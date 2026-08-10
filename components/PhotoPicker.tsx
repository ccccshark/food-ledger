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
import { t, useT } from '@/constants/i18n';
import {
  PHOTO_STYLES,
  PHOTO_SHAPES,
  type PhotoStyle,
  type PhotoShape,
} from '@/types';

const PHOTO_STYLE_T_KEY: Record<PhotoStyle, string> = {
  polaroid: 'photo_style.polaroid',
  tape: 'photo_style.tape',
  stamp: 'photo_style.stamp',
  sketch: 'photo_style.sketch',
};

const PHOTO_SHAPE_T_KEY: Record<PhotoShape, string> = {
  square: 'photo_shape.square',
  rounded: 'photo_shape.rounded',
  circle: 'photo_shape.circle',
  heart: 'photo_shape.heart',
};

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
  useT(); // subscribe to lang changes for re-render
  const [drawing, setDrawing] = useState(false);
  const [cutting, setCutting] = useState(false);
  const aiConfig = useLedgerStore((s) => s.aiConfig);

  const choose = () => {
    showDialog({
      title: t('photo.add_title'),
      message: t('photo.add_msg'),
      icon: 'camera-outline',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('photo.camera'), onPress: () => doTake() },
        { text: t('photo.album'), onPress: () => doPick() },
        { text: t('photo.draw'), onPress: () => setDrawing(true) },
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
        title: t('photo.ai_not_enabled'),
        message: t('photo.ai_not_enabled_msg'),
        icon: 'sparkles-outline',
        buttons: [{ text: t('common.got_it') }],
      });
      return;
    }
    setCutting(true);
    try {
      const newUri = await cutoutFood(aiConfig, uri);
      onChange(newUri);
      showDialog({
        title: t('photo.cutout_done'),
        message: t('photo.cutout_done_msg'),
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: t('photo.cutout_failed'),
        message: e?.message ?? t('common.unknown_error'),
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
          <EntryCard icon="camera" label={t('photo.camera')} tint={Colors.olive} onPress={doTake} />
          <EntryCard icon="images-outline" label={t('photo.album')} tint={Colors.stamp} onPress={doPick} />
          <EntryCard icon="brush" label={t('photo.draw')} tint={Colors.ochre} onPress={() => setDrawing(true)} />
          <EntryCard icon="restaurant-outline" label={t('photo.no_photo')} tint={Colors.inkLight} onPress={() => {}} muted />
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
          <Text style={styles.changeText}>{t('photo.change')}</Text>
        </TouchableOpacity>
      </View>

      {/* 风格选择条 */}
      <ChipRow
        icon="color-palette-outline"
        label={t('photo.style')}
        items={PHOTO_STYLES}
        value={style}
        onChange={(v) => onStyleChange(v as PhotoStyle)}
        tKeyOf={(s: string) => PHOTO_STYLE_T_KEY[s as PhotoStyle]}
      />

      {/* 形状选择条 */}
      <ChipRow
        icon="crop-outline"
        label={t('photo.shape')}
        items={PHOTO_SHAPES}
        value={shape}
        onChange={(v) => onShapeChange(v as PhotoShape)}
        tKeyOf={(s: string) => PHOTO_SHAPE_T_KEY[s as PhotoShape]}
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
          {cutting ? t('photo.cutout_loading') : t('photo.cutout')}
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
  value,
  onChange,
  tKeyOf,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  items: readonly string[];
  value: string;
  onChange: (v: string) => void;
  tKeyOf: (s: string) => string;
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
                {t(tKeyOf(s))}
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
