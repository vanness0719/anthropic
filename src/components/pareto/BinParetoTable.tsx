import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ParetoRow } from '../../types/cp';
import { useCpStore } from '../../store/cpStore';

const columns: ColumnsType<ParetoRow> = [
  {
    title: 'Color',
    dataIndex: 'color',
    width: 56,
    render: (color: string) => (
      <span style={{ display: 'inline-block', width: 16, height: 12, background: color, borderRadius: 2 }} />
    ),
  },
  { title: 'Bin#', dataIndex: 'bin', width: 64 },
  { title: 'Bin%', dataIndex: 'pct', width: 72, render: (v: number) => `${v.toFixed(2)}%` },
  { title: 'Count', dataIndex: 'count', width: 80, render: (v: number) => v.toLocaleString() },
];

/** Bin 帕累托表(按 Bin% 降序);点击行 -> 高亮 wafermap 对应 bin */
export default function BinParetoTable({ rows }: { rows: ParetoRow[] }) {
  const highlightedBin = useCpStore((s) => s.highlightedBin);
  const setHighlightedBin = useCpStore((s) => s.setHighlightedBin);

  return (
    <Table<ParetoRow>
      size="small"
      rowKey="bin"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ y: 240 }}
      onRow={(record) => ({
        onClick: () =>
          setHighlightedBin(highlightedBin === record.bin ? null : record.bin),
        style: {
          cursor: 'pointer',
          background: highlightedBin === record.bin ? '#e6f4ff' : undefined,
        },
      })}
    />
  );
}
