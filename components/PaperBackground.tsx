import React from 'react';
import { StyleSheet, View, ViewStyle, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

// 纹理图（require 才能被打包）
const PAPER_TEXTURE = require('@/assets/paper-texture.jpg');

/**
 * 牛皮纸背景：纹理图铺底 + 渐变叠色统一色调 + 四边做旧暗角。
 */
export function PaperBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.bg, style]}>
      {/* 纹理图铺底 */}
      <ImageBackground
        source={PAPER_TEXTURE}
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ resizeMode: 'cover' }}
      />
      {/* 渐变叠色统一色调 + 顶部高光 */}
      <LinearGradient
        colors={['rgba(240,226,196,0.55)', 'rgba(232,213,176,0.35)', 'rgba(217,194,154,0.55)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* 四边做旧暗角 */}
      <View style={styles.vignette} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: Colors.paper,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 10,
    borderColor: 'rgba(61, 46, 31, 0.12)',
    borderRadius: 6,
  },
});
