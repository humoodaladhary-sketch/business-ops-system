import { DEFAULT_SETTINGS, type SettingsKey } from "@/domain/crm/settings";
import { hasDatabase, prisma } from "./client";

/** Read editable config; falls back to the safe default when unset/DB-less. */
export async function getSetting<K extends SettingsKey>(key: K): Promise<(typeof DEFAULT_SETTINGS)[K]> {
  if (!hasDatabase) return DEFAULT_SETTINGS[key];
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as (typeof DEFAULT_SETTINGS)[K]) ?? DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends SettingsKey>(
  key: K,
  value: (typeof DEFAULT_SETTINGS)[K],
  updatedBy?: string,
): Promise<void> {
  if (!hasDatabase) return;
  await prisma.setting.upsert({
    where: { key },
    update: { value: value as never, updatedBy },
    create: { key, value: value as never, updatedBy },
  });
}
