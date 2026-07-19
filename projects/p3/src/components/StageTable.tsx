// 阶段明细表:每阶段一行,直接在单元格内编辑(改动即保存并记日志)。
// 周期/手动日期/计划日期任一变更都会触发全链计划时间重算;被锁行只读。
import dayjs from 'dayjs';
import { DatePicker, Input, InputNumber, Select, Switch, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_STATUS_COLORS,
  STAGE_STATUS_LABELS,
} from '../constants/stages';
import { useAppStore } from '../store/appStore';
import { stageDeviationDays } from '../utils/schedule';
import LockButton from './LockButton';
import type { Order, StageData, StageKey, StageStatus } from '../types';

interface Row extends StageData {
  key: StageKey;
}

const STATUS_OPTIONS = (Object.keys(STAGE_STATUS_LABELS) as StageStatus[]).map((v) => ({
  value: v,
  label: STAGE_STATUS_LABELS[v],
}));

export default function StageTable({ order }: { order: Order }) {
  const updateStage = useAppStore((s) => s.updateStage);
  const toggleLock = useAppStore((s) => s.toggleLock);

  const upd = async (key: StageKey, patch: Partial<StageData>) => {
    const err = await updateStage(order.id, key, patch);
    if (err) message.error(err);
  };

  const rows: Row[] = STAGE_ORDER.map((key) => ({ key, ...order.stages[key] }));

  const dateCell = (r: Row, field: 'actualStart' | 'actualEnd') => (
    <DatePicker
      size="small"
      style={{ width: 120 }}
      value={r[field] ? dayjs(r[field]) : null}
      disabled={!!r.lock || !r.enabled}
      onChange={(d) => upd(r.key, { [field]: d ? d.format('YYYY-MM-DD') : undefined })}
    />
  );

  const columns: ColumnsType<Row> = [
    {
      title: '阶段',
      dataIndex: 'key',
      fixed: 'left',
      width: 110,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{STAGE_LABELS[r.key]}</div>
          {r.updatedBy && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {r.updatedBy} 更新
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '启用',
      width: 56,
      render: (_, r) => (
        <Switch size="small" checked={r.enabled} disabled={!!r.lock} onChange={(v) => upd(r.key, { enabled: v })} />
      ),
    },
    {
      title: '周期(天)',
      width: 84,
      render: (_, r) => (
        <InputNumber
          size="small"
          style={{ width: 68 }}
          min={1}
          value={r.cycleDays}
          disabled={!!r.lock || !r.enabled}
          onChange={(v) => v != null && upd(r.key, { cycleDays: v })}
        />
      ),
    },
    {
      title: '手动日期',
      width: 72,
      render: (_, r) => (
        <Switch
          size="small"
          checked={r.manualDates}
          disabled={!!r.lock || !r.enabled}
          onChange={(v) => upd(r.key, { manualDates: v })}
        />
      ),
    },
    {
      title: '计划开始',
      width: 132,
      render: (_, r) =>
        r.manualDates ? (
          <DatePicker
            size="small"
            style={{ width: 120 }}
            value={r.planStart ? dayjs(r.planStart) : null}
            disabled={!!r.lock || !r.enabled}
            onChange={(d) => upd(r.key, { planStart: d ? d.format('YYYY-MM-DD') : undefined })}
          />
        ) : (
          <Typography.Text type="secondary">{r.enabled ? (r.planStart ?? '-') : '-'}</Typography.Text>
        ),
    },
    {
      title: '计划结束',
      width: 132,
      render: (_, r) =>
        r.manualDates ? (
          <DatePicker
            size="small"
            style={{ width: 120 }}
            value={r.planEnd ? dayjs(r.planEnd) : null}
            disabled={!!r.lock || !r.enabled}
            onChange={(d) => upd(r.key, { planEnd: d ? d.format('YYYY-MM-DD') : undefined })}
          />
        ) : (
          <Typography.Text type="secondary">{r.enabled ? (r.planEnd ?? '-') : '-'}</Typography.Text>
        ),
    },
    { title: '实际开始', width: 132, render: (_, r) => dateCell(r, 'actualStart') },
    { title: '实际结束', width: 132, render: (_, r) => dateCell(r, 'actualEnd') },
    {
      title: '偏差',
      width: 70,
      render: (_, r) => {
        const d = stageDeviationDays(r);
        if (d == null) return '-';
        if (d > 0) return <Typography.Text type="danger">+{d}天</Typography.Text>;
        if (d < 0) return <Typography.Text type="success">{d}天</Typography.Text>;
        return '0天';
      },
    },
    {
      title: '状态',
      width: 104,
      render: (_, r) =>
        r.lock || !r.enabled ? (
          <Tag color={STAGE_STATUS_COLORS[r.status]}>{STAGE_STATUS_LABELS[r.status]}</Tag>
        ) : (
          <Select
            size="small"
            style={{ width: 92 }}
            value={r.status}
            options={STATUS_OPTIONS}
            onChange={(v) => upd(r.key, { status: v })}
          />
        ),
    },
    {
      title: '投入',
      width: 92,
      render: (_, r) => (
        <InputNumber
          size="small"
          style={{ width: 80 }}
          min={0}
          value={r.qtyIn}
          disabled={!!r.lock || !r.enabled}
          onChange={(v) => upd(r.key, { qtyIn: v ?? undefined })}
        />
      ),
    },
    {
      title: '产出',
      width: 92,
      render: (_, r) => (
        <InputNumber
          size="small"
          style={{ width: 80 }}
          min={0}
          value={r.qtyOut}
          disabled={!!r.lock || !r.enabled}
          onChange={(v) => upd(r.key, { qtyOut: v ?? undefined })}
        />
      ),
    },
    {
      title: '良率',
      width: 64,
      render: (_, r) => (r.qtyIn && r.qtyOut ? `${((r.qtyOut / r.qtyIn) * 100).toFixed(1)}%` : '-'),
    },
    {
      title: '负责人',
      width: 96,
      render: (_, r) => (
        <Input
          key={`${order.id}-${r.key}-owner-${r.owner ?? ''}`}
          size="small"
          defaultValue={r.owner}
          disabled={!!r.lock || !r.enabled}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (r.owner ?? '')) upd(r.key, { owner: v || undefined });
          }}
        />
      ),
    },
    {
      title: '备注',
      width: 160,
      render: (_, r) => (
        <Input
          key={`${order.id}-${r.key}-remark-${r.remark ?? ''}`}
          size="small"
          defaultValue={r.remark}
          disabled={!!r.lock || !r.enabled}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (r.remark ?? '')) upd(r.key, { remark: v || undefined });
          }}
        />
      ),
    },
    {
      title: '锁',
      width: 130,
      fixed: 'right',
      render: (_, r) => <LockButton lock={r.lock} onToggle={() => toggleLock(order.id, r.key)} />,
    },
  ];

  return (
    <Table<Row>
      size="small"
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 1680 }}
      onRow={(r) => ({ style: r.enabled ? undefined : { opacity: 0.45 } })}
    />
  );
}
