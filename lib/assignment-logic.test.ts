import { describe, expect, it } from "vitest";
import {
  buildStaffWorkload,
  describeAssignmentEvent,
  isCreatedToday,
  isOlderThan24h,
  leadAgeHours,
  lowestWorkloadStaffId,
  sortUnassignedOldestFirst,
  summarizeUnassigned,
} from "./assignment-logic";

// 2026-10-04 12:00 IST (06:30 UTC)
const NOW = new Date("2026-10-04T06:30:00Z");

describe("lead age (measured from created_at)", () => {
  it("counts whole elapsed hours", () => {
    expect(leadAgeHours("2026-10-03T06:30:00Z", NOW)).toBe(24);
    expect(leadAgeHours("2026-10-04T00:30:00Z", NOW)).toBe(6);
  });

  it("never returns a negative age for a future timestamp", () => {
    expect(leadAgeHours("2026-10-05T00:00:00Z", NOW)).toBe(0);
  });

  it("flags leads at or beyond 24 hours as older than 24h", () => {
    expect(isOlderThan24h("2026-10-03T06:30:00Z", NOW)).toBe(true);
    expect(isOlderThan24h("2026-10-03T06:31:00Z", NOW)).toBe(false);
  });
});

describe("created today (business time zone)", () => {
  it("is true for a lead created earlier today in IST", () => {
    // 2026-10-04 08:00 IST = 02:30 UTC, still 4 Oct in IST
    expect(isCreatedToday("2026-10-04T02:30:00Z", NOW)).toBe(true);
  });

  it("is false for a lead created yesterday in IST", () => {
    // 2026-10-03 23:00 IST = 17:30 UTC on 3 Oct
    expect(isCreatedToday("2026-10-03T17:30:00Z", NOW)).toBe(false);
  });
});

describe("unassigned queue ordering and summary", () => {
  const rows = [
    { id: "new", created_at: "2026-10-04T05:00:00Z" },
    { id: "oldest", created_at: "2026-09-30T04:00:00Z" },
    { id: "middle", created_at: "2026-10-03T04:00:00Z" },
  ];

  it("sorts oldest first so long-waiting leads surface first", () => {
    expect(sortUnassignedOldestFirst(rows).map((r) => r.id)).toEqual(["oldest", "middle", "new"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...rows];
    sortUnassignedOldestFirst(rows);
    expect(rows).toEqual(copy);
  });

  it("summarizes total, older than 24h and created today from real rows", () => {
    expect(summarizeUnassigned(rows, NOW)).toEqual({ total: 3, olderThan24h: 2, createdToday: 1 });
  });

  it("summarizes an empty queue as all zero", () => {
    expect(summarizeUnassigned([], NOW)).toEqual({ total: 0, olderThan24h: 0, createdToday: 0 });
  });
});

describe("staff workload (real counts, no capacity)", () => {
  const staff = [
    { id: "a", display_name: "Azhar" },
    { id: "b", display_name: "Bilal" },
    { id: "c", display_name: null },
  ];

  it("counts open leads per staff member, zero when none", () => {
    const items = buildStaffWorkload(staff, [
      { assigned_to_id: "a" },
      { assigned_to_id: "a" },
      { assigned_to_id: "b" },
      { assigned_to_id: null },
    ]);
    expect(items.find((i) => i.staffId === "a")?.activeLeads).toBe(2);
    expect(items.find((i) => i.staffId === "b")?.activeLeads).toBe(1);
    expect(items.find((i) => i.staffId === "c")?.activeLeads).toBe(0);
  });

  it("orders by fewest active leads, then name, and labels missing names", () => {
    const items = buildStaffWorkload(staff, [{ assigned_to_id: "a" }]);
    expect(items.map((i) => i.staffId)).toEqual(["b", "c", "a"]);
    expect(items[1].displayName).toBe("Unnamed staff");
  });

  it("suggests the lowest-workload staff member only as a suggestion id", () => {
    const items = buildStaffWorkload(staff, [{ assigned_to_id: "a" }]);
    expect(lowestWorkloadStaffId(items)).toBe("b");
    expect(lowestWorkloadStaffId([])).toBeNull();
  });
});

describe("assignment history descriptions", () => {
  const names = new Map([
    ["s1", "Staff A"],
    ["s2", "Staff B"],
  ]);

  it("describes an assignment from unassigned", () => {
    expect(
      describeAssignmentEvent({ created_at: "t", actorName: "Admin", metadata: { previous_staff_id: null, new_staff_id: "s1" } }, names),
    ).toEqual({ kind: "assigned", at: "t", actorName: "Admin", toName: "Staff A" });
  });

  it("describes a reassignment with both names", () => {
    expect(
      describeAssignmentEvent({ created_at: "t", actorName: "Admin", metadata: { previous_staff_id: "s1", new_staff_id: "s2" } }, names),
    ).toEqual({ kind: "reassigned", at: "t", actorName: "Admin", fromName: "Staff A", toName: "Staff B" });
  });

  it("does not guess the previous owner for events recorded before history metadata existed", () => {
    expect(describeAssignmentEvent({ created_at: "t", actorName: "Admin", metadata: null }, names)).toEqual({
      kind: "assigned_unknown_previous",
      at: "t",
      actorName: "Admin",
      toName: "Unknown staff",
    });
  });
});
