import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { Colors, Fonts, Meals, formatMoney, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, InkDot } from '@/components/Decorations';
import { StyledPhoto } from '@/components/StyledPhoto';
import type { LedgerRecord, MealType, LocationAgg } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
// 贴纸卡片宽度（2 列，扣除间距和边距）
const CARD_WIDTH = (SCREEN_WIDTH - 18 * 2 - 12) / 2;

export default function FootprintScreen() {
  const allRecords = useLedgerStore((s) => s.allRecords);
  const locations = useLedgerStore((s) => s.locations);
  const refreshAllRecords = useLedgerStore((s) => s.refreshAllRecords);
  const refreshLocations = useLedgerStore((s) => s.refreshLocations);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'wall' | 'timeline'>('wall');

  useEffect(() => {
    refreshAllRecords();
    refreshLocations();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAllRecords(), refreshLocations()]);
    setRefreshing(false);
  };

  const totalCount = allRecords.length;
  const totalAmount = allRecords.reduce((s, r) => s + r.amount, 0);
  const photoCount = allRecords.filter((r) => r.photo_uri).length;

  // 分两列排布贴纸卡片
  const columns = useMemo(() => {
    const left: LedgerRecord[] = [];
    const right: LedgerRecord[] = [];
    allRecords.forEach((r, i) => {
      if (i % 2 === 0) left.push(r);
      else right.push(r);
    });
    return { left, right };
  }, [allRecords]);

  // 时间轴：按月份分组
  const monthGroups = useMemo(() => {
    const map = new Map<string, LedgerRecord[]>();
    [...allRecords]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach((r) => {
        const month = r.date.slice(0, 7);
        if (!map.has(month)) map.set(month, []);
        map.get(month)!.push(r);
      });
    return Array.from(map.entries()).map(([month, records]) => ({ month, records }));
  }, [allRecords]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="美食足迹" date={viewMode === 'wall' ? '贴图墙' : '时间轴'} />
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 概览 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={0} padding={14} showTape>
              <View style={styles.overviewRow}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{totalCount}</Text>
                  <Text style={styles.overviewLabel}>笔记录</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{photoCount}</Text>
                  <Text style={styles.overviewLabel}>张照片</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{locations.length}</Text>
                  <Text style={styles.overviewLabel}>个地点</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{formatMoney(totalAmount)}</Text>
                  <Text style={styles.overviewLabel}>累计</Text>
                </View>
              </View>
            </PaperCard>
          </View>

          {/* 视图切换 */}
          <View style={styles.px}>
            <View style={styles.switchRow}>
              <SwitchBtn
                icon="grid-outline"
                label="贴图墙"
                active={viewMode === 'wall'}
                onPress={() => setViewMode('wall')}
              />
              <SwitchBtn
                icon="git-branch-outline"
                label="时间轴"
                active={viewMode === 'timeline'}
                onPress={() => setViewMode('timeline')}
              />
            </View>
          </View>

          {allRecords.length === 0 ? (
            <Empty
              icon="images-outline"
              text="贴图墙还是空的"
              hint="记一笔美食并添加照片，就会出现在这里"
              actionLabel="去记一笔"
              onAction={() => router.push('/add')}
            />
          ) : viewMode === 'wall' ? (
            /* 贴图墙：双列瀑布流 */
            <>
              <View style={styles.px}>
                <View style={styles.sectionTitleRow}>
                  <Tape color="yellow" width={16} height={10} rotate={-6} />
                  <Text style={styles.sectionTitle}>美食贴图墙</Text>
                  <Text style={styles.sectionSub}>点击可编辑</Text>
                </View>
              </View>
              <View style={styles.boardWrap}>
                <View style={styles.column}>
                  {columns.left.map((r, i) => (
                    <StickerCard key={r.id} record={r} index={i * 2} />
                  ))}
                </View>
                <View style={styles.column}>
                  {columns.right.map((r, i) => (
                    <StickerCard key={r.id} record={r} index={i * 2 + 1} />
                  ))}
                </View>
              </View>
            </>
          ) : (
            /* 时间轴：旅行足迹线条 */
            <View style={styles.px}>
              <View style={styles.sectionTitleRow}>
                <Tape color="green" width={16} height={10} rotate={-6} />
                <Text style={styles.sectionTitle}>美味时间轴</Text>
                <Text style={styles.sectionSub}>{monthGroups.length} 个月</Text>
              </View>
              {monthGroups.map((g) => (
                <TimelineMonth key={g.month} month={g.month} records={g.records} />
              ))}
            </View>
          )}

          {/* 地点清单 */}
          {locations.length > 0 ? (
            <View style={styles.px}>
              <View style={styles.sectionTitleRow}>
                <Tape color="green" width={16} height={10} rotate={-6} />
                <Text style={styles.sectionTitle}>地点清单</Text>
                <Text style={styles.sectionSub}>{locations.length} 处</Text>
              </View>
              <PaperCard tape="blue" rotate={0} padding={0} showTape>
                {locations.map((l, i) => (
                  <LocationRow
                    key={`${l.location_name}-${i}`}
                    loc={l}
                    last={i === locations.length - 1}
                  />
                ))}
              </PaperCard>
            </View>
          ) : null}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

// 视图切换按钮
function SwitchBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.switchBtn, active && styles.switchBtnActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={15} color={active ? Colors.note : Colors.inkSoft} />
      <Text style={[styles.switchBtnText, active && styles.switchBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// 时间轴：单月组（左侧竖线 + 节点卡片）
function TimelineMonth({
  month,
  records,
}: {
  month: string;
  records: LedgerRecord[];
}) {
  const [y, m] = month.split('-').map(Number);
  const monthTotal = records.reduce((s, r) => s + r.amount, 0);
  return (
    <View style={styles.timelineMonth}>
      {/* 月份标题 */}
      <View style={styles.timelineMonthHead}>
        <View style={styles.timelineMonthNode} />
        <Text style={styles.timelineMonthTitle}>
          {toCNNumber(y)}年{toCNNumber(m)}月
        </Text>
        <Text style={styles.timelineMonthMeta}>
          {records.length} 笔 · {formatMoney(monthTotal)}
        </Text>
      </View>
      {/* 节点列表 */}
      <View style={styles.timelineList}>
        {records.map((r, i) => (
          <TimelineNode key={r.id} record={r} last={i === records.length - 1} />
        ))}
      </View>
    </View>
  );
}

// 时间轴节点
function TimelineNode({ record, last }: { record: LedgerRecord; last: boolean }) {
  const meal = Meals[record.meal as MealType];
  const [, m, d] = record.date.split('-').map(Number);
  return (
    <View style={styles.timelineNodeRow}>
      {/* 左侧连线 + 节点 */}
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: meal.color }]} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      {/* 右侧内容卡 */}
      <TouchableOpacity
        style={styles.timelineCard}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/add', params: { id: String(record.id) } })}
      >
        {record.photo_uri ? (
          <StyledPhoto
            uri={record.photo_uri}
            style={record.photo_style ?? 'polaroid'}
            shape={record.photo_shape ?? 'square'}
            height={80}
            accent={meal.color}
          />
        ) : null}
        <View style={styles.timelineCardInfo}>
          <View style={styles.timelineCardTop}>
            <Text style={styles.timelineCardAmount}>¥{record.amount.toFixed(0)}</Text>
            <View style={[styles.timelineMealChip, { borderColor: meal.color }]}>
              <Text style={[styles.timelineMealText, { color: meal.color }]}>{meal.label}</Text>
            </View>
          </View>
          <Text style={styles.timelineCardDate}>
            {toCNNumber(m)}月{toCNNumber(d)}日
            {record.location_name ? ` · ${record.location_name}` : ''}
          </Text>
          {record.note ? (
            <Text style={styles.timelineCardNote} numberOfLines={1}>{record.note}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ===== 贴纸卡片（拍立得风） =====
function StickerCard({ record, index }: { record: LedgerRecord; index: number }) {
  const meal = Meals[record.meal as MealType];
  const tags = record.tags ? record.tags.split(',').filter(Boolean) : [];
  const [, m, d] = record.date.split('-').map(Number);
  // 交替旋转角度，营造手账随意贴的感觉
  const rotate = index % 4 === 0 ? -2.5 : index % 4 === 1 ? 2 : index % 4 === 2 ? -1.5 : 1.5;
  const tapeColor = (['yellow', 'pink', 'green', 'blue'] as const)[index % 4];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        router.push({ pathname: '/add', params: { id: String(record.id) } })
      }
      style={[styles.stickerWrap, { transform: [{ rotate: `${rotate}deg` }] }]}
    >
      {/* 顶部胶带 */}
      <View style={styles.stickerTapeWrap}>
        <Tape color={tapeColor} width={44} height={14} rotate={-4} />
      </View>

      {/* 照片区 / 占位区 */}
      <View style={styles.stickerPhotoBox}>
        {record.photo_uri ? (
          <StyledPhoto
            uri={record.photo_uri}
            style={record.photo_style ?? 'polaroid'}
            shape={record.photo_shape ?? 'square'}
            height={CARD_WIDTH * 0.85}
            accent={meal.color}
          />
        ) : (
          <View style={[styles.stickerPlaceholder, { backgroundColor: meal.color + '18' }]}>
            <Ionicons name="restaurant" size={32} color={meal.color} />
            <Text style={[styles.stickerPlaceholderText, { color: meal.color }]}>
              {meal.label}
            </Text>
          </View>
        )}
      </View>

      {/* 底部信息区 */}
      <View style={styles.stickerInfo}>
        <View style={styles.stickerTopRow}>
          <Text style={styles.stickerAmount}>¥{record.amount.toFixed(0)}</Text>
          {record.rating && record.rating > 0 ? (
            <View style={styles.stickerStar}>
              <Ionicons name="star" size={10} color={Colors.ochre} />
              <Text style={styles.stickerStarText}>{record.rating}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.stickerDate}>
          {toCNNumber(m)}月{toCNNumber(d)}日 · {meal.label}
        </Text>
        {record.location_name ? (
          <View style={styles.stickerLocRow}>
            <Ionicons name="location-outline" size={9} color={Colors.olive} />
            <Text style={styles.stickerLoc} numberOfLines={1}>
              {record.location_name}
            </Text>
          </View>
        ) : null}
        {record.note ? (
          <Text style={styles.stickerNote} numberOfLines={2}>
            {record.note}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.stickerTagsRow}>
            {tags.slice(0, 2).map((t) => (
              <View key={t} style={[styles.stickerTag, { borderColor: meal.color }]}>
                <Text style={[styles.stickerTagText, { color: meal.color }]}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function LocationRow({ loc, last }: { loc: LocationAgg; last: boolean }) {
  return (
    <View style={[styles.locRow, !last && styles.locRowBorder]}>
      <View style={styles.locThumbWrap}>
        {loc.sample_photo ? (
          <Image source={{ uri: loc.sample_photo }} style={styles.locThumb} />
        ) : (
          <View style={styles.locThumbPlaceholder}>
            <Ionicons name="restaurant" size={18} color={Colors.inkLight} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.locName} numberOfLines={1}>
          {loc.location_name || '未命名地点'}
        </Text>
        <View style={styles.locMeta}>
          <InkDot color={Colors.olive} size={6} />
          <Text style={styles.locMetaText}>{loc.count} 次打卡</Text>
          <Text style={styles.locDot}>·</Text>
          <Text style={styles.locMetaText}>{formatMoney(loc.total)}</Text>
        </View>
        <Text style={styles.locLast}>最近 {loc.last_date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.inkLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 12 },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  overviewLabel: { fontSize: 10, color: Colors.inkLight, marginTop: 2, fontFamily: Fonts.serif },
  overviewDivider: { width: 1, height: 24, backgroundColor: Colors.line, opacity: 0.5 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
    flex: 1,
  },
  sectionSub: { fontSize: 11, color: Colors.inkLight, fontStyle: 'italic' },

  // 视图切换
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  switchBtnActive: {
    borderColor: Colors.ink,
    backgroundColor: Colors.ink,
    borderStyle: 'solid',
  },
  switchBtnText: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  switchBtnTextActive: {
    color: Colors.note,
    fontWeight: '700',
  },

  // 时间轴
  timelineMonth: {
    marginBottom: 18,
  },
  timelineMonthHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  timelineMonthNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.olive,
    backgroundColor: Colors.note,
  },
  timelineMonthTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  timelineMonthMeta: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineNodeRow: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineRail: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 18,
    borderWidth: 2,
    borderColor: Colors.note,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.line,
    marginTop: 2,
    opacity: 0.6,
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.note,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.12)',
    padding: 10,
    marginBottom: 10,
    marginLeft: 6,
  },
  timelineCardInfo: {
    flex: 1,
  },
  timelineCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineCardAmount: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  timelineMealChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  timelineMealText: {
    fontSize: 10,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  timelineCardDate: {
    fontSize: 11,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    marginTop: 3,
  },
  timelineCardNote: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // 贴图墙
  boardWrap: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 14,
  },

  // 贴纸卡片
  stickerWrap: {
    width: '100%',
    backgroundColor: Colors.note,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.12)',
    overflow: 'visible',
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  stickerTapeWrap: {
    position: 'absolute',
    top: -7,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  stickerPhotoBox: {
    width: '100%',
    backgroundColor: Colors.paperLight,
    overflow: 'hidden',
  },
  stickerPhotoBoxPad: {
    padding: 8,
  },
  stickerPlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stickerPlaceholderText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  stickerInfo: {
    padding: 8,
  },
  stickerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickerAmount: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  stickerStar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.ochre + '18',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  stickerStarText: {
    fontSize: 10,
    color: Colors.ochre,
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  stickerDate: {
    fontSize: 10,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    marginTop: 2,
  },
  stickerLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  stickerLoc: {
    fontSize: 10,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    flex: 1,
  },
  stickerNote: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    marginTop: 3,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  stickerTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 5,
  },
  stickerTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  stickerTagText: { fontSize: 9, fontFamily: Fonts.serif },

  // 地点列表
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  locRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  locThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  locThumb: { width: '100%', height: '100%' },
  locThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.paperLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locName: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
  },
  locMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locMetaText: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.serif },
  locDot: { fontSize: 11, color: Colors.inkLight },
  locLast: { fontSize: 10, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
});
