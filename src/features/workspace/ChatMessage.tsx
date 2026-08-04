import { WrenchIcon } from "../../design-system/icons";
import type { ChatBlock } from "../chat/stream-model";

/** One-line argument digest for the tool row (mono 11px grey, visual memory §4). */
function digestArgs(args: string): string {
  if (!args.trim()) return "";
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    const parts = Object.entries(parsed)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    return parts.length > 120 ? `${parts.slice(0, 119)}…` : parts;
  } catch {
    // Arguments stream in as a JSON prefix; show the raw head until it closes.
    const flat = args.replace(/\s+/g, " ").trim();
    return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
  }
}

export default function ChatMessage({ block }: { block: ChatBlock }) {
  if (block.kind === "user") {
    return (
      <div className="animate-chat-bubble-in my-4 flex justify-end">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[hsl(var(--chat-user-bg))] px-3.5 py-2.5 text-[13px] leading-5 text-[hsl(var(--chat-user-fg))] shadow-rim">
          {block.text}
        </div>
      </div>
    );
  }

  if (block.kind === "thinking") {
    if (!block.text.trim()) return null;
    return (
      <details className="animate-chat-bubble-in my-3 rounded-xl border border-border/40 bg-surface-panel/60 px-3 py-2">
        <summary className="cursor-pointer select-none text-[11px] text-muted-foreground">
          思考过程{block.streaming ? "（进行中）" : ""}
        </summary>
        <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-muted-foreground">
          {block.text}
        </p>
      </details>
    );
  }

  if (block.kind === "tool") {
    return (
      <div className="animate-chat-bubble-in my-2">
        <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground/75">
            <WrenchIcon className="h-4 w-4" />
          </span>
          <span className="font-medium text-foreground/80">{block.name || "tool"}</span>
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground/70">
            {digestArgs(block.args)}
          </span>
          {block.streaming && (
            <span className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--chat-running))]" />
          )}
        </div>
        {block.output !== undefined && block.output.trim() !== "" && (
          <pre className="ml-7 mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-surface-panel/70 px-2.5 py-2 font-mono text-[11px] leading-4 text-muted-foreground">
            {block.output}
          </pre>
        )}
      </div>
    );
  }

  if (block.kind === "notice") {
    return (
      <p
        className={`animate-chat-bubble-in my-2 text-[11px] ${
          block.tone === "error"
            ? "text-[hsl(var(--chat-error))]"
            : "text-muted-foreground"
        }`}
      >
        {block.text}
      </p>
    );
  }

  // assistant: no bubble, laid straight on the canvas (visual memory §4)
  return (
    <div className="animate-chat-bubble-in my-4 whitespace-pre-wrap text-[13px] leading-6 text-[hsl(var(--chat-assistant-fg))]">
      {block.text}
      {block.streaming && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-foreground/45" />
      )}
    </div>
  );
}
