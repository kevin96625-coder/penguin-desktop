import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import {
  installSkills,
  listAgentSkills,
  listSkillLibrary,
  uninstallSkill,
} from "../../api/endpoints/skills";
import type { SkillGroupItem, SkillMetadataItem } from "../../api/types";
import { Card, SectionHeading } from "../../design-system/components";
import { useChat } from "../chat/ChatProvider";
import SkillCard from "./SkillCard";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * Skills library — the global catalogue (`GET /api/skills`) crossed with the skills
 * installed on the shell's current agent. Install/uninstall return the agent's
 * resulting list, so state is set straight from the response with no refetch.
 * Plain request/response only: no SSE, no polling.
 */
export default function SkillsPage() {
  const { projectId, agentId } = useChat();

  const [groups, setGroups] = useState<SkillGroupItem[] | null>(null);
  const [installed, setInstalled] = useState<Set<string> | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  /** Names with an in-flight attach/detach request. */
  const [pending, setPending] = useState<Set<string>>(new Set());
  /** Per-skill failure text, cleared when the same skill is retried. */
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // The library is global (readable once logged in) and never depends on the agent.
  useEffect(() => {
    let cancelled = false;
    listSkillLibrary()
      .then((res) => {
        if (!cancelled) setGroups(res.groups);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLibraryError(errText(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ChatProvider resolves project/agent asynchronously; re-read once it settles.
  useEffect(() => {
    if (!projectId || !agentId) return;
    let cancelled = false;
    listAgentSkills(projectId, agentId)
      .then((res) => {
        if (!cancelled) {
          setInstalled(new Set(res.skills.map((s) => s.name)));
          setAgentError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setAgentError(errText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId]);

  const markPending = useCallback((name: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  const onToggle = useCallback(
    async (skill: SkillMetadataItem, isInstalled: boolean) => {
      if (!projectId || !agentId) return;
      const { name } = skill;
      markPending(name, true);
      setCardErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
      try {
        if (isInstalled) {
          // DELETE answers 204 with no body, so there is no list to read back —
          // drop the name locally instead.
          await uninstallSkill(projectId, agentId, name);
          setInstalled((prev) => {
            const next = new Set(prev ?? []);
            next.delete(name);
            return next;
          });
        } else {
          const res = await installSkills(projectId, agentId, [name]);
          setInstalled(new Set(res.skills.map((s) => s.name)));
        }
      } catch (err) {
        setCardErrors((prev) => ({ ...prev, [name]: errText(err) }));
      } finally {
        markPending(name, false);
      }
    },
    [projectId, agentId, markPending],
  );

  const agentReady = Boolean(projectId && agentId);
  const totalSkills = groups?.reduce((n, g) => n + g.skills.length, 0) ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-4">
        <header className="animate-section-in mb-6">
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
            Skills
          </h1>
          <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
            技能库按分组罗列，可为当前 Agent 添加或移除技能
          </p>
          {agentReady && (
            <p className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground">
              {projectId} / {agentId}
              {installed && ` · 已安装 ${installed.size} / ${totalSkills}`}
            </p>
          )}
        </header>

        {libraryError && (
          <Card
            surface="panel"
            className="mb-4 border-[hsl(var(--chat-error))]/40 px-3.5 py-2.5"
          >
            <p className="text-[12px] text-[hsl(var(--chat-error))]">
              技能库加载失败：{libraryError}
            </p>
          </Card>
        )}

        {!libraryError && agentError && (
          <Card
            surface="panel"
            className="mb-4 border-[hsl(var(--chat-error))]/40 px-3.5 py-2.5"
          >
            <p className="text-[12px] text-[hsl(var(--chat-error))]">
              读取 Agent 已安装技能失败：{agentError}
            </p>
          </Card>
        )}

        {!libraryError && !agentError && !agentReady && (
          <Card surface="panel" className="mb-4 px-3.5 py-2.5">
            <p className="text-[12px] text-muted-foreground">
              正在解析当前 Agent，暂时无法添加或移除技能
            </p>
          </Card>
        )}

        {!libraryError && groups === null && (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            加载中…
          </p>
        )}

        {groups !== null && groups.length === 0 && (
          <p className="px-3 py-12 text-center text-sm text-muted-foreground">
            技能库为空
          </p>
        )}

        {groups?.map((group, gi) => {
          const count = group.skills.filter((s) => installed?.has(s.name)).length;
          return (
            <section
              key={group.id}
              className="animate-section-in mb-7"
              style={{ animationDelay: `${Math.min(gi, 4) * 50}ms` }}
            >
              <SectionHeading
                active={gi === 0}
                className="mb-3"
                action={
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
                    {installed ? `${count}/${group.skills.length}` : "—"} INSTALLED
                  </span>
                }
              >
                {group.titleZh ?? group.title}
              </SectionHeading>

              {group.skills.length === 0 ? (
                <Card surface="panel" className="px-3.5 py-6">
                  <p className="text-center text-[12px] text-muted-foreground">
                    该分组暂无技能
                  </p>
                </Card>
              ) : (
                <div className="stagger-chip grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.skills.map((skill) => (
                    <SkillCard
                      key={skill.name}
                      skill={skill}
                      installed={installed?.has(skill.name) ?? false}
                      pending={pending.has(skill.name)}
                      error={cardErrors[skill.name] ?? null}
                      disabled={!agentReady || installed === null}
                      onToggle={(s, isInstalled) => void onToggle(s, isInstalled)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
