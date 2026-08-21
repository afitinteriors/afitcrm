// Only allow same-origin relative paths for post-login redirects.
// Rejects protocol-relative ("//host") and backslash ("/\host") forms —
// both pass a naive `startsWith("/")` check but browsers can resolve them
// to an external origin, which is what made the open redirect possible.
export function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path) return "/dashboard";
  if (!path.startsWith("/")) return "/dashboard";
  if (path.startsWith("//") || path.startsWith("/\\")) return "/dashboard";
  return path;
}
