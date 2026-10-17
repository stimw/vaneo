import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getWorklogs(
  taskId: string,
  page: number,
  signal?: AbortSignal,
) {
  const response = await client["time-entry"].task[":taskId"].logs.$get(
    { param: { taskId }, query: { page: String(page), limit: "5" } },
    { init: { signal } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function saveWorklog(
  taskId: string,
  values: { id?: string; workDate: string; duration: number },
) {
  const response = values.id
    ? await client["time-entry"].task[":taskId"].logs[":id"].$put({
        param: { taskId, id: values.id },
        json: { workDate: values.workDate, duration: values.duration },
      })
    : await client["time-entry"].task[":taskId"].logs.$post({
        param: { taskId },
        json: { workDate: values.workDate, duration: values.duration },
      });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteWorklog(taskId: string, id: string) {
  const response = await client["time-entry"].task[":taskId"].logs[
    ":id"
  ].$delete({ param: { taskId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
