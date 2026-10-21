import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unexpected UI error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#03060c] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#081020] border border-sky-600/60 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <h2 className="font-heading text-xl font-bold text-sky-300">
              Flight Deck Interface Error / Lỗi Hiển Thị
            </h2>
            <p className="text-xs text-slate-400 font-mono break-words">{this.state.errorMsg}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMsg: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 text-xs font-bold cursor-pointer hover:from-sky-400 hover:to-cyan-400 transition-colors"
            >
              Reset Flight Deck / Khôi phục giao diện
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </RootErrorBoundary>
);
