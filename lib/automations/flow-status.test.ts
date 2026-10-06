import { describe, it, expect } from "vitest";
import { deriveFlowStatus, getPublishedAt, latestUpdatedAt } from "@/lib/automations/flow-status";

const stamped = { meta: { publishedAt: "2026-10-06T08:00:00.000Z" }, version: 3, nodes: [], edges: [] };
const unstamped = { meta: { publishedAt: null }, version: 3, nodes: [], edges: [] };

describe("deriveFlowStatus", () => {
  it("shows Not configured when there is no automation row", () => {
    expect(deriveFlowStatus(null)).toEqual({ key: "not_configured", label: "Not configured" });
  });

  it("shows Active for an existing active row, regardless of any publish stamp", () => {
    expect(deriveFlowStatus({ status: "active", actions: stamped }).key).toBe("active");
    expect(deriveFlowStatus({ status: "active", actions: unstamped }).label).toBe("Active");
  });

  it("shows Published · Not live for a draft that carries meta.publishedAt", () => {
    expect(deriveFlowStatus({ status: "draft", actions: stamped })).toEqual({
      key: "published_not_live",
      label: "Published · Not live",
    });
  });

  it("shows Draft for a draft without a publish stamp", () => {
    expect(deriveFlowStatus({ status: "draft", actions: unstamped }).label).toBe("Draft");
  });

  it("shows Draft for a legacy v2 row with no meta", () => {
    expect(deriveFlowStatus({ status: "draft", actions: { version: 2, nodes: [], edges: [] } }).label).toBe("Draft");
  });

  it("treats an unknown status as Draft, never as Active", () => {
    expect(deriveFlowStatus({ status: "paused", actions: stamped }).key).toBe("published_not_live");
    expect(deriveFlowStatus({ status: "paused", actions: unstamped }).key).toBe("draft");
  });
});

describe("getPublishedAt", () => {
  it("returns the stamp only when it is a non-empty string", () => {
    expect(getPublishedAt(stamped)).toBe("2026-10-06T08:00:00.000Z");
    expect(getPublishedAt(unstamped)).toBeNull();
    expect(getPublishedAt({ meta: { publishedAt: "" } })).toBeNull();
    expect(getPublishedAt({ meta: { publishedAt: 42 } })).toBeNull();
  });

  it("is null for missing, array or malformed payloads", () => {
    expect(getPublishedAt(null)).toBeNull();
    expect(getPublishedAt(undefined)).toBeNull();
    expect(getPublishedAt([])).toBeNull();
    expect(getPublishedAt("draft")).toBeNull();
    expect(getPublishedAt({ meta: "yes" })).toBeNull();
  });
});

describe("latestUpdatedAt", () => {
  it("returns the later of the service and automation timestamps", () => {
    const service = { updated_at: "2026-10-01T00:00:00.000Z" };
    const automation = { updated_at: "2026-10-05T12:00:00.000Z" };
    expect(latestUpdatedAt(service, automation)).toBe("2026-10-05T12:00:00.000Z");
    expect(latestUpdatedAt({ updated_at: "2026-10-09T00:00:00.000Z" }, automation)).toBe("2026-10-09T00:00:00.000Z");
  });

  it("uses the service timestamp when there is no automation", () => {
    expect(latestUpdatedAt({ updated_at: "2026-10-01T00:00:00.000Z" }, null)).toBe("2026-10-01T00:00:00.000Z");
  });

  it("ignores unusable timestamps and returns null when none are usable", () => {
    expect(latestUpdatedAt({ updated_at: "not a date" }, null)).toBeNull();
    expect(latestUpdatedAt({ updated_at: "2026-10-01T00:00:00.000Z" }, { updated_at: "" })).toBe("2026-10-01T00:00:00.000Z");
  });
});
