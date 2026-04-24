import Link from "next/link";

export default function DashboardPage() {
  const stats = [
    { label: "Projects", value: "—" },
    { label: "Units", value: "—" },
    { label: "Listings", value: "—" },
    { label: "Reports", value: "—" },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight">
            Alwalaa Listing Intelligence
          </h1>
          <p className="text-[var(--color-brand-gray-500)] mt-2 max-w-2xl">
            Upload an Oman project pack — inventory, brochure, renders, payment plan —
            and get publication-ready listings, investor reports, and WhatsApp pitches
            in under five minutes.
          </p>
        </div>
        <Link href="/upload" className="btn-gold">+ New Project</Link>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-6">
            <div className="text-4xl font-display">{s.value}</div>
            <div className="text-sm text-[var(--color-brand-gray-500)] mt-1 uppercase tracking-wider">
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard
          title="Upload a project"
          body="Drop Excel, brochures, renders. The AI extracts every unit automatically."
          href="/upload"
        />
        <ActionCard
          title="Browse inventory"
          body="Filter by ITC status, yield, price. Generate listings in one click."
          href="/inventory"
        />
        <ActionCard
          title="Investor reports"
          body="Comparison reports, WhatsApp pitches, branded PDF exports."
          href="/reports"
        />
      </section>

      <section className="card p-6">
        <h2 className="font-display text-2xl mb-4">Getting started</h2>
        <ol className="space-y-2 text-sm text-[var(--color-brand-gray-700)] list-decimal pl-5">
          <li>Go to <Link href="/upload" className="gold-underline">Upload</Link> and drop your project files.</li>
          <li>The AI extracts every unit with source-tagged fields (extracted / inferred / assumed / missing).</li>
          <li>Open any unit → click <em>Generate all listings</em> → copy into Property Finder, OLX, Instagram, WhatsApp, LinkedIn, or your website.</li>
          <li>For a client brief, use <Link href="/reports" className="gold-underline">Reports → New Comparison</Link> and get a branded PDF + ready-to-send pitch.</li>
        </ol>
      </section>
    </div>
  );
}

function ActionCard({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="card p-6 hover:border-[var(--color-brand-black)] transition block">
      <div className="font-display text-xl mb-2">{title}</div>
      <div className="text-sm text-[var(--color-brand-gray-500)]">{body}</div>
      <div className="mt-4 text-sm text-[var(--color-brand-gold)] font-medium uppercase tracking-wider">
        Open →
      </div>
    </Link>
  );
}
