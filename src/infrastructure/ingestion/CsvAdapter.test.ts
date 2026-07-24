import { describe, it, expect } from "vitest";
import { parseDealsCsv } from "./CsvAdapter";

// Mirrors a real "My Deals Status" export: two decorative rows above the header,
// money-as-text with embedded commas (quoted), a #VALUE! bad row, and a footer
// aggregate row with no client name.
const CSV = [
  "My Deals Status  ,Its Time to collect the comission",
  "to be validated by sulaiman ,7 days remaining",
  "S/N,Client Name ,Client Contact Number ,Client Email Adress ,Develoepr Name,Project name,unit type,unit number,Alwalaa Comission %,Property Value ( excld vat ) Based on SPA,Deal Stage ,Deal Closed On (date),alwalaa invoice submition to developer via email,Expected Comission Recived due date,alwalaa net ( exld vat ) commission from developer,Alwalaa Comission payment Status,My comission Payment status,My Comission %,My Comission Amount ,Lead Source ",
  '1,Mohammad Edris Karim,61 470 210 734,eddyk@ozcc.com.au,Alahly Sabbour,Wadi Zaha,Studio,E26-D512,3.5,"43,500.00  OMR ",CLOSED,10/30/2025,YES,12/14/2025,"1,522.50  OMR ",Recieved ,Paid,35,"532.88  OMR ",',
  '2,Bad Value,123,x@y.com,Alahly Sabbour,Wadi Zaha,Studio,E1,3.5,#VALUE!,CLOSED,SPA pending,NO,,,,,50,,My Own Lead',
  ',,,,My Total Sales Volume,,,,,"1,529,634.70  OMR ",,,,,,,,,,',
].join("\n");

describe("parseDealsCsv — end-to-end ingestion", () => {
  const result = parseDealsCsv(CSV);

  it("locates the real header row beneath the decorative rows", () => {
    expect(result.headerRowIndex).toBe(2);
  });

  it("parses the good row into a clean, typed deal", () => {
    expect(result.valid).toHaveLength(1);
    const deal = result.valid[0];
    expect(deal.clientName).toBe("Mohammad Edris Karim");
    expect(deal.dealValue).toBe(43500);
    expect(deal.developerRate).toBe(0.035);
    expect(deal.contact).toBe("61470210734");
    expect(deal.leadSource).toBe("ALWALAA_SOURCED");
    expect(deal.closeDate?.toISOString()).toBe("2025-10-30T00:00:00.000Z");
  });

  it("rejects and logs the #VALUE! row rather than storing it", () => {
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].errors.join(" ")).toMatch(/dealValue/i);
  });

  it("skips the footer aggregate row", () => {
    // Only the two data rows reach staging; the totals row is excluded.
    expect(result.rawRows).toHaveLength(2);
  });
});
