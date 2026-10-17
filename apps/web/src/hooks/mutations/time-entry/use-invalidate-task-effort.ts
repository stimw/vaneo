import type Task from "@/types/task";
import { useQueryClient } from "@tanstack/react-query";

export function useInvalidateTaskEffort(taskId: string) {
  const queryClient = useQueryClient();
  return () => {
    const projectId = queryClient.getQueryData<Task>([
      "task",
      taskId,
    ])?.projectId;
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["time-entries", taskId] }),
      queryClient.invalidateQueries({
        queryKey: projectId ? ["tasks", projectId] : ["tasks"],
      }),
      queryClient.invalidateQueries({
        queryKey: projectId
          ? ["completed-reports", projectId]
          : ["completed-reports"],
      }),
    ]);
  };
}
