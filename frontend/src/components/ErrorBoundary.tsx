import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-4xl">😵</div>
          <h1 className="text-xl font-bold text-ink-900">مشکلی در برنامه پیش آمد</h1>
          <p className="max-w-sm text-ink-500">
            لطفاً صفحه را رفرش کنید. اگر مشکل ادامه داشت، به تیم پشتیبانی اطلاع دهید.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white transition hover:bg-brand-600"
          >
            رفرش صفحه
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
