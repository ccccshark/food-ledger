import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Meals, formatMoney, formatDateCN, toCNNumber } from '@/constants/theme';
import { Tape, Stamp, DashedDivider } from './Decorations';
import { StyledPhoto } from './StyledPhoto';
import type { LedgerRecord } from '@/types';

// 可选分享字段
export interface ShareFields {
  photo: boolean;
  amount: boolean;
  meal: boolean;
  date: boolean;
  location: boolean;
  rating: boolean;
  tags: boolean;
  note: boolean;
}

// 分享样式
export type ShareStyle = 'polaroid' | 'ticket' | 'minimal' | 'sticker';

export const SHARE_STYLES: ShareStyle[] = ['polaroid', 'ticket', 'minimal', 'sticker'];

export const SHARE_STYLE_LABELS: Record<ShareStyle, string> = {
  polaroid: '拍立得',
  ticket: '票根',
  minimal: '极简',
  sticker: '贴纸',
};

// 背景主题
export type ShareBg = 'paper' | 'kraft' | 'mint' | 'rose' | 'ink';

export const SHARE_BGS: ShareBg[] = ['paper', 'kraft', 'mint', 'rose', 'ink'];

export const SHARE_BG_LABELS: Record<ShareBg, string> = {
  paper: '米纸',
  kraft: '牛皮',
  mint: '薄荷',
  rose: '玫瑰',
  ink: '墨夜',
};

export const SHARE_BG_COLORS: Record<ShareBg, string> = {
  paper: Colors.note,
  kraft: Colors.paper,
  mint: '#DCE9D5',
  rose: '#F0D9D5',
  ink: '#2B231A',
};

export const SHARE_BG_TEXT_COLORS: Record<ShareBg, string> = {
  paper: Colors.ink,
  kraft: Colors.ink,
  mint: Colors.ink,
  rose: Colors.ink,
  ink: Colors.note,
};

export const DEFAULT_FIELDS: ShareFields = {
  photo: true,
  amount: true,
  meal: true,
  date: true,
  location: true,
  rating: true,
  tags: true,
  note: true,
};

interface ShareCollageProps {
  record: LedgerRecord;
  fields?: ShareFields;
  style?: ShareStyle;
  bg?: ShareBg;
}

// 手账拼贴卡片：可被 react-native-view-shot 截图
export function ShareCollage({
  record,
  fields = DEFAULT_FIELDS,
  style = 'polaroid',
  bg = 'paper',
}: ShareCollageProps) {
  if (style === 'ticket') return <TicketCollage record={record} fields={fields} bg={bg} />;
  if (style === 'minimal') return <MinimalCollage record={record} fields={fields} bg={bg} />;
  if (style === 'sticker') return <StickerCollage record={record} fields={fields} bg={bg} />;
  return <PolaroidCollage record={record} fields={fields} bg={bg} />;
}

// ===== 拍立得风 =====
function PolaroidCollage({ record, fields, bg }: { record: LedgerRecord; fields: ShareFields; bg: ShareBg }) {
  const meal = Meals[record.meal];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const [, m, d] = record.date.split('-').map(Number);
  const cardBg = SHARE_BG_COLORS[bg];
  const textColor = SHARE_BG_TEXT_COLORS[bg];
  const isDark = bg === 'ink';

  return (
    <View style={styles.wrap}>
      <View style={styles.topTapeRow}>
        <Tape color="pink" width={60} height={18} rotate={-6} />
        <Tape color="yellow" width={50} height={16} rotate={8} />
      </View>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(251,245,232,0.2)' : 'rgba(61,46,31,0.15)' }]}>
        {fields.photo && record.photo_uri ? (
          <View style={styles.photoWrap}>
            <StyledPhoto
              uri={record.photo_uri}
              style={record.photo_style ?? 'polaroid'}
              shape={record.photo_shape ?? 'square'}
              height={200}
              accent={meal.color}
            />
          </View>
        ) : null}

        {fields.amount ? (
          <View style={styles.amountRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: isDark ? Colors.note + 'AA' : Colors.inkLight }]}>今日所食</Text>
              <Text style={[styles.amount, { color: textColor }]}>{formatMoney(record.amount)}</Text>
            </View>
            <Stamp text={meal.stamp} color={meal.color} size={48} />
          </View>
        ) : null}

        {(fields.meal || fields.date || fields.location) ? (
          <>
            <DashedDivider />
            <View style={styles.metaRow}>
              {fields.meal ? (
                <View style={styles.metaItem}>
                  <Ionicons name="restaurant" size={12} color={meal.color} />
                  <Text style={[styles.metaText, { color: isDark ? Colors.note : Colors.inkSoft }]}>{meal.label}</Text>
                </View>
              ) : null}
              {fields.date ? (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={isDark ? Colors.note + 'AA' : Colors.inkSoft} />
                  <Text style={[styles.metaText, { color: isDark ? Colors.note : Colors.inkSoft }]}>
                    {toCNNumber(m)}月{toCNNumber(d)}日
                  </Text>
                </View>
              ) : null}
              {fields.location && record.location_name ? (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={12} color={Colors.olive} />
                  <Text style={[styles.metaText, { color: isDark ? Colors.note : Colors.inkSoft }]} numberOfLines={1}>{record.location_name}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {fields.rating && record.rating && record.rating > 0 ? (
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: isDark ? Colors.note : Colors.inkSoft }]}>美味</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name={s <= record.rating! ? 'star' : 'star-outline'} size={14} color={s <= record.rating! ? Colors.ochre : Colors.inkLight} />
              ))}
            </View>
          </View>
        ) : null}

        {fields.tags && tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.map((t) => (
              <View key={t} style={[styles.tag, { borderColor: isDark ? Colors.note + '40' : Colors.line }]}>
                <Text style={[styles.tagText, { color: isDark ? Colors.note : Colors.inkSoft }]}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {fields.note && record.note ? (
          <View style={[styles.noteBox, { borderLeftColor: Colors.stamp }]}>
            <Text style={[styles.noteText, { color: textColor }]}>{record.note}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isDark ? Colors.note + 'AA' : Colors.inkLight }]}>
            — 味笺 · {fields.date ? formatDateCN(record.date) : ''}
          </Text>
        </View>
      </View>
      <View style={styles.bottomTapeRow}>
        <Tape color="blue" width={46} height={15} rotate={5} />
      </View>
    </View>
  );
}

// ===== 票根风 =====
function TicketCollage({ record, fields, bg }: { record: LedgerRecord; fields: ShareFields; bg: ShareBg }) {
  const meal = Meals[record.meal];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const cardBg = SHARE_BG_COLORS[bg];
  const textColor = SHARE_BG_TEXT_COLORS[bg];
  const isDark = bg === 'ink';
  const subColor = isDark ? Colors.note + 'AA' : Colors.inkLight;

  return (
    <View style={styles.wrap}>
      <View style={[styles.ticketCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(251,245,232,0.2)' : 'rgba(61,46,31,0.2)' }]}>
        {/* 票头 */}
        <View style={[styles.ticketHead, { borderBottomColor: isDark ? Colors.note + '30' : Colors.line }]}>
          <Text style={[styles.ticketTitle, { color: textColor }]}>美食票根</Text>
          <View style={[styles.ticketNo, { borderColor: meal.color }]}>
            <Text style={[styles.ticketNoText, { color: meal.color }]}>No.{String(record.id).padStart(4, '0')}</Text>
          </View>
        </View>

        {/* 照片 */}
        {fields.photo && record.photo_uri ? (
          <View style={styles.ticketPhotoWrap}>
            <StyledPhoto uri={record.photo_uri} style="tape" shape={record.photo_shape ?? 'square'} height={140} accent={meal.color} />
          </View>
        ) : null}

        {/* 金额大字 */}
        {fields.amount ? (
          <View style={styles.ticketAmountBox}>
            <Text style={[styles.ticketAmountLabel, { color: subColor }]}>金额</Text>
            <Text style={[styles.ticketAmount, { color: textColor }]}>{formatMoney(record.amount)}</Text>
          </View>
        ) : null}

        {/* 撕齿虚线 */}
        <View style={[styles.ticketTear, { borderColor: isDark ? Colors.note + '30' : Colors.line }]} />

        {/* 信息栏 */}
        <View style={styles.ticketInfoGrid}>
          {fields.meal ? (
            <View style={styles.ticketInfoCell}>
              <Text style={[styles.ticketInfoKey, { color: subColor }]}>餐次</Text>
              <Text style={[styles.ticketInfoVal, { color: textColor }]}>{meal.label}</Text>
            </View>
          ) : null}
          {fields.date ? (
            <View style={styles.ticketInfoCell}>
              <Text style={[styles.ticketInfoKey, { color: subColor }]}>日期</Text>
              <Text style={[styles.ticketInfoVal, { color: textColor }]}>{record.date}</Text>
            </View>
          ) : null}
          {fields.location && record.location_name ? (
            <View style={styles.ticketInfoCell}>
              <Text style={[styles.ticketInfoKey, { color: subColor }]}>地点</Text>
              <Text style={[styles.ticketInfoVal, { color: textColor }]} numberOfLines={1}>{record.location_name}</Text>
            </View>
          ) : null}
          {fields.rating && record.rating && record.rating > 0 ? (
            <View style={styles.ticketInfoCell}>
              <Text style={[styles.ticketInfoKey, { color: subColor }]}>评分</Text>
              <Text style={[styles.ticketInfoVal, { color: textColor }]}>{'★'.repeat(record.rating)}</Text>
            </View>
          ) : null}
        </View>

        {fields.tags && tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {tags.map((t) => (
              <View key={t} style={[styles.tag, { borderColor: isDark ? Colors.note + '40' : Colors.line }]}>
                <Text style={[styles.tagText, { color: isDark ? Colors.note : Colors.inkSoft }]}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {fields.note && record.note ? (
          <View style={[styles.noteBox, { borderLeftColor: meal.color }]}>
            <Text style={[styles.noteText, { color: textColor }]}>{record.note}</Text>
          </View>
        ) : null}

        <View style={styles.ticketFooter}>
          <Text style={[styles.footerText, { color: subColor }]}>味笺 · WEI JIAN</Text>
        </View>
      </View>
    </View>
  );
}

// ===== 极简风 =====
function MinimalCollage({ record, fields, bg }: { record: LedgerRecord; fields: ShareFields; bg: ShareBg }) {
  const meal = Meals[record.meal];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const cardBg = SHARE_BG_COLORS[bg];
  const textColor = SHARE_BG_TEXT_COLORS[bg];
  const isDark = bg === 'ink';
  const subColor = isDark ? Colors.note + 'AA' : Colors.inkLight;

  return (
    <View style={styles.wrap}>
      <View style={[styles.minimalCard, { backgroundColor: cardBg }]}>
        {fields.photo && record.photo_uri ? (
          <View style={styles.minimalPhoto}>
            <StyledPhoto uri={record.photo_uri} style="sketch" shape={record.photo_shape ?? 'square'} height={180} accent={meal.color} />
          </View>
        ) : null}

        {fields.amount ? (
          <Text style={[styles.minimalAmount, { color: textColor }]}>{formatMoney(record.amount)}</Text>
        ) : null}

        <View style={styles.minimalMetaCol}>
          {fields.meal ? <Text style={[styles.minimalMetaText, { color: subColor }]}>{meal.label}</Text> : null}
          {fields.date ? <Text style={[styles.minimalMetaText, { color: subColor }]}>{record.date}</Text> : null}
          {fields.location && record.location_name ? <Text style={[styles.minimalMetaText, { color: subColor }]} numberOfLines={1}>{record.location_name}</Text> : null}
        </View>

        {fields.rating && record.rating && record.rating > 0 ? (
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons key={s} name={s <= record.rating! ? 'star' : 'star-outline'} size={16} color={s <= record.rating! ? Colors.ochre : Colors.inkLight} />
            ))}
          </View>
        ) : null}

        {fields.tags && tags.length > 0 ? (
          <View style={styles.minimalTags}>
            {tags.map((t) => (
              <Text key={t} style={[styles.minimalTagText, { color: subColor }]}>#{t}</Text>
            ))}
          </View>
        ) : null}

        {fields.note && record.note ? (
          <Text style={[styles.minimalNote, { color: textColor }]}>{record.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ===== 贴纸风（圆形大头照 + 手写标签） =====
function StickerCollage({ record, fields, bg }: { record: LedgerRecord; fields: ShareFields; bg: ShareBg }) {
  const meal = Meals[record.meal];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const [, m, d] = record.date.split('-').map(Number);
  const cardBg = SHARE_BG_COLORS[bg];
  const textColor = SHARE_BG_TEXT_COLORS[bg];
  const isDark = bg === 'ink';
  const subColor = isDark ? Colors.note + 'AA' : Colors.inkLight;

  return (
    <View style={styles.wrap}>
      <View style={[styles.stickerCardBig, { backgroundColor: cardBg, borderColor: meal.color }]}>
        <View style={styles.stickerCircleWrap}>
          {fields.photo && record.photo_uri ? (
            <View style={[styles.stickerCircle, { borderColor: meal.color }]}>
              <Image source={{ uri: record.photo_uri }} style={styles.stickerCircleImg} />
            </View>
          ) : (
            <View style={[styles.stickerCircle, { borderColor: meal.color, backgroundColor: meal.color + '20' }]}>
              <Ionicons name="restaurant" size={40} color={meal.color} />
            </View>
          )}
        </View>

        {fields.amount ? (
          <Text style={[styles.stickerBigAmount, { color: textColor }]}>{formatMoney(record.amount)}</Text>
        ) : null}

        <View style={[styles.stickerLabelChip, { borderColor: meal.color, backgroundColor: meal.color + '20' }]}>
          <Text style={[styles.stickerLabelText, { color: meal.color }]}>{meal.label}</Text>
        </View>

        {fields.date ? (
          <Text style={[styles.stickerDateText, { color: subColor }]}>
            {toCNNumber(m)}月{toCNNumber(d)}日
          </Text>
        ) : null}

        {fields.location && record.location_name ? (
          <View style={styles.stickerLocRow}>
            <Ionicons name="location-outline" size={11} color={Colors.olive} />
            <Text style={[styles.stickerLoc, { color: subColor }]} numberOfLines={1}>{record.location_name}</Text>
          </View>
        ) : null}

        {fields.rating && record.rating && record.rating > 0 ? (
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons key={s} name={s <= record.rating! ? 'star' : 'star-outline'} size={14} color={s <= record.rating! ? Colors.ochre : Colors.inkLight} />
            ))}
          </View>
        ) : null}

        {fields.note && record.note ? (
          <Text style={[styles.stickerNoteText, { color: textColor }]} numberOfLines={3}>{record.note}</Text>
        ) : null}

        {fields.tags && tags.length > 0 ? (
          <View style={styles.minimalTags}>
            {tags.map((t) => (
              <Text key={t} style={[styles.minimalTagText, { color: subColor }]}>#{t}</Text>
            ))}
          </View>
        ) : null}
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
    borderRadius: 4,
    borderWidth: 1,
    padding: 18,
    paddingTop: 22,
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  photoWrap: {
    marginBottom: 14,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  label: { fontSize: 11, fontFamily: Fonts.serif },
  amount: {
    fontSize: 36,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 8,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, fontFamily: Fonts.serif },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  ratingLabel: { fontSize: 11, fontFamily: Fonts.serif },
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
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tagText: { fontSize: 11, fontFamily: Fonts.serif },
  noteBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 3,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noteText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 10,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  bottomTapeRow: {
    marginTop: -7,
    zIndex: 2,
  },

  // ===== ticket =====
  ticketCard: {
    width: CARD_WIDTH,
    borderRadius: 6,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  ticketHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  ticketTitle: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 2,
  },
  ticketNo: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  ticketNoText: {
    fontSize: 10,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  ticketPhotoWrap: {
    marginVertical: 12,
    alignItems: 'center',
  },
  ticketAmountBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ticketAmountLabel: {
    fontSize: 10,
    fontFamily: Fonts.serif,
  },
  ticketAmount: {
    fontSize: 32,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  ticketTear: {
    marginVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  ticketInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ticketInfoCell: {
    minWidth: 80,
  },
  ticketInfoKey: {
    fontSize: 10,
    fontFamily: Fonts.serif,
  },
  ticketInfoVal: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    marginTop: 2,
  },
  ticketFooter: {
    marginTop: 14,
    alignItems: 'center',
  },

  // ===== minimal =====
  minimalCard: {
    width: CARD_WIDTH,
    borderRadius: 2,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  minimalPhoto: {
    marginBottom: 16,
    width: '100%',
  },
  minimalAmount: {
    fontSize: 40,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    marginBottom: 8,
  },
  minimalMetaCol: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 8,
  },
  minimalMetaText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
  },
  minimalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  minimalTagText: {
    fontSize: 11,
    fontFamily: Fonts.serif,
  },
  minimalNote: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },

  // ===== sticker =====
  stickerCardBig: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  stickerCircleWrap: {
    marginBottom: 12,
  },
  stickerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerCircleImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  stickerBigAmount: {
    fontSize: 30,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  stickerLabelChip: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  stickerLabelText: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  stickerDateText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    marginTop: 8,
  },
  stickerLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  stickerLoc: {
    fontSize: 11,
    fontFamily: Fonts.serif,
  },
  stickerNoteText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
});
