import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/leads", () => ({ setLeadStatus: vi.fn() }));

import { StatusSelect } from "@/components/lead-actions/StatusSelect";
import { LostLeadNotice } from "@/components/lead-actions/ClosedLeadNotice";
import { isClosedLeadStatus } from "@/lib/constants";

const render = (status: Parameters<typeof StatusSelect>[0]["status"]) =>
  renderToStaticMarkup(createElement(StatusSelect, { leadId: "lead-1", status }));

describe("closed-lead UX", () => {
  it("Won and Lost are closed; every open stage is not", () => {
    expect(isClosedLeadStatus("won")).toBe(true);
    expect(isClosedLeadStatus("lost")).toBe(true);
    for (const s of ["new", "contacted", "qualified", "site_visit", "quotation", "negotiation"] as const) {
      expect(isClosedLeadStatus(s)).toBe(false);
    }
  });

  it("a Lost lead shows a read-only Lost badge and no stage selector", () => {
    const html = render("lost");
    expect(html).toContain("Lost");
    expect(html).toContain("closed-stage-badge");
    expect(html).not.toContain("<select");
  });

  it("a Won lead is read-only too", () => {
    const html = render("won");
    expect(html).toContain("Won");
    expect(html).not.toContain("<select");
  });

  it("an open lead still gets the stage selector", () => {
    const html = render("negotiation");
    expect(html).toContain("<select");
    expect(html).not.toContain("closed-stage-badge");
  });

  it("the Lost notice states the fact and no longer points at the stage selector", () => {
    const html = renderToStaticMarkup(createElement(LostLeadNotice));
    expect(html).toContain("Lost is final and cannot be moved back into the pipeline.");
    expect(html).not.toMatch(/earlier pipeline stage|stage selector/i);
  });
});
