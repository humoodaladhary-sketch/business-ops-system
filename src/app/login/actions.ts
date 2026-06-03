"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGENTS } from "../_data/dataset";
import { DEMO_COOKIE, isSupabaseConfigured, supabaseServer, type Session } from "@/infrastructure/auth/session";

/** Demo sign-in (preview only): pick CEO/admin or an agent identity. */
export async function signInDemo(formData: FormData) {
  const who = String(formData.get("who") ?? "");
  let session: Session;
  if (who === "ceo") {
    session = { userId: "ceo", email: "ceo@alwalaaoman.com", name: "CEO / Admin", role: "ADMIN", agentId: null };
  } else {
    const a = AGENTS.find((x) => x.id === who);
    if (!a) redirect("/login");
    session = { userId: a!.id, email: `${a!.id}@alwalaaoman.com`, name: a!.name, role: "AGENT", agentId: a!.id };
  }
  cookies().set(DEMO_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    try {
      await supabaseServer().auth.signOut();
    } catch {
      /* ignore */
    }
  }
  cookies().delete(DEMO_COOKIE);
  redirect("/login");
}
