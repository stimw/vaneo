import { useInfiniteQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getWorklogs } from "@/fetchers/time-entry/worklogs";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatTrackedTime } from "./time-values";
import { WorklogForm } from "./worklog-form";

export function WorklogPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { canCreateTimeEntries, canUpdateTimeEntries } =
    useWorkspacePermission();
  const [editing, setEditing] = useState<{
    id: string;
    workDate: string;
    duration: number;
  }>();
  const query = useInfiniteQuery({
    queryKey: ["time-entries", taskId, "logs"],
    queryFn: ({ pageParam, signal }) => getWorklogs(taskId, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (page) => page.nextPage ?? undefined,
  });
  const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];
  const balance = query.data?.pages[0]?.unallocatedSeconds ?? 0;
  return (
    <div className="space-y-3">
      {canCreateTimeEntries() || editing ? (
        <WorklogForm
          key={editing?.id ?? "new"}
          taskId={taskId}
          entry={editing}
          onSaved={() => setEditing(undefined)}
          onCancel={editing ? () => setEditing(undefined) : undefined}
        />
      ) : null}
      {query.isPending ? (
        <p className="text-xs text-muted-foreground">
          {t("common:empty.loading")}
        </p>
      ) : query.isError ? (
        <div role="alert" className="text-xs">
          <p>{t("tasks:time.loadError")}</p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => query.refetch()}
          >
            {t("tasks:time.retry")}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-1 border-t pt-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex min-h-8 items-center gap-2 text-xs"
              >
                <span className="flex-1 text-muted-foreground">
                  {format(parseISO(entry.workDate), "MMM d, yyyy")}
                </span>
                <span className="font-medium tabular-nums">
                  {formatTrackedTime(entry.duration)}
                </span>
                {canUpdateTimeEntries() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("tasks:worklog.edit", {
                      date: format(parseISO(entry.workDate), "MMM d, yyyy"),
                    })}
                    onClick={() => {
                      setEditing(entry);
                    }}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            ))}
            {!entries.length && (
              <p className="py-1 text-xs text-muted-foreground">
                {t("tasks:worklog.empty")}
              </p>
            )}
            {query.hasNextPage && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="w-full"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {t("tasks:worklog.more")}
              </Button>
            )}
            {balance !== 0 && (
              <div className="flex items-center justify-between gap-2 py-1 text-[11px] text-muted-foreground">
                <span>{t("tasks:worklog.undated")}</span>
                <span className="tabular-nums">
                  {balance < 0 ? "−" : ""}
                  {formatTrackedTime(Math.abs(balance))}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
