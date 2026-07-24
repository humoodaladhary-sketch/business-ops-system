import { requireSession } from "@/infrastructure/auth/session";
import { InventoryClient } from "./InventoryClient";

export const metadata = { title: "Inventory · Alwalaa OS" };

export default async function InventoryPage() {
  const session = await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl text-white">Inventory</h1>
        <p className="mt-1 text-white/50">Off-plan &amp; secondary units — the stock your leads get matched against.</p>
      </div>
      <InventoryClient isAdmin={session.role === "ADMIN"} />
    </div>
  );
}
