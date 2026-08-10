import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Colors, Fonts } from '@/constants/theme';
import { showDialog } from '@/stores/dialog';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { t, useT } from '@/constants/i18n';

// 贴纸类型
export type StickerKind = 'food' | 'divider' | 'note' | 'diy';

export interface StickerItem {
  id: string;
  kind: StickerKind;
  label: string;
  // 翻译 key（内置贴纸用，diy 不填）
  tKey?: string;
  // food/divider/note 用 SVG 路径渲染；diy 用图片 URI
  svg?: React.ReactNode;
  uri?: string;
}

// ===== 极简线条美食贴纸（SVG） =====
const stroke = Colors.ink;
const sw = 1.6;

function CoffeeSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Path d="M10 16 L10 28 Q10 33 15 33 L27 33 Q32 33 32 28 L32 16 Z" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <Path d="M32 19 Q37 19 37 23 Q37 27 32 27" fill="none" stroke={stroke} strokeWidth={sw} />
      <Path d="M16 10 Q14 13 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M22 9 Q20 12 22 15" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function HotpotSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Path d="M8 22 L36 22 Q34 32 22 32 Q10 32 8 22 Z" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <Line x1="6" y1="22" x2="38" y2="22" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="14" y1="16" x2="14" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="22" y1="14" x2="22" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="30" y1="16" x2="30" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M18 10 Q16 12 18 14" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M26 9 Q24 11 26 13" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function NoodleSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Path d="M8 18 Q22 12 36 18" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M8 23 Q22 17 36 23" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M14 18 Q14 28 18 30" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M22 16 Q22 30 26 32" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M30 18 Q30 28 34 30" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M6 32 L38 32" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function CakeSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Rect x="10" y="20" width="24" height="14" rx="2" fill="none" stroke={stroke} strokeWidth={sw} />
      <Line x1="10" y1="26" x2="34" y2="26" stroke={stroke} strokeWidth={sw} />
      <Line x1="16" y1="20" x2="16" y2="14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="22" y1="20" x2="22" y2="12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="28" y1="20" x2="28" y2="14" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx="16" cy="13" r="1.5" fill={stroke} />
      <Circle cx="22" cy="11" r="1.5" fill={stroke} />
      <Circle cx="28" cy="13" r="1.5" fill={stroke} />
    </Svg>
  );
}

function FruitSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Circle cx="22" cy="26" r="10" fill="none" stroke={stroke} strokeWidth={sw} />
      <Path d="M22 16 Q20 12 24 10" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M24 12 Q28 11 30 14" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function TeaSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Path d="M12 18 L12 30 Q12 34 16 34 L26 34 Q30 34 30 30 L30 18 Z" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <Line x1="10" y1="18" x2="32" y2="18" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M30 22 Q35 22 35 26 Q35 30 30 30" fill="none" stroke={stroke} strokeWidth={sw} />
      <Path d="M18 12 Q17 14 18 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M23 11 Q22 13 23 15" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

function BowlSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Path d="M8 22 L36 22 Q34 33 22 33 Q10 33 8 22 Z" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <Line x1="6" y1="22" x2="38" y2="22" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx="18" cy="19" r="2" fill="none" stroke={stroke} strokeWidth={sw} />
      <Circle cx="26" cy="19" r="2" fill="none" stroke={stroke} strokeWidth={sw} />
    </Svg>
  );
}

function BeerSvg() {
  return (
    <Svg width="44" height="44" viewBox="0 0 44 44">
      <Rect x="12" y="14" width="18" height="22" rx="1" fill="none" stroke={stroke} strokeWidth={sw} />
      <Path d="M30 18 Q36 18 36 24 Q36 30 30 30" fill="none" stroke={stroke} strokeWidth={sw} />
      <Circle cx="18" cy="10" r="2" fill="none" stroke={stroke} strokeWidth={sw} />
      <Circle cx="24" cy="8" r="2" fill="none" stroke={stroke} strokeWidth={sw} />
      <Circle cx="28" cy="11" r="2" fill="none" stroke={stroke} strokeWidth={sw} />
    </Svg>
  );
}

// ===== 分割线贴纸 =====
function DashedDividerSvg() {
  return (
    <Svg width="120" height="16" viewBox="0 0 120 16">
      <Line x1="6" y1="8" x2="114" y2="8" stroke={Colors.dotted} strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
      <Circle cx="6" cy="8" r="2" fill={Colors.dotted} />
      <Circle cx="114" cy="8" r="2" fill={Colors.dotted} />
    </Svg>
  );
}

function WaveDividerSvg() {
  return (
    <Svg width="120" height="16" viewBox="0 0 120 16">
      <Path d="M4 8 Q12 3 20 8 T36 8 T52 8 T68 8 T84 8 T100 8 T116 8" fill="none" stroke={Colors.olive} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function StarDividerSvg() {
  return (
    <Svg width="120" height="16" viewBox="0 0 120 16">
      <Line x1="6" y1="8" x2="50" y2="8" stroke={Colors.ochre} strokeWidth="1.2" />
      <Path d="M60 4 L62 7 L65 8 L62 9 L60 12 L58 9 L55 8 L58 7 Z" fill={Colors.ochre} />
      <Line x1="70" y1="8" x2="114" y2="8" stroke={Colors.ochre} strokeWidth="1.2" />
    </Svg>
  );
}

// ===== 装饰便签 =====
function NotePinSvg() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60">
      <Rect x="10" y="14" width="40" height="36" rx="2" fill={Colors.tapeYellow + '55'} stroke={Colors.ink} strokeWidth="1.2" />
      <Line x1="16" y1="26" x2="44" y2="26" stroke={Colors.ink} strokeWidth="0.8" opacity="0.5" />
      <Line x1="16" y1="32" x2="44" y2="32" stroke={Colors.ink} strokeWidth="0.8" opacity="0.5" />
      <Line x1="16" y1="38" x2="38" y2="38" stroke={Colors.ink} strokeWidth="0.8" opacity="0.5" />
      <Circle cx="30" cy="14" r="3" fill={Colors.stamp} />
    </Svg>
  );
}

function HeartNoteSvg() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60">
      <Path d="M30 48 L12 30 Q6 22 14 16 Q22 12 30 22 Q38 12 46 16 Q54 22 48 30 Z" fill={Colors.tapePink + '55'} stroke={Colors.berry} strokeWidth="1.2" strokeLinejoin="round" />
    </Svg>
  );
}

// 内置贴纸库
export const BUILTIN_STICKERS: StickerItem[] = [
  { id: 'f-coffee', kind: 'food', label: '咖啡', tKey: 'sticker.food.coffee', svg: <CoffeeSvg /> },
  { id: 'f-hotpot', kind: 'food', label: '火锅', tKey: 'sticker.food.hotpot', svg: <HotpotSvg /> },
  { id: 'f-noodle', kind: 'food', label: '面条', tKey: 'sticker.food.noodle', svg: <NoodleSvg /> },
  { id: 'f-cake', kind: 'food', label: '蛋糕', tKey: 'sticker.food.cake', svg: <CakeSvg /> },
  { id: 'f-fruit', kind: 'food', label: '水果', tKey: 'sticker.food.fruit', svg: <FruitSvg /> },
  { id: 'f-tea', kind: 'food', label: '茶饮', tKey: 'sticker.food.tea', svg: <TeaSvg /> },
  { id: 'f-bowl', kind: 'food', label: '米饭', tKey: 'sticker.food.bowl', svg: <BowlSvg /> },
  { id: 'f-beer', kind: 'food', label: '酒水', tKey: 'sticker.food.beer', svg: <BeerSvg /> },
  { id: 'd-dash', kind: 'divider', label: '虚线', tKey: 'sticker.divider.dash', svg: <DashedDividerSvg /> },
  { id: 'd-wave', kind: 'divider', label: '波浪', tKey: 'sticker.divider.wave', svg: <WaveDividerSvg /> },
  { id: 'd-star', kind: 'divider', label: '星线', tKey: 'sticker.divider.star', svg: <StarDividerSvg /> },
  { id: 'n-pin', kind: 'note', label: '便签', tKey: 'sticker.note.pin', svg: <NotePinSvg /> },
  { id: 'n-heart', kind: 'note', label: '心形', tKey: 'sticker.note.heart', svg: <HeartNoteSvg /> },
];

// 贴纸库弹层
export function StickerLibrary({
  visible,
  onClose,
  onPick,
  diyStickers,
  onAddDiy,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: StickerItem) => void;
  diyStickers: StickerItem[];
  onAddDiy: (s: StickerItem) => void;
}) {
  useT(); // subscribe to lang changes for re-render
  const [tab, setTab] = useState<StickerKind>('food');

  const tabs: { key: StickerKind; label: string; icon: string }[] = [
    { key: 'food', label: t('sticker.tab.food'), icon: 'restaurant-outline' },
    { key: 'divider', label: t('sticker.tab.divider'), icon: 'remove-outline' },
    { key: 'note', label: t('sticker.tab.note'), icon: 'bookmark-outline' },
    { key: 'diy', label: t('sticker.tab.diy'), icon: 'happy-outline' },
  ];

  const list =
    tab === 'diy'
      ? diyStickers
      : BUILTIN_STICKERS.filter((s) => s.kind === tab);

  const onUploadDiy = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showDialog({
        title: t('common.tip'),
        message: t('sticker.need_perm'),
        icon: 'alert-circle-outline',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const src = result.assets[0].uri;
    // 持久化到 diy_stickers 目录
    const dir = `${FileSystem.documentDirectory}diy_stickers/`;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch {
      /* ignore */
    }
    const dest = `${dir}sticker_${Date.now()}.png`;
    await FileSystem.copyAsync({ from: src, to: dest });
    const item: StickerItem = {
      id: `diy-${Date.now()}`,
      kind: 'diy',
      label: t('sticker.diy_label'),
      uri: dest,
    };
    onAddDiy(item);
  };

  const renderItem = ({ item }: { item: StickerItem }) => (
    <TouchableOpacity
      style={styles.stickerCell}
      onPress={() => {
        onPick(item);
        onClose();
      }}
    >
      {item.uri ? (
        <Image source={{ uri: item.uri }} style={styles.diyImg} resizeMode="contain" />
      ) : (
        <View style={styles.svgWrap}>{item.svg}</View>
      )}
      <Text style={styles.cellLabel}>{item.tKey ? t(item.tKey) : item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('sticker.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.ink} />
            </TouchableOpacity>
          </View>

          {/* 标签栏 */}
          <View style={styles.tabRow}>
            {tabs.map((tb) => {
              const active = tab === tb.key;
              return (
                <TouchableOpacity
                  key={tb.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(tb.key)}
                >
                  <Ionicons name={tb.icon as keyof typeof Ionicons.glyphMap} size={13} color={active ? Colors.note : Colors.inkSoft} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tb.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'diy' ? (
            <TouchableOpacity style={styles.uploadBtn} onPress={onUploadDiy}>
              <Ionicons name="cloud-upload-outline" size={16} color={Colors.olive} />
              <Text style={styles.uploadText}>{t('sticker.upload')}</Text>
            </TouchableOpacity>
          ) : null}

          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            numColumns={4}
            renderItem={renderItem}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('sticker.empty_text')}</Text>
                <Text style={styles.emptyHint}>{t('sticker.empty_hint')}</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(40,30,20,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.note,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  tabActive: {
    borderColor: Colors.ink,
    backgroundColor: Colors.ink,
    borderStyle: 'solid',
  },
  tabText: {
    fontSize: 11,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.inkSoft,
  },
  tabTextActive: {
    color: Colors.note,
    fontWeight: '700',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 10,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
    backgroundColor: Colors.paperLight,
  },
  uploadText: {
    fontSize: 12,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  grid: {
    gap: 8,
  },
  stickerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    gap: 6,
  },
  svgWrap: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diyImg: {
    width: 48,
    height: 48,
  },
  cellLabel: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
  },
  emptyHint: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
  },
});
