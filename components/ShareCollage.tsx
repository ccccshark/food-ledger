import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Meals, formatMoney, formatDateCN, toCNNumber } from '@/constants/theme';
import { Tape, Stamp, DashedDivider } from './Decorations';
import type { LedgerRecord } from '@/types';

// 手账拼贴卡片：可被 react-native-view-shot 截图
// 固定宽度 340，高度自适应（无图时较短）
export function ShareCollage({ record }: { record: LedgerRecord }) {
  const meal = Meals[record.meal];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const [, m, d] = record.date.split('-').map(Number);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(record.date).getDay()];

  return (
    <View style={styles.wrap}>
      {/* 顶部胶带 */}
      <View style={styles.topTapeRow}>
        <Tape color="pink" width={60} height={18} rotate={-6} />
        <Tape color="yellow" width={50} height={16} rotate={8} />
      </View>

      {/* 主卡片 */}
      <View style={styles.card}>
        {/* 照片（拍立得风） */}
        {record.photo_uri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: record.photo_uri }} style={styles.photo} />
            <Tape color="green" width={40} height={14} rotate={-4} style={styles.photoTape} />
          </View>
        ) : null}

        {/* 金额 + 印章 */}
        <View style={styles.amountRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>今日所食</Text>
            <Text style={styles.amount}>{formatMoney(record.amount)}</Text>
          </View>
          <Stamp text={meal.stamp} color={meal.color} size={48} />
        </View>

        <DashedDivider />

        {/* 餐次 + 日期 */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="restaurant" size={12} color={meal.color} />
            <Text style={styles.metaText}>{meal.label}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={Colors.inkSoft} />
            <Text style={styles.metaText}>
              {toCNNumber(m)}月{toCNNumber(d)}日 · 周{wd}
            </Text>
          </View>
          {record.location_name ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={Colors.olive} />
              <Text style={styles.metaText} numberOfLines={1}>{record.location_name}</Text>
            </View>
          ) : null}
        </View>

        {/* 评分 */}
        {record.rating && record.rating > 0 ? (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>美味</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= record.rating! ? 'star' : 'star-outline'}
                  size={14}
                  color={s <= record.rating! ? Colors.ochre : Colors.inkLight}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* 标签 */}
        {tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 备注 */}
        {record.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{record.note}</Text>
          </View>
        ) : null}

        {/* 落款 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>— 美食手账 · {formatDateCN(record.date)}</Text>
        </View>
      </View>

      {/* 底部胶带 */}
      <View style={styles.bottomTapeRow}>
        <Tape color="blue" width={46} height={15} rotate={5} />
      </View>
    </View>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH + 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  topTapeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: -8,
    zIndex: 2,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.note,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.15)',
    padding: 18,
    paddingTop: 22,
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  photoWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 3,
    borderWidth: 6,
    borderColor: Colors.noteDeep,
  },
  photoTape: {
    position: 'absolute',
    top: -7,
    left: '40%',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  label: { fontSize: 11, color: Colors.inkLight, fontFamily: Fonts.serif },
  amount: {
    fontSize: 36,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 8,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.serif },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  ratingLabel: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.serif },
  stars: { flexDirection: 'row', gap: 2 },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  tagText: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.serif },
  noteBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: Colors.paperLight,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: Colors.stamp,
  },
  noteText: {
    fontSize: 12,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  bottomTapeRow: {
    marginTop: -7,
    zIndex: 2,
  },
});
