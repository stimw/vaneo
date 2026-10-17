import { eq } from "drizzle-orm";
import db from "../database";
import { instanceSettingsTable } from "../database/schema";
import { getDefaultMaxUploadBytes } from "../storage/s3";

export async function getMaxUploadBytes() {
  const settings = await db.query.instanceSettingsTable.findFirst({
    where: eq(instanceSettingsTable.id, "uploads"),
  });
  return settings?.maxUploadBytes ?? getDefaultMaxUploadBytes();
}

export async function updateUploadSettings(maxUploadBytes: number) {
  const [settings] = await db
    .insert(instanceSettingsTable)
    .values({ id: "uploads", maxUploadBytes })
    .onConflictDoUpdate({
      target: instanceSettingsTable.id,
      set: { maxUploadBytes, updatedAt: new Date() },
    })
    .returning({ maxUploadBytes: instanceSettingsTable.maxUploadBytes });
  return settings;
}
