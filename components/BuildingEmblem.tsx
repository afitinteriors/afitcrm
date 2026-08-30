// The AFIT mark, shared between the login screen and the app shell so the
// brand doesn't stop at the sign-in form. Colors are the literal brand-*
// tokens from app/globals.css, not restated hexes.
export function BuildingEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="30" width="10" height="28" rx="2" className="fill-brand-600" fillOpacity="0.55" />
      <rect x="19" y="18" width="12" height="40" rx="2" className="fill-brand-500" />
      <rect x="34" y="24" width="11" height="34" rx="2" className="fill-brand-600" fillOpacity="0.75" />
      <rect x="48" y="10" width="10" height="48" rx="2" className="fill-brand-400" />
    </svg>
  );
}
