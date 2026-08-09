import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  SectionList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { Colors, Fonts, Meals, formatMoney, monthLabelCN, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider, InkDot } from '@/components/Decorations';
import type { MealType, LedgerRecord as Rec } from '@/types';

interface MonthGroup {
  month: string;
  data: Rec[];
  total: number;
}

export default function RecordsScreen() {
  const allRecords = useLedgerStore((s) => s.allRecords);
  const refreshAllRecords = useLedgerStore((s) => s.refreshAllRecords);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshAllRecords();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllRecords();
    setRefreshing(false);
  };

  const sections = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, Rec[]>();
    for (const r of allRecords) {
      const m = r.date.slice(0, 7);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, data]) => ({
        month,
        data,
        total: data.reduce((s, r) => s + r.amount, 0),
      }));
  }, [allRecords]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header
          title="账目册"
          date="逐笔登账"
          rightLabel="记一笔"
          onRight={() => router.push('/add')}
        />

        <SectionList
          style={styles.list}
          sections={sections}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecordItem r={item} />
          )}
          renderSectionHeader={({ section }) => <MonthHeader section={section} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={
            sections.length === 0 ? styles.emptyList : { paddingBottom: 24 }
          }
          ListEmptyComponent={
            <Empty
              icon="receipt-outline"
              text="账本尚空"
              hint="开始记录你的第一笔美食支出吧"
              actionLabel="记一笔"
              onAction={() => router.push('/add')}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      </SafeAreaView>
    </PaperBackground>
  );
}

function MonthHeader({ section }: { section: MonthGroup }) {
  const [y, m] = section.month.split('-').map(Number);
  return (
    <View style={styles.monthHeader}>
      <PaperCard tape="yellow" rotate={-1} padding={12} showTape style={styles.monthCard}>
        <View style={styles.monthHeadRow}>
          <View>
            <Text style={styles.monthTitle}>
              {toCNNumber(y)}年{toCNNumber(m)}月
            </Text>
            <Text style={styles.monthSub}>共 {section.data.length} 笔</Text>
          </View>
          <View style={styles.monthTotalBox}>
            <Text style={styles.monthTotalLabel}>小计</Text>
            <Text style={styles.monthTotal}>{formatMoney(section.total)}</Text>
          </View>
        </View>
      </PaperCard>
    </View>
  );
}

function RecordItem({ r }: { r: Rec }) {
  const meal = Meals[r.meal as MealType];
  const tags = r.tags ? r.tags.split(',').filter(Boolean) : [];
  const [, m, d] = r.date.split('-').map(Number);
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push({ pathname: '/add', params: { id: String(r.id) } })}
    >
      {/* 日期竖排 */}
      <View style={styles.dateCol}>
        <Text style={styles.dayNum}>{d}</Text>
        <Text style={styles.dayMonth}>{toCNNumber(m)}月</Text>
      </View>
      <View style={styles.dateLine} />
      <View style={[styles.mealIcon, { borderColor: meal.color }]}>
        <Ionicons name="restaurant" size={14} color={meal.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.itemRow}>
          <Text style={styles.itemMeal}>{meal.label}</Text>
          {tags.slice(0, 2).map((t) => (
            <View key={t} style={[styles.itemTag, { borderColor: meal.color }]}>
              <Text style={[styles.itemTagText, { color: meal.color }]}>{t}</Text>
            </View>
          ))}
        </View>
        {r.note ? (
          <Text style={styles.itemNote} numberOfLines={1}>
            {r.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemAmount}>¥{r.amount.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.itemShare}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() =>
            router.push({ pathname: '/share', params: { id: String(r.id) } })
          }
        >
          <Ionicons name="share-outline" size={16} color={Colors.inkLight} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { flex: 1, paddingHorizontal: 18 },
  emptyList: { flex: 1 },
  monthHeader: {
    paddingVertical: 8,
  },
  monthCard: {},
  monthHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  monthSub: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  monthTotalBox: { alignItems: 'flex-end' },
  monthTotalLabel: { fontSize: 10, color: Colors.inkLight, fontFamily: Fonts.serif },
  monthTotal: {
    fontSize: 20,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.stamp,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.note,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  dateCol: { width: 30, alignItems: 'center' },
  dayNum: { fontSize: 18, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink },
  dayMonth: { fontSize: 9, color: Colors.inkLight, marginTop: 2, fontFamily: Fonts.serif },
  dateLine: {
    width: 1,
    height: 28,
    backgroundColor: Colors.line,
    opacity: 0.5,
  },
  mealIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemMeal: { fontSize: 14, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  itemTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  itemTagText: { fontSize: 10, fontFamily: Fonts.serif },
  itemNote: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemAmount: { fontSize: 15, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink },
  itemShare: {
    padding: 4,
    borderRadius: 4,
  },
  sep: { height: 0 },
});
