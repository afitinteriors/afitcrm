import type { ReactNode } from "react";
import type { BuilderNodeType } from "@/lib/automations/builder-graph";

// One consistent stroke icon per block type. The project has no icon library,
// so these are drawn inline in the same 24px grid and stroke weight.
const PATHS: Record<BuilderNodeType, ReactNode> = {
  trigger: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  new_message: <path d="M4 5h16v11H9l-5 4z" />,
  meta_lead: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 110 8 4 4 0 010-8z" />,
  button_clicked: <><rect x="5" y="8" width="14" height="8" rx="3" /><path d="M9 12h.01M15 12h.01" /></>,
  list_selection: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  conversation_start: <path d="M4 6h16v9H10l-4 3v-3H4z" />,
  send_text: <path d="M4 6h16M4 11h16M4 16h10" />,
  send_image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></>,
  send_video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></>,
  send_audio: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  send_document: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>,
  send_template: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  ask_question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 2-2.5 2-2.5 4M12 17h.01" /></>,
  buttons: <><rect x="4" y="5" width="16" height="6" rx="2" /><rect x="4" y="13" width="16" height="6" rx="2" /></>,
  list_message: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  save_to_crm: <path d="M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />,
  update_stage: <path d="M5 21V4h11l-2 4 2 4H5" />,
  assign_staff: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" />,
  add_tag: <path d="M3 12V4h8l10 10-8 8L3 12zM7.5 8h.01" />,
  create_follow_up: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  notify_team: <path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4" />,
  create_or_link_lead: <path d="M12 5v14M5 12h14" />,
  end_flow: <rect x="7" y="7" width="10" height="10" rx="1" />,
  condition: <path d="M12 3l9 9-9 9-9-9z" />,
  branch: <path d="M6 3v18M6 12c0-4 12-2 12-7M6 18c0-3 12-2 12-6" />,
  delay: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  jump_to: <path d="M4 7h9a5 5 0 010 10H9M9 14l-3 3 3 3" />,
};

export function BuilderIcon({ type, className = "h-4 w-4" }: { type: BuilderNodeType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[type]}
    </svg>
  );
}
