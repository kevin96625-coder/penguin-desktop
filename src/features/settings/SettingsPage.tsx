import { useState, type ReactNode } from "react";
import { SidebarItem } from "../../design-system/components";
import {
  ClockIcon,
  FlaskIcon,
  SettingsIcon,
  TerminalIcon,
  WrenchIcon,
} from "../../design-system/icons";
import { useChat } from "../chat/ChatProvider";
import AgentConfigSection from "./AgentConfigSection";
import ModelsSection from "./ModelsSection";
import SchedulesSection from "./SchedulesSection";
import SkillsSection from "./SkillsSection";
import VaultSection from "./VaultSection";

type SectionId = "agent" | "models" | "vault" | "skills" | "schedules";

const SECTIONS: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: "agent", label: "Agent 配置", icon: <SettingsIcon /> },
  { id: "models", label: "模型", icon: <FlaskIcon /> },
  { id: "vault", label: "密钥库", icon: <TerminalIcon /> },
  { id: "skills", label: "技能", icon: <WrenchIcon /> },
  { id: "schedules", label: "定时任务", icon: <ClockIcon /> },
];

/**
 * Settings — the page's own 224px left rail (visual memory §3) plus a single scrolling
 * work column. Each section mounts only while selected, so switching tabs re-reads that
 * surface from the server and the page never holds five stale snapshots at once.
 *
 * `projectId` / `agentId` come from the shell's ChatProvider singleton; every section is
 * scoped to that pair. Nothing here opens an SSE channel — all five surfaces are
 * request/response.
 */
export default function SettingsPage() {
  const { ready, error, projectId, agentId } = useChat();
  const [active, setActive] = useState<SectionId>("agent");

  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/50 bg-sidebar px-2 py-3">
        <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          设置
        </p>
        {SECTIONS.map((section) => (
          <SidebarItem
            key={section.id}
            icon={section.icon}
            active={active === section.id}
            onClick={() => setActive(section.id)}
          >
            {section.label}
          </SidebarItem>
        ))}
        {projectId && agentId && (
          <p className="mt-auto px-2 pt-4 font-mono text-[10px] leading-4 text-muted-foreground/75">
            {projectId}
            <br />
            {agentId}
          </p>
        )}
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-5">
          {!ready && <p className="text-sm text-muted-foreground">加载中…</p>}

          {ready && error && (
            <p className="text-sm text-[hsl(var(--chat-error))]">{error}</p>
          )}

          {ready && !error && (!projectId || !agentId) && (
            <p className="text-sm text-muted-foreground">
              未找到可用的 Project / Agent，设置项暂不可用。
            </p>
          )}

          {ready && projectId && agentId && (
            <>
              {active === "agent" && (
                <AgentConfigSection projectId={projectId} agentId={agentId} />
              )}
              {active === "models" && <ModelsSection projectId={projectId} />}
              {active === "vault" && (
                <VaultSection projectId={projectId} agentId={agentId} />
              )}
              {active === "skills" && (
                <SkillsSection projectId={projectId} agentId={agentId} />
              )}
              {active === "schedules" && (
                <SchedulesSection projectId={projectId} agentId={agentId} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
