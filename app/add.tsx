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
  Modal,
  FlatList,
  Image,
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
import { StickerLibrary, BUILTIN_STICKERS, type StickerItem } from '@/components/StickerLibrary';
import type { MealType, PhotoStyle, PhotoShape } from '@/types';
import { MEAL_ORDER } from '@/types';
import { t, useT, MEAL_T_KEY } from '@/constants/i18n';
import * as dao from '@/db';
import { getCurrentLocation, pickPhoto, pickMultiPhotos } from '@/utils/media';
import { recognizeFood, ocrReceipt, describeResult, AiRecognizeResult } from '@/services/ai';
import {
  TEMPLATES_BY_MEAL,
  guessMealByHour,
  type FoodTemplate,
} from '@/services/quick-templates';

const PRESET_TAGS = ['外卖', '堂食', '家常菜', '奶茶', '咖啡', '水果', '零食', '聚餐'];

interface LocState {
  latitude: number;
  longitude: number;
  name: string;
}

export default function AddScreen() {
  const params = useLocalSearchParams<{ meal?: MealType; id?: string; date?: string }>();
  useT(); // subscribe to lang changes for re-render
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
  const [photoStyle, setPhotoStyle] = useState<PhotoStyle>('polaroid');
  const [photoShape, setPhotoShape] = useState<PhotoShape>('square');
  const [photosExtra, setPhotosExtra] = useState<string[]>([]);
  const [loc, setLoc] = useState<LocState | null>(null);
  const [locNameInput, setLocNameInput] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [rating, setRating] = useState(0);

  // Phase 3 AI
  const aiConfig = useLedgerStore((s) => s.aiConfig);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'food' | 'receipt' | null>(null);

  // 速记模板（AI 平替）
  const [tplVisible, setTplVisible] = useState(false);
  const [tplMeal, setTplMeal] = useState<MealType>(guessMealByHour());

  // 贴纸库
  const [stickerLibVisible, setStickerLibVisible] = useState(false);
  const [pastedStickers, setPastedStickers] = useState<StickerItem[]>([]);
  const diyStickers = useLedgerStore((s) => s.diyStickers);
  const refreshDiyStickers = useLedgerStore((s) => s.refreshDiyStickers);
  const addDiySticker = useLedgerStore((s) => s.addDiySticker);

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
          setPhotoStyle(r.photo_style ?? 'polaroid');
          setPhotoShape(r.photo_shape ?? 'square');
          setPhotosExtra(r.photos_extra ?? []);
          setRating(r.rating ?? 0);
          // 还原已贴贴纸（按 id 从内置库补回 svg，避免渲染普通对象导致白屏）
          if (r.stickers) {
            try {
              const saved: StickerItem[] = JSON.parse(r.stickers);
              if (Array.isArray(saved)) {
                const restored = saved.map((s) => {
                  if (s.uri) return s; // DIY 贴纸靠 uri 渲染
                  const builtin = BUILTIN_STICKERS.find((b) => b.id === s.id);
                  return builtin ? { ...builtin } : { ...s, svg: undefined };
                });
                setPastedStickers(restored);
              }
            } catch {
              /* ignore */
            }
          }
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
            title: t('common.tip'),
            message: t('add.record_not_exist'),
            icon: 'alert-circle-outline',
            buttons: [{ text: t('common.back'), onPress: () => router.back() }],
          });
        }
      });
    }
  }, [params.id]);

  const existingTags = useLedgerStore((s) => s.existingTags);
  useEffect(() => {
    refreshTags();
    refreshAiConfig();
    refreshDiyStickers();
  }, []);

  const suggestions = useMemo(
    () => existingTags.filter((tg) => !tags.includes(tg)).slice(0, 6),
    [existingTags, tags]
  );

  const toggleTag = (tg: string) => {
    setTags((prev) => (prev.includes(tg) ? prev.filter((x) => x !== tg) : [...prev, tg]));
  };

  const addCustomTag = () => {
    const tg = tagInput.trim();
    if (tg && !tags.includes(tg)) setTags([...tags, tg]);
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
          title: t('common.tip'),
          message: t('add.location_failed'),
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
        title: t('add.ai_not_enabled'),
        message: t('add.ai_not_enabled_msg'),
        icon: 'sparkles-outline',
        buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('add.go_settings'), onPress: () => router.push('/ai-settings') },
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
        title: t('add.recognize_success'),
        message: describeResult(result) || t('add.recognize_empty'),
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: t('add.recognize_failed'),
        message: e?.message ?? t('common.unknown_error'),
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

  // 速记模板：一键填表（无需 API）
  const openTemplates = () => {
    setTplMeal(guessMealByHour());
    setTplVisible(true);
  };

  const applyTemplate = (tpl: FoodTemplate) => {
    setAmount(String(tpl.amount));
    setMeal(tpl.meal);
    setNote(tpl.name);
    setTags((prev) => Array.from(new Set([...prev, ...tpl.tags])));
    setTplVisible(false);
    showDialog({
      title: t('add.filled'),
      message: t('add.filled_msg', { name: tpl.name, amount: tpl.amount.toFixed(2) }),
      icon: 'checkmark-circle-outline',
    });
  };

  const onSave = async () => {
    if (navigatingAway.current) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      showDialog({
        title: t('common.tip'),
        message: t('add.invalid_amount'),
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
      photo_style: photoStyle,
      photo_shape: photoShape,
      photos_extra: photosExtra,
      stickers: pastedStickers.length
        ? JSON.stringify(
            pastedStickers.map((s) => ({ id: s.id, kind: s.kind, label: s.label, uri: s.uri }))
          )
        : null,
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
        title: t('add.save_failed'),
        message: e?.message ?? t('common.unknown_error'),
        icon: 'alert-circle-outline',
      });
    } finally {
      setSaving(false);
    }
  };

  // 跳转到菜谱编辑页（关联当前记录）
  const onSaveRecipe = () => {
    if (!editingId) {
      showDialog({
        title: t('common.tip'),
        message: t('add.save_recipe_first'),
        icon: 'alert-circle-outline',
      });
      return;
    }
    router.push(`/recipe?recordId=${editingId}`);
  };

  const onDelete = () => {
    if (!editingId) return;
    showDialog({
      title: t('add.delete_record'),
      message: t('add.delete_record_msg'),
      icon: 'trash-outline',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
                title: t('add.delete_failed'),
                message: e?.message ?? t('common.unknown_error'),
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
            <Text style={styles.headerTitle}>{editingId ? t('add.edit_title') : t('add.add_title')}</Text>
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
            {/* 速记 / AI 工具条（速记模板无需配置，AI 需在设置中启用） */}
            <View style={styles.aiBar}>
              <TouchableOpacity
                style={styles.tplBtn}
                onPress={openTemplates}
              >
                <Ionicons name="bookmark-outline" size={16} color={Colors.ochre} />
                <Text style={styles.tplBtnText}>{t('add.template')}</Text>
              </TouchableOpacity>
              {aiConfig.enabled ? (
                <>
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
                    <Text style={styles.aiBtnText}>{t('add.ai_recognize')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.aiBtn2, aiLoading && aiMode === 'receipt' && styles.aiBtn2Active]}
                    onPress={() => onAiRecognize('receipt')}
                    disabled={aiLoading}
                  >
                    <Ionicons name="receipt" size={16} color={Colors.olive} />
                    <Text style={styles.aiBtn2Text}>{t('add.ocr')}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {/* 金额纸条 */}
            <PaperCard tape="yellow" rotate={0} padding={18} style={styles.amountCard}>
              <View style={styles.amountHead}>
                <Text style={styles.amountLabel}>{t('add.amount')}</Text>
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
                <Text style={styles.ratingLabel}>{t('add.rating')}</Text>
                <StarRating value={rating} onChange={setRating} size={24} />
              </View>
            </PaperCard>

            {/* 餐次 */}
            <FieldLabel label={t('add.meal')} />
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
                      {t(MEAL_T_KEY[m])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 日期 */}
            <FieldLabel label={t('add.date')} />
            <View style={styles.dateRow}>
              {[-2, -1, 0].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${day}`;
                const active = date === dateStr;
                const label = offset === 0 ? t('add.today') : offset === -1 ? t('add.yesterday') : t('add.day_before');
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

            {/* 照片（支持多图） */}
            <FieldLabel label={t('add.photo')} />
            <PhotoPicker
              uri={photoUri}
              onChange={setPhotoUri}
              style={photoStyle}
              onStyleChange={setPhotoStyle}
              shape={photoShape}
              onShapeChange={setPhotoShape}
              accent={activeMeal.color}
            />
            {/* 附加照片缩略条 */}
            <ExtraPhotosBar
              photos={photosExtra}
              accent={activeMeal.color}
              onChange={setPhotosExtra}
            />

            {/* 地点 */}
            <FieldLabel label={t('add.location')} />
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
                    {loc ? t('add.located') : t('add.get_location')}
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
                placeholder={t('add.loc_placeholder')}
                placeholderTextColor={Colors.inkLight}
                value={locNameInput}
                onChangeText={setLocNameInput}
              />
              <Text style={styles.locHint}>
                {t('add.loc_hint')}
              </Text>
            </PaperCard>

            {/* 标签 */}
            <FieldLabel label={t('add.tags')} />
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
                  <Text style={styles.suggestLabel}>{t('add.common_tags')}</Text>
                  <View style={styles.suggestChips}>
                    {suggestions.map((tg) => (
                      <Chip key={tg} label={tg} onPress={() => toggleTag(tg)} small />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.customTagRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder={t('add.custom_tag_placeholder')}
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

            {/* 备注（手写风格） */}
            <FieldLabel label={t('add.note')} />
            <PaperCard tape="pink" rotate={0} padding={0} showTape>
              <View style={styles.noteBox}>
                <View style={styles.noteHeaderRow}>
                  <Ionicons name="create-outline" size={13} color={Colors.ochre} />
                  <Text style={styles.noteHeaderHint}>{t('add.note_hint')}</Text>
                </View>
                <View style={styles.noteLinesBg}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.noteLine} />
                  ))}
                </View>
                <TextInput
                  style={styles.noteInput}
                  placeholder={t('add.note_placeholder')}
                  placeholderTextColor={Colors.inkLight}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={200}
                />
                <View style={styles.noteFooterRow}>
                  <Text style={styles.noteCounter}>{note.length}/200</Text>
                </View>
              </View>
            </PaperCard>

            {/* 贴纸库 */}
            <FieldLabel label={t('add.sticker_section')} />
            <PaperCard tape="green" rotate={0} padding={12} showTape>
              <TouchableOpacity
                style={styles.stickerOpenBtn}
                onPress={() => setStickerLibVisible(true)}
              >
                <Ionicons name="happy-outline" size={16} color={Colors.olive} />
                <Text style={styles.stickerOpenText}>{t('add.open_sticker')}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.inkLight} />
              </TouchableOpacity>
              {pastedStickers.length > 0 ? (
                <View style={styles.pastedRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {pastedStickers.map((s, i) => (
                      <View key={`${s.id}-${i}`} style={styles.pastedChip}>
                        {s.uri ? (
                          <Image source={{ uri: s.uri }} style={styles.pastedDiyImg} resizeMode="contain" />
                        ) : (
                          <View style={styles.pastedSvgWrap}>{s.svg}</View>
                        )}
                        <TouchableOpacity
                          style={styles.pastedRemove}
                          onPress={() => setPastedStickers((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Ionicons name="close-circle" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <Text style={styles.pastedHint}>{t('add.pasted_count', { n: pastedStickers.length })}</Text>
                </View>
              ) : null}
            </PaperCard>
          </ScrollView>

          {/* 底部按钮 */}
          <View style={styles.footer}>
            {editingId ? (
              <Pressable style={styles.deleteBtn} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </Pressable>
            ) : null}
            {editingId ? (
              <Pressable style={styles.recipeBtn} onPress={onSaveRecipe}>
                <Ionicons name="book-outline" size={18} color={Colors.olive} />
                <Text style={styles.recipeBtnText}>{t('add.recipe')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.saveBtn, editingId ? { flex: 1 } : null]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t('add.saving') : editingId ? t('add.save_edit') : t('add.save')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* 速记模板弹层（AI 平替，无需 API） */}
        <Modal visible={tplVisible} transparent animationType="slide" onRequestClose={() => setTplVisible(false)}>
          <Pressable style={styles.tplOverlay} onPress={() => setTplVisible(false)}>
            <Pressable style={styles.tplSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.tplHeader}>
                <Text style={styles.tplTitle}>{t('add.tpl_title')}</Text>
                <TouchableOpacity onPress={() => setTplVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.ink} />
                </TouchableOpacity>
              </View>
              <Text style={styles.tplHint}>{t('add.tpl_hint')}</Text>

              {/* 餐次切换 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tplMealRow}>
                {MEAL_ORDER.map((mt) => {
                  const m = Meals[mt];
                  const active = tplMeal === mt;
                  return (
                    <TouchableOpacity
                      key={mt}
                      style={[styles.tplMealChip, active && { backgroundColor: m.color, borderColor: m.color }]}
                      onPress={() => setTplMeal(mt)}
                    >
                      <Text style={[styles.tplMealChipText, active && { color: Colors.note }]}>
                        {t(MEAL_T_KEY[mt])}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 模板网格 */}
              <FlatList
                data={TEMPLATES_BY_MEAL[tplMeal]}
                keyExtractor={(item) => item.key}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.tplGrid}
                renderItem={({ item }) => {
                  const m = Meals[item.meal];
                  return (
                    <TouchableOpacity
                      style={[styles.tplCard, { borderColor: m.color + '55' }]}
                      onPress={() => applyTemplate(item)}
                    >
                      <View style={[styles.tplCardIcon, { backgroundColor: m.color + '18' }]}>
                        <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={m.color} />
                      </View>
                      <Text style={styles.tplCardName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.tplCardAmount}>¥{item.amount.toFixed(0)}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* 贴纸库弹层 */}
        <StickerLibrary
          visible={stickerLibVisible}
          onClose={() => setStickerLibVisible(false)}
          onPick={(s) => setPastedStickers((prev) => [...prev, s])}
          diyStickers={diyStickers.map((d) => ({ id: d.id, kind: 'diy' as const, label: d.label, uri: d.uri }))}
          onAddDiy={(s) => addDiySticker({ id: s.id, label: s.label, uri: s.uri! })}
        />
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

// 附加照片缩略条：管理多图（首图为 PhotoPicker 封面，此处为额外图）
function ExtraPhotosBar({
  photos,
  accent,
  onChange,
}: {
  photos: string[];
  accent: string;
  onChange: (next: string[]) => void;
}) {
  const onAdd = async () => {
    if (photos.length >= 6) {
      showDialog({
        title: t('common.tip'),
        message: t('add.extra_photos_max'),
        icon: 'alert-circle-outline',
      });
      return;
    }
    const uris = await pickMultiPhotos(6 - photos.length);
    if (uris.length) {
      onChange([...photos, ...uris]);
    }
  };

  const onRemove = (i: number) => {
    onChange(photos.filter((_, idx) => idx !== i));
  };

  if (photos.length === 0) {
    return (
      <TouchableOpacity style={styles.extraAddBtn} onPress={onAdd}>
        <Ionicons name="add-circle-outline" size={16} color={accent} />
        <Text style={[styles.extraAddText, { color: accent }]}>{t('add.add_more_photos')}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.extraBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.extraScroll}>
        {photos.map((u, i) => (
          <View key={u} style={styles.polaroidThumb}>
            <View style={styles.polaroidThumbInner}>
              <Image source={{ uri: u }} style={styles.polaroidThumbImg} />
            </View>
            <View style={styles.polaroidThumbBottom} />
            <TouchableOpacity style={styles.polaroidThumbRemove} onPress={() => onRemove(i)}>
              <Ionicons name="close-circle" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 6 ? (
          <TouchableOpacity style={styles.extraAddSquare} onPress={onAdd}>
            <Ionicons name="add" size={22} color={Colors.inkLight} />
            <Text style={styles.extraAddSquareText}>{t('add.add_photo')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
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
  tplBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: Colors.ochre + '22',
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.ochre,
  },
  tplBtnText: {
    color: Colors.ochre,
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // 速记模板弹层
  tplOverlay: {
    flex: 1,
    backgroundColor: 'rgba(40,30,20,0.5)',
    justifyContent: 'flex-end',
  },
  tplSheet: {
    backgroundColor: Colors.note,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
    maxHeight: '75%',
  },
  tplHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tplTitle: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  tplHint: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  tplMealRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tplMealChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    marginRight: 8,
  },
  tplMealChipText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.inkSoft,
  },
  tplGrid: {
    gap: 10,
  },
  tplCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1.2,
    backgroundColor: Colors.paperLight,
    gap: 6,
  },
  tplCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tplCardName: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
  },
  tplCardAmount: {
    fontSize: 12,
    color: Colors.stamp,
    fontFamily: Fonts.serif,
    fontWeight: '600',
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
  noteBox: { position: 'relative', minHeight: 110, padding: 12 },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  noteHeaderHint: {
    fontSize: 11,
    color: Colors.ochre,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  noteLinesBg: {
    position: 'absolute',
    top: 38,
    left: 12,
    right: 12,
    bottom: 30,
  },
  noteLine: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lineSoft,
    marginVertical: 11,
    opacity: 0.6,
  },
  noteFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  noteCounter: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  noteInput: {
    padding: 0,
    fontSize: 15,
    color: Colors.ink,
    fontFamily: Fonts.hand,
    textAlignVertical: 'top',
    minHeight: 96,
    lineHeight: 24,
    zIndex: 2,
  },
  // 附加照片缩略条
  extraAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    backgroundColor: Colors.paperLight,
  },
  extraAddText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  extraBar: {
    marginTop: 10,
  },
  extraScroll: {
    gap: 10,
    paddingRight: 4,
  },
  polaroidThumb: {
    position: 'relative',
    backgroundColor: Colors.note,
    padding: 4,
    paddingBottom: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(61,46,31,0.15)',
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  polaroidThumbInner: {
    width: 64,
    height: 64,
    overflow: 'hidden',
  },
  polaroidThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  polaroidThumbBottom: {
    height: 8,
  },
  polaroidThumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.note,
    borderRadius: 9,
    zIndex: 3,
  },
  extraAddSquare: {
    width: 72,
    height: 80,
    borderRadius: 3,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  extraAddSquareText: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
  },
  // 贴纸库入口
  stickerOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
    backgroundColor: Colors.paperLight,
  },
  stickerOpenText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  pastedRow: {
    marginTop: 10,
    gap: 6,
  },
  pastedChip: {
    position: 'relative',
    marginRight: 10,
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.note,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastedSvgWrap: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastedDiyImg: {
    width: 40,
    height: 40,
  },
  pastedRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.note,
    borderRadius: 8,
    zIndex: 3,
  },
  pastedHint: {
    fontSize: 10,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    marginTop: 2,
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
  recipeBtn: {
    width: 64,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  recipeBtnText: {
    fontSize: 11,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.olive,
    letterSpacing: 1,
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
