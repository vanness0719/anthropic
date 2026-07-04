// 锁定/解锁按钮:未锁任何人可锁;已锁仅锁定人或管理员可解(店内校验,此处只展示与提示)。
import { Button, Tooltip, message } from 'antd';
import type { LockInfo } from '../types';

interface Props {
  lock: LockInfo | null;
  onToggle: () => string | undefined;
}

export default function LockButton({ lock, onToggle }: Props) {
  const handle = () => {
    const err = onToggle();
    if (err) message.error(err);
  };
  if (lock) {
    return (
      <Tooltip title={`由 ${lock.byName} 于 ${lock.at.slice(0, 16).replace('T', ' ')} 锁定;仅锁定人或管理员可解锁`}>
        <Button size="small" danger onClick={handle}>
          🔒 {lock.byName} · 解锁
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button size="small" onClick={handle}>
      🔓 锁定
    </Button>
  );
}
