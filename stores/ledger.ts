import { create } from 'zustand';
import type {
  LedgerRecord,
  RecordInput,
  MonthSummary,
  DaySummary,
  MealType,
  LocationAgg,
  Book,
  BookKind,
  Recipe,
  RecipeInput,
} from '@/types';
import * as dao from '@/db';
import { AiConfig, DEFAULT_AI_CONFIG } from '@/services/ai';
import { syncWidgetFromState } from '@/utils/widget';

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
  diyStickers: { id: string; label: string; uri: string }[];

  // 账本
  books: Book[];
  currentBookId: number; // 默认 1（日常账本）

  // 食谱
  recipes: Recipe[];

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
  refreshDiyStickers: () => Promise<void>;
  addDiySticker: (s: { id: string; label: string; uri: string }) => Promise<void>;
  setCurrentMonth: (m: string) => void;
  addRecord: (input: RecordInput) => Promise<number>;
  updateRecord: (id: number, input: RecordInput) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
  setBudget: (amount: number) => Promise<void>;

  // 账本动作
  refreshBooks: () => Promise<void>;
  setCurrentBook: (id: number) => Promise<void>;
  addBook: (input: { name: string; kind?: BookKind; color?: string }) => Promise<void>;
  updateBook: (id: number, input: Partial<{ name: string; kind: BookKind; color: string }>) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
  refreshAllForBook: () => Promise<void>; // 切换账本后刷新所有依赖数据

  // 食谱动作
  refreshRecipes: () => Promise<void>;
  saveRecipe: (input: RecipeInput, id?: number) => Promise<number>;
  deleteRecipe: (id: number) => Promise<void>;
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
  diyStickers: [],
  books: [],
  currentBookId: 1,
  recipes: [],
  currentMonth: currentMonthStr(),
  currentDate: todayStr(),

  refreshToday: async () => {
    const date = get().currentDate;
    const bookId = get().currentBookId;
    const [summary, allMonth] = await Promise.all([
      dao.getDaySummary(date, bookId),
      dao.listRecordsByMonth(date.slice(0, 7), bookId),
    ]);
    const todayRecords = allMonth.filter((r) => r.date === date);
    set({ today: summary, todayRecords });
    // 同步桌面小组件数据
    syncWidgetFromState({
      todayTotal: summary.total,
      todayCount: summary.count,
      currentBook: get().books.find((b) => b.id === bookId),
    });
  },

  refreshMonth: async (month?: string) => {
    const m = month ?? get().currentMonth;
    const bookId = get().currentBookId;
    const [summary, records] = await Promise.all([
      dao.getMonthSummary(m, bookId),
      dao.listRecordsByMonth(m, bookId),
    ]);
    set({ monthSummary: summary, monthRecords: records, currentMonth: m });
  },

  refreshAllRecords: async () => {
    const bookId = get().currentBookId;
    const records = await dao.listAllRecords(bookId);
    set({ allRecords: records });
  },

  refreshRecentDaily: async (days = 7) => {
    const bookId = get().currentBookId;
    const rows = await dao.getRecentDailyTotals(days, bookId);
    set({ recentDaily: rows });
  },

  refreshMonthlyTotals: async () => {
    const bookId = get().currentBookId;
    const rows = await dao.getMonthlyTotals(bookId);
    set({ monthlyTotals: rows });
  },

  refreshBudget: async () => {
    const raw = await dao.getSetting('monthlyBudget');
    set({ budget: raw ? Number(raw) : 0 });
  },

  refreshTags: async () => {
    const bookId = get().currentBookId;
    const tags = await dao.getExistingTags(bookId);
    set({ existingTags: tags });
  },

  refreshLocations: async () => {
    const bookId = get().currentBookId;
    const locs = await dao.getLocations(bookId);
    set({ locations: locs });
  },

  refreshMonthCalendar: async (month?: string) => {
    const m = month ?? get().currentMonth;
    const bookId = get().currentBookId;
    const rows = await dao.getMonthCalendar(m, bookId);
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

  refreshDiyStickers: async () => {
    const raw = await dao.getSetting('diyStickers');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ diyStickers: parsed });
          return;
        }
      } catch {
        /* ignore */
      }
    }
    set({ diyStickers: [] });
  },

  addDiySticker: async (s) => {
    const next = [...get().diyStickers, s];
    await dao.setSetting('diyStickers', JSON.stringify(next));
    set({ diyStickers: next });
  },

  setCurrentMonth: (m) => set({ currentMonth: m }),

  addRecord: async (input) => {
    // 注入当前账本 id
    const bookId = get().currentBookId;
    const id = await dao.insertRecord({ ...input, book_id: bookId });
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

  // ---------- 账本 ----------
  refreshBooks: async () => {
    const books = await dao.listBooks();
    set({ books });
    // 持久化当前账本选择
    const raw = await dao.getSetting('currentBookId');
    const persisted = raw ? Number(raw) : 0;
    const current = get().currentBookId;
    if (persisted && persisted !== current && books.some((b) => b.id === persisted)) {
      await get().setCurrentBook(persisted);
    } else if (!books.some((b) => b.id === current)) {
      // 当前账本被删除，回退到 1
      await get().setCurrentBook(1);
    }
  },

  setCurrentBook: async (id) => {
    await dao.setSetting('currentBookId', String(id));
    set({ currentBookId: id });
    await get().refreshAllForBook();
  },

  addBook: async (input) => {
    await dao.addBook(input);
    await get().refreshBooks();
  },

  updateBook: async (id, input) => {
    await dao.updateBook(id, input);
    await get().refreshBooks();
  },

  deleteBook: async (id) => {
    await dao.deleteBook(id);
    if (get().currentBookId === id) {
      set({ currentBookId: 1 });
      await dao.setSetting('currentBookId', '1');
    }
    await get().refreshBooks();
    await get().refreshAllForBook();
  },

  refreshAllForBook: async () => {
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

  // ---------- 食谱 ----------
  refreshRecipes: async () => {
    const recipes = await dao.listRecipes();
    set({ recipes });
  },

  saveRecipe: async (input, id) => {
    const newId = id
      ? (await dao.updateRecipe(id, input), id)
      : await dao.insertRecipe(input);
    await get().refreshRecipes();
    return newId;
  },

  deleteRecipe: async (id) => {
    await dao.deleteRecipe(id);
    await get().refreshRecipes();
  },
}));

export function orderedMeals(meals: MealType[]): MealType[] {
  const order = ['breakfast', 'lunch', 'dinner', 'snack', 'supper'];
  return [...meals].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export { todayStr, currentMonthStr };
