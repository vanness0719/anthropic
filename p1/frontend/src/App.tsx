import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Layout,
  Progress,
  Row,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import { InboxOutlined, TranslationOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  createJob,
  downloadUrl,
  fetchProviders,
  getJob,
  type JobStatus,
  type ProviderInfo,
} from './api';

const { Header, Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const LANGS = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-tw', label: '繁体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
];

const TARGET_LANGS = LANGS.filter((l) => l.value !== 'auto');

export default function App() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh');
  const [file, setFile] = useState<File | null>(null);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch(() => message.error('无法连接后端,请确认服务已启动'));
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const providerDefaultModel =
    providers.find((p) => p.id === provider)?.default_model || '';

  const startPolling = (id: string) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      try {
        const status = await getJob(id);
        setJob(status);
        if (status.status === 'done' || status.status === 'error') {
          if (timer.current) window.clearInterval(timer.current);
        }
      } catch {
        /* 忽略瞬时错误,继续轮询 */
      }
    }, 1000);
  };

  const onTranslate = async () => {
    if (!file) {
      message.warning('请先选择一个 PDF 文件');
      return;
    }
    setSubmitting(true);
    setJob(null);
    try {
      const id = await createJob({
        file,
        sourceLang,
        targetLang,
        provider,
        model: model || undefined,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
      });
      setJobId(id);
      setJob({ job_id: id, status: 'pending', done: 0, total: 0, error: null });
      startPolling(id);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const percent =
    job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const running = job?.status === 'pending' || job?.status === 'processing';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <TranslationOutlined style={{ color: '#fff', fontSize: 22, marginRight: 12 }} />
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
          p1 · PDF 文档翻译(保留排版)
        </span>
      </Header>
      <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <Card>
          <Title level={4}>上传 → 翻译 → 保留排版 → 下载</Title>
          <Paragraph type="secondary">
            上传 PDF,选择翻译引擎与语言。翻译在保留原文档版式、图片、表格位置的前提下完成。
          </Paragraph>

          <Upload.Dragger
            accept="application/pdf,.pdf"
            maxCount={1}
            beforeUpload={(f) => {
              setFile(f);
              return false; // 阻止自动上传,提交时再一起发送
            }}
            onRemove={() => setFile(null)}
            fileList={
              file
                ? ([{ uid: '-1', name: file.name, status: 'done' }] as UploadFile[])
                : []
            }
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 PDF 到此处</p>
          </Upload.Dragger>

          <Row gutter={16} style={{ marginTop: 20 }}>
            <Col span={12}>
              <Text>源语言</Text>
              <Select
                style={{ width: '100%' }}
                value={sourceLang}
                onChange={setSourceLang}
                options={LANGS}
              />
            </Col>
            <Col span={12}>
              <Text>目标语言</Text>
              <Select
                style={{ width: '100%' }}
                value={targetLang}
                onChange={setTargetLang}
                options={TARGET_LANGS}
              />
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Text>翻译引擎</Text>
              <Select
                style={{ width: '100%' }}
                value={provider}
                onChange={(v) => {
                  setProvider(v);
                  setModel('');
                }}
                options={providers.map((p) => ({
                  value: p.id,
                  label:
                    p.id === 'claude'
                      ? 'Claude API'
                      : p.id === 'openai'
                      ? 'OpenAI 兼容接口'
                      : 'Ollama(本地开源模型)',
                }))}
              />
            </Col>
            <Col span={12}>
              <Text>模型(留空用默认)</Text>
              <Input
                placeholder={providerDefaultModel}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </Col>
          </Row>

          {provider !== 'ollama' && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Text>API Key(留空用后端 .env)</Text>
                <Input.Password
                  placeholder="可选"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </Col>
              <Col span={12}>
                <Text>Base URL(可选)</Text>
                <Input
                  placeholder={provider === 'openai' ? 'https://api.openai.com/v1' : '可选'}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </Col>
            </Row>
          )}
          {provider === 'ollama' && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Text>Ollama 地址(可选,默认 http://localhost:11434)</Text>
                <Input
                  placeholder="http://localhost:11434"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </Col>
            </Row>
          )}

          <Space style={{ marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              icon={<TranslationOutlined />}
              loading={submitting || running}
              onClick={onTranslate}
            >
              开始翻译
            </Button>
          </Space>

          {job && (
            <div style={{ marginTop: 24 }}>
              {running && (
                <>
                  <Text>
                    {job.status === 'pending' ? '准备中…' : `翻译中… ${job.done}/${job.total} 页`}
                  </Text>
                  <Progress percent={percent} status="active" />
                </>
              )}
              {job.status === 'done' && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert type="success" showIcon message="翻译完成!" />
                  <Button
                    type="primary"
                    href={jobId ? downloadUrl(jobId) : undefined}
                    target="_blank"
                  >
                    下载译文 PDF
                  </Button>
                </Space>
              )}
              {job.status === 'error' && (
                <Alert type="error" showIcon message="翻译失败" description={job.error} />
              )}
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  );
}
