import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import type { PhotoShape } from '@/types';

// 心形 path（viewBox 100x100，居中）
function heartPath(): string {
  return 'M50,88 C20,66 5,48 5,30 C5,16 16,5 30,5 C40,5 47,11 50,20 C53,11 60,5 70,5 C84,5 95,16 95,30 C95,48 80,66 50,88 Z';
}

// 照片形状遮罩：square 直接展示，rounded 用 borderRadius，
// circle 用 borderRadius，heart 用 SVG 镂空遮罩盖住非心形区域
export function ShapeMask({
  shape = 'square',
  height,
  children,
}: {
  shape?: PhotoShape;
  height: number;
  children: React.ReactNode;
}) {
  if (shape === 'square') {
    return <View style={[{ height, overflow: 'hidden' }]}>{children}</View>;
  }
  if (shape === 'rounded') {
    return <View style={[{ height, overflow: 'hidden', borderRadius: 12 }]}>{children}</View>;
  }
  if (shape === 'circle') {
    return (
      <View style={[{ height, overflow: 'hidden', borderRadius: height / 2 }]}>{children}</View>
    );
  }
  // heart：用纸色遮罩盖住心形以外区域，露出心形图片
  return (
    <View style={[{ height, overflow: 'hidden' }]}>
      {children}
      <Svg
        width="100%"
        height={height}
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Path
          d={`M0,0 L100,0 L100,100 L0,100 Z ${heartPath()}`}
          fill={Colors.note}
          fillRule="evenodd"
        />
      </Svg>
    </View>
  );
}
