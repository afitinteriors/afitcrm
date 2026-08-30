import { Inter } from "next/font/google";

// Phase 0a (CLAUDE.md §2/§7): defines the brand font token only. Nothing
// imports this file yet -- app/layout.tsx still mounts only Geist
// (--font-geist-sans), which is what --font-sans / the live `font-sans`
// utility actually resolves to today. --font-inter below will stay unset
// at runtime until a later phase attaches `interSans.variable` to <html>,
// same as geistSans is attached now. Inter chosen over Poppins per CLAUDE.md
// §2's "Inter or Poppins" -- swap this one Google Fonts call if Poppins is
// preferred instead; nothing else in the token system needs to change.
export const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
