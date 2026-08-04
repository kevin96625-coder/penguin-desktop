import { WrenchIcon } from "../../design-system/icons";
import type { WorkspaceMessage } from "./workspace-fixtures";

interface ChatMessageProps {
  message: WorkspaceMessage;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.kind === "tool") {
    return (
      <div className="animate-chat-bubble-in flex items-center gap-2 py-2 text-[12px] text-muted-foreground">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground/75">
          <WrenchIcon className="h-4 w-4" />
        </span>
        <span>{message.content}</span>
        {message.meta && (
          <span className="font-mono text-[10px] text-muted-foreground/65">{message.meta}</span>
        )}
      </div>
    );
  }

  if (message.kind === "user") {
    return (
      <div className="animate-chat-bubble-in my-4 flex justify-end">
        <div className="max-w-[78%] rounded-xl bg-[hsl(var(--chat-user-bg))] px-3.5 py-2.5 text-[13px] leading-5 text-[hsl(var(--chat-user-fg))] shadow-rim">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-chat-bubble-in my-4 text-[13px] leading-6 text-[hsl(var(--chat-assistant-fg))]">
      {message.content}
    </div>
  );
}
