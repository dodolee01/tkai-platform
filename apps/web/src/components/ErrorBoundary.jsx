import React from 'react';
import { captureException } from '@/lib/sentry';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Surface to the console so the runtime journal captures it.
        console.error('App crashed:', error, info?.componentStack);
        // Forward React component errors to Sentry (no-op without a DSN).
        captureException(error, {
            componentStack: info?.componentStack,
            boundary: this.props.name || 'root',
        });
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen grid-bg flex items-center justify-center p-6">
                    <div className="glass rounded-2xl max-w-md w-full p-8 text-center">
                        <h1 className="font-display text-xl font-semibold text-foreground mb-2">
                            Bir şeyler ters gitti
                        </h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            Beklenmeyen bir hata oluştu. Bu sorun otomatik olarak kaydedildi. Sayfayı yeniden yükleyin veya devam etmeyi deneyin.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={this.handleReset}
                                className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition hover:opacity-90"
                            >
                                Tekrar Dene
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                            >
                                Yeniden Yükle
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
