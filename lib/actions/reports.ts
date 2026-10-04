"use server";

import { getCurrentProfile } from "@/lib/auth";
import { getReportsData, type ReportsData } from "@/lib/reports";
import type { ReportDateFilterInput } from "@/lib/report-date-filters";

export type ReportExportState = { data: ReportsData } | { error: string };

// Server-enforced gate for PDF/CSV export. The export files are built in the
// browser from this data, so the buttons alone are not the control: a non-admin
// caller gets an error here and never receives the full report payload for
// export. Viewing the Reports page is unchanged (lib/reports.ts scopes staff
// to their own leads); only the export capability is admin-only.
export async function exportReportsData(filters: ReportDateFilterInput): Promise<ReportExportState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Only an admin can export reports." };
  return { data: await getReportsData(filters) };
}
