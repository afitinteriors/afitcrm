import { describe, it, expect } from "vitest";
import type { DutyItem } from "@/lib/dashboard-brain";
import { excludeDutyNow, excludeLeadIds } from "@/lib/follow-up-queues";

function item(key: string, leadId: string | null, reasonKind: DutyItem["reasonKind"] = "no_follow_up"): DutyItem {
  return {
    key,
    tier: 3,
    leadId,
    conversationId: null,
    followUpId: null,
    customerName: key,
    phone: null,
    stage: null,
    assignedToName: null,
    reasonKind,
    reasonText: "",
    actionLabel: "",
    sortAt: "2026-01-01",
  };
}

describe("excludeDutyNow", () => {
  it("removes the Duty Now item from the derived queue and keeps the order of the rest", () => {
    const top = item("a", "L1", "unanswered_conversation");
    const items = [top, item("b", "L2"), item("c", "L3")];
    expect(excludeDutyNow(items, top).map((i) => i.key)).toEqual(["b", "c"]);
  });

  it("also removes another item for the same lead", () => {
    const top = item("a", "L1", "unanswered_conversation");
    const items = [top, item("a2", "L1"), item("b", "L2")];
    expect(excludeDutyNow(items, top).map((i) => i.key)).toEqual(["b"]);
  });

  it("does not collapse unrelated null-lead items", () => {
    const top = item("a", null, "unanswered_conversation");
    const items = [top, item("b", null, "unanswered_conversation")];
    expect(excludeDutyNow(items, top).map((i) => i.key)).toEqual(["b"]);
  });

  it("returns items unchanged when there is no Duty Now item", () => {
    const items = [item("a", "L1")];
    expect(excludeDutyNow(items, null)).toBe(items);
  });
});

describe("excludeLeadIds", () => {
  it("drops leads already claimed by an earlier list and keeps the rest", () => {
    const rows = [{ id: "L1" }, { id: "L2" }, { id: "L3" }];
    expect(excludeLeadIds(rows, new Set(["L2"]))).toEqual([{ id: "L1" }, { id: "L3" }]);
  });

  it("keeps everything when nothing is claimed", () => {
    const rows = [{ id: "L1" }];
    expect(excludeLeadIds(rows, new Set())).toEqual(rows);
  });
});
