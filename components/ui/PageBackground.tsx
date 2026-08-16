export function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#0a0908]" />
      <div className="noise-texture absolute inset-0" />
      <div className="absolute inset-0 grid-pattern opacity-40" />

      <div className="animate-gradient-shift absolute -left-[20%] top-[-10%] h-[600px] w-[600px] rounded-full bg-[#FF6A00]/12 blur-[120px]" />
      <div className="animate-orb-drift absolute -right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[#FF6A00]/8 blur-[100px]" />
      <div
        className="animate-orb-drift absolute bottom-[-10%] left-[30%] h-[400px] w-[400px] rounded-full bg-violet-600/6 blur-[100px]"
        style={{ animationDelay: "-8s" }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0908]" />
    </div>
  );
}
