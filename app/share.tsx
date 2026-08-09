import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Colors, Fonts, formatMoney } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape } from '@/components/Decorations';
import {
  ShareCollage,
  DEFAULT_FIELDS,
  SHARE_STYLES,
  SHARE_STYLE_LABELS,
  SHARE_BGS,
  SHARE_BG_LABELS,
  SHARE_BG_COLORS,
  type ShareFields,
  type ShareStyle,
  type ShareBg,
} from '@/components/ShareCollage';
import { showDialog } from '@/stores/dialog';
import * as dao from '@/db';
import type { LedgerRecord } from '@/types';

const FIELD_KEYS: { key: keyof ShareFields; label: string; icon: string }[] = [
  { key: 'photo', label: '照片', icon: 'image-outline' },
  { key: 'amount', label: '金额', icon: 'cash-outline' },
  { key: 'meal', label: '餐次', icon: 'restaurant-outline' },
  { key: 'date', label: '日期', icon: 'calendar-outline' },
  { key: 'location', label: '地点', icon: 'location-outline' },
  { key: 'rating', label: '评分', icon: 'star-outline' },
  { key: 'tags', label: '标签', icon: 'pricetag-outline' },
  { key: 'note', label: '备注', icon: 'create-outline' },
];

export default function ShareScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const shotRef = useRef<ViewShot>(null);
  const [record, setRecord] = useState<LedgerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [fields, setFields] = useState<ShareFields>(DEFAULT_FIELDS);
  const [style, setStyle] = useState<ShareStyle>('polaroid');
  const [bg, setBg] = useState<ShareBg>('paper');

  useEffect(() => {
    const id = Number(params.id);
    dao.getRecord(id).then((r) => {
      setRecord(r);
      setLoading(false);
    });
  }, [params.id]);

  const toggleField = (key: keyof ShareFields) => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onShare = async () => {
    if (!shotRef.current || !record) return;
    setSharing(true);
    try {
      const uri = await captureRef(shotRef, {
        result: 'tmpfile',
        format: 'png',
        quality: 0.95,
      });
      if (!uri) throw new Error('截图失败');

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        const dest = `${FileSystem.documentDirectory}share_${Date.now()}.png`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        showDialog({
          title: '已生成',
          message: `分享不可用，图片已保存至：\n${dest}`,
          icon: 'checkmark-circle-outline',
        });
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: '分享我的味笺',
        UTI: 'public.image',
      });
    } catch (e: any) {
      showDialog({
        title: '分享失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="blue" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>手账拼贴</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 100 }}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.stamp} />
            </View>
          ) : record ? (
            <>
              <Text style={styles.hint}>预览效果（可截图保存或直接分享）</Text>

              {/* 截图目标区域 */}
              <View style={styles.shotWrap}>
                <ViewShot
                  ref={shotRef}
                  options={{ format: 'png', quality: 0.95 }}
                  style={styles.shot}
                >
                  <ShareCollage record={record} fields={fields} style={style} bg={bg} />
                </ViewShot>
              </View>

              {/* 样式选择 */}
              <SectionTitle icon="layers-outline" title="卡片样式" />
              <View style={styles.optionRow}>
                {SHARE_STYLES.map((s) => (
                  <Chip
                    key={s}
                    label={SHARE_STYLE_LABELS[s]}
                    active={style === s}
                    onPress={() => setStyle(s)}
                  />
                ))}
              </View>

              {/* 背景选择 */}
              <SectionTitle icon="color-fill-outline" title="背景主题" />
              <View style={styles.optionRow}>
                {SHARE_BGS.map((b) => (
                  <BgChip
                    key={b}
                    label={SHARE_BG_LABELS[b]}
                    color={SHARE_BG_COLORS[b]}
                    active={bg === b}
                    onPress={() => setBg(b)}
                  />
                ))}
              </View>

              {/* 字段选择 */}
              <SectionTitle icon="checkbox-outline" title="分享信息" />
              <View style={styles.fieldGrid}>
                {FIELD_KEYS.map((f) => (
                  <FieldToggle
                    key={f.key}
                    label={f.label}
                    icon={f.icon as keyof typeof Ionicons.glyphMap}
                    active={fields[f.key]}
                    onPress={() => toggleField(f.key)}
                    disabled={
                      // 照片字段在无照片时禁用
                      f.key === 'photo' && !record.photo_uri
                    }
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>记录不存在</Text>
            </View>
          )}
        </ScrollView>

        {/* 底部分享按钮 */}
        {record ? (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.shareBtn} onPress={onShare} disabled={sharing}>
              {sharing ? (
                <ActivityIndicator color={Colors.note} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={Colors.note} />
                  <Text style={styles.shareBtnText}>分享 / 保存图片</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </PaperBackground>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={14} color={Colors.inkSoft} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BgChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.bgChip, active && styles.bgChipActive]}
      onPress={onPress}
    >
      <View style={[styles.bgSwatch, { backgroundColor: color }]} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldToggle({
  label,
  icon,
  active,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.fieldToggle,
        active && styles.fieldToggleActive,
        disabled && styles.fieldToggleDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={15} color={active ? Colors.stamp : Colors.inkLight} />
      <Text style={[styles.fieldToggleText, active && styles.fieldToggleTextActive]}>{label}</Text>
      {active ? (
        <Ionicons name="checkmark-circle" size={14} color={Colors.stamp} style={styles.fieldCheck} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { padding: 8 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  body: { flex: 1 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  hint: {
    fontSize: 12,
    color: Colors.inkLight,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  shotWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  shot: {
    backgroundColor: 'transparent',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  chipActive: {
    borderColor: Colors.stamp,
    backgroundColor: Colors.stamp + '1A',
    borderStyle: 'solid',
  },
  chipText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    color: Colors.inkSoft,
  },
  chipTextActive: {
    color: Colors.stamp,
    fontWeight: '700',
  },
  bgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  bgChipActive: {
    borderColor: Colors.stamp,
    borderStyle: 'solid',
  },
  bgSwatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.3)',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
  },
  fieldToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  fieldToggleActive: {
    borderColor: Colors.stamp,
    backgroundColor: Colors.stamp + '1A',
    borderStyle: 'solid',
  },
  fieldToggleDisabled: {
    opacity: 0.4,
  },
  fieldToggleText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    color: Colors.inkSoft,
  },
  fieldToggleTextActive: {
    color: Colors.stamp,
    fontWeight: '700',
  },
  fieldCheck: {
    marginLeft: 2,
  },
  emptyText: { fontSize: 14, color: Colors.inkLight, fontFamily: Fonts.serif },
  footer: {
    padding: 16,
    backgroundColor: Colors.note,
    borderTopWidth: 1.5,
    borderTopColor: Colors.line,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 4,
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  shareBtnText: {
    color: Colors.note,
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
