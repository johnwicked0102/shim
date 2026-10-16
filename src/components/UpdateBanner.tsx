import { RefreshCw, X } from 'lucide-react';
import { Bike } from './Bike';

interface Props {
  updating: boolean;
  error: string | null;
  hasText: boolean;
  onUpdate: () => void;
  onLater: () => void;
}

/** Asks before activating a new version. Never reloads on its own. */
export function UpdateBanner({ updating, error, hasText, onUpdate, onLater }: Props) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
      className="card fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg animate-fade-up p-4 shadow-pop sm:bottom-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-butter text-ink">
          <Bike className="h-7 w-7" spinning={updating} fast />
        </span>
        <div className="min-w-0 flex-1">
          <p id="update-title" className="font-extrabold">A fresh Shim is ready to ride</p>
          <p id="update-desc" className="mt-0.5 text-sm text-muted">
            {error ??
              (hasText
                ? 'Updating reloads the page. Your current text will be carried over to the new version.'
                : 'Updating reloads the page. It only takes a moment.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-mint py-2" onClick={onUpdate} disabled={updating}>
              <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} aria-hidden />
              {updating ? 'Updating…' : 'Update now'}
            </button>
            <button type="button" className="btn-ghost py-2" onClick={onLater} disabled={updating}>
              Later
            </button>
          </div>
        </div>
        <button type="button" className="icon-btn -mr-1 -mt-1 h-8 w-8" onClick={onLater} aria-label="Dismiss update notice" disabled={updating}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
