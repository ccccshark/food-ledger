import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { showDialog } from '@/stores/dialog';
import { Colors, Fonts } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape } from '@/components/Decorations';
import { PhotoPicker } from '@/components/PhotoPicker';
import { t, useT } from '@/constants/i18n';
import type { PhotoStyle, PhotoShape } from '@/types';
import * as dao from '@/db';

export default function RecipeScreen() {
  useT(); // subscribe to lang changes for re-render
  const params = useLocalSearchParams<{ id?: string; recordId?: string }>();
  const saveRecipe = useLedgerStore((s) => s.saveRecipe);
  const deleteRecipe = useLedgerStore((s) => s.deleteRecipe);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [linkedRecordId, setLinkedRecordId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoStyle, setPhotoStyle] = useState<PhotoStyle>('polaroid');
  const [photoShape, setPhotoShape] = useState<PhotoShape>('square');
  const [saving, setSaving] = useState(false);
  const navigatingAway = useRef(false);

  useEffect(() => {
    if (params.id) {
      const id = Number(params.id);
      dao.getRecipe(id).then((r) => {
        if (r) {
          setEditingId(id);
          setName(r.name);
          setServings(String(r.servings));
          setIngredients(r.ingredients);
          setSteps(r.steps);
          setPhotoUri(r.photo_uri ?? null);
          setLinkedRecordId(r.linked_record_id ?? null);
        } else {
          showDialog({
            title: t('common.tip'),
            message: t('recipe.not_exist'),
            icon: 'alert-circle-outline',
            buttons: [{ text: t('common.back'), onPress: () => router.back() }],
          });
        }
      });
    } else if (params.recordId) {
      const rid = Number(params.recordId);
      dao.getRecord(rid).then((r) => {
        if (r) {
          setLinkedRecordId(rid);
          const tagsFirst = r.tags ? r.tags.split(',')[0]?.trim() : '';
          const firstName = r.note?.trim() || tagsFirst || '';
          setName(firstName);
          setPhotoUri(r.photo_uri ?? null);
        }
      });
    }
  }, [params.id, params.recordId]);

  const onSave = async () => {
    if (navigatingAway.current) return;
    const trimName = name.trim();
    if (!trimName) {
      showDialog({
        title: t('common.tip'),
        message: t('recipe.fill_name'),
        icon: 'alert-circle-outline',
      });
      return;
    }
    const serv = parseInt(servings, 10);
    const finalServings = isNaN(serv) || serv <= 0 ? 1 : serv;
    setSaving(true);
    try {
      const input = {
        name: trimName,
        ingredients: ingredients.trim(),
        steps: steps.trim(),
        photo_uri: photoUri,
        servings: finalServings,
        linked_record_id: linkedRecordId,
      };
      await saveRecipe(input, editingId ?? undefined);
      navigatingAway.current = true;
      Keyboard.dismiss();
      requestAnimationFrame(() => router.back());
    } catch (e: any) {
      navigatingAway.current = false;
      showDialog({
        title: t('recipe.save_failed'),
        message: e?.message ?? t('common.unknown_error'),
        icon: 'alert-circle-outline',
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    showDialog({
      title: t('recipe.delete_title'),
      message: t('recipe.delete_msg'),
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
              await deleteRecipe(editingId);
              Keyboard.dismiss();
              requestAnimationFrame(() => router.back());
            } catch (e: any) {
              navigatingAway.current = false;
              showDialog({
                title: t('recipe.delete_failed'),
                message: e?.message ?? t('common.unknown_error'),
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="yellow" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>{t('recipe.title')}</Text>
          </View>
          <View style={{ width: 40 }} />
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
            {/* 菜谱名 */}
            <FieldLabel label={t('recipe.name')} required />
            <PaperCard tape="pink" rotate={0} padding={12} showTape={false}>
              <TextInput
                style={styles.nameInput}
                placeholder={t('recipe.name_placeholder')}
                placeholderTextColor={Colors.inkLight}
                value={name}
                onChangeText={setName}
                maxLength={40}
              />
            </PaperCard>

            {/* 份数 */}
            <FieldLabel label={t('recipe.servings')} />
            <View style={styles.servingsRow}>
              {[1, 2, 3, 4].map((n) => {
                const active = servings === String(n);
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.servingsChip,
                      active && { backgroundColor: Colors.stamp, borderColor: Colors.stamp },
                    ]}
                    onPress={() => setServings(String(n))}
                  >
                    <Text style={[styles.servingsText, active && { color: Colors.note }]}>
                      {t('recipe.servings_unit', { n })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.servingsInputWrap}>
                <TextInput
                  style={styles.servingsInput}
                  keyboardType="numeric"
                  placeholder={t('recipe.servings_custom')}
                  placeholderTextColor={Colors.inkLight}
                  value={servings}
                  onChangeText={setServings}
                  maxLength={3}
                />
                <Text style={styles.servingsSuffix}>{t('recipe.servings_unit_label')}</Text>
              </View>
            </View>

            {/* 食材 */}
            <FieldLabel label={t('recipe.ingredients')} />
            <PaperCard tape="green" rotate={0} padding={0} showTape>
              <View style={styles.noteBox}>
                <View style={styles.noteHeaderRow}>
                  <Ionicons name="nutrition-outline" size={13} color={Colors.olive} />
                  <Text style={styles.noteHeaderHint}>{t('recipe.ingredients_hint')}</Text>
                </View>
                <View style={styles.noteLinesBg}>
                  {[0, 1].map((i) => (
                    <View key={i} style={styles.noteLine} />
                  ))}
                </View>
                <TextInput
                  style={styles.noteInput}
                  placeholder={t('recipe.ingredients_placeholder')}
                  placeholderTextColor={Colors.inkLight}
                  value={ingredients}
                  onChangeText={setIngredients}
                  multiline
                  maxLength={300}
                />
              </View>
            </PaperCard>

            {/* 步骤 */}
            <FieldLabel label={t('recipe.steps')} />
            <PaperCard tape="blue" rotate={0} padding={0} showTape>
              <View style={styles.stepsBox}>
                <View style={styles.noteHeaderRow}>
                  <Ionicons name="list-outline" size={13} color={Colors.olive} />
                  <Text style={styles.noteHeaderHint}>{t('recipe.steps_hint')}</Text>
                </View>
                <View style={styles.stepsLinesBg}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.noteLine} />
                  ))}
                </View>
                <TextInput
                  style={styles.stepsInput}
                  placeholder={t('recipe.steps_placeholder')}
                  placeholderTextColor={Colors.inkLight}
                  value={steps}
                  onChangeText={setSteps}
                  multiline
                  maxLength={800}
                />
              </View>
            </PaperCard>

            {/* 成品照片 */}
            <FieldLabel label={t('recipe.finished_photo')} />
            <PhotoPicker
              uri={photoUri}
              onChange={setPhotoUri}
              style={photoStyle}
              onStyleChange={setPhotoStyle}
              shape={photoShape}
              onShapeChange={setPhotoShape}
              accent={Colors.ochre}
            />
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
                {saving ? t('recipe.saving') : editingId ? t('recipe.save_edit') : t('recipe.save')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Tape color="green" width={12} height={8} rotate={-6} />
      <Text style={styles.fieldLabel}>{label}</Text>
      {required ? <Text style={styles.required}>*</Text> : null}
    </View>
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
  body: { flex: 1, paddingHorizontal: 18 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 14,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.inkSoft,
    letterSpacing: 1,
  },
  required: {
    fontSize: 14,
    color: Colors.stamp,
    fontFamily: Fonts.serif,
  },
  nameInput: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
    padding: 0,
  },
  servingsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  servingsChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
  },
  servingsText: { fontSize: 13, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.inkSoft },
  servingsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    backgroundColor: Colors.paperLight,
    gap: 4,
  },
  servingsInput: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '600',
    color: Colors.ink,
    padding: 0,
    minWidth: 30,
    textAlign: 'center',
  },
  servingsSuffix: { fontSize: 13, fontFamily: Fonts.serif, color: Colors.inkSoft },
  noteBox: { position: 'relative', minHeight: 80, padding: 12 },
  stepsBox: { position: 'relative', minHeight: 130, padding: 12 },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  noteHeaderHint: {
    fontSize: 11,
    color: Colors.olive,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  noteLinesBg: {
    position: 'absolute',
    top: 38,
    left: 12,
    right: 12,
    bottom: 14,
  },
  stepsLinesBg: {
    position: 'absolute',
    top: 38,
    left: 12,
    right: 12,
    bottom: 14,
  },
  noteLine: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lineSoft,
    marginVertical: 11,
    opacity: 0.6,
  },
  noteInput: {
    padding: 0,
    fontSize: 15,
    color: Colors.ink,
    fontFamily: Fonts.hand,
    textAlignVertical: 'top',
    minHeight: 56,
    lineHeight: 24,
    zIndex: 2,
  },
  stepsInput: {
    padding: 0,
    fontSize: 15,
    color: Colors.ink,
    fontFamily: Fonts.hand,
    textAlignVertical: 'top',
    minHeight: 100,
    lineHeight: 24,
    zIndex: 2,
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
});
