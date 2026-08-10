import { PlayStoreLink } from "@/components/marketing/PlayStoreLink";

export function HomeAndroidPromo() {
  return (
    <section
      id="android-app"
      className="border-t border-white/8 py-14 sm:py-16"
      aria-labelledby="android-app-heading"
    >
      <div className="page-container">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-8 text-center sm:px-10 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-wider text-scanonix-orange/90">
            Scanonix for Android
          </p>
          <h2
            id="android-app-heading"
            className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            Scan documents anywhere
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-scanonix-muted sm:text-base">
            Scan documents, create PDFs, and use Scanonix tools directly from your Android device.
          </p>
          <PlayStoreLink
            location="promo-section"
            variant="badge"
            className="mt-8 inline-flex transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-sm"
          />
        </div>
      </div>
    </section>
  );
}
