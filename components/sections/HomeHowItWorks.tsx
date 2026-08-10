import { ArrowRight, Download, MousePointerClick, Upload } from "lucide-react";
import {
  PdfToolPreview,
  SecurityScanPreview,
} from "@/components/sections/home-previews";
import { HomeScrollFade } from "@/components/ui/HomeScrollFade";

const STEPS = [
  {
    number: "01",
    icon: MousePointerClick,
    title: "Choose a tool",
    description: "Browse PDF, image, AI, and security tools from one directory.",
    preview: "directory" as const,
  },
  {
    number: "02",
    icon: Upload,
    title: "Upload or enter your content",
    description: "Add files, paste text, or enter a URL — no complicated setup.",
    preview: "pdf" as const,
  },
  {
    number: "03",
    icon: Download,
    title: "Process and download results",
    description: "Get converted files, summaries, or scan reports in seconds.",
    preview: "security" as const,
  },
] as const;

function ToolPickerMock() {
  const items = ["Merge PDF", "AI Summary", "Background Remover", "Website Scanner"];

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0a0a0a]/95 p-4 shadow-premium">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-scanonix-muted">
        scanonix.com/tools
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={item}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${
              index === 0
                ? "border border-scanonix-orange/30 bg-scanonix-orange/10 text-white"
                : "bg-white/[0.03] text-white/70"
            }`}
          >
            <span>{item}</span>
            {index === 0 ? (
              <ArrowRight className="h-3.5 w-3.5 text-scanonix-orange" strokeWidth={1.5} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepPreview({ step }: { step: (typeof STEPS)[number] }) {
  if (step.preview === "directory") {
    return <ToolPickerMock />;
  }
  if (step.preview === "pdf") {
    return <PdfToolPreview />;
  }
  return <SecurityScanPreview />;
}

export function HomeHowItWorks() {
  return (
    <section id="how-it-works" className="relative overflow-x-clip py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden="true"
      />

      <div className="page-container">
        <HomeScrollFade>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-base leading-relaxed text-scanonix-muted">
              Three steps from input to finished result.
            </p>
          </div>
        </HomeScrollFade>

        <div className="mt-14 space-y-16 sm:mt-20 lg:space-y-24">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const reversed = index % 2 === 1;

            return (
              <HomeScrollFade key={step.number} delay={index * 60}>
                <div
                  className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                    reversed ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs tracking-[0.2em] text-scanonix-orange">
                        {step.number}
                      </span>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                        <Icon className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-white sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-scanonix-muted">
                      {step.description}
                    </p>
                  </div>

                  <div className="home-how-preview">
                    <StepPreview step={step} />
                  </div>
                </div>
              </HomeScrollFade>
            );
          })}
        </div>
      </div>
    </section>
  );
}
