import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts } from '@/constants/theme';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  centerSub?: string;
}

// 类苹果圆盘（环形）图表：用 SVG Circle + strokeDasharray 分段
export function DonutChart({
  data,
  size = 200,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  centerSub,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // 背景环
  const bgCircle = (
    <Circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke={Colors.lineSoft}
      strokeWidth={strokeWidth}
      opacity={0.35}
    />
  );

  let accumulatedOffset = 0;
  const segments = data.map((seg, i) => {
    if (total <= 0) return null;
    const fraction = seg.value / total;
    const dashLength = fraction * circumference;
    // 留 1.5px 间隙，营造分段感（类苹果风）
    const gap = Math.min(2, dashLength * 0.1);
    const actualDash = Math.max(0, dashLength - gap);
    const strokeDasharray = `${actualDash} ${circumference - actualDash}`;
    // 起点在 12 点方向（-90°），顺时针
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += dashLength;

    return (
      <Circle
        key={i}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    );
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {bgCircle}
        {segments}
      </Svg>
      {centerValue || centerLabel ? (
        <View style={styles.center}>
          {centerLabel ? (
            <Text style={styles.centerLabel}>{centerLabel}</Text>
          ) : null}
          {centerValue ? (
            <Text style={styles.centerValue}>{centerValue}</Text>
          ) : null}
          {centerSub ? (
            <Text style={styles.centerSub}>{centerSub}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// 图例
export function DonutLegend({
  data,
  total,
}: {
  data: DonutSegment[];
  total: number;
}) {
  return (
    <View style={styles.legendWrap}>
      {data.map((seg, i) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        return (
          <View key={i} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendLabel}>{seg.label}</Text>
            <Text style={styles.legendPct}>{pct.toFixed(0)}%</Text>
            <Text style={styles.legendValue}>¥{seg.value.toFixed(0)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// 自定义横向柱状图（每日支出），避免 chart-kit 在某些数据下崩溃
export function MiniBarChart({
  data,
  height = 140,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth - 72, data.length * 30);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(22, (chartWidth - data.length * 6) / data.length);
  const gap = (chartWidth - barWidth * data.length) / (data.length + 1);

  return (
    <View style={[styles.barWrap, { width: chartWidth }]}>
      {/* Y 轴参考线 */}
      <View style={[styles.barArea, { height }]}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <View
            key={r}
            style={[styles.gridLine, { bottom: r * height }]}
          />
        ))}
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * (height - 20);
          return (
            <View
              key={i}
              style={[styles.barCol, { marginLeft: i === 0 ? gap : 0, marginRight: gap }]}
            >
              <View style={[styles.barValueWrap, { height: height - 20 }]}>
                {d.value > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(3, barH),
                        width: barWidth,
                        backgroundColor: d.value >= maxVal * 0.8 ? Colors.stamp : Colors.olive,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={styles.barLabel}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
  },
  centerValue: {
    fontSize: 24,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 2,
  },
  centerSub: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    marginTop: 2,
  },

  // 图例
  legendWrap: {
    gap: 8,
    marginTop: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    flex: 1,
  },
  legendPct: {
    fontSize: 12,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  legendValue: {
    fontSize: 12,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    width: 56,
    textAlign: 'right',
  },

  // 柱状图
  barWrap: {
    flexDirection: 'row',
  },
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.lineSoft,
    borderStyle: 'dashed',
  },
  barCol: {
    alignItems: 'center',
  },
  barValueWrap: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    borderRadius: 3,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    marginTop: 4,
  },
});
