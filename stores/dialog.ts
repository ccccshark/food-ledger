import { create } from 'zustand';

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface DialogConfig {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  icon?: string;
  input?: {
    placeholder?: string;
    value?: string;
    keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address';
    prefix?: string; // 如 ¥
    autoFocus?: boolean;
  };
  // 选中态：选中第几个按钮作为高亮（如 destructive）
}

interface DialogState extends Omit<DialogConfig, 'buttons'> {
  visible: boolean;
  inputValue: string;
  buttons: DialogButton[];

  show: (config: DialogConfig) => void;
  setInputValue: (v: string) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  inputValue: '',

  show: (config) =>
    set({
      visible: true,
      title: config.title,
      message: config.message,
      icon: config.icon,
      input: config.input,
      inputValue: config.input?.value ?? '',
      buttons:
        config.buttons ??
        [{ text: '知道了', style: 'default' as const }],
    }),

  setInputValue: (v) => set({ inputValue: v }),

  close: () => set({ visible: false }),
}));

// 命令式调用（替代 Alert.alert）
export function showDialog(config: DialogConfig): void {
  useDialogStore.getState().show(config);
}

export function closeDialog(): void {
  useDialogStore.getState().close();
}

// 便捷封装：确认弹窗
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
): void {
  showDialog({
    title,
    message,
    buttons: [
      { text: options?.cancelText ?? '取消', style: 'cancel' },
      {
        text: options?.confirmText ?? '确定',
        style: options?.destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ],
  });
}
