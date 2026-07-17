import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/context/ThemeContext';
import '@/index.css';
import initHeaderOptimizer from '@/lib/headerOptimizer';

// Keep the Cookie header tiny so Hostinger Horizons never returns
// "Request Header Fields Too Large" on API / WebSocket / event requests.
initHeaderOptimizer();

ReactDOM.createRoot(document.getElementById('root')).render(
	<ErrorBoundary>
		<ThemeProvider>
			<App />
		</ThemeProvider>
	</ErrorBoundary>
);
