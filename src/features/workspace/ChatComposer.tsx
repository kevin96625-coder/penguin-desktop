import type { FormEvent, KeyboardEvent } from "react";
import { Button, GlassCard } from "../../design-system/components";
import { ArrowUpIcon, ChevronDownIcon, PaperclipIcon } from "../../design-system/icons";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function ChatComposer({ value, onChange, onSubmit }: ChatComposerProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <GlassCard variant="composer" className="px-3.5 pb-2.5 pt-3">
        <label htmlFor="workspace-composer" className="sr-only">给 Agent 发送本地预览消息</label>
        <textarea
          id="workspace-composer"
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="描述下一步任务，或粘贴代码与截图…"
          className="max-h-32 min-h-[46px] w-full resize-none bg-transparent px-1 text-[13px] leading-5 text-foreground placeholder:text-muted-foreground/75 focus:outline-none"
        />
        <div className="mt-1 flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground" title="添加附件（视觉预览）" aria-label="添加附件（视觉预览）">
            <PaperclipIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground" title="审批方式（视觉预览）">
            自动审批
            <ChevronDownIcon className="h-3 w-3" />
          </Button>
          <span className="ml-auto mr-1 font-mono text-[9px] tracking-[0.08em] text-muted-foreground/55">LOCAL PREVIEW</span>
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={!value.trim()}
            title="添加本地预览消息"
            aria-label="添加本地预览消息"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </Button>
        </div>
      </GlassCard>
    </form>
  );
}
