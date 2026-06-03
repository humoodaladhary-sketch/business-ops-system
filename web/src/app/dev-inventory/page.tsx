import { DevInventoryApp } from "@/components/dev-inventory/DevInventoryApp";

export const metadata = {
  title: "Developer Inventory — Alwalaa",
};

export default function DevInventoryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Developer Inventory</h1>
        <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
          Paste messy developer inventory (WhatsApp, Excel, PDF tables) → normalize → analyze → generate listings.
        </p>
      </header>
      <DevInventoryApp />
    </div>
  );
}
