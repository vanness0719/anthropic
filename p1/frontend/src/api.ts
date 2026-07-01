// 与后端交互的薄封装。
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

export interface ProviderInfo {
  id: string;
  default_model: string;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  done: number;
  total: number;
  error: string | null;
}

export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch(`${BASE}/api/providers`);
  if (!res.ok) throw new Error('无法获取翻译引擎列表');
  const data = await res.json();
  return data.providers as ProviderInfo[];
}

export interface CreateJobParams {
  file: File;
  sourceLang: string;
  targetLang: string;
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function createJob(p: CreateJobParams): Promise<string> {
  const form = new FormData();
  form.append('file', p.file);
  form.append('source_lang', p.sourceLang);
  form.append('target_lang', p.targetLang);
  form.append('provider', p.provider);
  if (p.model) form.append('model', p.model);
  if (p.apiKey) form.append('api_key', p.apiKey);
  if (p.baseUrl) form.append('base_url', p.baseUrl);

  const res = await fetch(`${BASE}/api/jobs`, { method: 'POST', body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || '创建任务失败');
  }
  const data = await res.json();
  return data.job_id as string;
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error('查询任务失败');
  return (await res.json()) as JobStatus;
}

export function downloadUrl(jobId: string): string {
  return `${BASE}/api/jobs/${jobId}/download`;
}
