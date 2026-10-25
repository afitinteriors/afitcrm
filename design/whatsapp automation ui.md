# WhatsApp Automation Builder — UI Design Specification

Status: design reference (UI only). Not an implementation, not a schema change, not an activation plan.
Primary visual reference: `design/whatsapp automation ui.jpeg`.
Implementation target: the existing builder at `/automation/services/[serviceId]/builder`
(`components/automation-builder/*`, graph v3 in `lib/automations/builder-graph.ts`).
Do not create a second builder.

---

## 1. Layout (matches the reference)

Three panes under one top bar, inside the existing AFIT admin shell.

| Region | Width (desktop) | Content |
|---|---|---|
| App sidebar (existing) | ~240px | AFIT nav, admin-only items shown only to admins |
| Flow Elements (left) | ~200px, fixed | Grouped draggable block palette |
| Canvas (centre) | fluid | Large free-positioning dotted canvas |
| Configuration (right) | ~280px | Selected block settings, then Flow Overview card |
| Top bar (above canvas) | full width of the builder | Title, subtitle, Undo, Redo, Save Draft, Publish, More |

Desktop targets: 1440px, 1280px, 1024px. At 1024px the Flow Elements pane may narrow to icon + label and the configuration pane may scroll; no horizontal page overflow.

Not part of this design: a mobile builder. Automation stays desktop/admin-first.

### 1.1 Top bar
- Left: title **WhatsApp Automation Builder**, subtitle **Create and manage automation flows for your WhatsApp leads**.
- Right, in order: Undo (icon), Redo (icon), **Save Draft** (outlined), **Publish** (solid primary green), More (kebab menu).
- Flow state, shown next to the title or in the overview: `Draft`, `Saved`, `Published · Not live`, plus an `Unsaved changes` indicator when the working copy differs from the last save.
- **Publish never shows an Active state.** Its result is `Published · Not live`. No control in this phase starts execution.
- More menu: Fit to screen, Duplicate block, Delete block, Validation issues.

### 1.2 Flow Elements (left palette)
Four groups, each with a small coloured header icon, in this order: **Triggers**, **Messages**, **Actions**, **Logic**.

- Triggers: New Message, Keyword Trigger, Meta Lead, Button Clicked, List Selection, Conversation Start.
- Messages: Send Text, Send Image, Send Video, Send Audio (Voice), Send Document, Send Template.
- Actions: Ask Question, Buttons, List Message, Save to CRM, Update Stage, Assign Staff, Add Tag, Create Follow-up, Notify Team, End Flow.
- Logic: Condition, Branch, Delay / Wait, Jump to Step.

Each item is a compact row: icon tile (category colour), label, grip on hover. Each row is a drag source and a click-to-add target. A search field sits at the top of the pane.

## 2. Canvas

### 2.1 Background and navigation
- Light background with a dotted grid. Grid spacing matches the existing `Background` (dots, 20px).
- Zoom in, zoom out, fit to screen (bottom-left control stack, as in the reference).
- Pan by dragging empty canvas or with space + drag.
- Snap to a 10px grid.

### 2.2 Node cards
Every node is a rounded rectangle card (radius ~12px), white fill, 1px subtle border, soft shadow on hover. Structure from top to bottom:

1. Icon tile (category colour) + small uppercase category label (e.g. `MESSAGES`) + block title.
2. Content preview: 1–3 lines (message text, media name, question, keyword list, field, stage, staff, wait time).
3. Optional inline list of choices (question options, button labels), each with its own output dot.
4. Input handle on the left edge (absent on triggers).
5. Output handle(s) on the right edge, one per port. Multi-output nodes show a labelled row per port.

Category colours (use existing tokens; the reference palette is a guide):

| Category | Tone |
|---|---|
| Trigger | primary green (`--color-primary`) |
| Message | success green/teal (`--color-success`) |
| Action | gold/amber (`--color-gold`) |
| Logic | neutral (`--color-muted-foreground`) |
| Question / Ask | the reference's purple reads as "question"; map to a violet token if one exists, otherwise use the Action tone with a question icon |
| Danger / end | danger (`--color-danger`) for End Flow and "No Match" pills |

Selected node: a 2px primary ring with an offset. Node with a validation problem: a danger border plus a small `!` badge in the top-right corner. Drop target while dragging: a dashed primary outline on the canvas.

### 2.3 Connections
- Smooth orthogonal (smoothstep) edges, 1.75px stroke, arrowhead at the target.
- Branch edges carry a pill label at their midpoint: `Yes (Match)` green, `No Match` red, `Yes` / `No` for conditions, the port label for buttons and paths.
- Connections are selectable. Selecting a connection and pressing Delete removes it.
- A connection can be dragged from an output dot and re-attached to another input (reconnect).
- One connection per output port. Dropping a second connection on a used port is refused.

### 2.4 Interaction
- Drag from the palette and drop onto the canvas: the node appears where dropped, selected, with the configuration panel opening on the right.
- Move a node by dragging its header. Undo covers one drag as one step.
- Click a node: select. Click empty canvas: clear selection.
- Delete / Backspace: removes the selected node or connection. The keyword trigger cannot be deleted.
- Ctrl/Cmd+D: duplicate the selected node, offset by 40px. Connections are not copied.
- Ctrl/Cmd+Z: undo. Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: redo. Typing in a field is not captured.
- Empty canvas state: a centred hint, "Drag a block from the left, or click one to add it." The keyword trigger is always present on a new flow.

## 3. Configuration panel (right)

Header: category icon, the block's type name (e.g. `Keyword Trigger`), close control. The panel changes by selected block type. Every panel starts with **Block Name** and ends with the outputs section.

Outputs section (all multi-output blocks): one row per output, showing the port label and its connected destination ("→ Welcome Message") or `Not connected` in warning colour. This is the design's way of showing "Next step if matched" and similar.

Per-type fields, mapped to the current data model:

| Block | Fields | Current model |
|---|---|---|
| Keyword Trigger | Block name; Keywords (chips, add, remove); Match type (Contains any keyword / Exact / Starts with); Case sensitive toggle; Next step (if matched); Next step (if not matched); info note | `keywords`, `matchType`, `caseSensitive`; ports `matched`, `not_matched`. Reference wording "Contains any keyword" maps to `contains`. |
| Send Text | Message text; character count | `text` |
| Send Image / Send Video | Media selector (library, with upload); Caption; Next | `mediaAssetId`, `mediaName`, `caption` (image and video only exist in the library today) |
| Send Audio (Voice) / Send Document | File selector (placeholder list until a library exists); Caption (document); Next | `mediaName`, `caption` |
| Send Template | Template selector (placeholder list); Next | `templateName` |
| Ask Question | Question text; Answer type (Text, Number, Phone, Choice); Required toggle; Retry limit (None, up to 1–3); Output: Valid answer, Fallback | `text`, `answerType`, `required`, `retryLimit`; ports `next`, `fallback` |
| Buttons | Message text; Button labels (max 3, add/remove); Output per button | `text`, `buttons`; one port per button |
| List Message | Message text; List button label; Options (max 10); Output per option | `text`, `listTitle`, `items` |
| Save to CRM | CRM field (select); Value source (Customer's reply / Fixed value); Fixed value (when fixed) | `fieldKey`, `valueSource`, `fixedValue` |
| Update Stage | Stage selector (the eight pipeline stages) | `stage` |
| Assign Staff | Staff selector (assignable staff list). **Assignment mode (auto / manual / by workload) is design-only** — not in the data model. | `staffId` only |
| Add Tag | Tag text | `tag` |
| Create Follow-up | Title; Due in (hours) | `followUpTitle`, `followUpDueHours` |
| Notify Team | Notification message | `text` |
| Condition | Check (Customer reply or a lead field); Operator (Equals, Contains, Is empty, Is not empty); Value (hidden for empty checks); outputs Yes and No | `conditionField`, `conditionOperator`, `conditionValue`; ports `yes`, `no` |
| Branch | Path labels (2 to 5); one output per path | `branchPaths` |
| Delay / Wait | Duration; Unit (Minutes, Hours, Days); Next | `delayAmount`, `delayUnit` |
| Jump to Step | Target step (select of other blocks) | `jumpTargetId` |
| End Flow | Note that nothing can follow | — |
| Create/Update Lead | Note only (existing action) | `create_or_link_lead` |

Design-only fields, shown in the reference but **not in the data model** — do not build without approval: the Save to CRM "source" and "campaign/ad (auto)" mappings, the Assign Staff "assignment mode", and the Flow Overview "Created by" value (see §5).

Validation messages appear inside the panel, under a "Needs attention" block, using the block's own name. Example: "Send Video: choose a media file."

## 4. Top bar states

| State | Display |
|---|---|
| Never saved | `Draft` pill, no unsaved note |
| Saved draft | `Saved` pill, `All changes saved` |
| Edited since save | `Unsaved changes` (amber) next to the pill |
| Published (stamped, not live) | `Published · Not live` (green-tinted pill) |
| Live (existing row, read-only) | `Live` pill, editing disabled, banner: "This flow is live. Changes can't be saved here." |

Publish with issues: the button stays enabled. Clicking it opens the Validation issues tray and shows "Fix N issues before publishing." No request is sent.

## 5. Flow Overview card

Placement: bottom of the right column (as in the reference), or a strip above the canvas when the panel is collapsed.

| Field | Source | If unavailable |
|---|---|---|
| Flow name | `automations.name` (editable in the top bar) | Service name |
| Status | Draft / Saved / Published · Not live / Live (see §4) | — |
| Total steps | count of blocks in the graph | — |
| Last updated | `automations.updated_at` | "Never saved" |
| Created by | No column exists | "Not recorded" |

The reference shows `Status: Active` and `Created By: AFIT Admin`. Do not copy `Active` for a builder flow; it appears only for an existing live row. `Created by` is shown as "Not recorded" until a column is approved.

## 6. Visual style

- Light background for the canvas (`--color-background`); white cards; subtle `--color-border`; rounded corners (cards 12px, pills full).
- Dark green app sidebar as in the existing shell.
- Typography: Inter (existing `--font-brand`). Block title 14px semibold; preview 12px muted; category label 10px uppercase tracking.
- Icons: one consistent stroke set (existing inline SVG pattern).
- Compact but readable: 32px icon tiles, 8px vertical rhythm inside cards.
- Minimal animation. Respect reduced motion.
- Avoid: default blue palettes, cream/beige backgrounds, accent stripes under titles, generic component-library styling. The reference's bright category colours are a guide; keep them muted enough for the AFIT dark-green chrome.

## 7. Drag and drop (mandatory flow)

Palette → drag block → drop on canvas → node appears (selected) → move node → connect to another node → select node → configure in the right panel.

The whole flow must be buildable without code. The example in §8 must be buildable end to end.

## 8. Example flow (design and demo only)

Taken from the reference. It must not run against real leads, and it must not be saved as an active automation.

```
New WhatsApp Message (trigger)
  ↓
Keyword Match (contains: gypsum plastering, gypsum, plaster, rate, quotation)
  ├─ Yes (Match) → Welcome Message → Send Video → Ask Question (project type)
  │    → Send Image → Ask Question (area) → Ask Question (location)
  │    → Ask Question (start timing) → Send Document → Ask Question (quotation)
  │    → Save to CRM → Update Stage: Qualified → Assign Staff
  │    → Send Confirmation → Create Follow-up → End Flow
  └─ No Match (red) → Default Reply
```

Notes on the example, against the current model:
- "Keyword Match" is the keyword trigger's `matched` port. "No Match" is `not_matched`.
- The "Question" blocks are `ask_question`. Their option chips are design-only until a Choice answer type is configured with options; the current model stores only the answer type.
- "Confirmation" is a Send Text block.
- Save to CRM "From answer" / "Auto" values are design-only. The current model writes a customer's reply or a fixed value.

## 9. Responsive scope

- Primary: 1440px, 1280px, 1024px.
- The builder is not converted to a mobile builder. Below 1024px, show a notice that the flow builder is designed for desktop, with the flow list still accessible.
- No horizontal page overflow at any target width.

## 10. Navigation and out-of-scope items

- Keep the existing approved nav items (Dashboard, Leads, Deals, Site Visits, Quotations, Follow-ups, Conversations, Reports, Automation (admin), Audit Log (admin), Settings (admin)).
- **Do not add** Broadcast, Templates, Media Library or Contacts from the reference. They are not in the approved navigation, and CLAUDE.md lists unconfirmed modules that must not start without approval.
- Do not add AI, natural-language understanding, or any execution control.

## 11. Data safety (design rule)

The design must remain independent of current lead data. The builder UI never:
- creates, updates or deletes leads;
- changes conversations, messages, follow-ups, assignments, stages, tags, Meta attribution or audit history;
- triggers, activates or executes an automation, or sends a WhatsApp message.

Save Draft writes only the automation's own draft graph. Publish stamps the graph's publish metadata and does not change status. Both are existing behaviour and are preserved.

## 12. Acceptance checklist

- [ ] Layout matches the reference: palette left, dotted canvas centre, configuration right, top bar with Undo, Redo, Save Draft, Publish, More.
- [ ] All palette groups and blocks listed in §1.2, each draggable and click-to-add.
- [ ] Nodes are cards with icon, type, title, preview, input and output handles.
- [ ] Branch labels: `Yes (Match)`, `No Match`, `Yes` / `No` for conditions.
- [ ] Configuration panel changes per block type, using the fields in §3.
- [ ] Zoom in, zoom out, fit, pan, dotted grid.
- [ ] Undo, redo, duplicate, delete, reconnect, select.
- [ ] Top-bar states per §4. No "Active" state for builder flows.
- [ ] Flow Overview shows the five fields in §5, with "Not recorded" for creator.
- [ ] No design-only field is saved to the database.
- [ ] Desktop at 1440, 1280 and 1024 with no horizontal overflow.
- [ ] No Broadcast, Templates, Media Library or Contacts navigation added.
