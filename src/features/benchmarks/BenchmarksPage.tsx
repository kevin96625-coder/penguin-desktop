import { useState, type ReactNode } from "react";
import {
  listBenchmarkCases,
  listBenchmarks,
  listCaseFiles,
  readCaseFile,
} from "../../api/endpoints/benchmarks";
import type {
  BenchmarkCaseSummary,
  BenchmarkEvaluation,
  BenchmarkSummary,
  WorkspaceFileEntry,
  WorkspaceFilesResponse,
} from "../../api/types";
import {
  Button,
  Card,
  SectionHeading,
  StatCard,
  StatusBadge,
} from "../../design-system/components";
import {
  ChevronRightIcon,
  FileIcon,
  FlaskIcon,
  FolderIcon,
} from "../../design-system/icons";
import { useChat } from "../chat/ChatProvider";
import {
  formatBytes,
  formatCost,
  formatDuration,
  formatScore,
  formatTime,
} from "./format";
import { useResource, type Resource } from "./useResource";

/** The two case material trees the server exposes read-only. */
type CaseFileKind = "statement" | "rubric";

const KIND_LABEL: Record<CaseFileKind, string> = {
  statement: "题面 statement",
  rubric: "评分标准 rubric",
};

/** Scoreboard entries are time-ordered; the last one is the current standing. */
function latestEvaluation(b: BenchmarkSummary): BenchmarkEvaluation | null {
  return b.evaluations.length > 0
    ? b.evaluations[b.evaluations.length - 1]
    : null;
}

/* ------------------------------------------------------------------ shared */

function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className={
        tone === "error"
          ? "px-3 py-8 text-center text-xs text-[hsl(var(--chat-error))]"
          : "px-3 py-8 text-center text-sm text-muted-foreground"
      }
    >
      {children}
    </p>
  );
}

/**
 * Renders the loading / error / empty branches of a resource so every level
 * gets the same three states; `children` only sees non-empty ready data.
 */
function ResourceView<T>({
  resource,
  isEmpty,
  idleLabel,
  emptyLabel,
  children,
}: {
  resource: Resource<T>;
  isEmpty: (data: T) => boolean;
  idleLabel: string;
  emptyLabel: string;
  children: (data: T) => ReactNode;
}) {
  if (resource.status === "idle") return <Notice>{idleLabel}</Notice>;
  if (resource.status === "loading") return <Notice>加载中…</Notice>;
  if (resource.status === "error")
    return <Notice tone="error">加载失败 · {resource.message}</Notice>;
  if (isEmpty(resource.data)) return <Notice>{emptyLabel}</Notice>;
  return <>{children(resource.data)}</>;
}

/** Panel shell used by every list on the page (read-only, no row actions). */
function ListPanel({ children }: { children: ReactNode }) {
  return (
    <Card
      surface="panel"
      className="overflow-hidden bg-surface-panel/70 p-1 shadow-sm"
    >
      {children}
    </Card>
  );
}

function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav
      aria-label="层级导航"
      className="mb-4 flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRightIcon
              aria-hidden
              className="h-3.5 w-3.5 text-muted-foreground/50"
            />
          )}
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="max-w-[24ch] truncate rounded px-1 py-0.5 transition-colors duration-150 hover:text-foreground focus:outline-none"
            >
              {item.label}
            </button>
          ) : (
            <span className="max-w-[32ch] truncate px-1 py-0.5 font-medium text-foreground/85">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------- level 1: 列表 */

function BenchmarkRow({
  benchmark,
  onOpen,
}: {
  benchmark: BenchmarkSummary;
  onOpen: () => void;
}) {
  const latest = latestEvaluation(benchmark);
  return (
    <li className="animate-section-in p-1">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-[60px] w-full select-none items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-border/40 hover:bg-surface-raised active:translate-y-px focus:outline-none"
      >
        <FlaskIcon
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground/70"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground/90">
            {benchmark.title}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
            {benchmark.id} · {benchmark.caseCount} CASES
            {benchmark.runs ? ` · ${benchmark.runs} RUNS/CASE` : ""}
          </span>
          {benchmark.description && (
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground/80">
              {benchmark.description}
            </span>
          )}
        </span>
        {/* Inline scoreboard: latest score + version + time. */}
        {latest ? (
          <span className="shrink-0 text-right">
            <span className="block text-[15px] font-semibold tabular-nums text-foreground">
              {formatScore(latest.score)}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
              v{latest.version} · {formatTime(latest.time)}
            </span>
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
            尚无评测
          </span>
        )}
        <ChevronRightIcon
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground/45 transition-colors duration-150 group-hover:text-foreground/60"
        />
      </button>
    </li>
  );
}

/* --------------------------------------------------------- level 2: 用例 */

function CaseRow({
  item,
  onOpen,
}: {
  item: BenchmarkCaseSummary;
  onOpen: () => void;
}) {
  return (
    <li className="animate-section-in p-1">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-[52px] w-full select-none items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-border/40 hover:bg-surface-raised active:translate-y-px focus:outline-none"
      >
        <span
          aria-hidden
          className="h-7 w-[2px] shrink-0 rounded-full bg-foreground/10 transition-colors duration-150 group-hover:bg-foreground/25"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground/90">
            {item.title}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
            {item.id}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground/45 transition-colors duration-150 group-hover:text-foreground/60"
        />
      </button>
    </li>
  );
}

/* ---------------------------------------------------- level 3: 文件与内容 */

/**
 * One material tree. The API lists a case's root only (no path parameter), so
 * directory entries are shown for completeness but are not navigable.
 */
function FileTree({
  kind,
  resource,
  activePath,
  onSelect,
}: {
  kind: CaseFileKind;
  resource: Resource<WorkspaceFilesResponse>;
  activePath: string | null;
  onSelect: (entry: WorkspaceFileEntry) => void;
}) {
  return (
    <section>
      <SectionHeading className="mb-2">{KIND_LABEL[kind]}</SectionHeading>
      <ListPanel>
        <ResourceView
          resource={resource}
          isEmpty={(d) => d.entries.length === 0}
          idleLabel="选择用例后加载"
          emptyLabel="该目录没有文件"
        >
          {(data) => (
            <ul className="stagger-menu">
              {data.entries.map((entry) =>
                entry.kind === "dir" ? (
                  <li
                    key={entry.name}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground/70"
                    title="接口仅提供根目录列表，子目录暂不可展开"
                  >
                    <FolderIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  </li>
                ) : (
                  <li key={entry.name} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className={
                        "group flex w-full select-none items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-[background-color,border-color] duration-150 ease-out focus:outline-none " +
                        (activePath === entry.name
                          ? "border-border/50 bg-surface-raised"
                          : "border-transparent hover:border-border/40 hover:bg-surface-raised")
                      }
                    >
                      <FileIcon
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/90">
                        {entry.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/75">
                        {formatBytes(entry.sizeBytes)}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </ResourceView>
      </ListPanel>
    </section>
  );
}

/* ------------------------------------------------------------- 浏览器主体 */

function BenchmarksBrowser({
  projectId,
  agentId,
}: {
  projectId: string;
  agentId: string;
}) {
  // Drill-down state: one nullable selection per level. Selecting a level clears
  // everything below it, so a resource key can never mix two different parents.
  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);
  const [activeCase, setActiveCase] = useState<BenchmarkCaseSummary | null>(null);
  const [activeFile, setActiveFile] = useState<
    { kind: CaseFileKind; path: string } | null
  >(null);

  const scopeKey = `${projectId}::${agentId}`;
  const benchmarkId = benchmark?.id ?? null;
  const caseId = activeCase?.id ?? null;
  const caseKey = benchmarkId && caseId ? `${scopeKey}::${benchmarkId}::${caseId}` : null;

  const benchmarksRes = useResource(scopeKey, () =>
    listBenchmarks(projectId, agentId),
  );
  const casesRes = useResource(
    benchmarkId && `${scopeKey}::${benchmarkId}`,
    () => listBenchmarkCases(projectId, agentId, benchmarkId ?? ""),
  );
  const statementRes = useResource(caseKey && `${caseKey}::statement`, () =>
    listCaseFiles(projectId, agentId, benchmarkId ?? "", caseId ?? "", "statement"),
  );
  const rubricRes = useResource(caseKey && `${caseKey}::rubric`, () =>
    listCaseFiles(projectId, agentId, benchmarkId ?? "", caseId ?? "", "rubric"),
  );
  const contentRes = useResource(
    caseKey && activeFile ? `${caseKey}::${activeFile.kind}::${activeFile.path}` : null,
    () =>
      readCaseFile(
        projectId,
        agentId,
        benchmarkId ?? "",
        caseId ?? "",
        activeFile?.kind ?? "statement",
        activeFile?.path ?? "",
      ),
  );

  const backToBenchmarks = () => {
    setBenchmark(null);
    setActiveCase(null);
    setActiveFile(null);
  };
  const backToCases = () => {
    setActiveCase(null);
    setActiveFile(null);
  };
  const openBenchmark = (b: BenchmarkSummary) => {
    setBenchmark(b);
    setActiveCase(null);
    setActiveFile(null);
  };
  const openCase = (c: BenchmarkCaseSummary) => {
    setActiveCase(c);
    setActiveFile(null);
  };

  /* ---- level 1 ---- */
  if (!benchmark) {
    const count =
      benchmarksRes.status === "ready" ? benchmarksRes.data.benchmarks.length : null;
    return (
      <section className="animate-section-in">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeading active>Benchmark 列表</SectionHeading>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
            {count === null ? "—" : `${count} BENCHMARKS`}
          </span>
        </div>
        <ListPanel>
          <ResourceView
            resource={benchmarksRes}
            isEmpty={(d) => d.benchmarks.length === 0}
            idleLabel="等待 Agent 就绪"
            emptyLabel="暂无 Benchmark · 由 benchmark_builder 技能在磁盘上生成"
          >
            {(data) => (
              <ul className="stagger-menu divide-y divide-border/40">
                {data.benchmarks.map((b) => (
                  <BenchmarkRow
                    key={b.id}
                    benchmark={b}
                    onOpen={() => openBenchmark(b)}
                  />
                ))}
              </ul>
            )}
          </ResourceView>
        </ListPanel>
      </section>
    );
  }

  /* ---- level 2 ---- */
  if (!activeCase) {
    const latest = latestEvaluation(benchmark);
    return (
      <section className="animate-section-in">
        <Breadcrumb
          items={[
            { label: "Benchmark 列表", onClick: backToBenchmarks },
            { label: benchmark.title },
          ]}
        />

        <SectionHeading
          active
          className="mb-3"
          action={
            <Button variant="ghost" size="sm" onClick={backToBenchmarks}>
              返回
            </Button>
          }
        >
          {benchmark.title}
        </SectionHeading>

        {benchmark.description && (
          <p className="mb-3 max-w-[70ch] text-[13px] leading-5 text-muted-foreground">
            {benchmark.description}
          </p>
        )}

        <div className="stagger-chip mb-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            className="animate-section-in"
            label="最新分数"
            value={latest ? formatScore(latest.score) : null}
            trend={latest ? `v${latest.version} · ${formatTime(latest.time)}` : undefined}
            emphasis
          />
          <StatCard
            className="animate-section-in"
            label="平均成本"
            value={latest ? formatCost(latest.cost) : null}
          />
          <StatCard
            className="animate-section-in"
            label="平均耗时"
            value={latest ? formatDuration(latest.durationMs) : null}
          />
          <StatCard
            className="animate-section-in"
            label="用例数"
            value={benchmark.caseCount}
            trend={`${benchmark.evaluations.length} 轮评测`}
          />
        </div>

        {latest?.summaryTitle && (
          <Card surface="raised" className="mb-6 px-4 py-3 shadow-sm">
            <p className="text-[12px] font-medium text-foreground/90">
              {latest.summaryTitle}
            </p>
            {latest.summary && (
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-muted-foreground">
                {latest.summary}
              </p>
            )}
            <p className="mt-2 font-mono text-[10px] text-muted-foreground/75">
              {latest.provider} / {latest.modelId} · thinking={latest.thinkingLevel}
            </p>
          </Card>
        )}

        <div className="mb-2 flex items-center justify-between">
          <SectionHeading>用例列表</SectionHeading>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
            {casesRes.status === "ready" ? `${casesRes.data.cases.length} CASES` : "—"}
          </span>
        </div>
        <ListPanel>
          <ResourceView
            resource={casesRes}
            isEmpty={(d) => d.cases.length === 0}
            idleLabel="选择 Benchmark 后加载"
            emptyLabel="该 Benchmark 暂无用例"
          >
            {(data) => (
              <ul className="stagger-menu divide-y divide-border/40">
                {data.cases.map((c) => (
                  <CaseRow key={c.id} item={c} onOpen={() => openCase(c)} />
                ))}
              </ul>
            )}
          </ResourceView>
        </ListPanel>
      </section>
    );
  }

  /* ---- level 3 ---- */
  return (
    <section className="animate-section-in">
      <Breadcrumb
        items={[
          { label: "Benchmark 列表", onClick: backToBenchmarks },
          { label: benchmark.title, onClick: backToCases },
          { label: activeCase.title },
        ]}
      />

      <SectionHeading
        active
        className="mb-4"
        action={
          <Button variant="ghost" size="sm" onClick={backToCases}>
            返回用例列表
          </Button>
        }
      >
        {activeCase.title}
      </SectionHeading>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,248px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <FileTree
            kind="statement"
            resource={statementRes}
            activePath={activeFile?.kind === "statement" ? activeFile.path : null}
            onSelect={(entry) =>
              setActiveFile({ kind: "statement", path: entry.name })
            }
          />
          <FileTree
            kind="rubric"
            resource={rubricRes}
            activePath={activeFile?.kind === "rubric" ? activeFile.path : null}
            onSelect={(entry) => setActiveFile({ kind: "rubric", path: entry.name })}
          />
        </div>

        <section className="min-w-0">
          <SectionHeading
            className="mb-2"
            action={
              contentRes.status === "ready" && contentRes.data.truncated ? (
                <StatusBadge status="blocked">已截断</StatusBadge>
              ) : undefined
            }
          >
            文件内容
          </SectionHeading>

          {activeFile && (
            <p className="mb-2 truncate font-mono text-[11px] text-muted-foreground">
              {KIND_LABEL[activeFile.kind]} / {activeFile.path}
            </p>
          )}

          {contentRes.status === "ready" && contentRes.data.truncated && (
            <p className="mb-2 text-[12px] leading-5 text-muted-foreground">
              文件较大，服务端已截断，下面只显示前一部分内容。
            </p>
          )}

          <Card
            surface="canvas"
            className="max-h-[560px] min-h-[180px] overflow-auto p-3 shadow-sm"
          >
            <ResourceView
              resource={contentRes}
              isEmpty={(d) => d.text.length === 0}
              idleLabel="从左侧选择一个文件查看内容"
              emptyLabel="文件为空"
            >
              {(data) => (
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-foreground/90">
                  {data.text}
                </pre>
              )}
            </ResourceView>
          </Card>
        </section>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 页面 */

/**
 * Benchmarks — read-only three-level browser (benchmark list → cases → file content).
 * Everything here is GET-only: the content is produced by the benchmark_builder skill
 * on disk, so the page offers no create / edit / delete affordance anywhere.
 */
export default function BenchmarksPage() {
  const { ready, error, projectId, agentId } = useChat();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-4">
      <header className="animate-section-in mb-5">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
          Benchmarks
        </h1>
        <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
          只读浏览当前 Agent 的评测集、用例与题面 / 评分标准文件
        </p>
        {projectId && agentId && (
          <p className="mt-0.5 font-mono text-[11px] leading-5 text-muted-foreground">
            {projectId} / {agentId}
          </p>
        )}
      </header>

      {error && (
        <Notice tone="error">Agent 会话不可用 · {error}</Notice>
      )}
      {!error && !ready && <Notice>加载中…</Notice>}
      {!error && ready && (!projectId || !agentId) && (
        <Notice>未选择项目或 Agent，无法读取 Benchmark</Notice>
      )}
      {!error && ready && projectId && agentId && (
        <BenchmarksBrowser projectId={projectId} agentId={agentId} />
      )}
    </div>
  );
}
