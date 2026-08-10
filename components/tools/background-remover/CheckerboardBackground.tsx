import type { ReactNode } from "react";

export function CheckerboardBackground({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] bg-[image:linear-gradient(45deg,#3a3a3a_25%,transparent_25%),linear-gradient(-45deg,#3a3a3a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3a3a3a_75%),linear-gradient(-45deg,transparent_75%,#3a3a3a_75%)] bg-[#2a2a2a] ${className}`}
    >
      {children}
    </div>
  );
}
