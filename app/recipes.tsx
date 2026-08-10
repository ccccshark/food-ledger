import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { showDialog } from '@/stores/dialog';
import { Colors, Fonts } from '@/constants/theme';
import { Header } from '@/components/Header';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, DashedDivider } from '@/components/Decorations';
import { Empty } from '@/components/Empty';
import { t, useT } from '@/constants/i18n';
import type { Recipe } from '@/types';

const TAPE_COLORS = ['yellow', 'pink', 'green', 'blue'] as const;

export default function RecipesScreen() {
  useT(); // subscribe to lang changes for re-render
  const recipes = useLedgerStore((s) => s.recipes);
  const refreshRecipes = useLedgerStore((s) => s.refreshRecipes);
  const deleteRecipe = useLedgerStore((s) => s.deleteRecipe);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshRecipes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRecipes();
    setRefreshing(false);
  };

  const onDelete = (recipe: Recipe) => {
    showDialog({
      title: t('recipes.delete_title'),
      message: t('recipes.delete_msg', { name: recipe.name }),
      icon: 'trash-outline',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecipe(recipe.id);
            } catch (e: any) {
              showDialog({
                title: t('recipes.delete_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const renderItem = ({ item, index }: { item: Recipe; index: number }) => {
    const tape = TAPE_COLORS[index % TAPE_COLORS.length];
    const rotate = index % 2 === 0 ? 0.5 : -0.5;
    const ingredients = item.ingredients
      ? item.ingredients.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/recipe', params: { id: String(item.id) } })}
        onLongPress={() => onDelete(item)}
      >
        <PaperCard tape={tape} rotate={rotate} padding={16} showTape>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={12} color={Colors.inkLight} />
                <Text style={styles.metaText}>{t('recipes.servings', { n: item.servings })}</Text>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="nutrition-outline" size={12} color={Colors.inkLight} />
                <Text style={styles.metaText}>{t('recipes.ingredients_count', { n: ingredients.length })}</Text>
              </View>
            </View>
            {item.photo_uri ? (
              <Image source={{ uri: item.photo_uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Ionicons name="restaurant-outline" size={22} color={Colors.inkLight} />
              </View>
            )}
          </View>
          {ingredients.length > 0 ? (
            <>
              <DashedDivider />
              <Text style={styles.ingredients} numberOfLines={2}>
                {ingredients.join('、')}
              </Text>
            </>
          ) : null}
        </PaperCard>
      </TouchableOpacity>
    );
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title={t('recipes.title')} date={t('recipes.subtitle')} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/recipe')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add-circle-outline" size={30} color={Colors.stamp} />
        </TouchableOpacity>
        <FlatList
          style={styles.list}
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            recipes.length === 0
              ? styles.emptyList
              : { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 36, gap: 16 }
          }
          ListEmptyComponent={
            <Empty
              icon="book-outline"
              text={t('recipes.empty_text')}
              hint={t('recipes.empty_hint')}
              actionLabel={t('recipes.empty_action')}
              onAction={() => router.push('/recipe')}
            />
          }
        />
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  addBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    zIndex: 10,
  },
  list: { flex: 1 },
  emptyList: { flex: 1 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
  },
  dot: { fontSize: 12, color: Colors.inkLight, marginHorizontal: 2 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.15)',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
    borderStyle: 'dashed',
    borderColor: Colors.line,
  },
  ingredients: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
