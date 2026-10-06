"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { MouseEvent, ReactNode } from "react";
import type { FlowIssue } from "@/lib/automations/builder-graph";

export type SavedStatus = "draft" | "saved" | "published";

const STATUS_LABEL: Record<SavedStatus, string> = {
  draft: "Draft",
  saved: "Saved",
  published: "Published · not live",
};

const STATUS_TONE: Record<SavedStatus, string> = {
  draft: "bg-secondary text-muted-foreground",
  saved: "bg-secondary text-foreground",
  published: "bg-success-soft text-success",
};

const ICON_BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40";

function FormSubmit({
  value,
  className,
  pendingLabel,
  disabled,
  onClick,
  children,
}: {
  value: "draft" | "publish";
  className: string;
  pendingLabel: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="mode" value={value} disabled={disabled || pending} onClick={onClick} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function BuilderToolbar({
  serviceName,
  flowName,
  onFlowNameChange,
  savedStatus,
  isDirty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFitToScreen,
  onDuplicate,
  onDeleteSelected,
  hasSelection,
  hasTriggerSelected,
  issueCount,
  onToggleIssues,
  onPublishBlocked,
  readOnly,
  saveError,
  publishNotice,
  lastUpdatedLabel,
  stepCount,
}: {
  serviceName: string;
  flowName: string;
  onFlowNameChange: (name: string) => void;
  savedStatus: SavedStatus;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitToScreen: () => void;
  onDuplicate: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  hasTriggerSelected: boolean;
  issueCount: number;
  onToggleIssues: () => void;
  onPublishBlocked: () => void;
  readOnly: boolean;
  saveError: string | null;
  publishNotice: string | null;
  lastUpdatedLabel: string;
  stepCount: number;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/automation/services" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Keyword Triggers
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <label className="sr-only" htmlFor="flow-name">
            Flow name
          </label>
          <input
            id="flow-name"
            name="flow_name"
            type="text"
            value={flowName}
            maxLength={80}
            onChange={(e) => onFlowNameChange(e.target.value)}
            disabled={readOnly}
            className="h-9 min-w-0 max-w-sm flex-1 rounded-md border border-transparent bg-transparent px-2 text-base font-semibold text-foreground hover:border-border focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
          />
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[savedStatus]}`}>
            {STATUS_LABEL[savedStatus]}
          </span>
          {isDirty ? (
            <span className="shrink-0 text-xs font-medium text-warning">Unsaved changes</span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">All changes saved</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUndo} disabled={!canUndo || readOnly} className={ICON_BUTTON} title="Undo (Ctrl+Z)" aria-label="Undo">
            ↶ Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo || readOnly} className={ICON_BUTTON} title="Redo (Ctrl+Y)" aria-label="Redo">
            ↷ Redo
          </button>

          <details className="relative">
            <summary className={`${ICON_BUTTON} cursor-pointer list-none`} aria-label="More actions">
              More ▾
            </summary>
            <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
              <MenuItem onClick={onFitToScreen}>Fit to screen</MenuItem>
              <MenuItem onClick={onDuplicate} disabled={!hasSelection || readOnly}>
                Duplicate block (Ctrl+D)
              </MenuItem>
              <MenuItem onClick={onDeleteSelected} disabled={!hasSelection || hasTriggerSelected || readOnly} danger>
                Delete block
              </MenuItem>
              <MenuItem onClick={onToggleIssues}>
                Validation issues{issueCount > 0 ? ` (${issueCount})` : ""}
              </MenuItem>
            </div>
          </details>

          <FormSubmit
            value="draft"
            disabled={readOnly}
            className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            pendingLabel="Saving…"
          >
            Save Draft
          </FormSubmit>
          <FormSubmit
            value="publish"
            disabled={readOnly}
            onClick={(e) => {
              // Client-side gate for feedback only; the server re-validates.
              if (issueCount > 0) {
                e.preventDefault();
                onPublishBlocked();
              }
            }}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            pendingLabel="Publishing…"
          >
            Publish
          </FormSubmit>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/70 bg-secondary/40 px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          Service: <span className="font-medium text-foreground">{serviceName}</span>
        </span>
        <span>
          Steps: <span className="font-medium text-foreground">{stepCount}</span>
        </span>
        <span>
          Last updated: <span className="font-medium text-foreground">{lastUpdatedLabel}</span>
        </span>
        <span>
          Created by: <span className="font-medium text-foreground">Not recorded</span>
        </span>
        <span>
          Status:{" "}
          <span className="font-medium text-foreground">
            {readOnly ? "Live (editing disabled here)" : "Not live -- nothing runs from this builder"}
          </span>
        </span>
        {readOnly && <span className="font-medium text-danger">This flow is live. Changes can&apos;t be saved here.</span>}
        {saveError && <span role="alert" className="font-medium text-danger">{saveError}</span>}
        {publishNotice && !saveError && <span role="status" className="font-medium text-warning">{publishNotice}</span>}
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
      }}
      disabled={disabled}
      className={`block w-full rounded-md px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-secondary ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function IssuesTray({
  issues,
  open,
  onToggle,
  onFocus,
}: {
  issues: FlowIssue[];
  open: boolean;
  onToggle: () => void;
  onFocus: (nodeId: string) => void;
}) {
  const ready = issues.length === 0;
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-card shadow-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${ready ? "bg-success" : "bg-danger"}`}
          />
          {ready ? "Ready to publish" : `${issues.length} ${issues.length === 1 ? "issue" : "issues"} to fix`}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && !ready && (
        <ul className="max-h-60 divide-y divide-border overflow-y-auto border-t border-border">
          {issues.map((issue, i) => (
            <li key={`${issue.code}-${issue.nodeId ?? "flow"}-${i}`}>
              <button
                type="button"
                disabled={!issue.nodeId}
                onClick={() => issue.nodeId && onFocus(issue.nodeId)}
                className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-secondary disabled:cursor-default disabled:hover:bg-transparent"
              >
                {issue.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
