import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import { Colors, Fonts } from '@/constants/theme';
import { Tape } from './Decorations';

// 画笔颜色（手账墨水色）
const INK_COLORS = [
  Colors.ink,        // 墨黑
  Colors.stamp,      // 印章红
  Colors.olive,      // 橄榄绿
  Colors.ochre,      // 赭黄
  Colors.danger,     // 警示红
  '#3B82F6',         // 蓝
];

const BRUSH_SIZES = [3, 5, 8];

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

// 把点序列转成 SVG path 字符串
function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x},${p.y} L${p.x + 0.1},${p.y + 0.1}`;
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i].x},${points[i].y}`;
  }
  return d;
}

// 自绘画布：用户用手指在纸上绘制美食
export function DrawingCanvas({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string) => void;
}) {
  const shotRef = useRef<ViewShot>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState(INK_COLORS[0]);
  const [brush, setBrush] = useState(BRUSH_SIZES[1]);
  const [saving, setSaving] = useState(false);

  const canvasWidth = Dimensions.get('window').width - 36;
  const canvasHeight = 320;

  // PanResponder：在画布内绘制
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke({
          color,
          width: brush,
          points: [{ x: locationX, y: locationY }],
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!currentStroke) return;
        // locationX/Y 在 move 时不可靠，用 moveX/moveY 减去画布偏移
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke((prev) => {
          if (!prev) return prev;
          // 限制在画布范围内
          const x = Math.max(0, Math.min(canvasWidth, locationX));
          const y = Math.max(0, Math.min(canvasHeight, locationY));
          return { ...prev, points: [...prev.points, { x, y }] };
        });
        void gestureState;
      },
      onPanResponderRelease: () => {
        setCurrentStroke((prev) => {
          if (prev && prev.points.length > 0) {
            setStrokes((all) => [...all, prev]);
          }
          return null;
        });
      },
    })
  ).current;

  const onUndo = useCallback(() => {
    setStrokes((all) => all.slice(0, -1));
  }, []);

  const onClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  const onConfirm = async () => {
    if (strokes.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const uri = await captureRef(shotRef, {
        result: 'tmpfile',
        format: 'png',
        quality: 1,
      });
      if (!uri) throw new Error('截图失败');
      // 持久化到 food_photos 目录
      const dir = `${FileSystem.documentDirectory}food_photos/`;
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
      } catch {
        /* 目录已存在 */
      }
      const dest = `${dir}drawing_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      onSave(dest);
      // 重置画布
      setStrokes([]);
      setCurrentStroke(null);
    } catch (e) {
      // 忽略，保持画布
    } finally {
      setSaving(false);
    }
  };

  const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={Colors.ink} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Tape color="pink" width={20} height={10} rotate={-5} />
              <Text style={styles.headerTitle}>手绘美食</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* 画布区 */}
          <View style={styles.canvasArea}>
            <ViewShot
              ref={shotRef}
              options={{ format: 'png', quality: 1 }}
              style={styles.shot}
            >
              <View
                style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}
                {...panResponder.panHandlers}
              >
                {/* 纸张底纹：浅色网格 */}
                <View style={styles.gridBg} />
                {/* 提示文字（无笔画时显示） */}
                {allStrokes.length === 0 ? (
                  <View style={styles.hintWrap} pointerEvents="none">
                    <Ionicons name="brush" size={36} color={Colors.inkLight} />
                    <Text style={styles.hintText}>用手指画出你的美食</Text>
                    <Text style={styles.hintSub}>完成后点击「用到照片」</Text>
                  </View>
                ) : null}
                {/* SVG 笔画 */}
                <Svg width={canvasWidth} height={canvasHeight} style={styles.svg}>
                  {allStrokes.map((s, i) => {
                    if (s.points.length === 1) {
                      return (
                        <SvgCircle
                          key={i}
                          cx={s.points[0].x}
                          cy={s.points[0].y}
                          r={s.width / 2}
                          fill={s.color}
                        />
                      );
                    }
                    return (
                      <Path
                        key={i}
                        d={pointsToPath(s.points)}
                        stroke={s.color}
                        strokeWidth={s.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </Svg>
              </View>
            </ViewShot>
          </View>

          {/* 工具栏：颜色 */}
          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>墨色</Text>
            <View style={styles.colorRow}>
              {INK_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotActive,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* 工具栏：笔触 */}
          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>笔触</Text>
            <View style={styles.brushRow}>
              {BRUSH_SIZES.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.brushDot,
                    brush === b && styles.brushDotActive,
                  ]}
                  onPress={() => setBrush(b)}
                >
                  <View style={[styles.brushInner, { width: b, height: b, backgroundColor: color }]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onUndo} disabled={strokes.length === 0}>
              <Ionicons name="arrow-undo-outline" size={18} color={Colors.inkSoft} />
              <Text style={styles.actionText}>撤销</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onClear} disabled={strokes.length === 0}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>清空</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (strokes.length === 0 || saving) && styles.confirmBtnDisabled]}
              onPress={onConfirm}
              disabled={strokes.length === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.note} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={Colors.note} />
                  <Text style={styles.confirmText}>用到照片</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
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
  canvasArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  shot: {
    backgroundColor: 'transparent',
  },
  canvas: {
    backgroundColor: Colors.note,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  gridBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,236,217,0.5)',
  },
  hintWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 14,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
  },
  hintSub: {
    fontSize: 11,
    color: Colors.inkLight,
    fontStyle: 'italic',
  },
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 12,
  },
  toolLabel: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    width: 36,
  },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.2)',
  },
  colorDotActive: {
    borderWidth: 2.5,
    borderColor: Colors.ink,
    transform: [{ scale: 1.1 }],
  },
  brushRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  brushDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushDotActive: {
    borderWidth: 2,
    borderColor: Colors.ink,
  },
  brushInner: {
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 'auto',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  actionText: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    color: Colors.inkSoft,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 4,
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: Colors.note,
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
