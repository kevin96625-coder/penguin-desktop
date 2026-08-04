import { ClockIcon, FlaskIcon } from "../../design-system/icons";

interface WorkspaceEmptyPageProps {
  kind: "evaluations" | "runs";
}

export default function WorkspaceEmptyPage({ kind }: WorkspaceEmptyPageProps) {
  const evaluations = kind === "evaluations";
  const Icon = evaluations ? FlaskIcon : ClockIcon;
  const title = evaluations ? "Evaluations" : "Runs";
  return (
    <div className="flex h-full items-center justify-center px-8 pb-20">
      <div className="animate-section-in max-w-sm text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-surface-raised text-muted-foreground shadow-rim">
          <Icon className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          {evaluations ? "评测入口已经纳入工作区导航；真实数据将在下一轮 API 接入。" : "运行记录入口已经就位；真实任务状态将在下一轮 API 接入。"}
        </p>
      </div>
    </div>
  );
}
