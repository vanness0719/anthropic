import { Segmented, Select, Space } from 'antd';
import { useCpStore } from '../../store/cpStore';
import type { SmartSplit } from '../../types/cp';

/** Smart Split(Day/Week/Month) + Series Split 控件 */
export default function SmartSplitControl() {
  const smartSplit = useCpStore((s) => s.smartSplit);
  const setSmartSplit = useCpStore((s) => s.setSmartSplit);

  return (
    <Space size={12} style={{ fontSize: 12 }}>
      <span>
        Smart Split:&nbsp;
        <Segmented
          size="small"
          value={smartSplit}
          onChange={(v) => setSmartSplit(v as SmartSplit)}
          options={['Day', 'Week', 'Month']}
        />
      </span>
      <span>
        Series Split:&nbsp;
        <Select
          size="small"
          defaultValue="none"
          style={{ width: 110 }}
          options={[
            { value: 'none', label: '(None)' },
            { value: 'all', label: 'All Values' },
          ]}
        />
      </span>
    </Space>
  );
}
