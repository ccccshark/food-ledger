import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLedgerStore } from '@/stores/ledger';
import { showDialog } from '@/stores/dialog';
import { Colors, Fonts } from '@/constants/theme';
import { PaperBackground } from '@/components/PaperBackground';
import { PaperCard, Tape, DashedDivider } from '@/components/Decorations';
import { AiConfig, DEFAULT_AI_CONFIG, recognizeFood } from '@/services/ai';
import * as ImagePicker from 'expo-image-picker';

export default function AiSettingsScreen() {
  const aiConfig = useLedgerStore((s) => s.aiConfig);
  const refreshAiConfig = useLedgerStore((s) => s.refreshAiConfig);
  const setAiConfig = useLedgerStore((s) => s.setAiConfig);

  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [model, setModel] = useState(aiConfig.model);
  const [enabled, setEnabled] = useState(aiConfig.enabled);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    refreshAiConfig();
  }, []);

  // 同步外部更新
  useEffect(() => {
    setBaseUrl(aiConfig.baseUrl);
    setApiKey(aiConfig.apiKey);
    setModel(aiConfig.model);
    setEnabled(aiConfig.enabled);
  }, [aiConfig]);

  const onSave = async () => {
    const cfg: AiConfig = {
      baseUrl: baseUrl.trim() || DEFAULT_AI_CONFIG.baseUrl,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_AI_CONFIG.model,
      enabled,
    };
    await setAiConfig(cfg);
    showDialog({
      title: '已保存',
      message: 'AI 配置已保存到本地',
      icon: 'checkmark-circle-outline',
      buttons: [{ text: '好的', onPress: () => router.back() }],
    });
  };

  const onTest = async () => {
    if (!apiKey.trim()) {
      showDialog({
        title: '提示',
        message: '请先填写 API Key',
        icon: 'alert-circle-outline',
      });
      return;
    }
    setTesting(true);
    try {
      // 选一张图测试
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showDialog({
          title: '提示',
          message: '需要相册权限才能测试',
          icon: 'alert-circle-outline',
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });
      if (result.canceled || !result.assets?.length) return;

      const cfg: AiConfig = {
        baseUrl: baseUrl.trim() || DEFAULT_AI_CONFIG.baseUrl,
        apiKey: apiKey.trim(),
        model: model.trim() || DEFAULT_AI_CONFIG.model,
        enabled: true,
      };
      const r = await recognizeFood(cfg, result.assets[0].uri);
      showDialog({
        title: '测试成功',
        message: `识别结果：\n金额=${r.amount ?? '—'}\n餐次=${r.meal ?? '—'}\n备注=${r.note ?? '—'}`,
        icon: 'checkmark-circle-outline',
      });
    } catch (e: any) {
      showDialog({
        title: '测试失败',
        message: e?.message ?? '未知错误',
        icon: 'alert-circle-outline',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Tape color="yellow" width={20} height={10} rotate={-5} />
            <Text style={styles.headerTitle}>AI 助手设置</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* 说明 */}
          <View style={styles.px}>
            <PaperCard tape="pink" rotate={0} padding={14} showTape>
              <View style={styles.cardTitleRow}>
                <Ionicons name="bulb-outline" size={16} color={Colors.ochre} />
                <Text style={styles.cardTitle}>关于 AI 识别</Text>
              </View>
              <Text style={styles.desc}>
                采用 OpenAI 兼容协议，支持 OpenAI / 智谱 GLM-4V / 通义千问 VL 等。
                配置后可在记账页用「AI 识别」拍照自动填金额、餐次、标签。
                所有配置仅存于本机。
              </Text>
            </PaperCard>
          </View>

          {/* 平替方案：速记模板 */}
          <View style={styles.px}>
            <PaperCard tape="yellow" rotate={0} padding={14} showTape>
              <View style={styles.cardTitleRow}>
                <Ionicons name="bookmark-outline" size={16} color={Colors.ochre} />
                <Text style={styles.cardTitle}>不想配置？用速记模板</Text>
              </View>
              <Text style={styles.desc}>
                记账页顶部的「速记模板」无需任何 API，点选常见美食即可一键填表
                （金额、餐次、备注、标签自动带入，可再修改）。适合不想折腾配置的用户。
              </Text>
              <TouchableOpacity
                style={styles.guideCta}
                onPress={() => router.push('/add')}
              >
                <Ionicons name="pencil-outline" size={14} color={Colors.note} />
                <Text style={styles.guideCtaText}>去试试速记模板</Text>
              </TouchableOpacity>
            </PaperCard>
          </View>

          {/* 配置引导（新手必看） */}
          <View style={styles.px}>
            <PaperCard tape="blue" rotate={0} padding={14} showTape>
              <View style={styles.cardTitleRow}>
                <Ionicons name="book-outline" size={16} color={Colors.olive} />
                <Text style={styles.cardTitle}>配置引导（推荐智谱 GLM-4V）</Text>
              </View>
              <Text style={styles.stepText}>
                <Text style={styles.stepNum}>1.</Text> 点击下方「智谱 GLM-4V」按钮，自动填好地址和模型名。
              </Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepNum}>2.</Text> 浏览器打开{' '}
                <Text style={styles.linkText}>open.bigmodel.cn</Text>，注册/登录智谱开放平台。
              </Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepNum}>3.</Text> 进入「API Keys」页面，点击「添加新的 API Key」，复制生成的密钥（以 xxxxxx 开头）。
              </Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepNum}>4.</Text> 把密钥粘贴到下方「API Key」输入框。
              </Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepNum}>5.</Text> 打开上方「启用 AI 识别」开关，点「测试识别」选张美食图验证，成功后「保存」即可。
              </Text>
              <Text style={styles.tipText}>
                提示：智谱新用户有免费额度，足够日常记账使用；OpenAI / 通义千问配置方式类似，先选对应预设再填各自的 Key。
              </Text>
            </PaperCard>
          </View>

          {/* 开关 */}
          <View style={styles.px}>
            <PaperCard tape="green" rotate={0} padding={14} showTape={false}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>启用 AI 识别</Text>
                  <Text style={styles.switchHint}>关闭后记账页不显示 AI 入口（速记模板仍可用）</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: Colors.lineSoft, true: Colors.olive }}
                  thumbColor={Colors.note}
                />
              </View>
            </PaperCard>
          </View>

          {/* 配置表单 */}
          <View style={styles.px}>
            <PaperCard tape="yellow" rotate={0} padding={16} showTape={false}>
              <Field label="API Base URL" placeholder="https://api.openai.com/v1" value={baseUrl} onChange={setBaseUrl} />
              <Field label="API Key" placeholder="sk-..." value={apiKey} onChange={setApiKey} secure />
              <Field label="模型名" placeholder="gpt-4o" value={model} onChange={setModel} />

              <DashedDivider />

              <Text style={styles.presetTitle}>常用配置示例（点选自动填入）：</Text>
              <PresetButton label="智谱 GLM-4V（推荐）" desc="glm-4v · open.bigmodel.cn" onPress={() => {
                setBaseUrl('https://open.bigmodel.cn/api/paas/v4');
                setModel('glm-4v');
              }} />
              <PresetButton label="通义千问 VL" desc="qwen-vl-max · dashscope.aliyuncs.com" onPress={() => {
                setBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1');
                setModel('qwen-vl-max');
              }} />
              <PresetButton label="OpenAI" desc="gpt-4o · api.openai.com" onPress={() => {
                setBaseUrl('https://api.openai.com/v1');
                setModel('gpt-4o');
              }} />
            </PaperCard>
          </View>

          {/* 按钮 */}
          <View style={styles.px}>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onTest}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={Colors.olive} />
                ) : (
                  <Text style={styles.btnSecondaryText}>测试识别</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSave}>
                <Text style={styles.btnPrimaryText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  secure,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder={placeholder}
        placeholderTextColor={Colors.inkLight}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function PresetButton({ label, desc, onPress }: { label: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.preset} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.presetLabel}>{label}</Text>
        <Text style={styles.presetDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={Colors.inkLight} />
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
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: 2,
  },
  body: { flex: 1 },
  px: { paddingHorizontal: 18, marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontFamily: Fonts.serif, fontWeight: '700', color: Colors.ink },
  desc: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.serif, lineHeight: 18 },
  guideCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 4,
    backgroundColor: Colors.ochre,
  },
  guideCtaText: {
    color: Colors.note,
    fontSize: 13,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stepText: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontFamily: Fonts.serif,
    lineHeight: 19,
    marginBottom: 4,
  },
  stepNum: {
    color: Colors.olive,
    fontWeight: '700',
  },
  linkText: {
    color: Colors.stamp,
    fontStyle: 'italic',
  },
  tipText: {
    fontSize: 11,
    color: Colors.inkLight,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    lineHeight: 17,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.line,
    borderStyle: 'dashed',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchTitle: { fontSize: 14, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  switchHint: { fontSize: 11, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.serif, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.paperLight,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    borderWidth: 1,
    borderColor: Colors.lineSoft,
  },
  presetTitle: { fontSize: 12, color: Colors.inkLight, fontFamily: Fonts.serif, marginVertical: 8, fontStyle: 'italic' },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
    borderStyle: 'dashed',
  },
  presetLabel: { fontSize: 13, fontFamily: Fonts.serif, fontWeight: '600', color: Colors.ink },
  presetDesc: { fontSize: 10, color: Colors.inkLight, marginTop: 2, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 4, alignItems: 'center' },
  btnSecondary: {
    backgroundColor: Colors.paperLight,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: Colors.olive,
  },
  btnSecondaryText: { color: Colors.olive, fontSize: 15, fontFamily: Fonts.serif, fontWeight: '600' },
  btnPrimary: { backgroundColor: Colors.stamp, borderWidth: 1, borderColor: Colors.ink },
  btnPrimaryText: {
    color: Colors.note,
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
