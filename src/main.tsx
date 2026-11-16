import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'thira-sans';
import { ToastProvider, TooltipProvider } from 'thira-ui';
import 'thira-ui/styles.css';
import { App } from './App';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ToastProvider>
  </StrictMode>,
);
