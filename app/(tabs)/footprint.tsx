import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useLedgerStore } from '@/stores/ledger';
import { Colors, Fonts, formatMoney, toCNNumber } from '@/constants/theme';
import { Header } from '@/components/Header';
import { Empty } from '@/components/Empty';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider, InkDot } from '@/components/Decorations';
import type { LocationAgg } from '@/types';

export default function FootprintScreen() {
  const locations = useLedgerStore((s) => s.locations);
  const refreshLocations = useLedgerStore((s) => s.refreshLocations);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshLocations();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLocations();
    setRefreshing(false);
  };

  const totalCount = locations.reduce((s, l) => s + l.count, 0);
  const totalAmount = locations.reduce((s, l) => s + l.total, 0);

  // 计算地图区域
  const region = (() => {
    if (locations.length === 0) return null;
    if (locations.length === 1) {
      return {
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    const lats = locations.map((l) => l.latitude);
    const lngs = locations.map((l) => l.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.4),
    };
  })();

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="美食足迹" date="去过的店" />
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 概览 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={0} padding={14} showTape>
              <View style={styles.overviewRow}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{locations.length}</Text>
                  <Text style={styles.overviewLabel}>个地点</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{totalCount}</Text>
                  <Text style={styles.overviewLabel}>次打卡</Text>
                </View>
                <View style={styles.overviewDivider} />
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewValue}>{formatMoney(totalAmount)}</Text>
                  <Text style={styles.overviewLabel}>累计</Text>
                </View>
              </View>
            </PaperCard>
          </View>

          {/* 地图 */}
          {region ? (
            <View style={styles.px}>
              <PaperCard tape="yellow" rotate={0} padding={8} showTape>
                <View style={styles.mapBox}>
                  <MapView
                    style={styles.map}
                    initialRegion={region}
                    showsUserLocation
                  >
                    {locations.map((l, i) => (
                      <Marker
                        key={`${l.location_name}-${i}`}
                        coordinate={{
                          latitude: l.latitude,
                          longitude: l.longitude,
                        }}
                        title={l.location_name || `地点${i + 1}`}
                        description={`${l.count}次 · ${formatMoney(l.total)}`}
                      />
                    ))}
                  </MapView>
                  <View style={styles.mapHint}>
                    <Ionicons name="information-circle-outline" size={11} color={Colors.note} />
                    <Text style={styles.mapHintText}>
                      如不显示底图，需配置 Google Maps API Key
                    </Text>
                  </View>
                </View>
              </PaperCard>
            </View>
          ) : null}

          {/* 地点列表 */}
          <View style={styles.px}>
            <View style={styles.listTitleRow}>
              <Tape color="green" width={14} height={9} rotate={-6} />
              <Text style={styles.listTitle}>地点清单</Text>
            </View>

            {locations.length === 0 ? (
              <Empty
                icon="map-outline"
                text="还没有地点记录"
                hint={'记账时点击「获取位置」并填写地点名即可生成足迹'}
                actionLabel="去记一笔"
                onAction={() => router.push('/add')}
              />
            ) : (
              <PaperCard tape="blue" rotate={0} padding={0} showTape>
                {locations.map((l, i) => (
                  <LocationRow
                    key={`${l.location_name}-${i}`}
                    loc={l}
                    last={i === locations.length - 1}
                  />
                ))}
              </PaperCard>
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function LocationRow({ loc, last }: { loc: LocationAgg; last: boolean }) {
  return (
    <View style={[styles.locRow, !last && styles.locRowBorder]}>
      <View style={styles.locThumbWrap}>
        {loc.sample_photo ? (
          <Image source={{ uri: loc.sample_photo }} style={styles.locThumb} />
        ) : (
          <View style={styles.locThumbPlaceholder}>
            <Ionicons name="restaurant" size={18} color={Colors.inkLight} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.locName} numberOfLines={1}>
          {loc.location_name || '未命名地点'}
        </Text>
        <View style={styles.locMeta}>
          <InkDot color={Colors.olive} size={6} />
          <Text style={styles.locMetaText}>{loc.count} 次打卡</Text>
          <Text style={styles.locDot}>·</Text>
          <Text style={styles.locMetaText}>{formatMoney(loc.total)}</Text>
        </View>
        <Text style={styles.locLast}>最近 {loc.last_date}</Text>
      </View>
      <View style={styles.locCoordBox}>
        <Text style={styles.locCoord}>
          {loc.latitude.toFixed(3)}
        </Text>
        <Text style={styles.locCoord}>
          {loc.longitude.toFixed(3)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 12 },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: {
    fontSize: 20,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  overviewLabel: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontFamily: Fonts.serif },
  overviewDivider: { width: 1, height: 24, backgroundColor: Colors.line, opacity: 0.5 },
  mapBox: {
    position: 'relative',
    height: 200,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  map: { width: '100%', height: '100%' },
  mapHint: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(61,46,31,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  mapHintText: { fontSize: 9, color: Colors.note, fontStyle: 'italic' },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  listTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginLeft: 8,
    letterSpacing: 1,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  locRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  locThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  locThumb: { width: '100%', height: '100%' },
  locThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.paperLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locName: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
  },
  locMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locMetaText: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.serif },
  locDot: { fontSize: 11, color: Colors.inkLight },
  locLast: { fontSize: 10, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  locCoordBox: { alignItems: 'flex-end' },
  locCoord: { fontSize: 9, color: Colors.inkLight, fontStyle: 'italic' },
});
