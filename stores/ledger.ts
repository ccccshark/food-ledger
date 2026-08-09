import { create } from 'zustand';
import type {
  LedgerRecord,
  RecordInput,
  MonthSummary,
  DaySummary,
  MealType,
  LocationAgg,
} from '@/types';
import * as dao from '@/db';
import { AiConfig, DEFAULT_AI_CONFIG } from '@/services/ai';

interface LedgerState {
  // 数据
  today: DaySummary | null;
  todayRecords: LedgerRecord[];
  monthSummary: MonthSummary | null;
  monthRecords: LedgerRecord[];
  allRecords: LedgerRecord[];
  monthlyTotals: { month: string; total: number }[];
  recentDaily: DaySummary[];
  monthCalendar: DaySummary[];
  budget: number;
  existingTags: string[];
  locations: LocationAgg[];
  aiConfig: AiConfig;

  // 选中状态
  currentMonth: string; // YYYY-MM
  currentDate: string;  // YYYY-MM-DD

  // 动作
  refreshToday: () => Promise<void>;
  refreshMonth: (month?: string) => Promise<void>;
  refreshAllRecords: () => Promise<void>;
  refreshRecentDaily: (days?: number) => Promise<void>;
  refreshMonthlyTotals: () => Promise<void>;
  refreshBudget: () => Promise<void>;
  refreshTags: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshMonthCalendar: (month?: string) => Promise<void>;
  refreshAiConfig: () => Promise<void>;
  setAiConfig: (cfg: AiConfig) => Promise<void>;
  setCurrentMonth: (m: string) => void;
  addRecord: (input: RecordInput) => Promise<number>;
  updateRecord: (id: number, input: RecordInput) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentMonthStr(): string {
  return todayStr().slice(0, 7);
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  today: null,
  todayRecords: [],
  monthSummary: null,
  monthRecords: [],
  allRecords: [],
  monthlyTotals: [],
  recentDaily: [],
  monthCalendar: [],
  budget: 0,
  existingTags: [],
  locations: [],
  aiConfig: DEFAULT_AI_CONFIG,
  currentMonth: currentMonthStr(),
  currentDate: todayStr(),

  refreshToday: async () => {
    const date = get().currentDate;
    const [summary, allMonth] = await Promise.all([
      dao.getDaySummary(date),
      dao.listRecordsByMonth(date.slice(0, 7)),
    ]);
    const todayRecords = allMonth.filter((r) => r.date === date);
    set({ today: summary, todayRecords });
  },

  refreshMonth: async (month?: string) => {
    const m = month ?? get().currentMonth;
    const [summary, records] = await Promise.all([
      dao.getMonthSummary(m),
      dao.listRecordsByMonth(m),
    ]);
    set({ monthSummary: summary, monthRecords: records, currentMonth: m });
  },

  refreshAllRecords: async () => {
    const records = await dao.listAllRecords();
    set({ allRecords: records });
  },

  refreshRecentDaily: async (days = 7) => {
    const rows = await dao.getRecentDailyTotals(days);
    set({ recentDaily: rows });
  },

  refreshMonthlyTotals: async () => {
    const rows = await dao.getMonthlyTotals();
    set({ monthlyTotals: rows });
  },

  refreshBudget: async () => {
    const raw = await dao.getSetting('monthlyBudget');
    set({ budget: raw ? Number(raw) : 0 });
  },

  refreshTags: async () => {
    const tags = await dao.getExistingTags();
    set({ existingTags: tags });
  },

  refreshLocations: async () => {
    const locs = await dao.getLocations();
    set({ locations: locs });
  },

  refreshMonthCalendar: async (month?: string) => {
    const m = month ?? get().currentMonth;
    const rows = await dao.getMonthCalendar(m);
    set({ monthCalendar: rows });
  },

  refreshAiConfig: async () => {
    const raw = await dao.getSetting('aiConfig');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        set({ aiConfig: { ...DEFAULT_AI_CONFIG, ...parsed } });
      } catch {
        set({ aiConfig: DEFAULT_AI_CONFIG });
      }
    } else {
      set({ aiConfig: DEFAULT_AI_CONFIG });
    }
  },

  setAiConfig: async (cfg) => {
    await dao.setSetting('aiConfig', JSON.stringify(cfg));
    set({ aiConfig: cfg });
  },

  setCurrentMonth: (m) => set({ currentMonth: m }),

  addRecord: async (input) => {
    const id = await dao.insertRecord(input);
    await Promise.all([
      get().refreshToday(),
      get().refreshMonth(),
      get().refreshAllRecords(),
      get().refreshRecentDaily(),
      get().refreshTags(),
      get().refreshLocations(),
      get().refreshMonthCalendar(),
      get().refreshMonthlyTotals(),
    ]);
    return id;
  },

  updateRecord: async (id, input) => {
    await dao.updateRecord(id, input);
    await Promise.all([
      get().refreshToday(),
      get().refreshMonth(),
      get().refreshAllRecords(),
      get().refreshRecentDaily(),
      get().refreshTags(),
      get().refreshLocations(),
      get().refreshMonthCalendar(),
      get().refreshMonthlyTotals(),
    ]);
  },

  deleteRecord: async (id) => {
    await dao.deleteRecord(id);
    await Promise.all([
      get().refreshToday(),
      get().refreshMonth(),
      get().refreshAllRecords(),
      get().refreshRecentDaily(),
      get().refreshTags(),
      get().refreshLocations(),
      get().refreshMonthCalendar(),
      get().refreshMonthlyTotals(),
    ]);
  },

  setBudget: async (amount) => {
    await dao.setSetting('monthlyBudget', String(amount));
    set({ budget: amount });
  },
}));

export function orderedMeals(meals: MealType[]): MealType[] {
  const order = ['breakfast', 'lunch', 'dinner', 'snack', 'supper'];
  return [...meals].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export { todayStr, currentMonthStr };
