// 服务器端持久化:整库 Db 存单个 JSON 文件,原子写(写临时文件再 rename)。
// 单进程内同步读改写 → 天然串行,无并发写冲突。将来要换 SQLite 只改本文件。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import bcrypt from 'bcryptjs';
import { seedDb } from '../src/store/seed';
import type { Db, User } from '../src/types';

const DATA_FILE = process.env.P3_DATA_FILE || '/data/p3-db.json';
const DEFAULT_PASSWORD = process.env.P3_DEFAULT_PASSWORD || 'p3admin';

let cache: Db | null = null;

function seedWithPasswords(): Db {
  const db = seedDb();
  // 演示用户补默认密码哈希(README 标注,建议首登后修改)
  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  db.users = db.users.map((u) => ({ ...u, passwordHash: hash }));
  return db;
}

export function loadDb(): Db {
  if (cache) return cache;
  try {
    if (existsSync(DATA_FILE)) {
      const db = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Db;
      if (Array.isArray(db.orders) && Array.isArray(db.users)) {
        cache = db;
        return db;
      }
    }
  } catch {
    /* 落空则重新播种 */
  }
  const seeded = seedWithPasswords();
  saveDb(seeded);
  return seeded;
}

export function saveDb(db: Db): void {
  cache = db;
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db), 'utf8');
  renameSync(tmp, DATA_FILE); // 同盘 rename 原子替换
}

/** 下发前端前剔除所有密码哈希 */
export function stripSecrets(db: Db): Db {
  return { ...db, users: db.users.map(({ passwordHash: _drop, ...u }) => u) };
}

export function publicUser(u: User): Omit<User, 'passwordHash'> {
  const { passwordHash: _drop, ...rest } = u;
  return rest;
}

export const DEFAULTS = { DATA_FILE, DEFAULT_PASSWORD };
