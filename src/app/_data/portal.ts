// Server-side data for the portal home: the cross-department task inbox and
// the inventory availability counts. Both are optional surfaces — a null
// return renders the portal's empty/quiet state, never fabricated rows.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "../_departments/config";

export interface InboxTask {
  id: string;
  from_department: string;
  to_department: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
}

export async function loadInboxTasks(limit = 6): Promise<InboxTask[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("department_tasks")
    .select("id,from_department,to_department,title,priority,status,created_at")
    .eq("organization_id", ORG_ID)
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? null : (data as InboxTask[]);
}

export async function loadUnitCounts(): Promise<Record<string, number> | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("units").select("status").eq("organization_id", ORG_ID);
  if (error || !data) return null;
  const by: Record<string, number> = {};
  for (const r of data as { status: string }[]) by[r.status] = (by[r.status] ?? 0) + 1;
  return by;
}
