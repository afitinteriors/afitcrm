// Display status for an automation flow in the Automation Hub. Read-only:
// nothing here changes services.is_active, automations.status or the graph.
//
// Rules (approved Hub plan):
//   no automation row                 -> Not configured
//   status 'active'                   -> Active (read-only, existing live row)
//   status 'draft' + meta.publishedAt -> Published · Not live
//   anything else                     -> Draft

export type FlowStatusKey = "not_configured" | "draft" | "published_not_live" | "active";

export type FlowStatus = { key: FlowStatusKey; label: string };

export const FLOW_STATUS_LABELS: Record<FlowStatusKey, string> = {
  not_configured: "Not configured",
  draft: "Draft",
  published_not_live: "Published · Not live",
  active: "Active",
};

// Reads meta.publishedAt from a builder graph. Legacy v1/v2 rows and anything
// malformed have no publish stamp, so they resolve to null (Draft).
export function getPublishedAt(actions: unknown): string | null {
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) return null;
  const meta = (actions as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  const publishedAt = (meta as { publishedAt?: unknown }).publishedAt;
  return typeof publishedAt === "string" && publishedAt.length > 0 ? publishedAt : null;
}

export function deriveFlowStatus(automation: { status: string; actions: unknown } | null): FlowStatus {
  if (!automation) return { key: "not_configured", label: FLOW_STATUS_LABELS.not_configured };
  if (automation.status === "active") return { key: "active", label: FLOW_STATUS_LABELS.active };
  if (getPublishedAt(automation.actions)) {
    return { key: "published_not_live", label: FLOW_STATUS_LABELS.published_not_live };
  }
  return { key: "draft", label: FLOW_STATUS_LABELS.draft };
}

// Most recent of the service and automation timestamps, as ISO text. Returns
// null only if neither has a usable value.
export function latestUpdatedAt(service: { updated_at: string }, automation: { updated_at: string } | null): string | null {
  const candidates = [service.updated_at, automation?.updated_at].filter(
    (value): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value))
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest));
}
