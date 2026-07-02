const BASE = '/api'

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`
    try {
      const body = await resp.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* 保留状态码信息 */ }
    throw new Error(detail)
  }
  return resp.json()
}

export function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    : ''
  return fetch(`${BASE}${path}${qs}`).then(r => handle<T>(r))
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handle<T>(r))
}
