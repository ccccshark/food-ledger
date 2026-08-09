import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

// ===== 胶带 =====
type TapeColor = 'yellow' | 'pink' | 'green' | 'blue';
const TAPE_COLORS: Record<TapeColor, string> = {
  yellow: Colors.tapeYellow,
  pink: Colors.tapePink,
  green: Colors.tapeGreen,
  blue: Colors.tapeBlue,
};

export function Tape({
  color = 'yellow',
  width = 80,
  height = 22,
  rotate = -4,
  style,
}: {
  color?: TapeColor;
  width?: number;
  height?: number;
  rotate?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: TAPE_COLORS[color],
          opacity: 0.78,
          transform: [{ rotate: `${rotate}deg` }],
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'rgba(255,255,255,0.3)',
        },
        style,
      ]}
    />
  );
}

// ===== 纸卡片（贴在牛皮纸上的白纸片，带胶带角/订书钉） =====
export function PaperCard({
  children,
  style,
  rotate = 0,
  tape = 'yellow',
  showTape = true,
  tapePosition = 'top',
  padding = 16,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  rotate?: number;
  tape?: TapeColor;
  showTape?: boolean;
  tapePosition?: 'top' | 'corner';
  padding?: number | undefined;
}) {
  return (
    <View
      style={[
        styles.cardWrap,
        {
          transform: [{ rotate: `${rotate}deg` }],
        },
      ]}
    >
      {showTape && tapePosition === 'top' ? (
        <View style={styles.tapeTopWrap}>
          <Tape color={tape} width={70} height={20} rotate={-6} />
        </View>
      ) : null}
      <View style={[styles.card, { padding: padding as number }, style]}>
        {showTape && tapePosition === 'corner' ? (
          <Tape color={tape} width={36} height={48} rotate={35} style={styles.tapeCorner} />
        ) : null}
        {children}
      </View>
    </View>
  );
}

// ===== 印章 =====
export function Stamp({
  text,
  color = Colors.stamp,
  size = 56,
  style,
}: {
  text: string;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-8deg' }],
          opacity: 0.85,
        },
        style,
      ]}
    >
      <Text
        style={{
          color,
          fontSize: size * 0.22,
          fontWeight: '700',
          fontFamily: Fonts.serif,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ===== 订书钉 =====
export function Staples({ position = 'top' }: { position?: 'top' | 'left' }) {
  const isTop = position === 'top';
  return (
    <View
      pointerEvents="none"
      style={
        isTop
          ? { position: 'absolute', top: -3, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between' }
          : { position: 'absolute', left: -3, top: 24, bottom: 24, flexDirection: 'column', justifyContent: 'space-between' }
      }
    >
      {[0, 1].map((i) => (
        <View
          key={i}
          style={
            isTop
              ? { width: 10, height: 3, backgroundColor: '#8A8A8A', borderRadius: 1 }
              : { width: 3, height: 10, backgroundColor: '#8A8A8A', borderRadius: 1 }
          }
        />
      ))}
    </View>
  );
}

// ===== 虚线分割（手账风） =====
export function DashedDivider({ color = Colors.dotted, style }: { color?: string; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          height: 1,
          borderStyle: 'dashed',
          borderWidth: 0.6,
          borderColor: color,
          marginVertical: 8,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

// ===== 手写感标题 =====
export function HandTitle({
  children,
  style,
  size = 22,
}: {
  children: React.ReactNode;
  style?: TextStyle;
  size?: number;
}) {
  return (
    <Text
      style={[
        {
          fontSize: size,
          fontFamily: Fonts.serif,
          fontWeight: '700',
          color: Colors.ink,
          letterSpacing: 1,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ===== 圆形墨点（列表项前的小标记） =====
export function InkDot({ color = Colors.stamp, size = 8 }: { color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.8,
      }}
    />
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: 'relative',
  },
  tapeTopWrap: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  card: {
    backgroundColor: Colors.note,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(61, 46, 31, 0.12)',
    overflow: 'hidden',
    // 多层阴影模拟纸张浮起
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  tapeCorner: {
    position: 'absolute',
    top: -14,
    right: -10,
    zIndex: 2,
  },
});
