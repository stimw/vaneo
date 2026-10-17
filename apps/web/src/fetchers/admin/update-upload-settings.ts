import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function updateUploadSettings(maxUploadBytes: number) {
  const response = await client.admin["upload-settings"].$put({
    json: { maxUploadBytes },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
