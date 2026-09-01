"use client";

import { useState } from "react";
import { AutomationList } from "@/components/automation/AutomationList";
import { AutomationBuilder } from "@/components/automation/AutomationBuilder";
import { defaultDataForKind, type Automation, type AutomationEdge, type AutomationNode, type NodeKind } from "@/lib/automation/types";
import type { StaffOption } from "@/lib/staff";

function node(id: string, kind: NodeKind, x: number, y: number, service: string, overrides: Partial<AutomationNode["data"]> = {}): AutomationNode {
  return {
    id,
    type: "automationNode",
    position: { x, y },
    data: { ...defaultDataForKind(kind, service), ...overrides },
  };
}

function edge(id: string, source: string, target: string, sourceHandle?: string): AutomationEdge {
  return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

// Example, local-only starter data -- illustrates the builder's capability
// (the full Gypsum Plastering journey from the C5 spec). Never written to
// Supabase; exists only in this component's state for this visit.
function buildExampleAutomations(): Automation[] {
  const gypsumNodes: AutomationNode[] = [
    node("g1", "trigger_new_message", 40, 300, "Gypsum Plastering"),
    node("g2", "filter_detect_service", 340, 300, "Gypsum Plastering"),
    node("g3", "action_create_link_lead", 640, 300, "Gypsum Plastering"),
    node("g4", "action_assign_admin", 940, 300, "Gypsum Plastering"),
    node("g5", "message_text", 1240, 300, "Gypsum Plastering", {
      message: "Hi! Thanks for asking about our Gypsum Plastering service. Let me share a few details.",
      delayValue: 5,
    }),
    node("g6", "message_image", 1540, 300, "Gypsum Plastering", { mediaName: "gypsum-before-after.jpg" }),
    node("g7", "message_video", 1840, 300, "Gypsum Plastering", { mediaName: "gypsum-process.mp4" }),
    node("g8", "message_file", 2140, 300, "Gypsum Plastering", { mediaName: "Gypsum-Brochure.pdf" }),
    node("g9", "message_text", 2440, 300, "Gypsum Plastering", {
      message: "Quick question — is this for a residential or commercial space, and roughly how many sq. ft.?",
      delayValue: 0,
    }),
    node("g10", "flow_customer_response", 2740, 300, "Gypsum Plastering", { responseLabel: "Qualification answer" }),
    node("g11", "flow_condition", 3040, 300, "Gypsum Plastering", {
      conditionField: "Customer answer",
      conditionOperator: "contains",
      conditionValue: "interested",
    }),
    node("g12", "action_start_followup", 3340, 160, "Gypsum Plastering", { followUpType: "site_visit" }),
    node("g13", "action_start_followup", 3340, 440, "Gypsum Plastering", { followUpType: "follow_up" }),
    node("g14", "flow_crosssell", 3640, 440, "Gypsum Plastering", {
      crossSellTargetService: "Interior Design",
      crossSellCondition: "Only when qualified",
    }),
  ];

  const gypsumEdges: AutomationEdge[] = [
    edge("ge1", "g1", "g2"),
    edge("ge2", "g2", "g3"),
    edge("ge3", "g3", "g4"),
    edge("ge4", "g4", "g5"),
    edge("ge5", "g5", "g6"),
    edge("ge6", "g6", "g7"),
    edge("ge7", "g7", "g8"),
    edge("ge8", "g8", "g9"),
    edge("ge9", "g9", "g10"),
    edge("ge10", "g10", "g11"),
    edge("ge11", "g11", "g12", "yes"),
    edge("ge12", "g11", "g13", "no"),
    edge("ge13", "g13", "g14"),
  ];

  const interiorNodes: AutomationNode[] = [
    node("i1", "trigger_new_message", 40, 200, "Interior Design"),
    node("i2", "filter_detect_service", 340, 200, "Interior Design"),
    node("i3", "action_create_link_lead", 640, 200, "Interior Design"),
    node("i4", "action_assign_admin", 940, 200, "Interior Design"),
    node("i5", "message_text", 1240, 200, "Interior Design", {
      message: "Thanks for your interest in our Interior Design service! Could you share your space size and budget range?",
      delayValue: 5,
    }),
  ];
  const interiorEdges: AutomationEdge[] = [
    edge("ie1", "i1", "i2"),
    edge("ie2", "i2", "i3"),
    edge("ie3", "i3", "i4"),
    edge("ie4", "i4", "i5"),
  ];

  return [
    {
      id: "example-gypsum",
      name: "Gypsum Plastering Enquiry",
      service: "Gypsum Plastering",
      status: "draft",
      priority: 1,
      updatedAt: new Date().toISOString(),
      nodes: gypsumNodes,
      edges: gypsumEdges,
    },
    {
      id: "example-interior",
      name: "Interior Design Enquiry",
      service: "Interior Design",
      status: "active",
      priority: 2,
      updatedAt: new Date().toISOString(),
      nodes: interiorNodes,
      edges: interiorEdges,
    },
  ];
}

function blankAutomation(priority: number): Automation {
  return {
    id: crypto.randomUUID(),
    name: "",
    service: "Gypsum Plastering",
    status: "draft",
    priority,
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
  };
}

type View = { type: "list" } | { type: "builder"; automation: Automation };

export function AutomationWorkspace({ staff }: { staff: StaffOption[] }) {
  const [automations, setAutomations] = useState<Automation[]>(buildExampleAutomations);
  const [view, setView] = useState<View>({ type: "list" });

  function handleSave(automation: Automation) {
    setAutomations((prev) => {
      const exists = prev.some((a) => a.id === automation.id);
      return exists ? prev.map((a) => (a.id === automation.id ? automation : a)) : [...prev, automation];
    });
    setView({ type: "list" });
  }

  function handleOpen(id: string) {
    const found = automations.find((a) => a.id === id);
    if (found) setView({ type: "builder", automation: found });
  }

  function handleNew() {
    setView({ type: "builder", automation: blankAutomation(automations.length + 1) });
  }

  function handleDuplicate(id: string) {
    setAutomations((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index === -1) return prev;
      const source = prev[index];
      const idMap = new Map<string, string>();
      const nodes = source.nodes.map((n) => {
        const newId = crypto.randomUUID();
        idMap.set(n.id, newId);
        return { ...n, id: newId, selected: false };
      });
      const edges = source.edges.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }));
      const copy: Automation = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (copy)`,
        status: "draft",
        priority: prev.length + 1,
        updatedAt: new Date().toISOString(),
        nodes,
        edges,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function handleToggleActive(id: string) {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === "active" ? "draft" : "active", updatedAt: new Date().toISOString() } : a))
    );
  }

  if (view.type === "builder") {
    return (
      <AutomationBuilder
        automation={view.automation}
        staff={staff}
        onSave={handleSave}
        onCancel={() => setView({ type: "list" })}
      />
    );
  }

  return (
    <AutomationList
      automations={automations}
      onOpen={handleOpen}
      onDuplicate={handleDuplicate}
      onToggleActive={handleToggleActive}
      onNew={handleNew}
    />
  );
}
