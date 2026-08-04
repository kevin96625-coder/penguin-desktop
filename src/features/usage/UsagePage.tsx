import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { listProjects } from "../../api/endpoints/sessions";
import {
  USAGE_GROUP_BYS,
  getUsage,
  getUsageErrors,
  type UsageGroupBy,
} from "../../api/endpoints/usage";
import type { UsageBucket, UsageErrorItem, UsageResponse } from "../../api/types";
import {
  Button,
  Card,
  SectionHeading,
  StatCard,
} from "../../design-system/components";
import {
  NO_VALUE,
  costHint,
  formatCost,
  formatTime,
  formatTokens,
  isCostIncomplete,
} from "./usage-format";

/** Page size of the error detail table — matches the server's `errors.recent` window. */
const ERROR_PAGE_SIZE = 20;

const groupByLabels: Record<UsageGroupBy, string> = {
  date: "按日期",
  agent: "按 Agent",
  model: "按模型",
  session: "按会话",
};

/** Header of the group-key column, so the table says what the key actually is. */
const groupKeyLabels: Record<UsageGroupBy, string> = {
  date: "日期",
  agent: "Agent",
  model: "模型",
  session: "会话",
};

const summaryLabels: { key: keyof UsageResponse["summary"]; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "last7d", label: "近 7 天" },
  { key: "total", label: "累计" },
];

/**
 * Usage / cost center.
 *
 * Read-only aggregate: two GET endpoints, no stream. The page's one hard correctness rule
 * is that an unpriced model reports `cost: null` with `hasUncosted: true` — that is
 * "unknown", not "free", so every cost cell here renders a dash plus an explanation
 * instead of a zero amount.
 */
export default function UsagePage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectResolved, setProjectResolved] = useState(false);
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("date");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Error detail table: the dashboard payload carries page 1, later pages are appended.
  const [olderErrors, setOlderErrors] = useState<UsageErrorItem[]>([]);
  const [loadingMoreErrors, setLoadingMoreErrors] = useState(false);
  const [errorsPagingError, setErrorsPagingError] = useState<string | null>(null);

  // Step 1: resolve the project. The server has no global usage route — usage hangs off a
  // project — and this page is mounted without a project param, so it takes the first one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { projects } = await listProjects();
        if (cancelled) return;
        const first = projects[0]?.projectId ?? null;
        setProjectId(first);
        // With a project in hand the second effect takes over the loading flag; without
        // one there is nothing left to fetch, so settle here.
        if (!first) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(toMessage(err));
          setLoading(false);
        }
      } finally {
        if (!cancelled) setProjectResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2: (re)fetch the aggregate whenever the project or the grouping changes.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOlderErrors([]);
    setErrorsPagingError(null);
    (async () => {
      try {
        const res = await getUsage(projectId, { groupBy });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(toMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, groupBy]);

  const shownErrors = data ? [...data.errors.recent, ...olderErrors] : [];
  const hasMoreErrors = data ? shownErrors.length < data.errors.total : false;

  const loadMoreErrors = useCallback(async () => {
    if (!projectId) return;
    setLoadingMoreErrors(true);
    setErrorsPagingError(null);
    try {
      const page = await getUsageErrors(projectId, {
        offset: shownErrors.length,
        limit: ERROR_PAGE_SIZE,
      });
      setOlderErrors((prev) => [...prev, ...page.items]);
    } catch (err) {
      setErrorsPagingError(toMessage(err));
    } finally {
      setLoadingMoreErrors(false);
    }
  }, [projectId, shownErrors.length]);

  // Any unpriced usage anywhere on the page gets one shared explanation banner.
  const hasUncosted =
    data !== null &&
    (summaryLabels.some(({ key }) => data.summary[key].hasUncosted) ||
      data.groups.some((row) => row.hasUncosted));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-4">
      <header className="animate-section-in mb-6">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
          用量与成本
        </h1>
        <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
          Token 消耗、请求数与错误记录；成本按查询时的定价表换算
        </p>
        {projectId && (
          <p className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground">
            {projectId}
          </p>
        )}
      </header>

      {error && (
        <Card surface="panel" className="animate-section-in mb-6 px-4 py-3">
          <p className="text-[13px] text-[hsl(var(--chat-error))]">
            加载失败 · {error}
          </p>
        </Card>
      )}

      {!error && projectResolved && !projectId && (
        <Card surface="panel" className="animate-section-in px-4 py-10">
          <p className="text-center text-sm text-muted-foreground">
            暂无项目 · 创建项目后即可查看用量
          </p>
        </Card>
      )}

      {!error && loading && (
        <Card surface="panel" className="animate-section-in px-4 py-10">
          <p className="text-center text-sm text-muted-foreground">加载中…</p>
        </Card>
      )}

      {!error && !loading && data && (
        <>
          <section className="animate-section-in mb-6">
            <SectionHeading active className="mb-3">
              用量概览
            </SectionHeading>
            <div className="stagger-chip grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {summaryLabels.map(({ key, label }, index) => (
                <SummaryCard
                  key={key}
                  label={label}
                  bucket={data.summary[key]}
                  emphasis={index === summaryLabels.length - 1}
                />
              ))}
            </div>
            {hasUncosted && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                部分模型未配置定价表（例如自定义 CLIProxy 端点），其用量已计入 Token
                与请求数，但无法换算成本，成本一律显示为 {NO_VALUE}
                ；配置定价后会回溯计入。
              </p>
            )}
          </section>

          <section className="animate-section-in mb-6" style={{ animationDelay: "60ms" }}>
            <SectionHeading
              className="mb-3"
              action={
                <div className="flex flex-wrap items-center gap-1">
                  {USAGE_GROUP_BYS.map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant={option === groupBy ? "secondary" : "ghost"}
                      aria-pressed={option === groupBy}
                      onClick={() => setGroupBy(option)}
                    >
                      {groupByLabels[option]}
                    </Button>
                  ))}
                </div>
              }
            >
              用量明细
            </SectionHeading>
            <UsageTable data={data} />
          </section>

          <section className="animate-section-in" style={{ animationDelay: "120ms" }}>
            <SectionHeading
              className="mb-3"
              action={
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
                  {data.errors.total} ERRORS · {data.errors.unexpected} UNEXPECTED
                </span>
              }
            >
              错误记录
            </SectionHeading>
            {data.errors.topCode && (
              <p className="mb-2 text-xs leading-5 text-muted-foreground">
                最常见：
                <span className="font-mono">
                  {data.errors.topCode.source} · {data.errors.topCode.code}
                </span>{" "}
                （{data.errors.topCode.kind}，{data.errors.topCode.count} 次）
              </p>
            )}
            <ErrorTable items={shownErrors} />
            {errorsPagingError && (
              <p className="mt-2 text-xs text-[hsl(var(--chat-error))]">
                加载更多失败 · {errorsPagingError}
              </p>
            )}
            {hasMoreErrors && (
              <div className="mt-2 flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingMoreErrors}
                  onClick={() => void loadMoreErrors()}
                >
                  {loadingMoreErrors
                    ? "加载中…"
                    : `加载更早的记录（已显示 ${shownErrors.length} / ${data.errors.total}）`}
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** One summary tile: tokens are the headline, requests and cost sit underneath. */
function SummaryCard({
  label,
  bucket,
  emphasis,
}: {
  label: string;
  bucket: UsageBucket;
  emphasis: boolean;
}) {
  const hint = costHint(bucket.cost, bucket.hasUncosted);
  return (
    <StatCard
      className="animate-section-in"
      label={`${label} · Token`}
      value={bucket.total === 0 ? null : formatTokens(bucket.total)}
      emphasis={emphasis}
      trend={
        <span title={hint}>
          {bucket.requests} 次请求 · 成本 {formatCost(bucket.cost)}
          {isCostIncomplete(bucket.cost, bucket.hasUncosted) && bucket.total > 0 && (
            <span className="text-muted-foreground/75">（无定价）</span>
          )}
        </span>
      }
    />
  );
}

function UsageTable({ data }: { data: UsageResponse }) {
  if (data.groups.length === 0) {
    return (
      <Card surface="panel" className="px-4 py-10">
        <p className="text-center text-sm text-muted-foreground">
          暂无用量记录 · 发起一次对话后即可统计
        </p>
      </Card>
    );
  }

  return (
    <Card surface="panel" className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border/50 text-left text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
            <th className="px-3 py-2 font-medium">
              {groupKeyLabels[data.groupBy]}
            </th>
            <th className="px-3 py-2 text-right font-medium">缓存读取</th>
            <th className="px-3 py-2 text-right font-medium">缓存写入</th>
            <th className="px-3 py-2 text-right font-medium">输出</th>
            <th className="px-3 py-2 text-right font-medium">合计 Token</th>
            <th className="px-3 py-2 text-right font-medium">请求数</th>
            <th className="px-3 py-2 text-right font-medium">成本</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {data.groups.map((row) => {
            const hint = costHint(row.cost, row.hasUncosted);
            return (
              <tr
                key={row.provider ? `${row.provider}/${row.key}` : row.key}
                className="transition-colors duration-150 hover:bg-surface-raised"
              >
                <td className="px-3 py-2">
                  <span className="block truncate font-mono text-[12px] text-foreground/90">
                    {row.key}
                  </span>
                  {row.provider && (
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                      {row.provider}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatTokens(row.cacheRead)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatTokens(row.cacheWrite)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatTokens(row.output)}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                  {formatTokens(row.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.requests}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  title={hint}
                >
                  <span
                    className={
                      isCostIncomplete(row.cost, row.hasUncosted)
                        ? "text-muted-foreground/70"
                        : "text-foreground"
                    }
                  >
                    {formatCost(row.cost)}
                  </span>
                  {row.cost !== null && row.hasUncosted && (
                    <span className="ml-1 text-[11px] text-muted-foreground/70">
                      部分
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function ErrorTable({ items }: { items: UsageErrorItem[] }) {
  if (items.length === 0) {
    return (
      <Card surface="panel" className="px-4 py-10">
        <p className="text-center text-sm text-muted-foreground">暂无错误记录</p>
      </Card>
    );
  }

  return (
    <Card surface="panel" className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border/50 text-left text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
            <th className="px-3 py-2 font-medium">时间</th>
            <th className="px-3 py-2 font-medium">来源</th>
            <th className="px-3 py-2 font-medium">代码</th>
            <th className="px-3 py-2 font-medium">消息</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((item, index) => (
            <tr
              key={`${item.ts}-${item.source}-${item.code}-${index}`}
              className="transition-colors duration-150 hover:bg-surface-raised"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {formatTime(item.ts)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {item.source}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-foreground/90">
                {item.code}
                <span className="ml-1 text-[11px] text-muted-foreground/75">
                  {item.kind}
                </span>
              </td>
              <td className="px-3 py-2 text-foreground/80">
                <span className="line-clamp-2 break-all">
                  {item.message || NO_VALUE}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function toMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}
