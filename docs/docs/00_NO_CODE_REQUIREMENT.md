# 00 — No-Code Requirement (read this first, it overrides ambiguity everywhere else)

**The owner is not a developer and will never touch code, a config file, a database table, or a redeploy to run this business day to day.** Every requirement in this document set that even hints at "edit a config" or "ask the developer" must instead be a screen in the app. This file is the governing principle — where any other doc is ambiguous about whether something is a code change or an app setting, this file wins: **it is an app setting.**

## What this means concretely

| If it changes... | It must be done from... | Never by... |
|---|---|---|
| A team member's access | Settings → Team, checkboxes | Editing a permissions file |
| A pipeline stage's name, time limit or auto-message | Settings → Pipeline Stages, a form | Editing the database or code |
| A follow-up timer (15 min, 1/3/7 days) | Settings → Automation Rules | A hard-coded constant |
| Which keywords mean "Gypsum" vs "Interior" | Settings → Service Keywords, an editable tag list | A code file |
| What the AI agent says, asks, or knows | Settings → AI Agent Training, an example-based interface (below) | Prompt engineering in code |
| What happens when a lead sits untouched | Settings → Automation Rules, a visual workflow builder (below) | A new backend function |
| Who gets the nightly report, and when | Settings → Reports | A cron file |
| A WhatsApp template's wording | Settings → Message Templates (submitted to Meta for approval from inside the app) | Pasting JSON into Meta's dashboard by hand |

If a feature in this spec cannot be built this way with the current plan, **say so explicitly in the phase report** rather than quietly shipping it as a code-only feature — the owner needs to know before the phase is accepted, not discover it later when they want to change something themselves.

## 1. Automation Rules — a visual, drag-and-drop workflow builder

Settings → Automation Rules is not a form with dropdowns bolted together — it is a **canvas-based workflow builder**, in the style of Zapier/n8n/Make, simplified for someone who has never used any of them:

- **Trigger block** (top of the canvas): a plain-language picker — "When a new lead comes in," "When a call is marked No Answer," "When a quotation is sent," "When nothing happens for X time." No code, no JSON.
- **Condition blocks** (optional, chained): plain-language if/then tiles — "If service = Gypsum," "If lead score = High," built from dropdowns of real field names and values the owner recognizes (service names, stage names, staff names), never raw database column names.
- **Action blocks**: a fixed palette the owner drags onto the canvas and connects with a line — "Send WhatsApp message," "Notify staff on Telegram," "Create a task," "Change stage," "Wait X minutes/hours/days." Each action block, once dropped, opens a simple panel to fill in its specific details (which message template, which staff member, how long to wait) — still no code.
- **Connecting blocks**: drag a line from one block's output to the next block's input, the same visual language as the reference tools above. The underlying execution is the Workflow Engine in `docs/12_AUTOMATION_RULES_ENGINE.md` — the canvas is the *only* way the owner interacts with it.
- **Test/preview**: a "Test with a sample lead" button that runs the workflow against a fake record and shows exactly what would happen, step by step, before it's turned on for real leads.
- **Enable/disable toggle** per workflow, and a plain-language execution history ("Ran 14 times today, 1 failed — tap to see why") — never a raw log file.
- The six workflows already defined in `docs/12_AUTOMATION_RULES_ENGINE.md` (Lead Intake, Qualification, Estimate/Quote, Replies/Objections, Won Conversion, Lost Recovery) ship as **pre-built templates** on this canvas — the owner can open any of them, see the blocks, and adjust timers/messages/conditions without starting from a blank canvas. Build the canvas first, then express those six workflows as templates on it — not the other way around (never hard-code the six workflows in a way the canvas can't also represent and edit).

## 2. AI agent — trained through examples, not prompts

Settings → AI Agent Training is a conversational, example-driven interface, not a code or prompt editor:

- **Service keywords**: an editable tag list per service ("Gypsum plastering recognizes: gypsum, jipsum, plastering, ജിപ്സം, ..." with an Add/Remove tag UI) — this is already specified as `service_keywords` in `docs/06`; the point here is the owner edits this list themselves from Settings, never by asking a developer to change a code array.
- **Example conversations**: the owner (or Azhar) can paste or type a real WhatsApp exchange and mark "this is a good example" or "this is what NOT to do" — the system uses these as few-shot examples/fine-tuning signal for the AI adapter, not as code.
- **Question set per service**: a simple ordered list builder — "What questions should the AI ask for a Gypsum enquiry?" with drag-to-reorder, add/remove — maps directly to the AI's qualifying-question flow (`docs/11_AI_SALES_AGENT.md`).
- **Reply tone toggle**: Malayalam / English / match-customer, formal/casual — simple switches, not prompt text to write.
- **Live test chat**: a sandbox chat window in Settings where the owner types as if they were a customer and sees exactly how the AI would respond, before anything goes live — the same idea as the "Test with a sample lead" button above, applied to the AI.
- **Approve/correct real replies**: in the WhatsApp Inbox screen itself, correcting an AI reply or re-tagging a wrongly-detected service (already in `docs/04`/`docs/11`) feeds back into training — the owner's day-to-day corrections *are* the training mechanism, no separate "retrain" step with code involved.

The underlying AI adapter (model calls, prompt construction) is still implementation detail the coding agent builds — but **the owner's entire interaction with "training" the AI happens through the screens above**, never by seeing or writing a prompt.

## 3. Team and permissions — already no-code, repeated here for emphasis

Already specified fully in `docs/03_ROLES_AND_PERMISSIONS.md`: add a member with name + mobile/email, tick permission checkboxes, deactivate with a toggle. No code change is ever required to add staff, change what they can see, or remove access. This file repeats it because it's the clearest example of the standard every other setting must meet.

## 4. What this means for the coding agent building the product

- Every "Settings" surface named in this doc set (Automation Rules, AI Agent Training, Team & Permissions, Pipeline Stages, Service Keywords, Message Templates, Reports) is a **required screen**, not an optional admin nicety to skip for later. Treat it as core product scope, with its own place in `docs/18_IMPLEMENTATION_PLAN.md`.
- Store rule/workflow/keyword/training definitions as **data** (rows in `automation_rules`, `service_keywords`, a new `ai_training_examples` table, etc. — `docs/06_DATABASE_SCHEMA.md`), never as code constants, so that changing them is a database write through the UI, not a deploy.
- The visual workflow builder's blocks map to the same allow-listed trigger/condition/action catalogue already specified in `docs/12_AUTOMATION_RULES_ENGINE.md` — this file does not loosen that safety boundary (still no arbitrary code/SQL from the canvas), it specifies *how the owner interacts with it*.
- When something genuinely cannot be made owner-editable in v1 (e.g. adding a brand-new trigger type the canvas doesn't yet support) it ships as a documented, owner-visible limitation with a plain-language explanation — never silently as "ask a developer."
