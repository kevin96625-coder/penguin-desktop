import { useCallback, useEffect, useState } from "react";

/**
 * Three-state theme: light → dark → system (cycle order fixed by the brief).
 * - Persisted under localStorage "penguin-theme".
 * - "system" subscribes to prefers-color-scheme and follows OS changes live.
 * - Effective theme is applied as a `.dark` class on <html> (class strategy,
 *   see @custom-variant in App.css).
 */

export type ThemeMode = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "penguin-theme";
const CYCLE: ThemeMode[] = ["light", "dark", "system"];

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable → fall through to system */
  }
  return "system";
}

/** Resolve a mode to the concrete theme that should be rendered right now. */
export function resolveEffective(mode: ThemeMode): EffectiveTheme {
  if (mode === "system") return darkQuery().matches ? "dark" : "light";
  return mode;
}

function applyEffective(effective: EffectiveTheme) {
  document.documentElement.classList.toggle("dark", effective === "dark");
}

/** Apply persisted theme before first paint; call once from main.tsx. */
export function initTheme() {
  applyEffective(resolveEffective(readStoredMode()));
}

export function nextMode(mode: ThemeMode): ThemeMode {
  return CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length];
}

export interface UseTheme {
  /** User-chosen mode (may be "system"). */
  mode: ThemeMode;
  /** What is actually rendered. */
  effective: EffectiveTheme;
  setMode: (mode: ThemeMode) => void;
  /** light → dark → system → light … */
  cycle: () => void;
}

export function useTheme(): UseTheme {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [effective, setEffective] = useState<EffectiveTheme>(() =>
    resolveEffective(readStoredMode()),
  );

  // Apply + persist whenever the chosen mode changes.
  useEffect(() => {
    const eff = resolveEffective(mode);
    setEffective(eff);
    applyEffective(eff);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore storage failures */
    }
  }, [mode]);

  // In system mode, follow OS scheme changes live.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = darkQuery();
    const onChange = (e: MediaQueryListEvent) => {
      const eff: EffectiveTheme = e.matches ? "dark" : "light";
      setEffective(eff);
      applyEffective(eff);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const cycle = useCallback(() => setModeState((m) => nextMode(m)), []);

  return { mode, effective, setMode, cycle };
}
