import { useQuery } from "@tanstack/react-query";
import getTaskTime from "@/fetchers/time-entry/get-task-time";
export function useTaskTime(taskId: string) {
  return useQuery({
    queryKey: ["time-entries", taskId, "total"],
    queryFn: () => getTaskTime(taskId),
    enabled: Boolean(taskId),
  });
}
