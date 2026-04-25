// ═══════════════════════════════════════════════════════════════
// storageSync.js — CRM Dra. Ilza Ezequiel
// Sincroniza localStorage ↔ Firebase Realtime Database
// Todos os dispositivos (celular, laptop, etc.) compartilham os mesmos dados
// ═══════════════════════════════════════════════════════════════
import { rtdb, ref, set, onValue, configured } from "./firebase.js";

// ─── Chaves do localStorage que devem ser sincronizadas ──────────────────────
const SYNC_KEYS = [
  "crm_pats_v26",         // Pacientes
  "crm_exames_v26",       // Exames
  "crm_estoque_v26",      // Estoque
  "crm_consultas_v26",    // Consultas
  "crm_agenda_v26",       // Agenda
  "crm_fin_v26",          // Financeiro
  "crm_fin_lancamentos_v26", // Lançamentos financeiros
  "crm_mensal_v26",       // Dados mensais dashboard
  "crm_fila_v25",         // Fila de espera telemedicina
  "crm_usuarios_v26",     // Usuários do sistema
  "portal_msgs_inbox",    // Mensagens recebidas do portal
  "portal_msgs_outbox",   // Mensagens enviadas do portal
  "portal_notificacoes",  // Notificações do portal
  "crm_portal_sync_ts",   // Timestamp de sincronização
];

// Caminho no Firebase Realtime Database
const FB_PATH = "crm_data";

// Controle de estado interno
let _initialLoadDone = false;
const _pendingWrites = new Set(); // Chaves que ESTE dispositivo acabou de escrever
const _debounceTimers = {};

// Referência ao método original (antes do patch)
const _origSetItem = Storage.prototype.setItem;

// ─── Escrever no Firebase com debounce (evita muitas requisições) ─────────────
function writeToFirebase(key, value) {
  if (!configured || !rtdb) return;

  clearTimeout(_debounceTimers[key]);

  // Marcar que este dispositivo está escrevendo
  _pendingWrites.add(key);

  _debounceTimers[key] = setTimeout(async () => {
    try {
      await set(ref(rtdb, `${FB_PATH}/${key}`), value);
    } catch (err) {
      console.warn("[CRM Sync] Falha ao salvar no Firebase:", key, err.message);
    }
    // Remover da lista de pending após 3 segundos (tempo para o onValue ecoar)
    setTimeout(() => _pendingWrites.delete(key), 3000);
  }, 800); // Espera 800ms após última alteração antes de salvar
}

// ─── Toast de notificação: dados alterados em outro dispositivo ───────────────
function showSyncToast() {
  if (document.getElementById("crm-sync-toast")) return; // Já está visível

  const container = document.createElement("div");
  container.id = "crm-sync-toast";
  container.innerHTML = `
    <div style="
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: #1C1108;
      color: #fff;
      border-radius: 14px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 99999;
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      min-width: 340px;
      max-width: 90vw;
      border: 1px solid rgba(168,114,42,.35);
      animation: slideUp .3s ease forwards;
    ">
      <span style="font-size:18px">🔄</span>
      <span style="flex:1; line-height:1.4">
        Dados atualizados em outro dispositivo
      </span>
      <button
        onclick="window.location.reload()"
        style="
          background: linear-gradient(135deg,#A8722A,#C89C62);
          color: #fff;
          border: none;
          border-radius: 9px;
          padding: 8px 18px;
          font-weight: 700;
          cursor: pointer;
          font-size: 12px;
          font-family: inherit;
          white-space: nowrap;
          flex-shrink: 0;
        "
      >Recarregar</button>
      <button
        onclick="document.getElementById('crm-sync-toast').remove()"
        style="
          background: none;
          border: none;
          color: rgba(255,255,255,.4);
          cursor: pointer;
          font-size: 18px;
          padding: 0 4px;
          line-height: 1;
        "
      >×</button>
    </div>
    <style>
      @keyframes slideUp {
        from { opacity:0; transform: translateX(-50%) translateY(16px); }
        to   { opacity:1; transform: translateX(-50%) translateY(0); }
      }
    </style>
  `;
  document.body.appendChild(container);
}

// ─── Patch no localStorage.setItem ───────────────────────────────────────────
// Intercepta todas as escritas do CRM e espelha no Firebase
Storage.prototype.setItem = function (key, value) {
  _origSetItem.call(this, key, value);
  if (this === window.localStorage && _initialLoadDone && SYNC_KEYS.includes(key)) {
    writeToFirebase(key, value);
  }
};

// ─── Função principal: inicializa a sincronização ────────────────────────────
export async function initFirebaseSync() {
  if (!configured || !rtdb) {
    console.log("[CRM Sync] Firebase não configurado — usando somente localStorage");
    _initialLoadDone = true;
    return;
  }

  return new Promise((resolve) => {
    let initialResolved = false;
    const dataRef = ref(rtdb, FB_PATH);

    // Listener do Firebase Realtime Database
    onValue(
      dataRef,
      (snapshot) => {
        const firebaseData = snapshot.val() || {};

        if (!initialResolved) {
          // ── CARGA INICIAL: Firebase → localStorage ──────────────────
          let keysLoaded = 0;
          for (const key of SYNC_KEYS) {
            if (firebaseData[key] !== undefined && firebaseData[key] !== null) {
              _origSetItem.call(localStorage, key, firebaseData[key]);
              keysLoaded++;
            }
          }
          console.log(`[CRM Sync] ✅ ${keysLoaded} chaves carregadas do Firebase`);
          _initialLoadDone = true;
          initialResolved = true;
          resolve();
        } else {
          // ── ATUALIZAÇÃO REMOTA: verificar se outro dispositivo alterou ──
          let hasRemoteChanges = false;
          for (const key of SYNC_KEYS) {
            if (
              firebaseData[key] !== undefined &&
              !_pendingWrites.has(key) // Não é uma escrita DESTE dispositivo
            ) {
              const localValue = localStorage.getItem(key);
              if (localValue !== firebaseData[key]) {
                hasRemoteChanges = true;
                break;
              }
            }
          }
          if (hasRemoteChanges) {
            showSyncToast();
          }
        }
      },
      (error) => {
        console.warn("[CRM Sync] Erro ao ler Firebase:", error.message);
        if (!initialResolved) {
          _initialLoadDone = true;
          initialResolved = true;
          resolve(); // Continua com dados locais em caso de erro
        }
      }
    );

    // Timeout de segurança: máximo 5 segundos esperando Firebase
    setTimeout(() => {
      if (!initialResolved) {
        console.warn("[CRM Sync] Timeout — usando dados locais");
        _initialLoadDone = true;
        initialResolved = true;
        resolve();
      }
    }, 5000);
  });
}
