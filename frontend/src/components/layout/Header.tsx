import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "خانه" },
  { to: "/search", label: "جستجو" },
  { to: "/browse", label: "مرور" },
  { to: "/exercise", label: "تمرین" },
  { to: "/challenge", label: "چالش روزانه" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2 text-xl font-extrabold text-brand-600">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
            هم
          </span>
          هم‌واژه
        </NavLink>

        <nav className="hidden items-center gap-1 overflow-x-auto sm:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition sm:px-4 ${
                  isActive
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
