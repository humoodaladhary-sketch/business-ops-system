import Link from "next/link";
import { ArrowUpRight, Newspaper } from "lucide-react";
import { loadNews } from "../_data/news";

// The feed refreshes via the fetch cache (~30 min); render at request time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Market News · Alwalaa OS" };

export default async function NewsPage() {
  const news = await loadNews(24);

  return (
    <div className="rounded-3xl bg-cream p-4 text-[#151311] shadow-2xl sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9C6B3B]">Alwalaa OS</p>
          <h1 className="mt-1 font-heading text-3xl sm:text-4xl">Market News</h1>
          <p className="mt-1 text-sm text-[#151311a6]">
            Oman real estate, Ministry of Housing &amp; Urban Planning, Omran and developer partners — aggregated live
            from public news feeds, refreshed about every 30 minutes.
          </p>
        </div>
        <Link href="/" className="text-[11px] font-semibold text-[#9C6B3B] hover:underline">
          ← Back to portal
        </Link>
      </div>

      {news.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-[#15131114] bg-white/70 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#1513110d]">
            <Newspaper className="h-7 w-7 text-[#15131159]" />
          </span>
          <p className="mt-4 font-heading text-lg">News feed unavailable right now</p>
          <p className="mt-1 max-w-sm text-xs text-[#151311a6]">
            The live feed couldn&apos;t be reached from this deployment. It retries automatically — check back shortly.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {news.map((n) => (
            <li key={n.link}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col rounded-2xl border border-[#15131114] bg-white/70 p-4 shadow-sm transition hover:border-[#D7A52C66] hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9C6B3B]">
                  <span>{n.source}</span>
                  {n.publishedAt && <span className="text-[#15131159]">· {n.publishedAt.slice(0, 10)}</span>}
                </div>
                <p className="mt-2 font-medium leading-snug">{n.title}</p>
                <span className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-[#15131173] transition group-hover:text-[#9C6B3B]">
                  Read at source <ArrowUpRight className="h-3 w-3" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
