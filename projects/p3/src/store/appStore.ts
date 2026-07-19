// 全局状态与所有数据变更入口。双模式:
//  - server 模式:探测到后端 → 变更走 /api/action,~4s 轮询 /api/state 刷新;登录用账号密码。
//  - local 模式:无后端(如双击便携版 html)→ 变更走共享 reducer + localStorage,选用户名即进。
// 两模式跑同一份 applyAction(core/reducer),业务行为(锁校验/日志/库存联动)完全一致。
import { create } from 'zustand';
import { applyAction, type Action } from '../core/reducer';
import { uid } from '../utils/id';
import { loadDb, saveDb } from './persist';
import { seedDb } from './seed';
import {
  apiAction,
  apiAddUser,
  apiGetState,
  apiLogin,
  apiLogout,
  apiRemoveUser,
  apiSetPassword,
  checkHealth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from './api';
import type { Db, InventoryMoveType, LogEntry, OrderStatus, Role, SalesInput, StageData, StageKey, User } from '../types';

export type Mode = 'connecting' | 'local' | 'server';

const POLL_MS = 4000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

interface AppState {
  db: Db;
  currentUser: User | null;
  mode: Mode;
  init: () => Promise<void>;
  login: (username: string, password?: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  addUser: (name: string, role: Role, password?: string) => Promise<string | undefined>;
  removeUser: (userId: string) => Promise<string | undefined>;
  changePassword: (userId: string, newPassword: string) => Promise<string | undefined>;
  createOrder: (input: SalesInput) => Promise<{ id?: string; error?: string }>;
  updateSales: (orderId: string, patch: Partial<SalesInput> & { status?: OrderStatus }) => Promise<string | undefined>;
  updateStage: (orderId: string, key: StageKey, patch: Partial<StageData>) => Promise<string | undefined>;
  toggleLock: (orderId: string, target: StageKey | 'sales') => Promise<string | undefined>;
  deleteOrder: (orderId: string) => Promise<string | undefined>;
  addInventoryMove: (m: { productModel: string; type: InventoryMoveType; qty: number; remark?: string }) => Promise<string | undefined>;
  setDefaultCycle: (key: StageKey, days: number) => Promise<void>;
  importDb: (db: Db) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  const localSeed = loadDb() ?? seedDb();

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
  const startPoll = () => {
    stopPoll();
    pollTimer = setInterval(async () => {
      try {
        const { db } = await apiGetState();
        set({ db });
      } catch {
        /* 网络抖动:下次轮询再试 */
      }
    }, POLL_MS);
  };

  /** 统一分发一个变更动作,返回 {db,error,result} */
  const dispatch = async (action: Action): Promise<{ error?: string; result?: { id?: string } }> => {
    if (get().mode === 'server') {
      try {
        const r = await apiAction(action);
        set({ db: r.db });
        return { error: r.error, result: r.result };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }
    // local 模式:跑同一份 reducer,持久化(含 denied 日志),返回错误
    const r = applyAction(get().db, get().currentUser, action);
    saveDb(r.db);
    set({ db: r.db });
    return { error: r.error, result: r.result };
  };

  return {
    db: localSeed,
    currentUser: null,
    mode: 'connecting',

    async init() {
      const online = await checkHealth();
      if (online) {
        set({ mode: 'server' });
        // 有存储 token 则尝试续用会话
        if (getToken()) {
          try {
            const { db } = await apiGetState();
            set({ db, currentUser: getStoredUser() });
            startPoll();
          } catch {
            setToken(null);
            setStoredUser(null);
          }
        }
      } else {
        set({ mode: 'local', db: localSeed });
      }
    },

    async login(username, password) {
      if (get().mode === 'server') {
        try {
          const { token, user } = await apiLogin(username, password ?? '');
          setToken(token);
          setStoredUser(user);
          const { db } = await apiGetState();
          set({ currentUser: user, db });
          startPoll();
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      }
      // local:按用户名选择进入,补一条 login 日志
      const user = get().db.users.find((u) => u.name === username || u.id === username);
      if (!user) return '用户不存在';
      const entry: LogEntry = { id: uid(), time: new Date().toISOString(), userId: user.id, userName: user.name, action: 'login' };
      const db = { ...get().db, logs: [entry, ...get().db.logs] };
      saveDb(db);
      set({ currentUser: user, db });
      return undefined;
    },

    async logout() {
      stopPoll();
      if (get().mode === 'server') {
        await apiLogout();
        setToken(null);
        setStoredUser(null);
      }
      set({ currentUser: null });
    },

    async addUser(name, role, password) {
      if (get().mode === 'server') {
        try {
          const { db } = await apiAddUser(name, role, password ?? '');
          set({ db });
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      }
      return (await dispatch({ type: 'addUser', name, role })).error;
    },

    async removeUser(userId) {
      if (get().mode === 'server') {
        try {
          const { db } = await apiRemoveUser(userId);
          set({ db });
          return undefined;
        } catch (e) {
          return (e as Error).message;
        }
      }
      return (await dispatch({ type: 'removeUser', userId })).error;
    },

    async changePassword(userId, newPassword) {
      if (get().mode !== 'server') return '单机模式无需密码';
      try {
        await apiSetPassword(userId, newPassword);
        return undefined;
      } catch (e) {
        return (e as Error).message;
      }
    },

    async createOrder(input) {
      const { error, result } = await dispatch({ type: 'createOrder', input });
      return { id: result?.id, error };
    },
    async updateSales(orderId, patch) {
      return (await dispatch({ type: 'updateSales', orderId, patch })).error;
    },
    async updateStage(orderId, key, patch) {
      return (await dispatch({ type: 'updateStage', orderId, key, patch })).error;
    },
    async toggleLock(orderId, target) {
      return (await dispatch({ type: 'toggleLock', orderId, target })).error;
    },
    async deleteOrder(orderId) {
      return (await dispatch({ type: 'deleteOrder', orderId })).error;
    },
    async addInventoryMove(m) {
      return (await dispatch({ type: 'addInventoryMove', move: m })).error;
    },
    async setDefaultCycle(key, days) {
      await dispatch({ type: 'setDefaultCycle', key, days });
    },

    // 仅 local 模式使用(服务器模式导入按钮隐藏)
    importDb(db) {
      const stillExists = get().currentUser && db.users.some((u) => u.id === get().currentUser!.id);
      const entry: LogEntry = {
        id: uid(),
        time: new Date().toISOString(),
        userId: get().currentUser?.id ?? '-',
        userName: get().currentUser?.name ?? '-',
        action: 'import',
        detail: `导入数据:${db.orders.length} 订单 / ${db.users.length} 用户`,
      };
      const newDb = { ...db, logs: [entry, ...db.logs] };
      saveDb(newDb);
      set({ db: newDb, currentUser: stillExists ? get().currentUser : null });
    },
  };
});

// 应用启动即探测模式
void useAppStore.getState().init();
