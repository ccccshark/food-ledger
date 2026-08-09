import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
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

  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
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
        Alert.alert('提示', '还没有任何记录可以导出');
        return;
      }
      await exportRecordsCsv(all);
    } catch (e: any) {
      Alert.alert('导出失败', e?.message ?? '未知错误');
    } finally {
      setExporting(false);
    }
  };

  const onSaveBudget = async () => {
    const v = parseFloat(budgetInput);
    if (isNaN(v) || v < 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    await useLedgerStore.getState().setBudget(v);
    setBudgetModal(false);
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
              onPress={() => {
                setBudgetInput(budget > 0 ? String(budget) : '');
                setBudgetModal(true);
              }}
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

          {/* 落款 */}
          <View style={styles.about}>
            <Stamp text="美食手账" size={64} />
            <Text style={styles.aboutText}>美食记账 · 第一卷</Text>
            <Text style={styles.aboutVersion}>本地优先 · 数据仅存于本机</Text>
          </View>
        </View>

        {/* 预算弹窗 */}
        <Modal visible={budgetModal} transparent animationType="fade">
          <View style={styles.modalMask}>
            <View style={styles.modalCard}>
              <View style={styles.modalTapeWrap}>
                <Tape color="yellow" width={60} height={16} rotate={-5} />
              </View>
              <Text style={styles.modalTitle}>设定月度预算</Text>
              <Text style={styles.modalHint}>设为 0 即关闭预算提醒</Text>
              <View style={styles.modalInputRow}>
                <Text style={styles.modalCurrency}>¥</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.inkLight}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  autoFocus
                />
              </View>
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setBudgetModal(false)}
                >
                  <Text style={styles.modalBtnCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={onSaveBudget}
                >
                  <Text style={styles.modalBtnSaveText}>封存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(61, 46, 31, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: Colors.note,
    borderRadius: 4,
    padding: 22,
    paddingTop: 16,
    width: '100%',
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
  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalHint: {
    fontSize: 11,
    color: Colors.inkLight,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.line,
    paddingBottom: 8,
  },
  modalCurrency: {
    fontSize: 22,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    fontSize: 30,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    padding: 0,
  },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  modalBtnCancel: {
    backgroundColor: Colors.paperLight,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  modalBtnCancelText: { color: Colors.inkSoft, fontSize: 15, fontFamily: Fonts.serif },
  modalBtnSave: {
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  modalBtnSaveText: {
    color: Colors.note,
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
