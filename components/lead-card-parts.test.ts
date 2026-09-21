import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeadCard } from "@/components/LeadCard";
import { STAGE_ACCENT, UNNAMED, avatarFor, initialsFor, leadCardClass } from "@/components/lead-card-parts";
import type { LeadListRow } from "@/lib/leads";

function lead(over: Partial<LeadListRow> = {}): LeadListRow {
  return {
    id: "lead-1",
    customer_name: "Asha Nair",
    phone: "+919846321048",
    status: "quotation",
    service_required: "Modular kitchen",
    project_type: null,
    job_value: null,
    quotation_amount: 250000,
    created_at: new Date().toISOString(),
    assigned: { display_name: "Azhar Vahab" },
    ...over,
  } as unknown as LeadListRow;
}

const render = (l: LeadListRow, showAssignee: boolean) =>
  renderToStaticMarkup(createElement(LeadCard, { lead: l, showAssignee }));

describe("shared lead-card helpers", () => {
  it("derives initials from the name, never for the placeholder", () => {
    expect(initialsFor("Asha Nair")).toBe("AN");
    expect(initialsFor("sumeshsachus")).toBe("SU");
    expect(initialsFor(UNNAMED)).toBeNull();
    expect(initialsFor("+91 98")).toBeNull();
  });

  it("keeps the avatar tint stable per lead id", () => {
    expect(avatarFor("abc")).toBe(avatarFor("abc"));
  });

  it("uses the stage accent in the card class", () => {
    expect(leadCardClass("lost")).toContain(STAGE_ACCENT.lost.bar);
    expect(leadCardClass("new")).toContain("border-l-blue-500");
    expect(leadCardClass("new")).toContain("rounded-2xl");
  });
});

describe("LeadCard", () => {
  it("renders name link, stage pill, phone, service and value", () => {
    const html = render(lead(), true);
    expect(html).toContain('href="/leads/lead-1"');
    expect(html).toContain("Asha Nair");
    expect(html).toContain("Quotation");
    expect(html).toContain("+919846321048");
    expect(html).toContain("Modular kitchen");
    expect(html).toContain("border-l-purple-500");
  });

  it("renders independent Call and WhatsApp actions", () => {
    const html = render(lead(), false);
    expect(html).toContain('href="tel:');
    expect(html).toContain("wa.me");
    expect(html).toContain('aria-label="Call customer"');
    expect(html).toContain('aria-label="WhatsApp customer"');
    expect(html).toContain("h-11 w-11");
  });

  it("shows the salesperson for admin only", () => {
    expect(render(lead(), true)).toContain("Azhar Vahab");
    expect(render(lead(), false)).not.toContain("Azhar Vahab");
    expect(render(lead({ assigned: null }), true)).toContain("Unassigned");
  });

  it("prefers job_value over quotation_amount and falls back to placeholder name", () => {
    const html = render(lead({ job_value: 900000, customer_name: null as unknown as string }), false);
    expect(html).toContain("Unnamed lead");
    expect(html).toContain("9,00,000");
    expect(html).not.toContain("2,50,000");
  });
});
