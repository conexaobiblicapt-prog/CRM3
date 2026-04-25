// ═══════════════════════════════════════════════════════════════
// storageSync.js — CRM Dra. Ilza Ezequiel  v3
// Upload automático quando Firebase está vazio
// ═══════════════════════════════════════════════════════════════
import { rtdb, ref, get, set, onValue, configured } from "./firebase.js";

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
  "portal_msgs_inbox",
  "portal_msgs_outbox",
  "portal_notificacoes",
  "crm_portal_sync_ts",
];

const FB_PATH = "crm_data";
let _initialLoadDone = false;
const _pendingWrites = new Set();
const _debounceTimers = {};
const _origSetItem = Storage.prototype.setItem;

function writeToFirebase(key, value) {
  if (!configured || !rtdb) return;
  clearTimeout(_debounceTimers[key]);
  _pendingWrites.add(key);
  _debounceTimers[key] = setTimeout(async () => {
    try {
      await set(ref(rtdb, `${FB_PATH}/${key}`), value);
      console.log("[CRM Sync] ✅ Salvo:", key.replace("crm_", "").replace("_v26", "").replace("_v25", ""));
    } catch (err) {
      console.warn("[CRM Sync] Falha ao salvar:", key, err.message);
    }
    setTimeout(() => _pendingWrites.delete(key), 3000);
  }, 800);
}

Storage.prototype.setItem = function (key, value) {
  _origSetItem.call(this, key, value);
  if (this === window.localStorage && _initialLoadDone && SYNC_KEYS.includes(key)) {
    writeToFirebase(key, value);
  }
};

// ─── Upload de todos os dados locais para o Firebase ──────────────────────────
async function uploadLocalToFirebase() {
  let uploaded = 0;
  for (const key of SYNC_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        await set(ref(rtdb, `${FB_PATH}/${key}`), value);
        console.log("[CRM Sync] ⬆️  Enviado:", key.replace("crm_", "").replace("_v26", "").replace("_v25", ""));
        uploaded++;
      } catch (err) {
        console.warn("[CRM Sync] Erro ao enviar:", key, err.message);
      }
    }
  }
  console.log(`[CRM Sync] ✅ Upload completo: ${uploaded} chaves enviadas ao Firebase`);
}

function showSyncToast() {
  if (document.getElementById("crm-sync-toast")) return;
  const el = document.createElement("div");
  el.id = "crm-sync-toast";
  el.innerHTML = `<div style="position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1C1108;color:#fff;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:16px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.45);font-family:'Outfit',system-ui,sans-serif;font-size:13px;font-weight:500;min-width:340px;max-width:90vw;border:1px solid rgba(168,114,42,.35);"><span style="font-size:18px">🔄</span><span style="flex:1;line-height:1.4">Dados atualizados em outro dispositivo</span><button onclick="window.location.reload()" style="background:linear-gradient(135deg,#A8722A,#C89C62);color:#fff;border:none;border-radius:9px;padding:8px 18px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit;white-space:nowrap;flex-shrink:0;">Recarregar</button><button onclick="document.getElementById('crm-sync-toast').remove()" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;">×</button></div>`;
  document.body.appendChild(el);
}

function setupRealtimeListener() {
  if (!rtdb) return;
  onValue(ref(rtdb, FB_PATH), (snapshot) => {
    const data = snapshot.val() || {};
    let changed = false;
    for (const key of SYNC_KEYS) {
      if (data[key] !== undefined && !_pendingWrites.has(key)) {
        if (localStorage.getItem(key) !== data[key]) { changed = true; break; }
      }
    }
    if (changed) showSyncToast();
  }, (err) => console.warn("[CRM Sync] Listener error:", err.message));
}

export async function initFirebaseSync() {
  if (!configured || !rtdb) {
    console.log("[CRM Sync] Firebase não ativo — apenas localStorage");
    _initialLoadDone = true;
    return;
  }
  try {
    console.log("[CRM Sync] Verificando Firebase...");
    const snapshot = await Promise.race([
      get(ref(rtdb, FB_PATH)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);

    const firebaseData = snapshot.val();

    if (!firebaseData) {
      // ─── Firebase vazio: sobe todos os dados locais ──────────────
      console.log("[CRM Sync] Firebase vazio — enviando dados locais...");
      await uploadLocalToFirebase();
    } else {
      // ─── Firebase tem dados: baixa para o localStorage ───────────
      let keysLoaded = 0;
      for (const key of SYNC_KEYS) {
        if (firebaseData[key] != null) {
          _origSetItem.call(localStorage, key, firebaseData[key]);
          keysLoaded++;
        }
      }
      console.log(`[CRM Sync] ✅ ${keysLoaded} registros baixados do Firebase`);
    }

    setupRealtimeListener();
  } catch (err) {
    console.warn("[CRM Sync] Erro:", err.message, "— usando dados locais");
  } finally {
    _initialLoadDone = true;
  }
}
