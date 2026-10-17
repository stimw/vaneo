import { useMutation } from "@tanstack/react-query";
import { Check, Timer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import CircularProgress from "@/components/ui/circular-progress";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { updateTaskPlanning } from "@/fetchers/task/update-task-planning";
import { useInvalidateTaskEffort } from "@/hooks/mutations/time-entry/use-invalidate-task-effort";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type Task from "@/types/task";
import { PropertyValue } from "../properties/property-value";
import { formatTrackedTime, hoursToSeconds } from "./time-values";

export function TaskPlanningPopover({
  task,
  kind,
  completed,
  className,
}: {
  task: Task;
  kind: "estimate" | "progress";
  completed: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { canUpdateTimeEntries } = useWorkspacePermission();
  const invalidate = useInvalidateTaskEffort(task.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const estimate = kind === "estimate";
  const percentage = completed ? 100 : task.progress;
  const label = estimate
    ? t("tasks:planning.estimate")
    : t("tasks:planning.progress");
  const save = useMutation({
    mutationFn: (amount: number | null) =>
      updateTaskPlanning(
        task.id,
        estimate ? { estimatedSeconds: amount } : { progress: amount },
      ),
    onSuccess: invalidate,
  });
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
        if (next)
          setValue(
            estimate
              ? task.estimatedSeconds
                ? String(Number((task.estimatedSeconds / 3600).toFixed(4)))
                : ""
              : task.progress == null
                ? ""
                : String(task.progress),
          );
      }}
    >
      <PopoverTrigger
        disabled={!canUpdateTimeEntries() || (!estimate && completed)}
        render={<PropertyValue className={className} aria-label={label} />}
      >
        {estimate ? (
          <Timer className="text-muted-foreground" />
        ) : (
          <CircularProgress completed={percentage ?? 0} total={100} size={14} />
        )}
        <span className="truncate tabular-nums">
          {estimate
            ? task.estimatedSeconds
              ? formatTrackedTime(task.estimatedSeconds)
              : t("tasks:planning.unset")
            : percentage == null
              ? t("tasks:planning.unset")
              : `${percentage}%`}
        </span>
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-64 p-3" aria-label={label}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (save.isPending) return;
            const amount = !value.trim()
              ? null
              : estimate
                ? hoursToSeconds(value)
                : Number(value);
            if (
              value.trim() &&
              (amount === null ||
                (estimate
                  ? amount <= 0
                  : !Number.isInteger(amount) || amount < 0 || amount > 100))
            ) {
              setError(t("tasks:planning.invalid"));
              return;
            }
            try {
              setError("");
              await save.mutateAsync(amount);
              setOpen(false);
            } catch {
              setError(t("tasks:time.saveError"));
            }
          }}
        >
          <div className="flex items-center gap-1.5">
            <InputGroup>
              <InputGroupInput
                type="number"
                min={estimate ? 0.01 : 0}
                max={estimate ? undefined : 100}
                step={estimate ? "any" : 1}
                autoFocus
                value={value}
                placeholder={t("tasks:planning.unset")}
                aria-label={label}
                aria-invalid={Boolean(error)}
                disabled={save.isPending}
                onChange={(event) => setValue(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{estimate ? "h" : "%"}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              disabled={save.isPending}
              aria-label={t("tasks:planning.save")}
            >
              <Check />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {estimate
              ? t("tasks:planning.estimateHint")
              : t("tasks:planning.progressHint")}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-2 text-xs text-destructive-foreground"
            >
              {error}
            </p>
          )}
        </form>
      </PopoverPopup>
    </Popover>
  );
}
