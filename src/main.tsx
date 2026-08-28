import { createRoot } from "react-dom/client";
import "./index.css";
import { LogtoProvider } from "@logto/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { logtoConfig } from "./cloud/authConfig";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { TooltipProvider } from "./components/ui/tooltip";
import { AppSessionProvider } from "./contexts/AppSessionContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { handleVitePreloadError } from "./lib/staleDeploymentRecovery";

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

// A tab left open across a deployment can still reference chunks that the new
// deployment no longer serves. Vite exposes those failures before React can
// render an error boundary, so recover with one data-preserving fresh reload.
window.addEventListener("vite:preloadError", handleVitePreloadError);

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <ErrorBoundary>
    <LogtoProvider config={logtoConfig}>
      <AppSessionProvider>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider delayDuration={200}>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AppSessionProvider>
    </LogtoProvider>
  </ErrorBoundary>
  // </StrictMode>
);
