import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useLedgerStore } from '@/stores/ledger';
import { Colors, Fonts, Meals, formatMoney, monthLabelCN, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider } from '@/components/Decorations';
import type { MealType } from '@/types';
import { MEAL_ORDER, MEAL_LABELS } from '@/types';

const screenWidth = Dimensions.get('window').width;

// 复古手账风图表配置
const chartConfig = {
  backgroundGradientFrom: Colors.note,
  backgroundGradientTo: Colors.note,
  color: (opacity = 1) => `rgba(181, 57, 47, ${opacity})`,  // 印章红
  labelColor: (opacity = 1) => `rgba(107, 83, 64, ${opacity})`, // 棕墨
  barPercentage: 0.6,
  propsForBackgroundLines: { stroke: Colors.lineSoft, strokeDasharray: [3, 3] },
};

export default function StatsScreen() {
  const monthSummary = useLedgerStore((s) => s.monthSummary);
  const monthRecords = useLedgerStore((s) => s.monthRecords);
  const budget = useLedgerStore((s) => s.budget);
  const refreshMonth = useLedgerStore((s) => s.refreshMonth);
  const refreshBudget = useLedgerStore((s) => s.refreshBudget);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshMonth();
    refreshBudget();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshMonth(), refreshBudget()]);
    setRefreshing(false);
  };

  const pieData = useMemo(() => {
    if (!monthSummary) return [];
    return MEAL_ORDER.filter((m) => monthSummary.byMeal[m] > 0).map((m) => ({
      name: MEAL_LABELS[m],
      amount: monthSummary.byMeal[m],
      color: Meals[m].color,
      legendFontColor: Colors.inkSoft,
      legendFontSize: 12,
    }));
  }, [monthSummary]);

  const barData = useMemo(() => {
    if (!monthRecords.length) return null;
    const byDay = new Map<number, number>();
    for (const r of monthRecords) {
      const day = Number(r.date.slice(8, 10));
      byDay.set(day, (byDay.get(day) ?? 0) + r.amount);
    }
    const days = Array.from(byDay.keys()).sort((a, b) => a - b);
    return {
      labels: days.map((d) => String(d)),
      datasets: [{ data: days.map((d) => byDay.get(d) ?? 0) }],
    };
  }, [monthRecords]);

  const monthTotal = monthSummary?.total ?? 0;
  const monthCount = monthSummary?.count ?? 0;
  const avgPerRecord = monthCount > 0 ? monthTotal / monthCount : 0;
  const daysWithRecords = new Set(monthRecords.map((r) => r.date)).size;
  const avgPerDay = daysWithRecords > 0 ? monthTotal / daysWithRecords : 0;
  const budgetUsed = budget > 0 ? Math.min(100, (monthTotal / budget) * 100) : 0;
  const budgetLeft = budget > 0 ? Math.max(0, budget - monthTotal) : 0;
  const hasData = monthCount > 0;

  const monthCN = monthSummary?.month
    ? (() => {
        const [y, m] = monthSummary.month.split('-').map(Number);
        return `${toCNNumber(y)}年${toCNNumber(m)}月`;
      })()
    : '';

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="月度盘点" date={monthCN} />
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 月度总览纸卡 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={-1} padding={20}>
              <Text style={styles.overviewMonth}>{monthCN}</Text>
              <Text style={styles.overviewTotal}>{formatMoney(monthTotal)}</Text>
              <DashedDivider />
              <View style={styles.overviewRow}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemLabel}>笔数</Text>
                  <Text style={styles.overviewItemValue}>{monthCount}</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemLabel}>笔均</Text>
                  <Text style={styles.overviewItemValue}>{formatMoney(avgPerRecord)}</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemLabel}>日均</Text>
                  <Text style={styles.overviewItemValue}>{formatMoney(avgPerDay)}</Text>
                </View>
              </View>
            </PaperCard>
          </View>

          {/* 预算 */}
          {budget > 0 ? (
            <View style={styles.px}>
              <PaperCard tape="green" rotate={0.5} padding={16}>
                <View style={styles.cardHead}>
                  <View style={styles.cardTitleRow}>
                    <Tape color="yellow" width={14} height={9} rotate={-6} />
                    <Text style={styles.cardTitle}>预算使用</Text>
                  </View>
                  <Text
                    style={[
                      styles.budgetPct,
                      { color: budgetUsed >= 100 ? Colors.danger : Colors.olive },
                    ]}
                  >
                    {budgetUsed.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
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
                <Text style={styles.budgetHint}>
                  {budgetLeft > 0
                    ? `余 ${formatMoney(budgetLeft)} 可用`
                    : `已超支 ${formatMoney(monthTotal - budget)}`}
                </Text>
              </PaperCard>
            </View>
          ) : null}

          {!hasData ? (
            <Empty
              icon="bar-chart-outline"
              text="本月尚无记录"
              hint="开始记账后这里会显示盘点图表"
            />
          ) : (
            <>
              {/* 餐次占比 */}
              {pieData.length > 0 ? (
                <Card title="餐次占比" tape="yellow">
                  <PieChart
                    data={pieData}
                    width={screenWidth - 72}
                    height={180}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    hasLegend
                    absolute
                  />
                </Card>
              ) : null}

              {/* 标签 Top */}
              {monthSummary && monthSummary.topTags.length > 0 ? (
                <Card title="标签排行" tape="blue">
                  <View style={styles.tagBars}>
                    {monthSummary.topTags.map((t, i) => {
                      const max = monthSummary.topTags[0].total;
                      const ratio = max > 0 ? t.total / max : 0;
                      return (
                        <View key={t.tag} style={styles.tagBarRow}>
                          <Text style={styles.tagRank}>{toCNNumber(i + 1)}</Text>
                          <Text style={styles.tagBarName} numberOfLines={1}>
                            {t.tag}
                          </Text>
                          <View style={styles.tagBarTrack}>
                            <View
                              style={[
                                styles.tagBarFill,
                                { width: `${Math.max(8, ratio * 100)}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.tagBarValue}>{formatMoney(t.total)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              ) : null}

              {/* 每日柱状图 */}
              {barData ? (
                <Card title="每日支出" tape="green">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <BarChart
                      data={barData}
                      width={Math.max(screenWidth - 72, barData.labels.length * 28)}
                      height={200}
                      yAxisLabel="¥"
                      yAxisSuffix=""
                      chartConfig={chartConfig}
                      fromZero
                      showValuesOnTopOfBars
                      style={{ marginVertical: 8, borderRadius: 4 }}
                    />
                  </ScrollView>
                </Card>
              ) : null}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Card({
  title,
  tape,
  children,
}: {
  title: string;
  tape: 'yellow' | 'pink' | 'green' | 'blue';
  children: React.ReactNode;
}) {
  return (
    <View style={styles.px}>
      <PaperCard tape={tape} rotate={0} padding={16} showTape>
        <View style={styles.cardTitleRow}>
          <Tape color={tape} width={14} height={9} rotate={-6} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={{ marginTop: 8 }}>{children}</View>
      </PaperCard>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 12 },
  overviewMonth: {
    fontSize: 13,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  overviewTotal: {
    fontSize: 38,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginVertical: 4,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewItemLabel: { fontSize: 11, color: Colors.inkLight, fontFamily: Fonts.serif },
  overviewItemValue: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 2,
  },
  overviewDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.line,
    opacity: 0.5,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginLeft: 8,
    letterSpacing: 1,
  },
  budgetPct: { fontSize: 15, fontFamily: Fonts.serif, fontWeight: '700' },
  progressBar: {
    height: 7,
    backgroundColor: Colors.lineSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  budgetHint: { fontSize: 11, color: Colors.inkLight, marginTop: 6, fontStyle: 'italic' },
  tagBars: { gap: 10 },
  tagBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagRank: {
    width: 18,
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.stamp,
  },
  tagBarName: { width: 70, fontSize: 13, color: Colors.ink, fontFamily: Fonts.serif },
  tagBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: Colors.lineSoft,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tagBarFill: {
    height: '100%',
    backgroundColor: Colors.ochre,
    borderRadius: 8,
  },
  tagBarValue: {
    width: 60,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: 'right',
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
});
