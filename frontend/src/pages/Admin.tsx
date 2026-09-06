import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  addAdminExampleOption,
  clearAdminToken,
  clearAllNeedsReview,
  createAdminCollocation,
  deleteAdminCollocation,
  deleteAdminExample,
  deleteAdminExampleOption,
  downloadAdminCsvExport,
  getAdminCollocation,
  getAdminToken,
  listAdminCollocations,
  reorderAdminExamples,
  setAdminToken,
  updateAdminCollocation,
  updateAdminExample,
} from "../api/admin";
import { deleteAdminReport, listAdminReports, updateAdminReportStatus } from "../api/reports";
import { buildBlankSentence } from "../lib/blankSentence";
import { ApiError } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState, ErrorState } from "../components/ui/States";
import type {
  AdminCollocationSummary,
  AdminCollocationFull,
  AdminExample,
  AdminReport,
  NewCollocationPayload,
} from "../types";

const PAGE_SIZE = 50;

export function Admin() {
  const [authState, setAuthState] = useState<"checking" | "locked" | "unlocked">("checking");

  useEffect(() => {
    const existing = getAdminToken();
    if (!existing) {
      setAuthState("locked");
      return;
    }
    // Validate the stored token with a cheap request before showing the panel.
    listAdminCollocations({ limit: 1 })
      .then(() => setAuthState("unlocked"))
      .catch(() => {
        clearAdminToken();
        setAuthState("locked");
      });
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-6 w-6 text-brand-500" />
      </div>
    );
  }

  if (authState === "locked") {
    return <LoginGate onUnlocked={() => setAuthState("unlocked")} />;
  }

  return <AdminPanel onLocked={() => setAuthState("locked")} />;
}

// ---------------------------------------------------------------------------
// Login gate — deliberately generic wording; nothing here hints at what's
// behind it. Anyone landing on /admin without the shared token just sees
// this and nothing else.
// ---------------------------------------------------------------------------
function LoginGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setChecking(true);
    setError(null);
    setAdminToken(value.trim());
    try {
      await listAdminCollocations({ limit: 1 });
      onUnlocked();
    } catch {
      clearAdminToken();
      setError("دسترسی نامعتبر است.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex justify-center py-24">
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="کد دسترسی"
          className="admin-input text-center"
        />
        {error && <p className="text-center text-xs text-danger-500">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {checking ? "در حال بررسی…" : "ورود"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level tab switcher between the dataset curation panel and the incoming
// user-reports queue. Kept as a thin wrapper so each panel's large amount of
// local state stays independent and simple.
// ---------------------------------------------------------------------------
function AdminPanel({ onLocked }: { onLocked: () => void }) {
  const [tab, setTab] = useState<"dataset" | "reports">("dataset");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      listAdminReports({ status: "pending", limit: 1 })
        .then((res) => {
          if (!cancelled) setPendingCount(res.pending);
        })
        .catch(() => {
          /* ignore */
        });
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-ink-100 bg-white p-1.5">
        <button
          onClick={() => setTab("dataset")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            tab === "dataset" ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50"
          }`}
        >
          🗂️ مدیریت دیتاست
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            tab === "reports" ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50"
          }`}
        >
          🚩 گزارش‌های کاربران
          {!!pendingCount && (
            <span
              className={`mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                tab === "reports" ? "bg-white/25 text-white" : "bg-danger-500 text-white"
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === "dataset" ? (
        <DatasetPanel onLocked={onLocked} />
      ) : (
        <ReportsPanel onLocked={onLocked} onPendingChange={setPendingCount} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The actual dataset curation panel, only reachable after LoginGate succeeds.
// ---------------------------------------------------------------------------
function DatasetPanel({ onLocked }: { onLocked: () => void }) {
  // --- list state -----------------------------------------------------
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<"" | "valid" | "corrected" | "needs_review">("");
  const [results, setResults] = useState<AdminCollocationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [needsReviewTotal, setNeedsReviewTotal] = useState(0);
  const [bulkClearing, setBulkClearing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [listStatus, setListStatus] = useState<"loading" | "error" | "done">("loading");

  // --- detail / edit state ---------------------------------------------
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collocation, setCollocation] = useState<AdminCollocationFull | null>(null);
  const [examples, setExamples] = useState<AdminExample[]>([]);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --- create-new state --------------------------------------------------
  const [showCreateForm, setShowCreateForm] = useState(false);

  // --- CSV export state ---------------------------------------------------
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // If the token stops working mid-session (revoked / server restarted with
  // a different value), drop back to the login gate instead of spamming errors.
  const handleAuthError = (err: unknown): boolean => {
    if (err instanceof ApiError && err.status === 401) {
      clearAdminToken();
      onLocked();
      return true;
    }
    return false;
  };

  const loadList = async (nextOffset: number) => {
    setListStatus("loading");
    try {
      const res = await listAdminCollocations({
        search: debouncedSearch,
        status: statusFilter === "needs_review" ? "" : statusFilter,
        needsReviewOnly: statusFilter === "needs_review",
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setResults((prev) => (nextOffset === 0 ? res.results : [...prev, ...res.results]));
      setTotal(res.total);
      setNeedsReviewTotal(res.needsReviewTotal);
      setOffset(nextOffset);
      setListStatus("done");
    } catch (err) {
      if (handleAuthError(err)) return;
      setListStatus("error");
    }
  };

  useEffect(() => {
    loadList(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  const openItem = async (id: number) => {
    setShowCreateForm(false);
    setSelectedId(id);
    setDetailStatus("loading");
    setMessage(null);
    try {
      const res = await getAdminCollocation(id);
      setCollocation(res.collocation);
      setExamples(res.examples);
      setDetailStatus("done");
    } catch (err) {
      if (handleAuthError(err)) return;
      setDetailStatus("error");
    }
  };

  const refreshListRow = (updated: Partial<AdminCollocationSummary> & { id: number }) => {
    setResults((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };

  // Quick actions for the list rows — clear the "مشکوک" flag or delete a
  // row directly from the list, without opening the full edit panel. Lets
  // the admin power through a big "مشکوک" queue (e.g. right after an import)
  // much faster than open → edit → save for each one.
  const quickClearNeedsReview = async (id: number) => {
    try {
      await updateAdminCollocation(id, { needs_review: false });
      setNeedsReviewTotal((n) => Math.max(0, n - 1));
      if (statusFilter === "needs_review") {
        setResults((prev) => prev.filter((r) => r.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        refreshListRow({ id, needs_review: false });
      }
      if (collocation?.id === id) setCollocation({ ...collocation, needs_review: false });
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در بروزرسانی علامت.");
    }
  };

  const quickDelete = async (id: number, label: string) => {
    if (!window.confirm(`«${label}» برای همیشه حذف شود؟`)) return;
    try {
      await deleteAdminCollocation(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setNeedsReviewTotal((n) => Math.max(0, n - (results.find((r) => r.id === id)?.needs_review ? 1 : 0)));
      if (selectedId === id) {
        setSelectedId(null);
        setCollocation(null);
        setDetailStatus("idle");
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در حذف.");
    }
  };

  const bulkClearNeedsReview = async () => {
    if (needsReviewTotal === 0) return;
    if (!window.confirm(`علامت «مشکوک» از تمام ${needsReviewTotal} مورد پاک شود؟ این کار قابل بازگشت نیست.`)) return;
    setBulkClearing(true);
    try {
      const res = await clearAllNeedsReview();
      setNeedsReviewTotal(0);
      if (statusFilter === "needs_review") {
        setResults([]);
        setTotal(0);
      } else {
        setResults((prev) => prev.map((r) => ({ ...r, needs_review: false })));
      }
      if (collocation) setCollocation({ ...collocation, needs_review: false });
      setMessage(`علامت «مشکوک» از ${res.cleared} مورد پاک شد.`);
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در پاک‌کردن انبوه.");
    } finally {
      setBulkClearing(false);
    }
  };

  const saveCollocation = async () => {
    if (!collocation) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateAdminCollocation(collocation.id, {
        word1: collocation.word1,
        word2: collocation.word2,
        display_form: collocation.display_form,
        pos_pattern: collocation.pos_pattern,
        status: collocation.status,
        minmax_score: collocation.minmax_score ?? undefined,
        needs_review: collocation.needs_review,
        correction_note: collocation.correction_note,
      });
      refreshListRow({
        id: collocation.id,
        word1: collocation.word1,
        word2: collocation.word2,
        display_form: collocation.display_form,
        pos_pattern: collocation.pos_pattern,
        status: collocation.status,
        minmax_score: collocation.minmax_score,
        needs_review: collocation.needs_review,
        correction_note: collocation.correction_note,
      });
      const refreshed = await getAdminCollocation(collocation.id);
      setCollocation(refreshed.collocation);
      setMessage("ذخیره شد.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در ذخیره‌سازی.");
    } finally {
      setSaving(false);
    }
  };

  const removeCollocation = async () => {
    if (!collocation) return;
    if (
      !window.confirm(
        `آیا از حذف کامل «${collocation.display_form}» مطمئن هستید؟ این کار همه‌ی جمله‌های نمونه‌ی آن را نیز حذف می‌کند.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await deleteAdminCollocation(collocation.id);
      setResults((prev) => prev.filter((r) => r.id !== collocation.id));
      setTotal((t) => Math.max(0, t - 1));
      setSelectedId(null);
      setCollocation(null);
      setExamples([]);
      setDetailStatus("idle");
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در حذف.");
    } finally {
      setSaving(false);
    }
  };

  const updateExampleField = (id: number, field: keyof AdminExample, value: string) => {
    setExamples((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const updateOptionField = (exampleId: number, optionId: number, text: string) => {
    setExamples((prev) =>
      prev.map((e) =>
        e.id !== exampleId
          ? e
          : { ...e, options: e.options.map((o) => (o.id === optionId ? { ...o, option_text: text } : o)) }
      )
    );
  };

  const setCorrectOption = (exampleId: number, optionId: number) => {
    setExamples((prev) =>
      prev.map((e) =>
        e.id !== exampleId
          ? e
          : { ...e, options: e.options.map((o) => ({ ...o, is_correct: o.id === optionId })) }
      )
    );
  };

  // Auto-build the blank sentence from the full sentence + the correct
  // answer already typed in, so the admin doesn't have to hand-type
  // underscores (and every blank stays the same fixed length).
  const autoBuildBlank = (example: AdminExample) => {
    const result = buildBlankSentence(example.sentence, example.target_phrase ?? "");
    if (!result.matched) {
      setMessage("متن پاسخ صحیح دقیقاً داخل جمله پیدا نشد — جای خالی به‌صورت خودکار ساخته نشد.");
      return;
    }
    updateExampleField(example.id, "blank_sentence", result.blankSentence);
  };

  const addOption = async (exampleId: number) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await addAdminExampleOption(exampleId, { option_text: "", is_correct: false });
      setExamples((prev) =>
        prev.map((e) => (e.id === exampleId ? { ...e, options: [...e.options, res.option] } : e))
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در افزودن گزینه.");
    } finally {
      setSaving(false);
    }
  };

  const removeOption = async (exampleId: number, optionId: number) => {
    setSaving(true);
    setMessage(null);
    try {
      await deleteAdminExampleOption(optionId);
      setExamples((prev) =>
        prev.map((e) => (e.id !== exampleId ? e : { ...e, options: e.options.filter((o) => o.id !== optionId) }))
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در حذف گزینه.");
    } finally {
      setSaving(false);
    }
  };

  const saveExample = async (example: AdminExample) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateAdminExample(example.id, {
        sentence: example.sentence,
        blank_sentence: example.blank_sentence,
        target_phrase: example.target_phrase,
        options: example.options.map((o) => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct })),
      });
      setExamples((prev) => prev.map((e) => (e.id === example.id ? res.example : e)));
      setMessage("جمله‌ی نمونه ذخیره شد.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در ذخیره‌ی جمله.");
    } finally {
      setSaving(false);
    }
  };

  const removeExample = async (exampleId: number) => {
    if (!window.confirm("این جمله‌ی نمونه حذف شود؟")) return;
    setSaving(true);
    try {
      await deleteAdminExample(exampleId);
      const remaining = examples.filter((e) => e.id !== exampleId);
      setExamples(remaining);
      if (collocation) {
        refreshListRow({ id: collocation.id, example_count: remaining.length });
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در حذف جمله.");
    } finally {
      setSaving(false);
    }
  };

  const moveExample = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= examples.length || !collocation) return;

    const reordered = [...examples];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setExamples(reordered);
    setSaving(true);
    try {
      const res = await reorderAdminExamples(collocation.id, reordered.map((e) => e.id));
      setExamples((prev) =>
        res.examples.map((fresh) => ({
          ...(prev.find((p) => p.id === fresh.id) ?? fresh),
          example_order: fresh.example_order,
        }))
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setMessage("خطا در تغییر ترتیب.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAdminCsvExport();
    } catch (err) {
      if (handleAuthError(err)) return;
      setExportError("خطا در دریافت خروجی CSV.");
    } finally {
      setExporting(false);
    }
  };

  const onCreated = (res: { collocation: AdminCollocationFull; examples: AdminExample[] }) => {
    const summary: AdminCollocationSummary = {
      id: res.collocation.id,
      pair_id: res.collocation.pair_id,
      word1: res.collocation.word1,
      word2: res.collocation.word2,
      display_form: res.collocation.display_form,
      pos_pattern: res.collocation.pos_pattern,
      status: res.collocation.status,
      correction_note: res.collocation.correction_note,
      minmax_score: res.collocation.minmax_score,
      needs_review: res.collocation.needs_review,
      example_count: res.examples.length,
    };
    setResults((prev) => [summary, ...prev]);
    setTotal((t) => t + 1);
    setShowCreateForm(false);
    setSelectedId(res.collocation.id);
    setCollocation(res.collocation);
    setExamples(res.examples);
    setDetailStatus("done");
    setMessage("باهم‌آیی جدید با موفقیت اضافه شد.");
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-ink-900">مدیریت دیتاست</h1>
          <p className="text-sm text-ink-500">
            ویرایش، حذف، تغییر ترتیب و افزودن باهم‌آیی — برای بالا بردن کیفیت دیتاست پیش از انتشار.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="rounded-full border border-ink-200 bg-white px-5 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-300 disabled:opacity-50"
            >
              {exporting ? "در حال آماده‌سازی…" : "⬇ دانلود CSV"}
            </button>
            <button
              onClick={() => {
                setShowCreateForm((v) => !v);
                if (!showCreateForm) {
                  setSelectedId(null);
                  setDetailStatus("idle");
                }
              }}
              className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              {showCreateForm ? "بستن فرم" : "+ افزودن باهم‌آیی جدید"}
            </button>
          </div>
          {exportError && <p className="text-xs text-danger-500">{exportError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* -------------------- List -------------------- */}
        <div>
          <div className="mb-3 flex flex-col gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در واژه یا شکل نمایشی…"
              className="admin-input"
            />
            <div className="flex flex-wrap gap-2">
              {(["", "valid", "corrected", "needs_review"] as const).map((s) => (
                <button
                  key={s || "all"}
                  onClick={() => setStatusFilter(s)}
                  className={`relative rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === s
                      ? s === "needs_review"
                        ? "border-warning-500 bg-warning-500 text-white"
                        : "border-brand-500 bg-brand-500 text-white"
                      : "border-ink-200 bg-white text-ink-600 hover:border-brand-300"
                  }`}
                >
                  {s === "" ? "همه" : s === "valid" ? "معتبر" : s === "corrected" ? "اصلاح‌شده" : "⚠ مشکوک"}
                  {s === "needs_review" && needsReviewTotal > 0 && (
                    <span
                      className={`mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        statusFilter === "needs_review" ? "bg-white/25 text-white" : "bg-warning-500 text-white"
                      }`}
                    >
                      {needsReviewTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-400">{total} مورد</p>
              {statusFilter === "needs_review" && needsReviewTotal > 0 && (
                <button
                  onClick={bulkClearNeedsReview}
                  disabled={bulkClearing}
                  className="rounded-full border border-warning-500 bg-warning-100 px-3 py-1 text-[11px] font-semibold text-warning-500 transition hover:bg-warning-500 hover:text-white disabled:opacity-50"
                >
                  {bulkClearing ? "در حال پاک‌کردن…" : "پاک‌کردن همه‌ی علامت‌ها"}
                </button>
              )}
            </div>
          </div>

          {listStatus === "error" && <ErrorState onRetry={() => loadList(0)} />}
          {listStatus === "done" && results.length === 0 && (
            <EmptyState
              icon={statusFilter === "needs_review" ? "🎉" : "🔍"}
              title={statusFilter === "needs_review" ? "هیچ موردی مشکوک نیست" : "چیزی یافت نشد"}
            />
          )}

          <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-ink-100 bg-white p-2">
            {results.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-1 rounded-xl transition ${
                  selectedId === r.id ? "bg-brand-100 text-brand-800" : "hover:bg-ink-50"
                }`}
              >
                <button
                  onClick={() => openItem(r.id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-right"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-ink-900">{r.display_form}</span>
                    <span className="text-xs text-ink-400">
                      #{r.id} · {r.pos_pattern ?? "—"} · {r.example_count} جمله
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      r.status === "valid" ? "bg-success-100 text-success-500" : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {r.status === "valid" ? "معتبر" : "اصلاح‌شده"}
                  </span>
                  {r.needs_review && (
                    <span
                      title="نیاز به بازبینی"
                      className="shrink-0 rounded-md bg-warning-100 px-2 py-0.5 text-[11px] font-medium text-warning-500"
                    >
                      ⚠ مشکوک
                    </span>
                  )}
                </button>

                {r.needs_review && (
                  <div className="flex shrink-0 items-center gap-0.5 pl-1.5">
                    <button
                      title="بررسی شد — پاک‌کردن علامت"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickClearNeedsReview(r.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-success-500 transition hover:bg-success-100"
                    >
                      ✓
                    </button>
                    <button
                      title="حذف"
                      onClick={(e) => {
                        e.stopPropagation();
                        quickDelete(r.id, r.display_form);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-danger-500 transition hover:bg-danger-100"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}
            {listStatus === "loading" && (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5 text-brand-500" />

              </div>
            )}
          </div>

          {results.length < total && listStatus !== "loading" && (
            <button
              onClick={() => loadList(offset + PAGE_SIZE)}
              className="mt-3 w-full rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:border-brand-300"
            >
              نمایش بیشتر ({results.length} از {total})
            </button>
          )}
        </div>

        {/* -------------------- Editor / Create -------------------- */}
        <div>
          {message && !showCreateForm && (
            <div className="mb-4 rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-700">{message}</div>
          )}

          {showCreateForm && (
            <CreateCollocationForm
              onCancel={() => setShowCreateForm(false)}
              onCreated={onCreated}
              onAuthError={() => {
                clearAdminToken();
                onLocked();
              }}
            />
          )}

          {!showCreateForm && detailStatus === "idle" && (
            <EmptyState icon="✏️" title="یک باهم‌آیی را از فهرست انتخاب کنید یا یک مورد جدید اضافه کنید" />
          )}
          {!showCreateForm && detailStatus === "loading" && (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 text-brand-500" />
            </div>
          )}
          {!showCreateForm && detailStatus === "error" && (
            <ErrorState onRetry={() => selectedId && openItem(selectedId)} />
          )}

          {!showCreateForm && detailStatus === "done" && collocation && (
            <div className="flex flex-col gap-6">
              {/* Core fields */}
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-ink-900">اطلاعات اصلی #{collocation.pair_id}</h2>
                  <button
                    onClick={removeCollocation}
                    disabled={saving}
                    className="rounded-full border border-danger-100 bg-danger-100/50 px-4 py-1.5 text-xs font-semibold text-danger-500 hover:bg-danger-100 disabled:opacity-50"
                  >
                    حذف کامل این باهم‌آیی
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="واژه‌ی اول">
                    <input
                      className="admin-input"
                      value={collocation.word1}
                      onChange={(e) => setCollocation({ ...collocation, word1: e.target.value })}
                    />
                  </Field>
                  <Field label="واژه‌ی دوم (اختیاری)">
                    <input
                      className="admin-input"
                      value={collocation.word2 ?? ""}
                      onChange={(e) => setCollocation({ ...collocation, word2: e.target.value || null })}
                    />
                  </Field>
                  <Field label="شکل نمایشی">
                    <input
                      className="admin-input"
                      value={collocation.display_form}
                      onChange={(e) => setCollocation({ ...collocation, display_form: e.target.value })}
                    />
                  </Field>
                  <Field label="الگوی نحوی">
                    <input
                      className="admin-input"
                      value={collocation.pos_pattern ?? ""}
                      onChange={(e) => setCollocation({ ...collocation, pos_pattern: e.target.value || null })}
                    />
                  </Field>
                  <Field label="وضعیت">
                    <select
                      className="admin-input"
                      value={collocation.status}
                      onChange={(e) =>
                        setCollocation({ ...collocation, status: e.target.value as "valid" | "corrected" })
                      }
                    >
                      <option value="valid">معتبر</option>
                      <option value="corrected">اصلاح‌شده</option>
                    </select>
                  </Field>
                  <Field label="امتیاز کیفیت (۰ تا ۱)">
                    <input
                      className="admin-input"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={collocation.minmax_score ?? ""}
                      onChange={(e) =>
                        setCollocation({
                          ...collocation,
                          minmax_score: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={collocation.needs_review}
                    onChange={(e) => setCollocation({ ...collocation, needs_review: e.target.checked })}
                  />
                  مشکوک است / نیاز به بازبینی دوباره دارد
                </label>
                <p className="mt-1 text-xs text-ink-400">
                  تغییر امتیاز کیفیت، معیارهای آماری دیگر (pmi، t_score، llr، logdice، combined_score) را هم
                  به‌صورت خودکار بازمحاسبه می‌کند تا در خروجی CSV هماهنگ بمانند.
                </p>

                <Field label="دلیل / یادداشت (اختیاری — برای مرجع خودتان یا ابزارهای دیگر مثل ایجنت)">
                  <textarea
                    className="admin-input"
                    rows={2}
                    value={collocation.correction_note ?? ""}
                    onChange={(e) =>
                      setCollocation({ ...collocation, correction_note: e.target.value || null })
                    }
                    placeholder="مثلاً: چرا این باهم‌آیی اصلاح شد یا چه نکته‌ای درباره‌اش مهم است…"
                  />
                </Field>

                <button
                  onClick={saveCollocation}
                  disabled={saving}
                  className="mt-4 rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving ? "در حال ذخیره…" : "ذخیره‌ی اطلاعات اصلی"}
                </button>
              </div>

              {/* Examples */}
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="mb-4 text-lg font-bold text-ink-900">جمله‌های نمونه ({examples.length})</h2>

                <div className="flex flex-col gap-4">
                  {examples.map((example, index) => (
                    <div key={example.id} className="rounded-xl border border-ink-100 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink-400">موقعیت {example.example_order}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => moveExample(index, -1)}
                            disabled={index === 0 || saving}
                            className="admin-icon-btn"
                            title="جابه‌جایی به بالا"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveExample(index, 1)}
                            disabled={index === examples.length - 1 || saving}
                            className="admin-icon-btn"
                            title="جابه‌جایی به پایین"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeExample(example.id)}
                            disabled={saving}
                            className="admin-icon-btn text-danger-500"
                            title="حذف این جمله"
                          >
                            حذف
                          </button>
                        </div>
                      </div>

                      <Field label="جمله‌ی کامل">
                        <textarea
                          className="admin-input"
                          rows={2}
                          value={example.sentence}
                          onChange={(e) => updateExampleField(example.id, "sentence", e.target.value)}
                        />
                      </Field>
                      <Field label="پاسخ صحیح (دقیقاً همان متنی که داخل جمله‌ی بالا آمده)">
                        <input
                          className="admin-input"
                          value={example.target_phrase ?? ""}
                          onChange={(e) => updateExampleField(example.id, "target_phrase", e.target.value)}
                        />
                      </Field>

                      <div className="mb-3 flex items-end gap-2 last:mb-0">
                        <div className="flex-1">
                          <Field label="جمله با جای خالی">
                            <textarea
                              className="admin-input"
                              rows={2}
                              value={example.blank_sentence ?? ""}
                              onChange={(e) => updateExampleField(example.id, "blank_sentence", e.target.value)}
                            />
                          </Field>
                        </div>
                        <button
                          type="button"
                          onClick={() => autoBuildBlank(example)}
                          className="admin-icon-btn mb-3 shrink-0"
                          title="جمله را از روی جمله‌ی کامل و پاسخ صحیح بساز"
                        >
                          ⚡ ساخت خودکار
                        </button>
                      </div>

                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-semibold text-ink-400">
                            گزینه‌های تمرین (گزینه‌ی درست را با دکمه‌ی رادیویی مشخص کنید)
                          </p>
                          <button
                            type="button"
                            onClick={() => addOption(example.id)}
                            disabled={saving}
                            className="admin-icon-btn"
                          >
                            + گزینه‌ی غلط
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {example.options.map((opt) => (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${example.id}`}
                                checked={opt.is_correct}
                                onChange={() => setCorrectOption(example.id, opt.id)}
                              />
                              <input
                                className="admin-input flex-1"
                                value={opt.option_text}
                                onChange={(e) => updateOptionField(example.id, opt.id, e.target.value)}
                                placeholder={opt.is_correct ? "گزینه‌ی درست" : "یک کلمه یا عبارت واقعی و معنادار"}
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(example.id, opt.id)}
                                disabled={saving}
                                className="admin-icon-btn shrink-0 text-danger-500"
                                title="حذف این گزینه"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {example.options.length === 0 && (
                            <p className="text-xs text-ink-400">هنوز هیچ گزینه‌ای اضافه نشده.</p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => saveExample(example)}
                        disabled={saving}
                        className="mt-3 rounded-full border border-brand-300 px-4 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                      >
                        ذخیره‌ی این جمله
                      </button>
                    </div>
                  ))}

                  {examples.length === 0 && (
                    <p className="text-sm text-ink-400">این باهم‌آیی هیچ جمله‌ی نمونه‌ای ندارد.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 flex flex-col gap-1 last:mb-0">
      <span className="text-xs font-medium text-ink-500">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Create-new-collocation form: word1/word2/display form/status/score plus up
// to 5 example sentences, each with up to 4 options and one marked correct.
// ---------------------------------------------------------------------------
interface DraftOption {
  key: string;
  text: string;
  correct: boolean;
}

interface DraftExample {
  key: string;
  sentence: string;
  blank_sentence: string;
  target_phrase: string;
  options: DraftOption[];
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function emptyOption(correct = false): DraftOption {
  return { key: makeKey(), text: "", correct };
}

function emptyExample(): DraftExample {
  return {
    key: makeKey(),
    sentence: "",
    blank_sentence: "",
    target_phrase: "",
    options: [emptyOption(true), emptyOption(), emptyOption()],
  };
}

function CreateCollocationForm({
  onCancel,
  onCreated,
  onAuthError,
}: {
  onCancel: () => void;
  onCreated: (res: { collocation: AdminCollocationFull; examples: AdminExample[] }) => void;
  onAuthError: () => void;
}) {
  const [word1, setWord1] = useState("");
  const [word2, setWord2] = useState("");
  const [displayForm, setDisplayForm] = useState("");
  const [displayFormTouched, setDisplayFormTouched] = useState(false);
  const [posPattern, setPosPattern] = useState("");
  const [status, setStatus] = useState<"valid" | "corrected">("valid");
  const [reason, setReason] = useState("");
  const [minmaxScore, setMinmaxScore] = useState("0.5");
  const [needsReview, setNeedsReview] = useState(false);
  const [examplesList, setExamplesList] = useState<DraftExample[]>([emptyExample()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest the display form from word1 + word2 until the person edits it directly.
  useEffect(() => {
    if (!displayFormTouched) {
      setDisplayForm([word1, word2].filter((w) => w.trim()).join(" "));
    }
  }, [word1, word2, displayFormTouched]);

  const updateExample = (key: string, patch: Partial<DraftExample>) => {
    setExamplesList((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const updateOption = (exampleKey: string, optionKey: string, text: string) => {
    setExamplesList((prev) =>
      prev.map((e) =>
        e.key !== exampleKey
          ? e
          : { ...e, options: e.options.map((o) => (o.key === optionKey ? { ...o, text } : o)) }
      )
    );
  };

  const setCorrect = (exampleKey: string, optionKey: string) => {
    setExamplesList((prev) =>
      prev.map((e) =>
        e.key !== exampleKey ? e : { ...e, options: e.options.map((o) => ({ ...o, correct: o.key === optionKey })) }
      )
    );
  };

  const addDraftOption = (exampleKey: string) => {
    setExamplesList((prev) =>
      prev.map((e) => {
        if (e.key !== exampleKey) return e;
        if (e.options.length >= 4) return e;
        return { ...e, options: [...e.options, emptyOption()] };
      })
    );
  };

  const removeDraftOption = (exampleKey: string, optionKey: string) => {
    setExamplesList((prev) =>
      prev.map((e) =>
        e.key !== exampleKey ? e : { ...e, options: e.options.filter((o) => o.key !== optionKey) }
      )
    );
  };

  const autoBuildDraftBlank = (exampleKey: string) => {
    const ex = examplesList.find((e) => e.key === exampleKey);
    if (!ex) return;
    const result = buildBlankSentence(ex.sentence, ex.target_phrase);
    if (!result.matched) {
      setError("متن پاسخ صحیح دقیقاً داخل جمله پیدا نشد — جای خالی به‌صورت خودکار ساخته نشد.");
      return;
    }
    setError(null);
    updateExample(exampleKey, { blank_sentence: result.blankSentence });
  };

  const addExample = () => {
    if (examplesList.length >= 5) return;
    setExamplesList((prev) => [...prev, emptyExample()]);
  };

  const removeExample = (key: string) => {
    setExamplesList((prev) => prev.filter((e) => e.key !== key));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!word1.trim()) {
      setError("واژه‌ی اول الزامی است.");
      return;
    }

    const cleanExamples = examplesList
      .filter((ex) => ex.sentence.trim())
      .map((ex) => ({
        sentence: ex.sentence.trim(),
        blank_sentence: ex.blank_sentence.trim() || null,
        target_phrase: ex.target_phrase.trim() || null,
        options: ex.options
          .filter((o) => o.text.trim())
          .map((o) => ({ option_text: o.text.trim(), is_correct: o.correct })),
      }));

    setSubmitting(true);
    try {
      const res = await createAdminCollocation({
        word1: word1.trim(),
        word2: word2.trim() || null,
        display_form: displayForm.trim() || undefined,
        pos_pattern: posPattern.trim() || null,
        correction_note: reason.trim() || null,
        status,
        minmax_score: minmaxScore.trim() ? Number(minmaxScore) : undefined,
        needs_review: needsReview,
        examples: cleanExamples,
      } satisfies NewCollocationPayload);
      onCreated(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onAuthError();
        return;
      }
      setError("خطا در ثبت باهم‌آیی جدید.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold text-ink-900">افزودن باهم‌آیی جدید</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="واژه‌ی اول *">
            <input className="admin-input" value={word1} onChange={(e) => setWord1(e.target.value)} required />
          </Field>
          <Field label="واژه‌ی دوم (اختیاری)">
            <input className="admin-input" value={word2} onChange={(e) => setWord2(e.target.value)} />
          </Field>
          <Field label="شکل نمایشی">
            <input
              className="admin-input"
              value={displayForm}
              onChange={(e) => {
                setDisplayFormTouched(true);
                setDisplayForm(e.target.value);
              }}
              placeholder="به‌طور خودکار از واژه‌ها ساخته می‌شود"
            />
          </Field>
          <Field label="الگوی نحوی (مثلاً NOUN+VERB)">
            <input className="admin-input" value={posPattern} onChange={(e) => setPosPattern(e.target.value)} />
          </Field>
          <Field label="وضعیت">
            <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as "valid" | "corrected")}>
              <option value="valid">معتبر</option>
              <option value="corrected">اصلاح‌شده</option>
            </select>
          </Field>
          <Field label="امتیاز کیفیت (۰ تا ۱)">
            <input
              className="admin-input"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={minmaxScore}
              onChange={(e) => setMinmaxScore(e.target.value)}
            />
          </Field>
        </div>

        <Field label="دلیل / یادداشت (اختیاری — برای مرجع خودتان یا ابزارهای دیگر مثل ایجنت)">
          <textarea
            className="admin-input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً: چرا این باهم‌آیی به‌صورت دستی اضافه شد یا چه نکته‌ای درباره‌اش مهم است…"
          />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
          مشکوک است / نیاز به بازبینی دوباره دارد
        </label>
        <p className="mt-2 text-xs text-ink-400">
          امتیاز کیفیت تعیین می‌کند این باهم‌آیی در کجاهای سایت (صفحه‌ی اصلی، مرور، مرتبط) نمایش داده شود؛ عدد
          بالاتر یعنی نمایش بیشتر. معیارهای آماری دیگر (pmi، t_score، llr، logdice، combined_score) نیازی به
          وارد کردن ندارند — به‌صورت خودکار بر اساس همین عدد ساخته می‌شوند.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">جمله‌های نمونه ({examplesList.length})</h2>
          <button
            type="button"
            onClick={addExample}
            disabled={examplesList.length >= 5}
            className="admin-icon-btn"
          >
            + جمله‌ی جدید
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {examplesList.map((ex, index) => (
            <div key={ex.key} className="rounded-xl border border-ink-100 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-400">جمله‌ی {index + 1}</span>
                {examplesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExample(ex.key)}
                    className="admin-icon-btn text-danger-500"
                  >
                    حذف
                  </button>
                )}
              </div>

              <Field label="جمله‌ی کامل">
                <textarea
                  className="admin-input"
                  rows={2}
                  value={ex.sentence}
                  onChange={(e) => updateExample(ex.key, { sentence: e.target.value })}
                  placeholder="مثال: او برای پاسخ به سؤالات معلم مورد تشویق قرار گرفت."
                />
              </Field>
              <Field label="پاسخ صحیح (دقیقاً همان متنی که داخل جمله‌ی بالا آمده)">
                <input
                  className="admin-input"
                  value={ex.target_phrase}
                  onChange={(e) => updateExample(ex.key, { target_phrase: e.target.value })}
                  placeholder="مثال: مورد تشویق قرار گرفت"
                />
              </Field>

              <div className="mb-3 flex items-end gap-2 last:mb-0">
                <div className="flex-1">
                  <Field label="جمله با جای خالی">
                    <textarea
                      className="admin-input"
                      rows={2}
                      value={ex.blank_sentence}
                      onChange={(e) => updateExample(ex.key, { blank_sentence: e.target.value })}
                      placeholder="مثال: او برای پاسخ به سؤالات معلم ___________."
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => autoBuildDraftBlank(ex.key)}
                  className="admin-icon-btn mb-3 shrink-0"
                  title="جمله را از روی جمله‌ی کامل و پاسخ صحیح بساز"
                >
                  ⚡ ساخت خودکار
                </button>
              </div>

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-400">
                    گزینه‌های تمرین (گزینه‌ی درست را با دکمه‌ی رادیویی مشخص کنید)
                  </p>
                  <button
                    type="button"
                    onClick={() => addDraftOption(ex.key)}
                    disabled={ex.options.length >= 4}
                    className="admin-icon-btn"
                  >
                    + گزینه‌ی غلط
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {ex.options.map((opt) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`new-correct-${ex.key}`}
                        checked={opt.correct}
                        onChange={() => setCorrect(ex.key, opt.key)}
                      />
                      <input
                        className="admin-input flex-1"
                        value={opt.text}
                        onChange={(e) => updateOption(ex.key, opt.key, e.target.value)}
                        placeholder={opt.correct ? "گزینه‌ی درست" : "یک کلمه یا عبارت واقعی و معنادار"}
                      />
                      {!opt.correct && (
                        <button
                          type="button"
                          onClick={() => removeDraftOption(ex.key, opt.key)}
                          className="admin-icon-btn shrink-0 text-danger-500"
                          title="حذف این گزینه"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? "در حال ثبت…" : "ثبت باهم‌آیی جدید"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-ink-200 bg-white px-6 py-2 text-sm font-medium text-ink-600 hover:border-brand-300"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Reports panel — moderation queue for "این باهم‌آیی/جمله اشتباه است" reports
// submitted by learners on the public site. Lets the admin filter by status,
// jump to the reported collocation, and mark reports resolved/dismissed.
// ---------------------------------------------------------------------------
const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_collocation: "باهم‌آیی طبیعی/درست نیست",
  wrong_sentence: "جمله‌ی نمونه غلط است",
  wrong_answer: "گزینه‌های تمرین اشتباه است",
  other: "چیز دیگری",
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار بررسی",
  resolved: "برطرف‌شده",
  dismissed: "رد شده",
};

function ReportsPanel({
  onLocked,
  onPendingChange,
}: {
  onLocked: () => void;
  onPendingChange: (n: number) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "resolved" | "dismissed">("pending");
  const [results, setResults] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleAuthError = (err: unknown): boolean => {
    if (err instanceof ApiError && err.status === 401) {
      clearAdminToken();
      onLocked();
      return true;
    }
    return false;
  };

  const load = async () => {
    setStatus("loading");
    try {
      const res = await listAdminReports({ status: statusFilter, limit: 100 });
      setResults(res.results);
      setTotal(res.total);
      onPendingChange(res.pending);
      setStatus("done");
    } catch (err) {
      if (handleAuthError(err)) return;
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const setReportStatus = async (id: number, newStatus: "pending" | "resolved" | "dismissed") => {
    setBusyId(id);
    try {
      await updateAdminReportStatus(id, newStatus);
      // Optimistically remove it from the current filtered view (unless we're
      // viewing "all", in which case just update its status in place).
      setResults((prev) =>
        statusFilter === ""
          ? prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
          : prev.filter((r) => r.id !== id)
      );
      setTotal((t) => (statusFilter === "" ? t : Math.max(0, t - 1)));
      listAdminReports({ status: "pending", limit: 1 })
        .then((res) => onPendingChange(res.pending))
        .catch(() => {});
    } catch (err) {
      if (handleAuthError(err)) return;
    } finally {
      setBusyId(null);
    }
  };

  const removeReport = async (id: number) => {
    if (!window.confirm("این گزارش برای همیشه حذف شود؟")) return;
    setBusyId(id);
    try {
      await deleteAdminReport(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      if (handleAuthError(err)) return;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-2 text-2xl font-bold text-ink-900">گزارش‌های کاربران</h1>
        <p className="text-sm text-ink-500">
          مواردی که کاربران به‌عنوان باهم‌آیی یا جمله‌ی اشتباه گزارش کرده‌اند.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["pending", "resolved", "dismissed", ""] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-ink-200 bg-white text-ink-600 hover:border-brand-300"
            }`}
          >
            {s === "" ? "همه" : REPORT_STATUS_LABELS[s]}
          </button>
        ))}
        <span className="mr-auto text-xs text-ink-400">{total} مورد</span>
      </div>

      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-brand-500" />
        </div>
      )}

      {status === "error" && <ErrorState onRetry={load} />}

      {status === "done" && results.length === 0 && (
        <EmptyState icon="🎉" title="گزارشی در این دسته نیست" />
      )}

      {status === "done" && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <a
                  href={`/collocation/${r.collocation_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-brand-700 hover:underline"
                >
                  {r.collocation_display_form}
                </a>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    r.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : r.status === "resolved"
                        ? "bg-success-100 text-success-700"
                        : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {REPORT_STATUS_LABELS[r.status]}
                </span>
              </div>

              <p className="mb-1 text-sm font-medium text-ink-700">
                {REPORT_REASON_LABELS[r.reason] ?? r.reason}
              </p>

              {r.example_sentence && (
                <p className="mb-2 rounded-lg bg-ink-50 p-2.5 text-sm leading-7 text-ink-600">
                  «{r.example_sentence}»
                </p>
              )}

              {r.comment && <p className="mb-2 text-sm text-ink-600">توضیح کاربر: {r.comment}</p>}

              <p className="mb-3 text-xs text-ink-400">
                {new Date(r.created_at).toLocaleString("fa-IR")}
              </p>

              <div className="flex flex-wrap gap-2">
                {r.status !== "resolved" && (
                  <button
                    onClick={() => setReportStatus(r.id, "resolved")}
                    disabled={busyId === r.id}
                    className="rounded-full bg-success-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-success-600 disabled:opacity-50"
                  >
                    ✓ برطرف شد
                  </button>
                )}
                {r.status !== "dismissed" && (
                  <button
                    onClick={() => setReportStatus(r.id, "dismissed")}
                    disabled={busyId === r.id}
                    className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-ink-300 disabled:opacity-50"
                  >
                    رد کردن
                  </button>
                )}
                {r.status !== "pending" && (
                  <button
                    onClick={() => setReportStatus(r.id, "pending")}
                    disabled={busyId === r.id}
                    className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-ink-300 disabled:opacity-50"
                  >
                    بازگرداندن به در انتظار
                  </button>
                )}
                <button
                  onClick={() => removeReport(r.id)}
                  disabled={busyId === r.id}
                  className="mr-auto rounded-full px-4 py-1.5 text-xs font-semibold text-danger-500 transition hover:bg-danger-50 disabled:opacity-50"
                >
                  حذف گزارش
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
