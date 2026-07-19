// P3 后端:Express 提供 REST API + 托管前端静态文件。所有变更走共享 reducer(applyAction),
// 与浏览器单机模式行为一致;锁定/权限由服务器权威裁决。密码 bcrypt 哈希,永不下发。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { applyAction, type Action } from '../src/core/reducer';
import { uid } from '../src/utils/id';
import { ROLE_LABELS } from '../src/constants/stages';
import type { LogEntry, Role, User } from '../src/types';
import { DEFAULTS, loadDb, publicUser, saveDb, stripSecrets } from './store';
import { hashPassword, issueToken, revokeToken, userIdForToken, verifyPassword } from './auth';

const PORT = Number(process.env.PORT || 3000);
const DIST = join(import.meta.dirname, '..', 'dist');

const app = express();
app.use(express.json({ limit: '4mb' }));

/** 追加一条操作日志(用于登录/用户/密码等非 reducer 动作) */
function appendLog(partial: Omit<LogEntry, 'id' | 'time'>): void {
  const db = loadDb();
  const entry: LogEntry = { id: uid(), time: new Date().toISOString(), ...partial };
  saveDb({ ...db, logs: [entry, ...db.logs] });
}

/** 解析 Bearer token → 当前用户 */
function currentUser(req: Request): User | undefined {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const userId = userIdForToken(token);
  if (!userId) return undefined;
  return loadDb().users.find((u) => u.id === userId);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: '未登录或会话已过期' });
    return;
  }
  (req as Request & { user: User }).user = user;
  next();
}

// —— 健康检查:前端据此判断"服务器模式" ——
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// —— 登录 / 退出 ——
app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const db = loadDb();
  const user = db.users.find((u) => u.name === username);
  if (!user || !verifyPassword(String(password ?? ''), user.passwordHash)) {
    res.status(401).json({ error: '用户名或密码不正确' });
    return;
  }
  const token = issueToken(user.id);
  appendLog({ userId: user.id, userName: user.name, action: 'login' });
  res.json({ token, user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  revokeToken(req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  res.json({ ok: true });
});

// —— 全量快照(轮询) ——
app.get('/api/state', requireAuth, (_req, res) => {
  res.json({ db: stripSecrets(loadDb()), serverTime: new Date().toISOString() });
});

// —— 业务变更:统一走 reducer ——
app.post('/api/action', requireAuth, (req, res) => {
  const user = (req as Request & { user: User }).user;
  const action = req.body as Action;
  if (action?.type === 'addUser') {
    res.status(400).json({ error: '新增用户请走 /api/users' });
    return;
  }
  const { db, error, result } = applyAction(loadDb(), user, action);
  saveDb(db); // reducer 可能写入 denied 日志,一律持久化
  res.json({ error, result, db: stripSecrets(db) });
});

// —— 用户管理(密码在服务端哈希) ——
app.post('/api/users', requireAuth, (req, res) => {
  const actor = (req as Request & { user: User }).user;
  if (actor.role !== 'admin') {
    res.status(403).json({ error: '仅管理员可管理用户' });
    return;
  }
  const { name, role, password } = req.body ?? {};
  if (!password || String(password).length < 4) {
    res.status(400).json({ error: '密码至少 4 位' });
    return;
  }
  const userId = uid();
  const { db, error } = applyAction(loadDb(), actor, {
    type: 'addUser',
    name: String(name ?? ''),
    role: role as Role,
    userId,
  });
  if (error) {
    res.status(400).json({ error });
    return;
  }
  // 给新用户补密码哈希
  const withHash = {
    ...db,
    users: db.users.map((u) => (u.id === userId ? { ...u, passwordHash: hashPassword(String(password)) } : u)),
  };
  saveDb(withHash);
  res.json({ db: stripSecrets(withHash) });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  const actor = (req as Request & { user: User }).user;
  const { db, error } = applyAction(loadDb(), actor, { type: 'removeUser', userId: String(req.params.id) });
  if (error) {
    res.status(400).json({ error });
    return;
  }
  saveDb(db);
  res.json({ db: stripSecrets(db) });
});

app.post('/api/users/:id/password', requireAuth, (req, res) => {
  const actor = (req as Request & { user: User }).user;
  const targetId = String(req.params.id);
  if (actor.role !== 'admin' && actor.id !== targetId) {
    res.status(403).json({ error: '只能修改自己的密码或由管理员重置' });
    return;
  }
  const { newPassword } = req.body ?? {};
  if (!newPassword || String(newPassword).length < 4) {
    res.status(400).json({ error: '密码至少 4 位' });
    return;
  }
  const db = loadDb();
  const target = db.users.find((u) => u.id === targetId);
  if (!target) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  const withHash = {
    ...db,
    users: db.users.map((u) => (u.id === targetId ? { ...u, passwordHash: hashPassword(String(newPassword)) } : u)),
  };
  saveDb(withHash);
  appendLog({
    userId: actor.id,
    userName: actor.name,
    action: 'user',
    detail: actor.id === targetId ? '修改本人密码' : `重置用户 ${target.name}(${ROLE_LABELS[target.role]}) 密码`,
  });
  res.json({ ok: true });
});

// —— 前端静态资源 + SPA 回退(Express 5:用末端中间件,不用 '*' 路由) ——
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  loadDb(); // 首次触发播种
  console.log(`P3 服务器已启动: http://localhost:${PORT}`);
  console.log(`数据文件: ${DEFAULTS.DATA_FILE}`);
  console.log(`演示账号默认口令: ${DEFAULTS.DEFAULT_PASSWORD}(建议首登后在「设置」修改)`);
});
