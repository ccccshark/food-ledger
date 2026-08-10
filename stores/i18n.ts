import { create } from 'zustand';
import type { AppLang } from '@/types';
import * as dao from '@/db';

interface I18nState {
  lang: AppLang;
  setLang: (lang: AppLang) => Promise<void>;
  init: () => Promise<void>;
}

export const useI18nStore = create<I18nState>((set) => ({
  lang: 'zh-CN',
  setLang: async (lang) => {
    await dao.setSetting('lang', lang);
    set({ lang });
  },
  init: async () => {
    const raw = await dao.getSetting('lang');
    if (raw === 'zh-CN' || raw === 'zh-TW' || raw === 'ja') {
      set({ lang: raw });
    }
  },
}));
