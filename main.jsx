import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initFirebaseSync } from "./storageSync.js";

const root = createRoot(document.getElementById("root"));

// ─── Tela de carregamento enquanto sincroniza com Firebase ────────────────────
root.render(
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#F2E9DC",
      fontFamily: "'Outfit', system-ui, sans-serif",
      gap: 14,
    }}
  >
    <div style={{ fontSize: 40 }}>🏥</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: "#A8722A" }}>
      CRM Dra. Ilza Ezequiel
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: "#B8967A",
        marginTop: 4,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#A8722A",
          display: "inline-block",
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      />
      Sincronizando dados...
    </div>
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: .4; transform: scale(.7); }
      }
    `}</style>
  </div>
);

// ─── Inicializar sincronização → depois renderizar o CRM ─────────────────────
initFirebaseSync()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((err) => {
    console.error("[CRM] Erro na inicialização:", err);
    // Em caso de erro grave, renderiza o app mesmo assim (com dados locais)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
