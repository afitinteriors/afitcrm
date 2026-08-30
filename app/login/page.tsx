import { LoginForm } from "@/components/LoginForm";
import { BuildingEmblem } from "@/components/BuildingEmblem";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1210] px-4 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Premium dark architectural mood via CSS only -- no photo asset exists,
          and generating one is out of scope, so this is a layered gradient +
          radial green glow + vignette instead. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(34,197,94,0.16), transparent 70%), radial-gradient(50% 40% at 85% 90%, rgba(22,163,74,0.12), transparent 70%), linear-gradient(180deg, #0f1a14 0%, #0b1210 55%, #08100d 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]"
      />

      <div className="relative flex w-full max-w-md flex-col items-center lg:max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center lg:mb-10">
          <BuildingEmblem className="h-14 w-14 lg:h-16 lg:w-16" />
          <div className="mt-3">
            <p className="text-3xl font-bold tracking-tight text-white lg:text-4xl">AFIT</p>
            <p className="text-sm font-medium tracking-wide text-slate-300 lg:text-base">
              Business OS
            </p>
          </div>
        </div>

        <div className="mb-6 text-center lg:mb-8">
          <h1 className="text-2xl font-semibold text-white lg:text-3xl">Welcome Back</h1>
          <p className="mt-1.5 text-sm text-slate-400 lg:text-base">Sign in to continue</p>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl lg:p-8">
          <LoginForm next={sanitizeRedirectPath(next)} />
        </div>
      </div>
    </div>
  );
}
