import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
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
import { t, useT } from '@/constants/i18n';
import { useI18nStore } from '@/stores/i18n';
import type { AppLang } from '@/types';
import * as dao from '@/db';
import {
  exportRecordsCsv,
  backupSqlite,
  exportJournalHtml,
  restoreSqlite,
  importRecordsCsv,
} from '@/utils/export';

const LANG_OPTIONS: AppLang[] = ['zh-CN', 'zh-TW', 'ja'];

export default function ProfileScreen() {
  const { t, lang } = useT();
  const setLang = useI18nStore((s) => s.setLang);
  const budget = useLedgerStore((s) => s.budget);
  const monthlyTotals = useLedgerStore((s) => s.monthlyTotals);
  const refreshBudget = useLedgerStore((s) => s.refreshBudget);
  const refreshMonthlyTotals = useLedgerStore((s) => s.refreshMonthlyTotals);
  const aiConfig = useLedgerStore((s) => s.aiConfig);
  const refreshAiConfig = useLedgerStore((s) => s.refreshAiConfig);
  const books = useLedgerStore((s) => s.books);
  const currentBookId = useLedgerStore((s) => s.currentBookId);
  const refreshBooks = useLedgerStore((s) => s.refreshBooks);
  const setCurrentBook = useLedgerStore((s) => s.setCurrentBook);

  const [exporting, setExporting] = useState<null | 'csv' | 'pdf' | 'db'>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [bookSwitcherVisible, setBookSwitcherVisible] = useState(false);

  useEffect(() => {
    refreshBudget();
    refreshMonthlyTotals();
    refreshAiConfig();
    refreshBooks();
  }, []);

  const currentBook = books.find((b) => b.id === currentBookId);
  const bookKindLabel = (kind?: string): string =>
    kind === 'family'
      ? t('profile.book_kind.family')
      : kind === 'diet'
      ? t('profile.book_kind.diet')
      : t('profile.book_kind.default');
  const TAPE_COLOR_MAP: Record<string, string> = {
    yellow: Colors.tapeYellow,
    pink: Colors.tapePink,
    green: Colors.tapeGreen,
    blue: Colors.tapeBlue,
  };
  type TapeColor = 'yellow' | 'pink' | 'green' | 'blue';
  const bookTape = (c?: string): TapeColor =>
    c === 'pink' || c === 'green' || c === 'blue' ? c : 'yellow';

  const totalAll = monthlyTotals.reduce((s, m) => s + m.total, 0);
  const totalMonths = monthlyTotals.length;

  const runExport = async (
    kind: 'csv' | 'pdf' | 'db',
    fn: () => Promise<void>,
    needRecords = false
  ) => {
    if (exporting) return;
    setExporting(kind);
    try {
      if (needRecords) {
        const all = await dao.listAllRecords();
        if (all.length === 0) {
          showDialog({
            title: t('common.tip'),
            message: t('profile.no_records_export'),
            icon: 'alert-circle-outline',
          });
          return;
        }
        if (kind === 'csv') {
          await exportRecordsCsv(all);
        } else {
          await exportJournalHtml(all);
        }
      } else {
        await fn();
      }
    } catch (e: any) {
      showDialog({
        title: t('profile.export_failed'),
        message: e?.message ?? t('common.unknown_error'),
        icon: 'alert-circle-outline',
      });
    } finally {
      setExporting(null);
    }
  };

  const onExportCsv = () => runExport('csv', () => exportRecordsCsv([]), true);
  const onExportPdf = () => runExport('pdf', () => exportJournalHtml([]), true);
  const onBackupDb = () => runExport('db', () => backupSqlite(), false);

  // 导入数据库：会覆盖现有数据，需二次确认 + 完成后重启数据加载
  const onRestoreDb = () => {
    showDialog({
      title: t('profile.restore_db_title'),
      message: t('profile.restore_db_msg'),
      icon: 'server-outline',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.choose_file_restore'),
          onPress: async () => {
            try {
              await restoreSqlite();
              showDialog({
                title: t('profile.restore_done'),
                message: t('profile.restore_done_msg'),
                icon: 'checkmark-circle-outline',
              });
            } catch (e: any) {
              showDialog({
                title: t('profile.restore_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  // 导入 CSV：逐条追加，不覆盖现有数据
  const onImportCsv = async () => {
    if (exporting) return;
    setExporting('csv');
    try {
      const count = await importRecordsCsv();
      if (count === 0) {
        showDialog({
          title: t('common.tip'),
          message: t('profile.empty_file'),
          icon: 'alert-circle-outline',
        });
        return;
      }
      // 刷新所有数据
      await Promise.all([
        useLedgerStore.getState().refreshToday(),
        useLedgerStore.getState().refreshMonth(),
        useLedgerStore.getState().refreshAllRecords(),
        useLedgerStore.getState().refreshRecentDaily(),
        useLedgerStore.getState().refreshTags(),
        useLedgerStore.getState().refreshLocations(),
        useLedgerStore.getState().refreshMonthCalendar(),
        useLedgerStore.getState().refreshMonthlyTotals(),
      ]);
      showDialog({
        title: t('profile.import_success'),
        message: t('profile.import_success_msg', { n: count }),
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: t('profile.import_failed'),
        message: e?.message ?? t('common.unknown_error'),
        icon: 'alert-circle-outline',
      });
    } finally {
      setExporting(null);
    }
  };

  const onOpenBudget = () => {
    showDialog({
      title: t('profile.set_budget'),
      message: t('profile.set_budget_msg'),
      icon: 'wallet-outline',
      input: {
        placeholder: '0.00',
        value: budget > 0 ? String(budget) : '',
        keyboardType: 'decimal-pad',
        prefix: '¥',
      },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: async () => {
            const raw = useDialogStore.getState().inputValue;
            const v = parseFloat(raw);
            if (isNaN(v) || v < 0) {
              showDialog({
                title: t('common.tip'),
                message: t('profile.invalid_amount'),
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
        <Header title={t('profile.title')} date={t('profile.data_local')} />
        <View style={styles.body}>
          {/* 我的账本（多账本切换） */}
          <PaperCard tape={bookTape(currentBook?.color)} rotate={-0.5} padding={16} showTape>
            <View style={styles.cardTitleRow}>
              <Tape color={bookTape(currentBook?.color)} width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>{t('profile.my_books')}</Text>
              <TouchableOpacity
                style={{ marginLeft: 'auto' }}
                onPress={() => router.push('/books')}
              >
                <Text style={styles.manageLink}>{t('profile.manage')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.currentBookRow}
              onPress={() => setBookSwitcherVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.bookDot, { backgroundColor: TAPE_COLOR_MAP[currentBook?.color ?? 'yellow'] ?? Colors.tapeYellow }]}/>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookName}>{currentBook?.name ?? t('profile.default_book')}</Text>
                <Text style={styles.bookHint}>
                  {t('profile.book_hint', { kind: bookKindLabel(currentBook?.kind) })}
                </Text>
              </View>
              <Ionicons name="swap-horizontal" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 食谱手帐 */}
          <PaperCard tape="green" rotate={0.5} padding={16} showTape>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => router.push('/recipes')}
            >
              <View style={[styles.iconBox, { borderColor: Colors.olive }]}>
                <Ionicons name="book-outline" size={18} color={Colors.olive} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.recipe_journal')}</Text>
                <Text style={styles.rowHint}>{t('profile.recipe_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

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
                <Text style={styles.rowTitle}>{t('profile.monthly_budget')}</Text>
                <Text style={styles.rowHint}>
                  {budget > 0 ? formatMoney(budget) : t('profile.budget_not_set')}
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
                <Text style={styles.rowTitle}>{t('profile.ai_assistant')}</Text>
                <Text style={styles.rowHint}>
                  {aiConfig.enabled
                    ? t('profile.ai_enabled', { model: aiConfig.model })
                    : t('profile.ai_not_enabled')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 累计统计信纸卡 */}
          <PaperCard tape="yellow" rotate={0.5} padding={16} showTape>
            <View style={styles.cardTitleRow}>
              <Tape color="green" width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>{t('profile.cumulative')}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatMoney(totalAll)}</Text>
                <Text style={styles.statLabel}>{t('profile.cumulative_expense')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{toCNNumber(totalMonths)}</Text>
                <Text style={styles.statLabel}>{t('profile.bookkeeping_months')}</Text>
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
              <Text style={styles.cardTitle}>{t('profile.data_mgmt')}</Text>
            </View>

            {/* 导出小节 */}
            <View style={styles.sectionLabelRow}>
              <Ionicons name="download-outline" size={12} color={Colors.inkLight} />
              <Text style={styles.sectionLabel}>{t('profile.export_backup')}</Text>
            </View>

            {/* CSV 账单表格 */}
            <TouchableOpacity
              style={[styles.rowBtn, styles.exportRow]}
              onPress={onExportCsv}
              disabled={exporting !== null}
            >
              <View style={[styles.iconBox, { borderColor: Colors.olive }]}>
                {exporting === 'csv' ? (
                  <ActivityIndicator size="small" color={Colors.olive} />
                ) : (
                  <Ionicons name="grid-outline" size={18} color={Colors.olive} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.export_csv')}</Text>
                <Text style={styles.rowHint}>{t('profile.export_csv_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>

            <DashedDivider />

            {/* PDF 手帐 */}
            <TouchableOpacity
              style={[styles.rowBtn, styles.exportRow]}
              onPress={onExportPdf}
              disabled={exporting !== null}
            >
              <View style={[styles.iconBox, { borderColor: Colors.stamp }]}>
                {exporting === 'pdf' ? (
                  <ActivityIndicator size="small" color={Colors.stamp} />
                ) : (
                  <Ionicons name="book-outline" size={18} color={Colors.stamp} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.export_pdf')}</Text>
                <Text style={styles.rowHint}>{t('profile.export_pdf_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>

            <DashedDivider />

            {/* SQLite 整库备份 */}
            <TouchableOpacity
              style={[styles.rowBtn, styles.exportRow]}
              onPress={onBackupDb}
              disabled={exporting !== null}
            >
              <View style={[styles.iconBox, { borderColor: Colors.ochre }]}>
                {exporting === 'db' ? (
                  <ActivityIndicator size="small" color={Colors.ochre} />
                ) : (
                  <Ionicons name="server-outline" size={18} color={Colors.ochre} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.backup_db')}</Text>
                <Text style={styles.rowHint}>{t('profile.backup_db_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>

            {/* 导入小节 */}
            <View style={[styles.sectionLabelRow, { marginTop: 14 }]}>
              <Ionicons name="cloud-upload-outline" size={12} color={Colors.inkLight} />
              <Text style={styles.sectionLabel}>{t('profile.import_restore')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.rowBtn, styles.exportRow]}
              onPress={onImportCsv}
              disabled={exporting !== null}
            >
              <View style={[styles.iconBox, { borderColor: Colors.olive }]}>
                {exporting === 'csv' ? (
                  <ActivityIndicator size="small" color={Colors.olive} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={Colors.olive} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.import_csv')}</Text>
                <Text style={styles.rowHint}>{t('profile.import_csv_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>

            <DashedDivider />

            <TouchableOpacity
              style={[styles.rowBtn, styles.exportRow]}
              onPress={onRestoreDb}
              disabled={exporting !== null}
            >
              <View style={[styles.iconBox, { borderColor: Colors.ochre }]}>
                <Ionicons name="server-outline" size={18} color={Colors.ochre} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('profile.restore_db')}</Text>
                <Text style={styles.rowHint}>{t('profile.restore_db_hint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 语言切换入口 */}
          <PaperCard tape="green" rotate={0.5} padding={16} showTape>
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => {
                showDialog({
                  title: t('lang.title'),
                  buttons: LANG_OPTIONS.map((l) => ({
                    text: t(`lang.${l}`),
                    style: l === lang ? ('default' as const) : ('cancel' as const),
                    onPress: () => setLang(l),
                  })),
                });
              }}
            >
              <View style={[styles.iconBox, { borderColor: Colors.olive }]}>
                <Ionicons name="language-outline" size={18} color={Colors.olive} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('lang.title')}</Text>
                <Text style={styles.rowHint}>{t(`lang.${lang}`)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            </TouchableOpacity>
          </PaperCard>

          {/* 关于（折叠式） */}
          <PaperCard tape="pink" rotate={0.5} padding={16} showTape>
            <TouchableOpacity
              style={styles.aboutHeader}
              onPress={() => setAboutExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Tape color="pink" width={14} height={9} rotate={-6} />
              <Text style={styles.cardTitle}>{t('profile.about')}</Text>
              <Text style={styles.aboutVersionTag}>v1.3.0</Text>
              <Ionicons
                name={aboutExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.inkLight}
              />
            </TouchableOpacity>
            {aboutExpanded ? (
              <>
                <Text style={styles.aboutIntro}>
                  {t('profile.about_intro')}
                </Text>
                <DashedDivider />
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>{t('profile.version')}</Text>
                  <Text style={styles.aboutVal}>{t('profile.version_val')}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>{t('profile.storage')}</Text>
                  <Text style={styles.aboutVal}>{t('profile.storage_val')}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>{t('profile.ai_label')}</Text>
                  <Text style={styles.aboutVal}>{t('profile.ai_val')}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>{t('profile.privacy')}</Text>
                  <Text style={styles.aboutVal}>{t('profile.privacy_val')}</Text>
                </View>
              </>
            ) : null}
          </PaperCard>

          {/* 落款 */}
          <View style={styles.about}>
            <Stamp text="味笺" size={64} />
            <Text style={styles.aboutText}>{t('profile.signature')}</Text>
            <Text style={styles.aboutVersion}>{t('profile.local_first')}</Text>
          </View>
        </View>

        {/* 账本切换弹层 */}
        <Modal visible={bookSwitcherVisible} transparent animationType="fade" onRequestClose={() => setBookSwitcherVisible(false)}>
          <Pressable style={styles.bookSwitcherOverlay} onPress={() => setBookSwitcherVisible(false)}>
            <Pressable style={styles.bookSwitcherSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.bookSwitcherHead}>
                <Text style={styles.bookSwitcherTitle}>{t('profile.book_switcher_title')}</Text>
                <TouchableOpacity onPress={() => setBookSwitcherVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.ink} />
                </TouchableOpacity>
              </View>
              <Text style={styles.bookSwitcherHint}>{t('profile.book_switcher_hint')}</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {books.map((b) => {
                  const active = b.id === currentBookId;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.bookOption, active && styles.bookOptionActive]}
                      onPress={async () => {
                        setBookSwitcherVisible(false);
                        await setCurrentBook(b.id);
                      }}
                    >
                      <View style={[styles.bookDot, { backgroundColor: TAPE_COLOR_MAP[b.color] ?? Colors.tapeYellow }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookOptionName}>{b.name}</Text>
                        <Text style={styles.bookOptionKind}>{t('profile.book_kind_label', { kind: bookKindLabel(b.kind) })}</Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.olive} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={styles.bookSwitcherFooter}
                onPress={() => {
                  setBookSwitcherVisible(false);
                  router.push('/books');
                }}
              >
                <Ionicons name="settings-outline" size={16} color={Colors.inkSoft} />
                <Text style={styles.bookSwitcherFooterText}>{t('profile.manage_books')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
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
  exportRow: {
    paddingVertical: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    letterSpacing: 1,
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
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutVersionTag: {
    flex: 1,
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    marginLeft: 8,
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
  manageLink: {
    fontSize: 12,
    color: Colors.ochre,
    fontFamily: Fonts.serif,
    letterSpacing: 1,
  },
  currentBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bookDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  bookName: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  bookHint: {
    fontSize: 11,
    color: Colors.inkLight,
    marginTop: 2,
    fontStyle: 'italic',
  },
  bookSwitcherOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bookSwitcherSheet: {
    width: '100%',
    backgroundColor: Colors.note,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    padding: 18,
    maxHeight: 480,
  },
  bookSwitcherHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookSwitcherTitle: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  bookSwitcherHint: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  bookOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.lineSoft,
  },
  bookOptionActive: {
    backgroundColor: Colors.paperLight,
    borderRadius: 6,
  },
  bookOptionName: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
  },
  bookOptionKind: {
    fontSize: 11,
    color: Colors.inkLight,
    marginTop: 2,
  },
  bookSwitcherFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.lineSoft,
  },
  bookSwitcherFooterText: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    letterSpacing: 1,
  },
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
