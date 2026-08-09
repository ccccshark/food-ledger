import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { Tape } from './Decorations';

interface HeaderProps {
  title: string;
  rightLabel?: string;
  onRight?: () => void;
  date?: string; // 手账风：显示日期落款
}

export function Header({ title, rightLabel, onRight, date }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Tape color="green" width={28} height={14} rotate={-8} style={styles.tape} />
        <Text style={styles.title}>{title}</Text>
        {rightLabel && onRight ? (
          <TouchableOpacity onPress={onRight} style={styles.right}>
            <Text style={styles.rightText}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {date ? <Text style={styles.dateLine}>{date}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tape: {
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
    flex: 1,
  },
  right: { paddingHorizontal: 8, paddingVertical: 4 },
  rightText: { color: Colors.stamp, fontSize: 14, fontFamily: Fonts.serif, fontWeight: '600' },
  dateLine: {
    fontSize: 11,
    color: Colors.inkLight,
    marginTop: 2,
    marginLeft: 38,
    fontStyle: 'italic',
  },
});
