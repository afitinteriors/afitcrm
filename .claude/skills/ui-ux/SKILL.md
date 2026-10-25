---
name: ui-ux
description: "AFIT CRM design-system and UI-first methodology - desktop/mobile product split, progressive disclosure, stage-aware Lead Detail. Use when designing or reviewing UI for this project. Distinct from the generic ui-ux-pro-max design-exploration tool; this skill is AFIT-specific and treats CLAUDE.md as authoritative."
---

# AFIT UI/UX

## When to use
Designing, reviewing, or reasoning about any AFIT CRM UI — before writing
backend/data code for a new feature, or when reviewing whether an
existing screen matches this project's design language.

## Design system
The token table (colors, gradients, font) lives in CLAUDE.md's UI/UX
Rules & Design System section — that's the source of truth; don't
re-derive or redefine tokens here. Effects: subtle glassmorphism, green
gradient primary actions, rounded corners, used sparingly (this is a CRM,
not a landing page). Avoid generic AI-slop patterns (accent stripes,
default-blue palettes, low-contrast icon-on-dark).

## UI-first approach
For new functionality: establish the user flow and desktop/mobile/
Admin-Staff behavior before any backend work — see
`.claude/rules/ui-first.md` for the exact sequence.

## Progressive disclosure
Don't show the whole system at once. The clearest existing example is
stage-aware Lead Detail: `lib/lead-stage-sections.ts`'s `STAGE_SECTIONS`
config renders only the sections relevant to a lead's *current* pipeline
stage (e.g. a brand-new lead never sees Commercial/negotiation UI; a Won
lead never sees the Won/Lost action form again). Apply the same
principle elsewhere: default to showing what matters *now*, expose the
rest behind an explicit action (a selector, an expand, a secondary menu)
rather than a permanent section.

## Desktop vs mobile
Two intentional surfaces sharing one data layer, not one UI shrunk to
fit — see `.claude/rules/desktop-mobile.md` and CLAUDE.md's Desktop vs
Mobile Navigation section for the current confirmed nav structure.

## Avoid
Information overload: don't add a section, card, or nav entry "just in
case" — every visible element should answer what the user needs *at this
point in this flow*. When in doubt, check what stage/role is actually
looking at the screen before deciding what renders.
