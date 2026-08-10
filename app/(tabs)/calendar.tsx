import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { Colors, Fonts, Meals, formatMoney, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider, InkDot } from '@/components/Decorations';
import { t, useT, MEAL_T_KEY } from '@/constants/i18n';
import type { MealType, LedgerRecord as Rec, DaySummary } from '@/types';
import * as dao from '@/db';

const WEEK_KEYS = [0, 1, 2, 3, 4, 5, 6];

export default function CalendarScreen() {
  const { t } = useT();
  const monthCalendar = useLedgerStore((s) => s.monthCalendar);
  const refreshMonthCalendar = useLedgerStore((s) => s.refreshMonthCalendar);
  const currentMonth = useLedgerStore((s) => s.currentMonth);
  const todayDate = useLedgerStore((s) => s.currentDate);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<Rec[]>([]);

  useEffect(() => {
    refreshMonthCalendar(viewMonth);
  }, [viewMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMonthCalendar(viewMonth);
    setRefreshing(false);
  };

  // 构建月历网格
  const grid = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = new Date(y, m, 0).getDate();

    const map = new Map<string, DaySummary>();
    for (const d of monthCalendar) map.set(d.date, d);

    const cells: ({ date: string; summary: DaySummary } | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${viewMonth}-${String(d).padStart(2, '0')}`;
      cells.push({
        date,
        summary: map.get(date) ?? { date, total: 0, count: 0 },
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth, monthCalendar]);

  const monthTotal = monthCalendar.reduce((s, d) => s + d.total, 0);
  const monthCount = monthCalendar.reduce((s, d) => s + d.count, 0);

  const shiftMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setViewMonth(`${ny}-${nm}`);
  };

  const onSelectDay = async (date: string) => {
    setSelectedDate(date);
    const recs = await dao.listRecordsByMonth(date.slice(0, 7));
    setDayRecords(recs.filter((r) => r.date === date));
  };

  const [y, m] = viewMonth.split('-').map(Number);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title={t('calendar.title')} date={`${toCNNumber(y)}年${toCNNumber(m)}月`} />
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 月份切换 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={0} padding={14} showTape>
              <View style={styles.monthSwitchRow}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={20} color={Colors.inkSoft} />
                </TouchableOpacity>
                <View style={styles.monthSwitchCenter}>
                  <Text style={styles.monthSwitchTitle}>
                    {toCNNumber(y)}年{toCNNumber(m)}月
                  </Text>
                  <Text style={styles.monthSwitchSub}>
                    {t('calendar.month_count', { n: monthCount, amount: formatMoney(monthTotal) })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.inkSoft} />
                </TouchableOpacity>
              </View>
            </PaperCard>
          </View>

          {/* 日历主体 */}
          <View style={styles.px}>
            <PaperCard tape="yellow" rotate={0} padding={10} showTape={false}>
              {/* 星期表头 */}
              <View style={styles.weekRow}>
                {WEEK_KEYS.map((i) => (
                  <View key={i} style={styles.weekCell}>
                    <Text
                      style={[
                        styles.weekText,
                        (i === 0 || i === 6) && { color: Colors.stamp },
                      ]}
                    >
                      {t(`week.${i}`)}
                    </Text>
                  </View>
                ))}
              </View>
              <DashedDivider />
              {/* 日期网格 */}
              <View style={styles.grid}>
                {grid.map((cell, i) => (
                  <CalendarCell
                    key={i}
                    cell={cell}
                    today={todayDate}
                    onSelect={onSelectDay}
                  />
                ))}
              </View>
            </PaperCard>
          </View>

          {monthCount === 0 ? (
            <Empty
              icon="calendar-outline"
              text={t('calendar.empty_text')}
              hint={t('calendar.empty_hint')}
            />
          ) : null}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 当日明细弹层 */}
        <Modal visible={!!selectedDate} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
          <Pressable style={styles.modalMask} onPress={() => setSelectedDate(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalTapeWrap}>
                <Tape color="green" width={60} height={16} rotate={-5} />
              </View>
              <View style={styles.modalHead}>
                <View style={styles.modalHeadLeft}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.olive} />
                  <Text style={styles.modalDate}>
                    {selectedDate ? formatModalDate(selectedDate) : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={Colors.inkSoft} />
                </TouchableOpacity>
              </View>
              <DashedDivider />
              {dayRecords.length === 0 ? (
                <View style={styles.modalEmptyWrap}>
                  <Ionicons name="receipt-outline" size={32} color={Colors.inkLight} />
                  <Text style={styles.modalEmpty}>{t('calendar.modal_empty')}</Text>
                </View>
              ) : (
                <>
                  <ScrollView style={styles.modalList}>
                    {dayRecords.map((r, i) => (
                      <DayRecordRow
                        key={r.id}
                        r={r}
                        last={i === dayRecords.length - 1}
                        onClose={() => setSelectedDate(null)}
                      />
                    ))}
                  </ScrollView>
                  <View style={styles.modalTotalRow}>
                    <Text style={styles.modalTotalLabel}>{t('calendar.modal_total')}</Text>
                    <Text style={styles.modalTotalValue}>
                      ¥{dayRecords.reduce((s, r) => s + r.amount, 0).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              <TouchableOpacity
                style={styles.modalAddBtn}
                onPress={() => {
                  const d = selectedDate;
                  setSelectedDate(null);
                  router.push({
                    pathname: '/add',
                    params: d ? { date: d } : undefined,
                  });
                }}
              >
                <Ionicons name="add" size={16} color={Colors.note} />
                <Text style={styles.modalAddText}>{t('calendar.modal_add')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </PaperBackground>
  );
}

function formatModalDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const wd = new Date(date).getDay();
  return `${toCNNumber(m)}月${toCNNumber(d)}日 · ${t(`weekday.${wd}`)}`;
}

function CalendarCell({
  cell,
  today,
  onSelect,
}: {
  cell: { date: string; summary: DaySummary } | null;
  today: string;
  onSelect: (date: string) => void;
}) {
  if (!cell) return <View style={styles.cell} />;
  const { date, summary } = cell;
  const day = Number(date.slice(8, 10));
  const isToday = date === today;
  const hasRecord = summary.count > 0;
  const wd = new Date(date).getDay();
  const isWeekend = wd === 0 || wd === 6;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        isToday && { backgroundColor: Colors.stamp + '15', borderRadius: 4 },
      ]}
      onPress={() => onSelect(date)}
    >
      <Text
        style={[
          styles.cellDay,
          isToday && { color: Colors.stamp, fontWeight: '700' },
          isWeekend && !isToday && { color: Colors.stamp },
          !hasRecord && !isToday && { color: Colors.inkLight },
        ]}
      >
        {day}
      </Text>
      {hasRecord ? (
        <View style={styles.cellBody}>
          <View style={styles.cellDotRow}>
            <InkDot color={Colors.olive} size={5} />
          </View>
          <Text style={styles.cellAmount} numberOfLines={1}>
            ¥{summary.total.toFixed(0)}
          </Text>
          <Text style={styles.cellCount}>{t('calendar.cell_count', { n: summary.count })}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function DayRecordRow({
  r,
  last,
  onClose,
}: {
  r: Rec;
  last: boolean;
  onClose: () => void;
}) {
  const meal = Meals[r.meal as MealType];
  const tags = r.tags ? r.tags.split(',').filter(Boolean) : [];
  return (
    <TouchableOpacity
      style={[styles.modalRow, !last && styles.modalRowBorder]}
      onPress={() => {
        onClose();
        router.push({ pathname: '/add', params: { id: String(r.id) } });
      }}
    >
      <View style={[styles.rIcon, { borderColor: meal.color }]}>
        <Ionicons name="restaurant" size={12} color={meal.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rRowHead}>
          <Text style={styles.rMeal}>{t(MEAL_T_KEY[r.meal as MealType])}</Text>
          {tags.slice(0, 2).map((tg) => (
            <View key={tg} style={[styles.rTag, { borderColor: meal.color }]}>
              <Text style={[styles.rTagText, { color: meal.color }]}>{tg}</Text>
            </View>
          ))}
        </View>
        {r.note ? <Text style={styles.rNote} numberOfLines={1}>{r.note}</Text> : null}
      </View>
      <Text style={styles.rAmount}>¥{r.amount.toFixed(2)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 12 },
  monthSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 6 },
  monthSwitchCenter: { alignItems: 'center' },
  monthSwitchTitle: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  monthSwitchSub: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.serif, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  cellDay: { fontSize: 12, fontFamily: Fonts.serif, color: Colors.ink },
  cellBody: { alignItems: 'center', marginTop: 2 },
  cellDotRow: { marginBottom: 2 },
  cellAmount: {
    fontSize: 10,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  cellCount: { fontSize: 8, color: Colors.inkLight },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(61,46,31,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Colors.note,
    borderRadius: 4,
    padding: 18,
    paddingTop: 14,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  modalTapeWrap: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  modalHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
  },
  modalDate: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  modalEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  modalEmpty: { fontSize: 13, color: Colors.inkLight, textAlign: 'center' },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.line,
    borderStyle: 'dashed',
  },
  modalTotalLabel: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif },
  modalTotalValue: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.olive,
  },
  modalList: { maxHeight: 300 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  modalRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  rIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
  },
  rRowHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rMeal: { fontSize: 13, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  rTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  rTagText: { fontSize: 9, fontFamily: Fonts.serif },
  rNote: { fontSize: 10, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  rAmount: { fontSize: 14, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink },
  modalAddBtn: {
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 4,
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
    alignItems: 'center',
  },
  modalAddText: {
    color: Colors.note,
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
