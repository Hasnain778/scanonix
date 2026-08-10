export function HomeBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#121212]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#121212]" />
      <div
        className="absolute -left-[10%] top-[-10%] h-[520px] w-[520px] rounded-full bg-[#FF6A00]/10 blur-[80px]"
        aria-hidden="true"
      />
      <div
        className="absolute -right-[8%] top-[20%] h-[420px] w-[420px] rounded-full bg-[#FF6A00]/6 blur-[70px]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#121212] via-[#121212] to-[#0a0a0a]" />
    </div>
  );
}
