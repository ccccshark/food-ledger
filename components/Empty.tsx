import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

interface EmptyProps {
  icon?: keyof typeof Ionicons.glyphMap;
  text: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Empty({ icon = 'restaurant-outline', text, hint, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={40} color={Colors.inkLight} />
      </View>
      <Text style={styles.text}>{text}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  iconCircle: {
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
  text: {
    fontSize: 15,
    color: Colors.inkSoft,
    marginTop: 16,
    fontFamily: Fonts.serif,
  },
  hint: {
    fontSize: 12,
    color: Colors.inkLight,
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  btn: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: Colors.stamp,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  btnText: {
    color: Colors.note,
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
