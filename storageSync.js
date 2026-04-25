// ═══════════════════════════════════════════════════════════════
// storageSync.js — CRM Dra. Ilza Ezequiel  v5
// Usa REST API do Firebase (fetch puro) — sem WebSocket/SDK
// Inclui crm_saved_login para persistir sessão entre deploys
// ═══════════════════════════════════════════════════════════════

const FB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com/crm_data";

const SYNC_KEYS = [
  "crm_pats_v26",
  "crm_exames_v26",
  "crm_estoque_v26",
  "crm_consultas_v26",
  "crm_agenda_v26",
  "crm_fin_v26",
  "crm_fin_lancamentos_v26",
  "crm_mensal_v26",
  "crm_fila_v25",
  "crm_usuarios_v26",
  "crm_saved_login",          // ← login persistido entre deploys
  "portal_msgs_inbox",
  "portal_msgs_outbox",
  "portal_notificacoes",
  "crm_portal_sync_ts",
];

let _initialLoadDone = false;
const _debounceTimers = {};
const _origSetItem = Storage.prototype.setItem;

async function fbGet() {
  const res = await fetch(`${FB_URL}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fbSet(key, value) {
  const res = await fetch(`${FB_URL}/${key}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Polling a cada 15s para detectar mudanças de outros dispositivos
let _lastSnapshot = null;
function startPolling() {
  setInterval(async () => {
    try {
      const data = await fbGet();
      if (!data) return;
      const snap = JSON.stringify(data);
      if (_lastSnapshot && snap !== _lastSnapshot) {
        for (const key of SYNC_KEYS) {
          // Não sobrescreve crm_saved_login do polling (evita logout surpresa)
          if (key === "crm_saved_login") continue;
          if (data[key] != null) {
            _origSetItem.call(localStorage, key, data[key]);
          }
        }
        showSyncToast();
      }
      _lastSnapshot = snap;
    } catch (e) {
      // silencioso
    }
  }, 15000);
}

function writeToFirebase(key, value) {
  clearTimeout(_debounceTimers[key]);
  _debounceTimers[key] = setTimeout(async () => {
    try {
      await fbSet(key, value);
      console.log("[CRM Sync] ✅ Salvo:", key.replace("crm_", "").replace("_v26", "").replace("_v25", ""));
    } catch (err) {
      console.warn("[CRM Sync] Falha ao salvar:", key, err.message);
    }
  }, 800);
}

Storage.prototype.setItem = function (key, value) {
  _origSetItem.call(this, key, value);
  if (this === window.localStorage && _initialLoadDone && SYNC_KEYS.includes(key)) {
    writeToFirebase(key, value);
  }
};

function showSyncToast() {
  if (document.getElementById("crm-sync-toast")) return;
  const el = document.createElement("div");
  el.id = "crm-sync-toast";
  el.innerHTML = `<div style="position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1C1108;color:#fff;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:16px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.45);font-family:'Outfit',system-ui,sans-serif;font-size:13px;font-weight:500;min-width:340px;max-width:90vw;border:1px solid rgba(168,114,42,.35);"><span style="font-size:18px">🔄</span><span style="flex:1;line-height:1.4">Dados atualizados em outro dispositivo</span><button onclick="window.location.reload()" style="background:linear-gradient(135deg,#A8722A,#C89C62);color:#fff;border:none;border-radius:9px;padding:8px 18px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit;white-space:nowrap;flex-shrink:0;">Recarregar</button><button onclick="document.getElementById('crm-sync-toast').remove()" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;">×</button></div>`;
  document.body.appendChild(el);
}

export async function initFirebaseSync() {
  try {
    console.log("[CRM Sync] Conectando ao Firebase via REST...");
    const firebaseData = await fbGet();

    if (!firebaseData) {
      // Firebase vazio → sobe dados locais
      console.log("[CRM Sync] Firebase vazio — enviando dados locais...");
      let uploaded = 0;
      for (const key of SYNC_KEYS) {
        const value = localStorage.getItem(key);
        if (value) {
          await fbSet(key, value);
          console.log("[CRM Sync] ⬆️  Enviado:", key.replace("crm_", "").replace("_v26", "").replace("_v25", ""));
          uploaded++;
        }
      }
      console.log(`[CRM Sync] ✅ Upload completo: ${uploaded} chaves enviadas`);
      _lastSnapshot = JSON.stringify(
        Object.fromEntries(SYNC_KEYS.map(k => [k, localStorage.getItem(k)]).filter(([,v]) => v))
      );
    } else {
      // Firebase tem dados → baixa para localStorage
      let loaded = 0;
      for (const key of SYNC_KEYS) {
        if (firebaseData[key] != null) {
          _origSetItem.call(localStorage, key, firebaseData[key]);
          loaded++;
        }
      }
      console.log(`[CRM Sync] ✅ ${loaded} registros baixados do Firebase`);
      _lastSnapshot = JSON.stringify(firebaseData);
    }

    startPolling();
  } catch (err) {
    console.warn("[CRM Sync] Erro:", err.message, "— usando dados locais");
  } finally {
    _initialLoadDone = true;
  }
}
