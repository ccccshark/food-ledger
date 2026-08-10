import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { showDialog, useDialogStore } from '@/stores/dialog';
import { Colors, Fonts } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape } from '@/components/Decorations';
import { t, useT } from '@/constants/i18n';
import type { Book, BookKind } from '@/types';

const KIND_T_KEY: Record<BookKind, string> = {
  default: 'books.kind.default',
  family: 'books.kind.family',
  diet: 'books.kind.diet',
};

type TapeColor = 'yellow' | 'pink' | 'green' | 'blue';

function kindColor(kind: BookKind): string {
  switch (kind) {
    case 'family':
      return Colors.berry;
    case 'diet':
      return Colors.olive;
    default:
      return Colors.ochre;
  }
}

export default function BooksScreen() {
  useT(); // subscribe to lang changes for re-render
  const books = useLedgerStore((s) => s.books);
  const currentBookId = useLedgerStore((s) => s.currentBookId);
  const refreshBooks = useLedgerStore((s) => s.refreshBooks);
  const setCurrentBook = useLedgerStore((s) => s.setCurrentBook);
  const addBook = useLedgerStore((s) => s.addBook);
  const updateBook = useLedgerStore((s) => s.updateBook);
  const deleteBook = useLedgerStore((s) => s.deleteBook);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshBooks();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBooks();
    setRefreshing(false);
  };

  const onSelect = async (id: number) => {
    if (id === currentBookId) return;
    await setCurrentBook(id);
  };

  const onAdd = () => {
    showDialog({
      title: t('books.add_title'),
      message: t('books.add_msg'),
      icon: 'book-outline',
      input: { placeholder: t('books.add_placeholder'), value: '' },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('books.create'),
          onPress: async () => {
            const raw = useDialogStore.getState().inputValue;
            const n = raw.trim();
            if (!n) {
              showDialog({
                title: t('common.tip'),
                message: t('books.fill_name'),
                icon: 'alert-circle-outline',
              });
              return;
            }
            try {
              await addBook({ name: n, kind: 'default', color: 'yellow' });
            } catch (e: any) {
              showDialog({
                title: t('books.create_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const onEditName = (book: Book) => {
    showDialog({
      title: t('books.edit_title'),
      message: t('books.edit_msg'),
      icon: 'create-outline',
      input: { placeholder: t('books.edit_placeholder'), value: book.name },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: async () => {
            const raw = useDialogStore.getState().inputValue;
            const n = raw.trim();
            if (!n) {
              showDialog({
                title: t('common.tip'),
                message: t('books.fill_name'),
                icon: 'alert-circle-outline',
              });
              return;
            }
            try {
              await updateBook(book.id, { name: n });
            } catch (e: any) {
              showDialog({
                title: t('books.save_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const onDelete = (book: Book) => {
    showDialog({
      title: t('books.delete_title'),
      message: t('books.delete_msg', { name: book.name }),
      icon: 'trash-outline',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBook(book.id);
            } catch (e: any) {
              showDialog({
                title: t('books.delete_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const onLongPress = (book: Book) => {
    showDialog({
      title: book.name,
      message: t('books.select_action'),
      icon: 'book-outline',
      buttons: [
        { text: t('books.edit_name'), onPress: () => onEditName(book) },
        { text: t('books.delete_book'), style: 'destructive', onPress: () => onDelete(book) },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  const renderItem = ({ item, index }: { item: Book; index: number }) => {
    const isCurrent = item.id === currentBookId;
    const tape = (item.color as TapeColor) || 'yellow';
    const rotate = index % 2 === 0 ? 0.5 : -0.5;
    const tint = kindColor(item.kind);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSelect(item.id)}
        onLongPress={() => onLongPress(item)}
      >
        <PaperCard tape={tape} rotate={rotate} padding={16} showTape>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.bookName} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.kindTag, { borderColor: tint }]}>
                  <Text style={[styles.kindText, { color: tint }]}>
                    {t(KIND_T_KEY[item.kind])}
                  </Text>
                </View>
              </View>
              <Text style={styles.bookHint}>
                {isCurrent ? t('books.in_use') : t('books.tap_switch')}
              </Text>
            </View>
            {isCurrent ? (
              <View style={styles.currentMark}>
                <Ionicons name="checkmark-circle" size={28} color={Colors.olive} />
                <Text style={styles.currentText}>{t('books.using')}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.inkLight} />
            )}
          </View>
        </PaperCard>
      </TouchableOpacity>
    );
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="green" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>{t('books.title')}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.dateLine}>{t('books.subtitle')}</Text>

        <FlatList
          style={styles.list}
          data={books}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            books.length === 0
              ? styles.emptyList
              : { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 96, gap: 16 }
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCircle}>
                <Ionicons name="book-outline" size={40} color={Colors.inkLight} />
              </View>
              <Text style={styles.emptyText}>{t('books.empty_text')}</Text>
              <Text style={styles.emptyHint}>{t('books.empty_hint')}</Text>
            </View>
          }
        />

        {/* 新建账本 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.addBookBtn} onPress={onAdd}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.note} />
            <Text style={styles.addBookText}>{t('books.add')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { padding: 8 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  dateLine: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 12,
  },
  list: { flex: 1 },
  emptyList: { flex: 1 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookName: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  kindTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  kindText: { fontSize: 10, fontFamily: Fonts.serif, fontWeight: '600' },
  bookHint: {
    fontSize: 12,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    marginTop: 6,
  },
  currentMark: { alignItems: 'center', gap: 2 },
  currentText: {
    fontSize: 10,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.note,
    opacity: 0.8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.inkLight,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.note,
    borderTopWidth: 1.5,
    borderTopColor: Colors.line,
  },
  addBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.stamp,
    borderRadius: 4,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  addBookText: {
    color: Colors.note,
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
