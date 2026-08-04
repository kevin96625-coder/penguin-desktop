import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import { SectionHeading } from "../../design-system/components";

/** Server errors arrive as ApiError with a Chinese message; anything else is stringified. */
export function errText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Refetch from the server. */
  reload: () => void;
  /** Adopt a payload a write already returned, skipping the refetch. */
  set: (next: T) => void;
}

/**
 * One-shot loader with in-place refresh.
 *
 * `load` is captured in a ref so callers can pass an inline closure without needing to
 * memoize it; the effect re-runs only when `key` changes (project/agent switch). A run
 * counter guards against a slow first response landing after a newer one.
 */
export function useResource<T>(key: string | null, load: () => Promise<T>): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const runRef = useRef(0);

  useEffect(() => {
    if (!key) return;
    const run = ++runRef.current;
    setLoading(true);
    setError(null);
    loadRef
      .current()
      .then((res) => {
        if (runRef.current !== run) return;
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (runRef.current !== run) return;
        setError(errText(err));
        setLoading(false);
      });
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const set = useCallback((next: T) => {
    // A write already returned the fresh payload; bump the guard so an in-flight
    // reload cannot overwrite it with a stale one.
    runRef.current++;
    setData(next);
    setLoading(false);
    setError(null);
  }, []);

  return { data, error, loading, reload, set };
}

/** Section shell: title row + optional description + panel body. */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="animate-section-in mb-8">
      <SectionHeading action={action} active>
        {title}
      </SectionHeading>
      {description && (
        <p className="mb-3 mt-1.5 pl-[11px] text-[12px] leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Labelled form row; `hint` sits under the control in muted 11px. */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground/80">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--chat-error))]">{children}</p>
  );
}

export function OkNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--chat-success))]">
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="px-3 py-10 text-center text-sm text-muted-foreground">加载中…</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Bordered list container shared by vault / skills / schedules. */
export function ListShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface-panel/70 p-1">
      {children}
    </div>
  );
}

/** Small monospace metadata chip. */
export function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] leading-4 text-muted-foreground">{children}</span>
  );
}
