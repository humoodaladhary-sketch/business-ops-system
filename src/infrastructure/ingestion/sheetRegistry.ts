// Registry of the real agent Google Sheets (IDs discovered from the CRM Drive).
// The sync job reads each sheet's "My Deals Status" and "My Leads Pipeline" tabs.
// Add an agent here (no code change elsewhere) to bring their sheet into sync.

export interface SheetSource {
  agentId: string;
  spreadsheetId: string;
  dealsRange: string; // e.g. "My Deals Status!A1:V300"
  leadsRange: string; // e.g. "My Leads Pipeline!A1:AC300"
  active: boolean;
}

export const SHEET_SOURCES: SheetSource[] = [
  { agentId: "shatha", spreadsheetId: "19sbQuOxnL81s1h4-43ydilKM0NiMmWpwKcyKq7WvVfE", dealsRange: "My Deals Status!A1:V300", leadsRange: "My Leads Pipeline!A1:AC300", active: true },
  { agentId: "alex", spreadsheetId: "1-CswtXQJVgnOOyuKO3bT6xk4iUpb24zNAvS4CvwuHLc", dealsRange: "My Deals Status!A1:V300", leadsRange: "My Leads Pipeline!A1:AC300", active: true },
  { agentId: "pasha", spreadsheetId: "10eQ9kJfVTAwLvmFzF8888-BKyQnU7zrXyHEftn99BXo", dealsRange: "My Deals Status!A1:V300", leadsRange: "My Leads Pipeline!A1:AC300", active: true },
  { agentId: "wesam", spreadsheetId: "1WqWvWVDUV2OIIUAYyYT_8dif4hFVni6YsmgvO1xO-Tg", dealsRange: "My Deals Status!A1:V300", leadsRange: "My Leads Pipeline!A1:AC300", active: true },
  // Former — historical records only (deals tab is a team override sheet).
  { agentId: "yousef", spreadsheetId: "1y_blIWkhkcSP6yy_WDcIQoSe3SyepLt_YEvNyn0DGoc", dealsRange: "My Deals Status!A1:W300", leadsRange: "My Leads Pipeline!A1:AC300", active: false },
];

// Central inbound intake (Google Form responses) — all alwalaa_sourced leads.
export const INTAKE_FORM = {
  spreadsheetId: "1dQCcNSvWWtnkNg0swxnKRv8xTW-yMNCOPJ7oskWUZfY",
  range: "Form Responses 1!A1:O2000",
};
