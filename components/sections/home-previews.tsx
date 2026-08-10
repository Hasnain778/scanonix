import type { ReactNode } from "react";
import {
  Check,
  FileText,
  Globe,
  Layers,
  Shield,
  Sparkles,
} from "lucide-react";

function PreviewChrome({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`home-preview-window overflow-hidden rounded-2xl bg-[#0a0a0a]/95 shadow-premium-lg ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3 sm:px-5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 truncate text-center font-mono text-[10px] tracking-wide text-scanonix-muted sm:text-[11px]">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

export function DashboardPreview() {
  return (
    <PreviewChrome title="scanonix.com/dashboard" className="home-preview-float">
      <div className="flex min-h-[280px] sm:min-h-[320px]">
        <aside className="hidden w-[72px] shrink-0 flex-col gap-2 border-r border-white/6 bg-black/30 p-3 sm:flex">
          <div className="h-8 w-8 rounded-lg bg-scanonix-orange/20" />
          <div className="mt-2 space-y-2">
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-4/5 rounded bg-white/6" />
            <div className="h-2 w-full rounded bg-scanonix-orange/25" />
            <div className="h-2 w-3/5 rounded bg-white/6" />
          </div>
        </aside>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-scanonix-muted">
                Workspace
              </p>
              <p className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Good morning
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-scanonix-orange/15">
              <Shield className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-emerald-500/8 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-xs text-scanonix-muted">Security status</p>
                <p className="text-sm font-semibold text-emerald-300">Protected</p>
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <FileText className="h-4 w-4 text-scanonix-orange/80" strokeWidth={1.5} />
              <p className="mt-2 text-xs text-scanonix-muted">Documents</p>
              <p className="text-lg font-semibold text-white">12</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <Globe className="h-4 w-4 text-scanonix-orange/80" strokeWidth={1.5} />
              <p className="mt-2 text-xs text-scanonix-muted">Scans</p>
              <p className="text-lg font-semibold text-white">47</p>
            </div>
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}

export function PdfToolPreview() {
  return (
    <PreviewChrome title="scanonix.com/tools/merge-pdf">
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-scanonix-muted">
            Merge PDF
          </p>
          <p className="mt-1 text-base font-semibold text-white">Combine documents</p>
        </div>

        <div className="space-y-2">
          {["Contract-v2.pdf", "Appendix-A.pdf", "Summary.pdf"].map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5"
            >
              <Layers className="h-4 w-4 shrink-0 text-scanonix-orange/80" strokeWidth={1.5} />
              <span className="truncate text-sm text-white/90">{name}</span>
              <span className="ml-auto font-mono text-[10px] text-scanonix-muted">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-white/6 pt-4">
          <span className="text-xs text-scanonix-muted">3 files · 4.2 MB</span>
          <span className="rounded-lg bg-scanonix-orange px-3 py-1.5 text-xs font-semibold text-white">
            Merge
          </span>
        </div>
      </div>
    </PreviewChrome>
  );
}

export function AiSummaryPreview() {
  return (
    <PreviewChrome title="scanonix.com/tools/ai-summary">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-white">AI Document Summary</p>
        </div>

        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-scanonix-muted">
            Source
          </p>
          <p className="mt-1 truncate text-sm text-white/80">Quarterly-Report-2026.pdf</p>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full rounded bg-white/8" />
          <div className="h-2 w-[92%] rounded bg-white/8" />
          <div className="h-2 w-[78%] rounded bg-white/8" />
          <div className="h-2 w-[85%] rounded bg-scanonix-orange/20" />
          <div className="h-2 w-[65%] rounded bg-white/6" />
        </div>

        <p className="text-sm leading-relaxed text-scanonix-muted">
          Revenue increased 18% quarter-over-quarter. Key risks identified in supply chain
          section…
        </p>
      </div>
    </PreviewChrome>
  );
}

export function ImageConverterPreview() {
  return (
    <PreviewChrome title="scanonix.com/tools/image">
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-scanonix-muted">
            Before
          </p>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-neutral-700 to-neutral-900">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,106,0,0.15)_0%,transparent_60%)]" />
          </div>
          <p className="mt-2 text-xs text-scanonix-muted">photo.heic · 3.1 MB</p>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-scanonix-muted">
            After
          </p>
          <div className="relative aspect-square overflow-hidden rounded-lg checkerboard-soft">
            <div className="absolute inset-4 rounded-md bg-gradient-to-br from-scanonix-orange/30 to-transparent" />
          </div>
          <p className="mt-2 text-xs text-emerald-400/90">Background removed · PNG</p>
        </div>
      </div>
    </PreviewChrome>
  );
}

export function SecurityScanPreview() {
  return (
    <PreviewChrome title="scanonix.com/tools/security-scan">
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-sm text-scanonix-muted">example.com</p>
          <p className="text-base font-semibold text-white">Security Scan</p>
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-scanonix-muted">Progress</span>
            <span className="text-white">100%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-scanonix-orange to-emerald-400" />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 px-4 py-3">
          <Shield className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
          <div>
            <p className="text-xs text-scanonix-muted">Result</p>
            <p className="text-sm font-semibold text-emerald-300">No threats detected</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-white/6 pt-3">
          {[
            { label: "Malware", ok: true },
            { label: "Phishing", ok: true },
            { label: "SSL certificate", ok: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-scanonix-muted">{item.label}</span>
              <span className="text-emerald-400">Clear</span>
            </div>
          ))}
        </div>
      </div>
    </PreviewChrome>
  );
}
