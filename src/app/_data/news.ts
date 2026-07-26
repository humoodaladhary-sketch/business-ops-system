// Live business-news feed for the portal hero — Oman real estate, the
// Ministry of Housing & Urban Planning, Omran, and the developer partners.
// Aggregated from public Google News RSS at request time and cached ~30 min
// via the fetch data cache. No keys, no fabrication: if the feed is
// unreachable the portal simply falls back to business highlights.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
}

// Two curated queries: the institutional beat and the partner/project beat.
const QUERIES = [
  `"Oman" (real estate OR freehold OR ITC OR "golden residency" OR "Ministry of Housing" OR Omran OR MoHUP)`,
  `"Sultan Haitham City" OR "Al Mouj" OR "Muscat Bay" OR "Jebel Sifah" OR "AIDA" Oman OR "Hawana Salalah" OR "Sarooj" Muscat`,
];

const FEED_URL = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-OM&gl=OM&ceid=OM:en`;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .trim();

const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

/** Parse a Google-News-style RSS document into news items (exported for tests). */
export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    let title = tag(block, "title");
    const link = tag(block, "link");
    const source = tag(block, "source");
    const pub = tag(block, "pubDate");
    if (!title || !link) continue;
    // Google News suffixes titles with " - Source"; strip when it matches.
    if (source && title.toLowerCase().endsWith(` - ${source.toLowerCase()}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }
    const at = pub ? new Date(pub) : null;
    items.push({
      title,
      link,
      source: source || "News",
      publishedAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : "",
    });
  }
  return items;
}

/** Newest-first, deduped by normalized title. */
export function mergeNews(lists: NewsItem[][], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(item);
  }
  return all.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, limit);
}

export async function loadNews(limit = 10): Promise<NewsItem[]> {
  try {
    const settled = await Promise.allSettled(
      QUERIES.map((q) =>
        fetch(FEED_URL(q), {
          next: { revalidate: 1800 },
          signal: AbortSignal.timeout(8000),
          headers: { "user-agent": "AlwalaaOS/1.0 (+business-ops-system)" },
        }).then((r) => (r.ok ? r.text() : "")),
      ),
    );
    const lists = settled
      .filter((s): s is PromiseFulfilledResult<string> => s.status === "fulfilled" && Boolean(s.value))
      .map((s) => parseRss(s.value));
    return mergeNews(lists, limit);
  } catch {
    return [];
  }
}
