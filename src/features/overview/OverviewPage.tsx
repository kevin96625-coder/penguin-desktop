import {
  Card,
  SectionHeading,
  StatCard,
  StatusBadge,
  TrendChart,
} from "../../design-system/components";

/*
 * Overview — dashboard placeholder (stage 3).
 * Doubles as the design system's living showroom for visual review:
 * StatCard ×4 (all empty), TrendChart empty state, the five StatusBadge
 * states, and SectionHeading anchors. Real data lands in stage 4.
 */
export default function OverviewPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-12 pt-4">
      <header className="animate-section-in mb-7">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
          Overview
        </h1>
        <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
          当前 Agent 的评测、成本与运行状态将在阶段 4 接入
        </p>
      </header>

      <section className="animate-section-in mb-7">
        <SectionHeading active className="mb-3">
          评测概览
        </SectionHeading>
        <div className="stagger-chip grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            className="animate-section-in"
            label="综合分"
            value={null}
            emphasis
          />
          <StatCard className="animate-section-in" label="本轮提升" value={null} />
          <StatCard className="animate-section-in" label="总成本" value={null} />
          <StatCard className="animate-section-in" label="版本" value={null} />
        </div>
      </section>

      <section className="animate-section-in mb-7" style={{ animationDelay: "60ms" }}>
        <SectionHeading className="mb-3">评分趋势</SectionHeading>
        <TrendChart points={[]} height={164} emptyLabel="运行首次评测后展示趋势" />
      </section>

      <section className="animate-section-in" style={{ animationDelay: "120ms" }}>
        <SectionHeading className="mb-3">运行状态语义</SectionHeading>
        <Card surface="panel" className="px-4 py-3 shadow-sm">
          <div className="stagger-menu flex flex-wrap items-center gap-1.5">
            <StatusBadge status="queued">Queued</StatusBadge>
            <span className="text-xs text-muted-foreground/55">→</span>
            <StatusBadge status="running">Running</StatusBadge>
            <span className="text-xs text-muted-foreground/55">→</span>
            <StatusBadge status="blocked">Blocked</StatusBadge>
            <span className="text-xs text-muted-foreground/55">/</span>
            <StatusBadge status="complete">Complete</StatusBadge>
            <span className="text-xs text-muted-foreground/55">/</span>
            <StatusBadge status="failed">Failed</StatusBadge>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            节点状态在固定位置完成颜色与图标过渡；阻塞、完成和失败会保留清晰的语义分叉。
          </p>
        </Card>
      </section>
    </div>
  );
}
