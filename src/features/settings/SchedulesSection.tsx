import { useState } from "react";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
} from "../../api/endpoints/agents";
import type { ScheduleItem, ScheduleUpsertRequest, SchedulesResponse } from "../../api/types";
import { Button, Dialog, Input, StatusBadge } from "../../design-system/components";
import type { BadgeStatus } from "../../design-system/components";
import {
  Empty,
  ErrorNote,
  Field,
  ListShell,
  Loading,
  Meta,
  Panel,
  useResource,
  errText,
} from "./common";

/** Server-side schedule status → badge tone + Chinese label. */
const statusMeta: Record<string, { badge: BadgeStatus; label: string }> = {
  active: { badge: "running", label: "生效中" },
  disabled: { badge: "blocked", label: "已停用" },
  expired: { badge: "idle", label: "已过期" },
  done: { badge: "complete", label: "已完成" },
  missed: { badge: "failed", label: "已错过" },
  invalid: { badge: "failed", label: "配置无效" },
};

/** Filename rule shared with the server (`isValidId`): safe for a path segment. */
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** ISO instant → the `YYYY-MM-DDTHH:mm` shape `<input type="datetime-local">` wants, in local time. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Local form value → a full ISO instant with an explicit offset (never an ambiguous string). */
function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const fmt = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleString() : "—";

interface FormState {
  /** Empty while editing: the name is the file identity and cannot be renamed. */
  name: string;
  prompt: string;
  enabled: boolean;
  startAtLocal: string;
  period: string;
  endAtLocal: string;
  sessionId: string;
  workspace: string;
}

const emptyForm = (): FormState => ({
  name: "",
  prompt: "",
  enabled: true,
  startAtLocal: toLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
  period: "",
  endAtLocal: "",
  sessionId: "",
  workspace: "",
});

const formOf = (item: ScheduleItem): FormState => ({
  name: item.name,
  prompt: item.prompt,
  enabled: item.enabled,
  startAtLocal: toLocalInput(item.startAt),
  period: item.period ?? "",
  endAtLocal: toLocalInput(item.endAt),
  sessionId: item.sessionId ?? "",
  workspace: item.workspace ?? "",
});

/**
 * Straight item → body echo, used by the enable/disable toggle. Goes through the item
 * rather than the form so nothing is re-parsed through the minute-resolution
 * `datetime-local` round trip (which would silently drop seconds off `startAt`).
 */
function bodyFromItem(item: ScheduleItem): ScheduleUpsertRequest {
  return {
    prompt: item.prompt,
    enabled: item.enabled,
    startAt: item.startAt,
    ...(item.period !== undefined ? { period: item.period } : {}),
    ...(item.endAt !== undefined ? { endAt: item.endAt } : {}),
    ...(item.sessionId !== undefined ? { sessionId: item.sessionId } : {}),
    ...(item.workspace !== undefined ? { workspace: item.workspace } : {}),
    ...(item.modelId !== undefined && item.provider !== undefined
      ? { modelId: item.modelId, provider: item.provider }
      : {}),
  };
}

/**
 * A POST/PUT rewrites the whole .toml, so every field the user wants to keep must be
 * present in the body. `modelId`/`provider` are a pair the server rejects unless both are
 * sent; this form never edits them, so they are carried over from the existing item.
 */
function bodyOf(form: FormState, previous?: ScheduleItem): ScheduleUpsertRequest {
  const period = form.period.trim();
  const endAt = fromLocalInput(form.endAtLocal);
  const sessionId = form.sessionId.trim();
  const workspace = form.workspace.trim();
  const carriesModel = previous?.modelId !== undefined && previous?.provider !== undefined;
  return {
    prompt: form.prompt,
    enabled: form.enabled,
    startAt: fromLocalInput(form.startAtLocal),
    ...(period ? { period } : {}),
    ...(endAt ? { endAt } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(workspace ? { workspace } : {}),
    ...(carriesModel
      ? { modelId: previous.modelId, provider: previous.provider }
      : {}),
  };
}

/**
 * Schedules: one .toml file per entry under agent_state/schedule/, `name` being both the
 * filename and the identity — hence create sends `name` in the body while update/delete
 * put it in the path, and renaming is not offered.
 */
export default function SchedulesSection({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  const key = `${projectId}/${agentId}`;
  const res = useResource<SchedulesResponse>(key, () => listSchedules(projectId, agentId));

  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [removing, setRemoving] = useState<ScheduleItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const items = res.data?.schedules ?? [];
  const patch = (next: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...next } : f));

  const nameTaken =
    form !== null &&
    editing === null &&
    items.some((s) => s.name === form.name.trim());
  const nameValid = form !== null && NAME_RE.test(form.name.trim());
  const canSubmit =
    form !== null &&
    form.prompt.trim() !== "" &&
    form.startAtLocal !== "" &&
    (editing !== null || (nameValid && !nameTaken));

  function openCreate() {
    setWriteError(null);
    setEditing(null);
    setForm(emptyForm());
  }

  function openEdit(item: ScheduleItem) {
    setWriteError(null);
    setEditing(item);
    setForm(formOf(item));
  }

  async function submit() {
    if (!form) return;
    setBusy(true);
    setWriteError(null);
    try {
      if (editing) {
        await updateSchedule(projectId, agentId, editing.name, bodyOf(form, editing));
      } else {
        await createSchedule(projectId, agentId, form.name.trim(), bodyOf(form));
      }
      // Both writes answer a single ScheduleItem; the list also carries derived runtime
      // state (nextFireAt / queued), so refetch it rather than splicing locally.
      res.reload();
      setForm(null);
      setEditing(null);
    } catch (err) {
      setWriteError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ScheduleItem) {
    setBusy(true);
    setWriteError(null);
    try {
      await updateSchedule(projectId, agentId, item.name, {
        ...bodyFromItem(item),
        enabled: !item.enabled,
      });
      res.reload();
    } catch (err) {
      setWriteError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setWriteError(null);
    try {
      await deleteSchedule(projectId, agentId, removing.name);
      res.reload();
      setRemoving(null);
    } catch (err) {
      setWriteError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title="定时任务 Schedules"
        description="每条任务对应 agent_state/schedule/ 下的一个 .toml 文件；保存后立即参与调度。周期最短 5 分钟。"
        action={
          <Button size="sm" onClick={openCreate} disabled={!res.data}>
            新建任务
          </Button>
        }
      >
        {res.error && <ErrorNote>{res.error}</ErrorNote>}
        {writeError && <ErrorNote>{writeError}</ErrorNote>}
        {!res.data && !res.error && <Loading />}

        {res.data && (
          <>
            <ListShell>
              {items.length === 0 ? (
                <Empty>暂无定时任务</Empty>
              ) : (
                <ul className="divide-y divide-border/40">
                  {items.map((item) => {
                    const meta = statusMeta[item.status] ?? {
                      badge: "idle" as BadgeStatus,
                      label: item.status,
                    };
                    return (
                      <li key={item.name} className="px-3 py-2">
                        <div className="flex items-start gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-mono text-[12px] font-medium text-foreground/90">
                                {item.name}
                              </span>
                              <StatusBadge status={meta.badge}>{meta.label}</StatusBadge>
                              {item.queued && (
                                <span className="rounded border border-border/60 px-1.5 py-px text-[10px] leading-4 text-muted-foreground">
                                  排队中
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                              {item.prompt}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              <Meta>
                                {item.period ? `周期 ${item.period}` : "一次性"}
                              </Meta>
                              <Meta>下次 {fmt(item.nextFireAt)}</Meta>
                              <Meta>上次 {fmt(item.lastFiredAt)}</Meta>
                            </span>
                            {item.invalidReason && (
                              <span className="mt-1 block text-[11px] leading-4 text-[hsl(var(--chat-error))]">
                                {item.invalidReason}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggle(item)}
                              disabled={busy}
                            >
                              {item.enabled ? "停用" : "启用"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(item)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoving(item)}
                            >
                              删除
                            </Button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ListShell>

            {res.data.invalidFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {res.data.invalidFiles.map((f) => (
                  <li
                    key={f.name}
                    className="text-[11px] leading-4 text-[hsl(var(--chat-error))]"
                  >
                    <span className="font-mono">{f.name}</span> · {f.error}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={editing ? `编辑任务 ${editing.name}` : "新建定时任务"}
        className="max-h-[80vh] overflow-y-auto"
      >
        {form && (
          <div className="space-y-3">
            {!editing && (
              <Field label="名称" hint="作为文件名，仅允许字母、数字、点、下划线与短横线。">
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="daily-report"
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
            )}
            <Field label="提示词">
              <textarea
                value={form.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                rows={4}
                spellCheck={false}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[13px] leading-5 text-foreground focus:outline-none focus-visible:outline-none"
              />
            </Field>
            <Field label="开始时间">
              <Input
                type="datetime-local"
                value={form.startAtLocal}
                onChange={(e) => patch({ startAtLocal: e.target.value })}
              />
            </Field>
            <Field label="结束时间" hint="留空表示不限。">
              <Input
                type="datetime-local"
                value={form.endAtLocal}
                onChange={(e) => patch({ endAtLocal: e.target.value })}
              />
            </Field>
            <Field label="周期" hint="如 30m / 12h / 7d，留空为一次性任务；最短 5m。">
              <Input
                value={form.period}
                onChange={(e) => patch({ period: e.target.value })}
                placeholder="30m"
                className="font-mono"
              />
            </Field>
            <Field label="绑定会话 ID" hint="留空则每次触发新建会话。">
              <Input
                value={form.sessionId}
                onChange={(e) => patch({ sessionId: e.target.value })}
                spellCheck={false}
                className="font-mono"
              />
            </Field>
            <label className="flex select-none items-center gap-2 text-[12px] text-foreground/80">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
              />
              启用该任务
            </label>
            {nameTaken && <ErrorNote>同名任务已存在。</ErrorNote>}
            {form.name.trim() !== "" && !nameValid && (
              <ErrorNote>名称含非法字符。</ErrorNote>
            )}
            {writeError && <ErrorNote>{writeError}</ErrorNote>}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
            取消
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={busy || !canSubmit}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="删除定时任务？"
      >
        <p className="text-[13px] leading-6 text-muted-foreground">
          将删除 <span className="font-mono text-foreground/85">{removing?.name}</span>{" "}
          对应的 .toml 文件，且无法恢复。
        </p>
        {writeError && <ErrorNote>{writeError}</ErrorNote>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void confirmRemove()}
            disabled={busy}
          >
            {busy ? "删除中…" : "确认删除"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
