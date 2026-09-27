import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

/* ==========================================================================
 * Small, dependency-free UI kit. Original styling — dark surface, single
 * green accent, focus states that are visible for keyboard users.
 * ========================================================================== */

export const cx = (...parts: (string | false | null | undefined | 0)[]) => parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- Button - */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest },
  ref,
) {
  const variants = {
    primary: 'bg-brand-500 text-ink-900 hover:bg-brand-400 disabled:bg-brand-500/40',
    secondary: 'bg-ink-600 text-slate-100 hover:bg-ink-500 border border-white/5',
    ghost: 'bg-transparent text-slate-200 hover:bg-white/5',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
  };
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-13 px-6 text-base' };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

/* ---------------------------------------------------------------- Spinner - */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Field - */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, id, className, ...rest },
  ref,
) {
  const inputId = id ?? `f_${label.replace(/\s+/g, '_').toLowerCase()}`;
  const describedBy = cx(error && `${inputId}_err`, hint && `${inputId}_hint`) || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cx(
            'w-full rounded-xl border bg-ink-700/70 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-brand-400/70',
            error ? 'border-red-400/80' : 'border-white/10',
            trailing && 'pr-11',
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={`${inputId}_hint`} className="text-xs text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}_err`} role="alert" className="text-xs font-medium text-red-300">
          {error}
        </p>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------- Card - */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-white/5 bg-ink-800/80 p-4 shadow-lg shadow-black/20', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Alert - */

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'error' | 'success' | 'warning';
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: 'border-accent/40 bg-accent/10 text-slate-100',
    error: 'border-red-400/40 bg-red-500/10 text-red-100',
    success: 'border-brand-400/40 bg-brand-500/10 text-emerald-50',
    warning: 'border-amber-400/40 bg-amber-500/10 text-amber-50',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-3.5 py-2.5 text-sm', tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal - */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md animate-ticker-in rounded-t-3xl border border-white/10 bg-ink-800 p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-300">{children}</div>
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState - */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-ink-800/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-500">{icon}</div>}
      <p className="font-semibold text-slate-200">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Skeleton - */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-white/5', className)} />;
}

/* ------------------------------------------------------------------- Stat - */

export function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'brand' }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-700/60 px-3.5 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cx('mt-1 text-lg font-bold', tone === 'brand' ? 'text-brand-400' : 'text-slate-100')}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- Badge - */

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-white/5 text-slate-300 border-white/10',
    success: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-300 border-red-500/30',
    info: 'bg-accent/15 text-accent border-accent/30',
  };
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}
