import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Fonts, Meals } from '@/constants/theme';
import { QUICK_ENTRIES } from '@/types';

type FaGlyph = React.ComponentProps<typeof FontAwesome>['name'];

// 快捷记账入口（手账贴纸风：每个餐次像一张小贴纸）
export function QuickEntries() {
  return (
    <View style={styles.wrap}>
      {QUICK_ENTRIES.map((e, i) => {
        const meal = Meals[e.meal];
        return (
          <TouchableOpacity
            key={e.meal}
            style={[
              styles.item,
              {
                backgroundColor: meal.color + '26',
                borderColor: meal.color,
                transform: [{ rotate: `${i % 2 === 0 ? -3 : 3}deg` }],
              },
            ]}
            onPress={() =>
              router.push({ pathname: '/add', params: { meal: e.meal } })
            }
          >
            <View style={[styles.iconCircle, { borderColor: meal.color }]}>
              <FontAwesome name={e.icon as FaGlyph} size={18} color={meal.color} />
            </View>
            <Text style={[styles.label, { color: meal.color }]}>{e.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  item: {
    flex: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1.2,
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.note,
  },
  label: {
    fontSize: 12,
    marginTop: 6,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
});
