import { useRef, useState } from 'react';
import { Button, Segmented, Space, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import type { Product } from '../../types/cp';
import { useCpStore } from '../../store/cpStore';
import { parseStdfFile } from '../../utils/stdfParser';

const MENUS = ['Summary', 'CP', 'FT', 'WAT', 'Metrology', 'Defect', 'MORE'];

/** 顶部主菜单条,复刻 DE-YMS 顶栏样式 */
export default function TopMenu() {
  const dataSource = useCpStore((s) => s.dataSource);
  const setDataSource = useCpStore((s) => s.setDataSource);
  const uploadedProduct = useCpStore((s) => s.uploadedProduct);
  const addUploadedProducts = useCpStore((s) => s.addUploadedProducts);
  const clearUploaded = useCpStore((s) => s.clearUploaded);
  const [parsing, setParsing] = useState(false);
  // 多选一次触发多次 beforeUpload,用批次缓冲一次性解析
  const batch = useRef<File[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseBatch = (files: File[]) => {
    setParsing(true);
    const hide = message.loading(`正在解析 ${files.length} 个文件 …`, 0);
    Promise.allSettled(files.map((f) => parseStdfFile(f)))
      .then((results) => {
        const ok = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<Product>).value);
        const failed = results.length - ok.length;
        if (ok.length) {
          addUploadedProducts(ok);
          const wafers = ok.reduce((s, p) => s + p.wafers.length, 0);
          message.success(`解析成功:新增 ${wafers} 片晶圆(${ok.length} 个文件)${failed ? `,${failed} 个失败` : ''}`);
        } else {
          message.error('全部解析失败:请确认是 CP wafer STDF 文件');
        }
      })
      .finally(() => {
        hide();
        setParsing(false);
      });
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    batch.current.push(file as unknown as File);
    if (timer.current) clearTimeout(timer.current);
    // 同一次多选的文件会连续进入,合并成一批
    timer.current = setTimeout(() => {
      const files = batch.current;
      batch.current = [];
      parseBatch(files);
    }, 60);
    return false; // 阻止 antd 默认上传,纯前端解析
  };

  const options = [
    { label: 'Mock', value: 'mock' },
    { label: '内置真实STDF', value: 'real' },
    ...(uploadedProduct ? [{ label: `我的STDF (${uploadedProduct.wafers.length}片)`, value: 'upload' }] : []),
  ];

  return (
    <div
      style={{
        height: 40,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 24,
      }}
    >
      <div style={{ fontWeight: 700, color: '#1677ff', fontSize: 15, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
        chip-stdf-analysis
      </div>
      <Space size={20}>
        {MENUS.map((m) => (
          <span
            key={m}
            style={{
              fontSize: 13,
              color: m === 'CP' ? '#1677ff' : '#595959',
              fontWeight: m === 'CP' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {m} {m !== 'MORE' ? '▾' : ''}
          </span>
        ))}
      </Space>
      <div style={{ flex: 1 }} />
      <Upload beforeUpload={beforeUpload} showUploadList={false} multiple accept=".stdf,.gz,.std">
        <Button type="primary" size="small" loading={parsing}>
          打开 STDF(可多选)
        </Button>
      </Upload>
      {uploadedProduct && (
        <Button size="small" onClick={clearUploaded}>
          清空
        </Button>
      )}
      <Segmented
        size="small"
        value={dataSource}
        onChange={(v) => setDataSource(v as 'mock' | 'real' | 'upload')}
        options={options}
      />
      <Space size={16} style={{ color: '#8c8c8c', fontSize: 13, marginLeft: 16 }}>
        <span>DE-G</span>
        <span>⚙ Config</span>
        <span>👤 user</span>
      </Space>
    </div>
  );
}
