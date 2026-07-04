// localStorage 持久化与 JSON 导出/导入。后续接后端时替换本文件与 appStore 的读写即可。
import type { Db } from '../types';

const KEY = 'p3-db';
export const SCHEMA_VERSION = 1;

export function loadDb(): Db | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as Db;
    return db.schemaVersion === SCHEMA_VERSION && Array.isArray(db.orders) ? db : null;
  } catch {
    return null;
  }
}

export function saveDb(db: Db): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function exportDb(db: Db): void {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `p3-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function readDbFile(file: File): Promise<Db> {
  const text = await file.text();
  const db = JSON.parse(text) as Db;
  if (db.schemaVersion !== SCHEMA_VERSION || !Array.isArray(db.orders) || !Array.isArray(db.users)) {
    throw new Error('文件格式不正确,不是 P3 导出的数据文件');
  }
  return db;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
