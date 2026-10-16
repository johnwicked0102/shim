import { CircleCheck, CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import type { OfflineStatus } from '../pwa/useOfflineStatus';

interface Props {
  status: OfflineStatus;
  onUpdateClick: () => void;
}

/** The single source of truth for the four required status labels. */
export function statusLabel(s: Pick<OfflineStatus, 'state' | 'updateAvailable'>): string {
  if (s.updateAvailable) return 'Update Available';
  switch (s.state) {
    case 'ready':
      return 'Offline Ready';
    case 'offline':
      return 'Offline Mode';
    case 'offline-unprepared':
      return 'Offline Mode';
    case 'preparing':
      return 'Preparing Offline Access';
    default:
      return 'Online Only';
  }
}

export function StatusPill({ status, onUpdateClick }: Props) {
  const label = statusLabel(status);
  const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap';

  if (status.updateAvailable) {
    return (
      <button type="button" onClick={onUpdateClick} className={`${base} bg-butter text-ink hover:brightness-105`} data-testid="status">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
    );
  }

  const styles: Record<string, { cls: string; icon: JSX.Element; tip: string }> = {
    ready: {
      cls: 'bg-mint-soft text-mint-deep',
      icon: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
      tip: 'Everything Shim needs is saved on this device. It will keep working without internet.',
    },
    offline: {
      cls: 'bg-peach-soft text-peach-deep',
      icon: <WifiOff className="h-3.5 w-3.5" aria-hidden />,
      tip: 'No internet connection. Shim is running from its offline copy — all features work.',
    },
    'offline-unprepared': {
      cls: 'bg-peach-soft text-peach-deep',
      icon: <CloudOff className="h-3.5 w-3.5" aria-hidden />,
      tip: 'No internet connection, and offline setup had not finished. Keep this tab open — reloading may not work until you reconnect.',
    },
    preparing: {
      cls: 'bg-well text-muted',
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />,
      tip: 'Saving Shim to this device so it works offline…',
    },
    unsupported: {
      cls: 'bg-well text-muted',
      icon: <CloudOff className="h-3.5 w-3.5" aria-hidden />,
      tip: 'This browser (or development mode) does not support offline installation. Conversions still run locally.',
    },
  };
  const s = styles[status.state];
  return (
    <span className={`${base} ${s.cls}`} title={s.tip} role="status" aria-live="polite" data-testid="status" data-state={status.state}>
      {s.icon}
      <span>{label}</span>
      <span className="sr-only">. {s.tip}</span>
    </span>
  );
}
