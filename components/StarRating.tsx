import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

// 1-5 星评分选择器
export function StarRating({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.wrap}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star === value ? 0 : star)}
            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
          >
            <Ionicons
              name={active ? 'star' : 'star-outline'}
              size={size}
              color={active ? Colors.ochre : Colors.inkLight}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4 },
});
