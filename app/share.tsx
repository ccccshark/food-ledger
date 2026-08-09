import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Colors, Fonts, formatMoney } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape } from '@/components/Decorations';
import { ShareCollage } from '@/components/ShareCollage';
import * as dao from '@/db';
import type { LedgerRecord } from '@/types';

export default function ShareScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const shotRef = useRef<ViewShot>(null);
  const [record, setRecord] = useState<LedgerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const id = Number(params.id);
    dao.getRecord(id).then((r) => {
      setRecord(r);
      setLoading(false);
    });
  }, [params.id]);

  const onShare = async () => {
    if (!shotRef.current || !record) return;
    setSharing(true);
    try {
      const uri = await captureRef(shotRef, {
        result: 'tmpfile',
        format: 'png',
        quality: 0.95,
      });
      if (!uri) throw new Error('截图失败');

      // 检查 sharing 是否可用
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        // 兜底：保存到相册目录并提示路径
        const dest = `${FileSystem.documentDirectory}share_${Date.now()}.png`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        Alert.alert('已生成', `分享不可用，图片已保存：\n${dest}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: '分享我的美食手账',
        UTI: 'public.image',
      });
    } catch (e: any) {
      Alert.alert('分享失败', e?.message ?? '未知错误');
    } finally {
      setSharing(false);
    }
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="blue" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>手账拼贴</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 100 }}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.stamp} />
            </View>
          ) : record ? (
            <>
              <Text style={styles.hint}>
                预览效果（可截图保存或直接分享）
              </Text>

              {/* 截图目标区域 */}
              <View style={styles.shotWrap}>
                <ViewShot
                  ref={shotRef}
                  options={{ format: 'png', quality: 0.95 }}
                  style={styles.shot}
                >
                  <ShareCollage record={record} />
                </ViewShot>
              </View>

              <View style={styles.infoCard}>
                <PaperCard tape="yellow" rotate={0} padding={12} showTape={false}>
                  <Text style={styles.infoTitle}>这张拼贴包含</Text>
                  <Text style={styles.infoText}>
                    · 金额 {formatMoney(record.amount)}{'\n'}
                    · 餐次 / 日期 / 地点{'\n'}
                    · 美味评分 / 标签 / 备注{'\n'}
                    {record.photo_uri ? '· 美食照片（拍立得风）\n' : ''}· 手账风装饰（胶带/印章）
                  </Text>
                </PaperCard>
              </View>
            </>
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyText}>记录不存在</Text>
            </View>
          )}
        </ScrollView>

        {/* 底部分享按钮 */}
        {record ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={onShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator color={Colors.note} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={Colors.note} />
                  <Text style={styles.shareBtnText}>分享 / 保存图片</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
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
  body: { flex: 1 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  hint: {
    fontSize: 12,
    color: Colors.inkLight,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  shotWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  shot: {
    backgroundColor: 'transparent',
  },
  infoCard: { paddingHorizontal: 18, marginTop: 18 },
  infoTitle: { fontSize: 13, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink, marginBottom: 6 },
  infoText: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.serif, lineHeight: 20 },
  emptyText: { fontSize: 14, color: Colors.inkLight, fontFamily: Fonts.serif },
  footer: {
    padding: 16,
    backgroundColor: Colors.note,
    borderTopWidth: 1.5,
    borderTopColor: Colors.line,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 4,
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  shareBtnText: {
    color: Colors.note,
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
