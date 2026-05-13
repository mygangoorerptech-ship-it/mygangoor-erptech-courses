// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import { Toaster } from "react-hot-toast";
import "./index.css";
import { GOOGLE_CLIENT_ID } from "./components/constants";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID!}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />

          <Toaster
            position="top-right"
            gutter={10}
            toastOptions={{
              duration: 3000,

              style: {
                borderRadius: "14px",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "14px",
                padding: "12px 14px",
              },

              success: {
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#fff",
                },
              },

              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
            }}
          />
        </QueryClientProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>
);
