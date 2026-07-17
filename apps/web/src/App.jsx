import React, { useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AccountPage from './pages/AccountPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ApiDocsPage from './pages/ApiDocsPage';
import LegalPage from './pages/LegalPage';
import SupportPage from './pages/SupportPage';
import FAQPage from './pages/FAQPage';
import HelpPage from './pages/HelpPage';
import ArticlePage from './pages/ArticlePage';
import StatusPage from './pages/StatusPage';
import { OnboardingProvider } from './context/OnboardingContext';
import OnboardingModal from './components/onboarding/OnboardingModal';
import { initAnalytics, trackPageView } from '@/lib/analytics';
import { initSentry, addBreadcrumb, captureException, setSentryUser } from '@/lib/sentry';
import pocketbaseClient from '@/lib/pocketbaseClient';

function AnalyticsTracker() {
    const location = useLocation();
    useEffect(() => {
        initAnalytics();
    }, []);
    useEffect(() => {
        trackPageView(location.pathname + location.search);
        addBreadcrumb(`navigate:${location.pathname}`, 'navigation', {
            path: location.pathname,
            search: location.search,
        });
    }, [location]);
    return null;
}

function App() {
    useEffect(() => {
        // Sentry init + global capture wiring — safe no-op without VITE_SENTRY_DSN.
        initSentry();

        // Track the authenticated PocketBase user as Sentry user context, if any.
        const syncUser = () => {
            const model = pocketbaseClient?.authStore?.model;
            setSentryUser(
                model
                    ? { id: model.id, email: model.email, name: model.name }
                    : null
            );
        };
        syncUser();
        const unsubscribe = pocketbaseClient?.authStore?.onChange?.(syncUser);

        // Capture unhandled exceptions and network/promise rejections.
        const onError = (event) => {
            captureException(event.error || event.message, { type: 'window.onerror' });
        };
        const onRejection = (event) => {
            captureException(event.reason, { type: 'unhandledrejection' });
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    return (
        <Router>
            <ScrollToTop />
            <AnalyticsTracker />
            <Toaster position="top-right" theme="dark" richColors closeButton />
            <AuthProvider>
            <OnboardingProvider>
                <OnboardingModal />
                <ErrorBoundary name="routes">
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                        <Route path="/api-docs" element={<ApiDocsPage />} />
                        <Route path="/legal/:doc" element={<LegalPage />} />
                        <Route path="/support" element={<SupportPage />} />
                        <Route path="/faq" element={<FAQPage />} />
                        <Route path="/help" element={<HelpPage />} />
                        <Route path="/help/:articleId" element={<ArticlePage />} />
                        <Route path="/status" element={<StatusPage />} />
                    </Routes>
                </ErrorBoundary>
            </OnboardingProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
