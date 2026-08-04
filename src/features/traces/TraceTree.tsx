import { useState } from "react";
import type { AgentTraceDateGroup } from "../../api/types";
import { ChevronDownIcon, ChevronRightIcon, FileIcon } from "../../design-system/icons";
import { formatBytes, traceKey } from "./format";

export interface TraceSelection {
  sessionId: string;
  index: number;
  sizeBytes: number;
}

export interface TraceTreeProps {
  dates: AgentTraceDateGroup[];
  selectedKey: string | null;
  onSelect: (selection: TraceSelection) => void;
}

/**
 * The list response is a date -> session -> file drill-down (no model or duration on it —
 * those only exist per file, via the analysis endpoint), so the browser is a two-level
 * disclosure tree rather than a table. Everything here is read-only: rows open a file, and
 * nothing offers to rename, edit or delete it.
 */
export default function TraceTree({ dates, selectedKey, onSelect }: TraceTreeProps) {
  // First date and its first session open by default: one click to the newest trace.
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(
    () => new Set(dates.slice(1).map((d) => d.date)),
  );
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(
    () =>
      new Set(
        dates.flatMap((d, di) =>
          d.sessions
            .filter((_, si) => !(di === 0 && si === 0))
            .map((s) => `${d.date}/${s.sessionId}`),
        ),
      ),
  );

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  return (
    <ul className="stagger-menu space-y-1">
      {dates.map((group) => {
        const dateOpen = !collapsedDates.has(group.date);
        const fileCount = group.sessions.reduce((n, s) => n + s.files.length, 0);
        return (
          <li key={group.date} className="animate-section-in">
            <button
              type="button"
              onClick={() => setCollapsedDates((s) => toggle(s, group.date))}
              aria-expanded={dateOpen}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-raised focus:outline-none"
            >
              {dateOpen ? (
                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="font-mono text-[12px] font-medium text-foreground/90">
                {group.date}
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/75">
                {group.sessions.length} 会话 · {fileCount} 文件
              </span>
            </button>

            {dateOpen && group.sessions.length === 0 && (
              <p className="py-2 pl-7 text-[11px] text-muted-foreground">
                该日期下没有会话
              </p>
            )}

            {dateOpen && (
              <ul className="ml-3 border-l border-border/40 pl-2">
                {group.sessions.map((session) => {
                  const sk = `${group.date}/${session.sessionId}`;
                  const sessionOpen = !collapsedSessions.has(sk);
                  return (
                    <li key={sk}>
                      <button
                        type="button"
                        onClick={() => setCollapsedSessions((s) => toggle(s, sk))}
                        aria-expanded={sessionOpen}
                        title={session.sessionId}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-raised focus:outline-none"
                      >
                        {sessionOpen ? (
                          <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        ) : (
                          <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                          {session.sessionId}
                        </span>
                      </button>

                      {sessionOpen && session.files.length === 0 && (
                        <p className="py-1.5 pl-6 text-[11px] text-muted-foreground">
                          该会话下没有 Trace 文件
                        </p>
                      )}

                      {sessionOpen && (
                        <ul className="ml-2 space-y-0.5 border-l border-border/30 pl-2">
                          {session.files.map((f) => {
                            const key = traceKey(session.sessionId, f.index);
                            const active = key === selectedKey;
                            return (
                              <li key={key}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelect({
                                      sessionId: session.sessionId,
                                      index: f.index,
                                      sizeBytes: f.sizeBytes,
                                    })
                                  }
                                  aria-current={active ? "true" : undefined}
                                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[background-color,border-color] duration-150 focus:outline-none ${
                                    active
                                      ? "border-border/50 bg-surface-raised"
                                      : "border-transparent hover:border-border/40 hover:bg-surface-raised"
                                  }`}
                                >
                                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                  <span className="font-mono text-[11px] tabular-nums text-foreground/85">
                                    #{String(f.index).padStart(3, "0")}
                                  </span>
                                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/75">
                                    {formatBytes(f.sizeBytes)}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
