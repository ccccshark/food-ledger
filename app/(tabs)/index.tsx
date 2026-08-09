import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore, todayStr } from '@/stores/ledger';
import {
  Colors,
  Fonts,
  Meals,
  formatMoney,
  formatDateCN,
  toCNNumber,
} from '@/constants/theme';
import { Header } from '@/components/Header';
import { QuickEntries } from '@/components/QuickEntries';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Stamp, DashedDivider, InkDot, Tape } from '@/components/Decorations';
import type { MealType, LedgerRecord as Rec } from '@/types';
import { MEAL_ORDER } from '@/types';

export default function HomeScreen() {
  const today = useLedgerStore((s) => s.today);
  const todayRecords = useLedgerStore((s) => s.todayRecords);
  const monthSummary = useLedgerStore((s) => s.monthSummary);
  const budget = useLedgerStore((s) => s.budget);
  const refreshToday = useLedgerStore((s) => s.refreshToday);
  const refreshMonth = useLedgerStore((s) => s.refreshMonth);
  const refreshBudget = useLedgerStore((s) => s.refreshBudget);

  const [refreshing, setRefreshing] = React.useState(false);

  const loadAll = async () => {
    await Promise.all([refreshToday(), refreshMonth(), refreshBudget()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const date = todayStr();
  const todayTotal = today?.total ?? 0;
  const monthTotal = monthSummary?.total ?? 0;
  const monthCount = monthSummary?.count ?? 0;
  const budgetUsed = budget > 0 ? Math.min(100, (monthTotal / budget) * 100) : 0;

  const todayByMeal = useMemo(() => {
    const map: Record<MealType, number> = {
      breakfast: 0, lunch: 0, dinner: 0, snack: 0, supper: 0,
    };
    for (const r of todayRecords) {
      map[r.meal as MealType] += r.amount;
    }
    return map;
  }, [todayRecords]);

  // 农历感日期
  const [, m, d] = date.split('-').map(Number);
  const cnDate = `${toCNNumber(m)}月${toCNNumber(d)}日`;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Header title="美食手账" date={cnDate} />

          {/* 今日卡片：像贴在牛皮纸上的一页日记 */}
          <View style={styles.todayWrap}>
            <PaperCard tape="pink" rotate={-1.5} padding={20} style={styles.todayCard}>
              <View style={styles.todayHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.todayLabel}>今日所食 · 共费</Text>
                  <Text style={styles.todayAmount}>{formatMoney(todayTotal)}</Text>
                  <Text style={styles.todayDate}>{formatDateCN(date)}</Text>
                </View>
                <Stamp text="今日" size={52} />
              </View>

              <DashedDivider />

              {/* 餐次分布 */}
              <View style={styles.mealRow}>
                {MEAL_ORDER.map((mKey) => {
                  const meal = Meals[mKey];
                  const v = todayByMeal[mKey];
                  return (
                    <View key={mKey} style={styles.mealItem}>
                      <InkDot color={meal.color} size={7} />
                      <Text style={styles.mealLabel}>{meal.label}</Text>
                      <Text style={[styles.mealValue, v > 0 && { color: Colors.ink }]}>
                        {v > 0 ? `¥${v.toFixed(0)}` : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </PaperCard>
          </View>

          {/* 快捷记账 */}
          <Section title="随手记一笔" subtitle="轻点餐次，速记">
            <QuickEntries />
          </Section>

          {/* 本月概览 */}
          <Section
            title="本月花销"
            subtitle={`共 ${monthCount} 笔`}
            action="查看全部 ›"
            onAction={() => router.push('/records')}
          >
            <View style={styles.statRow}>
              <PaperCard tape="green" rotate={1} padding={14} style={styles.statCard}>
                <Text style={styles.statLabel}>本月支出</Text>
                <Text style={styles.statValue}>{formatMoney(monthTotal)}</Text>
                <View style={styles.statUnderline} />
              </PaperCard>
              <PaperCard tape="yellow" rotate={-1} padding={14} style={styles.statCard}>
                <Text style={styles.statLabel}>月度预算</Text>
                {budget > 0 ? (
                  <>
                    <Text style={styles.statValue}>{formatMoney(budget)}</Text>
                    <View style={styles.progress}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${budgetUsed}%`,
                            backgroundColor:
                              budgetUsed >= 100 ? Colors.danger : Colors.olive,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {budgetUsed >= 100
                        ? `已超支 ${formatMoney(monthTotal - budget)}`
                        : `已用 ${budgetUsed.toFixed(0)}%`}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.statHint}>未设置</Text>
                )}
              </PaperCard>
            </View>
          </Section>

          {/* 今日明细 */}
          <Section
            title="今日明细"
            action={
              todayRecords.length > 0 ? (
                <TouchableOpacity onPress={() => router.push('/add')}>
                  <Ionicons name="add-circle" size={22} color={Colors.stamp} />
                </TouchableOpacity>
              ) : undefined
            }
          >
            {todayRecords.length === 0 ? (
              <Empty
                icon="book-outline"
                text="今日尚未记一笔"
                hint="点击上方餐次贴纸开始记录"
                actionLabel="记一笔"
                onAction={() => router.push('/add')}
              />
            ) : (
              <PaperCard tape="blue" rotate={0.5} padding={0} showTape>
                <View style={styles.listInner}>
                  {todayRecords.map((r, i) => (
                    <RecordRow
                      key={r.id}
                      r={r}
                      last={i === todayRecords.length - 1}
                    />
                  ))}
                </View>
              </PaperCard>
            )}
          </Section>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Section({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          <Tape color="yellow" width={16} height={10} rotate={-6} />
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {action ? (
          typeof action === 'string' ? (
            <TouchableOpacity onPress={onAction}>
              <Text style={styles.link}>{action}</Text>
            </TouchableOpacity>
          ) : (
            action
          )
        ) : null}
      </View>
      {children}
    </View>
  );
}

function RecordRow({ r, last }: { r: Rec; last: boolean }) {
  const meal = Meals[r.meal as MealType];
  const tags = r.tags ? r.tags.split(',').filter(Boolean) : [];
  return (
    <TouchableOpacity
      style={[styles.rRow, !last && styles.rRowBorder]}
      onPress={() => router.push({ pathname: '/add', params: { id: String(r.id) } })}
    >
      <View style={[styles.rIcon, { borderColor: meal.color }]}>
        <Ionicons name="restaurant" size={14} color={meal.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rRowHead}>
          <Text style={styles.rMeal}>{meal.label}</Text>
          {tags.slice(0, 2).map((t) => (
            <View key={t} style={[styles.rTag, { borderColor: meal.color }]}>
              <Text style={[styles.rTagText, { color: meal.color }]}>{t}</Text>
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
  todayWrap: { paddingHorizontal: 18, marginBottom: 4 },
  todayCard: {},
  todayHead: { flexDirection: 'row', alignItems: 'flex-start' },
  todayLabel: { fontSize: 12, color: Colors.inkLight, fontFamily: Fonts.serif },
  todayAmount: {
    fontSize: 38,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginVertical: 4,
  },
  todayDate: { fontSize: 11, color: Colors.inkLight, fontStyle: 'italic' },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  mealItem: { alignItems: 'center', flex: 1 },
  mealLabel: { fontSize: 11, color: Colors.inkSoft, marginTop: 4, fontFamily: Fonts.serif },
  mealValue: { fontSize: 12, fontWeight: '600', color: Colors.inkLight, marginTop: 2 },
  section: { marginTop: 22, paddingHorizontal: 18 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginLeft: 8,
    letterSpacing: 1,
  },
  sectionSub: { fontSize: 11, color: Colors.inkLight, marginLeft: 8, fontStyle: 'italic' },
  link: { color: Colors.stamp, fontSize: 13, fontFamily: Fonts.serif },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statLabel: { fontSize: 12, color: Colors.inkLight, fontFamily: Fonts.serif },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 4,
  },
  statUnderline: {
    height: 1,
    backgroundColor: Colors.line,
    marginTop: 8,
    opacity: 0.5,
  },
  statHint: { fontSize: 22, fontFamily: Fonts.serif, color: Colors.inkLight, marginTop: 4 },
  progress: {
    height: 5,
    backgroundColor: Colors.lineSoft,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 10, color: Colors.inkLight, marginTop: 4, fontStyle: 'italic' },
  listInner: { paddingVertical: 4 },
  rRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  rIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.note,
  },
  rRowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rMeal: { fontSize: 14, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  rTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.note,
  },
  rTagText: { fontSize: 10, fontFamily: Fonts.serif },
  rNote: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  rAmount: { fontSize: 15, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink },
});
