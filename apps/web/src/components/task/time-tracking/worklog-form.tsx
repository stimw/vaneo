import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { deleteWorklog, saveWorklog } from "@/fetchers/time-entry/worklogs";
import { useInvalidateTaskEffort } from "@/hooks/mutations/time-entry/use-invalidate-task-effort";
import { hoursToSeconds } from "./time-values";

export function WorklogForm({
  taskId,
  entry,
  onSaved,
  onCancel,
}: {
  taskId: string;
  entry?: { id: string; workDate: string; duration: number };
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [workDate, setWorkDate] = useState(
    entry?.workDate ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [hours, setHours] = useState(
    entry ? String(Number((entry.duration / 3600).toFixed(4))) : "",
  );
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const invalidate = useInvalidateTaskEffort(taskId);
  const save = useMutation({
    mutationFn: (duration: number) =>
      saveWorklog(taskId, { id: entry?.id, workDate, duration }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => deleteWorklog(taskId, entry!.id),
    onSuccess: invalidate,
  });
  const busy = save.isPending || remove.isPending;
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const duration = hoursToSeconds(hours);
        if (
          duration === null ||
          duration < 900 ||
          !Number.isInteger(Number(hours) * 4) ||
          !workDate
        ) {
          setError(t("tasks:worklog.invalid"));
          return;
        }
        try {
          setError("");
          await save.mutateAsync(duration);
          setHours("");
          onSaved();
        } catch {
          setError(t("tasks:time.saveError"));
        }
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <div className="space-y-1.5">
          <label
            id={`${id}-date-label`}
            htmlFor={`${id}-date`}
            className="text-xs text-muted-foreground"
          >
            {t("tasks:worklog.date")}
          </label>
          <DatePicker
            id={`${id}-date`}
            labelledBy={`${id}-date-label`}
            value={workDate}
            onValueChange={setWorkDate}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${id}-hours`}
            className="text-xs text-muted-foreground"
          >
            {t("tasks:time.hours")}
          </label>
          <InputGroup>
            <InputGroupInput
              id={`${id}-hours`}
              type="number"
              min="0.25"
              step="0.25"
              placeholder="0.25"
              required
              autoFocus
              value={hours}
              disabled={busy}
              aria-invalid={Boolean(error)}
              onChange={(event) => setHours(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>h</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={busy}>
          {entry ? t("tasks:worklog.save") : t("tasks:worklog.log")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {t("common:actions.cancel")}
          </Button>
        )}
        {entry && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            aria-label={t("tasks:worklog.delete")}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {confirmDelete && (
        <div className="space-y-2 rounded-md border p-2 text-xs">
          <p>{t("tasks:worklog.confirmDelete")}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="xs"
              disabled={busy}
              onClick={async () => {
                try {
                  setError("");
                  await remove.mutateAsync();
                  onSaved();
                } catch {
                  setError(t("tasks:time.saveError"));
                }
              }}
            >
              {t("tasks:worklog.delete")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              {t("common:actions.cancel")}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive-foreground">
          {error}
        </p>
      )}
    </form>
  );
}
