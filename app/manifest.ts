import type { MetadataRoute } from "next";

// Installability only. Colors are the literal --chrome-900 / --brand-600
// values from app/globals.css (a manifest can't read CSS variables).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AFIT CRM",
    short_name: "AFIT CRM",
    description: "Lead management for AFIT Builders & Interiors",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#0b1210",
    theme_color: "#0b1210",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
