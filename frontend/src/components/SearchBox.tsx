import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";

export function SearchBox({
  initialValue = "",
  onDebouncedChange,
  autoFocus = false,
  placeholder = "یک واژه‌ی فارسی بنویسید، مثلاً «تصمیم»…",
}: {
  initialValue?: string;
  onDebouncedChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const debounced = useDebounce(value, 350);

  useEffect(() => {
    onDebouncedChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-ink-400">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        dir="rtl"
        className="w-full rounded-2xl border border-ink-200 bg-white py-4 pl-4 pr-12 text-lg shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="پاک کردن"
          className="absolute inset-y-0 left-4 flex items-center text-ink-400 transition hover:text-ink-700"
        >
          ✕
        </button>
      )}
    </div>
  );
}
