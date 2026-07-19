// 简易唯一 ID(浏览器与 Node 通用)。
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
