import { ShieldCheck, WifiOff, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Bike, Wordmark } from './Bike';

interface Props {
  open: boolean;
  onClose: () => void;
  statusText: string;
}

export function AboutDialog({ open, onClose, statusText }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="about-title"
      className="w-[min(36rem,calc(100vw-1.5rem))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <Wordmark />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close About">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <h2 id="about-title" className="mt-5 text-xl font-extrabold">About Shim</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A shim is the tiny spacer that makes things fit just right — and the little cleat that clips a cyclist to their
          pedals. Shim does the same for your text: it slots lists into exactly the shape you need, from a spreadsheet
          column to a comma-separated line, an SQL <code className="font-mono">IN</code> list, JSON, HTML and back again.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint-deep" aria-hidden />
            <span>
              <strong>100% local.</strong> Everything happens in your browser’s memory. No servers, no accounts, no analytics, and
              your text is never saved, logged or sent anywhere.
            </span>
          </li>
          <li className="flex gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-mint-deep" aria-hidden />
            <span>
              <strong>Works offline.</strong> After the first visit Shim saves itself to this browser. You can reload, restart
              and keep converting without internet (unless the browser clears its storage).
              <span className="mt-1 block text-muted">Current status: {statusText}</span>
            </span>
          </li>
          <li className="flex gap-3">
            <Bike className="mt-0.5 h-5 w-5 shrink-0 text-mint-deep" />
            <span>
              <strong>Install it.</strong> Use your browser’s “Install app” or “Add to Home Screen” to ride Shim like a native app.
            </span>
          </li>
        </ul>
        <div className="mt-5 rounded-2xl bg-well p-3 text-xs text-muted">
          <p className="font-bold text-ink">Keyboard shortcuts</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt><kbd className="font-mono">Ctrl/⌘ + Enter</kbd></dt><dd>Copy result</dd>
            <dt><kbd className="font-mono">Ctrl/⌘ + S</kbd></dt><dd>Download result as TXT</dd>
            <dt><kbd className="font-mono">Ctrl/⌘ + O</kbd></dt><dd>Import a file</dd>
            <dt><kbd className="font-mono">Ctrl/⌘ + Shift + X</kbd></dt><dd>Swap direction</dd>
          </dl>
        </div>
        <p className="mt-4 text-xs text-muted">
          Version {__APP_VERSION__} · built {new Date(__BUILD_TIME__).toLocaleDateString()}
        </p>
      </div>
    </dialog>
  );
}
