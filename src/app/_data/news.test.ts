// The news parser feeds the portal hero — pin its shape against the stable
// Google News RSS format so a feed quirk degrades to "no news", never to
// broken or wrong headlines.
import { describe, expect, it } from "vitest";
import { mergeNews, parseRss } from "./news";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>"Oman" real estate - Google News</title>
<item>
  <title>Omran Group breaks ground on new Yiti phase - Oman Observer</title>
  <link>https://example.com/omran-yiti</link>
  <pubDate>Sat, 25 Jul 2026 08:00:00 GMT</pubDate>
  <source url="https://www.omanobserver.om">Oman Observer</source>
</item>
<item>
  <title><![CDATA[Ministry of Housing announces ITC &amp; freehold update]]></title>
  <link>https://example.com/mohup-itc</link>
  <pubDate>Fri, 24 Jul 2026 10:30:00 GMT</pubDate>
  <source url="https://timesofoman.com">Times of Oman</source>
</item>
<item>
  <title>Broken item without a link</title>
</item>
</channel></rss>`;

describe("parseRss", () => {
  it("extracts title, link, source and ISO date; strips the Google source suffix", () => {
    const items = parseRss(FEED);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "Omran Group breaks ground on new Yiti phase",
      link: "https://example.com/omran-yiti",
      source: "Oman Observer",
      publishedAt: "2026-07-25T08:00:00.000Z",
    });
    expect(items[1].title).toBe("Ministry of Housing announces ITC & freehold update");
    expect(items[1].source).toBe("Times of Oman");
  });

  it("returns [] on junk input instead of throwing", () => {
    expect(parseRss("not xml at all")).toEqual([]);
  });
});

describe("mergeNews", () => {
  it("dedupes by normalized title and sorts newest first", () => {
    const a = parseRss(FEED);
    const dup = [{ ...a[0], title: "Omran Group breaks ground on new Yiti PHASE!", link: "https://other.example" }];
    const merged = mergeNews([dup, a], 10);
    expect(merged).toHaveLength(2);
    expect(merged[0].publishedAt > merged[1].publishedAt).toBe(true);
  });

  it("applies the limit", () => {
    expect(mergeNews([parseRss(FEED)], 1)).toHaveLength(1);
  });
});
