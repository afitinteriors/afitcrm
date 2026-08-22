"use client";

import { useState } from "react";
import Link from "next/link";
import type { LeadRow } from "@/lib/supabase/types";
import { LeadDetailsContent } from "@/components/conversations/LeadDetailsContent";

export function MobileChatHeader({
  name,
  subtitle,
  lead,
}: {
  name: string;
  subtitle: string;
  lead: Pick<LeadRow, "id" | "customer_name" | "phone" | "status" | "location" | "service_required"> | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <Link
          href="/conversations"
          aria-label="Back to conversations"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
          {name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="View lead details"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close lead details"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Lead details</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <LeadDetailsContent lead={lead} />
          </div>
        </div>
      )}
    </>
  );
}
