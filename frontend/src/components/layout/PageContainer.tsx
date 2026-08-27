import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</div>;
}
