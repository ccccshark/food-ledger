import React from 'react';
import { StyleSheet, View, Image, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { Tape } from './Decorations';
import type { PhotoStyle } from '@/types';

// 多风格照片框：根据 photoStyle 渲染不同手账风装饰
// - polaroid: 拍立得（白边宽底，顶部小胶带）
// - tape:     胶带贴图（四角彩色胶带，像贴在本子上）
// - stamp:    邮票（虚线齿孔边框）
// - sketch:   手绘框（双层虚线边框 + 四角小墨点）
export function StyledPhoto({
  uri,
  style = 'polaroid',
  height = 200,
  rotate = 0,
  accent = Colors.olive,
  containerStyle,
}: {
  uri: string;
  style?: PhotoStyle;
  height?: number;
  rotate?: number;
  accent?: string;
  containerStyle?: ViewStyle;
}) {
  const photo = <Image source={{ uri }} style={{ width: '100%', height, resizeMode: 'cover' }} />;

  let content: React.ReactNode;

  switch (style) {
    case 'polaroid':
      content = (
        <View style={styles.polaroidWrap}>
          <View style={styles.polaroidInner}>
            {photo}
          </View>
          <View style={styles.polaroidBottom} />
          <View style={styles.polaroidTape}>
            <Tape color="yellow" width={46} height={14} rotate={-6} />
          </View>
        </View>
      );
      break;

    case 'tape':
      content = (
        <View style={styles.tapeWrap}>
          {photo}
          <View style={[styles.cornerTape, styles.tapeTL]}>
            <Tape color="pink" width={34} height={14} rotate={-35} />
          </View>
          <View style={[styles.cornerTape, styles.tapeTR]}>
            <Tape color="green" width={34} height={14} rotate={35} />
          </View>
          <View style={[styles.cornerTape, styles.tapeBL]}>
            <Tape color="blue" width={34} height={14} rotate={35} />
          </View>
          <View style={[styles.cornerTape, styles.tapeBR]}>
            <Tape color="yellow" width={34} height={14} rotate={-35} />
          </View>
        </View>
      );
      break;

    case 'stamp':
      content = (
        <View style={[styles.stampOuter, { borderColor: accent }]}>
          <View style={styles.stampInner}>{photo}</View>
        </View>
      );
      break;

    case 'sketch':
      content = (
        <View style={styles.sketchWrap}>
          <View style={[styles.sketchOuter, { borderColor: accent }]}>
            <View style={[styles.sketchInner, { borderColor: accent }]}>
              {photo}
            </View>
          </View>
          <View style={[styles.sketchDot, styles.dotTL, { backgroundColor: accent }]} />
          <View style={[styles.sketchDot, styles.dotTR, { backgroundColor: accent }]} />
          <View style={[styles.sketchDot, styles.dotBL, { backgroundColor: accent }]} />
          <View style={[styles.sketchDot, styles.dotBR, { backgroundColor: accent }]} />
        </View>
      );
      break;

    default:
      content = photo;
  }

  return (
    <View style={[{ transform: [{ rotate: `${rotate}deg` }] }, containerStyle]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  // ===== polaroid =====
  polaroidWrap: {
    position: 'relative',
    backgroundColor: Colors.note,
    padding: 8,
    paddingBottom: 26,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.15)',
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  polaroidInner: {
    overflow: 'hidden',
  },
  polaroidBottom: {
    height: 18,
  },
  polaroidTape: {
    position: 'absolute',
    top: -7,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // ===== tape (四角胶带) =====
  tapeWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  cornerTape: {
    position: 'absolute',
    zIndex: 2,
  },
  tapeTL: { top: -7, left: -10 },
  tapeTR: { top: -7, right: -10 },
  tapeBL: { bottom: -7, left: -10 },
  tapeBR: { bottom: -7, right: -10 },

  // ===== stamp (邮票齿孔) =====
  stampOuter: {
    padding: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: Colors.note,
    borderRadius: 2,
  },
  stampInner: {
    overflow: 'hidden',
  },

  // ===== sketch (手绘双层框) =====
  sketchWrap: {
    position: 'relative',
    padding: 5,
  },
  sketchOuter: {
    padding: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    backgroundColor: Colors.note,
  },
  sketchInner: {
    borderWidth: 0.8,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  sketchDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  dotTL: { top: 2, left: 2 },
  dotTR: { top: 2, right: 2 },
  dotBL: { bottom: 2, left: 2 },
  dotBR: { bottom: 2, right: 2 },
});
