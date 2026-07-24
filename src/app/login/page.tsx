import { redirect } from "next/navigation";

// Login is disabled in owner-only mode — anyone hitting /login goes straight in.
export default function LoginPage() {
  redirect("/");
}
