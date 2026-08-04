import { Button } from "../../design-system/components";
import type { PendingApproval } from "../chat/ChatProvider";

interface ApprovalBarProps {
  approval: PendingApproval;
  pendingCount: number;
  onDecide: (toolCallId: string, decision: "allow" | "deny") => void;
  onAllowSession: (toolCallId: string) => void;
}

/**
 * Sits on the composer's upper edge and is rendered outside the transcript scroller, so it
 * stays visible no matter where the user has scrolled: while an approval is pending the task
 * is suspended, and a decision the user cannot see is a deadlock.
 *
 * No countdown: the server sets no deadline on approvals (`runtime/approvals.ts` — "no
 * timeout"), and `approval_request` carries only `{toolCall, origin}`. Inventing a timer
 * would be a UI that lies about the backend.
 */
export default function ApprovalBar({
  approval,
  pendingCount,
  onDecide,
  onAllowSession,
}: ApprovalBarProps) {
  const args = approval.args.replace(/\s+/g, " ").trim();
  return (
    <div
      role="alertdialog"
      aria-label="工具调用审批"
      className="animate-section-in mx-auto mb-2 w-[min(720px,100%-24px)] rounded-xl border border-[hsl(var(--status-blocked))] bg-surface-raised/95 px-3.5 py-2.5 shadow-composer backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--status-blocked))]" />
        <span className="text-[12px] font-medium text-foreground">
          请求执行 <span className="font-mono">{approval.name}</span>
        </span>
        {pendingCount > 1 && (
          <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            +{pendingCount - 1}
          </span>
        )}
      </div>
      {args && (
        <p className="mt-1 truncate pl-3.5 font-mono text-[11px] text-muted-foreground">
          {args}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 pl-3.5">
        <Button
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[11px]"
          onClick={() => onDecide(approval.toolCallId, "allow")}
        >
          允许本次
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[11px] hover:bg-surface-focus"
          title="把本会话的审批模式改为 allow-all（服务端生效）"
          onClick={() => onAllowSession(approval.toolCallId)}
        >
          本会话都允许
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[11px] text-[hsl(var(--chat-error))] hover:bg-surface-focus"
          onClick={() => onDecide(approval.toolCallId, "deny")}
        >
          拒绝
        </Button>
      </div>
    </div>
  );
}
