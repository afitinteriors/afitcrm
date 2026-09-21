import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { groupFollowUpsByDueDate, isFollowUpOverdue } from "@/lib/follow-up-status";

type Item = { id: string; status: "pending" | "completed"; due_date: string };
const item = (id: string, due_date: string, status: Item["status"] = "pending"): Item => ({ id, status, due_date });

describe("follow-up day bucketing uses the IST business day (G)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("at 00:30 IST on the 22nd (still the 21st in UTC), the 21st is overdue and the 22nd is today", () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    const groups = groupFollowUpsByDueDate([item("a", "2026-09-21"), item("b", "2026-09-22"), item("c", "2026-09-23")]);
    expect(groups.overdue.map((i) => i.id)).toEqual(["a"]);
    expect(groups.today.map((i) => i.id)).toEqual(["b"]);
    expect(groups.upcoming.map((i) => i.id)).toEqual(["c"]);
    expect(isFollowUpOverdue({ status: "pending", due_date: "2026-09-21" })).toBe(true);
  });

  it("at 23:30 IST on the 21st the 21st is still today", () => {
    vi.setSystemTime(new Date("2026-09-21T18:00:00Z"));
    const groups = groupFollowUpsByDueDate([item("a", "2026-09-21"), item("b", "2026-09-20")]);
    expect(groups.today.map((i) => i.id)).toEqual(["a"]);
    expect(groups.overdue.map((i) => i.id)).toEqual(["b"]);
  });

  it("H: completed items stay completed regardless of due date", () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    const groups = groupFollowUpsByDueDate([item("done", "2026-09-01", "completed")]);
    expect(groups.completed).toHaveLength(1);
    expect(groups.overdue).toHaveLength(0);
  });
});
