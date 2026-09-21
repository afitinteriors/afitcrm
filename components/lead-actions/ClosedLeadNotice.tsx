// Shown for a Lost lead in place of the Close Lead form. Lost is terminal --
// setLeadStatus() refuses to move a Won/Lost lead back into the pipeline -- so
// this states that fact instead of pointing at a control that can't do it.
export function LostLeadNotice() {
  return (
    <p className="mt-3 text-xs text-muted-foreground" data-testid="lost-lead-notice">
      Lost is final and cannot be moved back into the pipeline.
    </p>
  );
}
