import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore, todayStr } from '@/stores/ledger';
import { showDialog } from '@/stores/dialog';
import { Colors, Fonts, Meals } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider, Stamp } from '@/components/Decorations';
import { StarRating } from '@/components/StarRating';
import { PhotoPicker } from '@/components/PhotoPicker';
import type { MealType } from '@/types';
import { MEAL_ORDER, MEAL_LABELS } from '@/types';
import * as dao from '@/db';
import { getCurrentLocation, pickPhoto } from '@/utils/media';
import { recognizeFood, ocrReceipt, describeResult, AiRecognizeResult } from '@/services/ai';

const PRESET_TAGS = ['外卖', '堂食', '家常菜', '奶茶', '咖啡', '水果', '零食', '聚餐'];

interface LocState {
  latitude: number;
  longitude: number;
  name: string;
}

export default function AddScreen() {
  const params = useLocalSearchParams<{ meal?: MealType; id?: string; date?: string }>();
  const addRecord = useLedgerStore((s) => s.addRecord);
  const updateRecord = useLedgerStore((s) => s.updateRecord);
  const deleteRecord = useLedgerStore((s) => s.deleteRecord);
  const refreshTags = useLedgerStore((s) => s.refreshTags);
  const refreshAiConfig = useLedgerStore((s) => s.refreshAiConfig);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [meal, setMeal] = useState<MealType>(params.meal ?? 'lunch');
  const [date, setDate] = useState(params.date ?? todayStr());
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const navigatingAway = useRef(false);

  // Phase 2 新增
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loc, setLoc] = useState<LocState | null>(null);
  const [locNameInput, setLocNameInput] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [rating, setRating] = useState(0);

  // Phase 3 AI
  const aiConfig = useLedgerStore((s) => s.aiConfig);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'food' | 'receipt' | null>(null);

  useEffect(() => {
    if (params.id) {
      const id = Number(params.id);
      dao.getRecord(id).then((r) => {
        if (r) {
          setEditingId(id);
          setAmount(String(r.amount));
          setMeal(r.meal as MealType);
          setDate(r.date);
          setNote(r.note);
          setTags(r.tags ? r.tags.split(',').filter(Boolean) : []);
          setPhotoUri(r.photo_uri ?? null);
          setRating(r.rating ?? 0);
          if (r.latitude != null && r.longitude != null) {
            setLoc({
              latitude: r.latitude,
              longitude: r.longitude,
              name: r.location_name ?? '',
            });
            setLocNameInput(r.location_name ?? '');
          }
        } else {
          showDialog({
            title: '提示',
            message: '该记录不存在或已被删除',
            icon: 'alert-circle-outline',
            buttons: [{ text: '返回', onPress: () => router.back() }],
          });
        }
      });
    }
  }, [params.id]);

  const existingTags = useLedgerStore((s) => s.existingTags);
  useEffect(() => {
    refreshTags();
    refreshAiConfig();
  }, []);

  const suggestions = useMemo(
    () => existingTags.filter((t) => !tags.includes(t)).slice(0, 6),
    [existingTags, tags]
  );

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const addCustomTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const onGetLocation = async () => {
    setLocLoading(true);
    try {
      const info = await getCurrentLocation();
      if (info) {
        setLoc(info);
      } else {
        showDialog({
          title: '提示',
          message: '无法获取位置，请检查权限或手动输入地点名',
          icon: 'location-outline',
        });
      }
    } finally {
      setLocLoading(false);
    }
  };

  const clearLocation = () => {
    setLoc(null);
    setLocNameInput('');
  };

  // AI 识别：选图 → 调 API → 填表单
  const onAiRecognize = async (mode: 'food' | 'receipt') => {
    if (!aiConfig.enabled || !aiConfig.apiKey) {
      showDialog({
        title: 'AI 未启用',
        message: '请先在「我的 → AI 助手设置」中配置',
        icon: 'sparkles-outline',
        buttons: [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => router.push('/ai-settings') },
        ],
      });
      return;
    }
    setAiMode(mode);
    setAiLoading(true);
    try {
      const uri = await pickPhoto();
      if (!uri) {
        setAiMode(null);
        return;
      }
      // 顺手把识别用的图也设为记录照片
      setPhotoUri(uri);
      const result = mode === 'food'
        ? await recognizeFood(aiConfig, uri)
        : await ocrReceipt(aiConfig, uri);
      applyAiResult(result, mode);
      showDialog({
        title: '识别成功',
        message: describeResult(result) || '未识别到有效信息，请手动填写',
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: '识别失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setAiLoading(false);
      setAiMode(null);
    }
  };

  const applyAiResult = (r: AiRecognizeResult, mode: 'food' | 'receipt') => {
    if (r.amount != null) setAmount(String(r.amount));
    if (r.meal && mode === 'food') setMeal(r.meal);
    if (r.tags && r.tags.length) {
      setTags((prev) => Array.from(new Set([...prev, ...r.tags!])));
    }
    if (r.note) setNote(r.note);
    if (r.rating && mode === 'food') setRating(r.rating);
  };

  const onSave = async () => {
    if (navigatingAway.current) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      showDialog({
        title: '提示',
        message: '请输入有效金额',
        icon: 'alert-circle-outline',
      });
      return;
    }
    setSaving(true);
    const finalLocName = locNameInput.trim();
    const input = {
      amount: value,
      meal,
      tags: tags.join(','),
      date,
      note: note.trim(),
      photo_uri: photoUri,
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      location_name: loc ? (finalLocName || null) : null,
      rating,
    };
    try {
      if (editingId) {
        await updateRecord(editingId, input);
      } else {
        await addRecord(input);
      }
      // 标记正在离开，防止重复触发
      navigatingAway.current = true;
      // 先收起键盘，避免 modal 退出动画与键盘动画冲突导致白屏
      Keyboard.dismiss();
      // 用 requestAnimationFrame 等待一帧，确保状态稳定后再导航
      requestAnimationFrame(() => {
        router.back();
      });
    } catch (e: any) {
      navigatingAway.current = false;
      showDialog({
        title: '保存失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    showDialog({
      title: '删除记录',
      message: '确定删除这条记录吗？删除后无法恢复。',
      icon: 'trash-outline',
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (navigatingAway.current) return;
            navigatingAway.current = true;
            try {
              await deleteRecord(editingId);
              Keyboard.dismiss();
              requestAnimationFrame(() => router.back());
            } catch (e: any) {
              navigatingAway.current = false;
              showDialog({
                title: '删除失败',
                message: e?.message ?? '未知错误',
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const activeMeal = Meals[meal];

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="pink" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>{editingId ? '修改一笔' : '记一笔'}</Text>
          </View>
          {editingId ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/share', params: { id: String(editingId) } })}
              style={styles.shareBtn}
            >
              <Ionicons name="share-outline" size={22} color={Colors.stamp} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* AI 工具条 */}
            {aiConfig.enabled ? (
              <View style={styles.aiBar}>
                <TouchableOpacity
                  style={[styles.aiBtn, aiLoading && aiMode === 'food' && styles.aiBtnActive]}
                  onPress={() => onAiRecognize('food')}
                  disabled={aiLoading}
                >
                  {aiLoading && aiMode === 'food' ? (
                    <ActivityIndicator size="small" color={Colors.note} />
                  ) : (
                    <Ionicons name="sparkles" size={16} color={Colors.note} />
                  )}
                  <Text style={styles.aiBtnText}>AI 识别美食</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn2, aiLoading && aiMode === 'receipt' && styles.aiBtn2Active]}
                  onPress={() => onAiRecognize('receipt')}
                  disabled={aiLoading}
                >
                  <Ionicons name="receipt" size={16} color={Colors.olive} />
                  <Text style={styles.aiBtn2Text}>账单 OCR</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* 金额纸条 */}
            <PaperCard tape="yellow" rotate={0} padding={18} style={styles.amountCard}>
              <View style={styles.amountHead}>
                <Text style={styles.amountLabel}>金额</Text>
                <Stamp text={activeMeal.stamp} color={activeMeal.color} size={40} />
              </View>
              <View style={styles.amountInputRow}>
                <Text style={styles.currency}>¥</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.inkLight}
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus={!editingId}
                />
              </View>
              <View style={styles.amountUnderline} />

              {/* 评分 */}
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>美味评分</Text>
                <StarRating value={rating} onChange={setRating} size={24} />
              </View>
            </PaperCard>

            {/* 餐次 */}
            <FieldLabel label="餐次" />
            <View style={styles.mealRow}>
              {MEAL_ORDER.map((m) => {
                const cfg = Meals[m];
                const active = meal === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.mealChip,
                      {
                        borderColor: active ? cfg.color : Colors.line,
                        backgroundColor: active ? cfg.color + '33' : Colors.note,
                      },
                    ]}
                    onPress={() => setMeal(m)}
                  >
                    <Text
                      style={[
                        styles.mealChipText,
                        { color: active ? cfg.color : Colors.inkLight },
                      ]}
                    >
                      {MEAL_LABELS[m]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 日期 */}
            <FieldLabel label="日期" />
            <View style={styles.dateRow}>
              {[-2, -1, 0].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${day}`;
                const active = date === dateStr;
                const label = offset === 0 ? '今天' : offset === -1 ? '昨天' : '前天';
                return (
                  <TouchableOpacity
                    key={offset}
                    style={[
                      styles.dateChip,
                      active && {
                        backgroundColor: Colors.stamp,
                        borderColor: Colors.stamp,
                      },
                    ]}
                    onPress={() => setDate(dateStr)}
                  >
                    <Text style={[styles.dateChipLabel, active && { color: Colors.note }]}>
                      {label}
                    </Text>
                    <Text style={[styles.dateChipValue, active && { color: Colors.note }]}>
                      {m}/{day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 照片 */}
            <FieldLabel label="美食照片" />
            <PhotoPicker uri={photoUri} onChange={setPhotoUri} />

            {/* 地点 */}
            <FieldLabel label="用餐地点" />
            <PaperCard tape="blue" rotate={0} padding={12} showTape={false}>
              <View style={styles.locRow}>
                <TouchableOpacity
                  style={styles.locBtn}
                  onPress={onGetLocation}
                  disabled={locLoading}
                >
                  {locLoading ? (
                    <ActivityIndicator size="small" color={Colors.olive} />
                  ) : (
                    <Ionicons
                      name={loc ? 'location' : 'location-outline'}
                      size={20}
                      color={loc ? Colors.olive : Colors.inkLight}
                    />
                  )}
                  <Text style={styles.locBtnText}>
                    {loc ? '已定位' : '获取位置'}
                  </Text>
                </TouchableOpacity>
                {loc ? (
                  <Text style={styles.locCoord}>
                    {loc.latitude.toFixed(3)}, {loc.longitude.toFixed(3)}
                  </Text>
                ) : null}
                {loc ? (
                  <TouchableOpacity onPress={clearLocation}>
                    <Ionicons name="close-circle" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.locInput}
                placeholder="地点名（如：楼下小馆、家）"
                placeholderTextColor={Colors.inkLight}
                value={locNameInput}
                onChangeText={setLocNameInput}
              />
              <Text style={styles.locHint}>
                提示：位置用于"地图足迹"；地点名手动填写更准确
              </Text>
            </PaperCard>

            {/* 标签 */}
            <FieldLabel label="标签" />
            <PaperCard tape="green" rotate={0} padding={12} showTape={false}>
              <View style={styles.tagsRow}>
                {PRESET_TAGS.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={tags.includes(t)}
                    onPress={() => toggleTag(t)}
                  />
                ))}
              </View>

              {tags.length > 0 ? (
                <>
                  <DashedDivider />
                  <View style={styles.selectedRow}>
                    {tags.map((t) => (
                      <View key={t} style={styles.selectedTag}>
                        <Text style={styles.selectedTagText}>{t}</Text>
                        <TouchableOpacity onPress={() => toggleTag(t)}>
                          <Ionicons name="close" size={11} color={Colors.note} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {suggestions.length > 0 ? (
                <View style={styles.suggestRow}>
                  <Text style={styles.suggestLabel}>常用：</Text>
                  <View style={styles.suggestChips}>
                    {suggestions.map((t) => (
                      <Chip key={t} label={t} onPress={() => toggleTag(t)} small />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.customTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="自定义标签…"
                  placeholderTextColor={Colors.inkLight}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addCustomTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={addCustomTag}>
                  <Ionicons name="add" size={18} color={Colors.note} />
                </TouchableOpacity>
              </View>
            </PaperCard>

            {/* 备注 */}
            <FieldLabel label="备注" />
            <PaperCard tape="blue" rotate={0} padding={0} showTape={false}>
              <View style={styles.noteBox}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="吃了什么？和谁？心情如何？"
                  placeholderTextColor={Colors.inkLight}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={200}
                />
              </View>
            </PaperCard>
          </ScrollView>

          {/* 底部按钮 */}
          <View style={styles.footer}>
            {editingId ? (
              <Pressable style={styles.deleteBtn} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.saveBtn, editingId ? { flex: 1 } : null]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '保存中…' : editingId ? '保存修改' : '记入账本'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Tape color="green" width={12} height={8} rotate={-6} />
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  small,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        small && styles.chipSmall,
        active && {
          backgroundColor: Colors.stamp + '22',
          borderColor: Colors.stamp,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          small && styles.chipTextSmall,
          active && { color: Colors.stamp },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  shareBtn: { padding: 8 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  body: { flex: 1, paddingHorizontal: 18 },
  amountCard: { marginBottom: 18 },
  aiBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  aiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: Colors.stamp,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  aiBtnActive: { opacity: 0.7 },
  aiBtnText: {
    color: Colors.note,
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 1,
  },
  aiBtn2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: Colors.paperLight,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
  },
  aiBtn2Active: { opacity: 0.7 },
  aiBtn2Text: {
    color: Colors.olive,
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    letterSpacing: 1,
  },
  amountHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  amountLabel: { fontSize: 12, color: Colors.inkLight, fontFamily: Fonts.serif },
  amountInputRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  currency: {
    fontSize: 26,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 38,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    padding: 0,
  },
  amountUnderline: { height: 1.5, backgroundColor: Colors.line, marginTop: 8 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  ratingLabel: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.inkSoft,
    letterSpacing: 1,
  },
  mealRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  mealChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  mealChipText: { fontSize: 13, fontFamily: Fonts.serif, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  dateChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: Colors.line,
    backgroundColor: Colors.note,
    alignItems: 'center',
  },
  dateChipLabel: { fontSize: 12, color: Colors.inkLight, fontFamily: Fonts.serif },
  dateChipValue: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
    marginTop: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
    backgroundColor: Colors.paperLight,
  },
  locBtnText: { fontSize: 13, color: Colors.olive, fontFamily: Fonts.serif, fontWeight: '600' },
  locCoord: { fontSize: 11, color: Colors.inkLight, fontStyle: 'italic', flex: 1 },
  locInput: {
    backgroundColor: Colors.paperLight,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    borderWidth: 1,
    borderColor: Colors.lineSoft,
  },
  locHint: { fontSize: 10, color: Colors.inkLight, marginTop: 6, fontStyle: 'italic' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: Colors.stamp,
  },
  selectedTagText: { color: Colors.note, fontSize: 12, fontFamily: Fonts.serif },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  suggestLabel: { fontSize: 11, color: Colors.inkLight, marginRight: 6, fontStyle: 'italic' },
  suggestChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  customTagRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  tagInput: {
    flex: 1,
    backgroundColor: Colors.paperLight,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    borderWidth: 1,
    borderColor: Colors.lineSoft,
  },
  addTagBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: { position: 'relative', minHeight: 90 },
  noteInput: {
    padding: 12,
    fontSize: 14,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    textAlignVertical: 'top',
    minHeight: 90,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.note,
    borderTopWidth: 1.5,
    borderTopColor: Colors.line,
  },
  deleteBtn: {
    width: 52,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.stamp,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  saveBtnText: {
    color: Colors.note,
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  chipText: { fontSize: 13, color: Colors.inkSoft, fontFamily: Fonts.serif },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3 },
  chipTextSmall: { fontSize: 12 },
});
