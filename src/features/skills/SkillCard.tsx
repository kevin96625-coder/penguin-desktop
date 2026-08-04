import { Button, Card, StatusBadge } from "../../design-system/components";
import { WrenchIcon } from "../../design-system/icons";
import type { SkillMetadataItem } from "../../api/types";

export interface SkillCardProps {
  skill: SkillMetadataItem;
  installed: boolean;
  /** A request for this skill is in flight. */
  pending: boolean;
  /** Per-card failure text from the last attach/detach attempt. */
  error?: string | null;
  /** No project/agent resolved yet — actions stay disabled. */
  disabled: boolean;
  onToggle: (skill: SkillMetadataItem, installed: boolean) => void;
}

/**
 * One library skill. `skill.icon` is raw SVG markup from the skill directory; we
 * deliberately never inject it (no dangerouslySetInnerHTML) and show the generic
 * design-system wrench glyph instead.
 */
export default function SkillCard({
  skill,
  installed,
  pending,
  error,
  disabled,
  onToggle,
}: SkillCardProps) {
  const summary =
    skill.shortDescriptionZh ?? skill.shortDescription ?? skill.description;

  return (
    <Card
      surface={installed ? "raised" : "panel"}
      className="animate-section-in flex min-h-[132px] flex-col p-3.5 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-surface-canvas text-muted-foreground"
        >
          <WrenchIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground/90">
            {skill.name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground/75">
            v{skill.version}
            {skill.updated ? ` · ${skill.updated}` : ""}
          </p>
        </div>
        {installed && <StatusBadge status="complete">已安装</StatusBadge>}
      </div>

      <p className="mt-2.5 line-clamp-3 text-[12px] leading-5 text-muted-foreground">
        {summary}
      </p>

      {error && (
        <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--chat-error))]">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-3">
        <Button
          size="sm"
          variant={installed ? "ghost" : "outline"}
          disabled={pending || disabled}
          onClick={() => onToggle(skill, installed)}
          aria-label={`${installed ? "移除" : "添加"}技能 ${skill.name}`}
        >
          {pending ? "处理中…" : installed ? "从 Agent 移除" : "添加到 Agent"}
        </Button>
      </div>
    </Card>
  );
}
