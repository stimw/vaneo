import { useMutation } from "@tanstack/react-query";
import { exportCompletedTasks } from "@/fetchers/task/export-completed-tasks";

export function useExportCompletedTasks() {
  return useMutation({
    mutationFn: ({
      projectId,
      ...period
    }: {
      projectId: string;
      from: string;
      to: string;
      timeZone: string;
    }) => exportCompletedTasks(projectId, period),
  });
}
