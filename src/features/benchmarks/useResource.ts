import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";

/**
 * Four-state async cell shared by every level of the benchmark browser.
 * "idle" is the parked state used while a level has nothing selected yet.
 */
export type Resource<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/** Turns an unknown rejection into a single readable line for the error states. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) return `${err.message} (${err.code})`;
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Fetch-on-key helper. `key` is the full identity of the request — a null key parks
 * the resource in "idle" and never calls `load`. `load` is read through a ref so an
 * inline closure (which is a new function on every render) does not retrigger the
 * effect; every value the closure captures must therefore be encoded in `key`.
 */
export function useResource<T>(
  key: string | null,
  load: () => Promise<T>,
): Resource<T> {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [state, setState] = useState<Resource<T>>({ status: "idle" });

  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", message: describeError(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
