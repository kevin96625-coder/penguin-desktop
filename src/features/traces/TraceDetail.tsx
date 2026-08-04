import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import {
  downloadTraceFile,
  readTraceAnalysis,
  readTraceEvents,
  traceFileName,
} from "../../api/endpoints/traces";
import type { TraceAnalysisResponse, TraceEventsResponse } from "../../api/types";
import { Button } from "../../design-system/components";
import { buildModel } from "../chat/stream-model";
import ChatMessage from "../workspace/ChatMessage";
import { formatBytes, formatCount, formatDuration } from "./format";

/** One page of trace lines. The server caps `limit` at 1000; 500 keeps a page cheap to render. */
const PAGE_SIZE = 500;

export interface TraceDetailProps {
  projectId: string;
  agentId: string;
  sessionId: string;
  index: number;
  sizeBytes: number;
}

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** Sum the per-task token ledger; `tasks` is the only place totals are exposed. */
function totalTokens(analysis: TraceAnalysisResponse): number {
  return analysis.tasks.reduce(
    (n, t) => n + t.tokens.cacheRead + t.tokens.cacheWrite + t.tokens.output,
    0,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/75">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-[12px] tabular-nums text-foreground/90">
        {value}
      </p>
    </div>
  );
}

/**
 * One Trace file: its OmniMessage records rendered through the chat pipeline, plus the
 * lazily-fetched analysis header and a .jsonl download. Mounted with a key per file, so
 * switching files resets paging and fetch state for free.
 *
 * Read-only by construction — the events are folded with the same `buildModel` the live chat
 * uses, and drawn with the same `ChatMessage`, so a replayed trace looks exactly like the
 * conversation it recorded instead of being a second, drifting renderer.
 */
export default function TraceDetail({
  projectId,
  agentId,
  sessionId,
  index,
  sizeBytes,
}: TraceDetailProps) {
  const [offset, setOffset] = useState(0);
  const [events, setEvents] = useState<TraceEventsResponse | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TraceAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setEventsError(null);
    readTraceEvents(projectId, agentId, sessionId, index, offset, PAGE_SIZE)
      .then((res) => {
        if (!cancelled) setEvents(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setEventsError(message(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, sessionId, index, offset]);

  // Analysis is per-file and not on the list response, so it is fetched only once a file is
  // actually opened. A failure here is non-fatal: the records still render.
  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setAnalysisError(null);
    readTraceAnalysis(projectId, agentId, sessionId, index)
      .then((res) => {
        if (!cancelled) setAnalysis(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setAnalysisError(message(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId, sessionId, index]);

  const blocks = useMemo(
    () => (events ? buildModel(events.events).blocks : []),
    [events],
  );

  const onDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { text } = await downloadTraceFile(projectId, agentId, sessionId, index);
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/x-ndjson" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = traceFileName(sessionId, index);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(message(err));
    } finally {
      setDownloading(false);
    }
  };

  const total = events?.total ?? 0;
  const shown = events?.events.length ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + shown < total;

  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[12px] font-medium text-foreground/90">
            {traceFileName(sessionId, index)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {formatBytes(sizeBytes)}
            {events !== null && ` · ${formatCount(total)} 条记录`}
            {" · 只读"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
          {downloading ? "下载中…" : "下载 .jsonl"}
        </Button>
      </header>

      {downloadError && (
        <p className="border-b border-border/40 px-4 py-2 text-[11px] text-[hsl(var(--chat-error))]">
          下载失败：{downloadError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border/40 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
        {analysis === null && !analysisError && (
          <p className="col-span-full text-[11px] text-muted-foreground">
            分析加载中…
          </p>
        )}
        {analysisError && (
          <p className="col-span-full text-[11px] text-muted-foreground">
            分析不可用：{analysisError}
          </p>
        )}
        {analysis && (
          <>
            <Stat label="耗时" value={formatDuration(analysis.elapsedMs)} />
            <Stat label="轮次" value={formatCount(analysis.tasks.length)} />
            <Stat label="请求" value={formatCount(analysis.requests.length)} />
            <Stat label="工具调用" value={formatCount(analysis.toolCalls.length)} />
            <Stat label="压缩 / 重连" value={`${analysis.compactionCount} / ${analysis.reconnectCount}`} />
            <Stat label="Token" value={formatCount(totalTokens(analysis))} />
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {eventsError && (
          <p className="py-10 text-center text-xs text-[hsl(var(--chat-error))]">
            {eventsError}
          </p>
        )}
        {!eventsError && events === null && (
          <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
        )}
        {!eventsError && events !== null && total === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            该 Trace 文件没有记录
          </p>
        )}
        {!eventsError && events !== null && total > 0 && blocks.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            本页记录没有可渲染的对话内容（多为协议事件）
          </p>
        )}
        {!eventsError &&
          events !== null &&
          blocks.map((block) => <ChatMessage key={block.id} block={block} />)}
      </div>

      {events !== null && total > PAGE_SIZE && (
        <footer className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-2">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatCount(offset + 1)}–{formatCount(offset + shown)} / {formatCount(total)}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              下一页
            </Button>
          </span>
        </footer>
      )}
    </section>
  );
}
