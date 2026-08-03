import {
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
    <div className="mx-auto w-full max-w-4xl px-6 pb-12 pt-4">
      <header className="animate-section-in mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent 构建工作台 · 评测与运行数据将在阶段 4 接入
        </p>
      </header>

      <section className="animate-section-in mb-8">
        <SectionHeading active className="mb-3">
          评测概览
        </SectionHeading>
        <div className="stagger-chip grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard className="animate-section-in" label="综合分" value={null} />
          <StatCard className="animate-section-in" label="本轮提升" value={null} />
          <StatCard className="animate-section-in" label="总成本" value={null} />
          <StatCard className="animate-section-in" label="版本" value={null} />
        </div>
      </section>

      <section className="animate-section-in mb-8" style={{ animationDelay: "60ms" }}>
        <SectionHeading className="mb-3">评分趋势</SectionHeading>
        <TrendChart points={[]} height={180} emptyLabel="运行首次评测后展示趋势" />
      </section>

      <section className="animate-section-in" style={{ animationDelay: "120ms" }}>
        <SectionHeading className="mb-3">运行状态语义</SectionHeading>
        <div className="stagger-menu flex flex-wrap items-center gap-2">
          <StatusBadge status="queued">Queued</StatusBadge>
          <StatusBadge status="running">Running</StatusBadge>
          <StatusBadge status="blocked">Blocked</StatusBadge>
          <StatusBadge status="complete">Complete</StatusBadge>
          <StatusBadge status="failed">Failed</StatusBadge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          节点状态将沿 queued → running → blocked / complete / failed 过渡（§7.6）。
        </p>
      </section>
    </div>
  );
}
