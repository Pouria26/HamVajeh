import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "خانه", icon: "🏠" },
  { to: "/search", label: "جستجو", icon: "🔎" },
  { to: "/browse", label: "مرور", icon: "🗂️" },
  { to: "/exercise", label: "تمرین", icon: "✍️" },
  { to: "/challenge", label: "چالش", icon: "🏆" },
];

// Mobile-only bottom tab bar (hidden on sm+ where the horizontal Header nav
// takes over). Fixed positioning means pages must reserve bottom space —
// handled globally via padding-bottom in PageContainer.
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-between px-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
                isActive ? "text-brand-600" : "text-ink-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-base transition ${
                    isActive ? "bg-brand-100" : ""
                  }`}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
