import { useEffect, useRef, useState } from "react";
import type { AgentSummary } from "../../api/types";
import { Button } from "../../design-system/components";
import { ChevronDownIcon } from "../../design-system/icons";

export interface AgentSelectProps {
  agents: AgentSummary[] | null;
  value: string | null;
  onChange: (agentId: string) => void;
  disabled?: boolean;
}

const labelOf = (agent: AgentSummary) => agent.name ?? agent.agentId;

/**
 * Agent scope switcher. Benchmark data is isolated per agent, so this control decides which
 * agent's evolution the whole page is about — it is the page's only global input.
 */
export default function AgentSelect({
  agents,
  value,
  onChange,
  disabled = false,
}: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Same dismissal contract as AccountMenu: Escape or a pointer outside the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const current = agents?.find((a) => a.agentId === value) ?? null;

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        className="min-w-[210px] justify-between"
        disabled={disabled || !agents || agents.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--chat-running))]"
          />
          <span className="truncate text-[13px]">
            {current ? labelOf(current) : (value ?? "选择 Agent")}
          </span>
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Button>

      {open && agents && (
        <div
          role="listbox"
          className="animate-tool-expand-in absolute right-0 top-[42px] z-30 max-h-[280px] w-[268px] overflow-y-auto rounded-xl border border-border/60 bg-surface-modal p-1.5 shadow-popover"
        >
          <p className="px-2 pb-1 pt-0.5 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground/70">
            AGENTS
          </p>
          <div className="stagger-menu">
            {agents.map((agent) => {
              const active = agent.agentId === value;
              return (
                /* Raw button (not the design-system Button) on purpose: these rows are two
                 * lines tall, and `cn` is a plain joiner — overriding Button's fixed height
                 * would depend on Tailwind's utility ordering. Same shape as SessionsPage. */
                <button
                  key={agent.agentId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="flex w-full select-none items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-accent focus:outline-none"
                  onClick={() => {
                    onChange(agent.agentId);
                    setOpen(false);
                  }}
                >
                  <span
                    aria-hidden
                    className={
                      active
                        ? "h-4 w-[2px] shrink-0 rounded-full bg-primary"
                        : "h-4 w-[2px] shrink-0 rounded-full bg-foreground/10"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">
                      {labelOf(agent)}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] font-normal text-muted-foreground">
                      {agent.agentId}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
