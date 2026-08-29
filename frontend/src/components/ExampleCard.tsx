export function ExampleCard({ sentence, index }: { sentence: string; index: number }) {
  return (
    <li className="animate-fade-in-up flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-4 leading-8">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
        {index}
      </span>
      <p className="flex-1 text-ink-800">{sentence}</p>
    </li>
  );
}
