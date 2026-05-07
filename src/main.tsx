import { createRoot } from "react-dom/client";
import "./index.css";
import { LogtoProvider } from "@logto/react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.tsx";
import { logtoConfig } from "./cloud/authConfig";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { TooltipProvider } from "./components/ui/tooltip";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Side-effect module: registers cross-store subscriptions at startup.
import "./stores/storeEffects.ts";

if (import.meta.env.VITE_E2E_FAKE_LOGTO === "1") {
  void import("./testing/e2e/browserHarness");
}

// Clean up cache-busting query param after error recovery reload
if (new URLSearchParams(window.location.search).has("_r")) {
  const url = new URL(window.location.href);
  url.searchParams.delete("_r");
  window.history.replaceState(null, "", url.toString());
}

// GitHub Pages has no URL rewriting — must use HashRouter.
// Cloudflare Pages (base="/") supports _redirects SPA fallback → use BrowserRouter.
const useHash = import.meta.env.BASE_URL !== "/";
const Router = useHash ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <ErrorBoundary>
    <LogtoProvider config={logtoConfig}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider delayDuration={200}>
            <Router basename={import.meta.env.BASE_URL}>
              <App />
            </Router>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </LogtoProvider>
  </ErrorBoundary>
  // </StrictMode>
);
