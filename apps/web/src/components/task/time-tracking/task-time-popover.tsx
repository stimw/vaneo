import { Clock3 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { useTaskTime } from "@/hooks/queries/time-entry/use-task-time";
import { PropertyValue } from "../properties/property-value";
import { WorklogPanel } from "./worklog-panel";
import { formatTrackedTime } from "./time-values";

export function TaskTimePopover({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const query = useTaskTime(taskId);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={query.isPending}
        render={
          <PropertyValue
            className={className}
            aria-label={t("tasks:time.label")}
          />
        }
      >
        <Clock3 className="text-muted-foreground" />
        <span className="truncate tabular-nums">
          {query.isPending
            ? t("common:empty.loading")
            : query.isError
              ? t("tasks:time.loadError")
              : formatTrackedTime(query.data.totalSeconds)}
        </span>
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        className="w-80 p-3"
        aria-label={t("tasks:time.label")}
      >
        {query.isError ? (
          <>
            <p role="alert" className="text-xs text-destructive-foreground">
              {t("tasks:time.loadError")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => query.refetch()}
            >
              {t("tasks:time.retry")}
            </Button>
          </>
        ) : query.data ? (
          <WorklogPanel
            taskId={taskId}
            totalSeconds={query.data.totalSeconds}
          />
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}
