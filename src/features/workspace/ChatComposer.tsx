import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Button, GlassCard } from "../../design-system/components";
import { ArrowUpIcon, PaperclipIcon } from "../../design-system/icons";
import type { SessionStatus } from "../../api/types";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  taskState: SessionStatus;
  queued: number;
  agentId: string | null;
  disabled?: boolean;
}

const MIN_H = 70;
const MAX_H = 160;

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  onAbort,
  taskState,
  queued,
  agentId,
  disabled = false,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const running = taskState !== "idle";

  // Grow the card with its content between the 70/160px bounds.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(MAX_H, Math.max(MIN_H, el.scrollHeight))}px`;
  }, [value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabled) onSubmit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && running) {
      event.preventDefault();
      onAbort();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!disabled) onSubmit();
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <GlassCard variant="composer" className="px-3.5 pb-2.5 pt-3">
        <label htmlFor="workspace-composer" className="sr-only">
          给 Agent 发送消息
        </label>
        <textarea
          ref={ref}
          id="workspace-composer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`给 ${agentId ?? "agent"} 发送消息…`}
          className="w-full resize-none bg-transparent px-1 text-[13px] leading-5 text-foreground placeholder:text-muted-foreground/75 focus:outline-none"
          style={{ minHeight: MIN_H, maxHeight: MAX_H }}
        />
        <div className="mt-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled
            className="h-7 w-7 rounded-lg text-muted-foreground"
            title="附件将在 4b 接入"
            aria-label="添加附件"
          >
            <PaperclipIcon className="h-4 w-4" />
          </Button>
          {queued > 0 && (
            <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
              队列 {queued}
            </span>
          )}
          <span className="ml-auto mr-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground/55">
            {running ? "ESC 中断" : "ENTER 发送"}
          </span>
          {running ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full border border-border/60"
              onClick={onAbort}
              title="中断当前任务（ESC）"
              aria-label="中断当前任务"
            >
              <span className="h-2.5 w-2.5 rounded-[2px] bg-foreground/75" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={disabled || !value.trim()}
              title="发送"
              aria-label="发送"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </GlassCard>
    </form>
  );
}
