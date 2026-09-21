import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/lead-actions/CreateFollowUpForm", () => ({ CreateFollowUpForm: () => null }));
vi.mock("@/components/lead-actions/CompleteFollowUpButton", () => ({ CompleteFollowUpButton: () => null }));

import { FollowUpsCard } from "@/components/lead-actions/FollowUpsCard";
import type { FollowUpRow } from "@/lib/supabase/types";

const fu = (id: string, due_date: string, due_time: string | null = null): FollowUpRow =>
  ({ id, lead_id: "l", type: "call", due_date, due_time, notes: null, status: "pending" }) as unknown as FollowUpRow;

const render = (items: FollowUpRow[]) => renderToStaticMarkup(createElement(FollowUpsCard, { leadId: "l", followUps: items }));

describe("FollowUpsCard highlighting follows the IST business day", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("at 00:30 IST on the 22nd, a follow-up due the 22nd shows 'Due today' and one due the 21st shows 'Overdue'", () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    expect(render([fu("a", "2026-09-22")])).toContain("Due today");
    const overdue = render([fu("b", "2026-09-21")]);
    expect(overdue).toContain("Overdue");
    expect(overdue).not.toContain("Due today");
  });

  it("H: due time is still shown as entered (HH:MM), unchanged", () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    expect(render([fu("a", "2026-09-25", "10:30:00")])).toContain("10:30");
  });
});
