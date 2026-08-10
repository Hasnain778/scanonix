import Image from "next/image";
import { Code, CreditCard, Database, Layers, Terminal } from "lucide-react";
import { HomeScrollFade } from "@/components/ui/HomeScrollFade";

const TECH_STACK = [
  {
    id: "flutter",
    name: "Flutter",
    line: "Built with Flutter",
    icon: Layers,
    logo: null,
  },
  {
    id: "cursor",
    name: "Cursor",
    line: "Developed using Cursor",
    icon: Terminal,
    logo: null,
  },
  {
    id: "nextjs",
    name: "Next.js",
    line: "Powered by Next.js",
    icon: Code,
    logo: "/next.svg",
  },
  {
    id: "supabase",
    name: "Supabase",
    line: "Connected with Supabase",
    icon: Database,
    logo: null,
  },
  {
    id: "stripe",
    name: "Stripe",
    line: "Payments secured by Stripe",
    icon: CreditCard,
    logo: null,
  },
] as const;

export function HomeTechStrip() {
  return (
    <section id="technology" className="relative overflow-x-clip py-16 sm:py-20 md:py-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden="true"
      />

      <div className="page-container">
        <HomeScrollFade>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Built with modern technology
            </h2>
          </div>
        </HomeScrollFade>

        <HomeScrollFade delay={60}>
          <div className="home-tech-flow mt-10 overflow-x-auto sm:mt-12">
            <ul className="flex min-w-max items-stretch gap-3 px-1 sm:min-w-0 sm:flex-wrap sm:justify-center">
              {TECH_STACK.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    className="home-tech-item flex w-[11.5rem] shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 text-center sm:w-[12.5rem]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
                      {item.logo ? (
                        <Image
                          src={item.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 brightness-0 invert"
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon
                          className="h-6 w-6 text-white"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-2 text-xs leading-snug text-scanonix-muted">{item.line}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-scanonix-muted/75">
            All product names and trademarks belong to their respective owners.
          </p>
        </HomeScrollFade>
      </div>
    </section>
  );
}
