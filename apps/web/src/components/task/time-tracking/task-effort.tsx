import { useTranslation } from "react-i18next";
import CircularProgress from "@/components/ui/circular-progress";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatTrackedTime } from "./time-values";

export function TaskEffort({
  progress,
  trackedSeconds = 0,
  completed = false,
  className,
}: {
  progress?: number | null;
  trackedSeconds?: number;
  completed?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const percentage = completed ? 100 : progress;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-[11px] text-muted-foreground tabular-nums",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex items-center gap-1.5" />}
        >
          <CircularProgress completed={percentage ?? 0} total={100} size={14} />
          <span>{percentage == null ? "—" : `${percentage}%`}</span>
        </TooltipTrigger>
        <TooltipPopup>
          {percentage == null
            ? t("tasks:planning.progressUnset")
            : t("tasks:planning.completion", { percent: percentage })}
        </TooltipPopup>
      </Tooltip>
      {trackedSeconds > 0 && (
        <Tooltip>
          <TooltipTrigger render={<span className="truncate" />}>
            {formatTrackedTime(trackedSeconds)}
          </TooltipTrigger>
          <TooltipPopup>{t("tasks:time.label")}</TooltipPopup>
        </Tooltip>
      )}
    </div>
  );
}
