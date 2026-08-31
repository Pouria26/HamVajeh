import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  // Extra bottom padding on mobile so the fixed BottomNav never covers the
  // last bit of page content; sm+ removes it since the bar is hidden there.
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10 sm:pb-10">{children}</div>
  );
}
