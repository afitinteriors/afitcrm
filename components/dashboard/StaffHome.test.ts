import { describe, it, expect } from "vitest";
import type { DutyItem } from "@/lib/dashboard-brain";
import { excludeDutyNow } from "@/lib/follow-up-queues";

// StaffHome.tsx is a server component (JSX, no DOM in this project's Node-
// only vitest setup -- see vitest.config.ts), so it isn't directly
// renderable/importable here. This test instead exercises the exact bucket
// derivation StaffHome.tsx performs on a DutyQueue's items -- topItem, then
// overdueItems/dueTodayItems/otherItems each run through excludeDutyNow --
// to prove the regression this phase fixes: the lead chosen for "My Duty
// Now" must not also reappear in one of the derived lists below it.

function item(key: string, leadId: string | null, reasonKind: DutyItem["reasonKind"]): DutyItem {
  return {
    key,
    tier: 1,
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

// Mirrors StaffHome.tsx's bucket derivation exactly.
function deriveBuckets(items: DutyItem[]) {
  const topItem = items[0] ?? null;
  const overdueItems = excludeDutyNow(items.filter((i) => i.reasonKind === "overdue_follow_up"), topItem);
  const dueTodayItems = excludeDutyNow(items.filter((i) => i.reasonKind === "due_today_follow_up"), topItem);
  const otherItems = excludeDutyNow(
    items.filter((i) => i.reasonKind === "unanswered_conversation" || i.reasonKind === "uncontacted_lead" || i.reasonKind === "no_follow_up"),
    topItem,
  );
  return { topItem, overdueItems, dueTodayItems, otherItems };
}

describe("StaffHome duty-queue bucket derivation", () => {
  it("the Duty Now item does not repeat in My Active Leads / Other Work (the reported bug)", () => {
    // Reproduces the production case: an unanswered-conversation lead
    // (Ravedran Pillai) wins the Duty Now slot and previously also showed
    // up again in the "other" bucket because it shares that bucket's
    // reasonKind.
    const dutyNow = item("conversation:1", "lead-1", "unanswered_conversation");
    const otherUnanswered = item("conversation:2", "lead-2", "unanswered_conversation");
    const uncontacted = item("uncontacted:3", "lead-3", "uncontacted_lead");
    const items = [dutyNow, otherUnanswered, uncontacted];

    const { topItem, overdueItems, dueTodayItems, otherItems } = deriveBuckets(items);

    expect(topItem).toBe(dutyNow);
    // Appears exactly once across every rendered location.
    const allRenderedKeys = [topItem?.key, ...overdueItems.map((i) => i.key), ...dueTodayItems.map((i) => i.key), ...otherItems.map((i) => i.key)];
    expect(allRenderedKeys.filter((k) => k === dutyNow.key)).toHaveLength(1);
    // Explicitly not in the "other" bucket.
    expect(otherItems.map((i) => i.key)).not.toContain(dutyNow.key);
    // Unrelated items are unaffected and still appear normally.
    expect(otherItems.map((i) => i.key)).toEqual([otherUnanswered.key, uncontacted.key]);
  });

  it("also de-dupes when the Duty Now item is an overdue or due-today follow-up", () => {
    const dutyNow = item("follow_up:1", "lead-1", "overdue_follow_up");
    const otherOverdue = item("follow_up:2", "lead-2", "overdue_follow_up");
    const items = [dutyNow, otherOverdue];

    const { overdueItems } = deriveBuckets(items);

    expect(overdueItems.map((i) => i.key)).toEqual([otherOverdue.key]);
  });

  it("leaves every bucket untouched when there is no Duty Now item", () => {
    const { topItem, overdueItems, dueTodayItems, otherItems } = deriveBuckets([]);
    expect(topItem).toBeNull();
    expect(overdueItems).toEqual([]);
    expect(dueTodayItems).toEqual([]);
    expect(otherItems).toEqual([]);
  });
});
