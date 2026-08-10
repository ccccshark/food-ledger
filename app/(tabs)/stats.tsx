import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLedgerStore } from '@/stores/ledger';
import {
  Colors,
  Fonts,
  Meals,
  formatMoney,
  toCNNumber,
} from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider } from '@/components/Decorations';
import { DonutChart, DonutLegend, MiniBarChart, DonutSegment } from '@/components/DonutChart';
import { MEAL_ORDER } from '@/types';
import { t, useT, MEAL_T_KEY } from '@/constants/i18n';
import type { MealType } from '@/types';

export default function StatsScreen() {
  const { lang } = useT();
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

  // 餐次占比圆盘数据
  const donutData: DonutSegment[] = useMemo(() => {
    if (!monthSummary) return [];
    return MEAL_ORDER.filter((m) => monthSummary.byMeal[m] > 0).map((m) => ({
      label: t(MEAL_T_KEY[m]),
      value: monthSummary.byMeal[m],
      color: Meals[m].color,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthSummary, lang]);

  // 每日柱状图数据
  const barData = useMemo(() => {
    if (!monthRecords.length) return [];
    const byDay = new Map<number, number>();
    for (const r of monthRecords) {
      const day = Number(r.date.slice(8, 10));
      byDay.set(day, (byDay.get(day) ?? 0) + r.amount);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, value]) => ({ label: String(day), value }));
  }, [monthRecords]);

  const monthTotal = monthSummary?.total ?? 0;
  const monthCount = monthSummary?.count ?? 0;
  const avgPerRecord = monthCount > 0 ? monthTotal / monthCount : 0;
  const daysWithRecords = new Set(monthRecords.map((r) => r.date)).size;
  const avgPerDay = daysWithRecords > 0 ? monthTotal / daysWithRecords : 0;
  const budgetUsed = budget > 0 ? Math.min(100, (monthTotal / budget) * 100) : 0;
  const budgetLeft = budget > 0 ? Math.max(0, budget - monthTotal) : 0;
  const hasData = monthCount > 0;
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // 最高单日支出
  const maxDaySpending = useMemo(() => {
    if (!barData.length) return null;
    return barData.reduce((max, d) => (d.value > max.value ? d : max), barData[0]);
  }, [barData]);

  // 极简文字总结：本月最贵一餐 / 高频消费品类 / 日均开销
  const brief = useMemo(() => {
    if (!monthRecords.length) return null;
    // 最贵一餐
    const dearest = [...monthRecords].sort((a, b) => b.amount - a.amount)[0];
    const dearestMeal = t(MEAL_T_KEY[dearest.meal as MealType]);
    const dearestNote = dearest.note
      ? dearest.note.slice(0, 12).replace(/\n/g, ' ')
      : dearest.location_name?.slice(0, 12) ?? '';
    // 高频品类（标签）
    const tagCount = new Map<string, number>();
    for (const r of monthRecords) {
      if (!r.tags) continue;
      for (const tg of r.tags.split(',').filter(Boolean)) {
        tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1);
      }
    }
    const topTagEntry = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0];
    const topTag = topTagEntry ? topTagEntry[0] : null;
    const topTagCount = topTagEntry ? topTagEntry[1] : 0;
    // 高频餐次
    const mealCount: Record<string, number> = {};
    for (const r of monthRecords) {
      mealCount[r.meal] = (mealCount[r.meal] ?? 0) + 1;
    }
    const topMealEntry = Object.entries(mealCount).sort((a, b) => b[1] - a[1])[0];
    const topMeal = topMealEntry ? t(MEAL_T_KEY[topMealEntry[0] as MealType]) : null;
    return {
      dearest,
      dearestMeal,
      dearestNote,
      topTag,
      topTagCount,
      topMeal,
      avgPerDay,
      daysWithRecords,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRecords, avgPerDay, daysWithRecords, lang]);

  const monthCN = monthSummary?.month
    ? (() => {
        const [y, m] = monthSummary.month.split('-').map(Number);
        return `${toCNNumber(y)}年${toCNNumber(m)}月`;
      })()
    : '';

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title={t('stats.title')} date={monthCN} />
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 月度总览 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={-0.5} padding={20} showTape>
              <Text style={styles.overviewMonth}>{monthCN} · {t('stats.review')}</Text>
              <View style={styles.overviewTotalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overviewTotalLabel}>{t('stats.month_expense')}</Text>
                  <Text style={styles.overviewTotal}>{formatMoney(monthTotal)}</Text>
                </View>
                <View style={styles.overviewCountBox}>
                  <Text style={styles.overviewCount}>{monthCount}</Text>
                  <Text style={styles.overviewCountLabel}>{t('stats.count_unit')}</Text>
                </View>
              </View>
              <DashedDivider />
              <View style={styles.overviewRow}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemValue}>{formatMoney(avgPerRecord)}</Text>
                  <Text style={styles.overviewItemLabel}>{t('stats.per_record')}</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemValue}>{formatMoney(avgPerDay)}</Text>
                  <Text style={styles.overviewItemLabel}>{t('stats.per_day')}</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewItemValue}>{daysWithRecords}</Text>
                  <Text style={styles.overviewItemLabel}>{t('stats.days_with_record')}</Text>
                </View>
              </View>
            </PaperCard>
          </View>

          {/* 预算环（类苹果活动圆环） */}
          {budget > 0 ? (
            <View style={styles.px}>
              <PaperCard tape="green" rotate={0.5} padding={18} showTape>
                <View style={styles.cardTitleRow}>
                  <Tape color="yellow" width={14} height={9} rotate={-6} />
                  <Text style={styles.cardTitle}>{t('stats.budget_progress')}</Text>
                </View>
                <View style={styles.budgetRingRow}>
                  <DonutChart
                    data={[
                      {
                        label: t('stats.used'),
                        value: monthTotal,
                        color: budgetUsed >= 100 ? Colors.danger : Colors.olive,
                      },
                    ]}
                    size={120}
                    strokeWidth={14}
                    centerLabel={t('stats.used')}
                    centerValue={`${budgetUsed.toFixed(0)}%`}
                    centerSub={t('stats.budget_sub', { n: formatMoney(budget) })}
                  />
                  <View style={styles.budgetInfoCol}>
                    <View style={styles.budgetInfoItem}>
                      <Text style={styles.budgetInfoLabel}>{t('stats.spent')}</Text>
                      <Text style={[styles.budgetInfoValue, { color: Colors.ink }]}>
                        {formatMoney(monthTotal)}
                      </Text>
                    </View>
                    <View style={styles.budgetInfoItem}>
                      <Text style={styles.budgetInfoLabel}>
                        {budgetLeft > 0 ? t('stats.remaining') : t('stats.over')}
                      </Text>
                      <Text
                        style={[
                          styles.budgetInfoValue,
                          { color: budgetLeft > 0 ? Colors.olive : Colors.danger },
                        ]}
                      >
                        {formatMoney(Math.abs(budgetLeft || monthTotal - budget))}
                      </Text>
                    </View>
                  </View>
                </View>
              </PaperCard>
            </View>
          ) : null}

          {!hasData ? (
            <Empty
              icon="bar-chart-outline"
              text={t('stats.empty_text')}
              hint={t('stats.empty_hint')}
            />
          ) : (
            <>
              {/* 餐次占比圆盘 */}
              {donutData.length > 0 ? (
                <View style={styles.px}>
                  <PaperCard tape="yellow" rotate={0} padding={18} showTape>
                    <View style={styles.cardTitleRow}>
                      <Tape color="pink" width={14} height={9} rotate={-6} />
                      <Text style={styles.cardTitle}>{t('stats.meal_dist')}</Text>
                    </View>
                    <View style={styles.donutRow}>
                      <DonutChart
                        data={donutData}
                        size={180}
                        strokeWidth={26}
                        centerLabel={t('stats.total_expense')}
                        centerValue={`¥${monthTotal.toFixed(0)}`}
                        centerSub={t('stats.count_summary', { n: monthCount })}
                      />
                    </View>
                    <DonutLegend data={donutData} total={donutTotal} />
                  </PaperCard>
                </View>
              ) : null}

              {/* 每日柱状图 */}
              {barData.length > 0 ? (
                <View style={styles.px}>
                  <PaperCard tape="blue" rotate={0} padding={16} showTape>
                    <View style={styles.cardTitleRow}>
                      <Tape color="green" width={14} height={9} rotate={-6} />
                      <Text style={styles.cardTitle}>{t('stats.daily_expense')}</Text>
                      {maxDaySpending ? (
                        <Text style={styles.cardSub}>
                          {t('stats.max_day', { day: maxDaySpending.label, amount: maxDaySpending.value.toFixed(0) })}
                        </Text>
                      ) : null}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <MiniBarChart data={barData} height={130} />
                    </ScrollView>
                  </PaperCard>
                </View>
              ) : null}

              {/* 标签排行 */}
              {monthSummary && monthSummary.topTags.length > 0 ? (
                <View style={styles.px}>
                  <PaperCard tape="pink" rotate={0} padding={16} showTape>
                    <View style={styles.cardTitleRow}>
                      <Tape color="blue" width={14} height={9} rotate={-6} />
                      <Text style={styles.cardTitle}>{t('stats.tag_rank')}</Text>
                    </View>
                    <View style={styles.tagBars}>
                      {monthSummary.topTags.map((tg, i) => {
                        const max = monthSummary.topTags[0].total;
                        const ratio = max > 0 ? tg.total / max : 0;
                        return (
                          <View key={tg.tag} style={styles.tagBarRow}>
                            <Text style={styles.tagRank}>{toCNNumber(i + 1)}</Text>
                            <Text style={styles.tagBarName} numberOfLines={1}>
                              {tg.tag}
                            </Text>
                            <View style={styles.tagBarTrack}>
                              <View
                                style={[
                                  styles.tagBarFill,
                                  {
                                    width: `${Math.max(8, ratio * 100)}%`,
                                    backgroundColor:
                                      i === 0 ? Colors.stamp : i === 1 ? Colors.ochre : Colors.olive,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.tagBarValue}>{formatMoney(tg.total)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </PaperCard>
                </View>
              ) : null}

              {/* 极简文字总结 */}
              {brief ? (
                <View style={styles.px}>
                  <PaperCard tape="yellow" rotate={0} padding={16} showTape>
                    <View style={styles.cardTitleRow}>
                      <Tape color="pink" width={14} height={9} rotate={-6} />
                      <Text style={styles.cardTitle}>{t('stats.month_brief')}</Text>
                    </View>
                    <View style={styles.briefBox}>
                      <Text style={styles.briefLine}>
                        <Text style={styles.briefBullet}>·</Text>
                        <Text style={styles.briefKey}> {t('stats.dearest')} </Text>
                        <Text style={styles.briefVal}>
                          {brief.dearestMeal} ¥{brief.dearest.amount.toFixed(2)}
                        </Text>
                        {brief.dearestNote ? (
                          <Text style={styles.briefNote}> · {brief.dearestNote}</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.briefLine}>
                        <Text style={styles.briefBullet}>·</Text>
                        <Text style={styles.briefKey}> {t('stats.top_category')} </Text>
                        <Text style={styles.briefVal}>
                          {brief.topTag
                            ? t('stats.tag_count', { tag: brief.topTag, n: brief.topTagCount })
                            : brief.topMeal
                            ? t('stats.top_meal_main', { n: brief.topMeal })
                            : t('stats.no_tag')}
                        </Text>
                      </Text>
                      <Text style={styles.briefLine}>
                        <Text style={styles.briefBullet}>·</Text>
                        <Text style={styles.briefKey}> {t('stats.daily_avg')} </Text>
                        <Text style={styles.briefVal}>{formatMoney(brief.avgPerDay)}</Text>
                        <Text style={styles.briefNote}>
                          {' '}· {t('stats.days_with_record_count', { n: brief.daysWithRecords })}
                        </Text>
                      </Text>
                    </View>
                  </PaperCard>
                </View>
              ) : null}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 14 },

  // 总览
  overviewMonth: {
    fontSize: 12,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  overviewTotalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  overviewTotalLabel: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.serif },
  overviewTotal: {
    fontSize: 36,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 2,
  },
  overviewCountBox: {
    alignItems: 'flex-end',
  },
  overviewCount: {
    fontSize: 28,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.stamp,
  },
  overviewCountLabel: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewItemLabel: { fontSize: 11, color: Colors.inkLight, fontFamily: Fonts.serif },
  overviewItemValue: {
    fontSize: 16,
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

  // 通用卡片标题
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginLeft: 8,
    letterSpacing: 1,
    flex: 1,
  },
  cardSub: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },

  // 预算环
  budgetRingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  budgetInfoCol: {
    flex: 1,
    gap: 14,
  },
  budgetInfoItem: {},
  budgetInfoLabel: { fontSize: 11, color: Colors.inkLight, fontFamily: Fonts.serif },
  budgetInfoValue: {
    fontSize: 20,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    marginTop: 2,
  },

  // 圆盘
  donutRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },

  // 标签排行
  tagBars: { gap: 10 },
  tagBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagRank: {
    width: 18,
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.stamp,
  },
  tagBarName: { width: 64, fontSize: 13, color: Colors.ink, fontFamily: Fonts.serif },
  tagBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: Colors.lineSoft,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tagBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  tagBarValue: {
    width: 56,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: 'right',
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },

  // 极简文字小结
  briefBox: {
    gap: 10,
    paddingLeft: 2,
  },
  briefLine: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    color: Colors.inkSoft,
    lineHeight: 20,
  },
  briefBullet: {
    color: Colors.stamp,
    fontWeight: '700',
    marginRight: 4,
  },
  briefKey: {
    color: Colors.inkLight,
    fontSize: 12,
  },
  briefVal: {
    color: Colors.ink,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  briefNote: {
    color: Colors.inkLight,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
