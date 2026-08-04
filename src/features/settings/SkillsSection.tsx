import { useMemo, useState } from "react";
import {
  installSkills,
  listAgentSkills,
  listSkillLibrary,
  uninstallSkill,
  type AgentSkillsResponse,
} from "../../api/endpoints/skills";
import type { SkillLibraryResponse, SkillMetadataItem } from "../../api/types";
import { Button, Input } from "../../design-system/components";
import {
  Empty,
  ErrorNote,
  ListShell,
  Loading,
  Meta,
  Panel,
  useResource,
  errText,
} from "./common";

/** Chinese short description when the skill ships one, else the English one, else the full text. */
const blurb = (s: SkillMetadataItem) =>
  s.shortDescriptionZh ?? s.shortDescription ?? s.description;

function SkillRow({
  skill,
  group,
  installedVersion,
  busy,
  onInstall,
  onUninstall,
}: {
  skill: SkillMetadataItem;
  group?: string;
  installedVersion?: number;
  busy: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}) {
  const outdated =
    installedVersion !== undefined && installedVersion < skill.version;
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[12px] font-medium text-foreground/90">
            {skill.name}
          </span>
          <span className="shrink-0 rounded border border-border/60 px-1.5 py-px font-mono text-[10px] leading-4 text-muted-foreground">
            v{skill.version}
          </span>
          {group && (
            <span className="shrink-0 rounded border border-border/60 px-1.5 py-px text-[10px] leading-4 text-muted-foreground">
              {group}
            </span>
          )}
          {outdated && (
            <span className="shrink-0 rounded border border-border/60 px-1.5 py-px text-[10px] leading-4 text-muted-foreground">
              可更新 → v{skill.version}
            </span>
          )}
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
          {blurb(skill)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {onInstall && (
          <Button variant="ghost" size="sm" onClick={onInstall} disabled={busy}>
            {outdated ? "更新" : "安装"}
          </Button>
        )}
        {onUninstall && (
          <Button variant="ghost" size="sm" onClick={onUninstall} disabled={busy}>
            卸载
          </Button>
        )}
      </span>
    </li>
  );
}

/**
 * Skills: the Agent's installed set on top, the global library below.
 *
 * Install/uninstall both answer the Agent's resulting skill list, so the installed panel
 * is refreshed from the write's own response instead of a follow-up GET. The library is
 * global (`GET /api/skills`) and never changes as a result of these writes.
 */
export default function SkillsSection({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const key = `${projectId}/${agentId}`;
  const installed = useResource<AgentSkillsResponse>(key, () =>
    listAgentSkills(projectId, agentId),
  );
  const library = useResource<SkillLibraryResponse>("library", listSkillLibrary);

  const [query, setQuery] = useState("");
  const [busyName, setBusyName] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const installedList = installed.data?.skills ?? [];
  const versionByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of installedList) map.set(s.name, s.version);
    return map;
  }, [installedList]);

  /** Library flattened to rows, carrying the group title, minus a search filter. */
  const libraryRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Array<{ skill: SkillMetadataItem; group: string }> = [];
    for (const group of library.data?.groups ?? []) {
      const title = group.titleZh ?? group.title;
      for (const skill of group.skills) {
        if (
          q &&
          !skill.name.toLowerCase().includes(q) &&
          !blurb(skill).toLowerCase().includes(q)
        ) {
          continue;
        }
        rows.push({ skill, group: title });
      }
    }
    return rows;
  }, [library.data, query]);

  /**
   * Install echoes the resulting list; uninstall answers 204 with no body. So the
   * result is only applied when the call actually returned one — otherwise the list
   * is re-read, rather than assuming a shape the server never sent.
   */
  async function run(name: string, fn: () => Promise<AgentSkillsResponse | void>) {
    setBusyName(name);
    setWriteError(null);
    try {
      const res = await fn();
      if (res) installed.set(res);
      else installed.set(await listAgentSkills(projectId, agentId));
    } catch (err) {
      setWriteError(errText(err));
    } finally {
      setBusyName(null);
    }
  }

  return (
    <Panel
      title="技能 Skills"
      description="已装载的技能会进入 Agent 的可用能力集；技能库为全局共享，安装即复制一份到当前 Agent。"
      action={<Meta>已装载 {installedList.length}</Meta>}
    >
      {installed.error && <ErrorNote>{installed.error}</ErrorNote>}
      {writeError && <ErrorNote>{writeError}</ErrorNote>}
      {!installed.data && !installed.error && <Loading />}

      {installed.data && (
        <>
          <div className="mb-1.5 text-[12px] font-medium text-foreground/80">已装载</div>
          <ListShell>
            {installedList.length === 0 ? (
              <Empty>当前 Agent 尚未装载技能</Empty>
            ) : (
              <ul className="divide-y divide-border/40">
                {installedList.map((skill) => (
                  <SkillRow
                    key={skill.name}
                    skill={skill}
                    busy={busyName === skill.name}
                    onUninstall={() =>
                      void run(skill.name, () =>
                        uninstallSkill(projectId, agentId, skill.name),
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </ListShell>
        </>
      )}

      <div className="mb-1.5 mt-5 flex items-center gap-3">
        <span className="text-[12px] font-medium text-foreground/80">技能库</span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索技能…"
          className="ml-auto max-w-xs"
        />
      </div>
      {library.error && <ErrorNote>{library.error}</ErrorNote>}
      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-border/50 bg-surface-panel/70">
        {!library.data && !library.error ? (
          <Loading />
        ) : libraryRows.length === 0 ? (
          <Empty>没有匹配的技能</Empty>
        ) : (
          <ul className="divide-y divide-border/40">
            {libraryRows.map(({ skill, group }) => {
              const version = versionByName.get(skill.name);
              const upToDate = version !== undefined && version >= skill.version;
              return (
                <SkillRow
                  key={`${group}/${skill.name}`}
                  skill={skill}
                  group={group}
                  installedVersion={version}
                  busy={busyName === skill.name}
                  onInstall={
                    upToDate
                      ? undefined
                      : () =>
                          void run(skill.name, () =>
                            installSkills(projectId, agentId, [skill.name]),
                          )
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
