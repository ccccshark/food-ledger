import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDialogStore } from '@/stores/dialog';
import { Colors, Fonts } from '@/constants/theme';
import { Tape } from './Decorations';

// 全局弹窗宿主：挂在根布局，由 dialog store 驱动
export function DialogHost() {
  const visible = useDialogStore((s) => s.visible);
  const title = useDialogStore((s) => s.title);
  const message = useDialogStore((s) => s.message);
  const buttons = useDialogStore((s) => s.buttons);
  const icon = useDialogStore((s) => s.icon);
  const input = useDialogStore((s) => s.input);
  const inputValue = useDialogStore((s) => s.inputValue);
  const setInputValue = useDialogStore((s) => s.setInputValue);
  const close = useDialogStore((s) => s.close);

  if (!visible) return null;

  const handlePress = (btn: (typeof buttons)[number]) => {
    Keyboard.dismiss();
    close();
    // 延迟回调，确保弹窗已关闭再执行
    if (btn.onPress) {
      requestAnimationFrame(btn.onPress);
    }
  };

  const hasInput = !!input;
  const primaryBtn = buttons.find((b) => b.style !== 'cancel');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.mask} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* 顶部胶带装饰 */}
          <View style={styles.tapeWrap}>
            <Tape
              color={primaryBtn?.style === 'destructive' ? 'pink' : 'yellow'}
              width={64}
              height={16}
              rotate={-5}
            />
          </View>

          {/* 图标 */}
          {icon ? (
            <View
              style={[
                styles.iconWrap,
                {
                  borderColor:
                    primaryBtn?.style === 'destructive'
                      ? Colors.danger
                      : Colors.stamp,
                },
              ]}
            >
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={
                  primaryBtn?.style === 'destructive'
                    ? Colors.danger
                    : Colors.stamp
                }
              />
            </View>
          ) : null}

          {/* 标题 */}
          <Text style={styles.title}>{title}</Text>

          {/* 消息 */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* 输入框 */}
          {hasInput ? (
            <View style={styles.inputRow}>
              {input?.prefix ? (
                <Text style={styles.inputPrefix}>{input.prefix}</Text>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder={input?.placeholder}
                placeholderTextColor={Colors.inkLight}
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType={input?.keyboardType ?? 'default'}
                autoFocus={input?.autoFocus !== false}
                returnKeyType="done"
              />
            </View>
          ) : null}

          {/* 按钮 */}
          <View
            style={[
              styles.btnRow,
              buttons.length === 1 && styles.btnRowSingle,
            ]}
          >
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    isCancel && styles.btnCancel,
                    isDestructive && styles.btnDestructive,
                    !isCancel && !isDestructive && styles.btnPrimary,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isCancel && styles.btnTextCancel,
                      isDestructive && styles.btnTextDestructive,
                      !isCancel && !isDestructive && styles.btnTextPrimary,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(61, 46, 31, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  card: {
    backgroundColor: Colors.note,
    borderRadius: 6,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
    shadowColor: '#3D2E1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  tapeWrap: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperLight,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  message: {
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontFamily: Fonts.serif,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.line,
    paddingBottom: 6,
    width: '100%',
  },
  inputPrefix: {
    fontSize: 22,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    color: Colors.ink,
    padding: 0,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  btnRowSingle: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnCancel: {
    backgroundColor: Colors.paperLight,
    borderColor: Colors.line,
  },
  btnPrimary: {
    backgroundColor: Colors.stamp,
    borderColor: Colors.ink,
  },
  btnDestructive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.ink,
  },
  btnText: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    fontWeight: '600',
  },
  btnTextCancel: {
    color: Colors.inkSoft,
  },
  btnTextPrimary: {
    color: Colors.note,
    fontWeight: '700',
    letterSpacing: 2,
  },
  btnTextDestructive: {
    color: Colors.note,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
