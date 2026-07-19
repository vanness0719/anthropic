// 会话 token(内存表,进程重启后需重新登录)与密码校验。
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const tokens = new Map<string, string>(); // token -> userId

export function issueToken(userId: string): string {
  const token = randomUUID();
  tokens.set(token, userId);
  return token;
}

export function userIdForToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return tokens.get(token);
}

export function revokeToken(token: string | undefined): void {
  if (token) tokens.delete(token);
}

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string | undefined): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(pw, hash);
}
