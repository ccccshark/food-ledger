import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { showDialog, useDialogStore } from '@/stores/dialog';
import { Colors, Fonts, formatMoney, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider, Stamp } from '@/components/Decorations';
import * as dao from '@/db';
import { exportRecordsCsv } from '@/utils/export';

export default function ProfileScreen() {
  const budget = useLedgerStore((s) => s.budget);
  const monthlyTotals = useLedgerStore((s) => s.monthlyTotals);
  const refreshBudget = useLedgerStore((s) => s.refreshBudget);
  const refreshMonthlyTotals = useLedgerStore((s) => s.refreshMonthlyTotals);
  const aiConfig = useLedgerStore((s) => s.aiConfig);
  const refreshAiConfig = useLedgerStore((s) => s.refreshAiConfig);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    refreshBudget();
    refreshMonthlyTotals();
    refreshAiConfig();
  }, []);

  const totalAll = monthlyTotals.reduce((s, m) => s + m.total, 0);
  const totalMonths = monthlyTotals.length;

  const onExport = async () => {
    setExporting(true);
    try {
      const all = await dao.listAllRecords();
      if (all.length === 0) {
        showDialog({
          title: '提示',
          message: '还没有任何记录可以导出',
          icon: 'alert-circle-outline',
        });
        return;
      }
      await exportRecordsCsv(all);
    } catch (e: any) {
      showDialog({
        title: '导出失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setExporting(false);
    }
  };

  const onOpenBudget = () => {
    showDialog({
      title: '设定月度预算',
      message: '设为 0 即关闭预算提醒',
      icon: 'wallet-outline',
      input: {
        placeholder: '0.00',
        value: budget > 0 ? String(budget) : '',
        keyboardType: 'decimal-pad',
        prefix: '¥',
      },
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '保存',
          onPress: async () => {
            const raw = useDialogStore.getState().inputValue;
            const v = parseFloat(raw);
            if (isNaN(v) || v < 0) {
              showDialog({
                title: '提示',
                message: '请输入有效金额',
                icon: 'alert-circle-outline',
              });
              return;
            }
            await useLedgerStore.getState().setBudget(v);
          },
        },
      ],
    });
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="我的手账" date="数据存于本机" />
        <View style={styles.body}>
          {/* 预算 */}
          <PaperCard tape="pink" rotate={-0.5} padding={16} showTape>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={onOpenBudget}
            >
              <View style={[styles.iconBox, { borderColor: Colors.stamp }]}>
                <Ionicons name="wallet-outline" size={18} color={Colors.stamp} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>月度预算</Text>
                <Text style={styles.rowHint}>
                  {budget > 0 ? formatMoney(budget) : '未设置 · 点击设定'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* AI 助手 */}
          <PaperCard tape="yellow" rotate={0.5} padding={16} showTape>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => router.push('/ai-settings')}
            >
              <View style={[styles.iconBox, { borderColor: Colors.ochre }]}>
                <Ionicons name="sparkles" size={18} color={Colors.ochre} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>AI 助手</Text>
                <Text style={styles.rowHint}>
                  {aiConfig.enabled
                    ? `已启用 · ${aiConfig.model}`
                    : '未启用 · 点击配置识别'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 累计统计信纸卡 */}
          <PaperCard tape="yellow" rotate={0.5} padding={16} showTape>
            <View style={styles.cardTitleRow}>
              <Tape color="green" width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>累计所记</Text>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatMoney(totalAll)}</Text>
                <Text style={styles.statLabel}>累计支出</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{toCNNumber(totalMonths)}</Text>
                <Text style={styles.statLabel}>记账月数</Text>
              </View>
            </View>

            {monthlyTotals.length > 0 ? (
              <>
                <DashedDivider />
                <View style={styles.historyList}>
                  {monthlyTotals.slice(0, 6).map((m) => {
                    const [y, mm] = m.month.split('-').map(Number);
                    return (
                      <View key={m.month} style={styles.historyRow}>
                        <Text style={styles.historyMonth}>
                          {toCNNumber(y)}年{toCNNumber(mm)}月
                        </Text>
                        <View style={styles.historyDots} />
                        <Text style={styles.historyTotal}>{formatMoney(m.total)}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </PaperCard>

          {/* 数据管理 */}
          <PaperCard tape="blue" rotate={-0.5} padding={16} showTape>
            <View style={styles.cardTitleRow}>
              <Tape color="blue" width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>数据管理</Text>
            </View>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={onExport}
              disabled={exporting}
            >
              <View style={[styles.iconBox, { borderColor: Colors.olive }]}>
                {exporting ? (
                  <ActivityIndicator size="small" color={Colors.olive} />
                ) : (
                  <Ionicons name="download-outline" size={18} color={Colors.olive} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>导出 CSV</Text>
                <Text style={styles.rowHint}>导出全部记录到文件</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 关于 */}
          <PaperCard tape="pink" rotate={0.5} padding={16} showTape>
            <View style={styles.cardTitleRow}>
              <Tape color="pink" width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>关于</Text>
            </View>
            <Text style={styles.aboutIntro}>
              味笺是一本属于你的本地美食记账本。用拍立得、胶带贴图、邮票、手绘框记录每一餐，用双列贴图墙留住美味足迹。
            </Text>
            <DashedDivider />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>版本</Text>
              <Text style={styles.aboutVal}>v1.2.0 · 味笺</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>存储</Text>
              <Text style={styles.aboutVal}>本地 SQLite · 仅存于本机</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>AI</Text>
              <Text style={styles.aboutVal}>可选启用 · 识别美食 / 抠图 / 账单</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutKey}>隐私</Text>
              <Text style={styles.aboutVal}>数据不会上传任何服务器</Text>
            </View>
          </PaperCard>

          {/* 落款 */}
          <View style={styles.about}>
            <Stamp text="味笺" size={64} />
            <Text style={styles.aboutText}>味笺 · 第一卷</Text>
            <Text style={styles.aboutVersion}>本地优先 · 数据仅存于本机</Text>
          </View>
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 4 },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
  },
  rowTitle: { fontSize: 15, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  rowHint: { fontSize: 12, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginLeft: 8,
    letterSpacing: 1,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1 },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  statLabel: { fontSize: 12, color: Colors.inkLight, marginTop: 2, fontFamily: Fonts.serif },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.line,
    opacity: 0.5,
    marginHorizontal: 8,
  },
  historyList: { paddingTop: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  historyMonth: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif },
  historyDots: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dotted,
    borderStyle: 'dotted',
    marginHorizontal: 8,
    opacity: 0.5,
  },
  historyTotal: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  about: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  aboutText: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif },
  aboutVersion: { fontSize: 11, color: Colors.inkLight, fontStyle: 'italic' },
  aboutIntro: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    lineHeight: 19,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  aboutKey: {
    fontSize: 12,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    width: 40,
  },
  aboutVal: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    flex: 1,
  },
});
