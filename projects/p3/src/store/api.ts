// 服务器模式客户端:封装 REST API。token 存 localStorage(刷新后自动续用)。
import type { Action } from '../core/reducer';
import type { Db, Role, User } from '../types';

const TOKEN_KEY = 'p3-token';
const USER_KEY = 'p3-user';

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken(): string | null {
  return token;
}
export function setToken(t: string | null): void {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
export function setStoredUser(u: User | null): void {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(USER_KEY);
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data as T;
}

/** 探测是否存在后端(决定服务器/单机模式) */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiLogin(username: string, password: string): Promise<{ token: string; user: User }> {
  return req('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}
export async function apiLogout(): Promise<void> {
  try {
    await req('/logout', { method: 'POST' });
  } catch {
    /* 忽略 */
  }
}
export async function apiGetState(): Promise<{ db: Db; serverTime: string }> {
  return req('/state');
}
export async function apiAction(action: Action): Promise<{ error?: string; result?: { id?: string }; db: Db }> {
  return req('/action', { method: 'POST', body: JSON.stringify(action) });
}
export async function apiAddUser(name: string, role: Role, password: string): Promise<{ db: Db }> {
  return req('/users', { method: 'POST', body: JSON.stringify({ name, role, password }) });
}
export async function apiRemoveUser(userId: string): Promise<{ db: Db }> {
  return req(`/users/${userId}`, { method: 'DELETE' });
}
export async function apiSetPassword(userId: string, newPassword: string): Promise<void> {
  await req(`/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) });
}
