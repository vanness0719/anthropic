import { useState } from 'react';
import { Button, Segmented, Space, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useCpStore } from '../../store/cpStore';
import { parseStdfFile } from '../../utils/stdfParser';

const MENUS = ['Summary', 'CP', 'FT', 'WAT', 'Metrology', 'Defect', 'MORE'];

/** 顶部主菜单条,复刻 DE-YMS 顶栏样式 */
export default function TopMenu() {
  const dataSource = useCpStore((s) => s.dataSource);
  const setDataSource = useCpStore((s) => s.setDataSource);
  const uploadedProduct = useCpStore((s) => s.uploadedProduct);
  const loadUploadedProduct = useCpStore((s) => s.loadUploadedProduct);
  const [parsing, setParsing] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    setParsing(true);
    const hide = message.loading(`正在解析 ${file.name} …`, 0);
    parseStdfFile(file as unknown as File)
      .then((product) => {
        loadUploadedProduct(product);
        const dies = product.wafers.reduce((s, w) => s + w.dies.length, 0);
        message.success(`解析成功:${product.wafers.length} 片晶圆,${dies} 颗 die`);
      })
      .catch((err) => {
        console.error(err);
        message.error(`解析失败:${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        hide();
        setParsing(false);
      });
    return false; // 阻止 antd 默认上传,纯前端解析
  };

  const options = [
    { label: 'Mock', value: 'mock' },
    { label: '内置真实STDF', value: 'real' },
    ...(uploadedProduct ? [{ label: '我的STDF', value: 'upload' }] : []),
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
      <div style={{ fontWeight: 700, color: '#1677ff', fontSize: 16, letterSpacing: 0.5 }}>
        DE-YMS
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
      <Upload beforeUpload={beforeUpload} showUploadList={false} accept=".stdf,.gz,.std">
        <Button type="primary" size="small" loading={parsing}>
          打开 STDF 文件
        </Button>
      </Upload>
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
