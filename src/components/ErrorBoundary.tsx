import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { handleFirestoreError } from '../firebase';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: string | null;
  isPermissionError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorInfo: null,
    isPermissionError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    let isPermissionError = false;
    let info = error.message;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error?.toLowerCase().includes('permission') || parsed.error?.toLowerCase().includes('insufficient')) {
        isPermissionError = true;
      }
    } catch {
      if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('insufficient')) {
        isPermissionError = true;
      }
    }

    return { hasError: true, errorInfo: info, isPermissionError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorInfo: null, isPermissionError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      let errorMessage = "Something went wrong. Please try again later.";
      let errorDetail = "";

      try {
        const parsed = JSON.parse(this.state.errorInfo || '{}');
        if (parsed.error) {
          errorMessage = parsed.isPermissionError ? "Permission Denied" : "Database Error";
          errorDetail = `${parsed.operationType?.toUpperCase()} on /${parsed.path || 'unknown'}`;
        }
      } catch {
        errorDetail = this.state.errorInfo || "";
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 rounded-3xl">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {this.state.isPermissionError ? "Access Restricted" : "System Error"}
              </h2>
              <p className="text-slate-500 font-medium">
                {this.state.isPermissionError 
                  ? "Your account doesn't have permissions to view this data. Please contact the administrator."
                  : errorMessage}
              </p>
              {errorDetail && (
                <div className="p-3 bg-slate-50 rounded-xl font-mono text-[10px] text-slate-400 break-all">
                  {errorDetail}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
            
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
              Animal Box • Secure Clinic System
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
