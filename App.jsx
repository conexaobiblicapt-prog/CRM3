import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

// ─── Firebase (quando configurado via .env) ───────────────────────────────────
import {
  db, rtdb, auth, storage, configured as FB_CONFIGURED,
  collection, addDoc, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc,
  serverTimestamp, onSnapshot, query, orderBy, where, limit,
  ref, push, onValue, set, update, remove, off, dbTs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  sRef, uploadBytesResumable, getDownloadURL,
} from "./firebase.js";


/* ── safeLsGet: protege contra localStorage corrompido ("[object Object]" etc) ── */
function safeLsGet(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === "undefined" || raw === "null") return fallback;
    const trimmed = raw.trim();
    // Detecta valor corrompido (não começa com [ ou { ou ")
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{") && !trimmed.startsWith('"')) {
      console.warn("[CRM] localStorage corrompido — limpando:", key, "=>", trimmed.substring(0, 40));
      localStorage.removeItem(key);
      return fallback;
    }
    const parsed = JSON.parse(trimmed);
    // Se esperamos array mas veio outra coisa, retorna fallback
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      console.warn("[CRM] localStorage tipo errado — esperava array:", key);
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed;
  } catch(e) {
    console.warn("[CRM] localStorage parse error — limpando:", key, e.message);
    localStorage.removeItem(key);
    return fallback;
  }
}
function safeLsGetNull(key) { return safeLsGet(key, null); }

// Expor para o BRIDGE e para o Portal (retrocompatibilidade)
if (FB_CONFIGURED) {
  window._fb = {
    db, rtdb, auth, storage, configured: true,
    collection, addDoc, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc,
    serverTimestamp, onSnapshot, query, orderBy, where, limit,
    ref, push, onValue, set, update, remove, off, dbTs,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
    sRef, uploadBytesResumable, getDownloadURL,
  };
}

// ─── Paleta AZUL v34 ────────────────────────────────────────────────────────
const T = {
  side:"#0d2137", sideH:"#0a1929", sideAct:"rgba(59,157,232,.15)",
  sideActBrd:"#3B9DE8", sideTx:"rgba(255,255,255,.42)", sideLabel:"rgba(255,255,255,.20)",
  bg:"#EBF2FB", sur:"#FFFFFF", sur2:"#F0F6FF", sur3:"#E3EDF8",
  b:"#1A5FA8", bL:"#EBF2FB", bM:"#0d4080",
  tx:"#0d1f3a", txM:"#3a5070", txS:"#7A9AB8",
  br:"#C8DCF0", brD:"#A8C4E0",
  gr:"#1A7A52", grB:"#E6F5EE", grBr:"#86C9A4",
  am:"#9A6A00", amB:"#FFF8E6", amBr:"#F0C060",
  re:"#C0392B", reB:"#FDF0EE", reBr:"#F0A090",
  pu:"#4A3A8A", puB:"#F0EEF9", puBr:"#B0A0E0",
};

// ─── Hook responsivo ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ─── GlobalStyles v26 ─────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
      *, *::before, *::after { box-sizing: border-box; }
      input, select, textarea, button { font-family: 'Outfit', sans-serif !important; }
      input:focus, select:focus, textarea:focus {
        border-color: #1A5FA8 !important;
        box-shadow: 0 0 0 3.5px rgba(26,95,168,.15) !important;
        outline: none !important;
      }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: #EBF2FB; }
      ::-webkit-scrollbar-thumb { background: #A8C4E0; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: #1A5FA8; }
      html, body { height: 100%; overflow: hidden; }
      #root { height: 100%; overflow: hidden; }

      /* ── Responsivo Mobile ─────────────────────────────────── */




      /* Tipografia mínima legível no mobile */
      @media (max-width: 767px) {
        /* Inputs: previne zoom no iOS ao focar */
        input, select, textarea { font-size: 16px !important; }
      }
      /* Background sutil com imagem da Dra. Ilza */
      body::before {
        content: '';
        position: fixed;
        inset: 0;
        background-image: url('https://static.wixstatic.com/media/1f0134_4b022142b1b84bf0a5cec5b4a81f1c3d~mv2.jpg/v1/fill/w_1200,h_1200,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/1f0134_4b022142b1b84bf0a5cec5b4a81f1c3d~mv2.jpg');
        background-size: cover;
        background-position: center top;
        opacity: 0.06;
        pointer-events: none;
        z-index: 0;
      }
      #root { position: relative; z-index: 1; }

      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .page { animation: fadeUp .26s ease forwards; }
      @keyframes popIn {
        from { opacity: 0; transform: scale(.96) translateY(10px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      .modal-box { animation: popIn .22s cubic-bezier(.34,1.4,.64,1) forwards; }
    `}</style>
  );
}

// ─── Icones SVG v26 ────────────────────────────────────────────────────────────
function Ic({ n, sz=16, c=T.txM, sw=1.5 }) {
  const p = { stroke:c, strokeWidth:sw, strokeLinecap:"round", strokeLinejoin:"round", fill:"none" };
  const v = { width:sz, height:sz, viewBox:"0 0 24 24", style:{display:"block",flexShrink:0} };
  const d = {
    home:   <><path {...p} d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"/><path {...p} d="M9 21V13h6v8"/></>,
    users:  <><circle {...p} cx="9" cy="7" r="3.5"/><path {...p} d="M2 21c0-3.87 3.13-7 7-7h.4M16 19l2 2 4-4"/></>,
    search: <><circle {...p} cx="11" cy="11" r="7"/><path {...p} d="M21 21l-4.35-4.35"/></>,
    plus:   <><path {...p} d="M12 5v14M5 12h14"/></>,
    exam:   <><rect {...p} x="4" y="3" width="16" height="18" rx="2"/><path {...p} d="M4 8h16M9 12h6M9 16h4"/></>,
    cal:    <><rect {...p} x="3" y="4" width="18" height="17" rx="2"/><path {...p} d="M3 9h18M8 2v4M16 2v4M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01"/></>,
    video:  <><path {...p} d="M15 10l4.55-2.73A1 1 0 0121 8.27v7.46a1 1 0 01-1.45.9L15 14"/><rect {...p} x="1" y="7" width="14" height="11" rx="2"/></>,
    chat:   <><path {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></>,
    insta:  <><rect {...p} x="2" y="2" width="20" height="20" rx="5"/><circle {...p} cx="12" cy="12" r="5"/><circle fill={c} stroke="none" cx="17.5" cy="6.5" r="1"/></>,
    tiktok: <><path {...p} d="M9 12a4 4 0 104 4V4a5 5 0 005 5"/></>,
    money:  <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 7v10M9 9.5a3 3 0 016 0c0 1.5-1 2.5-3 3s-3 1.5-3 3a3 3 0 006 0"/></>,
    box:    <><path {...p} d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path {...p} d="M3 8l9 5 9-5M12 13v8"/></>,
    megaph: <><path {...p} d="M18 8a5 5 0 010 8M5 8v8l3-1.5M1 8h4l12-4v12L5 12H1V8z"/></>,
    shield: <><path {...p} d="M12 2l7 4v5c0 4.4-2.9 8.5-7 10C7.9 19.5 5 15.4 5 11V6l7-4z"/></>,
    user:   <><circle {...p} cx="12" cy="8" r="4"/><path {...p} d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></>,
    chevL:  <path {...p} d="M15 18l-6-6 6-6"/>,
    chevR:  <path {...p} d="M9 18l6-6-6-6"/>,
    close:  <><path {...p} d="M18 6L6 18M6 6l12 12"/></>,
    check:  <><path {...p} d="M5 13l4 4L19 7"/></>,
    edit:   <><path {...p} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:  <><polyline {...p} points="3 6 5 6 21 6"/><path {...p} d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/></>,
    clock:  <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 7v5l3 3"/></>,
    bell:   <><path {...p} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></>,
    logout: <><path {...p} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></>,
    spark:  <><polyline {...p} points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    trend:  <><polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline {...p} points="17 6 23 6 23 12"/></>,
    sala:   <><path {...p} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></>,
    send:   <><line {...p} x1="22" y1="2" x2="11" y2="13"/><polygon {...p} points="22 2 15 22 11 13 2 9 22 2"/></>,
  };
  return <svg {...v}>{d[n]}</svg>;
}


/* ════════════════════════════════════════════════════════════════
   CRM Dra. Ilza Ezequiel  v26
   Novidades:
   - Design renovado (paleta warm, fonte Outfit, animacoes)
   - Sidebar agrupada por secoes
   - Dashboard com graficos recharts
   - Fluxo sequencial: Paciente -> Consulta -> Exames
   - Ficha do paciente com aba Prontuario Medico
   - WhatsApp / Instagram / TikTok / Estoque / Admin inalterados
════════════════════════════════════════════════════════════════ */

// ─── Dados mock para graficos ─────────────────────────────────
const MOCK_MENSAL_DEFAULT = [
  { mes:"Jan", consultas:26, receita:11200, retornos:10, exames:18 },
  { mes:"Fev", consultas:24, receita:10600, retornos:14, exames:21 },
  { mes:"Mar", consultas:28, receita:12400, retornos:16, exames:24 },
  { mes:"Abr", consultas:32, receita:14200, retornos:19, exames:28 },
  { mes:"Mai", consultas:30, receita:13100, retornos:17, exames:26 },
  { mes:"Jun", consultas:35, receita:15800, retornos:22, exames:31 },
];
function getMockMensal() {
  try {
    const s = window.localStorage.getItem("crm_mensal_v26");
    return s ? JSON.parse(s) : MOCK_MENSAL_DEFAULT;
  } catch(e) { return MOCK_MENSAL_DEFAULT; }
}
const EXAMES_LISTA = [
  "EDA (Endoscopia Digestiva Alta)","Colonoscopia","Teste Respiratorio SIBO","Biopsia Gastrica",
  "USG Abdominal Total","Manometria Esofagica","pH-metria Esofagica","Capsula Endoscopica",
  "Enteroscopia","Calprotectina Fecal","H. pylori (Antigeno Fecal)",
  "Hemograma Completo","Ferro Serico + Ferritina","Vitamina D","Vitamina B12","TSH + T4 Livre",
];

const SERIES_META = [
  { key:"consultas", label:"Consultas", color:"#A8722A" },
  { key:"receita",   label:"Receita",   color:"#2D7A4F" },
  { key:"retornos",  label:"Retornos",  color:"#6D4E8A" },
  { key:"exames",    label:"Exames",    color:"#9A6A00" },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const fmt = (k, v) => k === "receita" ? `R$${(v/1000).toFixed(1)}k` : v;
  return (
    <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:13,
      padding:"12px 16px", boxShadow:"0 8px 28px rgba(44,26,8,.13)", minWidth:170 }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.txM, marginBottom:9,
        textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
      {payload.map(p => {
        const s = SERIES_META.find(x => x.key === p.dataKey);
        return (
          <div key={p.dataKey} style={{ display:"flex", alignItems:"center",
            gap:8, marginBottom:5, fontSize:12 }}>
            <span style={{ width:8, height:8, borderRadius:"50%",
              background:p.color, flexShrink:0 }} />
            <span style={{ color:T.txM, flex:1 }}>{s?.label}</span>
            <span style={{ fontWeight:700, color:p.color }}>{fmt(p.dataKey, p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGE: HOME ───────────────────────────────────────────────────────────────

function exportarCSV(colunas, linhas, nomeArquivo) {
  const header = colunas.map(c => `"${c.label}"`).join(";");
  const rows = linhas.map(row =>
    colunas.map(c => {
      const val = typeof c.get === "function" ? c.get(row) : (row[c.key] ?? "");
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(";")
  );
  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo + ".csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportarPDF(titulo, subtitulo, colunas, linhas) {
  const gerarLinha = row =>
    colunas.map(c => {
      const val = typeof c.get === "function" ? c.get(row) : (row[c.key] ?? "");
      return `<td>${String(val).replace(/</g,"&lt;")}</td>`;
    }).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>${titulo}</title>
<style>
  body{font-family:Arial,sans-serif;margin:32px;color:#0d1f35;font-size:12px}
  h1{font-size:18px;color:#1a5fa8;margin:0 0 4px}
  p.sub{color:#6b8aad;font-size:11px;margin:0 0 18px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#1a5fa8;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #d0dce8;font-size:11px}
  tr:nth-child(even) td{background:#f0f4f8}
  .rodape{margin-top:24px;font-size:10px;color:#6b8aad;text-align:right}
</style></head><body>
<h1>🏥 Clínica Dra. Ilza Ezequiel — ${titulo}</h1>
<p class="sub">${subtitulo} &nbsp;|&nbsp; Gerado em ${new Date().toLocaleString("pt-BR")}</p>
<table><thead><tr>${colunas.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead>
<tbody>${linhas.map(r=>`<tr>${gerarLinha(r)}</tr>`).join("")}</tbody></table>
<div class="rodape">Total de registros: ${linhas.length}</div>
</body></html>`;
  const w = window.open("", "_blank", "width=1000,height=700");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

/* ══ Importar CSV genérico ══ */
function importarCSV(file, onLinhas) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const txt = e.target.result.replace(/^\uFEFF/, ""); // remove BOM
      const linhas = txt.split("\n").map(l => l.split(";").map(c => c.replace(/^"|"$/g,"").replace(/""/g,'"')));
      const header = linhas[0];
      const rows = linhas.slice(1).filter(r => r.some(c => c.trim()));
      onLinhas(header, rows);
    } catch(err) {
      alert("Erro ao ler o arquivo CSV: " + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}

/* ══ Importar JSON genérico ══ */
function importarJSON(file, onData) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      onData(data);
    } catch(err) {
      alert("Erro ao ler o arquivo JSON: " + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}

/* ══ Exportar JSON (backup) ══ */
function exportarJSON(dados, nomeArquivo) {
  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo + ".json";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* Botão reutilizável de exportação + importação */
function BtnExportar({ onCSV, onPDF, onImportCSV, onImportJSON, label }) {
  const [aberto, setAberto] = React.useState(false);
  const ref = React.useRef(null);
  const fileRefCSV = React.useRef(null);
  const fileRefJSON = React.useRef(null);
  React.useEffect(() => {
    function handler(e){ if(ref.current && !ref.current.contains(e.target)) setAberto(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menuItem = (icon, txt, onClick, cor) => (
    <button onClick={()=>{onClick();setAberto(false);}} style={{
      width:"100%",padding:"10px 16px",border:"none",background:"none",
      color: cor || "#0d1f35",fontSize:12,cursor:"pointer",textAlign:"left",
      fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:8
    }}>{icon} {txt}</button>
  );

  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex",gap:0}}>
      {/* Botão exportar */}
      <button onClick={()=>setAberto(p=>!p)} style={{
        padding:"7px 14px",borderRadius:"8px 0 0 8px",border:"1.5px solid #1a5fa8",
        borderRight:"none",background:"#fff",color:"#1a5fa8",fontWeight:700,fontSize:12,
        cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6
      }}>📤 Exportar</button>
      {/* Botão importar */}
      <button onClick={()=>setAberto(p=>!p)} style={{
        padding:"7px 10px",borderRadius:"0 8px 8px 0",border:"1.5px solid #1a5fa8",
        background:"#1a5fa8",color:"#fff",fontWeight:700,fontSize:12,
        cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4
      }}>📥 ▾</button>

      {/* Hidden file inputs */}
      {onImportCSV && <input ref={fileRefCSV} type="file" accept=".csv" style={{display:"none"}}
        onChange={e=>{if(e.target.files[0]){importarCSV(e.target.files[0],onImportCSV);e.target.value="";}}}/>}
      {onImportJSON && <input ref={fileRefJSON} type="file" accept=".json" style={{display:"none"}}
        onChange={e=>{if(e.target.files[0]){importarJSON(e.target.files[0],onImportJSON);e.target.value="";}}}/>}

      {aberto&&(
        <div style={{
          position:"absolute",right:0,top:"calc(100% + 4px)",background:"#fff",
          border:"1px solid #d0dce8",borderRadius:10,boxShadow:"0 6px 24px rgba(13,33,55,.13)",
          minWidth:210,zIndex:999,overflow:"hidden"
        }}>
          {/* Exportar */}
          <div style={{padding:"6px 14px 4px",color:"#6b8aad",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",background:"#f4f7fa",borderBottom:"1px solid #d0dce8"}}>
            📤 Exportar
          </div>
          {menuItem("🗂️","Exportar CSV", ()=>onCSV())}
          {onPDF && <>
            <div style={{height:1,background:"#d0dce8"}}/>
            {menuItem("📄","Exportar PDF", ()=>onPDF())}
          </>}

          {/* Importar */}
          {(onImportCSV||onImportJSON) && <>
            <div style={{height:1,background:"#d0dce8"}}/>
            <div style={{padding:"6px 14px 4px",color:"#6b8aad",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",background:"#f4f7fa",borderBottom:"1px solid #d0dce8"}}>
              📥 Importar
            </div>
          </>}
          {onImportCSV && menuItem("🗂️","Importar CSV", ()=>fileRefCSV.current&&fileRefCSV.current.click(), "#1e8449")}
          {onImportJSON && <>
            <div style={{height:1,background:"#d0dce8"}}/>
            {menuItem("💾","Importar JSON (backup)", ()=>fileRefJSON.current&&fileRefJSON.current.click(), "#1a5fa8")}
          </>}
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   ASSETS
════════════════════════════════════════════════════════════════ */
const LOGO = "https://static.wixstatic.com/media/1f0134_5c378964392f45058ff834b96d82a578~mv2.png/v1/fill/w_488,h_269,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/1f0134_5c378964392f45058ff834b96d82a578~mv2.png";
const FOTO = "https://static.wixstatic.com/media/1f0134_c9ae84b5990f44e9934dedd0575a9261~mv2.jpg/v1/fill/w_488,h_325,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/1f0134_c9ae84b5990f44e9934dedd0575a9261~mv2.jpg";
const FOTO2 = "https://static.wixstatic.com/media/1f0134_4b022142b1b84bf0a5cec5b4a81f1c3d~mv2.jpg/v1/fill/w_490,h_735,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/1f0134_4b022142b1b84bf0a5cec5b4a81f1c3d~mv2.jpg";
const IG_HANDLE = "dra.ilzaezequiel";
const IG_GRAD = "linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)";

/* ════════════════════════════════════════════════════════════════
   PALETA AZUL — site drailzaezequiel.com.br
════════════════════════════════════════════════════════════════ */
const C = {
  bg:"#f0f4f8", card:"#ffffff", card2:"#f4f7fa", card3:"#e8eef5",
  side:"#0d2137", sideB:"#1a3550",
  p:"#1a5fa8", pL:"#2478cc", pG:"#3b9de8",
  gold:"#c9952a", goldL:"#e3b448",
  tx:"#0d1f35", txS:"#2c4a6e", txM:"#6b8aad", txSide:"#a8c4e0",
  red:"#c0392b", amber:"#d4830a", blue:"#1a5fa8", purple:"#6c3483",
  teal:"#148f77", green:"#1e8449", orange:"#e67e22",
  brd:"#d0dce8", sh:"rgba(13,33,55,.09)",
  ig:"#E1306C", igBg:"rgba(225,48,108,.08)",
  grad:"linear-gradient(135deg,#0d2137 0%,#1a5fa8 100%)",
};

/* ════════════════════════════════════════════════════════════════
   TAGS
════════════════════════════════════════════════════════════════ */
const CONV_TAGS = [
  { id:"agendado",   label:"Agendado",        color:"#1e8449", icon:"📅" },
  { id:"confirmado", label:"Confirmado",      color:"#1a5fa8", icon:"✅" },
  { id:"cancelado",  label:"Cancelado",       color:"#c0392b", icon:"❌" },
  { id:"nao_comp",   label:"Não compareceu",  color:"#922b21", icon:"🚫" },
  { id:"pendente",   label:"Pendente",        color:"#d4830a", icon:"⏳" },
  { id:"follow",     label:"Follow-up",       color:"#e67e22", icon:"🔄" },
  { id:"tr",         label:"TR Encaminhado",  color:"#148f77", icon:"↗️" },
  { id:"novo",       label:"Novo contato",    color:"#6c3483", icon:"🆕" },
];
const tagById = id => CONV_TAGS.find(t => t.id === id) || null;

/* ════════════════════════════════════════════════════════════════
   USUÁRIOS
════════════════════════════════════════════════════════════════ */
// ══════════════════════════════════════════════════════════════
// SEGURANÇA — SHA-256 hash de senhas via Web Crypto API
// As senhas abaixo são HASHES, nunca a senha em texto puro
// Para gerar novo hash: https://emn178.github.io/online-tools/sha256.html
// ══════════════════════════════════════════════════════════════
async function hashSenha(senha) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(senha));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

// Hashes SHA-256 das senhas originais (gerados automaticamente na 1ª carga)
// IlzaAdmin2026!  → pré-calculado
// DrailzaCRM26    → pré-calculado
// Recepcao2026    → pré-calculado
// ViniCRM2026     → pré-calculado
const USERS_INIT = [
  { id:1, u:"admin",             s:"5028aed3aa7c7bc6439da8d7cca6edb7c40a7e98c22abc1682213005e2bb8e3e", nome:"Administrador",      role:"admin",    email:"marcatti_vp@hotmail.com"  },
  { id:2, u:"ilza",             s:"23ea8803af65e8414c31d05a7247d0c5ce837a5a812bebf318a056eddaeb2a01", nome:"Dra. Ilza Ezequiel", role:"medico",   email:"ilzaeneta@gmail.com"      },
  { id:3, u:"recepcao",         s:"650c3bcbe89f71c4a68dc6138edad53f48d73117d06775cf497f1b52d5be6386", nome:"Recepção",           role:"recepcao", email:"recepcao@drailza.com.br"  },
  { id:4, u:"Vinícius",         s:"afcdd2f7854b9e283b86e599ac1f021884900f77fe27cbd19c449f3f06e3ed19", nome:"Vinícius",           role:"admin",    email:"marcatti_vp@hotmail.com"  },
  { id:5, u:"admin@drailza.com.br", s:"0b26ee69492137b82cd4f36a256d85b759c8fc6fe08c50e1fb3ee22bc0fd0dc5", nome:"Dra. Ilza Ezequiel", role:"admin",    email:"admin@drailza.com.br"     },
];

// ── Rate limiting: máx 5 tentativas → bloqueio 15 minutos ──
const AUTH_RATE = {
  tentativas: {},
  getBloqueio(u) {
    const r = this.tentativas[u];
    if(!r) return null;
    if(r.count >= 5 && (Date.now() - r.lastTs) < 15*60*1000) {
      const resto = Math.ceil((15*60*1000 - (Date.now()-r.lastTs))/60000);
      return `Conta bloqueada. Tente novamente em ${resto} min.`;
    }
    if((Date.now()-r.lastTs) >= 15*60*1000) { delete this.tentativas[u]; return null; }
    return null;
  },
  registrarFalha(u) {
    if(!this.tentativas[u]) this.tentativas[u] = { count:0, lastTs: Date.now() };
    this.tentativas[u].count++;
    this.tentativas[u].lastTs = Date.now();
    const restante = 5 - this.tentativas[u].count;
    return restante > 0 ? ` (${restante} tentativa${restante>1?"s":""} restante${restante>1?"s":""})` : "";
  },
  limpar(u) { delete this.tentativas[u]; }
};

// ── Session timeout: 30min sem atividade → logout automático ──
let _sessionTimer = null;
function resetSessionTimer(onLogout) {
  if(_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(()=>{
    alert("⚠️ Sessão encerrada por inatividade (30 minutos).");
    onLogout?.();
  }, 30*60*1000);
}
function clearSessionTimer() {
  if(_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
}

/* ════════════════════════════════════════════════════════════════
   VIP / PLANO 360 — ícone e constantes
════════════════════════════════════════════════════════════════ */
const VIP_ICON = "👑";
const VIP_LABEL = "Plano 360°";
const VIP_GRAD = "linear-gradient(135deg,#c9952a,#e3b448,#c9952a)";

/* ════════════════════════════════════════════════════════════════
   FILA DE PRIORIDADE — perguntas pendentes para a Dra.
════════════════════════════════════════════════════════════════ */
const _filaPrioridade = [];
function addFilaPrioridade(pac, canal, msg) {
  _filaPrioridade.unshift({
    id: "fp_" + Date.now(),
    pac, canal, msg: (msg||"").slice(0, 120),
    ts: new Date().toLocaleString("pt-BR"),
    lido: false,
  });
  if (_filaPrioridade.length > 50) _filaPrioridade.length = 50;
}

/* ════════════════════════════════════════════════════════════════
   BASE IA APRENDIZADO — extraída do caso Lourdes + scripts
════════════════════════════════════════════════════════════════ */
const IA_KNOWLEDGE_BASE = [
  {
    id:"kb1", tipo:"script", titulo:"Primeiro Contato — Saudação inicial",
    gatilho:"oi|olá|boa tarde|bom dia|boa noite|quero agendar|informação|consulta|atende",
    resposta:"Olá! Seja bem-vindo(a) ao consultório da Dra. Ilza 🌷 Me chamo Cris e farei seu primeiro atendimento. Para iniciarmos, por favor me informe seu *nome, idade, cidade* e *como nos conheceu*?"
  },
  {
    id:"kb2", tipo:"script", titulo:"Queixa principal — conectar com o paciente",
    gatilho:"dor abdominal|refluxo|gastrite|intestino|dor de barriga|inchaço|distensão|síndrome|intestino irritável|crônico|colite|hérnia",
    resposta:"Entendo, {nome} — são queixas bem crônicas e que limitam muito o dia a dia e a qualidade de vida 💙 A Dra. Ilza é especialista nesse assunto e acompanha inúmeros pacientes com o mesmo quadro. Ela atende de forma *individualizada*, o que faz toda a diferença para fechar o diagnóstico e encontrar o tratamento mais adequado. É isso que procura?"
  },
  {
    id:"kb3", tipo:"info", titulo:"Formas de atendimento e modalidades",
    gatilho:"presencial|telemedicina|online|remoto|como funciona|modalidade|atende como",
    resposta:"A Dra. Ilza atende de forma *presencial* (sextas no: 8h30 / 10h / 11h30 / 13h) ou por *telemedicina* (seg 14h30/16h · ter 14h30 · qua 14h30). A consulta tem duração de 1h30, tempo para ouvir, entender suas queixas e histórico completo — ela não foca só nos sintomas, mas em toda a sua história. 🩺"
  },
  {
    id:"kb4", tipo:"script", titulo:"Plano de Acompanhamento 360°",
    gatilho:"plano|acompanhamento|pacote|360|3 consultas|tratamento continuo|continuidade",
    resposta:"O *Plano Intestino 360°* inclui 3 consultas + 1 encontro exclusivo online para alinhamentos e preparo para alta 🌿 O ritmo é combinado com a Dra. conforme sua evolução, com duração máxima de 6 meses. Benefícios: agenda garantida, valores congelados, acompanhamento contínuo e previsibilidade financeira. Investimento: *R$ 3.000* (ou 3.200 parcelado)."
  },
  {
    id:"kb5", tipo:"script", titulo:"Consulta avulsa — informações e taxa",
    gatilho:"consulta avulsa|avulsa|única|só uma consulta|consulta individual",
    resposta:"A consulta avulsa tem investimento de *R$ 800,00* por consulta — não há retorno incluso. Para garantir o agendamento, solicitamos uma taxa de reserva de *R$ 200,00* (ressarcida em caso de desmarcação com 48h de antecedência). Posso passar os dados do PIX para garantir seu horário? 😊"
  },
  {
    id:"kb6", tipo:"script", titulo:"Objeção de valor — preço alto",
    gatilho:"caro|valor alto|preço|não tenho|parcelar|desconto|muito|custo",
    resposta:"Entendo, {nome} 🤝 Um diagnóstico preciso evita muito gasto desnecessário no futuro. A consulta avulsa é R$ 800 (PIX) ou parcelado no cartão. O Plano 360° cobre 3 consultas por R$ 3.000 com agenda garantida e valores congelados. Posso te explicar melhor o que cada um inclui?"
  },
  {
    id:"kb7", tipo:"info", titulo:"Teste Respiratório e RX Trânsito Colônico",
    gatilho:"teste respiratório|teste resp|sibo|h pylori|lactose|rx trânsito|trânsito cólico|marcadores|exame de respiração",
    resposta:"O *Teste Respiratório* custa R$ 700,00 e o *RX Trânsito Colônico com Marcadores* custa R$ 800,00 — ambos com agendamento mediante taxa de reserva. O agendamento é direto na recepção do IMES: *(13) 3271-2915* (também WhatsApp). 📞"
  },
  {
    id:"kb8", tipo:"info", titulo:"Endoscopia e Colonoscopia — encaminhamento",
    gatilho:"endoscopia|colonoscopia|colonoscopy|endoscopy|exame de imagem intestinal",
    resposta:"Para endoscopia e colonoscopia, a Dra. Ilza encaminha ao *Instituto Mendonça Costa* 🏥 Posso te orientar sobre como obter o pedido médico na consulta se precisar!"
  },
  {
    id:"kb9", tipo:"alerta", titulo:"Doenças inflamatórias intestinais — Crohn/Retocolite",
    gatilho:"crohn|retocolite|doença inflamatória|reti|ulcerativa|RCU",
    resposta:"Oi {nome}, importante informar: a Dra. Ilza não atende Doença de Crohn nem Retocolite Ulcerativa. Nesses casos, ela encaminha para a Dra. Aline Aravecchia, que é especialista nessa área. Posso te ajudar com outra dúvida? 💙"
  },
  {
    id:"kb10", tipo:"alerta", titulo:"Pedido de falar com a Dra. diretamente",
    gatilho:"falar com a dra|quero falar com ela|preciso falar com a doutora|dra ilza me responde|pode passar pra dra|passa pra dra|avisa a dra|falar diretamente",
    resposta:"Anotei, {nome}! 📋 Vou encaminhar sua mensagem para a Dra. Ilza agora. Ela responde habitualmente às *quartas-feiras*. Para demandas mais urgentes, o prazo é de até *5 dias úteis*. Fico aqui dando suporte nos outros dias! 🪻",
    acaoPrioridade: true
  },
  {
    id:"kb11", tipo:"script", titulo:"Políticas — WhatsApp e suporte",
    gatilho:"whatsapp|resposta|demora|quando responde|dias úteis|suporte|horário atendimento",
    resposta:"O WhatsApp é utilizado como apoio *entre as consultas* para otimizar o tratamento 💬 A Dra. Ilza responde com prazo de até *5 dias úteis*, habitualmente às *quartas-feiras*. Fico aqui de *segunda a sexta, 8h às 18h*, para apoio e agendamentos!"
  },
  {
    id:"kb12", tipo:"info", titulo:"Cortisol — instrução de coleta",
    gatilho:"cortisol",
    resposta:"Oi {nome}! Dica importante: o cortisol sérico pedido pela Dra. Ilza deve ser coletado até *2 horas após o despertar* ⏰ — é o horário de maior precisão. Agende o exame bem cedinho!"
  },
  {
    id:"kb13", tipo:"script", titulo:"Follow-up — sem resposta / reabordar",
    gatilho:"",
    resposta:"Oi {nome}! 🌷 Tudo bem? Passei aqui para saber se ainda posso te ajudar a agendar com a Dra. Ilza. Estamos com horários disponíveis e adoraríamos te receber! 💙"
  },
  {
    id:"kb14", tipo:"script", titulo:"Indicação por nutricionista",
    gatilho:"nutricionista|indicação|foi indicada|me indicaram|médico indicou",
    resposta:"Que ótimo, {nome}! Indicação de nutricionista é sempre muito bem-vinda aqui 🌷 Isso mostra que você está num caminho de cuidado integrado. A Dra. Ilza trabalha muito bem em parceria com nutricionistas. Como posso te ajudar a agendar?"
  },
  {
    id:"kb15", tipo:"perfil", titulo:"Paciente hipersensível a medicamentos",
    gatilho:"efeito colateral|passa mal|náusea|tontura|intolerante a remédio|sensível a medicamento",
    resposta:"Entendo, {nome}! A Dra. Ilza sempre inicia com doses mínimas justamente por isso 💙 Vamos no seu ritmo. Se sentir qualquer desconforto, me conta imediatamente que repasso para ela ajustar!"
  },
  {
    id:"kb16", tipo:"info", titulo:"Encerramento — agradecimento e redes",
    gatilho:"obrigado|obrigada|até mais|tchau|até logo|agradeço",
    resposta:"Fico feliz em ter ajudado, {nome}! 🌷 Agradecemos a confiança. Acompanhe a Dra. Ilza no Instagram para dicas e novidades: *instagram.com/dra.ilzaezequiel* Até logo! 💙"
  },
];

/* ════════════════════════════════════════════════════════════════
   DETECTAR PADRÃO IA E RETORNAR RESPOSTA SUGERIDA
════════════════════════════════════════════════════════════════ */
function detectarPadraoIA(texto, nome) {
  if (!texto) return null;
  const txt = texto.toLowerCase();
  for (const kb of IA_KNOWLEDGE_BASE) {
    if (!kb.gatilho) continue;
    const termos = kb.gatilho.split("|");
    if (termos.some(t => txt.includes(t))) {
      return {
        ...kb,
        respostaFinal: kb.resposta.replace(/{nome}/g, nome || "")
      };
    }
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════
   DETECTAR SE PACIENTE QUER FALAR COM DRA (prioridade)
════════════════════════════════════════════════════════════════ */
function querFalarComDra(texto) {
  if (!texto) return false;
  const t = texto.toLowerCase();
  return ["falar com a dra","quero falar com ela","preciso falar com a doutora",
    "dra ilza me responde","pode passar pra dra","passa pra dra","avisa a dra",
    "falar diretamente","fala com ela"].some(p => t.includes(p));
}


const EXAM_CAT = [
  { cat:"Consultas", itens:[
    {n:"Consulta Gastroenterologia",v:700},{n:"Consulta Particular",v:600},
    {n:"Consulta Online (Tele)",v:600},{n:"Retorno",v:0},{n:"Cortesia",v:0},
  ]},
  { cat:"Testes Respiratórios", itens:[
    {n:"Teste Resp. H. Pylori",v:660},{n:"Teste Resp. SIBO",v:660},{n:"Teste Resp. Lactose",v:490},
  ]},
  { cat:"Injetáveis", itens:[
    {n:"Citobê Dexa — 1 aplic.",v:139},{n:"Citobê Dexa — 3 aplic.",v:360},
  ]},
  { cat:"Planos", itens:[
    {n:"Plano INTESTINO 360",v:3000},{n:"Sinal de Confirmação",v:200},
  ]},
  { cat:"Convênio", itens:[
    {n:"Consulta Convênio Unimed",v:0},{n:"Consulta Convênio Bradesco",v:0},{n:"Outros Convênio",v:0},
  ]},
];

/* ════════════════════════════════════════════════════════════════
   TIPOS DE EXAME (novo módulo)
════════════════════════════════════════════════════════════════ */
const TIPOS_EXAME = [
  "Teste Respiratório H. Pylori",
  "Teste Respiratório SIBO",
  "Teste Respiratório Lactose",
  "RX do Intestino",
  "Colonoscopia",
  "Endoscopia",
  "Ultrassonografia Abdominal",
  "Sangue — Hemograma Completo",
  "Sangue — B12 / Vitamina D / Ferro",
  "Cultura de Fezes",
  "Calprotectina Fecal",
  "Outro",
];

/* ════════════════════════════════════════════════════════════════
   ESTOQUE INICIAL — inclui consumíveis de teste respiratório
════════════════════════════════════════════════════════════════ */
const ESTOQUE_INIT = [];

/* ════════════════════════════════════════════════════════════════
   NOME DA IA E SCRIPTS — Isabela
════════════════════════════════════════════════════════════════ */
const NOME_IA = "Isabela";

const IA_SYSTEM = "Você e " + NOME_IA + ", assistente de atendimento da Dra. Ilza Ezequiel, gastroenterologista em Santos/SP. " +
  "Responda APENAS como " + NOME_IA + " da equipe, nunca como IA. " +
  "Regras: 1) Saudacao padrao: 'Aqui e " + NOME_IA + ", da equipe da Dra. Ilza. Seja bem-vinda(o)! Me conta como posso te ajudar?' " +
  "2) Atendimento particular, presencial Santos (sextas) ou telemedicina Brasil todo (tercas 14h/15h30). Consulta 90min. " +
  "3) Valores: R$800 PIX ou 2x cartao. Nao aceitamos debito, ELO, AMEX. " +
  "4) Plano Intestino 360: R$3000 PIX ou R$3200 em 5x — inclui 3 consultas + 1 encontro online. " +
  "5) Sinal confirmacao: R$200 PIX chave 29.774.291/0001-57, abatido do total. " +
  "6) Cancelamento: avisar 48h antes; sem aviso sinal retido. " +
  "7) Retorno cortesia online em 30 dias incluido. " +
  "8) Teste respiratorio: feito no IMES (nao com a Dra), tel 13 32712911, valor R$660 ou R$600 PIX. " +
  "9) Endoscopia/Colonoscopia: indicar Instituto Mendonca Costa. " +
  "10) WhatsApp: respostas em ate 5 dias uteis; interconsultas respondidas as quartas. " +
  "11) Follow-up 3 dias sem resposta. Registrar origem: Google/Instagram/Facebook/Indicacao. " +
  "12) Emitimos nota fiscal. Gere APENAS o texto da mensagem, sem aspas ou introducao.";

const AI_SCRIPT = {
  etapas: [
    { id:"primeiro_contato", titulo:"1o Contato", gatilho:"novo paciente",
      mensagem:"Aqui e " + NOME_IA + ", da equipe da Dra. Ilza! 🪻\n\nSeja muito bem-vinda(o)! Vou te ajudar com todo carinho.\n\nMe conta como posso te ajudar hoje?"},
    { id:"apresentar_atendimento", titulo:"Apresentar Atendimento", gatilho:"paciente descreve queixa",
      mensagem:"Fico feliz que voce tenha chegado ate a Dra. Ilza, {nome}! Ela e especialista em doencas funcionais do trato GI 😊\n\n🩺 Atendimento particular, individualizado\n📍 Presencial em Santos (sextas)\n💻 Telemedicina para todo Brasil (tercas)\n⏱ 90 minutos por consulta\n\n💰 R$ 800 no PIX ou 2x no cartao"},
    { id:"interesse_consulta", titulo:"Oferecer Horarios", gatilho:"paciente quer agendar",
      mensagem:"Otimo, {nome}! Temos horarios disponiveis 📅\n\n📍 Presencial Santos: [proxima sexta]\n💻 Telemedicina: [proxima terca]\n\nQual dessas opcoes funciona melhor?"},
    { id:"plano_360", titulo:"Plano Intestino 360", gatilho:"paciente quer acompanhamento",
      mensagem:"Temos o Plano Intestino 360 🌿\n\n✅ 3 consultas + 1 encontro online\n✅ Respostas em ate 24h (dias uteis)\n✅ Acesso mais proximo a Dra.\n\n💰 PIX: R$ 3.000 | Cartao 5x: R$ 3.200"},
    { id:"objecao_valor", titulo:"Objecao de Valor", gatilho:"paciente diz que esta caro",
      mensagem:"Entendo, {nome} 🤝\n\nUm diagnostico correto evita gastos com tratamentos que nao resolvem a causa.\n\n✅ Parcelamento em 2x no cartao\n✅ Plano 360 com retorno incluido\n\nPosso te explicar melhor o Plano? 💙"},
    { id:"confirmar_agendamento", titulo:"Confirmar Agendamento", gatilho:"apos escolha do horario",
      mensagem:"Perfeito! ✅\n\nPara garantir o horario, pedimos um sinal de R$ 200 via PIX (abatido do total):\n🔑 Chave: 29.774.291/0001-57\n\nApos o pagamento, envie o comprovante. 🧾 Emitimos nota fiscal."},
    { id:"follow_up_48h", titulo:"Follow-up 48h", gatilho:"sem resposta apos 48h",
      mensagem:"Bom dia, {nome}! Tudo bem? 😊\n\nPassei para saber se posso te ajudar e verificar se conseguimos agendar sua consulta da melhor forma. Estamos com horarios disponiveis! 💙"},
    { id:"interconsulta", titulo:"Interconsulta", gatilho:"duvida clinica entre consultas",
      mensagem:"Ola, {nome}! 😊\n\nSua duvida sera encaminhada a Dra. Ilza.\nAs demandas de interconsulta sao respondidas as quartas-feiras.\n\nPara questoes administrativas, estou a disposicao! 🪻"},
    { id:"teste_respiratorio", titulo:"Teste Respiratorio", gatilho:"paciente pergunta sobre teste",
      mensagem:"O teste respiratorio e feito no IMES (Praiamar Corporate) 🔬\n\n📞 Agendar: (13) 3271-2911\n💰 R$ 660 (2x cartao) ou R$ 600 PIX\n⏱ Duração: ~2h | Laudo em 5 dias uteis"},
    { id:"pos_consulta", titulo:"Pos-Consulta", gatilho:"apos consulta",
      mensagem:"Oi {nome}! Espero que a consulta com a Dra. Ilza tenha sido otima! 😊\n\nQualquer duvida sobre o plano terapeutico, estou aqui.\nLembre-se: retorno cortesia online disponivel em 30 dias! 🪻"},
  ],
  dicas: [
    "Sempre use o nome do paciente para personalizar",
    "Responda em ate 30 minutos para aumentar conversao",
    "Pacientes por indicacao = prioridade maxima",
    "Oferecer horarios sem perguntar preferencia",
    "Registrar origem: Google / Instagram / Facebook / Indicacao",
  ]
};

/* ════════════════════════════════════════════════════════════════
   EXAMES AGENDADOS (banco inicial)
════════════════════════════════════════════════════════════════ */
const EXAMES_INIT = [];

/* ════════════════════════════════════════════════════════════════
   AGENDA / FINANCEIRO / WA / IG
════════════════════════════════════════════════════════════════ */
const AGENDA_INIT = [];

const FIN_INIT = [];

const WA_BASE = [];

/* ════════════════════════════════════════════════════════════════
   LIGAÇÕES RECEBIDAS VIA WHATSAPP
════════════════════════════════════════════════════════════════ */
const WA_LIGACOES_INIT = [];


const IG_BASE = [];
const TK_GRAD="linear-gradient(135deg,#010101 0%,#69C9D0 50%,#EE1D52 100%)";
const TK_BASE=[];


/* ════════════════════════════════════════════════════════════════
   ANAMNESE
════════════════════════════════════════════════════════════════ */
const ANAMNESE_F = [
  {id:"queixa",    lb:"Queixa Principal",           tp:"ta",  ph:"Descreva a queixa principal..."},
  {id:"historia",  lb:"História Clínica",            tp:"ta",  ph:"Histórico e evolução da doença..."},
  {id:"habitos",   lb:"Hábitos Intestinais",         tp:"sel", opts:["Normal","Constipação","Diarreia","Alternante"]},
  {id:"dieta",     lb:"Dieta Atual",                 tp:"sel", opts:["Onívora","Vegetariana","Sem glúten","Low FODMAP"]},
  {id:"sintomas",  lb:"Sintomas",                    tp:"chk", opts:["Distensão","Flatulência","Náuseas","Vômitos","Refluxo","Dor abdominal","Emagrecimento"]},
  {id:"alergias",  lb:"Alergias",                    tp:"ta",  ph:"Medicamentos, alimentos, substâncias..."},
  {id:"medicacoes",lb:"Medicações em Uso",           tp:"ta",  ph:"Medicamentos, doses..."},
  {id:"exfisico",  lb:"Exame Físico",                tp:"ta",  ph:"Peso, PA, abdome..."},
  {id:"hipotese",  lb:"Hipótese Diagnóstica / CID",  tp:"ta",  ph:"Ex: K58 — SII"},
  {id:"conduta",   lb:"Conduta / Plano Terapêutico", tp:"ta",  ph:"Exames, medicamentos, orientações..."},
  {id:"retorno",   lb:"Retorno em",                  tp:"tx",  ph:"Ex: 30 dias, após exames..."},
];

const TAGS_NAO = [
  "Convênio não atendido","Valor alto","Chat abandonado","Pediatria",
  "Paciente de outra cidade","Sem resposta após 3 contatos","Financeiro",
  "Já está em tratamento","Plano não reembolsa","Outro motivo",
];

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function maskTel(t,show){
  if(!t||t==="0") return "—";
  const d=t.replace(/\D/g,"");
  if(show) return d.length>=11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`:t;
  return d.length>=10?`(${d.slice(0,2)}) ●●●●●-${d.slice(-4)}`:"●●●●●";
}
function initials(n){
  if(!n) return "?";
  const p=n.replace("@","").trim().split(/[\s._]+/);
  return (p[0][0]+(p[1]?p[1][0]:"")).toUpperCase();
}
const _logs=[];
function auditAdd(u,a,d){
  _logs.unshift({ts:new Date().toLocaleString("pt-BR"),u,a,d:(d||"").slice(0,80)});
  if(_logs.length>200) _logs.length=200;
}
const fmtMoeda=v=>`R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;

/* ════════════════════════════════════════════════════════════════
   ESTILOS BASE
════════════════════════════════════════════════════════════════ */
const SI={width:"100%",background:"#fff",border:`1.5px solid ${C.brd}`,borderRadius:8,padding:"9px 12px",color:C.tx,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const SL={color:C.txM,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:5};
const inp={width:"100%",background:T.sur,border:`1.5px solid ${T.br}`,borderRadius:10,padding:"9px 13px",color:T.tx,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color .2s"};

/* ════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
════════════════════════════════════════════════════════════════ */
function Av({s,size=36,color=C.p,gradient}){
  return <div style={{width:size,height:size,minWidth:size,borderRadius:Math.floor(size/3.5),background:gradient||`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:Math.floor(size*0.36),color:gradient?"#fff":color,flexShrink:0}}>{s||"?"}</div>;
}
function Bdg({c,children,sm}){
  return <span style={{background:`${c}18`,color:c,border:`1px solid ${c}30`,padding:sm?"2px 7px":"3px 10px",borderRadius:99,fontSize:sm?9:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>;
}
function TagBadge({tagId,sm}){
  const t=tagById(tagId);
  if(!t) return null;
  return <span style={{background:`${t.color}18`,color:t.color,border:`1px solid ${t.color}35`,padding:sm?"2px 6px":"3px 10px",borderRadius:99,fontSize:sm?9:10,fontWeight:700,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{t.icon} {t.label}</span>;
}
function TagSelector({current,onChange}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  const cur=tagById(current);
  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:cur?`${cur.color}15`:C.card2,border:`1.5px solid ${cur?cur.color+"40":C.brd}`,color:cur?cur.color:C.txM,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
        🏷️ {cur?`${cur.icon} ${cur.label}`:"TAG"}<span style={{fontSize:9,marginLeft:2}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:C.card,border:`1px solid ${C.brd}`,borderRadius:12,boxShadow:`0 8px 24px ${C.sh}`,minWidth:190,padding:6}}>
          {current&&<div onClick={()=>{onChange(null);setOpen(false);}} style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",color:C.txM,fontSize:11,fontWeight:600}}>✕ Remover TAG</div>}
          {CONV_TAGS.map(t=>(
            <div key={t.id} onClick={()=>{onChange(t.id);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,cursor:"pointer",background:current===t.id?`${t.color}15`:"transparent",color:current===t.id?t.color:C.txS,fontSize:12,fontWeight:current===t.id?700:400}}>
              <span style={{width:9,height:9,borderRadius:99,background:t.color,flexShrink:0}}/>{t.icon} {t.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ════════════════════════════════════════════════════════════════
   Fld — campo de formulário com label (componente ausente v31)
════════════════════════════════════════════════════════════════ */
function Fld({ label, children, style={} }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <label style={{
          display: "block", fontSize: 10, fontWeight: 700,
          color: T.txM, textTransform: "uppercase",
          letterSpacing: ".07em", marginBottom: 6
        }}>{label}</label>
      )}
      {children}
    </div>
  );
}

function Btn({onClick,children,v="p",variant,sm,small,full,disabled,icon,style={}}){
  // aceitar tanto v= quanto variant= (compatibilidade)
  const vv = v !== "p" ? v : (variant === "secondary" ? "g" : variant === "ghost" ? "g" : v);
  const BG = {
    p: `linear-gradient(135deg,${C.p},${C.pL})`,
    g: "transparent",
    gold: `linear-gradient(135deg,${C.gold},${C.goldL})`,
    red: `rgba(192,57,43,.08)`,
    wa: "linear-gradient(135deg,#128c7e,#25d366)",
    ig: IG_GRAD,
    blue: `linear-gradient(135deg,${C.p},${C.pG})`,
    prn: "linear-gradient(135deg,#374151,#1f2937)",
    pur: `linear-gradient(135deg,${C.purple},#8e44ad)`,
    teal: `linear-gradient(135deg,#0e6655,${C.teal})`,
    green: `linear-gradient(135deg,#145a32,${C.green})`,
  };
  const CL = {p:"#fff",g:C.txS,gold:"#fff",red:C.red,wa:"#fff",ig:"#fff",blue:"#fff",prn:"#fff",pur:"#fff",teal:"#fff",green:"#fff"};
  const BD = {g:`1.5px solid ${C.brd}`,red:`1.5px solid rgba(192,57,43,.3)`};
  const smEff = sm || small;
  const btnStyle = {
    background: BG[vv] || BG.p,
    color: CL[vv] || "#fff",
    border: BD[vv] || "none",
    padding: smEff ? "6px 12px" : "10px 18px",
    borderRadius: 9,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: smEff ? 11 : 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: full ? "100%" : undefined,
    justifyContent: full ? "center" : undefined,
    fontFamily: "inherit",
    opacity: disabled ? 0.55 : 1,
    ...style,
  };
  return <button onClick={onClick} disabled={disabled} style={btnStyle}>{children}</button>;
}
function Card({children,style={}}){
  return <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:14,boxShadow:`0 2px 10px ${C.sh}`,...style}}>{children}</div>;
}
function Modal({title,onClose,children,width=600}){
  useEffect(()=>{
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  },[]);

  return createPortal(
    <div
      onMouseDown={e=>{e.preventDefault();if(e.target===e.currentTarget)onClose();}}
      style={{
        position:"fixed", inset:0, zIndex:999999,
        background:"rgba(13,33,55,.65)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"flex-start", justifyContent:"center",
        overflowY:"auto",
        padding:"32px 16px 24px",
        paddingLeft:"calc(var(--sidebar-w,0px) + 16px)",
      }}>
      <div
        onMouseDown={e=>e.stopPropagation()}
        style={{
          background:C.card, borderRadius:18,
          width:"100%",
          maxWidth:`min(${width}px, calc(100vw - var(--sidebar-w,0px) - 32px))`,
          display:"flex", flexDirection:"column",
          boxShadow:`0 24px 60px ${C.sh}`,
          flexShrink:0,
          marginBottom:24,
        }}>
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"16px 20px", borderBottom:`1px solid ${C.brd}`,
          background:C.card2, borderRadius:"18px 18px 0 0", flexShrink:0,
        }}>
          <p style={{color:C.tx,fontWeight:800,fontSize:15,margin:0}}>{title}</p>
          <button onClick={onClose} style={{
            background:"none", border:"none", color:C.txM,
            cursor:"pointer", fontSize:20, lineHeight:1, flexShrink:0,
          }}>✕</button>
        </div>
        <div style={{
          flex:1,
          minHeight:0,
          overflowY:"auto",
          padding:20,
        }}>{children}</div>
      </div>
    </div>
  , document.body);
}

/* Popup alerta de estoque crítico */
function ConfirmPopup({title,msg,onYes,onNo,yesLabel="Sim, confirmar",noLabel="Cancelar",danger=false}){
  return(
    <div onMouseDown={e=>e.stopPropagation()} style={{position:"fixed",inset:0,paddingLeft:"var(--sidebar-w,0px)",background:"rgba(0,0,0,.55)",zIndex:999999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 16px 24px",overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:400,padding:28,boxShadow:"0 24px 60px rgba(0,0,0,.3)",textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:"50%",background:danger?"rgba(192,57,43,.1)":"rgba(26,95,168,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px"}}>
          {danger?"⚠️":"❓"}
        </div>
        <p style={{color:C.tx,fontWeight:800,fontSize:17,margin:"0 0 8px",fontFamily:"Georgia,serif"}}>{title}</p>
        <p style={{color:C.txM,fontSize:13,margin:"0 0 22px",lineHeight:1.6}}>{msg}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onNo} style={{flex:1,background:"transparent",border:`1.5px solid ${C.brd}`,color:C.txS,borderRadius:10,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{noLabel}</button>
          <button onClick={onYes} style={{flex:1,background:danger?`linear-gradient(135deg,${C.red},#e74c3c)`:`linear-gradient(135deg,${C.p},${C.pL})`,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{yesLabel}</button>
        </div>
      </div>
    </div>
  );
}

function EstoqueAlertaPopup({itens,onClose}){
  if(!itens||itens.length===0) return null;
  return(
    <div style={{position:"fixed",bottom:24,right:24,zIndex:3000,maxWidth:360}}>
      {itens.map(it=>(
        <div key={it.id} style={{background:"#fff",border:`2px solid ${C.red}`,borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:`0 8px 24px rgba(192,57,43,.25)`}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:22}}>🚨</span>
            <div style={{flex:1}}>
              <p style={{color:C.red,fontWeight:800,fontSize:13,margin:"0 0 2px"}}>Estoque Crítico!</p>
              <p style={{color:C.tx,fontWeight:600,fontSize:12,margin:"0 0 2px"}}>{it.nome}</p>
              <p style={{color:C.red,fontSize:12,margin:0}}>
                {it.un==="frasco"&&it.nota
                  ? `${it.qtd} ${it.un}(s) restante(s) — ${it.nota}`
                  : `Apenas ${it.qtd} ${it.un}(s) — mínimo: ${it.min}`}
              </p>
            </div>
            <button onClick={()=>onClose(it.id)} style={{background:"none",border:"none",color:C.txM,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════════════════════ */
function Login({onLogin,users}){
  const _saved = (()=>{try{return safeLsGet("crm_saved_login", null);}catch{return null;}})();
  // Recupera usuário salvo por ID (nunca por senha)
  const _savedUser = _saved?.uid ? users.find(u=>u.id===_saved.uid) : null;
  const [step,setStep]=useState("creds");
  const [user,setUser]=useState(_savedUser?.u||"");
  const [pass,setPass]=useState("");  // senha NUNCA fica salva
  const [lembrar,setLembrar]=useState(!!_saved);
  const [showP,setShowP]=useState(false);
  const [err,setErr]=useState("");
  const [found,setFound]=useState(null);
  const [forgot,setForgot]=useState(false);
  const [fu,setFu]=useState(""); const [fm,setFm]=useState("");
  const [resetSent,setResetSent]=useState(false);
  const [certFile,setCertFile]=useState(null);
  const [certPin,setCertPin]=useState("");
  const [certCN,setCertCN]=useState("");
  const [certLoading,setCertLoading]=useState(false);
  const [showConfirmClose,setShowConfirmClose]=useState(false);
  const certRef=useRef();

  function fecharApp(){
    if(window.electronAPI?.fecharApp) window.electronAPI.fecharApp();
    else if(window.electronAPI?.sair) window.electronAPI.sair();
    else setShowConfirmClose(true);
  }

  async function doCredentials(){
    const input = user.trim().toLowerCase();
    const bloq  = AUTH_RATE.getBloqueio(input);
    if(bloq){ setErr(bloq); return; }

    // Encontra usuário pelo login ou email
    const candidate = users.find(u =>
      u.u.toLowerCase()===input || (u.email&&u.email.toLowerCase()===input)
    );

    // Hash a senha digitada e compara
    const passHash = await hashSenha(pass);
    const isHashed = candidate && candidate.s.length === 64; // SHA-256 = 64 hex chars

    // Suporte a migração: aceita hash OU senha plain até migrar
    const ok = candidate && (
      (isHashed && candidate.s === passHash) ||
      (!isHashed && candidate.s === pass)
    );

    if(!ok){
      const aviso = AUTH_RATE.registrarFalha(input);
      auditAdd("desconhecido","LOGIN_ERRO",`Tentativa: "${user.trim()}"`);
      setErr("Usuário/e-mail ou senha incorretos." + aviso);
      setTimeout(()=>setErr(""),4000);
      return;
    }

    AUTH_RATE.limpar(input);
    // Salva APENAS id e nome — nunca a senha
    if(lembrar) localStorage.setItem("crm_saved_login", JSON.stringify({uid: candidate.id}));
    else localStorage.removeItem("crm_saved_login");
    auditAdd(candidate.nome,"LOGIN",""); 
    onLogin(candidate);
  }

  function lerCertificado(file){
    if(!file)return;
    setCertFile(file);
    const nomeSemExt=file.name.replace(/\.(pfx|p12)$/i,"").replace(/[-_]/g," ");
    setCertCN(nomeSemExt||"Titular do Certificado");
  }

  function doCertLogin(){
    if(!certFile){setErr("Selecione o arquivo do certificado (.pfx ou .p12).");return;}
    if(certPin.length<4){setErr("PIN deve ter no mínimo 4 dígitos.");return;}
    setCertLoading(true); setErr("");
    setTimeout(()=>{
      setCertLoading(false);
      if(!found){setErr("Sessão expirada. Volte e faça login novamente.");return;}
      auditAdd(found.nome,"LOGIN_CERT",`Cert: ${certFile.name}`);
      onLogin({...found,certAutenticado:true,certNome:certCN,certArquivo:certFile.name});
    },1800);
  }

  /* Paleta interna (azul escuro) */
  const ic={
    bg:"#0d2137",
    card:"rgba(255,255,255,.07)",
    cardBrd:"rgba(255,255,255,.12)",
    inputBg:"rgba(255,255,255,.10)",
    inputBrd:"rgba(255,255,255,.20)",
    inputFocus:"rgba(59,157,232,.7)",
    lbl:"rgba(168,196,224,.85)",
    tx:"#ffffff",
    txS:"rgba(255,255,255,.85)",
    txM:"rgba(168,196,224,.8)",
    btn:"linear-gradient(135deg,#1a5fa8,#2478cc)",
    btnHov:"linear-gradient(135deg,#2478cc,#3b9de8)",
    sep:"rgba(255,255,255,.14)",
    err:"rgba(240,100,80,.18)",
    errBrd:"rgba(240,100,80,.55)",
  };

  const SI_DARK={
    width:"100%",background:ic.inputBg,
    border:`1.5px solid ${ic.inputBrd}`,borderRadius:10,
    padding:"12px 14px",color:ic.tx,fontSize:14,outline:"none",
    boxSizing:"border-box",fontFamily:"inherit",
    transition:"border-color .2s",
    WebkitTextFillColor:"#fff",
  };
  const SL_DARK={
    color:ic.lbl,fontSize:11,fontWeight:700,
    textTransform:"uppercase",letterSpacing:".08em",
    display:"block",marginBottom:6,
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",
      background:`linear-gradient(155deg,#0a1929 0%,#0d2137 35%,#1a3550 70%,#0d4080 100%)`,
      position:"relative",overflow:"hidden",padding:"24px 16px"}}>

      {/* Botão fechar canto superior direito */}
      <button onClick={fecharApp}
        title="Fechar programa"
        style={{position:"fixed",top:14,right:14,zIndex:9999,
          background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",
          color:"rgba(255,255,255,.65)",borderRadius:9,width:36,height:36,
          display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",fontSize:18,fontWeight:700,
          backdropFilter:"blur(8px)",transition:"all .18s"}}
        onMouseEnter={e=>{e.currentTarget.style.background="rgba(192,57,43,.4)";e.currentTarget.style.color="#fff";}}
        onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.color="rgba(255,255,255,.65)";}}>
        ✕
      </button>

      {/* Popup confirmação fechar (fallback browser) */}
      {showConfirmClose&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:99999,
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#1a3550",border:"1px solid rgba(255,255,255,.15)",borderRadius:18,
            padding:"28px 32px",maxWidth:360,width:"90%",textAlign:"center",
            boxShadow:"0 24px 60px rgba(0,0,0,.5)"}}>
            <div style={{fontSize:42,marginBottom:12}}>⚠️</div>
            <p style={{color:"#fff",fontWeight:800,fontSize:17,margin:"0 0 8px"}}>Fechar o sistema?</p>
            <p style={{color:"rgba(168,196,224,.8)",fontSize:13,margin:"0 0 22px",lineHeight:1.6}}>
              Deseja encerrar o CRM Dra. Ilza?
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowConfirmClose(false)}
                style={{flex:1,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",
                  color:"rgba(255,255,255,.7)",borderRadius:10,padding:"11px",fontWeight:700,
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Cancelar
              </button>
              <button onClick={()=>{ window.close(); setShowConfirmClose(false); }}
                style={{flex:1,background:"linear-gradient(135deg,#c0392b,#e74c3c)",color:"#fff",
                  border:"none",borderRadius:10,padding:"11px",fontWeight:800,
                  fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Sim, fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Textura de fundo sutil */}
      <div style={{position:"absolute",inset:0,backgroundImage:`url(${FOTO2})`,
        backgroundSize:"cover",backgroundPosition:"center top",opacity:.06,pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,background:
        "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,157,232,.15) 0%, transparent 70%)",
        pointerEvents:"none"}}/>

      {/* Modal recuperar senha */}
      {forgot&&(
        <Modal title="🔑 Recuperar Acesso" onClose={()=>{setForgot(false);setFm("");setResetSent(false);setFu("");}} width={440}>
          {!resetSent?(
            <div>
              <p style={{color:C.txS,fontSize:13,marginBottom:16,lineHeight:1.6}}>
                Informe seu <strong>e-mail cadastrado</strong>. Você receberá um link para criar uma nova senha.
              </p>
              <div style={{marginBottom:14}}>
                <label style={SL}>E-mail ou Usuário</label>
                <input value={fu} onChange={e=>setFu(e.target.value)} placeholder="ex: ilza@drailzaezequiel.com.br" style={SI}/>
              </div>
              {fm&&!resetSent&&<p style={{color:C.red,fontSize:12,marginBottom:10}}>{fm}</p>}
              <Btn v="p" full onClick={()=>{
                const inp=fu.trim().toLowerCase();
                const f=users.find(u=>u.u.toLowerCase()===inp||(u.email&&u.email.toLowerCase()===inp));
                if(!f){setFm("❌ E-mail ou usuário não encontrado.");return;}
                const token=Math.random().toString(36).slice(2,10).toUpperCase();
                const link=`https://crm.drailzaezequiel.com.br/reset?token=${token}&u=${f.u}`;
                setFm(`✅ Link enviado para: ${f.email||"e-mail cadastrado"}\n\n🔗 ${link}\n\n(Simulação — em produção o link é enviado via SMTP)`);
                setResetSent(true);
                auditAdd(f.nome,"RESET_SOLICITADO",`Email: ${f.email||f.u}`);
              }}>📧 Enviar Link de Recuperação</Btn>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <p style={{fontSize:48,margin:"0 0 12px"}}>📧</p>
              <p style={{color:C.green,fontWeight:800,fontSize:16,margin:"0 0 8px"}}>Link enviado!</p>
              <div style={{background:`${C.p}08`,border:`1px solid ${C.p}20`,borderRadius:12,padding:"14px 16px",textAlign:"left",marginBottom:16}}>
                <p style={{color:C.txS,fontSize:12,margin:0,whiteSpace:"pre-wrap",lineHeight:1.7}}>{fm}</p>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ═══ TOPO: Foto + Logo ═══ */}
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",
        alignItems:"center",marginBottom:18,maxWidth:600,width:"100%"}}>

        {/* Foto circular + divisor + Logo grande — tudo numa linha */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:28}}>

          {/* Foto circular da Dra. */}
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:120,height:120,borderRadius:"50%",
              background:"linear-gradient(135deg,rgba(59,157,232,.7),rgba(26,95,168,.5))",
              padding:3.5,boxShadow:"0 0 0 8px rgba(59,157,232,.12),0 24px 56px rgba(0,0,0,.55)"}}>
              <img src={FOTO} alt="Dra. Ilza" style={{width:"100%",height:"100%",borderRadius:"50%",
                objectFit:"cover",objectPosition:"center top",display:"block"}}
                onError={e=>e.target.style.display="none"}/>
            </div>
            {/* Badge online */}
            <div style={{position:"absolute",bottom:7,right:7,width:17,height:17,borderRadius:"50%",
              background:"#25d366",border:"3px solid #0d2137",boxShadow:"0 2px 8px rgba(0,0,0,.35)"}}/>
          </div>

          {/* Divisor vertical */}
          <div style={{width:1,height:90,background:"linear-gradient(to bottom,transparent,rgba(255,255,255,.35),transparent)",flexShrink:0}}/>

          {/* Logo bem maior, paralelo à foto */}
          <div style={{flexShrink:0,display:"flex",alignItems:"center"}}>
            <img src={LOGO} alt="Logo Dra. Ilza"
              style={{height:100,maxWidth:260,objectFit:"contain",
                filter:"brightness(0) invert(1)",opacity:.96,
                dropShadow:"0 4px 16px rgba(0,0,0,.4)"}}
              onError={e=>e.target.style.display="none"}/>
          </div>
        </div>
      </div>

      {/* ═══ FORMULÁRIO NO AZUL ═══ */}
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:420}}>

        {/* STEP 1: Credenciais */}
        {step==="creds"&&(
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            <div style={{textAlign:"center",marginBottom:22}}>
              <h2 style={{color:"#ffffff",fontSize:22,fontWeight:900,margin:"0 0 4px",
                fontFamily:"Georgia,serif",letterSpacing:"-.02em"}}>Bem-vinda de volta</h2>
              <p style={{color:ic.txM,fontSize:13,margin:0}}>Acesso ao sistema clínico</p>
            </div>

            <div style={{marginBottom:14}}>
              <label style={SL_DARK}>Usuário ou E-mail</label>
              <input value={user} onChange={e=>setUser(e.target.value)}
                placeholder="usuário ou email@dominio.com"
                style={SI_DARK}
                onFocus={e=>e.target.style.borderColor=ic.inputFocus}
                onBlur={e=>e.target.style.borderColor=ic.inputBrd}
                onKeyDown={e=>e.key==="Enter"&&doCredentials()}
                autoComplete="username"/>
            </div>

            <div style={{marginBottom:18}}>
              <label style={SL_DARK}>Senha</label>
              <div style={{position:"relative"}}>
                <input type={showP?"text":"password"} value={pass}
                  onChange={e=>setPass(e.target.value)}
                  placeholder="••••••••"
                  style={{...SI_DARK,paddingRight:44}}
                  onFocus={e=>e.target.style.borderColor=ic.inputFocus}
                  onBlur={e=>e.target.style.borderColor=ic.inputBrd}
                  onKeyDown={e=>e.key==="Enter"&&doCredentials()}
                  autoComplete="current-password"/>
                <button onClick={()=>setShowP(s=>!s)} style={{position:"absolute",right:12,
                  top:"50%",transform:"translateY(-50%)",background:"none",border:"none",
                  cursor:"pointer",fontSize:15,color:ic.txM,padding:0}}>
                  {showP?"🙈":"👁"}
                </button>
              </div>
            </div>

            {err&&<div style={{background:ic.err,border:`1px solid ${ic.errBrd}`,borderRadius:9,
              padding:"9px 14px",color:"#ff9a8b",fontSize:12,marginBottom:12,textAlign:"center",
              backdropFilter:"blur(4px)"}}>❌ {err}</div>}

            {/* Lembrar login */}
            <label style={{display:"flex",alignItems:"center",gap:9,marginBottom:14,cursor:"pointer",userSelect:"none"}}>
              <div onClick={()=>setLembrar(l=>!l)}
                style={{width:18,height:18,borderRadius:5,flexShrink:0,
                  border:`2px solid ${lembrar?"#3b9de8":"rgba(255,255,255,.25)"}`,
                  background:lembrar?"#3b9de8":"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all .15s",cursor:"pointer"}}>
                {lembrar&&<span style={{color:"#fff",fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <span style={{color:"rgba(168,196,224,.75)",fontSize:12,fontWeight:500}}>
                Salvar login e senha neste dispositivo
              </span>
            </label>

            {/* Botão continuar */}
            <button onClick={doCredentials} style={{width:"100%",
              background:"linear-gradient(135deg,#1a5fa8,#2478cc)",
              color:"#fff",border:"none",borderRadius:12,padding:"14px",
              fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",
              marginBottom:10,boxShadow:"0 8px 24px rgba(26,95,168,.55)",
              transition:"all .18s"}}>
              Continuar →
            </button>

            {/* Divisor */}
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>
              <div style={{flex:1,height:1,background:ic.sep}}/>
              <span style={{color:ic.txM,fontSize:10,fontWeight:600}}>ou</span>
              <div style={{flex:1,height:1,background:ic.sep}}/>
            </div>

            {/* Certificado Digital */}
            <button onClick={()=>{
                const input=user.trim().toLowerCase();
                const f=users.find(u=>(u.u.toLowerCase()===input||(u.email&&u.email.toLowerCase()===input))&&u.s===pass);
                if(!f){setErr("Preencha usuário e senha antes de usar o certificado.");setTimeout(()=>setErr(""),3000);return;}
                setFound(f);setStep("cert");
              }} style={{width:"100%",background:ic.card,border:`1.5px solid ${ic.cardBrd}`,
              color:"rgba(180,218,240,.95)",borderRadius:12,padding:"12px",fontWeight:700,
              fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:12,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              backdropFilter:"blur(8px)",transition:"all .18s"}}>
              🏅 Entrar com Certificado Digital
            </button>

            <button onClick={()=>setForgot(true)} style={{width:"100%",background:"none",border:"none",
              color:ic.txM,cursor:"pointer",fontSize:12,fontFamily:"inherit",padding:"4px"}}>
              🔑 Esqueci minha senha
            </button>

            <p style={{color:"rgba(122,184,212,.45)",fontSize:10,textAlign:"center",marginTop:20}}>
              © 2026 Dra. Ilza Costa Ezequiel Neta
            </p>
          </div>
        )}

        {/* STEP 2: Certificado Digital */}
        {step==="cert"&&(
          <div>
            {/* Progresso */}
            <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:24,width:"100%"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:C.green,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,color:"#fff",fontWeight:800}}>✓</div>
                <span style={{fontSize:9,color:C.green,fontWeight:700}}>Credenciais</span>
              </div>
              <div style={{flex:1,height:2,background:`linear-gradient(90deg,${C.green},${C.p})`}}/>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:C.p,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,color:"#fff",fontWeight:800}}>2</div>
                <span style={{fontSize:9,color:ic.lbl,fontWeight:700}}>Certificado</span>
              </div>
            </div>

            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{width:56,height:56,borderRadius:16,
                background:"linear-gradient(135deg,#1a5fa8,#2478cc)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:26,margin:"0 auto 10px",boxShadow:`0 6px 20px ${C.p}40`}}>🏅</div>
              <h2 style={{color:"#fff",fontSize:18,fontWeight:800,margin:"0 0 4px",
                fontFamily:"Georgia,serif"}}>Certificado Digital</h2>
              <p style={{color:ic.txM,fontSize:12,margin:0}}>Autenticação ICP-Brasil · e-CPF médico</p>
            </div>

            <div onClick={()=>certRef.current&&certRef.current.click()}
              style={{border:`2px dashed ${certFile?"#4ade80":ic.cardBrd}`,borderRadius:12,
              padding:"18px 16px",textAlign:"center",cursor:"pointer",marginBottom:14,
              background:certFile?"rgba(74,222,128,.08)":ic.card,
              transition:"all .2s",backdropFilter:"blur(8px)"}}>
              <p style={{fontSize:28,margin:"0 0 6px"}}>{certFile?"✅":"📂"}</p>
              {certFile?(
                <>
                  <p style={{color:"#4ade80",fontWeight:700,fontSize:13,margin:"0 0 2px"}}>{certFile.name}</p>
                  <p style={{color:ic.txM,fontSize:11,margin:0}}>Titular: {certCN}</p>
                </>
              ):(
                <>
                  <p style={{color:ic.txS,fontWeight:600,fontSize:13,margin:"0 0 2px"}}>Clique para selecionar o certificado</p>
                  <p style={{color:ic.txM,fontSize:11,margin:0}}>Formatos aceitos: .pfx · .p12 (e-CPF ICP-Brasil)</p>
                </>
              )}
            </div>
            <input ref={certRef} type="file" accept=".pfx,.p12"
              onChange={e=>lerCertificado(e.target.files[0])} style={{display:"none"}}/>

            <div style={{marginBottom:16}}>
              <label style={SL_DARK}>PIN do Certificado</label>
              <input type="password" value={certPin}
                onChange={e=>setCertPin(e.target.value.replace(/\D/g,""))}
                placeholder="Digite o PIN numérico"
                style={SI_DARK} maxLength={8}
                onFocus={e=>e.target.style.borderColor=ic.inputFocus}
                onBlur={e=>e.target.style.borderColor=ic.inputBrd}
                onKeyDown={e=>e.key==="Enter"&&doCertLogin()}/>
            </div>

            {err&&<div style={{background:ic.err,border:`1px solid ${ic.errBrd}`,borderRadius:9,
              padding:"9px 14px",color:"#ff9a8b",fontSize:12,marginBottom:12,textAlign:"center"}}>❌ {err}</div>}

            <button onClick={doCertLogin} disabled={certLoading}
              style={{width:"100%",
                background:certLoading?"rgba(255,255,255,.12)":"linear-gradient(135deg,#1a5fa8,#2478cc)",
                color:"#fff",border:"none",borderRadius:12,padding:"14px",
                fontWeight:800,fontSize:14,cursor:certLoading?"not-allowed":"pointer",
                fontFamily:"inherit",marginBottom:10,
                boxShadow:certLoading?"none":"0 8px 24px rgba(26,95,168,.5)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {certLoading?(
                <><div style={{width:16,height:16,border:"2.5px solid rgba(255,255,255,.4)",
                  borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  Validando certificado...</>
              ):"🔐 Autenticar e Entrar"}
            </button>
            <button onClick={()=>{setStep("creds");setCertFile(null);setCertPin("");setCertCN("");setErr("");}}
              style={{width:"100%",background:"none",border:"none",color:ic.txM,
              cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>← Voltar</button>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ANAMNESE MODAL
════════════════════════════════════════════════════════════════ */
function AnamneseModal({paciente,saved={},onClose,onSave}){
  const [form,setForm]=useState({...saved});
  const [conf,setConf]=useState(null);
  function togChk(id,opt){setForm(p=>{const cur=p[id]||[];return{...p,[id]:cur.includes(opt)?cur.filter(x=>x!==opt):[...cur,opt]};});}
  return(
    <Modal title={`🩺 Anamnese — ${paciente.nm}`} onClose={()=>setConf("cancel")} width={680}>
      {conf==="cancel"&&<ConfirmPopup danger title="Cancelar Anamnese?" msg="As alterações não salvas serão perdidas. Deseja sair?" yesLabel="Sim, sair" noLabel="Continuar editando" onYes={onClose} onNo={()=>setConf(null)}/>}
      {conf==="save"&&<ConfirmPopup title="Salvar Anamnese?" msg={`Confirmar salvamento da anamnese de ${paciente.nm}?`} yesLabel="✅ Salvar" noLabel="Revisar" onYes={()=>{onSave({...form,_dt:new Date().toLocaleDateString("pt-BR")});onClose();}} onNo={()=>setConf(null)}/>}
      <div style={{marginBottom:14,padding:"10px 14px",background:`${C.p}10`,border:`1px solid ${C.p}25`,borderRadius:9}}>
        <p style={{color:C.p,fontSize:12,margin:0}}>Dra. Ilza Ezequiel · CRM SP 157236 · Gastroenterologia</p>
      </div>
      {ANAMNESE_F.map(f=>(
        <div key={f.id} style={{marginBottom:14}}>
          <label style={SL}>{f.lb}</label>
          {f.tp==="ta"&&<textarea value={form[f.id]||""} onChange={e=>setV(f.id,e.target.value)} placeholder={f.ph} rows={3} style={{...SI,resize:"vertical",lineHeight:1.6}}/>}
          {f.tp==="tx"&&<input value={form[f.id]||""} onChange={e=>setV(f.id,e.target.value)} placeholder={f.ph} style={SI}/>}
          {f.tp==="sel"&&<select value={form[f.id]||""} onChange={e=>setV(f.id,e.target.value)} style={SI}><option value="">Selecione...</option>{f.opts.map(o=><option key={o} value={o}>{o}</option>)}</select>}
          {f.tp==="chk"&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {f.opts.map(o=>{const checked=(form[f.id]||[]).includes(o);return <button key={o} onClick={()=>togChk(f.id,o)} style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${checked?C.p:C.brd}`,background:checked?`${C.p}12`:C.card2,color:checked?C.p:C.txS,fontWeight:checked?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{o}</button>;})}
            </div>
          )}
        </div>
      ))}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="g" onClick={()=>setConf("cancel")}>Cancelar</Btn>
        <Btn v="p" onClick={()=>setConf("save")}>✅ Salvar Anamnese</Btn>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   EXAME MODAL
════════════════════════════════════════════════════════════════ */
function ExameModal({onClose,onAdd}){
  const [cat,setCat]=useState("");const [item,setItem]=useState(null);
  const [conf,setConf]=useState(null);
  const grupo=EXAM_CAT.find(g=>g.cat===cat);
  return(
    <Modal title="➕ Adicionar Exame / Procedimento" onClose={()=>setConf("cancel")} width={520}>
      {conf==="cancel"&&<ConfirmPopup danger title="Cancelar?" msg="Deseja cancelar sem adicionar o procedimento?" yesLabel="Sim, cancelar" noLabel="Continuar" onYes={onClose} onNo={()=>setConf(null)}/>}
      {conf==="add"&&item&&<ConfirmPopup title="Adicionar Procedimento?" msg={`Confirmar: ${item.n}${item.v>0?" — R$ "+item.v:""}?`} yesLabel="✅ Adicionar" noLabel="Revisar" onYes={()=>{onAdd(item);onClose();}} onNo={()=>setConf(null)}/>}
      <div style={{marginBottom:14}}>
        <label style={SL}>Categoria</label>
        <select value={cat} onChange={e=>{setCat(e.target.value);setItem(null);}} style={SI}>
          <option value="">Selecione...</option>
          {EXAM_CAT.map(g=><option key={g.cat} value={g.cat}>{g.cat}</option>)}
        </select>
      </div>
      {grupo&&(
        <div style={{marginBottom:14}}>
          <label style={SL}>Procedimento</label>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {grupo.itens.map(it=>{const sel=item&&item.n===it.n;return(
              <div key={it.n} onClick={()=>setItem(it)} style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderRadius:9,cursor:"pointer",background:sel?`${C.p}10`:C.card2,border:`1.5px solid ${sel?C.p:C.brd}`}}>
                <span style={{fontWeight:sel?700:400,fontSize:13,color:sel?C.p:C.txS}}>{it.n}</span>
                <span style={{fontWeight:700,color:it.v>0?C.gold:C.txM,fontSize:13}}>{it.v>0?`R$ ${it.v}`:"Sem cobrança"}</span>
              </div>
            );})}
          </div>
        </div>
      )}
      {item&&<div style={{background:`${C.p}10`,border:`1px solid ${C.p}25`,borderRadius:8,padding:"10px 14px",marginBottom:14}}><p style={{color:C.p,fontWeight:700,fontSize:13,margin:0}}>✓ {item.n} — {item.v>0?`R$ ${item.v}`:"Sem cobrança"}</p></div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="g" onClick={()=>setConf("cancel")}>Cancelar</Btn>
        {item&&<Btn v="p" onClick={()=>setConf("add")}>✅ Adicionar</Btn>}
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   PRÉ-CADASTRO
════════════════════════════════════════════════════════════════ */
function PreCadPopup({cv,onClose,onSave,canal="WhatsApp"}){
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({nome:cv.nm||"",tel:cv.tel||"",email:"",plano:"Particular",origem:canal,queixa:"",data:"",hora:"",tag:"",obs:"",notifWa:true,notifEmail:false});
  const [conf,setConf]=useState(null);
  function setF(k,v){setForm(p=>({...p,[k]:v}));}
  const lastMsg=cv.msgs&&cv.msgs.length>0?cv.msgs[cv.msgs.length-1].tx:"";
  return(
    <Modal title="🆕 Pré-Cadastro — Novo Paciente" onClose={()=>setConf("cancel")} width={560}>
      {conf==="cancel"&&<ConfirmPopup danger title="Cancelar Pré-Cadastro?" msg="Os dados não serão salvos. Deseja sair mesmo assim?" yesLabel="Sim, sair" noLabel="Continuar" onYes={onClose} onNo={()=>setConf(null)}/>}
      {conf==="save"&&<ConfirmPopup title="Salvar Pré-Cadastro?" msg={`Confirmar o cadastro de "${form.nome||"novo paciente"}"?`} yesLabel="✅ Salvar" noLabel="Revisar" onYes={()=>onSave(form)} onNo={()=>setConf(null)}/>}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["📋 Dados","📅 Agenda","🏷️ Desfecho"].map((s,i)=>(
          <div key={s} onClick={()=>setStep(i+1)} style={{flex:1,padding:"8px",textAlign:"center",borderRadius:9,cursor:"pointer",background:step===i+1?`${C.p}15`:C.card2,border:`1.5px solid ${step===i+1?C.p:C.brd}`,color:step===i+1?C.p:C.txM,fontWeight:step===i+1?700:400,fontSize:12}}>{s}</div>
        ))}
      </div>
      {step===1&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:`${C.blue}10`,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.blue}25`}}><p style={{color:C.blue,fontSize:11,margin:0}}>💬 Última msg: "{lastMsg.slice(0,60)}"</p></div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
            <div><label style={SL}>Nome *</label><input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Nome completo" style={SI}/></div>
            <div><label style={SL}>Telefone</label><input value={form.tel} onChange={e=>setF("tel",e.target.value)} placeholder="(13) 9..." style={SI}/></div>
          </div>
          <div>
            <label style={SL}>E-mail</label>
            <input value={form.email} onChange={e=>setF("email",e.target.value)} placeholder="paciente@email.com" type="email" style={SI}/>
          </div>
          <div style={{background:`${C.p}06`,border:`1px solid ${C.p}18`,borderRadius:10,padding:"12px 14px"}}>
            <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 10px"}}>📬 Notificações — Selecione como enviar</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {[
                {k:"notifWa",   icon:"💬", label:"WhatsApp"},
                {k:"notifEmail",icon:"📧", label:"E-mail"},
                {k:"notifMemed",icon:"💊", label:"Receita MEMED"},
                {k:"notifSms",  icon:"📱", label:"SMS"},
              ].map(({k,icon,label})=>(
                <button
                  key={k}
                  onClick={()=>setF(k,!form[k])}
                  style={{
                    display:"flex",alignItems:"center",gap:6,
                    padding:"7px 12px",borderRadius:9,cursor:"pointer",
                    background:form[k]?`${C.p}15`:"#f5f7fa",
                    border:`1.5px solid ${form[k]?C.p:C.brd}`,
                    color:form[k]?C.p:C.txM,
                    fontWeight:form[k]?700:400,fontSize:12,fontFamily:"inherit",
                  }}
                >
                  <span style={{fontSize:14}}>{icon}</span>
                  {label}
                  {form[k]&&<span style={{background:C.p,color:"#fff",borderRadius:99,width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={SL}>Convênio</label><select value={form.plano} onChange={e=>setF("plano",e.target.value)} style={SI}>{["Particular","Unimed","Bradesco","Amil","SulAmérica","Outros"].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
            <div><label style={SL}>Origem</label><select value={form.origem} onChange={e=>setF("origem",e.target.value)} style={SI}>{["WhatsApp","Instagram","Site","Google","TikTok","Indicação","Outro"].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
          </div>
          <div><label style={SL}>Queixa Principal</label><textarea value={form.queixa} onChange={e=>setF("queixa",e.target.value)} placeholder="Ex: Refluxo, SIBO..." rows={3} style={{...SI,resize:"vertical"}}/></div>
          <div style={{display:"flex",justifyContent:"flex-end"}}><Btn v="p" onClick={()=>setStep(2)}>Próximo →</Btn></div>
        </div>
      )}
      {step===2&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:`${C.p}10`,border:`1px solid ${C.p}25`,borderRadius:9,padding:"10px 14px"}}><p style={{color:C.p,fontSize:12,margin:0,fontWeight:700}}>📅 Agendamento para {form.nome||"novo paciente"}</p></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={SL}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={SI}/></div>
            <div><label style={SL}>Horário</label><input type="time" value={form.hora} onChange={e=>setF("hora",e.target.value)} style={SI}/></div>
          </div>
          <div><label style={SL}>Observações</label><textarea value={form.obs} onChange={e=>setF("obs",e.target.value)} rows={3} style={{...SI,resize:"vertical"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><Btn v="g" onClick={()=>setStep(1)}>← Voltar</Btn><Btn v="p" onClick={()=>setStep(3)}>Próximo →</Btn></div>
        </div>
      )}
      {step===3&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <p style={{color:C.txM,fontSize:12,marginBottom:4}}>Se não converteu, selecione o motivo:</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {TAGS_NAO.map(t=>{const sel=form.tag===t;return <div key={t} onClick={()=>setF("tag",sel?"":t)} style={{padding:"9px 12px",borderRadius:8,cursor:"pointer",background:sel?"rgba(192,57,43,.1)":C.card2,border:`1.5px solid ${sel?C.red:C.brd}`,color:sel?C.red:C.txS,fontSize:12,fontWeight:sel?700:400}}>{t}</div>;})}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            <Btn v="g" onClick={()=>setStep(2)}>← Voltar</Btn>
            <Btn v="p" onClick={()=>setConf("save")}>✅ Salvar Pré-Cadastro</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   MEMED — PRESCRIÇÃO DIGITAL
════════════════════════════════════════════════════════════════ */
const MEMED_SCRIPT_URL="https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";
const MEMED_CONTAINER_ID="memed-sinapse-container";

function MemedModal({paciente,onClose,onSalvar,token}){
  const [memedToken,setMemedToken]=useState(token||"");
  const [status,setStatus]=useState(token?"carregando":"aguardando");// aguardando|carregando|pronto|erro
  const [rxGerada,setRxGerada]=useState(null);
  const scriptRef=useRef(null);
  const listenerRef=useRef(null);

  /* ── carrega SDK quando token disponível ── */
  useEffect(()=>{
    if(!memedToken) return;
    setStatus("carregando");

    // Remove script anterior se existir
    const old=document.getElementById("memed-sdk-script");
    if(old) old.remove();
    if(window.MedJS){try{window.MedJS.hide();}catch(e){}}

    const s=document.createElement("script");
    s.id="memed-sdk-script";
    s.src=MEMED_SCRIPT_URL;
    s.setAttribute("data-token",memedToken);
    s.setAttribute("data-container",MEMED_CONTAINER_ID);
    s.onload=()=>{
      setStatus("pronto");
      setTimeout(()=>{
        try{
          window.MedJS.setPatient({
            nome:paciente.nm,
            cpf:paciente.cpf?paciente.cpf.replace(/\D/g,""):"",
            data_nascimento:paciente.nasc||"",
            peso:"",altura:""
          });
          window.MedJS.show();
        }catch(e){console.warn("MedJS setPatient:",e);}
      },800);
    };
    s.onerror=()=>setStatus("erro");
    document.head.appendChild(s);
    scriptRef.current=s;

    /* ── listener evento prescrição gerada ── */
    listenerRef.current=(e)=>{
      const rx=e.detail||e;
      const link=rx?.data?.[0]?.attributes?.link||rx?.link||null;
      const digits=rx?.data?.[0]?.attributes?.digits||rx?.digits||null;
      if(link){
        setRxGerada({link,digits,dt:new Date().toLocaleDateString("pt-BR"),paciente:paciente.nm});
        try{window.MedJS.hide();}catch(e){}
      }
    };
    document.addEventListener("prescricao-executada",listenerRef.current);

    return()=>{
      if(listenerRef.current) document.removeEventListener("prescricao-executada",listenerRef.current);
    };
  },[memedToken]);

  /* ── fecha e limpa ── */
  function handleClose(){
    try{if(window.MedJS)window.MedJS.hide();}catch(e){}
    onClose();
  }

  return(
    <div style={{position:"fixed",inset:0,paddingLeft:"var(--sidebar-w,0px)",background:"rgba(0,0,0,.65)",zIndex:999999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 12px 24px",overflowY:"auto"}}>
      <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:900,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}>

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.brd}`,background:"linear-gradient(135deg,#0d2137,#1a5fa8)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <p style={{color:"#fff",fontWeight:800,fontSize:16,margin:0}}>💊 Prescrição Digital — MEMED</p>
            <p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:"2px 0 0"}}>{paciente.nm}{paciente.pront?` · Paciente #${paciente.pront}`:""}</p>
          </div>
          <button onClick={handleClose} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,fontSize:13}}>✕ Fechar</button>
        </div>

        {/* Token input se não tiver */}
        {!memedToken&&(
          <div style={{padding:24,flex:1,display:"flex",flexDirection:"column",gap:16,alignItems:"center",justifyContent:"center"}}>
            <div style={{textAlign:"center",marginBottom:8}}>
              <p style={{fontSize:32,margin:"0 0 8px"}}>🔑</p>
              <p style={{color:C.tx,fontWeight:700,fontSize:16,margin:"0 0 4px"}}>Token MEMED necessário</p>
              <p style={{color:C.txM,fontSize:13,margin:0}}>Cole o token obtido via API MEMED (campo <code>data.attributes.token</code>)</p>
            </div>
            <input
              placeholder="Token MEMED do médico (ex: eyJhbGciOiJSUzI1...)"
              style={{width:"100%",maxWidth:540,padding:"12px 16px",borderRadius:10,border:`1.5px solid ${C.brd}`,fontSize:13,fontFamily:"monospace",outline:"none"}}
              onChange={e=>setMemedToken(e.target.value)}
            />
            <div style={{background:`${C.p}08`,border:`1px solid ${C.p}20`,borderRadius:12,padding:"12px 18px",maxWidth:540,width:"100%"}}>
              <p style={{color:C.p,fontWeight:700,fontSize:12,margin:"0 0 6px"}}>ℹ️ Como obter o token:</p>
              <p style={{color:C.txS,fontSize:12,margin:"0 0 4px"}}>1. Backend faz POST em <code>integrations.api.memed.com.br/v1/sinapse-prescricao/usuarios</code></p>
              <p style={{color:C.txS,fontSize:12,margin:"0 0 4px"}}>2. Payload: CRM, nome, especialidade da Dra. Ilza</p>
              <p style={{color:C.txS,fontSize:12,margin:0}}>3. Retorno: <code>data.attributes.token</code> → cole aqui</p>
            </div>
            <Btn v="p" onClick={()=>{if(memedToken.length>10)setStatus("carregando");}}>🚀 Carregar MEMED</Btn>
          </div>
        )}

        {/* Status carregando */}
        {memedToken&&status==="carregando"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
            <div style={{width:40,height:40,border:`4px solid ${C.brd}`,borderTopColor:C.p,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <p style={{color:C.txM,fontSize:13}}>Carregando plataforma MEMED...</p>
          </div>
        )}

        {/* Status erro */}
        {status==="erro"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
            <p style={{fontSize:40}}>❌</p>
            <p style={{color:C.red,fontWeight:700}}>Falha ao carregar SDK MEMED</p>
            <p style={{color:C.txM,fontSize:12}}>Verifique o token e tente novamente</p>
            <Btn v="red" onClick={()=>{setMemedToken("");setStatus("aguardando");}}>Tentar novamente</Btn>
          </div>
        )}

        {/* Receita gerada com sucesso */}
        {rxGerada&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:24}}>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:48,margin:"0 0 8px"}}>✅</p>
              <p style={{color:C.green,fontWeight:800,fontSize:18,margin:"0 0 4px"}}>Prescrição gerada!</p>
              <p style={{color:C.txM,fontSize:13}}>{rxGerada.dt} · {rxGerada.paciente}</p>
            </div>
            <div style={{background:`${C.green}08`,border:`1px solid ${C.green}30`,borderRadius:14,padding:"16px 24px",textAlign:"center",width:"100%",maxWidth:440}}>
              <p style={{color:C.txM,fontSize:11,fontWeight:700,margin:"0 0 6px",textTransform:"uppercase"}}>Link da receita</p>
              <a href={rxGerada.link} target="_blank" rel="noreferrer" style={{color:C.p,fontWeight:700,fontSize:14,wordBreak:"break-all"}}>{rxGerada.link}</a>
              {rxGerada.digits&&<p style={{color:C.txM,fontSize:12,margin:"8px 0 0"}}>Código de desbloqueio: <b style={{color:C.tx}}>{rxGerada.digits}</b></p>}
            </div>
            {/* ── Botões de envio ── */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
              <Btn v="p" onClick={()=>{onSalvar(rxGerada);handleClose();}}>💾 Salvar</Btn>

              {/* WhatsApp — abre conversa com o número do paciente se disponível */}
              <Btn v="wa" onClick={()=>{
                const tel=(paciente.tel||"").replace(/\D/g,"");
                const txt="Receita Digital — Dra. Ilza Ezequiel\n"+rxGerada.link+(rxGerada.digits?"\nCódigo: "+rxGerada.digits:"");
                const url=tel?"https://wa.me/55"+tel+"?text="+encodeURIComponent(txt):"https://wa.me/?text="+encodeURIComponent(txt);
                window.open(url,"_blank");
              }}>💬 WhatsApp</Btn>

              {/* SMS — abre app de SMS nativo com o número */}
              <Btn v="teal" onClick={()=>{
                const tel=(paciente.tel||"").replace(/\D/g,"");
                const txt="Receita Digital Dra. Ilza Ezequiel: "+rxGerada.link+(rxGerada.digits?" | Cod: "+rxGerada.digits:"");
                const url=tel?"sms:+55"+tel+"?body="+encodeURIComponent(txt):"sms:?body="+encodeURIComponent(txt);
                window.open(url,"_blank");
              }}>📱 SMS</Btn>

              {/* E-mail */}
              <Btn v="blue" onClick={()=>{
                const dest=paciente.email||"";
                const sub=encodeURIComponent("Sua Receita Digital — Dra. Ilza Ezequiel");
                const body=encodeURIComponent(
                  "Olá "+paciente.nm.split(" ")[0]+",\n\n"+
                  "Segue o link da sua receita digital:\n"+rxGerada.link+
                  (rxGerada.digits?"\nCódigo de retirada: "+rxGerada.digits:"")+
                  "\n\nDúvidas: (13) 97802-8137\nDra. Ilza Ezequiel | Gastroenterologia"
                );
                // Envia receita por email via EmailJS
                EJS.send(EJS.TEMPLATES.consulta, {
                  to_email:    dest || EMAIL_DRA,
                  to_email_cc: EMAIL_DRA,
                  paciente:    paciente.nm,
                  data: new Date().toLocaleDateString("pt-BR"),
                  horario: "—", modalidade: "Receita Digital",
                  procedimento: "Receita: " + (rxGerada?.medicamento||""),
                  observacoes: rxGerada?.link || "",
                  link_tele: rxGerada?.digits ? "Código: "+rxGerada.digits : "—",
                  clinica: "Dra. Ilza Ezequiel | Gastroenterologia",
                });
              }}>📧 E-mail{!paciente.email&&<span style={{fontSize:9,opacity:.6,marginLeft:3}}>(sem e-mail)</span>}</Btn>

              <Btn v="g" onClick={()=>{setRxGerada(null);setStatus("pronto");try{window.MedJS.show();}catch(e){}}}>+ Nova</Btn>
            </div>
          </div>
        )}

        {/* Container MEMED SDK — sempre renderizado para o script injetar */}
        <div
          id={MEMED_CONTAINER_ID}
          style={{flex:1,minHeight:460,display:(memedToken&&status==="pronto"&&!rxGerada)?"flex":"none",flexDirection:"column"}}
        />

        {/* CSS spin */}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODAL PAGAMENTOS — Ficha do Paciente
════════════════════════════════════════════════════════════════ */
function PagamentoModal({paciente,lista,onClose,onSave}){
  const [itens,setItens]=useState(lista||[]);
  const [form,setForm]=useState({desc:"",vl:"",dt:new Date().toISOString().split("T")[0],forma:"Pix",st:"pago",obs:""});
  const [adicionando,setAdicionando]=useState(lista.length===0);
  const [conf,setConf]=useState(null);
  const [delId,setDelId]=useState(null);

  function setF(k,v){setForm(p=>({...p,[k]:v}));}

  function addPag(){
    if(!form.vl||!form.dt){alert("Informe o valor e a data");return;}
    const novo={id:`pg${Date.now()}`,desc:form.desc||"Pagamento",vl:parseFloat(form.vl),dt:form.dt,forma:form.forma,st:form.st,obs:form.obs};
    const novaLista=[...itens,novo];
    setItens(novaLista);
    onSave(novaLista);
    setForm({desc:"",vl:"",dt:new Date().toISOString().split("T")[0],forma:"Pix",st:"pago",obs:""});
    setAdicionando(false);
  }

  function removePag(id){
    const novaLista=itens.filter(p=>p.id!==id);
    setItens(novaLista);
    onSave(novaLista);
    setDelId(null);
  }

  const totalPago=itens.filter(p=>p.st==="pago").reduce((s,p)=>s+(parseFloat(p.vl)||0),0);
  const totalPend=itens.filter(p=>p.st==="pendente").reduce((s,p)=>s+(parseFloat(p.vl)||0),0);

  const COR_ST={pago:C.green,pendente:C.amber,parcial:C.amber,estorno:C.red};
  const ICON_ST={pago:"✅",pendente:"⏳",parcial:"💛",estorno:"↩️"};

  return(
    <Modal title={`💰 Pagamentos — ${paciente.nm}`} onClose={onClose} width={560}>
      {delId&&<ConfirmPopup danger title="Excluir pagamento?" msg="Deseja remover este registro de pagamento?" yesLabel="🗑️ Excluir" noLabel="Cancelar" onYes={()=>removePag(delId)} onNo={()=>setDelId(null)}/>}

      {/* Resumo topo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div style={{background:`${C.green}10`,border:`1px solid ${C.green}30`,borderRadius:11,padding:"12px 16px",textAlign:"center"}}>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 4px"}}>✅ Total Pago</p>
          <p style={{color:C.green,fontSize:20,fontWeight:800,margin:0}}>{fmtMoeda(totalPago)}</p>
        </div>
        <div style={{background:`${C.amber}10`,border:`1px solid ${C.amber}30`,borderRadius:11,padding:"12px 16px",textAlign:"center"}}>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 4px"}}>⏳ A Receber</p>
          <p style={{color:C.amber,fontSize:20,fontWeight:800,margin:0}}>{fmtMoeda(totalPend)}</p>
        </div>
      </div>

      {/* Lista de pagamentos existentes */}
      {itens.length>0&&(
        <div style={{borderRadius:11,border:`1px solid ${C.brd}`,overflow:"hidden",marginBottom:16}}>
          <div style={{background:C.card2,padding:"8px 14px",borderBottom:`1px solid ${C.brd}`}}>
            <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:0}}>📋 Histórico de Pagamentos</p>
          </div>
          {[...itens].sort((a,b)=>b.dt>a.dt?1:-1).map((pg,i)=>(
            <div key={pg.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:i<itens.length-1?`1px solid ${C.brd}`:undefined,background:"#fff"}}>
              <div>
                <p style={{color:C.tx,fontWeight:700,fontSize:13,margin:0}}>{pg.desc}</p>
                <p style={{color:C.txM,fontSize:11,margin:"2px 0 0"}}>{pg.dt&&new Date(pg.dt+"T00:00").toLocaleDateString("pt-BR")} · {pg.forma}</p>
                {pg.obs&&<p style={{color:C.txM,fontSize:10,margin:"1px 0 0",fontStyle:"italic"}}>{pg.obs}</p>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{background:`${COR_ST[pg.st]||C.txM}12`,color:COR_ST[pg.st]||C.txM,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                  {ICON_ST[pg.st]||"❓"} {pg.st}
                </span>
                <span style={{color:C.gold,fontWeight:800,fontSize:14}}>{fmtMoeda(pg.vl)}</span>
                <button onClick={()=>setDelId(pg.id)} title="Excluir" style={{background:"rgba(192,57,43,.08)",border:"1px solid rgba(192,57,43,.2)",color:C.red,borderRadius:6,padding:"3px 7px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
              </div>
            </div>
          ))}
          {/* Total da lista */}
          <div style={{padding:"10px 14px",background:C.card2,borderTop:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.txM,fontSize:11,fontWeight:700}}>Total geral</span>
            <span style={{color:C.tx,fontWeight:800,fontSize:14}}>{fmtMoeda(itens.reduce((s,p)=>s+(parseFloat(p.vl)||0),0))}</span>
          </div>
        </div>
      )}

      {/* Formulário de novo pagamento */}
      {adicionando?(
        <div style={{background:`${C.green}05`,border:`1.5px solid ${C.green}30`,borderRadius:12,padding:16}}>
          <p style={{color:C.green,fontWeight:700,fontSize:12,textTransform:"uppercase",margin:"0 0 14px"}}>➕ Novo Registro de Pagamento</p>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={SL}>Descrição</label>
              <input value={form.desc} onChange={e=>setF("desc",e.target.value)} placeholder="Ex: Consulta Gastro, Retorno, Teste SIBO..." style={SI}/>
            </div>
            <div>
              <label style={SL}>Valor (R$) *</label>
              <input type="number" step="0.01" value={form.vl} onChange={e=>setF("vl",e.target.value)} placeholder="0,00" style={SI}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={SL}>Data *</label>
              <input type="date" value={form.dt} onChange={e=>setF("dt",e.target.value)} style={SI}/>
            </div>
            <div>
              <label style={SL}>Forma de Pagamento</label>
              <select value={form.forma} onChange={e=>setF("forma",e.target.value)} style={SI}>
                {["Pix","Dinheiro","Cartão Débito","Cartão Crédito","Transferência","Boleto","Cheque","Convênio"].map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={SL}>Status</label>
              <select value={form.st} onChange={e=>setF("st",e.target.value)} style={SI}>
                <option value="pago">✅ Pago</option>
                <option value="pendente">⏳ Pendente</option>
                <option value="parcial">💛 Parcial</option>
                <option value="estorno">↩️ Estorno</option>
              </select>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={SL}>Observações</label>
            <input value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Ex: comprovante enviado por WhatsApp..." style={SI}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="g" onClick={()=>setAdicionando(false)}>Cancelar</Btn>
            <Btn v="green" onClick={addPag}>✅ Salvar Pagamento</Btn>
          </div>
        </div>
      ):(
        <div style={{display:"flex",justifyContent:"center",marginTop:4}}>
          <Btn v="green" onClick={()=>setAdicionando(true)}>+ Registrar Novo Pagamento</Btn>
        </div>
      )}
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODAL NOTA FISCAL — Município de Santos-SP
════════════════════════════════════════════════════════════════ */
function NotaFiscalModal({paciente,total,pagamentos,procs,onClose,onEmitida}){
  const today=new Date();
  const [nfEmitida,setNfEmitida]=useState(false);
  const [nfEnvioPopup,setNfEnvioPopup]=useState(false); // popup: foi enviada ao paciente?
  const [nf,setNF]=useState({
    numero:String(Math.floor(10000+Math.random()*89999)),
    dt:today.toISOString().split("T")[0],
    competencia:`${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`,
    tomadorNome:paciente.nm||"",
    tomadorCpf:paciente.cpf||"",
    tomadorEnd:"",
    tomadorCidade:"Santos",
    tomadorUF:"SP",
    tomadorCep:"",
    discriminacao:procs.length>0?procs.map(p=>`${p.n} em ${p.dt}`).join(" | "):"Consulta Médica — Gastroenterologia",
    vl:total>0?total.toFixed(2):"",
    deducoes:"0,00",
    iss:"2,00",
    retIR:false,
    retCSLL:false,
    retCOFINS:false,
    retPIS:false,
    optanteSimplesNacional:true,
    incentivoFiscal:false,
    natureza:1,
  });

  function setNFv(k,v){setNF(p=>({...p,[k]:v}));}

  const baseCalculo=(parseFloat(nf.vl)||0)-(parseFloat((nf.deducoes||"0").replace(",","."))||0);
  const issValor=baseCalculo*(parseFloat(nf.iss)/100)||0;
  const totalNF=parseFloat(nf.vl)||0;
  const totalPago=(pagamentos||[]).filter(p=>p.st==="pago").reduce((s,p)=>s+(parseFloat(p.vl)||0),0);

  function emitirNF(){
    const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>NFS-e Santos — Nº ${nf.numero}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:20px;background:#f5f5f5}
  .nf{max-width:760px;margin:0 auto;background:#fff;border:2px solid #003399;border-radius:4px;overflow:hidden}
  .header{background:linear-gradient(135deg,#003399,#0055cc);color:#fff;padding:16px 20px}
  .header h1{margin:0;font-size:18px}
  .header p{margin:3px 0 0;font-size:11px;opacity:.85}
  .header-badges{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .badge{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700}
  .badge.aut{background:rgba(0,200,100,.3);border-color:rgba(0,200,100,.6)}
  .section{padding:14px 20px;border-bottom:1px solid #e0e0e0}
  .section-title{color:#003399;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;padding-bottom:5px;border-bottom:2px solid #003399}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .field{margin-bottom:6px}
  .field label{color:#666;font-size:9px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px}
  .field span{color:#1a1a1a;font-size:12px;font-weight:600}
  .discriminacao{background:#f8f9fa;border:1px solid #d0d0d0;border-radius:4px;padding:10px;font-size:12px;color:#333;line-height:1.6}
  .valores{background:#f0f4ff;border:1px solid #c0cce8}
  .vl-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #dce6f0}
  .vl-row:last-child{border:none;font-weight:800;font-size:14px;color:#003399}
  .qrcode{text-align:center;padding:16px;border-top:1px solid #e0e0e0}
  .qrcode p{color:#666;font-size:10px;margin:4px 0 0}
  .footer{background:#003399;color:#fff;padding:10px 20px;font-size:9px;opacity:.8;text-align:center}
  .status-pago{background:#e8f5e9;border:1px solid #4caf50;color:#1b5e20;padding:8px 14px;border-radius:4px;font-weight:700;text-align:center;margin:10px 20px}
  @media print{body{padding:0;background:#fff}.no-print{display:none}}
</style>
</head>
<body>
<div class="nf">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>🏥 NFS-e — Nota Fiscal de Serviços Eletrônica</h1>
        <p>Prefeitura Municipal de Santos — SP</p>
        <p>Sistema de Notas Fiscais — Módulo Saúde</p>
      </div>
      <div style="text-align:right">
        <p style="font-size:22px;font-weight:800;margin:0">Nº ${nf.numero}</p>
        <p style="font-size:10px;margin:2px 0 0">Emitida em ${new Date(nf.dt+"T00:00").toLocaleDateString("pt-BR")}</p>
        <p style="font-size:10px;margin:2px 0 0">Competência: ${nf.competencia}</p>
      </div>
    </div>
    <div class="header-badges">
      <span class="badge aut">✅ AUTORIZADA</span>
      <span class="badge">Santos - SP · CNPJ 29.774.291/0001-57</span>
      <span class="badge">ISS ${nf.iss}% · Simples Nacional</span>
      <span class="badge">Código Serviço: 8.01</span>
    </div>
  </div>

  <div class="section">
    <p class="section-title">🏢 Prestador de Serviços</p>
    <div class="grid2">
      <div class="field"><label>Razão Social</label><span>Ilza Ezequiel — Medicina</span></div>
      <div class="field"><label>Nome Fantasia</label><span>Dra. Ilza Ezequiel — Gastroenterologia</span></div>
      <div class="field"><label>CNPJ</label><span>29.774.291/0001-57</span></div>
      <div class="field"><label>CRM</label><span>SP 157236</span></div>
      <div class="field"><label>Endereço</label><span>Av. Senador Feijó, 821 — Santos-SP</span></div>
      <div class="field"><label>Município Prestação</label><span>Santos — SP · IBGE 3548500</span></div>
      <div class="field"><label>Telefone</label><span>(13) 97802-8137</span></div>
      <div class="field"><label>E-mail</label><span>ilzaeneta@gmail.com</span></div>
    </div>
  </div>

  <div class="section">
    <p class="section-title">👤 Tomador de Serviços (Paciente)</p>
    <div class="grid2">
      <div class="field"><label>Nome</label><span>${nf.tomadorNome}</span></div>
      <div class="field"><label>CPF</label><span>${nf.tomadorCpf||"Não informado"}</span></div>
      <div class="field"><label>Endereço</label><span>${nf.tomadorEnd||"Não informado"}</span></div>
      <div class="field"><label>Município</label><span>${nf.tomadorCidade} — ${nf.tomadorUF}</span></div>
      ${nf.tomadorCep?`<div class="field"><label>CEP</label><span>${nf.tomadorCep}</span></div>`:""}
    </div>
  </div>

  <div class="section">
    <p class="section-title">📋 Discriminação dos Serviços</p>
    <div class="discriminacao">${nf.discriminacao}</div>
    <p style="color:#666;font-size:10px;margin:8px 0 0">Código de Tributação (LC 116/2003): <b>8.01 — Medicina e biomedicina</b> · Município de incidência: <b>Santos-SP</b></p>
  </div>

  <div class="section valores">
    <p class="section-title">💰 Valores</p>
    <div class="vl-row"><span>Valor dos Serviços</span><span>R$ ${(parseFloat(nf.vl)||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
    <div class="vl-row"><span>Deduções</span><span>R$ ${(parseFloat((nf.deducoes||"0").replace(",","."))||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
    <div class="vl-row"><span>Base de Cálculo</span><span>R$ ${baseCalculo.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
    <div class="vl-row"><span>Alíquota ISS (${nf.iss}%) — Santos-SP</span><span>R$ ${issValor.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
    ${nf.optanteSimplesNacional?`<div class="vl-row"><span>Optante Simples Nacional</span><span style="color:#1b5e20;font-weight:700">Sim — ISS recolhido pelo prestador</span></div>`:""}
    <div class="vl-row"><span style="color:#003399;font-size:15px;font-weight:800">TOTAL DA NOTA</span><span style="color:#003399;font-size:15px">R$ ${totalNF.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></div>
  </div>

  ${totalPago>0?`<div class="status-pago">✅ Pagamento confirmado: R$ ${totalPago.toLocaleString("pt-BR",{minimumFractionDigits:2})} recebido</div>`:""}

  <div class="qrcode">
    <div style="width:90px;height:90px;background:#f0f0f0;border:2px dashed #999;display:inline-flex;align-items:center;justify-content:center;font-size:28px">📱</div>
    <p>QR Code — NFS-e Santos</p>
    <p style="font-family:monospace;font-size:9px;color:#999">Código de Verificação: ${nf.numero}-${Date.now().toString(36).toUpperCase()}-SANTOS</p>
  </div>

  <div class="footer">
    NFS-e emitida conforme Lei Municipal de Santos e LC 116/2003 · LGPD — Dado Protegido de Saúde · Dra. Ilza Ezequiel · CRM SP 157236
  </div>
</div>

<div class="no-print" style="max-width:760px;margin:16px auto;display:flex;gap:10px;justify-content:flex-end">
  <button onclick="window.print()" style="background:#003399;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
</body>
</html>`;
    const w=window.open("","_blank","width=850,height=800");
    if(w){w.document.write(html);w.document.close();}
    setNfEmitida(true);
    if(onEmitida) onEmitida();
    setTimeout(()=>setNfEnvioPopup(true),600);
  }

  return(
    <Modal title={`🧾 Nota Fiscal — ${paciente.nm}`} onClose={onClose} width={620}>
      {/* Popup: NF foi enviada ao paciente? */}
      {nfEnvioPopup&&(
    <div onMouseDown={e=>e.stopPropagation()} style={{position:"fixed",inset:0,paddingLeft:"var(--sidebar-w,0px)",background:"rgba(0,0,0,.55)",zIndex:999999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 16px 24px",overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:420,padding:30,boxShadow:"0 24px 60px rgba(0,0,0,.3)",textAlign:"center",border:"2px solid #003399"}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:"#e8f0ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px"}}>🧾</div>
            <p style={{color:"#003399",fontWeight:900,fontSize:17,margin:"0 0 8px",fontFamily:"Georgia,serif"}}>Nota Fiscal Emitida!</p>
            <p style={{color:"#4a5568",fontSize:13,margin:"0 0 6px",lineHeight:1.6}}>A NFS-e <strong>Nº {nf.numero}</strong> foi gerada para <strong>{paciente.nm}</strong>.</p>
            <p style={{color:"#718096",fontSize:12,margin:"0 0 24px"}}>A nota fiscal foi enviada ao paciente?</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                setNfEnvioPopup(false);
                const n=paciente.tel?.replace(/\D/g,"");
                if(n) window.open(`https://wa.me/55${n}?text=${encodeURIComponent("Olá "+paciente.nm.split(" ")[0]+"! Segue sua Nota Fiscal de Serviços (NFS-e) nº "+nf.numero+" referente ao atendimento com a Dra. Ilza Ezequiel. Gastroenterologia · (13) 97802-8137")}`, "_blank");
              }} style={{flex:1,background:"linear-gradient(135deg,#128c7e,#25d366)",color:"#fff",border:"none",borderRadius:11,padding:"12px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                ✅ Sim — Enviar WA
              </button>
              <button onClick={()=>setNfEnvioPopup(false)} style={{flex:1,background:"rgba(192,57,43,.08)",border:"1.5px solid rgba(192,57,43,.3)",color:"#c0392b",borderRadius:11,padding:"12px",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                ❌ Não enviada
              </button>
            </div>
            <button onClick={()=>setNfEnvioPopup(false)} style={{marginTop:12,background:"none",border:"none",color:"#718096",fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Fechar</button>
          </div>
        </div>
      )}
      {/* Info Santos */}
      <div style={{background:"#e8f0ff",border:"1px solid #003399",borderRadius:10,padding:"10px 14px",marginBottom:18,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:22}}>🏙️</span>
        <div>
          <p style={{color:"#003399",fontWeight:700,fontSize:12,margin:0}}>NFS-e — Município de Santos-SP</p>
          <p style={{color:"#0044aa",fontSize:11,margin:"2px 0 0"}}>CNPJ 29.774.291/0001-57 · CRM SP 157236 · Código Serviço 8.01 · ISS 2%</p>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <div><label style={SL}>Nº NFS-e</label><input value={nf.numero} onChange={e=>setNFv("numero",e.target.value)} style={SI}/></div>
        <div><label style={SL}>Data Emissão</label><input type="date" value={nf.dt} onChange={e=>setNFv("dt",e.target.value)} style={SI}/></div>
        <div><label style={SL}>Competência</label><input value={nf.competencia} onChange={e=>setNFv("competencia",e.target.value)} placeholder="MM/AAAA" style={SI}/></div>
      </div>

      {/* Tomador */}
      <div style={{border:`1px solid ${C.brd}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
        <div style={{background:C.card2,padding:"8px 14px",borderBottom:`1px solid ${C.brd}`}}><p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:0}}>👤 Tomador (Paciente)</p></div>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
            <div><label style={SL}>Nome Completo</label><input value={nf.tomadorNome} onChange={e=>setNFv("tomadorNome",e.target.value)} style={SI}/></div>
            <div><label style={SL}>CPF</label><input value={nf.tomadorCpf} onChange={e=>setNFv("tomadorCpf",e.target.value)} placeholder="000.000.000-00" style={SI}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
            <div><label style={SL}>Endereço</label><input value={nf.tomadorEnd} onChange={e=>setNFv("tomadorEnd",e.target.value)} placeholder="Rua, nº, bairro" style={SI}/></div>
            <div><label style={SL}>Município</label><input value={nf.tomadorCidade} onChange={e=>setNFv("tomadorCidade",e.target.value)} style={SI}/></div>
            <div><label style={SL}>CEP</label><input value={nf.tomadorCep} onChange={e=>setNFv("tomadorCep",e.target.value)} placeholder="00000-000" style={SI}/></div>
          </div>
        </div>
      </div>

      {/* Serviço e valores */}
      <div style={{border:`1px solid ${C.brd}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
        <div style={{background:C.card2,padding:"8px 14px",borderBottom:`1px solid ${C.brd}`}}><p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:0}}>💰 Serviço e Valores</p></div>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={SL}>Discriminação dos Serviços</label><textarea value={nf.discriminacao} onChange={e=>setNFv("discriminacao",e.target.value)} rows={3} style={{...SI,resize:"vertical",lineHeight:1.5}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><label style={SL}>Valor Total (R$)</label><input type="number" step="0.01" value={nf.vl} onChange={e=>setNFv("vl",e.target.value)} placeholder="0,00" style={SI}/></div>
            <div><label style={SL}>Deduções (R$)</label><input value={nf.deducoes} onChange={e=>setNFv("deducoes",e.target.value)} placeholder="0,00" style={SI}/></div>
            <div><label style={SL}>Alíquota ISS (%)</label><input type="number" step="0.01" value={nf.iss} onChange={e=>setNFv("iss",e.target.value)} style={SI}/></div>
          </div>
          {/* Preview cálculo */}
          {nf.vl&&(
            <div style={{background:`${C.p}06`,border:`1px solid ${C.p}18`,borderRadius:9,padding:"10px 14px",display:"flex",gap:24,flexWrap:"wrap"}}>
              <div><p style={{color:C.txM,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>BASE CÁLCULO</p><p style={{color:C.tx,fontSize:14,fontWeight:800,margin:0}}>R$ {baseCalculo.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>
              <div><p style={{color:C.txM,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>ISS ({nf.iss}%)</p><p style={{color:C.amber,fontSize:14,fontWeight:800,margin:0}}>R$ {issValor.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>
              <div><p style={{color:C.txM,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>TOTAL NF</p><p style={{color:C.p,fontSize:16,fontWeight:800,margin:0}}>R$ {totalNF.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>
              {totalPago>0&&<div><p style={{color:C.txM,fontSize:10,fontWeight:700,margin:"0 0 2px"}}>JÁ PAGO</p><p style={{color:C.green,fontSize:14,fontWeight:800,margin:0}}>R$ {totalPago.toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>}
            </div>
          )}
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12,color:C.txS,fontWeight:600}}>
              <input type="checkbox" checked={nf.optanteSimplesNacional} onChange={e=>setNFv("optanteSimplesNacional",e.target.checked)} style={{width:15,height:15}}/>
              Optante Simples Nacional
            </label>
            <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12,color:C.txS,fontWeight:600}}>
              <input type="checkbox" checked={nf.incentivoFiscal} onChange={e=>setNFv("incentivoFiscal",e.target.checked)} style={{width:15,height:15}}/>
              Incentivo Fiscal
            </label>
            <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12,color:C.txS,fontWeight:600}}>
              <input type="checkbox" checked={nf.retIR} onChange={e=>setNFv("retIR",e.target.checked)} style={{width:15,height:15}}/>
              Retenção IR
            </label>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn v="g" onClick={onClose}>Fechar</Btn>
        <Btn v="p" onClick={emitirNF} disabled={!nf.vl||!nf.tomadorNome}>🧾 Emitir / Imprimir NF</Btn>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODAL CADASTRO COMPLETO — Novo Paciente  (v21)
════════════════════════════════════════════════════════════════ */
function NovoPacienteModal({onClose,onSalvar}){
  const STEPS=["👤 Pessoal","📄 Documentos","📞 Contato","📍 Endereço","➕ Complementar"];
  const [step,setStep]=useState(0);
  const [conf,setConf]=useState(null);
  const [cepLoading,setCepLoading]=useState(false);
  const [cepErr,setCepErr]=useState("");
  const fotoRef=useRef();

  const emptyForm={
    // pessoal
    foto:"",fotoObj:null,
    nm:"",nomeSocial:"",nasc:"",sexo:"",estadoCivil:"",
    nomeMae:"",nomePai:"",conjuge:"",
    // documentos
    cpf:"",rg:"",orgaoExp:"",rgEstado:"",rgDt:"",
    estrangeiro:false,
    // contato
    tel:"",cel:"",whatsapp:"",email:"",
    // endereço
    cep:"",logradouro:"",numero:"",complemento:"",bairro:"",cidade:"",estado:"",referencia:"",
    // complementar
    escolaridade:"",necessidades:"",
    nomeEmerg:"",telEmerg:"",
    plano:"Particular",
    origem:"",obs:"",
    respFinNome:"",respFinCpf:"",
    st:"Ativo",abc:"",
  };
  const [form,setForm]=useState(emptyForm);
  function setF(k,v){setForm(p=>({...p,[k]:v}));}

  /* ── busca CEP via ViaCEP ── */
  async function buscarCep(cepRaw){
    const cep=cepRaw.replace(/\D/g,"");
    if(cep.length!==8){setCepErr("CEP deve ter 8 dígitos");return;}
    setCepLoading(true);setCepErr("");
    try{
      const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d=await r.json();
      if(d.erro){setCepErr("CEP não encontrado");setCepLoading(false);return;}
      setForm(p=>({...p,
        logradouro:d.logradouro||"",
        bairro:d.bairro||"",
        cidade:d.localidade||"",
        estado:d.uf||"",
        cep:cepRaw,
      }));
      setCepErr("");
    }catch(e){setCepErr("Erro ao consultar CEP");}
    setCepLoading(false);
  }

  /* ── foto upload ── */
  function handleFoto(e){
    const f=e.target.files[0];
    if(!f) return;
    const url=URL.createObjectURL(f);
    setForm(p=>({...p,foto:url,fotoObj:f}));
  }

  /* ── salvar ── */
  function doSalvar(){
    if(!form.nm.trim()){alert("Nome é obrigatório");return;}
    const novo={
      id:`p${Date.now()}`,
      pront:Math.floor(7400000+Math.random()*500000),
      nm:form.nm.trim(),
      nomeSocial:form.nomeSocial,
      nasc:form.nasc,
      sexo:form.sexo,
      estadoCivil:form.estadoCivil,
      nomeMae:form.nomeMae,
      nomePai:form.nomePai,
      conjuge:form.conjuge,
      cpf:form.cpf,
      rg:form.rg,
      orgaoExp:form.orgaoExp,
      rgEstado:form.rgEstado,
      rgDt:form.rgDt,
      estrangeiro:form.estrangeiro,
      tel:form.tel,
      cel:form.cel,
      whatsapp:form.whatsapp,
      email:form.email,
      cep:form.cep,
      logradouro:form.logradouro,
      numero:form.numero,
      complemento:form.complemento,
      bairro:form.bairro,
      cidade:form.cidade,
      estado:form.estado,
      referencia:form.referencia,
      escolaridade:form.escolaridade,
      necessidades:form.necessidades,
      nomeEmerg:form.nomeEmerg,
      telEmerg:form.telEmerg,
      plano:form.plano,
      origem:form.origem,
      obs:form.obs,
      respFinNome:form.respFinNome,
      respFinCpf:form.respFinCpf,
      foto:form.foto,
      st:form.st||"Ativo",
      abc:form.abc||"",
      ats:[],
    };
    onSalvar(novo);
  }

  /* ─── helpers visuais ─── */
  const gRow=(cols="1fr 1fr")=>({display:"grid",gridTemplateColumns:cols,gap:10,marginBottom:12});
  const gField=(label,child)=><div><label style={SL}>{label}</label>{child}</div>;
  const SI2={...SI};

  /* renderStep: funções estáveis (nao recriam o DOM a cada keystroke) */
  function renderStep0(){return(
    <div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fotoRef.current&&fotoRef.current.click()}>
          <div style={{width:110,height:110,borderRadius:"50%",overflow:"hidden",border:`3px solid ${C.p}40`,background:C.card2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>
            {form.foto?<img src={form.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"📷"}
          </div>
          <div style={{position:"absolute",bottom:4,right:4,width:26,height:26,borderRadius:"50%",background:C.p,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>✏️</div>
          <input ref={fotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFoto}/>
        </div>
      </div>
      <p style={{textAlign:"center",color:C.txM,fontSize:11,marginBottom:18}}>Clique na foto para adicionar uma imagem do paciente</p>
      <div style={gRow("2fr 1fr")}>
        {gField("Nome Completo *",<input style={SI2} autoComplete="off" placeholder="Nome completo do paciente" value={form.nm||""} onChange={e=>setF("nm",e.target.value)}/>)}
        {gField("Nome Social",<input style={SI2} autoComplete="off" placeholder="Como prefere ser chamado(a)" value={form.nomeSocial||""} onChange={e=>setF("nomeSocial",e.target.value)}/>)}
      </div>
      <div style={gRow("1fr 1fr 1fr")}>
        {gField("Data de Nascimento",<input type="date" style={SI2} value={form.nasc||""} onChange={e=>setF("nasc",e.target.value)}/>)}
        {gField("Sexo",<div style={{display:"flex",gap:8}}>
          {["Feminino","Masculino","Outro"].map(s=>(
            <button type="button" key={s} onClick={()=>setF("sexo",s)} style={{flex:1,padding:"9px 4px",borderRadius:8,border:`1.5px solid ${form.sexo===s?C.p:C.brd}`,background:form.sexo===s?`${C.p}12`:"#fff",color:form.sexo===s?C.p:C.txS,fontWeight:form.sexo===s?700:400,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              {s==="Feminino"?"♀️":s==="Masculino"?"♂️":"⚧"} {s}
            </button>
          ))}
        </div>)}
        {gField("Estado Civil",<select style={SI2} value={form.estadoCivil||""} onChange={e=>setF("estadoCivil",e.target.value)}>
          <option value="">Selecione...</option>
          {["Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável","Separado(a)"].map(o=><option key={o}>{o}</option>)}
        </select>)}
      </div>
      <div style={gRow()}>
        {gField("Nome da Mãe",<input style={SI2} autoComplete="off" placeholder="Nome completo da mãe" value={form.nomeMae||""} onChange={e=>setF("nomeMae",e.target.value)}/>)}
        {gField("Nome do Pai",<input style={SI2} autoComplete="off" placeholder="Nome completo do pai" value={form.nomePai||""} onChange={e=>setF("nomePai",e.target.value)}/>)}
      </div>
      <div style={gRow("1fr")}>
        {gField("Cônjuge / Companheiro(a)",<input style={SI2} autoComplete="off" placeholder="Nome do cônjuge (se aplicável)" value={form.conjuge||""} onChange={e=>setF("conjuge",e.target.value)}/>)}
      </div>
    </div>
  );}
  function renderStep1(){return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,color:C.txS,fontWeight:600}}>
          <input type="checkbox" checked={form.estrangeiro} onChange={e=>setF("estrangeiro",e.target.checked)} style={{width:16,height:16}}/>
          🌍 Paciente Estrangeiro
        </label>
        {form.estrangeiro&&<span style={{fontSize:11,color:C.amber}}>Documento de identidade pode variar</span>}
      </div>
      <div style={gRow()}>
        {gField("CPF",<input style={SI2} autoComplete="off" placeholder="000.000.000-00" maxLength={14} value={form.cpf||""} onChange={e=>setF("cpf",e.target.value)}/>)}
        {gField("RG",<input style={SI2} autoComplete="off" placeholder="00.000.000-0" value={form.rg||""} onChange={e=>setF("rg",e.target.value)}/>)}
      </div>
      <div style={gRow("1fr 1fr 1fr")}>
        {gField("Órgão Expedidor",<input style={SI2} autoComplete="off" placeholder="SSP, DETRAN..." value={form.orgaoExp||""} onChange={e=>setF("orgaoExp",e.target.value)}/>)}
        {gField("Estado (RG)",<select style={SI2} value={form.rgEstado||""} onChange={e=>setF("rgEstado",e.target.value)}>
          <option value="">UF</option>
          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(o=><option key={o}>{o}</option>)}
        </select>)}
        {gField("Data de Emissão",<input type="date" style={SI2} value={form.rgDt||""} onChange={e=>setF("rgDt",e.target.value)}/>)}
      </div>
      <div style={{background:`${C.p}06`,border:`1px solid ${C.p}15`,borderRadius:10,padding:"12px 14px",marginTop:8}}>
        <p style={{color:C.txM,fontSize:11,margin:0}}>⚠️ Dados sensíveis — armazenados com proteção LGPD (Art. 5º, II). Acesso restrito ao médico e administrador.</p>
      </div>
    </div>
  );}
  function renderStep2(){return(
    <div>
      <div style={gRow()}>
        {gField("Telefone Fixo",<input style={SI2} autoComplete="off" placeholder="(13) 3XXX-XXXX" value={form.tel||""} onChange={e=>setF("tel",e.target.value)}/>)}
        {gField("Celular",<input style={SI2} autoComplete="off" placeholder="(13) 9XXXX-XXXX" value={form.cel||""} onChange={e=>setF("cel",e.target.value)}/>)}
      </div>
      <div style={gRow()}>
        {gField("📱 WhatsApp *",<div style={{position:"relative"}}>
          <input style={SI2} autoComplete="off" placeholder="(13) 9XXXX-XXXX" value={form.whatsapp||""} onChange={e=>setF("whatsapp",e.target.value)}/>
          {form.whatsapp&&<button type="button" onClick={()=>window.open(`https://wa.me/55${form.whatsapp.replace(/\D/g,"")}`, "_blank")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"#25d366",border:"none",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💬 Testar</button>}
        </div>)}
        {gField("E-mail",<input type="email" style={SI2} autoComplete="off" placeholder="paciente@email.com" value={form.email||""} onChange={e=>setF("email",e.target.value)}/>)}
      </div>
      <div style={{background:`${C.green}06`,border:`1px solid ${C.green}20`,borderRadius:10,padding:"10px 14px",marginTop:4}}>
        <p style={{color:C.green,fontSize:11,fontWeight:700,margin:"0 0 4px"}}>💬 Notificações automáticas</p>
        <p style={{color:C.txM,fontSize:11,margin:0}}>WhatsApp e e-mail serão usados para confirmação, receitas e lembretes de retorno.</p>
      </div>
    </div>
  );}
  function renderStep3(){return(
    <div>
      <div style={{marginBottom:12}}>
        <label style={SL}>CEP — preenchimento automático</label>
        <div style={{display:"flex",gap:8}}>
          <input style={{...SI2,flex:1}} autoComplete="off" placeholder="00000-000" maxLength={9} value={form.cep||""} onChange={e=>setF("cep",e.target.value)} onBlur={e=>{if(e.target.value.replace(/\D/g,"").length===8)buscarCep(e.target.value);}}/>
          <button type="button" onClick={()=>buscarCep(form.cep||"")} disabled={cepLoading} style={{padding:"9px 16px",borderRadius:8,border:`1.5px solid ${C.p}`,background:cepLoading?C.card2:`${C.p}12`,color:C.p,fontWeight:700,fontSize:12,cursor:cepLoading?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{cepLoading?"⏳ Buscando...":"🔍 Buscar CEP"}</button>
        </div>
        {cepErr&&<p style={{color:C.red,fontSize:11,margin:"4px 0 0"}}>{cepErr}</p>}
        {!cepErr&&form.logradouro&&<p style={{color:C.green,fontSize:11,margin:"4px 0 0"}}>✅ Endereço encontrado via ViaCEP</p>}
      </div>
      <div style={gRow("2fr 1fr")}>
        {gField("Logradouro (Rua/Av.)",<input style={SI2} autoComplete="off" placeholder="Nome da rua ou avenida" value={form.logradouro||""} onChange={e=>setF("logradouro",e.target.value)}/>)}
        {gField("Número",<input style={SI2} autoComplete="off" placeholder="123, S/N" value={form.numero||""} onChange={e=>setF("numero",e.target.value)}/>)}
      </div>
      <div style={gRow()}>
        {gField("Complemento",<input style={SI2} autoComplete="off" placeholder="Apto, Bloco, Casa..." value={form.complemento||""} onChange={e=>setF("complemento",e.target.value)}/>)}
        {gField("Bairro",<input style={SI2} autoComplete="off" placeholder="Bairro" value={form.bairro||""} onChange={e=>setF("bairro",e.target.value)}/>)}
      </div>
      <div style={gRow("1fr 1fr 1fr")}>
        {gField("Estado",<select style={SI2} value={form.estado||""} onChange={e=>setF("estado",e.target.value)}>
          <option value="">UF</option>
          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(o=><option key={o}>{o}</option>)}
        </select>)}
        {gField("Cidade",<input style={SI2} autoComplete="off" placeholder="Cidade" value={form.cidade||""} onChange={e=>setF("cidade",e.target.value)}/>)}
        {gField("CEP",<input style={SI2} autoComplete="off" placeholder="00000-000" maxLength={9} value={form.cep||""} onChange={e=>setF("cep",e.target.value)}/>)}
      </div>
      <div style={gRow("1fr")}>
        {gField("Ponto de Referência",<input style={SI2} autoComplete="off" placeholder="Ex: próximo ao Mercado X" value={form.referencia||""} onChange={e=>setF("referencia",e.target.value)}/>)}
      </div>
    </div>
  );}
  function renderStep4(){return(
    <div>
      <div style={gRow()}>
        {gField("Escolaridade",<select style={SI2} value={form.escolaridade||""} onChange={e=>setF("escolaridade",e.target.value)}>
          <option value="">Selecione...</option>
          {["Sem instrução","Fundamental Incompleto","Fundamental Completo","Médio Incompleto","Médio Completo","Superior Incompleto","Superior Completo","Pós-graduação","Mestrado","Doutorado"].map(o=><option key={o}>{o}</option>)}
        </select>)}
        {gField("Necessidades Especiais",<input style={SI2} autoComplete="off" placeholder="Descreva se houver..." value={form.necessidades||""} onChange={e=>setF("necessidades",e.target.value)}/>)}
      </div>
      <div style={gRow()}>
        {gField("Contato de Emergência",<input style={SI2} autoComplete="off" placeholder="Nome completo" value={form.nomeEmerg||""} onChange={e=>setF("nomeEmerg",e.target.value)}/>)}
        {gField("📱 Telefone de Emergência",<input style={SI2} autoComplete="off" placeholder="(13) 9XXXX-XXXX" value={form.telEmerg||""} onChange={e=>setF("telEmerg",e.target.value)}/>)}
      </div>
      <div style={gRow()}>
        {gField("Plano de Saúde",<select style={SI2} value={form.plano||"Particular"} onChange={e=>setF("plano",e.target.value)}>
          {["Particular","Unimed","Bradesco Saúde","Amil","SulAmérica","Hapvida","Notre Dame","Prevent Senior","Porto Seguro","Outro convênio"].map(o=><option key={o}>{o}</option>)}
        </select>)}
        {gField("Origem / Como nos conheceu",<select style={SI2} value={form.origem||""} onChange={e=>setF("origem",e.target.value)}>
          <option value="">Selecione...</option>
          {["TikTok","Instagram","Facebook","WhatsApp","Google","Site","Indicação médico","Indicação paciente","Outro"].map(o=><option key={o}>{o}</option>)}
        </select>)}
      </div>
      <div style={{border:`1px solid ${C.brd}`,borderRadius:10,overflow:"hidden",marginBottom:12}}>
        <div style={{background:C.card2,padding:"8px 14px",borderBottom:`1px solid ${C.brd}`}}>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:0}}>💳 Responsável Financeiro (se diferente do paciente)</p>
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={gRow()}>
            {gField("Nome do Responsável",<input style={SI2} autoComplete="off" placeholder="Nome completo" value={form.respFinNome||""} onChange={e=>setF("respFinNome",e.target.value)}/>)}
            {gField("CPF do Responsável",<input style={SI2} autoComplete="off" placeholder="000.000.000-00" value={form.respFinCpf||""} onChange={e=>setF("respFinCpf",e.target.value)}/>)}
          </div>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={SL}>Observações Gerais</label>
        <textarea value={form.obs||""} onChange={e=>setF("obs",e.target.value)} rows={3} placeholder="Informações adicionais, preferências de atendimento, alertas importantes..." style={{...SI2,resize:"vertical",lineHeight:1.6}}/>
      </div>
      <div style={gRow()}>
        {gField("Status do Paciente",<div style={{display:"flex",gap:8}}>
          {["Ativo","Inativo"].map(s=>(
            <button type="button" key={s} onClick={()=>setF("st",s)} style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${form.st===s?(s==="Ativo"?C.green:C.red):C.brd}`,background:form.st===s?(s==="Ativo"?`${C.green}12`:`rgba(192,57,43,.08)`):"#fff",color:form.st===s?(s==="Ativo"?C.green:C.red):C.txS,fontWeight:form.st===s?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              {s==="Ativo"?"✅":"⛔"} {s}
            </button>
          ))}
        </div>)}
        {gField("Classificação ABC",<div style={{display:"flex",gap:8}}>
          {[["A","VIP"],["B","Regular"],["C","Eventual"],["","—"]].map(([v,lbl])=>(
            <button type="button" key={v||"n"} onClick={()=>setF("abc",v)} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1.5px solid ${form.abc===v?C.p:C.brd}`,background:form.abc===v?`${C.p}12`:"#fff",color:form.abc===v?C.p:C.txS,fontWeight:form.abc===v?700:400,fontSize:10,cursor:"pointer",fontFamily:"inherit"}} title={lbl}>
              {v||"—"}
            </button>
          ))}
        </div>)}
      </div>
    </div>
  );}
  const STEP_RENDER=[renderStep0,renderStep1,renderStep2,renderStep3,renderStep4];

  return(
    <Modal title="➕ Adicionar Paciente" onClose={()=>setConf("cancel")} width={700}>
      {conf==="cancel"&&<ConfirmPopup danger title="Cancelar cadastro?" msg="Os dados digitados serão perdidos. Deseja sair mesmo assim?" yesLabel="Sim, cancelar" noLabel="Continuar cadastrando" onYes={onClose} onNo={()=>setConf(null)}/>}
      {conf==="save"&&<ConfirmPopup title="Confirmar cadastro?" msg={`Salvar o paciente "${form.nm||"novo paciente"}" no sistema?`} yesLabel="✅ Cadastrar" noLabel="Revisar" onYes={doSalvar} onNo={()=>setConf(null)}/>}

      {/* Progress steps */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${C.brd}`,paddingBottom:16}}>
        {STEPS.map((s,i)=>(
          <button type="button" key={i} onClick={()=>setStep(i)} style={{flex:1,background:"none",border:"none",cursor:"pointer",padding:"6px 4px",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:i<step?C.green:i===step?C.p:C.card2,border:`2px solid ${i<step?C.green:i===step?C.p:C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:i<=step?"#fff":C.txM,fontWeight:800,transition:"all .2s"}}>
              {i<step?"✓":i+1}
            </div>
            <span style={{fontSize:9,color:i===step?C.p:C.txM,fontWeight:i===step?700:400,textAlign:"center",lineHeight:1.2}}>{s}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div style={{minHeight:320}}>
        {STEP_RENDER[step]()}
      </div>

      {/* Footer navigation */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,paddingTop:14,borderTop:`1px solid ${C.brd}`}}>
        <div style={{display:"flex",gap:8}}>
          <Btn v="g" onClick={()=>setConf("cancel")}>✕ Cancelar</Btn>
          {step>0&&<Btn v="g" onClick={()=>setStep(s=>s-1)}>← Anterior</Btn>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{color:C.txM,fontSize:11}}>{step+1}/{STEPS.length}</span>
          {step<STEPS.length-1
            ?<Btn v="p" onClick={()=>setStep(s=>s+1)}>Próximo →</Btn>
            :<Btn v="green" onClick={()=>form.nm.trim()?setConf("save"):alert("Preencha o Nome do paciente (Step 1)")} disabled={!form.nm.trim()}>✅ Cadastrar Paciente</Btn>
          }
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA PRONTUÁRIO ELETRÔNICO (ex-Pacientes)
════════════════════════════════════════════════════════════════ */
function gerarSalaTelemedicina(pacienteId){
  // Sala única por paciente, estável e sem caracteres especiais
  const base = "DrIlzaEzequiel-" + (pacienteId || "sala").replace(/[^a-zA-Z0-9]/g,"");
  return base;
}

function gerarLinkTelemedicina(pacienteId){
  const sala = gerarSalaTelemedicina(pacienteId);
  return "https://meet.jit.si/" + sala;
}

const SALA_MEDICA = "https://meet.jit.si/DrIlzaEzequiel-Consultorio";
const EMAIL_DRA = "ilzaeneta@gmail.com";

// ════════════════════════════════════════════════════════
// EMAILJS — envio automático sem backend
// Configure em: https://www.emailjs.com/
// ════════════════════════════════════════════════════════
const EJS = {
  SERVICE_ID:  "service_drailza",   // ← substitua após criar conta
  PUBLIC_KEY:  "YOUR_PUBLIC_KEY",   // ← substitua após criar conta
  TEMPLATES: {
    consulta:      "template_consulta",
    exame:         "template_exame",
    teleconsulta:  "template_tele",
    cancelamento:  "template_cancel",
  },
  _loaded: false,

  async init() {
    if(this._loaded) return true;
    return new Promise(resolve => {
      if(window.emailjs) { this._loaded=true; return resolve(true); }
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = () => {
        window.emailjs.init({ publicKey: this.PUBLIC_KEY });
        this._loaded = true;
        resolve(true);
      };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  },

  async send(templateId, params) {
    try {
      const ok = await this.init();
      if(!ok || !window.emailjs) throw new Error("EmailJS não carregou");
      await window.emailjs.send(this.SERVICE_ID, templateId, params);
      console.log("[Email] ✅ Enviado:", templateId);
      return true;
    } catch(e) {
      console.warn("[Email] ❌ Falha:", e.message);
      return false;
    }
  },

  // ── Consulta agendada ─────────────────────────────────
  async confirmarConsulta({ pac, email_pac, dt, hr, tipo, proc, obs, link }) {
    const dtFmt = (dt||"").split("-").reverse().join("/");
    return this.send(this.TEMPLATES.consulta, {
      to_email:    EMAIL_DRA,
      to_email_cc: email_pac || "",
      paciente:    pac,
      data:        dtFmt,
      horario:     hr,
      modalidade:  tipo,
      procedimento: proc,
      observacoes: obs || "—",
      link_tele:   link || "—",
      clinica:     "CRM Dra. Ilza Ezequiel",
      reply_to:    EMAIL_DRA,
    });
  },

  // ── Exame solicitado ──────────────────────────────────
  async confirmarExame({ pac, tipo, dt, st }) {
    const dtFmt = (dt||"").split("-").reverse().join("/");
    return this.send(this.TEMPLATES.exame, {
      to_email:    EMAIL_DRA,
      paciente:    pac,
      exame:       tipo,
      data:        dtFmt || "A definir",
      status:      st || "Agendado",
      clinica:     "CRM Dra. Ilza Ezequiel",
    });
  },

  // ── Teleconsulta agendada ─────────────────────────────
  async confirmarTeleconsulta({ pac, dt, hr, motivo, link }) {
    const dtFmt = (dt||"").split("-").reverse().join("/");
    return this.send(this.TEMPLATES.teleconsulta, {
      to_email:   EMAIL_DRA,
      paciente:   pac,
      data:       dtFmt,
      horario:    hr,
      motivo:     motivo,
      link_sala:  link,
      clinica:    "CRM Dra. Ilza Ezequiel",
    });
  },
};

function ModalTelemedicina({paciente, onClose}){
  const link = gerarLinkTelemedicina(paciente.id);
  const [copiado, setCopiado] = React.useState(false);
  const [copiadoMed, setCopiadoMed] = React.useState(false);

  function copiar(url, fn){
    if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>{fn(true); setTimeout(()=>fn(false),2000);});
    else { const t=document.createElement("textarea"); t.value=url; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); fn(true); setTimeout(()=>fn(false),2000); }
  }

  const enviarWA = () => {
    const msg = "Olá " + paciente.nm.split(" ")[0] + "! 😊\n\n"
      + "Sua consulta por *Telemedicina* com a Dra. Ilza Ezequiel está pronta.\n\n"
      + "🎥 *Acesse pelo link abaixo no dia e horário agendado:*\n"
      + link + "\n\n"
      + "📌 Dicas:\n• Use computador ou celular com câmera\n• Prefira um local tranquilo e bem iluminado\n• Não é necessário instalar nada\n\n"
      + "Qualquer dúvida, estou à disposição! 💙\n_Equipe Dra. Ilza Ezequiel | Gastroenterologia_";
    window.open("https://wa.me/55" + (paciente.tel||"").replace(/\D/g,"") + "?text=" + encodeURIComponent(msg), "_blank");
  };

  const enviarEmail = () => {
    const sub = encodeURIComponent("Link Telemedicina — Dra. Ilza Ezequiel");
    const body = "Olá " + paciente.nm.split(" ")[0] + ",\n\n"
      + "Sua consulta por Telemedicina com a Dra. Ilza Ezequiel está confirmada.\n\n"
      + "Acesse pelo link abaixo no dia e horário agendado:\n" + link + "\n\n"
      + "Dicas:\n- Use computador ou celular com câmera e microfone\n- Prefira local tranquilo e bem iluminado\n- Não é necessário instalar nenhum aplicativo\n\n"
      + "Dúvidas: (13) 97802-8137\nEquipe Dra. Ilza Ezequiel | Gastroenterologia";
    // Envia email ao paciente via EmailJS
    EJS.send(EJS.TEMPLATES.consulta, {
      to_email:    paciente.email || EMAIL_DRA,
      to_email_cc: EMAIL_DRA,
      paciente:    paciente.nm,
      data:        "—", horario:"—", modalidade:"—",
      procedimento: "Teleconsulta",
      observacoes: "—", link_tele: link,
      clinica: "CRM Dra. Ilza Ezequiel",
    });
  };

  return (
    <Modal title={"📹 Telemedicina — " + paciente.nm} onClose={onClose} width={540}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Info */}
        <div style={{background:`${C.p}08`,border:`1px solid ${C.p}25`,borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:28}}>🎥</span>
          <div>
            <p style={{color:C.p,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>Sala de Videochamada — Paciente</p>
            <p style={{color:C.txM,fontSize:11,margin:0,lineHeight:1.6}}>Link exclusivo para este paciente. Não requer instalação de aplicativo — funciona diretamente no navegador (Chrome, Firefox, Safari).</p>
          </div>
        </div>

        {/* Link do paciente */}
        <div>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 6px",letterSpacing:".05em"}}>🔗 Link do paciente</p>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1,background:C.card2,border:`1px solid ${C.brd}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.txS,fontFamily:"monospace",wordBreak:"break-all",lineHeight:1.5}}>
              {link}
            </div>
            <button onClick={()=>copiar(link,setCopiado)} style={{flexShrink:0,background:copiado?`${C.green}15`:`${C.p}12`,border:`1px solid ${copiado?C.green:C.p}30`,color:copiado?C.green:C.p,borderRadius:8,padding:"9px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",whiteSpace:"nowrap"}}>
              {copiado?"✅ Copiado!":"📋 Copiar"}
            </button>
          </div>
        </div>

        {/* Botões de envio */}
        <div>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px",letterSpacing:".05em"}}>📤 Enviar link ao paciente</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={enviarWA} style={{display:"flex",alignItems:"center",gap:6,background:"#25D366",border:"none",color:"#fff",borderRadius:8,padding:"9px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <span>📱</span> WhatsApp
            </button>
            {paciente.email && (
              <button onClick={enviarEmail} style={{display:"flex",alignItems:"center",gap:6,background:`${C.p}12`,border:`1px solid ${C.p}30`,color:C.p,borderRadius:8,padding:"9px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                <span>📧</span> E-mail
              </button>
            )}
            {!paciente.email && (
              <span style={{color:C.txM,fontSize:11,alignSelf:"center",fontStyle:"italic"}}>✉️ Sem e-mail cadastrado</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{height:1,background:C.brd}}/>

        {/* Sala da médica */}
        <div style={{background:`${C.teal}08`,border:`1px solid ${C.teal}25`,borderRadius:12,padding:"14px 16px"}}>
          <p style={{color:C.teal,fontWeight:700,fontSize:12,margin:"0 0 6px"}}>👩‍⚕️ Sala permanente da Dra. Ilza</p>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1,background:"#fff",border:`1px solid ${C.brd}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.txS,fontFamily:"monospace",wordBreak:"break-all"}}>
              {SALA_MEDICA}
            </div>
            <button onClick={()=>copiar(SALA_MEDICA,setCopiadoMed)} style={{flexShrink:0,background:copiadoMed?`${C.green}15`:`${C.teal}12`,border:`1px solid ${copiadoMed?C.green:C.teal}30`,color:copiadoMed?C.green:C.teal,borderRadius:8,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
              {copiadoMed?"✅":"📋"}
            </button>
          </div>
        </div>

        {/* Abrir sala */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>window.open(link,"_blank")} style={{flex:1,background:`linear-gradient(135deg,${C.p},${C.pG})`,border:"none",color:"#fff",borderRadius:10,padding:"13px 0",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 14px ${C.p}35`}}>
            🎥 Abrir sala do paciente
          </button>
          <button onClick={()=>window.open(SALA_MEDICA,"_blank")} style={{flex:1,background:`linear-gradient(135deg,${C.teal},#1abc9c)`,border:"none",color:"#fff",borderRadius:10,padding:"13px 0",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 14px ${C.teal}35`}}>
            👩‍⚕️ Abrir minha sala
          </button>
        </div>

        <p style={{color:C.txM,fontSize:10,margin:0,textAlign:"center",lineHeight:1.6}}>
          Powered by <b>Jitsi Meet</b> — videochamada segura, gratuita e sem necessidade de conta.
        </p>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA PRONTUÁRIO ELETRÔNICO (ex-Pacientes)
════════════════════════════════════════════════════════════════ */

function PopupPaciente({ pac, onClose, allExames, onSaveExame, setPage, setPacFiltro, setPats }) {
  const [tab, setTab] = useState("info");
  // AutoSave: salva 2s após última edição
  const autoTimer = useRef(null);
  function scheduleAutoSave(updated) {
    if(autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if(setPats) setPats(prev => prev.map(p => p.id===updated.id ? updated : p));
      const badge = document.getElementById("autosave-badge");
      if(badge) { badge.style.opacity=1; setTimeout(()=>{ badge.style.opacity=0; },2000); }
    }, 2000);
  }
  const [showAddExame, setShowAddExame] = useState(false);
  const [prontuarios, setProntuarios] = useState(mockProntuarios[pac.id] || []);
  const [showAddPront, setShowAddPront] = useState(false);
  const [prontForm, setProntForm] = useState({ tipo:"Consulta", resumo:"" });

  const meusExames = allExames.filter(e => e.pac === pac.nm);
  const examAccent = tipo => {
    if (tipo.includes("EDA")||tipo.includes("Endoscopia")) return { c:"#A8722A", bg:"#FDF3E3" };
    if (tipo.includes("Colonoscopia"))  return { c:"#6D4E8A", bg:"#F4EFF9" };
    if (tipo.includes("USG"))           return { c:"#7C3AED", bg:"#F5F3FF" };
    if (tipo.includes("Vitamina")||tipo.includes("Ferro")||tipo.includes("Hemograma")||tipo.includes("TSH"))
      return { c:"#9A6A00", bg:"#FFF8E6" };
    return { c:"#2D7A4F", bg:"#EDF7F1" };
  };
  const abcColor = { A:T.gr, B:T.b, C:T.txM };
  const abcBg    = { A:T.grB, B:T.bL, C:T.sur2 };
  const InfoRow = ({ label, value }) => value ? (
    <div style={{ display:"flex", gap:12, padding:"9px 0", borderBottom:`1px solid ${T.br}` }}>
      <span style={{ fontSize:11, fontWeight:700, color:T.txS, textTransform:"uppercase",
        letterSpacing:".07em", minWidth:110, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:13, color:T.tx, fontWeight:500 }}>{value}</span>
    </div>
  ) : null;

  const tiposConsulta = ["1ª Consulta","Retorno","Consulta","Resultado de Exame","Acompanhamento","Urgência"];

  const handleSavePront = () => {
    if(!prontForm.resumo.trim()){alert("Preencha o resumo da consulta");return;}
    const novo = {
      id:"pr"+Date.now(),
      dt: new Date().toISOString().split("T")[0],
      tipo: prontForm.tipo,
      resumo: prontForm.resumo,
    };
    setProntuarios(p=>[novo,...p]);
    setProntForm({ tipo:"Consulta", resumo:"" });
    setShowAddPront(false);
  };

  return (
    <Modal title={
        <span style={{display:"flex",alignItems:"center",gap:10}}>
          Ficha do Paciente
          <span id="autosave-badge" style={{
            fontSize:10,fontWeight:600,color:"#2D7A4F",background:"#EDF7F1",
            padding:"2px 8px",borderRadius:99,opacity:0,transition:"opacity .3s"
          }}>✓ Salvo automaticamente</span>
        </span>
      } onClose={onClose} width={620}>
      {/* header SEM avatar */}
      <div style={{ marginBottom:20, padding:"16px 20px",
        background:T.sur2, borderRadius:14, border:`1px solid ${T.br}` }}>
        <div style={{ fontSize:18, fontWeight:800, color:T.tx,
          letterSpacing:"-.02em", marginBottom:8 }}>{pac.nm}</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {stBadge(pac.st)}
          {pac.abc && (
            <span style={{ fontSize:11, fontWeight:700,
              color:abcColor[pac.abc]||T.txM, background:abcBg[pac.abc]||T.sur2,
              padding:"2px 10px", borderRadius:99,
              border:`1px solid ${(abcColor[pac.abc]||T.txM)}30` }}>
              Classe {pac.abc}
            </span>
          )}
          <span style={{ fontSize:11, color:T.txS }}>Último acesso: {pac.ults}</span>
        </div>
      </div>

      {/* Tabs — agora com Prontuário */}
      <div style={{ display:"flex", gap:4, marginBottom:18,
        background:T.sur2, borderRadius:10, padding:4, border:`1px solid ${T.br}` }}>
        {[
          { key:"info",      label:"Informações",              icon:"user" },
          { key:"prontuario",label:`Prontuário (${prontuarios.length})`, icon:"spark" },
          { key:"exames",    label:`Exames (${meusExames.length})`,      icon:"exam" },
        ].map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              gap:7, padding:"8px 12px", borderRadius:8, border:"none", cursor:"pointer",
              fontFamily:"inherit", fontSize:12.5, fontWeight:tab===t.key?700:500,
              background:tab===t.key?T.sur:"transparent",
              color:tab===t.key?T.tx:T.txM,
              boxShadow:tab===t.key?"0 1px 4px rgba(44,26,8,.08)":"none" }}>
            <Ic n={t.icon} sz={13} c={tab===t.key?T.b:T.txM} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Informações */}
      {tab==="info" && (
        <div>
          <InfoRow label="Data Nasc." value={pac.nasc} />
          <InfoRow label="Sexo"       value={pac.sexo} />
          <InfoRow label="CPF"        value={pac.cpf} />
          <InfoRow label="Telefone"   value={pac.tel} />
          <InfoRow label="WhatsApp"   value={pac.whatsapp} />
          <InfoRow label="E-mail"     value={pac.email} />
          <InfoRow label="Plano"      value={pac.plano} />
          {pac.obs && (
            <div style={{ marginTop:14, background:T.amB, border:`1px solid ${T.amBr}`,
              borderRadius:10, padding:"12px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.am, textTransform:"uppercase",
                letterSpacing:".07em", marginBottom:6 }}>Observações clínicas</div>
              <div style={{ fontSize:13, color:T.tx, lineHeight:1.6 }}>{pac.obs}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Prontuário Médico */}
      {tab==="prontuario" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Botão novo registro */}
          {!showAddPront && (
            <button onClick={()=>setShowAddPront(true)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 18px",
                border:`2px dashed ${T.brD}`, borderRadius:12, background:"transparent",
                cursor:"pointer", color:T.b, fontWeight:600, fontSize:13,
                fontFamily:"inherit", transition:"all .18s", width:"100%" }}
              onMouseEnter={e=>{ e.currentTarget.style.background=T.bL; e.currentTarget.style.borderColor=T.b; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=T.brD; }}>
              <div style={{ width:32, height:32, borderRadius:9,
                background:"linear-gradient(135deg,#A8722A,#7A5018)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="plus" sz={16} c="#fff" sw={2} />
              </div>
              Adicionar registro de consulta
            </button>
          )}

          {/* Formulário novo registro */}
          {showAddPront && (
            <div style={{ background:T.bL, border:`1.5px solid ${T.b}44`,
              borderRadius:14, padding:"16px 18px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.b, marginBottom:14,
                display:"flex", alignItems:"center", gap:8 }}>
                <Ic n="spark" sz={14} c={T.b} />
                Novo registro — {new Date().toLocaleDateString("pt-BR")}
              </div>
              <Fld label="Tipo de consulta">
                <select style={inp} value={prontForm.tipo}
                  onChange={e=>setProntForm(p=>({...p,tipo:e.target.value}))}>
                  {tiposConsulta.map(t=><option key={t}>{t}</option>)}
                </select>
              </Fld>
              <Fld label="Resumo da consulta *">
                <textarea
                  style={{ ...inp, resize:"vertical", minHeight:110, lineHeight:1.7, fontSize:13 }}
                  value={prontForm.resumo}
                  placeholder="Descreva o atendimento: queixas, exame físico, hipóteses diagnósticas, conduta, orientações..."
                  onChange={e=>setProntForm(p=>({...p,resumo:e.target.value}))}
                  autoFocus
                />
              </Fld>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                <Btn variant="secondary" small onClick={()=>{ setShowAddPront(false); setProntForm({tipo:"Consulta",resumo:""}); }}>
                  Cancelar
                </Btn>
                <Btn small onClick={handleSavePront} icon="check">Salvar registro</Btn>
              </div>
            </div>
          )}

          {/* Lista de registros */}
          {prontuarios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 20px", color:T.txS }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:13 }}>Nenhum registro de prontuário</div>
              <div style={{ fontSize:11, marginTop:4 }}>Clique em "Adicionar registro" para começar</div>
            </div>
          ) : prontuarios.map((r, i) => (
            <div key={r.id} style={{ background:T.sur, border:`1px solid ${T.br}`,
              borderRadius:12, overflow:"hidden", transition:"box-shadow .18s" }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 6px 20px rgba(44,26,8,.08)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              {/* header do registro */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"11px 16px", background:T.sur2, borderBottom:`1px solid ${T.br}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:T.bL,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Ic n="spark" sz={13} c={T.b} />
                  </div>
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:700, color:T.tx }}>{r.tipo}</div>
                    <div style={{ fontSize:11, color:T.txS }}>
                      {r.dt ? new Date(r.dt+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"}) : ""}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:T.txS,
                  background:T.sur3, padding:"2px 10px", borderRadius:99,
                  textTransform:"uppercase", letterSpacing:".07em" }}>
                  #{prontuarios.length - i}
                </span>
              </div>
              {/* corpo */}
              <div style={{ padding:"14px 16px" }}>
                <p style={{ fontSize:13, color:T.tx, lineHeight:1.75, margin:0 }}>{r.resumo}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Exames */}
      {tab==="exames" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {meusExames.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 20px", color:T.txS }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔬</div>
              <div style={{ fontSize:13 }}>Nenhum exame registrado</div>
            </div>
          ) : meusExames.map(e => {
            const { c:ac, bg:abg } = examAccent(e.tipo);
            return (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"12px 14px", background:T.sur2, borderRadius:12, border:`1px solid ${T.br}` }}>
                <div style={{ width:36, height:36, borderRadius:9, background:abg,
                  flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Ic n="exam" sz={16} c={ac} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.tx,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.tipo}</div>
                  <div style={{ fontSize:11, color:T.txS, marginTop:2, display:"flex", gap:8 }}>
                    <span>{e.dt||"Sem data"}</span>
                    {e.obs && <span style={{ color:T.txM }}>· {e.obs}</span>}
                  </div>
                </div>
                {stBadge(e.st)}
              </div>
            );
          })}
          {meusExames.length > 0 && (
            <button onClick={()=>{ setPacFiltro(pac.nm); setPage("exames"); onClose(); }}
              style={{ alignSelf:"flex-end", background:"none", border:"none",
                cursor:"pointer", fontSize:12, color:T.b, fontWeight:600,
                display:"flex", alignItems:"center", gap:4 }}>
              Ver na página de exames <Ic n="chevR" sz={12} c={T.b} />
            </button>
          )}
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        gap:10, marginTop:20, paddingTop:16, borderTop:`1px solid ${T.br}` }}>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        {tab==="prontuario"
          ? <Btn onClick={()=>setShowAddPront(true)} icon="plus">Novo registro</Btn>
          : <Btn onClick={()=>setShowAddExame(true)} icon="plus">Adicionar exame</Btn>
        }
      </div>

      {showAddExame && (
        <PopupNovoExame
          pacInicial={pac.nm}
          onClose={()=>setShowAddExame(false)}
          onSave={novo=>{ onSaveExame(novo); setShowAddExame(false); setTab("exames"); }} />
      )}
    </Modal>
  );
}

// ─── PAGE: PACIENTES — SEM avatar na tabela ───────────────────────────────────

function PopupNovoExame({ onClose, onSave, pacInicial="" }) {
  // Lê pacientes direto do Firebase (polling já feito pelo CRM pai)
  const [pacientes, setPacientes] = useState(()=>safeLsGet("crm_pats_v26"));
  useEffect(()=>{
    fbRead("crm_data/crm_pats_v26").then(v=>{ if(v&&Array.isArray(v)&&v.length>0) setPacientes(v); });
  },[]);
  const [pacObj, setPacObj] = useState(null);
  const [pac, setPac] = useState(pacInicial);
  const [pacOpen, setPacOpen] = useState(false);
  const [pacQ, setPacQ] = useState(pacInicial);
  const pacRef = useRef();
  const pacFiltrados = pacientes.filter(p=>(p.nome||p.name||"").toLowerCase().includes(pacQ.toLowerCase())).slice(0,8);

  const [dt, setDt] = useState("");
  function selecionarPaciente(p) {
    const nome=p.nome||p.name||"";
    setPac(nome); setPacQ(nome); setPacObj(p); setPacOpen(false);
    if(!dt) setDt(new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  }
  useEffect(()=>{
    function h(e){ if(pacRef.current&&!pacRef.current.contains(e.target)) setPacOpen(false); }
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  const [obs, setObs] = useState("");
  const [q, setQ] = useState("");
  const [selList, setSelList] = useState([]);
  const filteredE = EXAMES_LISTA.filter(e => e.toLowerCase().includes(q.toLowerCase()));
  const toggle = nome => setSelList(prev =>
    prev.includes(nome) ? prev.filter(x=>x!==nome) : [...prev, nome]
  );
  const pacInfo = pacObj ? [
    pacObj.telefone&&{icon:"📞",label:"Telefone",val:pacObj.telefone},
    pacObj.whatsapp&&{icon:"💬",label:"WhatsApp",val:pacObj.whatsapp},
    pacObj.plano&&{icon:"🏥",label:"Plano",val:pacObj.plano},
    pacObj.cpf&&{icon:"🪪",label:"CPF",val:pacObj.cpf},
    pacObj.dn&&{icon:"🎂",label:"Nasc.",val:pacObj.dn},
  ].filter(Boolean) : [];
  return (
    <Modal title="Solicitar exames" onClose={onClose} width={560}>
      <Fld label="Paciente">
        <div ref={pacRef} style={{position:"relative"}}>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
              <Ic n="search" sz={14} c={pac?T.b:T.txS}/>
            </div>
            <input style={{...inp,paddingLeft:34,paddingRight:36,
              borderColor:pac?T.b:T.br,borderWidth:pac?"1.5px":"1px",
              background:pac?T.bL:T.sur,fontWeight:pac?600:400}}
              value={pacQ} placeholder={pacientes.length===0?"Digite o nome...":"Buscar paciente..."}
              onChange={e=>{setPacQ(e.target.value);setPac("");setPacObj(null);setPacOpen(true);}}
              onFocus={()=>setPacOpen(true)} autoFocus/>
            {pac&&(<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              width:20,height:20,borderRadius:"50%",background:T.b,display:"flex",alignItems:"center",
              justifyContent:"center",cursor:"pointer"}}
              onClick={()=>{setPac("");setPacQ("");setPacObj(null);setPacOpen(false);}}>
              <Ic n="close" sz={10} c="#fff" sw={2.5}/></div>)}
          </div>
          {pacOpen&&pacQ.length>0&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:9999,
              background:T.sur,border:`1.5px solid ${T.b}55`,borderRadius:14,
              boxShadow:"0 12px 32px rgba(13,31,58,.16)",overflow:"hidden",maxHeight:260,overflowY:"auto"}}>
              {pacFiltrados.length>0?pacFiltrados.map(p=>{
                const nome=p.nome||p.name||"—";
                const ini=nome.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
                const sub=[p.plano,p.telefone||p.whatsapp].filter(Boolean).join(" · ");
                return(<div key={p.id||nome} onClick={()=>selecionarPaciente(p)}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",cursor:"pointer",
                    borderBottom:`1px solid ${T.br}`,transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.bL}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                    background:`linear-gradient(135deg,${T.b},${T.b}99)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:800,color:"#fff"}}>{ini}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.tx}}>{nome}</div>
                    {sub&&<div style={{fontSize:11,color:T.txS,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
                  </div>
                </div>);
              }):(
                <div style={{padding:"16px",textAlign:"center"}}>
                  <div style={{fontSize:13,color:T.txM}}>{pacientes.length===0?"Nenhum paciente cadastrado":`Sem resultado para "${pacQ}"`}</div>
                  <div style={{fontSize:11,color:T.txS,marginTop:4}}>Você pode digitar para usar esse nome</div>
                </div>
              )}
              {pacQ.trim()&&!pacFiltrados.find(p=>(p.nome||p.name||"")===pacQ.trim())&&(
                <div onClick={()=>{setPac(pacQ.trim());setPacObj(null);setPacOpen(false);}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",
                    background:T.bL,borderTop:`1px solid ${T.br}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${T.b}18`}
                  onMouseLeave={e=>e.currentTarget.style.background=T.bL}>
                  <Ic n="plus" sz={13} c={T.b}/>
                  <div><div style={{fontSize:12,fontWeight:700,color:T.b}}>Usar "{pacQ.trim()}"</div>
                    <div style={{fontSize:10,color:T.txS}}>Paciente não cadastrado</div></div>
                </div>
              )}
            </div>
          )}
        </div>
        {pacObj&&pacInfo.length>0&&(
          <div style={{marginTop:10,borderRadius:12,border:`1.5px solid ${T.b}30`,
            background:`linear-gradient(135deg,${T.bL},${T.sur})`,padding:"10px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.b,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:T.gr,display:"inline-block"}}/>
              Dados do paciente
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px"}}>
              {pacInfo.map(({icon,label,val})=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                  <span style={{fontSize:12}}>{icon}</span>
                  <span style={{fontSize:10,color:T.txS}}>{label}:</span>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Fld>
      <Fld label="Data prevista">
        <input style={inp} type="date" value={dt} onChange={e=>setDt(e.target.value)} />
      </Fld>
      <Fld label={`Exames${selList.length>0?` · ${selList.length} selecionado${selList.length!==1?"s":""}`:""}`}>
        <div style={{ position:"relative", marginBottom:8 }}>
          <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }}>
            <Ic n="search" sz={14} c={T.txS} />
          </div>
          <input style={{ ...inp, paddingLeft:34, fontSize:12 }} value={q}
            onChange={e=>setQ(e.target.value)} placeholder="Filtrar exames..." />
        </div>
        <div style={{ border:`1.5px solid ${T.br}`, borderRadius:12, overflow:"hidden",
          maxHeight:260, overflowY:"auto" }}>
          {filteredE.map((e,i) => {
            const checked = selList.includes(e);
            return (
              <div key={e} onClick={()=>toggle(e)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 14px",
                  cursor:"pointer", borderBottom:i<filteredE.length-1?`1px solid ${T.br}`:"none",
                  background:checked?T.bL:"transparent", transition:"background .1s" }}
                onMouseEnter={e2=>{ if(!checked) e2.currentTarget.style.background=T.sur2; }}
                onMouseLeave={e2=>{ if(!checked) e2.currentTarget.style.background="transparent"; }}>
                <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                  border:`1.5px solid ${checked?T.b:T.brD}`, background:checked?T.b:T.sur,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {checked && <Ic n="check" sz={11} c="#fff" sw={2.5} />}
                </div>
                <span style={{ fontSize:12.5, color:checked?T.b:T.tx, fontWeight:checked?600:400 }}>{e}</span>
              </div>
            );
          })}
        </div>
      </Fld>
      {selList.length > 0 && (
        <div style={{ background:T.bL, borderRadius:10, padding:"10px 14px",
          marginBottom:14, display:"flex", flexWrap:"wrap", gap:6 }}>
          {selList.map(s => (
            <span key={s} onClick={()=>toggle(s)}
              style={{ fontSize:11, fontWeight:600, color:T.b, background:"#fff",
                border:`1px solid ${T.b}30`, borderRadius:99, padding:"3px 10px",
                cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
              {s} <span style={{ fontSize:13 }}>×</span>
            </span>
          ))}
        </div>
      )}
      <Fld label="Observações">
        <textarea style={{ ...inp, resize:"vertical", minHeight:60, lineHeight:1.6 }}
          value={obs} onChange={e=>setObs(e.target.value)} placeholder="Notas adicionais..." />
      </Fld>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10,
        paddingTop:16, borderTop:`1px solid ${T.br}` }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!pac.trim()||selList.length===0){alert("Preencha paciente e selecione ao menos um exame");return;}
          selList.forEach(tipo=>onSave({id:"e"+Date.now()+Math.random(),pac,tipo,dt,obs,st:"Agendado"}));
          onClose();
        }} icon="exam">Solicitar{selList.length>0?` (${selList.length})`:""}</Btn>
      </div>
    </Modal>
  );
}

// ─── PAGE: EXAMES — SEM avatar de paciente nos cards ─────────────────────────

// ─── Sub-componentes de linha/card (hooks devem estar fora de .map()) ────────

function PatRow({ p, i, total, usuario, abcColor, onOpen, onDelete }) {
  const [tip, setTip] = useState(false);
  const [pos, setPos] = useState({ x:0, y:0 });
  const role = usuario?.role ?? window._crmUsuario?.role;
  return (
    <div onClick={onOpen}
      style={{ display:"grid", gridTemplateColumns:"2.6fr 1fr 1.3fr 1.1fr .8fr .5fr .4fr",
        padding:"13px 22px", gap:8, alignItems:"center",
        borderBottom:i<total-1?`1px solid ${T.br}`:"none",
        cursor:"pointer", transition:"background .12s, border-left .12s",
        borderLeft:"3px solid transparent", position:"relative" }}
      onMouseEnter={e=>{ e.currentTarget.style.background=T.sur2; e.currentTarget.style.borderLeftColor=T.b; setTip(true); const r=e.currentTarget.getBoundingClientRect(); setPos({x:r.left,y:r.top}); }}
      onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderLeftColor="transparent"; setTip(false); }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>{p.nm}</div>
        <div style={{ fontSize:11, color:T.txS, marginTop:1 }}>Último acesso: {p.ults}</div>
      </div>
      <span style={{ fontSize:12, color:T.txM }}>{p.nasc}</span>
      <span style={{ fontSize:12, color:T.txM }}>{p.tel}</span>
      <span style={{ fontSize:12, color:T.txM }}>{p.plano}</span>
      {stBadge(p.st)}
      <span style={{ display:"inline-flex", width:24, height:24, borderRadius:7,
        alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800,
        color:p.abc?abcColor[p.abc]:T.txS,
        background:p.abc?(p.abc==="A"?T.grB:p.abc==="B"?T.bL:T.sur2):T.sur2 }}>
        {p.abc||"—"}
      </span>
      {["admin","medico"].includes(role) && (
        <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`Excluir ${p.nm}?`)) onDelete(); }}
          style={{ width:24, height:24, borderRadius:6, border:"none", background:T.reB,
            color:T.re, cursor:"pointer", fontSize:13, display:"inline-flex",
            alignItems:"center", justifyContent:"center", flexShrink:0 }}
          title="Excluir paciente">✕</button>
      )}
      {tip && createPortal(
        <div style={{ position:"fixed", left:Math.max(8,pos.x), top:Math.min(pos.y-10,window.innerHeight-220),
          zIndex:99999, background:"#0d1f3a", color:"#fff", borderRadius:12,
          padding:"12px 16px", minWidth:200, maxWidth:280, pointerEvents:"none",
          boxShadow:"0 8px 32px rgba(0,0,0,.35)", fontSize:12, lineHeight:1.6,
          transform:"translateY(-100%)" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:"#7dc8f7" }}>{p.nm}</div>
          <div>📅 Nasc: <strong>{p.nasc||"—"}</strong></div>
          <div>📞 Tel: <strong>{p.tel||"—"}</strong></div>
          <div>💊 Plano: <strong>{p.plano||"—"}</strong></div>
          <div>🏷 Status: <strong>{p.st||"—"}</strong></div>
          {p.obs && <div style={{marginTop:6,color:"#aec9e8",fontSize:11}}>📝 {p.obs}</div>}
          <div style={{ marginTop:6, fontSize:10, opacity:.6 }}>Clique para abrir prontuário</div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ExameCard({ e, usuario, onDelete }) {
  const [tip, setTip] = useState(false);
  const [pos, setPos] = useState({ x:0, y:0 });
  const { c:ac, bg:abg } = examAccent(e.tipo);
  const role = usuario?.role ?? window._crmUsuario?.role;
  return (
    <div style={{ background:T.sur, border:`1px solid ${T.br}`,
      borderRadius:16, overflow:"hidden", transition:"all .2s", cursor:"pointer", position:"relative" }}
      onMouseEnter={el=>{ el.currentTarget.style.boxShadow="0 14px 36px rgba(44,26,8,.11)"; el.currentTarget.style.transform="translateY(-2px)"; el.currentTarget.style.borderColor=ac+"44"; setTip(true); const r=el.currentTarget.getBoundingClientRect(); setPos({x:r.left,y:r.top}); }}
      onMouseLeave={el=>{ el.currentTarget.style.boxShadow="none"; el.currentTarget.style.transform="translateY(0)"; el.currentTarget.style.borderColor=T.br; setTip(false); }}>
      <div style={{ height:4, background:`linear-gradient(90deg,${ac},${ac}55)` }} />
      <div style={{ padding:"16px 18px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:abg,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Ic n="exam" sz={18} c={ac} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {stBadge(e.st)}
            {["admin","medico"].includes(role) && (
              <button onClick={ev=>{ ev.stopPropagation(); if(window.confirm(`Excluir exame "${e.tipo}" de ${e.pac}?`)) onDelete(); }}
                style={{ width:22, height:22, borderRadius:6, border:"none", background:T.reB,
                  color:T.re, cursor:"pointer", fontSize:12, display:"inline-flex",
                  alignItems:"center", justifyContent:"center" }}
                title="Excluir exame">✕</button>
            )}
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:T.tx, marginBottom:5, lineHeight:1.4 }}>{e.tipo}</div>
        <div style={{ fontSize:12, color:T.txM, marginBottom:8, fontWeight:500 }}>{e.pac}</div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.txS }}>
          <Ic n="cal" sz={12} c={T.txS} />
          <span>{e.dt}</span>
          {e.obs && <><span>·</span><span style={{ color:T.txM, fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.obs}</span></>}
        </div>
      </div>
      {tip && createPortal(
        <div style={{ position:"fixed", left:Math.max(8,pos.x), top:Math.min(pos.y-10,window.innerHeight-200),
          zIndex:99999, background:"#0d1f3a", color:"#fff", borderRadius:12,
          padding:"12px 16px", minWidth:210, maxWidth:280, pointerEvents:"none",
          boxShadow:"0 8px 32px rgba(0,0,0,.35)", fontSize:12, lineHeight:1.6,
          transform:"translateY(-100%)" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:"#7dc8f7" }}>{e.tipo}</div>
          <div>👤 Paciente: <strong>{e.pac}</strong></div>
          <div>📅 Data: <strong>{e.dt}</strong></div>
          <div>📊 Status: <strong>{e.st}</strong></div>
          {e.obs && <div>📝 Obs: <strong>{e.obs}</strong></div>}
        </div>,
        document.body
      )}
    </div>
  );
}

function ConsultaRow({ c, usuario, onChangeStatus, onDelete }) {
  const [tip, setTip] = useState(false);
  const [pos, setPos] = useState({ x:0, y:0 });
  const role = usuario?.role ?? window._crmUsuario?.role;
  return (
    <div style={{ background:T.sur, border:`1px solid ${T.br}`,
      borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", gap:14,
      transition:"all .18s", position:"relative", cursor:"pointer" }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 28px rgba(44,26,8,.1)"; e.currentTarget.style.borderColor=T.b+"45"; setTip(true); const r=e.currentTarget.getBoundingClientRect(); setPos({x:r.left,y:r.top}); }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor=T.br; setTip(false); }}>
      <div style={{ textAlign:"center", flexShrink:0, width:48 }}>
        <div style={{ fontSize:20, fontWeight:800, color:T.b, lineHeight:1 }}>{c.hr}</div>
        <div style={{ fontSize:9, color:T.txS, marginTop:2, letterSpacing:".07em", textTransform:"uppercase" }}>hora</div>
      </div>
      <div style={{ width:1, height:40, background:T.br, flexShrink:0 }} />
      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
        background:c.tipo==="Teleconsulta"?T.grB:T.bL,
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Ic n={c.tipo==="Teleconsulta"?"video":"users"} sz={17} c={c.tipo==="Teleconsulta"?T.gr:T.b} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.tx, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.pac}</div>
        <div style={{ fontSize:12, color:T.txM, marginTop:2 }}>
          {c.proc}
          <span style={{ color:c.tipo==="Teleconsulta"?T.gr:T.b, fontWeight:500, marginLeft:6 }}>· {c.tipo}</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
        {stBadge(c.st)}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {["Confirmado","Aguardando","Cancelado"].filter(s=>s!==c.st).map(ns=>(
            <button key={ns} onClick={()=>onChangeStatus(ns)}
              style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
                border:`1px solid ${T.br}`, background:T.sur2, color:T.txM,
                cursor:"pointer", fontFamily:"inherit", transition:"all .12s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background=T.bL; e.currentTarget.style.color=T.b; e.currentTarget.style.borderColor=T.b+"50"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=T.sur2; e.currentTarget.style.color=T.txM; e.currentTarget.style.borderColor=T.br; }}>
              → {ns}
            </button>
          ))}
          {["admin","medico"].includes(role) && (
            <button onClick={()=>{ if(window.confirm(`Excluir consulta de ${c.pac}?`)) onDelete(); }}
              style={{ width:22, height:22, borderRadius:6, border:"none", background:T.reB,
                color:T.re, cursor:"pointer", fontSize:12, display:"inline-flex",
                alignItems:"center", justifyContent:"center" }}>✕</button>
          )}
        </div>
      </div>
      {tip && createPortal(
        <div style={{ position:"fixed", left:Math.max(8,pos.x), top:Math.min(pos.y-10,window.innerHeight-220),
          zIndex:99999, background:"#0d1f3a", color:"#fff", borderRadius:12,
          padding:"12px 16px", minWidth:220, maxWidth:290, pointerEvents:"none",
          boxShadow:"0 8px 32px rgba(0,0,0,.35)", fontSize:12, lineHeight:1.6,
          transform:"translateY(-100%)" }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6, color:"#7dc8f7" }}>{c.pac}</div>
          <div>🕐 Horário: <strong>{c.hr}</strong></div>
          <div>🏥 Procedimento: <strong>{c.proc}</strong></div>
          <div>📋 Tipo: <strong>{c.tipo}</strong></div>
          <div>✅ Status: <strong>{c.st}</strong></div>
          {c.obs && <div>📝 Obs: <strong>{c.obs}</strong></div>}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function PagePacientes({ usuario, estoqueState, pats, setPats, allExames, setAllExames, setPage, setPacFiltro }) {
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selPac, setSelPac] = useState(null);
  const filtered = pats.filter(p =>
    p.nm.toLowerCase().includes(q.toLowerCase()) ||
    p.tel.includes(q) || p.plano.toLowerCase().includes(q.toLowerCase())
  );
  const abcColor = { A:T.gr, B:T.b, C:T.txM };

  // Ficha aberta em full-page
  if (selPac) return (
    <FichaPacientePage pac={selPac} onClose={()=>setSelPac(null)}
      allExames={allExames} onSaveExame={novo=>setAllExames(p=>[novo,...p])}
      setPage={setPage} setPacFiltro={setPacFiltro}
      onUpdatePac={updated=>setPats(prev=>prev.map(p=>p.id===updated.id?updated:p))} />
  );

  return (
    <div className="page" style={{ padding:"24px 28px 48px", display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
            <Ic n="search" sz={15} c={T.txS} />
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Buscar por nome, telefone ou plano..."
            style={{ ...inp, paddingLeft:38, fontSize:13 }} />
        </div>
        <Btn onClick={()=>setShowNew(true)} icon="plus">Novo paciente</Btn>
      </div>

      {/* Stats strip */}
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        {[
          { label:"Total",    val:pats.length,                           c:T.tx, bg:T.sur  },
          { label:"Ativos",   val:pats.filter(p=>p.st==="Ativo").length, c:T.gr, bg:T.grB  },
          { label:"Classe A", val:pats.filter(p=>p.abc==="A").length,    c:T.gr, bg:T.grB  },
          { label:"Classe B", val:pats.filter(p=>p.abc==="B").length,    c:T.b,  bg:T.bL   },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${T.br}`, borderRadius:10,
            padding:"8px 16px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.val}</span>
            <span style={{ fontSize:12, color:T.txM }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft:"auto", fontSize:12, color:T.txS }}>
          {filtered.length} resultado{filtered.length!==1?"s":""}
        </div>
      </div>

      {/* Tabela — SEM coluna de avatar */}
      <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2.6fr 1fr 1.3fr 1.1fr .8fr .5fr .4fr",
          padding:"12px 22px", background:T.sur2, borderBottom:`1px solid ${T.br}`,
          fontSize:11, fontWeight:700, color:T.txM, textTransform:"uppercase",
          letterSpacing:".08em", gap:8 }}>
          <span>Paciente</span><span>Nascimento</span><span>Telefone</span>
          <span>Plano</span><span>Status</span><span>Cl.</span>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding:"52px 20px", textAlign:"center", color:T.txS, fontSize:14 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
            Nenhum paciente encontrado
          </div>
        )}
        {filtered.map((p,i) => (
          <PatRow key={p.id} p={p} i={i} total={filtered.length}
            usuario={usuario} abcColor={abcColor}
            onOpen={()=>setSelPac(p)}
            onDelete={()=>setPats(prev=>prev.filter(x=>x.id!==p.id))} />
        ))}
      </div>

      {showNew && (
        <PopupNovoPaciente
          onClose={()=>setShowNew(false)}
          onSave={novo=>setPats(p=>[novo,...p])}
          onSaveConsulta={novaC=>{/* consultas gerenciadas localmente */}}
          onSaveExame={novo=>setAllExames(p=>[novo,...p])}
        />
      )}
    </div>
  );
}

// ─── Ficha Completa do Paciente (página inteira, estilo imagem 3) ──────────────
function FichaPacientePage({ pac, onClose, allExames, onSaveExame, setPage, setPacFiltro, onUpdatePac }) {
  const [tab, setTab]               = useState("anamneses");
  const [anamneses, setAnamneses]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("anamneses_"+pac.id)||"[]"); } catch(e){return[];}
  });
  const [atestados, setAtestados]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("atestados_"+pac.id)||"[]"); } catch(e){return[];}
  });
  const [showAddAnam, setShowAddAnam] = useState(false);
  const [showAddAtest, setShowAddAtest] = useState(false);
  const [anamForm, setAnamForm] = useState({ titulo:"Anamnese inicial - Caixa de Texto", texto:"" });
  const [atestForm, setAtestForm] = useState({ dias:"1", motivo:"", obs:"" });
  const meusExames = allExames.filter(e=>e.pac===pac.nm);

  function saveAnamnese() {
    if(!anamForm.texto.trim()){alert("Preencha o texto da anamnese");return;}
    const novo = {
      id:"an"+Date.now(),
      titulo: anamForm.titulo,
      texto: anamForm.texto,
      profissional:"Ilza Ezequiel (Ilza Costa Ezequiel Neta)",
      dt: new Date().toLocaleString("pt-BR"),
      dtNum: Date.now(),
    };
    const atualizado = [novo, ...anamneses];
    setAnamneses(atualizado);
    localStorage.setItem("anamneses_"+pac.id, JSON.stringify(atualizado));
    setAnamForm({ titulo:"Anamnese inicial - Caixa de Texto", texto:"" });
    setShowAddAnam(false);
  }

  function saveAtestado() {
    if(!atestForm.motivo.trim()){alert("Preencha o motivo do atestado");return;}
    const novo = {
      id:"at"+Date.now(),
      dias: atestForm.dias,
      motivo: atestForm.motivo,
      obs: atestForm.obs,
      profissional:"Dra. Ilza Costa Ezequiel Neta",
      dt: new Date().toLocaleString("pt-BR"),
      dtNum: Date.now(),
    };
    const atualizado = [novo, ...atestados];
    setAtestados(atualizado);
    localStorage.setItem("atestados_"+pac.id, JSON.stringify(atualizado));
    setAtestForm({ dias:"1", motivo:"", obs:"" });
    setShowAddAtest(false);
  }

  function imprimirAtestado(a) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Atestado Médico</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}
    .header{text-align:center;border-bottom:2px solid #0d2137;padding-bottom:16px;margin-bottom:24px}
    .title{font-size:22px;font-weight:bold;color:#0d2137;margin:8px 0}
    h3{color:#0d2137}.content{line-height:2;font-size:15px}
    .assinatura{margin-top:60px;text-align:center;border-top:1px solid #999;padding-top:10px}</style>
    </head><body>
    <div class="header"><div class="title">ATESTADO MÉDICO</div>
    <div>Dra. Ilza Costa Ezequiel Neta · CRM-SP 157236</div>
    <div>Gastroenterologista · Santos, SP</div></div>
    <div class="content">
    <p>Atesto que o(a) paciente <strong>${pac.nm}</strong> esteve sob minha consulta médica
    e necessita de afastamento de suas atividades por <strong>${a.dias} dia(s)</strong>,
    a partir da data de emissão deste documento.</p>
    <p><strong>Motivo:</strong> ${a.motivo}</p>
    ${a.obs?`<p><strong>Observações:</strong> ${a.obs}</p>`:''}
    <p><strong>Data de emissão:</strong> ${a.dt}</p>
    </div>
    <div class="assinatura">
    <p>___________________________________</p>
    <p><strong>Dra. Ilza Costa Ezequiel Neta</strong></p>
    <p>CRM-SP 157236 · Gastroenterologista</p></div>
    </body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  }

  const tabs = [
    { key:"anamneses", label:`Anamneses (${anamneses.length})`, icon:"📋" },
    { key:"atestado",  label:`Atestados (${atestados.length})`,  icon:"📄" },
    { key:"exames",    label:`Exames (${meusExames.length})`,    icon:"🔬" },
    { key:"info",      label:"Informações",                      icon:"👤" },
  ];

  const initials = pac.nm.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();

  return (
    <div style={{ padding:"0 0 48px", display:"flex", flexDirection:"column", gap:0, minHeight:"100%" }}>
      {/* Header estilo imagem 3 */}
      <div style={{ background:"linear-gradient(135deg,#1a5fa8 0%,#0d2137 60%,#1a8c82 100%)",
        borderRadius:14, padding:"24px 28px", marginBottom:24, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:160, height:160, borderRadius:"50%",
          background:"rgba(255,255,255,.04)", pointerEvents:"none" }}/>
        <button onClick={onClose}
          style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.12)",
            border:"none", color:"#fff", borderRadius:8, padding:"5px 12px", cursor:"pointer",
            fontSize:12, fontWeight:600, fontFamily:"inherit" }}>
          ← Voltar
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:20 }}>
          <div style={{ width:70, height:70, borderRadius:"50%", flexShrink:0,
            background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.3)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:26, fontWeight:700, color:"#fff" }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:"#fff", letterSpacing:"-.02em" }}>
              {pac.nm}
              {pac.whatsapp && <span style={{ marginLeft:10, fontSize:18 }}>💬</span>}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:4, display:"flex", gap:14, flexWrap:"wrap" }}>
              {pac.nasc && <span>📅 {pac.nasc}</span>}
              {pac.cpf  && <span>🪪 CPF: {pac.cpf}</span>}
              {pac.email && <span>✉ {pac.email}</span>}
              {pac.tel   && <span>📞 {pac.tel}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs estilo imagem 3 */}
      <div style={{ display:"flex", gap:1, marginBottom:24, borderBottom:`2px solid ${T.br}` }}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{ padding:"10px 20px", fontSize:13, fontWeight:tab===t.key?700:500,
              color:tab===t.key?T.b:T.txM, border:"none", background:"none", cursor:"pointer",
              fontFamily:"inherit", borderBottom:tab===t.key?`2px solid ${T.b}`:"2px solid transparent",
              marginBottom:-2, display:"flex", alignItems:"center", gap:6 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Anamneses */}
      {tab==="anamneses" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
            <button onClick={()=>setShowAddAnam(true)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px",
                background:"linear-gradient(135deg,#1a5fa8,#0d2137)",
                color:"#fff", border:"none", borderRadius:10, cursor:"pointer",
                fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
              📋 Adicionar Anamnese
            </button>
          </div>

          {showAddAnam && (
            <div style={{ background:T.bL, border:`1.5px solid ${T.b}40`, borderRadius:14,
              padding:"20px", marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.b, marginBottom:14 }}>Nova Anamnese</div>
              <Fld label="Título">
                <select style={inp} value={anamForm.titulo}
                  onChange={e=>setAnamForm(p=>({...p,titulo:e.target.value}))}>
                  {["Anamnese inicial - Caixa de Texto","Retorno","Consulta de rotina",
                    "Urgência","Resultado de exame"].map(t=><option key={t}>{t}</option>)}
                </select>
              </Fld>
              <Fld label="Texto da anamnese *">
                <textarea style={{ ...inp, minHeight:140, resize:"vertical", lineHeight:1.7 }}
                  value={anamForm.texto} autoFocus
                  placeholder="Queixas, histórico, exame físico, hipóteses diagnósticas, conduta..."
                  onChange={e=>setAnamForm(p=>({...p,texto:e.target.value}))} />
              </Fld>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <Btn variant="secondary" small onClick={()=>setShowAddAnam(false)}>Cancelar</Btn>
                <Btn small onClick={saveAnamnese} icon="check">Salvar</Btn>
              </div>
            </div>
          )}

          {/* Tabela de anamneses estilo imagem 3 */}
          <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 2fr 1fr",
              padding:"10px 20px", background:T.sur2, borderBottom:`1px solid ${T.br}`,
              fontSize:11, fontWeight:700, color:T.txM, textTransform:"uppercase", gap:12 }}>
              <span>Data</span><span>Título</span><span>Profissional</span><span>Opções</span>
            </div>
            {anamneses.length===0 ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:T.txS }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                <div>Nenhuma anamnese registrada</div>
                <div style={{ fontSize:11, marginTop:4 }}>Clique em "Adicionar Anamnese" para começar</div>
              </div>
            ) : anamneses.map((a,i)=>(
              <div key={a.id} style={{ display:"grid", gridTemplateColumns:"1fr 2fr 2fr 1fr",
                padding:"13px 20px", gap:12, alignItems:"center",
                borderBottom:i<anamneses.length-1?`1px solid ${T.br}`:"none",
                transition:"background .12s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.sur2}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{ fontSize:12, color:T.txM }}>{a.dt}</span>
                <span style={{ fontSize:13, fontWeight:500, color:T.tx }}>{a.titulo}</span>
                <span style={{ fontSize:12, color:T.txM }}>{a.profissional}</span>
                <div style={{ display:"flex", gap:6 }}>
                  <button title="Ver" onClick={()=>alert(a.titulo+"\n\n"+a.texto)}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:T.b }}>👁</button>
                  <button title="Excluir" onClick={()=>{
                    if(window.confirm("Excluir esta anamnese?")) {
                      const novo=anamneses.filter(x=>x.id!==a.id);
                      setAnamneses(novo);
                      localStorage.setItem("anamneses_"+pac.id, JSON.stringify(novo));
                    }}}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:T.re }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Atestados Médicos */}
      {tab==="atestado" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
            <button onClick={()=>setShowAddAtest(true)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px",
                background:"linear-gradient(135deg,#2D7A4F,#1a5a38)",
                color:"#fff", border:"none", borderRadius:10, cursor:"pointer",
                fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
              📄 Emitir Atestado
            </button>
          </div>

          {showAddAtest && (
            <div style={{ background:T.grB, border:`1.5px solid ${T.gr}40`, borderRadius:14,
              padding:"20px", marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.gr, marginBottom:14 }}>
                📄 Novo Atestado Médico — {pac.nm}
              </div>
              <Fld label="Dias de afastamento">
                <select style={inp} value={atestForm.dias}
                  onChange={e=>setAtestForm(p=>({...p,dias:e.target.value}))}>
                  {["1","2","3","5","7","10","14","15","30"].map(d=><option key={d}>{d}</option>)}
                </select>
              </Fld>
              <Fld label="Motivo / CID *">
                <input style={inp} value={atestForm.motivo} placeholder="Ex: Gastroenterite aguda (A09)"
                  onChange={e=>setAtestForm(p=>({...p,motivo:e.target.value}))} />
              </Fld>
              <Fld label="Observações (opcional)">
                <textarea style={{ ...inp, minHeight:80, resize:"vertical" }}
                  value={atestForm.obs} placeholder="Orientações adicionais..."
                  onChange={e=>setAtestForm(p=>({...p,obs:e.target.value}))} />
              </Fld>
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <Btn variant="secondary" small onClick={()=>setShowAddAtest(false)}>Cancelar</Btn>
                <Btn small onClick={saveAtestado} icon="check">Salvar e emitir</Btn>
              </div>
            </div>
          )}

          <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 1fr",
              padding:"10px 20px", background:T.sur2, borderBottom:`1px solid ${T.br}`,
              fontSize:11, fontWeight:700, color:T.txM, textTransform:"uppercase", gap:12 }}>
              <span>Data</span><span>Motivo</span><span>Dias</span><span>Ações</span>
            </div>
            {atestados.length===0 ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:T.txS }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📄</div>
                <div>Nenhum atestado emitido</div>
              </div>
            ) : atestados.map((a,i)=>(
              <div key={a.id} style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 1fr",
                padding:"13px 20px", gap:12, alignItems:"center",
                borderBottom:i<atestados.length-1?`1px solid ${T.br}`:"none" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.sur2}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{ fontSize:12, color:T.txM }}>{a.dt}</span>
                <span style={{ fontSize:13, color:T.tx }}>{a.motivo}</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.gr }}>{a.dias} dia(s)</span>
                <div style={{ display:"flex", gap:6 }}>
                  <button title="Imprimir" onClick={()=>imprimirAtestado(a)}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16 }}>🖨️</button>
                  <button title="Excluir" onClick={()=>{
                    if(window.confirm("Excluir este atestado?")) {
                      const novo=atestados.filter(x=>x.id!==a.id);
                      setAtestados(novo);
                      localStorage.setItem("atestados_"+pac.id,JSON.stringify(novo));
                    }}}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:T.re }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Exames */}
      {tab==="exames" && (
        <div>
          {meusExames.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:T.txS }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🔬</div>
              <div>Nenhum exame registrado para {pac.nm}</div>
            </div>
          ) : meusExames.map(e=>(
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
              background:T.sur, border:`1px solid ${T.br}`, borderRadius:12, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:T.bL, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="exam" sz={16} c={T.b} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>{e.tipo}</div>
                <div style={{ fontSize:11, color:T.txS, marginTop:2 }}>{e.dt} {e.obs&&`· ${e.obs}`}</div>
              </div>
              {stBadge(e.st)}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Informações */}
      {tab==="info" && (
        <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
          {[
            ["Data Nasc.", pac.nasc], ["Sexo", pac.sexo], ["CPF", pac.cpf],
            ["Telefone", pac.tel], ["WhatsApp", pac.whatsapp], ["E-mail", pac.email],
            ["Plano", pac.plano], ["Status", pac.st],
          ].filter(([,v])=>v).map(([label,value])=>(
            <div key={label} style={{ display:"flex", gap:12, padding:"11px 0", borderBottom:`1px solid ${T.br}` }}>
              <span style={{ fontSize:11, fontWeight:700, color:T.txS, textTransform:"uppercase",
                letterSpacing:".07em", minWidth:120, flexShrink:0 }}>{label}</span>
              <span style={{ fontSize:13, color:T.tx, fontWeight:500 }}>{value}</span>
            </div>
          ))}
          {pac.obs && (
            <div style={{ marginTop:14, background:T.amB, border:`1px solid ${T.amBr}`,
              borderRadius:10, padding:"12px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.am, textTransform:"uppercase",
                letterSpacing:".07em", marginBottom:6 }}>Observações clínicas</div>
              <div style={{ fontSize:13, color:T.tx, lineHeight:1.6 }}>{pac.obs}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Popup novo exame ─────────────────────────────────────────────────────────



function PageExames({ usuario, estoqueState, exames, setExames, pacFiltro, setPacFiltro }) {
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const byPac    = pacFiltro ? exames.filter(e=>e.pac===pacFiltro) : exames;
  const filtered = byPac.filter(e =>
    e.pac.toLowerCase().includes(q.toLowerCase()) ||
    e.tipo.toLowerCase().includes(q.toLowerCase())
  );
  const examAccent = tipo => {
    if (tipo.includes("EDA")||tipo.includes("Endoscopia")) return { c:"#A8722A", bg:"#FDF3E3" };
    if (tipo.includes("Colonoscopia"))  return { c:"#6D4E8A", bg:"#F4EFF9" };
    if (tipo.includes("USG"))           return { c:"#7C3AED", bg:"#F5F3FF" };
    if (tipo.includes("Vitamina")||tipo.includes("Ferro")||tipo.includes("Hemograma")||tipo.includes("TSH"))
      return { c:"#9A6A00", bg:"#FFF8E6" };
    return { c:"#2D7A4F", bg:"#EDF7F1" };
  };
  return (
    <div className="page" style={{ padding:"24px 28px 48px", display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}>
            <Ic n="search" sz={15} c={T.txS} />
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Buscar exame ou paciente..."
            style={{ ...inp, paddingLeft:38, fontSize:13 }} />
        </div>
        <Btn onClick={()=>setShowNew(true)} icon="plus">Solicitar exame</Btn>
      </div>

      {pacFiltro && (
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:T.txM }}>Filtrando por:</span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:13,
            fontWeight:600, color:T.b, background:T.bL, border:`1.5px solid ${T.b}30`,
            borderRadius:99, padding:"5px 14px 5px 12px" }}>
            {pacFiltro}
            <button onClick={()=>setPacFiltro(null)}
              style={{ background:"none", border:"none", cursor:"pointer", padding:0,
                display:"flex", marginLeft:2, opacity:.6 }}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity=".6"}>
              <Ic n="close" sz={13} c={T.b} sw={2.5} />
            </button>
          </span>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))", gap:14 }}>
        {filtered.map(e => (
          <ExameCard key={e.id} e={e} usuario={usuario}
            onDelete={()=>setExames(p=>p.filter(x=>x.id!==e.id))} />
        ))}
        {/* Add card */}
        <div onClick={()=>setShowNew(true)}
          style={{ background:"transparent", border:`2px dashed ${T.brD}`, borderRadius:16,
            padding:"24px 18px", cursor:"pointer", minHeight:130,
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", gap:10, transition:"all .2s" }}
          onMouseEnter={e=>{ e.currentTarget.style.background=T.bL; e.currentTarget.style.borderColor=T.b; }}
          onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=T.brD; }}>
          <div style={{ width:46, height:46, borderRadius:12,
            background:"linear-gradient(135deg,#A8722A,#7A5018)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 16px rgba(168,114,42,.35)" }}>
            <Ic n="plus" sz={22} c="#fff" sw={2} />
          </div>
          <span style={{ fontSize:13, fontWeight:600, color:T.txM }}>Solicitar exame</span>
        </div>
      </div>

      {showNew && (
        <PopupNovoExame onClose={()=>setShowNew(false)}
          onSave={novo=>{ setExames(p=>[novo,...p]); setShowNew(false); }} />
      )}
    </div>
  );
}

// ─── Popup nova consulta ──────────────────────────────────────────────────────


function PageEstoque({usuario,estoqueState}){
  const [itens,setItens]=estoqueState;
  const [showNew,setShowNew]=useState(false);
  const [showMov,setShowMov]=useState(null);
  const [form,setForm]=useState({nome:"",cat:"Injetável",qtd:0,min:5,max:50,vl:0,un:"un"});
  const [movQtd,setMovQtd]=useState(1);
  const [movTp,setMovTp]=useState("entrada");

  const criticos=itens.filter(i=>i.qtd<=i.min);
  const valorTotal=itens.reduce((s,i)=>s+(parseFloat(i.qtd)||0)*(parseFloat(i.vl)||0),0);

  function addItem(){
    setItens(p=>[...p,{...form,id:`e${Date.now()}`,qtd:Number(form.qtd),min:Number(form.min),max:Number(form.max),vl:Number(form.vl)}]);
    setShowNew(false);
    setForm({nome:"",cat:"Injetável",qtd:0,min:5,max:50,vl:0,un:"un"});
  }
  function doMov(){
    if(!showMov) return;
    const delta=movTp==="entrada"?Number(movQtd):-Number(movQtd);
    setItens(p=>p.map(i=>i.id===showMov.id?{...i,qtd:Math.max(0,parseFloat((parseFloat(i.qtd)+delta).toFixed(2)))}:i));
    auditAdd(usuario.nome,`ESTOQUE_${movTp.toUpperCase()}`,`${showMov.nome} x${movQtd}`);
    setShowMov(null);setMovQtd(1);
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {showNew&&(
        <Modal title="📦 Novo Item de Estoque" onClose={()=>setShowNew(false)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={SL}>Nome *</label><input value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))} placeholder="Ex: Vitamina C EV 3g" style={SI}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={SL}>Categoria</label><select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={SI}>{["Consumível Teste","Injetável","Medicamento","Material","Higiene","Equipamento"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label style={SL}>Unidade</label><input value={form.un} onChange={e=>setForm(p=>({...p,un:e.target.value}))} placeholder="ampola, cps, frasco..." style={SI}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div><label style={SL}>Qtd. Atual</label><input type="number" value={form.qtd} onChange={e=>setForm(p=>({...p,qtd:e.target.value}))} style={SI}/></div>
              <div><label style={SL}>Mín.</label><input type="number" value={form.min} onChange={e=>setForm(p=>({...p,min:e.target.value}))} style={SI}/></div>
              <div><label style={SL}>Máx.</label><input type="number" value={form.max} onChange={e=>setForm(p=>({...p,max:e.target.value}))} style={SI}/></div>
            </div>
            <div><label style={SL}>Valor Unitário (R$)</label><input type="number" step="0.01" value={form.vl} onChange={e=>setForm(p=>({...p,vl:e.target.value}))} style={SI}/></div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="g" onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn v="p" onClick={addItem}>✅ Adicionar</Btn></div>
          </div>
        </Modal>
      )}
      {showMov&&(
        <Modal title={`🔄 Movimentação — ${showMov.nome}`} onClose={()=>setShowMov(null)} width={400}>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {["entrada","saida"].map(t=>(
              <button key={t} onClick={()=>setMovTp(t)} style={{flex:1,padding:"10px",borderRadius:9,border:`2px solid ${movTp===t?(t==="entrada"?C.green:C.red):C.brd}`,background:movTp===t?(t==="entrada"?`${C.green}12`:`rgba(192,57,43,.08)`):"transparent",color:movTp===t?(t==="entrada"?C.green:C.red):C.txM,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{t==="entrada"?"📥 Entrada":"📤 Saída"}</button>
            ))}
          </div>
          <div style={{background:C.card2,borderRadius:10,padding:"10px 14px",marginBottom:14}}>
            <p style={{color:C.txM,fontSize:11,margin:"0 0 4px"}}>Estoque atual: <strong style={{color:C.tx}}>{showMov.qtd} {showMov.un}</strong></p>
            {showMov.nota&&<p style={{color:C.txM,fontSize:10,margin:0,fontStyle:"italic"}}>{showMov.nota}</p>}
          </div>
          <label style={SL}>Quantidade</label>
          <input type="number" min="0.05" step="0.05" value={movQtd} onChange={e=>setMovQtd(e.target.value)} style={{...SI,marginBottom:14}}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="g" onClick={()=>setShowMov(null)}>Cancelar</Btn><Btn v={movTp==="entrada"?"green":"red"} onClick={doMov}>✅ Confirmar</Btn></div>
        </Modal>
      )}

      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.brd}`,background:C.card,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <h2 style={{color:C.tx,fontSize:18,fontWeight:800,margin:0}}>📦 Controle de Estoque</h2>
            <p style={{color:C.txM,fontSize:12,margin:"2px 0 0"}}>Consumíveis de teste: debitados automaticamente · Alerta em vermelho abaixo do mínimo</p>
          </div>
          <Btn v="p" sm onClick={()=>setShowNew(true)}>+ Novo Item</Btn>
          <BtnExportar
            onCSV={()=>exportarCSV([
              {label:"Nome",       key:"nome"},
              {label:"Categoria",  key:"cat"},
              {label:"Qtd. Atual", key:"qtd"},
              {label:"Mín.",       key:"min"},
              {label:"Máx.",       key:"max"},
              {label:"Vlr. Unit.", key:"vl"},
              {label:"Unidade",    key:"un"},
              {label:"Status",     get:i=>i.qtd<=i.min?"⚠️ Crítico":i.qtd>=i.max?"📦 Cheio":"✅ OK"},
            ], itens, "estoque_crm")}
            onPDF={()=>exportarPDF("Estoque", `${itens.length} itens · ${criticos.length} críticos`, [
              {label:"Nome",      key:"nome"},
              {label:"Categoria", key:"cat"},
              {label:"Qtd.",      key:"qtd"},
              {label:"Mín.",      key:"min"},
              {label:"Vlr. Unit.",key:"vl"},
              {label:"Status",    get:i=>i.qtd<=i.min?"⚠️ Crítico":"✅ OK"},
            ], itens)}
            onImportCSV={(header, rows)=>{
              const nmIdx=header.findIndex(h=>h.toLowerCase().includes("nome"));
              const qtdIdx=header.findIndex(h=>h.toLowerCase().includes("qtd"));
              if(nmIdx<0){alert("Coluna 'Nome' não encontrada no CSV.");return;}
              const atualizados=rows.filter(r=>r[nmIdx]&&r[nmIdx].trim()).map(r=>({
                id:"est"+Date.now()+Math.random().toString(36).slice(2),
                nome:r[nmIdx]||"",
                cat:header.findIndex(h=>h.toLowerCase().includes("cat"))>=0?r[header.findIndex(h=>h.toLowerCase().includes("cat"))]:"Geral",
                qtd:qtdIdx>=0?parseFloat(r[qtdIdx])||0:0,
                min:0,max:100,vl:0,un:"un"
              }));
              if(atualizados.length===0){alert("Nenhum item encontrado no CSV.");return;}
              setEstoqueItens(prev=>[...prev,...atualizados]);
              alert(`✅ ${atualizados.length} item(s) importado(s) ao estoque!`);
            }}
          />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[{l:"Itens",v:itens.length,c:C.p},{l:"Críticos 🚨",v:criticos.length,c:criticos.length>0?C.red:C.green},{l:"Valor Total",v:`R$${(valorTotal/1000).toFixed(1)}k`,c:C.gold},{l:"Categorias",v:[...new Set(itens.map(i=>i.cat))].length,c:C.teal}].map((s,i)=>(
            <div key={i} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1.5px solid ${s.l.includes("Crít")&&criticos.length>0?C.red+"40":C.brd}`}}>
              <p style={{color:s.c,fontSize:20,fontWeight:900,margin:0}}>{s.v}</p>
              <p style={{color:C.txM,fontSize:10,textTransform:"uppercase",margin:"4px 0 0"}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {criticos.length>0&&(
        <div style={{background:"rgba(192,57,43,.07)",borderBottom:`1px solid rgba(192,57,43,.2)`,padding:"10px 20px",flexShrink:0}}>
          <p style={{color:C.red,fontSize:11,fontWeight:700,margin:0}}>🚨 ESTOQUE CRÍTICO: {criticos.map(i=>i.nome).join(" · ")}</p>
        </div>
      )}

      {/* Consumíveis de Teste em destaque */}
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,background:`${C.teal}06`,flexShrink:0}}>
        <p style={{color:C.teal,fontSize:11,fontWeight:700,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:".07em"}}>⚗️ Consumíveis de Testes Respiratórios (desconto automático)</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {itens.filter(i=>i.autoDesc).map(it=>{
            const isCrit=it.qtd<=it.min;
            const pct=Math.min(100,Math.round((it.qtd/it.max)*100));
            return(
              <div key={it.id} style={{background:isCrit?"rgba(192,57,43,.06)":"#fff",border:`2px solid ${isCrit?C.red+"60":C.teal+"40"}`,borderRadius:10,padding:"10px 12px"}}>
                <p style={{color:C.tx,fontWeight:700,fontSize:12,margin:"0 0 2px"}}>{it.nome}</p>
                {it.nota&&<p style={{color:C.txM,fontSize:10,margin:"0 0 6px",fontStyle:"italic"}}>{it.nota}</p>}
                <p style={{color:isCrit?C.red:C.teal,fontSize:20,fontWeight:900,margin:"0 0 4px"}}>{it.qtd} <span style={{fontSize:11,fontWeight:400}}>{it.un}</span></p>
                <div style={{height:4,background:C.card3,borderRadius:99,overflow:"hidden",marginBottom:6}}>
                  <div style={{width:`${pct}%`,height:"100%",background:isCrit?C.red:C.teal,borderRadius:99}}/>
                </div>
                {isCrit&&<p style={{color:C.red,fontSize:10,fontWeight:700,margin:0}}>🚨 REPOR URGENTE (mín: {it.min})</p>}
                <button onClick={()=>setShowMov(it)} style={{width:"100%",background:`${C.teal}10`,border:`1px solid ${C.teal}30`,color:C.teal,borderRadius:7,padding:"5px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:6}}>🔄 Movimentar</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:16}}>
        <p style={{color:C.txM,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",margin:"0 0 10px"}}>Estoque Geral</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {itens.filter(i=>!i.autoDesc).map(it=>{
            const pct=Math.min(100,Math.round((it.qtd/it.max)*100));
            const isCrit=it.qtd<=it.min;
            const cor=isCrit?C.red:it.qtd<it.max*0.4?C.amber:C.green;
            return(
              <div key={it.id} style={{background:C.card,borderRadius:14,padding:16,border:`1.5px solid ${isCrit?`${C.red}40`:C.brd}`,boxShadow:isCrit?`0 0 0 3px ${C.red}15`:`0 2px 8px ${C.sh}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div><p style={{color:C.tx,fontWeight:700,fontSize:13,margin:0}}>{it.nome}</p><p style={{color:C.txM,fontSize:11,margin:"2px 0 0"}}>{it.cat} · {it.un}</p></div>
                  {isCrit&&<span style={{background:`${C.red}15`,color:C.red,border:`1px solid ${C.red}30`,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:800}}>🚨 CRÍTICO</span>}
                </div>
                <p style={{color:cor,fontSize:24,fontWeight:900,margin:"0 0 4px"}}>{it.qtd}</p>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <p style={{color:C.txM,fontSize:10,margin:0}}>mín: {it.min} · máx: {it.max}</p>
                  {it.vl>0&&<p style={{color:C.txM,fontSize:10,margin:0}}>{fmtMoeda(it.vl)}/un</p>}
                </div>
                <div style={{height:6,background:C.card3,borderRadius:99,overflow:"hidden",marginBottom:10}}>
                  <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${cor},${cor}cc)`,borderRadius:99}}/>
                </div>
                <button onClick={()=>setShowMov(it)} style={{width:"100%",background:`${C.p}10`,border:`1px solid ${C.p}30`,color:C.p,borderRadius:8,padding:"6px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔄 Movimentar</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PATS_BASE — fallback inicial de pacientes para o Inbox
   (v32: definição movida para antes do PageInbox)
════════════════════════════════════════════════════════════════ */
const PATS_BASE = (() => {
  try {
    const s = localStorage.getItem("crm_pats_v26");
    if (s) return JSON.parse(s);
  } catch(e) {}
  return [];
})();

/* ════════════════════════════════════════════════════════════════
   INBOX GENÉRICO — WhatsApp / Instagram
   • IA aprende com base de conhecimento
   • Auto-prontuário ao detectar novo paciente
   • Popup prioridade para "falar com a Dra."
   • VIP icon 👑 para Plano 360°
   • Botão imprimir prontuário universal
════════════════════════════════════════════════════════════════ */
function PageInbox({usuario,canal,baseData,accentColor,headerGrad,canalLabel,patsState,setPage}){
  const [convs,setConvs]=useState(()=>{try{const s=localStorage.getItem("crm_convs_"+canal);return s?JSON.parse(s):baseData;}catch(e){return baseData;}});
  useEffect(()=>{localStorage.setItem("crm_convs_"+canal,JSON.stringify(convs));},[convs,canal]);
  const [sel,setSel]=useState(null);
  const [txt,setTxt]=useState("");
  const [showPC,setShowPC]=useState(false);
  const [pcCv,setPcCv]=useState(null);
  const [saved,setSaved]=useState([]);
  const [showScript,setShowScript]=useState(false);
  const [aiLoad,setAiLoad]=useState(false);
  const [aiErr,setAiErr]=useState("");
  const [sugestaoIA,setSugestaoIA]=useState(null);
  const [showProntuario,setShowProntuario]=useState(null);
  const [showPrioridade,setShowPrioridade]=useState(null);
  const [pats,setPats]=patsState||[PATS_BASE,[()=>{}]];
  const bottomRef=useRef();
  const canPC=["admin","medico","recepcao"].includes(usuario.role);
  const isIG=canal==="instagram";
  const isWA=canal==="whatsapp";
  const [ligTab,setLigTab]=useState("msgs");
  const [ligacoes,setLigacoes]=useState(()=>{try{const s=localStorage.getItem("crm_ligacoes_v25");return s?JSON.parse(s):(isWA?WA_LIGACOES_INIT:[]);}catch(e){return [];}});
  useEffect(()=>{localStorage.setItem("crm_ligacoes_v25",JSON.stringify(ligacoes));},[ligacoes]);
  const [ligNota,setLigNota]=useState(null);
  const isTK=canal==="tiktok";
  const TK_GRAD_INB="linear-gradient(135deg,#010101 0%,#69C9D0 50%,#EE1D52 100%)";

  useEffect(()=>{if(bottomRef.current)bottomRef.current.scrollIntoView({behavior:"smooth"});},[sel,convs]);

  // Detecta padrão IA ao selecionar conversa
  useEffect(()=>{
    if(!sel) return;
    const ultima=sel.msgs&&sel.msgs.length?sel.msgs[sel.msgs.length-1]:null;
    if(!ultima||ultima.de!=="p") return;
    const nome=sel.nm.replace("@","").split(/[\s._]+/)[0]||"";
    const pad=detectarPadraoIA(ultima.tx, nome);
    setSugestaoIA(pad);
    // Detectar se quer falar com a Dra — abre popup prioridade
    if(querFalarComDra(ultima.tx)){
      setShowPrioridade({pac:sel.nm, canal:canalLabel, msg:ultima.tx, vip:sel.vip||false});
      addFilaPrioridade(sel.nm, canalLabel, ultima.tx);
      auditAdd(usuario.nome,"PRIORIDADE_DRA",sel.nm+" — "+ultima.tx.slice(0,60));
    }
  },[sel]);

  function sendMsg(){
    if(!txt.trim()||!sel) return;
    const hr=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    const novaMsgs=[...sel.msgs,{de:"c",tx:txt,hr}];
    setConvs(c=>c.map(cv=>cv.id!==sel.id?cv:{...cv,msgs:novaMsgs,nova:false}));
    setSel(s=>({...s,msgs:novaMsgs}));
    setTxt("");setSugestaoIA(null);
  }

  function gerarIA(){
    if(!sel||aiLoad) return;
    setAiLoad(true);setAiErr("");
    const nome=sel.nm.replace("@","").split(/[\s._]+/)[0]||"Paciente";
    const hist=sel.msgs.map(m=>"["+(m.de==="p"?"Paciente":NOME_IA)+"] "+m.tx).join("\n");
    // Incluir base de conhecimento contextual no prompt
    const kbRelevante=IA_KNOWLEDGE_BASE.filter(kb=>kb.gatilho&&hist.toLowerCase().split("|").some(t=>hist.toLowerCase().includes(t))).map(kb=>"[Padrão: "+kb.titulo+"] — "+kb.resposta.replace(/{nome}/g,nome)).slice(0,3).join("\n");
    const prompt="Canal: "+(isIG?"Instagram":"WhatsApp")+"\nPaciente: "+nome+(sel.vip?" [VIP - Plano 360°]":"")+"\nEtapa: "+(sel.etapa||"inicio")+"\n\n"+
      (kbRelevante?"Padrões aprendidos relevantes:\n"+kbRelevante+"\n\n":"")+
      "Histórico:\n"+hist+"\n\nGere a próxima mensagem da "+NOME_IA+", usando o nome "+nome+". Apenas o texto da mensagem.";
    fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,system:IA_SYSTEM,messages:[{role:"user",content:prompt}]})
    }).then(r=>r.json()).then(d=>{
      if(d.content&&d.content[0]&&d.content[0].text){setTxt(d.content[0].text.trim());setShowScript(false);}
      else setAiErr("IA sem resposta. Tente novamente.");
      setAiLoad(false);
    }).catch(()=>{setAiErr("Erro de conexão com a IA.");setAiLoad(false);});
  }

  function usarSugestaoIA(){
    if(sugestaoIA) setTxt(sugestaoIA.respostaFinal);
    setSugestaoIA(null);
  }

  function usarScript(etapa){
    const nome=sel?sel.nm.replace("@","").split(/[\s._]+/)[0]:"";
    setTxt(etapa.mensagem.replace(/{nome}/g,nome));
    setShowScript(false);
  }

  function setTag(cvId,tagId){
    setConvs(c=>c.map(cv=>cv.id!==cvId?cv:{...cv,tag:tagId}));
    if(sel&&sel.id===cvId)setSel(s=>({...s,tag:tagId}));
    auditAdd(usuario.nome,"TAG",cvId+"->"+(tagId||"sem"));
  }

  function savePc(form){
    // Auto-cria prontuário ao salvar pré-cadastro
    const novoPat={
      id:"p_auto_"+Date.now(), pront:Date.now()%9000000+1000000,
      nm:form.nome, cpf:"", nasc:"", email:"", st:"Ativo",
      tel:form.tel||"", abc:"", vip:false, origem:canalLabel,
      queixa:form.queixa||"", ats:[]
    };
    if(setPats) setPats(p=>[novoPat,...p]);
    setSaved(p=>[...p,{...form,id:"pc_"+Date.now(),criadoEm:new Date().toLocaleString("pt-BR"),prontuarioId:novoPat.id}]);
    setConvs(p=>p.map(c=>c.id===pcCv.id?{...c,nova:false,tag:"agendado",prontuarioId:novoPat.id}:c));
    auditAdd(usuario.nome,"PRONTUARIO_AUTO",form.nome+" — prontuário criado automaticamente via "+canalLabel);
    setShowPC(false);
  }

  function imprimirProntuarioPaciente(cv){
    const pat=pats.find(p=>p.nm===cv.nm||p.id===cv.prontuarioId);
    const hist=cv.msgs||[];
    let html=`<!DOCTYPE html><html><head><meta charset='UTF-8'><style>
      body{font-family:sans-serif;padding:32px;max-width:780px;margin:0 auto;color:#0d1f35}
      h2{color:#1a5fa8;border-bottom:3px solid #1a5fa8;padding-bottom:8px}
      h3{color:#1a5fa8;margin-top:20px;font-size:15px}
      p{font-size:13px;margin:4px 0}
      .msg{padding:8px 12px;border-radius:10px;margin:5px 0;max-width:70%;font-size:12px}
      .c{background:#1a5fa8;color:#fff;margin-left:auto;text-align:right}
      .p{background:#f4f7fa;border:1px solid #d0dce8;color:#0d1f35}
      .vip{background:linear-gradient(135deg,#c9952a,#e3b448);color:#fff;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;display:inline-block}
      .foot{margin-top:40px;border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999}
    </style></head><body>`;
    html+=`<h2>🩺 Prontuário — ${cv.nm}${cv.vip?" <span class='vip'>👑 VIP Plano 360°</span>":""}</h2>`;
    if(pat){
      html+=`<h3>Dados Cadastrais</h3>`;
      if(pat.tel)html+=`<p><b>Tel:</b> ${pat.tel}</p>`;
      if(pat.cpf)html+=`<p><b>CPF:</b> ${pat.cpf}</p>`;
      if(pat.nasc)html+=`<p><b>Nasc:</b> ${pat.nasc}</p>`;
      if(pat.email)html+=`<p><b>Email:</b> ${pat.email}</p>`;
      if(pat.origem)html+=`<p><b>Origem:</b> ${pat.origem}</p>`;
      if(pat.diagnostico)html+=`<p><b>Diagnóstico:</b> ${pat.diagnostico}</p>`;
      if(pat.alertas&&pat.alertas.length)html+=`<p><b>⚠️ Alertas:</b> ${pat.alertas.join(" · ")}</p>`;
      if(pat.ats&&pat.ats.length){
        html+=`<h3>Histórico de Atendimentos</h3>`;
        pat.ats.forEach(a=>html+=`<p>• ${a.dt} — ${a.proc} — ${a.mod} ${a.vl?`— R$ ${a.vl}`:""}</p>`);
      }
    }
    html+=`<h3>Histórico de Conversa (${canalLabel})</h3><div>`;
    hist.forEach(m=>html+=`<div class="msg ${m.de}">${m.tx}<br><small>${m.hr||""}</small></div>`);
    html+=`</div><p class='foot'>Dra. Ilza Ezequiel · CRM SP 157236 · LGPD — Dado Sensível de Saúde </p></body></html>`;
    const w=window.open("","_blank");if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  }

  const novas=convs.filter(c=>c.nova).length;
  const vips=convs.filter(c=>c.vip).length;
  const etapaAtual=sel&&sel.etapa?AI_SCRIPT.etapas.find(e=>e.id===sel.etapa):null;

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden",position:"relative"}}>

      {/* POPUP PRIORIDADE — falar com Dra */}
      {showPrioridade&&(
        <div style={{position:"fixed",inset:0,paddingLeft:"var(--sidebar-w,0px)",background:"rgba(13,33,55,.7)",backdropFilter:"blur(6px)",zIndex:999999,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 20px 24px",overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:20,maxWidth:480,width:"100%",overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,.4)"}}>
            <div style={{background:"linear-gradient(135deg,#c0392b,#e74c3c)",padding:"20px 24px",display:"flex",gap:14,alignItems:"center"}}>
              <span style={{fontSize:32}}>🚨</span>
              <div>
                <p style={{color:"#fff",fontWeight:900,fontSize:16,margin:0}}>Atenção — Solicitação Prioritária</p>
                <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0}}>{showPrioridade.canal} · {new Date().toLocaleString("pt-BR")}</p>
              </div>
              {showPrioridade.vip&&<span style={{background:VIP_GRAD,color:"#fff",padding:"4px 12px",borderRadius:99,fontSize:11,fontWeight:800,marginLeft:"auto"}}>{VIP_ICON} VIP</span>}
            </div>
            <div style={{padding:24}}>
              <p style={{color:"#2c4a6e",fontWeight:700,fontSize:14,margin:"0 0 8px"}}>{showPrioridade.pac} quer falar diretamente com a Dra. Ilza</p>
              <div style={{background:"#f4f7fa",borderRadius:10,padding:"12px 16px",marginBottom:16,borderLeft:"4px solid #c0392b"}}>
                <p style={{color:"#0d1f35",fontSize:13,margin:0,lineHeight:1.6}}>"{showPrioridade.msg}"</p>
              </div>
              <p style={{color:"#6b8aad",fontSize:12,margin:"0 0 16px"}}>Este paciente está aguardando resposta direta da Dra. Adicionado à fila de prioridade.</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowPrioridade(null)} style={{flex:1,background:"#f4f7fa",border:"1px solid #d0dce8",color:"#6b8aad",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>✓ Anotado</button>
                <button onClick={()=>{setShowPrioridade(null);auditAdd(usuario.nome,"NOTIF_DRA_ENVIADA",showPrioridade.pac);}} style={{flex:2,background:"linear-gradient(135deg,#c0392b,#e74c3c)",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>🔔 Notificar Dra. Ilza</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPC&&pcCv&&<PreCadPopup cv={pcCv} onClose={()=>setShowPC(false)} onSave={savePc} canal={canalLabel}/>}

      {showScript&&(
        <Modal title={"✨ "+NOME_IA+" — IA + Scripts"} onClose={()=>setShowScript(false)} width={600}>
          <div style={{background:"linear-gradient(135deg,#f3eeff,#eef3ff)",border:"1.5px solid #c4a8f0",borderRadius:14,padding:14,marginBottom:14}}>
            <p style={{color:C.purple,fontWeight:800,fontSize:13,margin:"0 0 4px"}}>{"✨ "+NOME_IA+" — IA Aprendida"}</p>
            <p style={{color:C.txM,fontSize:11,margin:"0 0 10px"}}>A IA analisa o histórico e usa a base de conhecimento clínica para gerar a melhor resposta.</p>
            {aiErr&&<p style={{color:C.red,fontSize:11,fontWeight:600,margin:"0 0 8px"}}>{"⚠️ "+aiErr}</p>}
            <button onClick={gerarIA} disabled={aiLoad||!sel}
              style={{width:"100%",background:aiLoad?"#ccc":"linear-gradient(135deg,#6c3483,#8e44ad)",color:"#fff",border:"none",borderRadius:9,padding:"11px",fontWeight:800,fontSize:13,cursor:aiLoad?"not-allowed":"pointer",fontFamily:"inherit",opacity:(aiLoad||!sel)?0.7:1}}>
              {aiLoad?"⏳ Gerando...":"✨ Gerar Resposta com IA (aprendida)"}
            </button>
          </div>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px"}}>📚 Base de Conhecimento Clínico</p>
          <div style={{maxHeight:180,overflowY:"auto",marginBottom:12}}>
            {IA_KNOWLEDGE_BASE.filter(kb=>kb.gatilho).map(kb=>(
              <div key={kb.id} style={{background:C.card2,border:"1px solid "+C.brd,borderRadius:9,padding:"8px 12px",marginBottom:6,cursor:"pointer"}} onClick={()=>{const n=sel?sel.nm.replace("@","").split(/[\s._]+/)[0]:"";setTxt(kb.resposta.replace(/{nome}/g,n));setShowScript(false);}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                  <span style={{background:kb.tipo==="alerta"?"#c0392b15":kb.tipo==="script"?C.p+"15":C.green+"15",color:kb.tipo==="alerta"?C.red:kb.tipo==="script"?C.p:C.green,border:"1px solid "+(kb.tipo==="alerta"?C.red:kb.tipo==="script"?C.p:C.green)+"30",padding:"1px 7px",borderRadius:99,fontSize:9,fontWeight:700}}>{kb.tipo}</span>
                  <p style={{color:C.tx,fontWeight:700,fontSize:12,margin:0}}>{kb.titulo}</p>
                  <span style={{marginLeft:"auto",color:C.p,fontSize:10,fontWeight:700}}>Usar →</span>
                </div>
                <p style={{color:C.txM,fontSize:10,margin:0,fontStyle:"italic"}}>Gatilho: {kb.gatilho.split("|").slice(0,3).join(", ")}</p>
              </div>
            ))}
          </div>
          <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px"}}>📋 Scripts do Funil</p>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {AI_SCRIPT.etapas.map(etapa=>(
              <div key={etapa.id} style={{background:C.card2,border:"1.5px solid "+C.brd,borderRadius:11,padding:11,marginBottom:7,cursor:"pointer"}} onClick={()=>usarScript(etapa)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <p style={{color:C.purple,fontWeight:700,fontSize:12,margin:0}}>{etapa.titulo}</p>
                  <span style={{background:"#f0e8ff",color:C.purple,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>Usar →</span>
                </div>
                <p style={{color:C.txM,fontSize:10,margin:0,lineHeight:1.5}}>{etapa.mensagem.slice(0,80)}...</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Lista conversas */}
      <div style={{width:290,minWidth:290,borderRight:"1px solid "+C.brd,display:"flex",flexDirection:"column",background:C.card,overflow:"hidden"}}>
        <div style={{background:headerGrad||accentColor,padding:"13px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isWA?8:0}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:18}}>{isIG?"📸":"💬"}</span>
              <p style={{color:"#fff",fontWeight:800,fontSize:14,margin:0}}>{canalLabel}</p>
            </div>
            <div style={{display:"flex",gap:6}}>
              {vips>0&&<span style={{background:"rgba(201,149,42,.3)",color:"#f7d794",border:"1px solid rgba(201,149,42,.5)",borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:800}}>{VIP_ICON} {vips} VIP</span>}
              {novas>0&&<span style={{background:"#fff",color:accentColor,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:800}}>{novas} nova{novas>1?"s":""}</span>}
            </div>
          </div>
          {isWA&&(
            <div style={{display:"flex",gap:4}}>
              {[["msgs","💬 Mensagens"],["lig","📞 Ligações"]].map(([k,l])=>(
                <button key={k} onClick={()=>{setLigTab(k);setSel(null);}} style={{
                  flex:1,padding:"5px 6px",borderRadius:8,border:"none",
                  background:ligTab===k?"rgba(255,255,255,.25)":"rgba(255,255,255,.1)",
                  color:"#fff",fontWeight:ligTab===k?800:500,fontSize:11,cursor:"pointer",fontFamily:"inherit",
                  borderBottom:ligTab===k?"2px solid #fff":"2px solid transparent"
                }}>{l}</button>
              ))}
            </div>
          )}
        </div>
        {/* ── LIGAÇÕES (apenas WhatsApp) ── */}
        {isWA&&ligTab==="lig"&&(
          <div style={{flex:1,overflowY:"auto"}}>
            {ligNota&&(
              <Modal title="📝 Anotação de ligação" onClose={()=>setLigNota(null)} width={400}>
                <textarea value={ligNota.nota||""} onChange={e=>setLigacoes(p=>p.map(l=>l.id===ligNota.id?{...l,nota:e.target.value}:l))} style={{...SI,minHeight:90,resize:"vertical",marginBottom:12}} placeholder="Anotações sobre esta ligação..."/>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn v="g" onClick={()=>setLigNota(null)}>Cancelar</Btn>
                  <Btn v="p" onClick={()=>{setLigNota(null);}}>✅ Salvar</Btn>
                </div>
              </Modal>
            )}
            <div style={{padding:"10px 12px",borderBottom:"1px solid "+C.brd,background:C.card2}}>
              <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 2px"}}>Número que recebeu as ligações</p>
              <p style={{color:C.p,fontWeight:800,fontSize:13,margin:0}}>📱 (13) 97802-8137</p>
            </div>
            <div style={{padding:"6px 10px",background:"rgba(37,211,102,.06)",borderBottom:"1px solid rgba(37,211,102,.15)",display:"flex",gap:12}}>
              {[["Recebidas",ligacoes.filter(l=>l.tipo==="recebida").length,"#25d366"],["Perdidas",ligacoes.filter(l=>l.tipo==="perdida").length,C.red]].map(([lb,v,c])=>(
                <div key={lb} style={{flex:1,textAlign:"center",padding:"6px 0"}}>
                  <p style={{color:c,fontWeight:900,fontSize:16,margin:0}}>{v}</p>
                  <p style={{color:C.txM,fontSize:9,textTransform:"uppercase",margin:"2px 0 0"}}>{lb}</p>
                </div>
              ))}
            </div>
            {ligacoes.map(lig=>(
              <div key={lig.id} style={{padding:"11px 14px",borderBottom:"1px solid "+C.brd,background:lig.tipo==="perdida"?"rgba(192,57,43,.03)":"transparent"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:lig.tipo==="perdida"?"rgba(192,57,43,.12)":"rgba(37,211,102,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                    {lig.tipo==="perdida"?"📵":"📞"}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <p style={{color:lig.tipo==="perdida"?C.red:C.tx,fontWeight:700,fontSize:12,margin:0}}>{lig.nm}</p>
                      <span style={{color:C.txM,fontSize:10}}>{lig.dt} · {lig.hr}</span>
                    </div>
                    <p style={{color:C.txM,fontSize:11,margin:"1px 0 2px"}}>{lig.tel}</p>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{background:lig.tipo==="perdida"?"rgba(192,57,43,.1)":"rgba(37,211,102,.1)",color:lig.tipo==="perdida"?C.red:"#1a9e52",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,border:"1px solid "+(lig.tipo==="perdida"?"rgba(192,57,43,.2)":"rgba(37,211,102,.2)")}}>
                        {lig.tipo==="perdida"?"📵 Perdida":"📞 Recebida"}{lig.dur&&lig.dur!=="0s"?" · "+lig.dur:""}
                      </span>
                      <span style={{color:C.txM,fontSize:9}}>📱 {lig.numeroDestino}</span>
                    </div>
                    {lig.nota&&<p style={{color:C.p,fontSize:10,margin:"4px 0 0",fontStyle:"italic"}}>📝 {lig.nota}</p>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {lig.tel&&lig.tel!=="Desconhecido"&&<a href={"https://wa.me/55"+(lig.tel||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:7,padding:"5px 8px",fontSize:10,fontWeight:700,textDecoration:"none",textAlign:"center"}}>💬</a>}
                    <button onClick={()=>setLigNota({...lig})} style={{background:C.p+"12",border:"1px solid "+C.p+"25",color:C.p,borderRadius:7,padding:"5px 8px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📝</button>
                  </div>
                </div>
              </div>
            ))}
            {ligacoes.length===0&&<p style={{textAlign:"center",color:C.txM,padding:32,fontSize:12}}>Sem ligações registradas</p>}
          </div>
        )}

        {/* ── MENSAGENS ── */}
        {(!isWA||ligTab==="msgs")&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{flex:1,overflowY:"auto"}}>
          {/* VIPs primeiro */}
          {convs.filter(c=>c.vip).length>0&&(
            <div style={{padding:"6px 10px 2px",background:"rgba(201,149,42,.06)",borderBottom:"1px solid rgba(201,149,42,.2)"}}>
              <p style={{color:C.gold,fontSize:9,fontWeight:800,textTransform:"uppercase",margin:0}}>{VIP_ICON} Pacientes VIP — Plano 360°</p>
            </div>
          )}
          {[...convs.filter(c=>c.vip),...convs.filter(c=>!c.vip)].map(c=>{
            const tg=tagById(c.tag);
            const isVip=c.vip;
            return(
              <div key={c.id} onClick={()=>{setSel(c);setConvs(p=>p.map(x=>x.id===c.id?{...x,nova:false}:x));setSugestaoIA(null);}} style={{padding:"11px 14px",cursor:"pointer",borderBottom:"1px solid "+C.brd,background:sel&&sel.id===c.id?accentColor+"10":isVip?"rgba(201,149,42,.04)":"transparent",borderLeft:"3px solid "+(sel&&sel.id===c.id?accentColor:isVip?"#c9952a":tg?tg.color:"transparent"),transition:"all .12s"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <Av s={initials(c.nm)} size={38} color={isVip?C.gold:c.nova?C.amber:accentColor} gradient={isIG&&!c.nova&&!isVip?IG_GRAD:undefined}/>
                    {c.nova&&<div style={{position:"absolute",top:-3,right:-3,background:C.amber,color:"#fff",width:16,height:16,borderRadius:99,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>!</div>}
                    {isVip&&<div style={{position:"absolute",bottom:-3,right:-3,background:VIP_GRAD,color:"#fff",width:16,height:16,borderRadius:99,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>👑</div>}
                  </div>
                  <div style={{flex:1,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:1}}>
                      <p style={{color:C.tx,fontWeight:isVip||c.nova?700:500,fontSize:12,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.nm}</p>
                      {isVip&&<span style={{fontSize:10,flexShrink:0}}>{VIP_ICON}</span>}
                    </div>
                    <p style={{color:C.txM,fontSize:10,margin:"0 0 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.msgs&&c.msgs.length?c.msgs[c.msgs.length-1].tx.slice(0,45):""}</p>
                    <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                      {tg&&<TagBadge tagId={c.tag} sm/>}
                      {isVip&&<span style={{background:"rgba(201,149,42,.15)",color:C.gold,border:"1px solid rgba(201,149,42,.3)",fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:99}}>Plano 360°</span>}
                      {c.nova&&canPC&&<button onClick={e=>{e.stopPropagation();setPcCv(c);setShowPC(true);}} style={{background:C.p+"15",border:"1px solid "+C.p+"30",color:C.p,borderRadius:7,padding:"3px 8px",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🆕 Pre-Cad.</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {saved.length>0&&(
          <div style={{borderTop:"1px solid "+C.brd,padding:"10px 14px",background:C.purple+"08",flexShrink:0}}>
            <p style={{color:C.purple,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px"}}>🆕 Pré-Cadastros ({saved.length})</p>
            {saved.slice(0,2).map((pc,i)=>(
              <div key={i} style={{background:C.card2,borderRadius:8,padding:"8px 10px",marginBottom:5,border:"1px solid "+C.brd}}>
                <p style={{color:C.tx,fontWeight:700,fontSize:12,margin:"0 0 1px"}}>{pc.nome}</p>
                <p style={{color:C.green,fontSize:10,margin:0}}>✅ Prontuário criado</p>
              </div>
            ))}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Painel conversa */}
      {sel?(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Header chat */}
          <div style={{padding:"10px 16px",borderBottom:"1px solid "+C.brd,display:"flex",justifyContent:"space-between",alignItems:"center",background:sel.vip?"rgba(201,149,42,.06)":C.card,flexShrink:0,borderTop:sel.vip?"3px solid #c9952a":"none"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <Av s={initials(sel.nm)} size={36} color={sel.vip?C.gold:accentColor} gradient={isIG&&!sel.vip?IG_GRAD:undefined}/>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <p style={{color:C.tx,fontWeight:700,fontSize:13,margin:0}}>{sel.nm}</p>
                  {sel.vip&&<span style={{background:VIP_GRAD,color:"#fff",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:800}}>{VIP_ICON} Plano 360°</span>}
                </div>
                <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
                  {sel.tel&&<p style={{color:C.txM,fontSize:10,margin:0}}>{maskTel(sel.tel,["admin","medico"].includes(usuario.role))}</p>}
                  {sel.tag&&<TagBadge tagId={sel.tag} sm/>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <TagSelector current={sel.tag} onChange={tagId=>setTag(sel.id,tagId)}/>
              <button onClick={()=>setShowScript(true)} style={{background:C.purple+"15",border:"1px solid "+C.purple+"30",color:C.purple,borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✨ IA</button>
              <button onClick={()=>imprimirProntuarioPaciente(sel)} title="Imprimir/PDF prontuário" style={{background:"#1f293715",border:"1px solid #37415130",color:"#374151",borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🖨️ PDF</button>
              {canPC&&<Btn v="pur" sm onClick={()=>{setPcCv(sel);setShowPC(true);}}>🆕 Prontuário</Btn>}
            </div>
          </div>

          {/* Sugestão IA automática */}
          {sugestaoIA&&(
            <div style={{padding:"8px 16px",background:sugestaoIA.tipo==="alerta"?"rgba(192,57,43,.06)":"rgba(108,52,131,.06)",borderBottom:"1px solid "+(sugestaoIA.tipo==="alerta"?"rgba(192,57,43,.2)":"rgba(108,52,131,.2)"),flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1}}>
                  <p style={{color:sugestaoIA.tipo==="alerta"?C.red:C.purple,fontSize:11,fontWeight:800,margin:"0 0 1px"}}>
                    {sugestaoIA.tipo==="alerta"?"⚠️ Alerta clínico detectado":"✨ IA sugere: "+sugestaoIA.titulo}
                  </p>
                  <p style={{color:C.txS,fontSize:11,margin:0,lineHeight:1.4}}>{sugestaoIA.respostaFinal.slice(0,80)}...</p>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  <button onClick={usarSugestaoIA} style={{background:sugestaoIA.tipo==="alerta"?C.red:C.purple,color:"#fff",border:"none",borderRadius:7,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Usar</button>
                  <button onClick={()=>setSugestaoIA(null)} style={{background:"transparent",border:"1px solid "+C.brd,color:C.txM,borderRadius:7,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {etapaAtual&&!sugestaoIA&&(
            <div style={{padding:"7px 16px",background:C.purple+"08",borderBottom:"1px solid "+C.purple+"20",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <p style={{color:C.purple,fontSize:11,fontWeight:700,margin:0}}>✨ Sugestão: {etapaAtual.titulo}</p>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button onClick={()=>{const n=sel.nm.replace("@","").split(/[\s._]+/)[0]||"";setTxt(etapaAtual.mensagem.replace(/{nome}/g,n));}} style={{background:C.purple,color:"#fff",border:"none",borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Script</button>
                <button onClick={gerarIA} disabled={aiLoad} style={{background:"linear-gradient(135deg,#6c3483,#8e44ad)",color:"#fff",border:"none",borderRadius:6,padding:"3px 9px",fontSize:10,fontWeight:700,cursor:aiLoad?"not-allowed":"pointer",fontFamily:"inherit",opacity:aiLoad?0.6:1}}>{aiLoad?"⏳":"✨ IA"}</button>
              </div>
            </div>
          )}

          {/* Mensagens */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10,background:isIG?"rgba(225,48,108,.02)":C.bg}}>
            {sel.vip&&(
              <div style={{background:"rgba(201,149,42,.08)",border:"1.5px solid rgba(201,149,42,.3)",borderRadius:12,padding:"10px 16px",marginBottom:4,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:20}}>{VIP_ICON}</span>
                <div>
                  <p style={{color:C.gold,fontWeight:800,fontSize:12,margin:0}}>Paciente VIP — Plano Intestino 360°</p>
                  <p style={{color:"#7a5a10",fontSize:11,margin:0}}>Prioridade máxima · Resposta em 1 dia útil</p>
                </div>
              </div>
            )}
            {(isIG||isTK)&&(
              <div style={{background:isIG?C.igBg:"rgba(238,29,82,.06)",border:"1px solid "+(isIG?C.ig+"30":"rgba(238,29,82,.25)"),borderRadius:10,padding:"10px 14px",marginBottom:4}}>
                <p style={{color:isIG?C.ig:"#EE1D52",fontSize:11,margin:0,fontWeight:600}}>{isIG?"📸 Modo Simulação — DMs reais requerem Meta Graph API.":"🎵 Modo Simulação — DMs TikTok requerem TikTok for Business API."}</p>
              </div>
            )}
            {sel.msgs&&sel.msgs.map((msg,i)=>(
              <div key={i} style={{display:"flex",justifyContent:msg.de==="c"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"72%",padding:"9px 14px",borderRadius:msg.de==="c"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:msg.de==="c"?(isIG?IG_GRAD:isTK?"linear-gradient(135deg,#010101,#EE1D52)":"linear-gradient(135deg,"+C.p+","+C.pL+")"):"#fff",border:msg.de==="c"?"none":"1px solid "+C.brd,color:msg.de==="c"?"#fff":C.tx,fontSize:13,lineHeight:1.5}}>
                  {msg.type==="img"?(
                    <div>
                      <div style={{background:"rgba(0,0,0,.1)",borderRadius:8,padding:"10px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:22}}>🖼️</span>
                        <div>
                          <p style={{color:msg.de==="c"?"rgba(255,255,255,.9)":"#555",fontSize:12,fontWeight:600,margin:0}}>Imagem anexada</p>
                          <p style={{color:msg.de==="c"?"rgba(255,255,255,.6)":C.txM,fontSize:10,margin:0}}>{msg.tx||"Foto"}</p>
                        </div>
                      </div>
                    </div>
                  ):msg.type==="video"?(
                    <div style={{background:"rgba(0,0,0,.1)",borderRadius:8,padding:"10px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:22}}>🎬</span>
                      <div>
                        <p style={{color:msg.de==="c"?"rgba(255,255,255,.9)":"#555",fontSize:12,fontWeight:600,margin:0}}>Vídeo</p>
                        <p style={{color:msg.de==="c"?"rgba(255,255,255,.6)":C.txM,fontSize:10,margin:0}}>{msg.tx||"Clique para ver"}</p>
                      </div>
                    </div>
                  ):msg.type==="audio"?(
                    <div style={{background:"rgba(0,0,0,.1)",borderRadius:8,padding:"8px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>🎵</span>
                      <div style={{flex:1,height:3,background:"rgba(255,255,255,.3)",borderRadius:99}}/>
                      <span style={{color:msg.de==="c"?"rgba(255,255,255,.6)":C.txM,fontSize:10}}>0:00</span>
                    </div>
                  ):(
                    <span>{msg.tx}</span>
                  )}
                  <div style={{fontSize:10,marginTop:4,textAlign:"right",color:msg.de==="c"?"rgba(255,255,255,.6)":C.txM}}>{msg.hr}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input envio */}
          <div style={{padding:"8px 14px 12px",borderTop:"1px solid "+C.brd,background:C.card,flexShrink:0}}>
            {aiErr&&<p style={{color:C.red,fontSize:10,fontWeight:600,margin:"0 0 5px"}}>⚠️ {aiErr}</p>}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>setShowScript(true)} title={"IA + Scripts"} style={{background:C.purple+"15",border:"1px solid "+C.purple+"30",color:C.purple,borderRadius:9,padding:"9px 11px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13,flexShrink:0}}>🤖</button>
              <button onClick={gerarIA} disabled={aiLoad||!sel} title="Gerar com IA aprendida" style={{background:aiLoad?"#e5e7eb":"linear-gradient(135deg,#6c3483,#8e44ad)",border:"none",color:"#fff",borderRadius:9,padding:"9px 11px",cursor:aiLoad?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,fontSize:11,flexShrink:0,opacity:(aiLoad||!sel)?0.6:1}}>
                {aiLoad?"⏳":"✨ IA"}
              </button>
              <label title="Anexar imagem/vídeo" style={{background:C.card2,border:"1px solid "+C.brd,borderRadius:9,padding:"9px 11px",cursor:"pointer",fontSize:15,flexShrink:0}}>
                <input type="file" accept="image/*,video/*" onChange={e=>{if(e.target.files[0]&&sel){const f=e.target.files[0];const hr=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});const tp=f.type.startsWith("video")?"video":"img";setConvs(c=>c.map(cv=>cv.id!==sel.id?cv:{...cv,msgs:[...cv.msgs,{de:"c",tx:f.name,hr,type:tp}]}));setSel(s=>({...s,msgs:[...s.msgs,{de:"c",tx:f.name,hr,type:tp}]}));}}} style={{display:"none"}}/>
                📎
              </label>
              <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder={aiLoad?"Gerando...":(isIG?"Instagram...":(isTK?"TikTok DM...":"Digite a mensagem..."))} style={{flex:1,...SI}}/>
              <button onClick={sendMsg} style={{background:headerGrad||accentColor,color:"#fff",border:"none",borderRadius:9,padding:"9px 16px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit",flexShrink:0}}>Enviar ↑</button>
            </div>
          </div>
        </div>
      ):(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
          <span style={{fontSize:48,opacity:.1}}>{isIG?"📸":"💬"}</span>
          <p style={{color:C.txM,fontSize:13}}>Selecione uma conversa</p>
          <p style={{color:C.txM,fontSize:11}}>✨ IA Isabela aprendida · {VIP_ICON} VIP detectado · 🚨 Prioridade automática</p>
        </div>
      )}
    </div>
  );
}

function PageTikTok({usuario,patsState}){
  const TK_GRAD_LOCAL="linear-gradient(135deg,#010101 0%,#69C9D0 50%,#EE1D52 100%)";
  return <PageInbox usuario={usuario} canal="tiktok" baseData={TK_BASE} accentColor="#EE1D52" headerGrad={TK_GRAD_LOCAL} canalLabel="TikTok" patsState={patsState}/>;
}
function PageWhatsApp({usuario,patsState}){return <PageInbox usuario={usuario} canal="whatsapp" baseData={WA_BASE} accentColor="#25d366" headerGrad="linear-gradient(135deg,#128c7e,#25d366)" canalLabel="WhatsApp" patsState={patsState}/>;}
function PageInstagram({usuario,patsState}){return <PageInbox usuario={usuario} canal="instagram" baseData={IG_BASE} accentColor={C.ig} headerGrad={IG_GRAD} canalLabel="Instagram" patsState={patsState}/>;}

/* ════════════════════════════════════════════════════════════════
   AGENDA
════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   CORES DO CALENDÁRIO
════════════════════════════════════════════════════════════════ */
const CAL_CORES = {
  "Consulta Gastroenterologia": "#1e8449",
  "Consulta Particular":        "#1e8449",
  "Retorno":                    "#148f77",
  "Cortesia":                   "#148f77",
  "Consulta Online (Tele)":     "#1a5fa8",
  "Telemedicina":               "#1a5fa8",
  "Plano INTESTINO 360":        "#6c3483",
  "Sinal de Confirmação":       "#6c3483",
  "Teste Resp. SIBO":           "#d4830a",
  "Teste Resp. H. Pylori":      "#d4830a",
  "Teste Resp. Lactose":        "#d4830a",
  "Citobê Dexa — 1 aplic.":     "#e67e22",
  "Citobê Dexa — 3 aplic.":     "#e67e22",
  "Consulta Convênio Unimed":   "#566573",
  "Consulta Convênio Bradesco":  "#566573",
  "Bloqueio":                   "#c0392b",
};
const CAL_LEGENDA = [
  {label:"Consulta Presencial", cor:"#1e8449"},
  {label:"Telemedicina",        cor:"#1a5fa8"},
  {label:"Retorno / Cortesia",  cor:"#148f77"},
  {label:"Plano 360",           cor:"#6c3483"},
  {label:"Teste Respiratório",  cor:"#d4830a"},
  {label:"Injetável",           cor:"#e67e22"},
  {label:"Convênio",            cor:"#566573"},
  {label:"Bloqueio Médica",     cor:"#c0392b"},
];

function PopupNovaConsulta({ onClose, onSave }) {
  const [form, setForm] = useState({
    pac:"", dt:"", hr:"", tipo:"Presencial",
    proc:"Consulta Gastroenterologia", st:"Aguardando", obs:""
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <Modal title="Agendar consulta" onClose={onClose} width={520}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <div style={{ gridColumn:"1/-1" }}>
          <Fld label="Paciente">
            <input style={inp} value={form.pac} placeholder="Nome do paciente"
              onChange={e=>f("pac",e.target.value)} />
          </Fld>
        </div>
        <Fld label="Data">
          <input style={inp} type="date" value={form.dt} onChange={e=>f("dt",e.target.value)} />
        </Fld>
        <Fld label="Horário">
          <input style={inp} type="time" value={form.hr} onChange={e=>f("hr",e.target.value)} />
        </Fld>
        <Fld label="Modalidade">
          <div style={{ display:"flex", gap:8 }}>
            {["Presencial","Teleconsulta"].map(t => (
              <button key={t} onClick={()=>f("tipo",t)}
                style={{ flex:1, padding:"10px 8px", borderRadius:10,
                  border:`1.5px solid ${form.tipo===t?T.b:T.br}`,
                  background:form.tipo===t?T.bL:T.sur, color:form.tipo===t?T.b:T.txM,
                  fontWeight:form.tipo===t?700:400, fontSize:12.5, cursor:"pointer",
                  fontFamily:"inherit", display:"flex", alignItems:"center",
                  justifyContent:"center", gap:6 }}>
                <Ic n={t==="Teleconsulta"?"video":"users"} sz={14} c={form.tipo===t?T.b:T.txM} />
                {t}
              </button>
            ))}
          </div>
        </Fld>
        <Fld label="Procedimento">
          <select style={inp} value={form.proc} onChange={e=>f("proc",e.target.value)}>
            {["Consulta Gastroenterologia","1ª Consulta","Retorno",
              "Resultado de Exame","Acompanhamento"].map(o=>(
              <option key={o}>{o}</option>
            ))}
          </select>
        </Fld>
        <Fld label="Status">
          <select style={inp} value={form.st} onChange={e=>f("st",e.target.value)}>
            <option>Aguardando</option><option>Confirmado</option><option>Cancelado</option>
          </select>
        </Fld>
        <div style={{ gridColumn:"1/-1" }}>
          <Fld label="Observações">
            <textarea style={{ ...inp, resize:"vertical", minHeight:60, lineHeight:1.6 }}
              value={form.obs} onChange={e=>f("obs",e.target.value)} placeholder="Notas adicionais..." />
          </Fld>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10,
        paddingTop:16, borderTop:`1px solid ${T.br}` }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{
          if(!form.pac.trim()||!form.dt||!form.hr){alert("Preencha paciente, data e horário");return;}
          const nova = {...form, id:"c"+Date.now(), mod: form.tipo};
          onSave(nova);
          // Email automático via EmailJS
          const link_c = nova.tipo==="Teleconsulta"
            ? `https://meet.jit.si/DrIlzaEzequiel-${nova.pac.replace(/\s+/g,"-").toLowerCase()}-${nova.dt}`
            : "";
          EJS.confirmarConsulta({...nova, link:link_c});
          onClose();
        }} icon="cal">Confirmar agendamento</Btn>
      </div>
    </Modal>
  );
}

// ─── PAGE: CONSULTAS — SEM avatar na timeline ─────────────────────────────────

function PageConsultas({ usuario }) {
  const [consultas, setConsultas] = useFirebaseData("crm_data/crm_consultas_v26", "crm_consultas_v26", []);
  // Escuta teleconsultas adicionadas pela aba Telemedicina em tempo real
  useEffect(()=>{
    const handler = e => {
      setConsultas(prev => {
        if(prev.find(c=>c.id===e.detail.id)) return prev;
        return [...prev, e.detail].sort((a,b)=>a.dt>b.dt?1:-1);
      });
    };
    window.addEventListener("crm_consulta_nova", handler);
    return () => window.removeEventListener("crm_consulta_nova", handler);
  }, []);
  const [showNew, setShowNew] = useState(false);
  const [filtro, setFiltro] = useState("Todos");
  const [q, setQ] = useState("");
  const filtros = ["Todos","Confirmado","Aguardando","Cancelado","Presencial","Teleconsulta"];
  const filtered = consultas.filter(c => {
    const matchQ = c.pac.toLowerCase().includes(q.toLowerCase()) ||
                   c.proc.toLowerCase().includes(q.toLowerCase());
    const matchF = filtro==="Todos" || c.st===filtro || c.tipo===filtro;
    return matchQ && matchF;
  });
  const byDate = {};
  filtered.forEach(c => { (byDate[c.dt]=byDate[c.dt]||[]).push(c); });
  const dates = Object.keys(byDate).sort();

  return (
    <div className="page" style={{ padding:"24px 28px 48px", display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }}>
            <Ic n="search" sz={15} c={T.txS} />
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Buscar paciente ou procedimento..."
            style={{ ...inp, paddingLeft:38, fontSize:13 }} />
        </div>
        <Btn onClick={()=>setShowNew(true)} icon="plus">Nova consulta</Btn>
      </div>

      {/* Filter pills */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {filtros.map(f => (
          <button key={f} onClick={()=>setFiltro(f)}
            style={{ padding:"6px 16px", borderRadius:99,
              border:`1.5px solid ${filtro===f?T.b:T.br}`,
              background:filtro===f?T.b:T.sur,
              color:filtro===f?"#fff":T.txM, fontWeight:filtro===f?600:400,
              fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all .16s",
              boxShadow:filtro===f?"0 4px 12px rgba(168,114,42,.32)":"none" }}>
            {f}
          </button>
        ))}
      </div>

      {dates.length === 0 && (
        <div style={{ padding:"52px 20px", textAlign:"center", color:T.txS, fontSize:14,
          background:T.sur, borderRadius:16, border:`1px solid ${T.br}` }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
          Nenhuma consulta encontrada
        </div>
      )}

      {dates.map(dt => (
        <div key={dt}>
          {/* v29: badge de data SEM avatar — ícone de calendário */}
          <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:10 }}>
            <div style={{ width:44, height:44, borderRadius:13, flexShrink:0,
              background:"linear-gradient(135deg,#A8722A,#7A5018)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 14px rgba(168,114,42,.36)" }}>
              <Ic n="cal" sz={19} c="#fff" />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.tx }}>
                {new Date(dt+"T12:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </div>
              <div style={{ fontSize:11, color:T.txS, marginTop:1 }}>
                {byDate[dt].length} consulta{byDate[dt].length!==1?"s":""}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginLeft:22,
            borderLeft:`2px solid ${T.br}`, paddingLeft:26, marginBottom:24 }}>
            {byDate[dt].map(c => (
              <ConsultaRow key={c.id} c={c} usuario={usuario}
                onChangeStatus={ns=>setConsultas(p=>p.map(x=>x.id===c.id?{...x,st:ns}:x))}
                onDelete={()=>setConsultas(p=>p.filter(x=>x.id!==c.id))} />
            ))}
          </div>
        </div>
      ))}

      {showNew && (
        <PopupNovaConsulta onClose={()=>setShowNew(false)}
          onSave={novo=>setConsultas(p=>[...p,novo].sort((a,b)=>a.dt>b.dt?1:-1))} />
      )}
    </div>
  );
}

// ─── PAGE: FINANCEIRO ────────────────────────────────────────────────────────


function corEvento(proc, mod, st) {
  if(st==="Bloqueado"||proc==="Bloqueio") return "#c0392b";
  if(mod==="Telemedicina") return "#1a5fa8";
  return CAL_CORES[proc] || "#2e86c1";
}
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_PT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function PageAgenda({usuario}){
  const [agenda, setAgenda] = useFirebaseData("crm_data/crm_agenda_v26", "crm_agenda_v25", []);
  const [showNew,setShowNew]=useState(false);
  const [showBloq,setShowBloq]=useState(false);
  const [selDia,setSelDia]=useState(null);
  const [view,setView]=useState("mes");
  const [mesRef,setMesRef]=useState(function(){ var d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); });
  const [form,setForm]=useState({pac:"",tel:"",dt:"",hr:"",proc:"Consulta Gastroenterologia",mod:"Presencial",st:"Aguardando",obs:""});
  const [confirmDelAg,setConfirmDelAg]=useState(null);
  const [formB,setFormB]=useState({dt:"",dtFim:"",obs:""});
  const canP=["admin","medico","recepcao"].includes(usuario.role);
  const today=new Date().toISOString().split("T")[0];

  var ano=mesRef.getFullYear();
  var mes=mesRef.getMonth();
  var primDia=new Date(ano,mes,1).getDay();
  var ultDia=new Date(ano,mes+1,0).getDate();
  var cells=[];
  for(var i=0;i<primDia;i++) cells.push(null);
  for(var d=1;d<=ultDia;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);

  function dtStr(d){ return ano+"-"+(mes+1<10?"0":"")+(mes+1)+"-"+(d<10?"0":"")+d; }
  function evsDia(d){ if(!d) return []; var s=dtStr(d); return agenda.filter(function(a){return a.dt===s;}).sort(function(a,b){return a.hr>b.hr?1:-1;}); }

  function addAg(){
    if(!form.pac||!form.dt||!form.hr) return;
    setAgenda(function(p){return[...p,{...form,id:"ag_"+Date.now()}];});
    setShowNew(false);
    setForm({pac:"",tel:"",dt:"",hr:"",proc:"Consulta Gastroenterologia",mod:"Presencial",st:"Aguardando",obs:""});
  }
  function addBloq(){
    if(!formB.dt) return;
    var dt=formB.dt;
    var dtFim=formB.dtFim||formB.dt;
    var d=new Date(dt+"T12:00:00");
    var df=new Date(dtFim+"T12:00:00");
    var newItems=[];
    while(d<=df){
      newItems.push({pac:"— BLOQUEIO —",tel:"",dt:d.toISOString().split("T")[0],hr:"00:00",proc:"Bloqueio",mod:"Presencial",st:"Bloqueado",obs:formB.obs,id:"bl_"+Date.now()+Math.random()});
      d.setDate(d.getDate()+1);
    }
    setAgenda(function(p){return[...p,...newItems];});
    setShowBloq(false);
    setFormB({dt:"",dtFim:"",obs:""});
  }
  function delAg(id){ setAgenda(function(p){return p.filter(function(a){return a.id!==id;}); }); setConfirmDelAg(null); }

  var diasSemana=view==="semana"?[0,1,2,3,4,5,6]:null;
  var semRef=null;
  if(view==="semana"){
    var td=new Date();
    semRef=new Date(td.getFullYear(),td.getMonth(),td.getDate()-td.getDay());
  }

  var agMes=agenda.filter(function(a){
    return a.dt&&a.dt.slice(0,7)===(ano+"-"+(mes+1<10?"0":"")+(mes+1));
  });

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",background:C.bg}}>

      {/* Popup confirmação exclusão */}
      {confirmDelAg&&(
        <ConfirmPopup
          danger
          title="Excluir consulta?"
          msg={`Deseja realmente excluir o agendamento de "${confirmDelAg.pac}" em ${confirmDelAg.dt.slice(8)}/${confirmDelAg.dt.slice(5,7)}/${confirmDelAg.dt.slice(0,4)} às ${confirmDelAg.hr||"—"}?`}
          yesLabel="🗑️ Sim, excluir"
          noLabel="Cancelar"
          onYes={()=>delAg(confirmDelAg.id)}
          onNo={()=>setConfirmDelAg(null)}
        />
      )}

      {showNew&&(
        <Modal title="📅 Novo Agendamento" onClose={function(){setShowNew(false);}} width={520}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={SL}>Paciente *</label><input value={form.pac} onChange={function(e){setForm(function(p){return{...p,pac:e.target.value};});}} placeholder="Nome" style={SI}/></div>
              <div><label style={SL}>Telefone</label><input value={form.tel} onChange={function(e){setForm(function(p){return{...p,tel:e.target.value};});}} placeholder="(13) 9..." style={SI}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={SL}>Data *</label><input type="date" value={form.dt} onChange={function(e){setForm(function(p){return{...p,dt:e.target.value};});}} style={SI}/></div>
              <div><label style={SL}>Horário *</label><input type="time" value={form.hr} onChange={function(e){setForm(function(p){return{...p,hr:e.target.value};});}} style={SI}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
              <div><label style={SL}>Procedimento</label><select value={form.proc} onChange={function(e){setForm(function(p){return{...p,proc:e.target.value};});}} style={SI}>{EXAM_CAT.flatMap(function(g){return g.itens;}).map(function(it){return(<option key={it.n} value={it.n}>{it.n}</option>);})}</select></div>
              <div><label style={SL}>Modalidade</label><select value={form.mod} onChange={function(e){setForm(function(p){return{...p,mod:e.target.value};});}} style={SI}><option>Presencial</option><option>Telemedicina</option></select></div>
            </div>
            <div><label style={SL}>Status</label><select value={form.st} onChange={function(e){setForm(function(p){return{...p,st:e.target.value};});}} style={SI}><option>Aguardando</option><option>Confirmado</option><option>Lista de Espera</option><option>Cancelado</option></select></div>
            <div><label style={SL}>Obs.</label><input value={form.obs} onChange={function(e){setForm(function(p){return{...p,obs:e.target.value};});}} style={SI}/></div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="g" onClick={function(){setShowNew(false);}}>Cancelar</Btn><Btn v="p" onClick={addAg}>{"✅ Agendar"}</Btn></div>
          </div>
        </Modal>
      )}

      {showBloq&&(
        <Modal title="🔴 Bloquear Horário" onClose={function(){setShowBloq(false);}} width={420}>
          <div style={{background:"rgba(192,57,43,.06)",border:"1.5px solid rgba(192,57,43,.3)",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
            <p style={{color:C.red,fontSize:12,fontWeight:600,margin:0}}>{"Dias bloqueados aparecem em vermelho no calendário e impedem agendamentos."}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={SL}>{"Data Início *"}</label><input type="date" value={formB.dt} onChange={function(e){setFormB(function(p){return{...p,dt:e.target.value};});}} style={SI}/></div>
              <div><label style={SL}>{"Data Fim (opcional)"}</label><input type="date" value={formB.dtFim} onChange={function(e){setFormB(function(p){return{...p,dtFim:e.target.value};});}} style={SI}/></div>
            </div>
            <div><label style={SL}>Motivo</label><input value={formB.obs} onChange={function(e){setFormB(function(p){return{...p,obs:e.target.value};});}} placeholder="Ex: Congresso, férias..." style={SI}/></div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="g" onClick={function(){setShowBloq(false);}}>Cancelar</Btn><Btn v="red" onClick={addBloq}>{"🔴 Bloquear"}</Btn></div>
          </div>
        </Modal>
      )}

      {selDia&&(
        <Modal title={"📅 "+selDia.slice(8)+"/"+selDia.slice(5,7)+"/"+selDia.slice(0,4)} onClose={function(){setSelDia(null);}} width={480}>
          <div style={{maxHeight:400,overflowY:"auto"}}>
            {agenda.filter(function(a){return a.dt===selDia;}).length===0&&(
              <p style={{color:C.txM,textAlign:"center",padding:24,fontSize:13}}>{"Nenhum evento neste dia"}</p>
            )}
            {agenda.filter(function(a){return a.dt===selDia;}).sort(function(a,b){return a.hr>b.hr?1:-1;}).map(function(ag){
              var cor=corEvento(ag.proc,ag.mod,ag.st);
              return (
                <div key={ag.id} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"11px 13px",borderRadius:12,marginBottom:8,border:"1.5px solid "+cor+"40",background:cor+"08"}}>
                  <div style={{width:3,background:cor,borderRadius:99,alignSelf:"stretch",minHeight:36,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                      <p style={{color:C.tx,fontWeight:700,fontSize:13,margin:0}}>{ag.pac}</p>
                      <span style={{color:cor,fontSize:10,fontWeight:700}}>{ag.hr}</span>
                    </div>
                    <p style={{color:cor,fontSize:11,margin:"2px 0",fontWeight:600}}>{ag.proc}</p>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{background:cor+"18",color:cor,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>{ag.mod}</span>
                      <span style={{background:ag.st==="Confirmado"?C.green+"15":ag.st==="Bloqueado"?C.red+"15":C.amber+"15",color:ag.st==="Confirmado"?C.green:ag.st==="Bloqueado"?C.red:C.amber,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>{ag.st}</span>
                      {ag.obs&&<span style={{color:C.txM,fontSize:10,fontStyle:"italic"}}>{ag.obs}</span>}
                    </div>
                  </div>
                  {canP&&ag.st!=="Bloqueado"&&ag.tel&&<a href={"https://wa.me/55"+ag.tel.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:700,textDecoration:"none",flexShrink:0}}>{"📱"}</a>}
                  {canP&&<button onClick={function(){setConfirmDelAg(ag);}} title="Excluir consulta" style={{background:"rgba(192,57,43,.08)",border:"1px solid rgba(192,57,43,.3)",color:C.red,borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{"🗑️"}</button>}
                </div>
              );
            })}
          </div>
          {canP&&(
            <div style={{display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:"1px solid "+C.brd}}>
              <Btn v="p" full onClick={function(){setSelDia(null);setForm(function(f){return{...f,dt:selDia};});setShowNew(true);}}>{"+ Agendar neste dia"}</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Header */}
      <div style={{padding:"14px 20px",borderBottom:"1px solid "+C.brd,background:C.card,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h2 style={{color:C.tx,fontSize:18,fontWeight:800,margin:0}}>{"📅 Agenda"}</h2>
          <div style={{display:"flex",gap:8}}>
            <BtnExportar
              onCSV={()=>exportarCSV([
                {label:"Paciente",    key:"pac"},
                {label:"Data",        key:"dt"},
                {label:"Horário",     key:"hr"},
                {label:"Procedimento",key:"proc"},
                {label:"Modalidade",  key:"mod"},
                {label:"Status",      key:"st"},
                {label:"Convênio",    key:"conv"},
                {label:"Observações", key:"obs"},
              ], agenda, "agenda_crm")}
              onPDF={()=>exportarPDF("Agenda", `${agenda.length} consultas cadastradas`, [
                {label:"Paciente",    key:"pac"},
                {label:"Data",        key:"dt"},
                {label:"Horário",     key:"hr"},
                {label:"Procedimento",key:"proc"},
                {label:"Modalidade",  key:"mod"},
                {label:"Status",      key:"st"},
              ], agenda)}
              onImportCSV={(header, rows)=>{
                const pacIdx=header.findIndex(h=>h.toLowerCase().includes("paciente"));
                const dtIdx=header.findIndex(h=>h.toLowerCase().includes("data"));
                if(pacIdx<0){alert("Coluna 'Paciente' não encontrada no CSV.");return;}
                const novos=rows.filter(r=>r[pacIdx]&&r[pacIdx].trim()).map(r=>({
                  id:"ag"+Date.now()+Math.random().toString(36).slice(2),
                  pac:r[pacIdx]||"",tel:"",
                  dt:dtIdx>=0?r[dtIdx]:"",hr:"",
                  proc:"Consulta",mod:"Presencial",st:"Agendado",obs:""
                }));
                if(novos.length===0){alert("Nenhum agendamento encontrado no CSV.");return;}
                setAgenda(prev=>[...prev,...novos]);
                alert(`✅ ${novos.length} agendamento(s) importado(s) com sucesso!`);
              }}
            />
            {["medico","admin"].includes(usuario.role)&&<Btn v="red" sm onClick={function(){setShowBloq(true);}}>{"🔴 Bloquear"}</Btn>}
            {canP&&<Btn v="p" sm onClick={function(){setShowNew(true);}}>{"+ Agendar"}</Btn>}
          </div>
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
          {[
            {l:"Total mês",v:agMes.length,c:C.p},
            {l:"Hoje",v:agenda.filter(function(a){return a.dt===today;}).length,c:C.blue},
            {l:"Confirmados",v:agMes.filter(function(a){return a.st==="Confirmado";}).length,c:C.green},
            {l:"Bloqueios",v:agMes.filter(function(a){return a.st==="Bloqueado";}).length,c:C.red},
          ].map(function(s,i){return(
            <div key={i} style={{background:C.bg,borderRadius:9,padding:"8px 12px",border:"1px solid "+C.brd}}>
              <p style={{color:s.c,fontSize:20,fontWeight:900,margin:0}}>{s.v}</p>
              <p style={{color:C.txM,fontSize:9,textTransform:"uppercase",margin:"3px 0 0"}}>{s.l}</p>
            </div>
          );})}
        </div>
        {/* View toggle + navigation */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:6}}>
            {["mes","lista"].map(function(v){return(
              <button key={v} onClick={function(){setView(v);}} style={{padding:"4px 12px",borderRadius:99,border:"1.5px solid "+(view===v?C.p:C.brd),background:view===v?C.p+"10":"transparent",color:view===v?C.p:C.txM,fontSize:11,fontWeight:view===v?700:400,cursor:"pointer",fontFamily:"inherit"}}>
                {v==="mes"?"📅 Mês":"📋 Lista"}
              </button>
            );})}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={function(){setMesRef(function(m){return new Date(m.getFullYear(),m.getMonth()-1,1);});}} style={{background:"none",border:"1px solid "+C.brd,borderRadius:8,padding:"4px 10px",cursor:"pointer",color:C.txS,fontWeight:700,fontFamily:"inherit"}}>{"‹"}</button>
            <p style={{color:C.tx,fontWeight:800,fontSize:14,margin:0}}>{MESES_PT[mes]+" "+ano}</p>
            <button onClick={function(){setMesRef(function(m){return new Date(m.getFullYear(),m.getMonth()+1,1);});}} style={{background:"none",border:"1px solid "+C.brd,borderRadius:8,padding:"4px 10px",cursor:"pointer",color:C.txS,fontWeight:700,fontFamily:"inherit"}}>{"›"}</button>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {view==="mes"?(
          <div style={{padding:"12px 16px"}}>
            {/* Legenda */}
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
              {CAL_LEGENDA.map(function(l){return(
                <span key={l.label} style={{display:"flex",alignItems:"center",gap:5,background:l.cor+"12",border:"1px solid "+l.cor+"35",borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:600,color:l.cor}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:l.cor,display:"inline-block"}}/>
                  {l.label}
                </span>
              );})}
            </div>
            {/* Grid cabeçalho dias */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
              {DIAS_PT.map(function(d){return(
                <div key={d} style={{textAlign:"center",padding:"6px 0",color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{d}</div>
              );})}
            </div>
            {/* Grade calendário */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
              {cells.map(function(d,i){
                var isToday=d&&dtStr(d)===today;
                var evs=evsDia(d);
                var temBloq=evs.some(function(e){return e.st==="Bloqueado";});
                return (
                  <div key={i}
                    onClick={function(){if(d){setSelDia(dtStr(d));}}} style={{
                      minHeight:78,borderRadius:10,padding:"5px 5px 4px",cursor:d?"pointer":"default",
                      background:!d?"transparent":temBloq?"rgba(192,57,43,.06)":isToday?C.p+"10":C.card,
                      border:!d?"none":"1.5px solid "+(isToday?C.p:temBloq?"rgba(192,57,43,.35)":C.brd),
                      transition:"all .1s"
                    }}>
                    {d&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:3}}>
                          <span style={{width:22,height:22,borderRadius:"50%",background:isToday?C.p:"transparent",color:isToday?"#fff":temBloq?C.red:C.tx,fontSize:11,fontWeight:isToday?800:d===new Date().getDate()&&mes===new Date().getMonth()?700:400,display:"flex",alignItems:"center",justifyContent:"center"}}>{d}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:2}}>
                          {evs.slice(0,3).map(function(ev,ei){
                            var cor=corEvento(ev.proc,ev.mod,ev.st);
                            return (
                              <div key={ei} style={{background:cor,borderRadius:4,padding:"1px 4px",overflow:"hidden"}}>
                                <p style={{color:"#fff",fontSize:8.5,fontWeight:600,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.st==="Bloqueado"?"🔴 Bloqueio":ev.hr+" "+ev.pac.split(" ")[0]}</p>
                              </div>
                            );
                          })}
                          {evs.length>3&&<p style={{color:C.txM,fontSize:8,margin:0,textAlign:"center"}}>{`+${evs.length-3} mais`}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ):(
          <div style={{padding:16}}>
            {agenda.filter(function(a){return a.dt&&a.dt.slice(0,7)===(ano+"-"+(mes+1<10?"0":"")+(mes+1));})
              .sort(function(a,b){return a.dt>b.dt?1:a.dt<b.dt?-1:a.hr>b.hr?1:-1;})
              .map(function(ag,i){
                var cor=corEvento(ag.proc,ag.mod,ag.st);
                var isBlq=ag.st==="Bloqueado";
                return (
                  <div key={ag.id||i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 15px",background:isBlq?"rgba(192,57,43,.05)":C.card,borderRadius:12,marginBottom:8,border:"1.5px solid "+cor+"35",boxShadow:"0 2px 6px "+C.sh}}>
                    <div style={{minWidth:50,background:cor+"15",borderRadius:9,padding:"6px 4px",textAlign:"center",flexShrink:0}}>
                      <p style={{color:cor,fontWeight:800,fontSize:12,margin:0}}>{ag.dt.slice(8)+"/"+ag.dt.slice(5,7)}</p>
                      {!isBlq&&<p style={{color:cor,fontSize:10,margin:0}}>{ag.hr}</p>}
                    </div>
                    <div style={{width:3,background:cor,borderRadius:99,alignSelf:"stretch",minHeight:36,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <p style={{color:isBlq?C.red:C.tx,fontWeight:700,fontSize:13,margin:0}}>{isBlq?"🔴 Bloqueio":ag.pac}</p>
                      <p style={{color:cor,fontSize:11,margin:"2px 0 3px",fontWeight:600}}>{ag.proc}</p>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        <span style={{background:cor+"15",color:cor,border:"1px solid "+cor+"30",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>{ag.mod}</span>
                        <span style={{background:ag.st==="Confirmado"?C.green+"15":ag.st==="Bloqueado"?C.red+"15":C.amber+"15",color:ag.st==="Confirmado"?C.green:ag.st==="Bloqueado"?C.red:C.amber,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>{ag.st}</span>
                        {ag.obs&&<span style={{color:C.txM,fontSize:9,fontStyle:"italic"}}>{ag.obs}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                      {canP&&!isBlq&&ag.tel&&<a href={"https://wa.me/55"+ag.tel.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:7,padding:"5px 9px",fontSize:10,fontWeight:700,textDecoration:"none"}}>{"📱"}</a>}
                      {canP&&<button onClick={function(){setConfirmDelAg(ag);}} title="Excluir consulta" style={{background:"rgba(192,57,43,.08)",border:"1px solid rgba(192,57,43,.3)",color:C.red,borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"🗑️"}</button>}
                    </div>
                  </div>
                );
              })
            }
            {agMes.length===0&&<p style={{textAlign:"center",color:C.txM,padding:40,fontSize:13}}>{"Sem agendamentos neste mês"}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DADOS MOCK — Financeiro (v32: definição faltante corrigida)
════════════════════════════════════════════════════════════════ */
const mockLancamentos_data = (() => {
  try {
    const s = localStorage.getItem("crm_lancamentos_v26");
    if (s) return JSON.parse(s);
  } catch(e) {}
  return [
    { id:"l1",  pac:"Maria Aparecida Santos",   proc:"Consulta Gastroenterologia", tp:"Particular", val:800,  st:"Pago",     dt:"10/04/2026" },
    { id:"l2",  pac:"João Carlos Oliveira",     proc:"Plano Intestino 360°",       tp:"Plano 360°", val:3000, st:"Pago",     dt:"08/04/2026" },
    { id:"l3",  pac:"Ana Paula Rodrigues",      proc:"Retorno",                    tp:"Particular", val:400,  st:"Pendente", dt:"15/04/2026" },
    { id:"l4",  pac:"Roberto Lima",             proc:"Consulta Gastroenterologia", tp:"Unimed",     val:0,    st:"Pago",     dt:"09/04/2026" },
    { id:"l5",  pac:"Fernanda Costa",           proc:"Teste Respiratório SIBO",    tp:"Particular", val:660,  st:"Pago",     dt:"07/04/2026" },
    { id:"l6",  pac:"Carlos Eduardo Mendes",    proc:"1ª Consulta",                tp:"Particular", val:800,  st:"Atrasado", dt:"01/04/2026" },
    { id:"l7",  pac:"Patricia Almeida",         proc:"Colonoscopia (encaminhada)", tp:"Particular", val:0,    st:"Pendente", dt:"18/04/2026" },
    { id:"l8",  pac:"Luciana Ferreira",         proc:"Plano Intestino 360°",       tp:"Plano 360°", val:3000, st:"Pendente", dt:"20/04/2026" },
    { id:"l9",  pac:"Marcos Aurelio Souza",     proc:"Consulta Online (Tele)",     tp:"Particular", val:800,  st:"Pago",     dt:"05/04/2026" },
    { id:"l10", pac:"Simone Batista",           proc:"Consulta Gastroenterologia", tp:"Bradesco",   val:0,    st:"Pago",     dt:"03/04/2026" },
  ];
})();

/* ════════════════════════════════════════════════════════════════
   Badge — componente de status (v32: definição faltante corrigida)
════════════════════════════════════════════════════════════════ */
// ── stBadge: badge de status reutilizável em todo o CRM ──
function stBadge(st) {
  const map = {
    "Ativo":        { c: T.gr,  b: T.grB,  br: T.grBr  },
    "Inativo":      { c: T.re,  b: T.reB,  br: T.reBr  },
    "Aguardando":   { c: T.am,  b: T.amB,  br: T.amBr  },
    "Alta":         { c: T.b,   b: T.bL,   br: T.b+"40" },
    "Pendente":     { c: T.am,  b: T.amB,  br: T.amBr  },
    "Realizado":    { c: T.gr,  b: T.grB,  br: T.grBr  },
    "Cancelado":    { c: T.re,  b: T.reB,  br: T.reBr  },
    "Agendado":     { c: T.b,   b: T.bL,   br: T.b+"40" },
    "Em andamento": { c: T.am,  b: T.amB,  br: T.amBr  },
    "Concluído":    { c: T.gr,  b: T.grB,  br: T.grBr  },
  };
  const { c = T.txM, b = T.sur2, br = T.br } = map[st] || {};
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding:"3px 10px", borderRadius:99,
      fontSize:10, fontWeight:700, letterSpacing:".05em",
      textTransform:"uppercase", whiteSpace:"nowrap",
      background:b, color:c, border:`1px solid ${br}`,
    }}>
      {st || "—"}
    </span>
  );
}

function Badge({ label, color, bg, brd }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
      textTransform: "uppercase", whiteSpace: "nowrap",
      background: bg || `${color}15`,
      color: color,
      border: `1px solid ${brd || color + "30"}`,
    }}>
      {label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   FINANCEIRO
════════════════════════════════════════════════════════════════ */

function PageFinancas() {
  const [lancamentos, setLancamentos] = useState(() => {
    try {
      const s = localStorage.getItem("crm_lancamentos_v26");
      return s ? JSON.parse(s) : mockLancamentos_data;
    } catch(e) { return mockLancamentos_data; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm_lancamentos_v26", JSON.stringify(lancamentos)); } catch(e) {}
  }, [lancamentos]);
  const [filtro, setFiltro] = useState("Todos");
  const [confirmLimpar, setConfirmLimpar] = useState(false);

  function limparHistorico() {
    setLancamentos([]);
    localStorage.removeItem("crm_lancamentos_v26");
    setConfirmLimpar(false);
  }

  const total = lancamentos.reduce((s,l)=>s+l.val,0);
  const pago  = lancamentos.filter(l=>l.st==="Pago").reduce((s,l)=>s+l.val,0);
  const pend  = lancamentos.filter(l=>l.st==="Pendente").reduce((s,l)=>s+l.val,0);
  const atras = lancamentos.filter(l=>l.st==="Atrasado").reduce((s,l)=>s+l.val,0);
  const metaBar = Math.min((pago/15000)*100,100);
  const filtered = filtro==="Todos" ? lancamentos : lancamentos.filter(l=>l.st===filtro);
  const stFin = st => {
    const m = { Pago:[T.gr,T.grB,T.grBr], Pendente:[T.am,T.amB,T.amBr], Atrasado:[T.re,T.reB,T.reBr] };
    const [c,b,br] = m[st]||[T.txM,T.sur2,T.br];
    return <Badge label={st} color={c} bg={b} brd={br} />;
  };
  return (
    <div className="page" style={{ padding:"24px 28px 48px", display:"flex", flexDirection:"column", gap:20 }}>

      {/* Confirm limpar */}
      {confirmLimpar && (
        <ConfirmPopup
          title="Limpar histórico financeiro?"
          msg="Todos os lançamentos serão removidos permanentemente. Esta ação não pode ser desfeita."
          danger={true}
          yesLabel="🗑️ Limpar tudo"
          noLabel="Cancelar"
          onYes={limparHistorico}
          onNo={()=>setConfirmLimpar(false)}
        />
      )}

      {/* Header com botão limpar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:20, fontWeight:800, color:T.tx }}>Financeiro</div>
        <button onClick={()=>setConfirmLimpar(true)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
            borderRadius:9, border:`1px solid ${T.reBr}`, background:T.reB,
            color:T.re, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          🗑️ Limpar histórico
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {[
          { label:"Total geral", val:total, c:T.tx, bg:T.sur, ic:"money", ac:T.b  },
          { label:"Recebido",    val:pago,  c:T.gr, bg:T.grB, ic:"check", ac:T.gr },
          { label:"A receber",   val:pend,  c:T.am, bg:T.amB, ic:"clock", ac:T.am },
          { label:"Atrasado",    val:atras, c:T.re, bg:T.reB, ic:"bell",  ac:T.re },
        ].map(k => (
          <div key={k.label} style={{ background:T.sur, border:`1px solid ${T.br}`,
            borderRadius:16, padding:"20px", borderTop:`3px solid ${k.ac}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:k.bg,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n={k.ic} sz={15} c={k.c} />
              </div>
              <span style={{ fontSize:11, color:T.txS, fontWeight:600,
                textTransform:"uppercase", letterSpacing:".06em" }}>{k.label}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:k.c, letterSpacing:"-.03em" }}>
              R$ {k.val.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16, padding:"20px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:T.tx }}>Meta mensal — Abril 2026</div>
            <div style={{ fontSize:12, color:T.txS, marginTop:2 }}>R$ {pago.toLocaleString("pt-BR")} de R$ 15.000</div>
          </div>
          <span style={{ fontSize:18, fontWeight:800, color:T.gr }}>{Math.round(metaBar)}%</span>
        </div>
        <div style={{ height:10, borderRadius:99, background:T.sur2, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:99, width:`${metaBar}%`,
            background:`linear-gradient(90deg,${T.gr},#3DA066)`, transition:"width .6s" }} />
        </div>
      </div>

      {/* tabela lançamentos */}
      <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16, overflow:"hidden" }}>
        <div style={{ padding:"16px 22px", borderBottom:`1px solid ${T.br}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <span style={{ fontSize:14, fontWeight:700, color:T.tx }}>Lançamentos</span>
          <div style={{ display:"flex", gap:6 }}>
            {["Todos","Pago","Pendente","Atrasado"].map(f => (
              <button key={f} onClick={()=>setFiltro(f)}
                style={{ padding:"5px 13px", borderRadius:99, fontSize:11,
                  fontWeight:filtro===f?700:400,
                  border:`1.5px solid ${filtro===f?T.b:T.br}`,
                  background:filtro===f?T.bL:T.sur, color:filtro===f?T.b:T.txM,
                  cursor:"pointer", fontFamily:"inherit" }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr .8fr .6fr",
          padding:"10px 22px", background:T.sur2, borderBottom:`1px solid ${T.br}`,
          fontSize:11, fontWeight:700, color:T.txM, textTransform:"uppercase",
          letterSpacing:".08em", gap:8 }}>
          <span>Paciente</span><span>Procedimento</span><span>Plano</span><span>Valor</span><span>Status</span>
        </div>
        {filtered.map((l,i) => (
          <div key={l.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr .8fr .6fr",
            padding:"13px 22px", gap:8, alignItems:"center",
            borderBottom:i<filtered.length-1?`1px solid ${T.br}`:"none",
            transition:"background .12s" }}
            onMouseEnter={e=>e.currentTarget.style.background=T.sur2}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>{l.pac}</div>
              <div style={{ fontSize:11, color:T.txS, marginTop:1 }}>{l.dt}</div>
            </div>
            <span style={{ fontSize:12, color:T.txM }}>{l.proc}</span>
            <span style={{ fontSize:12, color:T.txM }}>{l.tp}</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.tx }}>R${l.val.toLocaleString("pt-BR")}</span>
            {stFin(l.st)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────


function PageMarketing({usuario}){
  const [tarefas,setTarefas]=useState(()=>safeLsGet("crm_marketing_v26"));
  useEffect(()=>{localStorage.setItem("crm_marketing_v26",JSON.stringify(tarefas));},[tarefas]);
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({titulo:"",cat:"Instagram",prazo:"",st:"pendente",prior:"media"});
  const priCor={alta:C.red,media:C.amber,baixa:C.green};
  function toggle(id){setTarefas(p=>p.map(t=>t.id===id?{...t,st:t.st==="feito"?"pendente":"feito"}:t));}
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {showNew&&(
        <Modal title="📣 Nova Tarefa de Marketing" onClose={()=>setShowNew(false)} width={460}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={SL}>Título *</label><input value={form.titulo} onChange={e=>setForm(p=>({...p,titulo:e.target.value}))} placeholder="Descrição da tarefa" style={SI}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div><label style={SL}>Canal</label><select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={SI}>{["Instagram","WhatsApp","SMS","Site","Email","TikTok"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label style={SL}>Prazo</label><input type="date" value={form.prazo} onChange={e=>setForm(p=>({...p,prazo:e.target.value}))} style={SI}/></div>
              <div><label style={SL}>Prioridade</label><select value={form.prior} onChange={e=>setForm(p=>({...p,prior:e.target.value}))} style={SI}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="g" onClick={()=>setShowNew(false)}>Cancelar</Btn><Btn v="p" onClick={()=>{setTarefas(p=>[...p,{...form,id:`m${Date.now()}`}]);setShowNew(false);setForm({titulo:"",cat:"Instagram",prazo:"",st:"pendente",prior:"media"});}}>✅ Adicionar</Btn></div>
          </div>
        </Modal>
      )}
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.brd}`,background:C.card,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{color:C.tx,fontSize:18,fontWeight:800,margin:0}}>📣 Marketing</h2>
          <Btn v="p" sm onClick={()=>setShowNew(true)}>+ Nova Tarefa</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[{l:"Pendentes",v:tarefas.filter(t=>t.st==="pendente").length,c:C.amber},{l:"Concluídas",v:tarefas.filter(t=>t.st==="feito").length,c:C.green},{l:"Total",v:tarefas.length,c:C.p}].map((s,i)=>(
            <div key={i} style={{background:C.bg,borderRadius:10,padding:"10px 14px",border:`1px solid ${C.brd}`}}>
              <p style={{color:s.c,fontSize:22,fontWeight:900,margin:0}}>{s.v}</p>
              <p style={{color:C.txM,fontSize:10,textTransform:"uppercase",margin:"4px 0 0"}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        <div style={{background:`linear-gradient(135deg,${C.p}15,${C.pG}10)`,border:`1.5px solid ${C.p}25`,borderRadius:14,padding:16,marginBottom:16}}>
          <p style={{color:C.p,fontWeight:800,fontSize:13,margin:"0 0 4px"}}>📱 Script IA — Disponível em WhatsApp e Instagram</p>
          <p style={{color:C.txS,fontSize:12,margin:0}}>Use o botão 🤖 IA Script nas conversas para respostas personalizadas por etapa do funil.</p>
        </div>
        <p style={{color:C.txM,fontSize:11,fontWeight:700,textTransform:"uppercase",margin:"0 0 10px"}}>Pendentes ({tarefas.filter(t=>t.st==="pendente").length})</p>
        {tarefas.filter(t=>t.st==="pendente").map(t=>(
          <div key={t.id} style={{display:"flex",gap:12,alignItems:"center",background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:8,border:`1px solid ${C.brd}`}}>
            <button onClick={()=>toggle(t.id)} style={{width:22,height:22,borderRadius:99,border:`2px solid ${C.brd}`,background:"transparent",cursor:"pointer",flexShrink:0}}/>
            <div style={{flex:1}}><p style={{color:C.tx,fontWeight:600,fontSize:13,margin:0}}>{t.titulo}</p><p style={{color:C.txM,fontSize:11,margin:"2px 0 0"}}>{t.cat} {t.prazo&&`· ${t.prazo}`}</p></div>
            <span style={{background:`${priCor[t.prior]}15`,color:priCor[t.prior],border:`1px solid ${priCor[t.prior]}30`,padding:"2px 8px",borderRadius:99,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{t.prior}</span>
          </div>
        ))}
        {tarefas.filter(t=>t.st==="feito").length>0&&(
          <>
            <p style={{color:C.txM,fontSize:11,fontWeight:700,textTransform:"uppercase",margin:"16px 0 10px"}}>Concluídas</p>
            {tarefas.filter(t=>t.st==="feito").map(t=>(
              <div key={t.id} style={{display:"flex",gap:12,alignItems:"center",background:C.card2,borderRadius:12,padding:"12px 14px",marginBottom:8,border:`1px solid ${C.brd}`,opacity:.7}}>
                <button onClick={()=>toggle(t.id)} style={{width:22,height:22,borderRadius:99,border:"none",background:C.green,cursor:"pointer",flexShrink:0,fontSize:12,color:"#fff"}}>✓</button>
                <p style={{color:C.txM,fontWeight:600,fontSize:13,margin:0,textDecoration:"line-through"}}>{t.titulo}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PERFIL
════════════════════════════════════════════════════════════════ */
function PagePerfil({usuario,users,setUsers}){
  const [oldP,setOldP]=useState("");const [newP,setNewP]=useState("");const [conP,setConP]=useState("");
  const [msg,setMsg]=useState({text:"",ok:false});const [showO,setShowO]=useState(false);const [showN,setShowN]=useState(false);
  function save(){
    const u=users.find(x=>x.id===usuario.id);
    if(oldP!==u.s){setMsg({text:"Senha atual incorreta.",ok:false});return;}
    if(newP.length<8){setMsg({text:"Mínimo 8 caracteres.",ok:false});return;}
    if(newP!==conP){setMsg({text:"Confirmação não coincide.",ok:false});return;}
    setUsers(prev=>prev.map(x=>x.id===usuario.id?{...x,s:newP}:x));
    auditAdd(usuario.nome,"SENHA_ALTERADA","");
    setMsg({text:"✅ Senha alterada!",ok:true});
    setOldP("");setNewP("");setConP("");
    setTimeout(()=>setMsg({text:"",ok:false}),3000);
  }
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,padding:24,overflowY:"auto",maxWidth:560}}>
      <h2 style={{color:C.tx,fontSize:18,fontWeight:800,margin:0}}>👤 Meu Perfil</h2>
      <Card style={{padding:20}}>
        <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20}}>
          {usuario.role==="medico"?(<div style={{width:60,height:60,borderRadius:16,overflow:"hidden",border:`2px solid ${C.p}30`}}><img src={FOTO} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center top"}} onError={e=>{e.target.style.display="none";}}/></div>):(<div style={{width:60,height:60,borderRadius:16,background:`${C.p}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:C.p}}>{initials(usuario.nome)}</div>)}
          <div>
            <h3 style={{color:C.tx,fontSize:17,fontWeight:800,margin:0}}>{usuario.nome}</h3>
            <p style={{color:C.txM,fontSize:12,margin:"4px 0 4px"}}>@{usuario.u}</p>
            <Bdg c={usuario.role==="admin"?C.red:usuario.role==="medico"?C.p:C.gold}>{usuario.role}</Bdg>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["Usuário",usuario.u],["Perfil",usuario.role],["Acesso","completo"],["Sessão",new Date().toLocaleTimeString("pt-BR")]].map(([l,v],i)=>(
            <div key={i} style={{background:C.card2,borderRadius:8,padding:"10px 12px"}}>
              <p style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase",margin:"0 0 4px"}}>{l}</p>
              <p style={{color:C.tx,fontWeight:600,fontSize:13,margin:0}}>{v}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:20}}>
        <p style={{color:C.tx,fontWeight:700,fontSize:14,margin:"0 0 16px"}}>🔑 Alterar Senha</p>
        {[["Senha Atual",oldP,setOldP,showO,setShowO],["Nova Senha",newP,setNewP,showN,setShowN]].map(([lb,val,set,sh,setSh],i)=>(
          <div key={i} style={{marginBottom:12}}>
            <label style={SL}>{lb}</label>
            <div style={{position:"relative"}}>
              <input type={sh?"text":"password"} value={val} onChange={e=>set(e.target.value)} style={{...SI,paddingRight:44}}/>
              <button onClick={()=>setSh(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:15,color:C.txM}}>{sh?"🙈":"👁"}</button>
            </div>
          </div>
        ))}
        {newP.length>0&&(<div style={{marginBottom:10,display:"flex",gap:4,alignItems:"center"}}>{[8,12,16].map(n=><div key={n} style={{flex:1,height:4,borderRadius:99,background:newP.length>=n?C.p:C.card3}}/>)}<span style={{color:C.txM,fontSize:10,marginLeft:6}}>{newP.length<8?"fraca":newP.length<12?"média":"forte"}</span></div>)}
        <div style={{marginBottom:16}}><label style={SL}>Confirmar Nova Senha</label><input type="password" value={conP} onChange={e=>setConP(e.target.value)} style={{...SI,borderColor:conP&&conP!==newP?C.red:C.brd}}/>{conP&&conP!==newP&&<p style={{color:C.red,fontSize:11,marginTop:4}}>Senhas não coincidem</p>}</div>
        {msg.text&&<div style={{background:msg.ok?`${C.p}10`:"rgba(192,57,43,.08)",border:`1px solid ${msg.ok?C.p:C.red}33`,borderRadius:8,padding:"9px 14px",color:msg.ok?C.p:C.red,fontSize:12,marginBottom:12}}>{msg.text}</div>}
        <Btn v="p" full onClick={save}>🔑 Salvar Nova Senha</Btn>
      </Card>
      <Card style={{padding:18}}>
        <p style={{color:C.tx,fontWeight:700,fontSize:14,margin:"0 0 14px"}}>📋 Últimos Acessos</p>
        {_logs.filter(l=>l.u===usuario.nome).slice(0,6).map((l,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:i<5?`1px solid ${C.brd}`:undefined}}>
            <span style={{color:C.txM,fontSize:11,minWidth:140}}>{l.ts}</span>
            <Bdg c={C.p} sm>{l.a}</Bdg>
          </div>
        ))}
        {_logs.filter(l=>l.u===usuario.nome).length===0&&<p style={{color:C.txM,fontSize:12}}>Nenhum registro nesta sessão.</p>}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PÁGINA ADMIN — SEGURANÇA CYBER (v12)
════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   ABA ATUALIZAÇÕES DO SISTEMA
════════════════════════════════════════════════════════════════ */
const VERSAO_ATUAL = "v26";
const CHANGELOG = [
  {
    versao:"v17", data:"Abr/2026", autor:"Sistema",
    status:"atual",
    novidades:[
      "📥 Importação de dados via CSV em todas as páginas (Pacientes, Exames, Agenda, Financeiro, Estoque)",
      "💾 Importação e restauração de backup JSON",
      "🔄 Painel de Atualizações do Sistema com upload de nova versão .jsx",
      "🗂️ Botão Exportar/Importar unificado em todo o sistema",
      "🛡️ Validação e preview de arquivos antes de aplicar atualização",
    ],
    fixes:[
      "Melhoria na compatibilidade do botão de exportação",
      "Correção de layout em telas menores",
    ]
  },
  {
    versao:"v16", data:"Mar/2026", autor:"Dev",
    status:"anterior",
    novidades:[
      "📅 Agenda com visão mensal e lista",
      "💰 Gestão Financeira com Curva ABC e Contas",
      "📦 Controle de Estoque com alertas automáticos",
      "🔬 Módulo de Exames Laboratoriais",
      "🤖 IA Isabela integrada (WhatsApp + Instagram)",
      "📋 Painel Admin com logs de segurança",
    ],
    fixes:[]
  },
  {
    versao:"v15", data:"Fev/2026", autor:"Dev",
    status:"legado",
    novidades:[
      "📱 Inbox TikTok",
      "👑 Plano 360° VIP (badge dourado)",
      "🔐 Autenticação com certificado digital (simulada)",
    ],
    fixes:[]
  },
];

function AbaAtualizacoes({usuario}){
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [erro, setErro] = useState("");
  const fileRef = useRef();

  function parseFileInfo(f){
    return new Promise(resolve=>{
      const reader = new FileReader();
      reader.onload = e=>{
        const txt = e.target.result;
        // Extrai versão do arquivo (busca por "v17", "v18", etc nos primeiros comentários)
        const verMatch = txt.match(/v(\d+)/i);
        const ver = verMatch ? "v"+verMatch[1] : "desconhecida";
        const linhas = txt.split("\n").length;
        const size = (f.size/1024).toFixed(1);
        // Extrai título do primeiro comentário
        const tituloMatch = txt.match(/CRM[^\n]*?v?(\d+)/i);
        resolve({
          nome:f.name,
          versao:ver,
          linhas,
          size,
          titulo:tituloMatch?tituloMatch[0].trim():"CRM Médico Dra. Ilza",
          conteudo:txt,
          dataHora:new Date().toLocaleString("pt-BR"),
        });
      };
      reader.readAsText(f,"UTF-8");
    });
  }

  async function handleFile(f){
    if(!f) return;
    if(!f.name.endsWith(".jsx")&&!f.name.endsWith(".js")){
      setErro("⚠️ Apenas arquivos .jsx ou .js são aceitos para atualização do sistema.");
      return;
    }
    setErro("");
    const info = await parseFileInfo(f);
    setFile(f);
    setFileInfo(info);
  }

  function aplicarAtualizacao(){
    if(!fileInfo) return;
    setApplying(true);
    setErro("");

    const salvarViaIPC = async () => {
      try {
        if(window.electronAPI && typeof window.electronAPI.salvarAtualizacao === "function"){
          const ok = await window.electronAPI.salvarAtualizacao(fileInfo.conteudo, fileInfo.nome);
          if(ok){
            auditAdd(usuario.nome,"ATUALIZ_SISTEMA","Atualizacao aplicada: "+fileInfo.versao+" ("+fileInfo.nome+")");
            setApplied(true);
            setApplying(false);
            setTimeout(()=>{
              if(window.electronAPI && typeof window.electronAPI.reiniciarApp === "function"){
                window.electronAPI.reiniciarApp();
              } else {
                window.location.reload();
              }
            }, 2000);
            return true;
          }
        }
      } catch(e){ console.error("IPC falhou:", e); }
      return false;
    };

    const salvarViaLocalStorage = () => {
      try {
        localStorage.setItem("crm_update_content", fileInfo.conteudo);
        localStorage.setItem("crm_update_name",    fileInfo.nome);
        localStorage.setItem("crm_update_versao",  fileInfo.versao);
        auditAdd(usuario.nome,"ATUALIZ_SISTEMA","Atualizacao salva: "+fileInfo.versao+" ("+fileInfo.nome+")");
        setApplied(true);
        setApplying(false);
        if(window.confirm("Atualizacao "+fileInfo.versao+" salva!\n\nClicar OK para reiniciar o sistema agora.")){
          window.location.reload();
        }
      } catch(e){
        setErro("Falha ao salvar: "+e.message);
        setApplying(false);
      }
    };

    salvarViaIPC().then(ok => { if(!ok) salvarViaLocalStorage(); });
  }

  const corStatus = s => s==="atual"?C.green:s==="anterior"?C.p:C.txM;
  const bgStatus  = s => s==="atual"?`${C.green}10`:s==="anterior"?`${C.p}08`:`${C.txM}08`;

  return(
    <div>
      {/* Card versão atual */}
      <div style={{background:`linear-gradient(135deg,${C.p}10,${C.pG}08)`,border:`1.5px solid ${C.p}30`,borderRadius:16,padding:"18px 22px",marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
        <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${C.p},${C.pG})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🩺</div>
        <div style={{flex:1}}>
          <p style={{color:C.tx,fontWeight:900,fontSize:16,margin:"0 0 2px"}}>CRM Médico — Dra. Ilza Ezequiel</p>
          <p style={{color:C.txM,fontSize:12,margin:"0 0 6px"}}>Sistema de gestão para gastroenterologia · Santos/SP</p>
          <div style={{display:"flex",gap:8}}>
            <span style={{background:`${C.green}15`,color:C.green,border:`1px solid ${C.green}30`,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:800}}>✅ {VERSAO_ATUAL} — Atual</span>
            <span style={{color:C.txM,fontSize:11,padding:"3px 6px"}}>4 módulos · 12 páginas</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{color:C.txM,fontSize:10,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:".06em"}}>Última atualização</p>
          <p style={{color:C.tx,fontWeight:700,fontSize:12,margin:0}}>Abr/2026</p>
        </div>
      </div>

      {/* Upload de nova versão */}
      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:16,padding:20,marginBottom:20}}>
        <p style={{color:C.tx,fontWeight:800,fontSize:14,margin:"0 0 4px"}}>🔄 Aplicar Atualização do Sistema</p>
        <p style={{color:C.txM,fontSize:12,margin:"0 0 16px"}}>Faça upload do arquivo <code style={{background:C.card2,padding:"1px 6px",borderRadius:4,fontSize:11}}>.jsx</code> com a nova versão do CRM para inspecionar e aplicar.</p>

        {/* Drop zone */}
        {!fileInfo && (
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            onClick={()=>fileRef.current&&fileRef.current.click()}
            style={{
              border:`2px dashed ${dragOver?C.p:C.brd}`,borderRadius:12,
              padding:"32px 20px",textAlign:"center",cursor:"pointer",
              background:dragOver?`${C.p}06`:C.card2,
              transition:"all .2s"
            }}
          >
            <input ref={fileRef} type="file" accept=".jsx,.js" style={{display:"none"}}
              onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);e.target.value="";}}/>
            <p style={{fontSize:32,margin:"0 0 8px"}}>📂</p>
            <p style={{color:dragOver?C.p:C.tx,fontWeight:700,fontSize:13,margin:"0 0 4px"}}>
              {dragOver?"Solte o arquivo aqui!":"Arraste o arquivo .jsx ou clique para selecionar"}
            </p>
            <p style={{color:C.txM,fontSize:11,margin:0}}>Apenas arquivos .jsx · Máximo 5MB</p>
          </div>
        )}

        {erro&&<div style={{background:"rgba(192,57,43,.07)",border:"1px solid rgba(192,57,43,.3)",borderRadius:10,padding:"10px 14px",color:C.red,fontSize:12,marginTop:12}}>{erro}</div>}

        {/* Preview do arquivo */}
        {fileInfo && !applied && (
          <div>
            <div style={{background:`${C.green}08`,border:`1.5px solid ${C.green}30`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
              <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:28}}>📦</span>
                <div style={{flex:1}}>
                  <p style={{color:C.tx,fontWeight:800,fontSize:14,margin:"0 0 2px"}}>{fileInfo.titulo}</p>
                  <p style={{color:C.txM,fontSize:11,margin:0}}>{fileInfo.nome} · {fileInfo.size} KB · {fileInfo.linhas.toLocaleString("pt-BR")} linhas</p>
                </div>
                <span style={{background:`${C.green}15`,color:C.green,border:`1px solid ${C.green}30`,padding:"4px 12px",borderRadius:99,fontSize:12,fontWeight:800}}>{fileInfo.versao}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {l:"Versão detectada",v:fileInfo.versao,c:C.green},
                  {l:"Tamanho",v:fileInfo.size+" KB",c:C.p},
                  {l:"Importado em",v:fileInfo.dataHora,c:C.txS},
                ].map((s,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:8,padding:"8px 12px",border:`1px solid ${C.brd}`}}>
                    <p style={{color:s.c,fontWeight:800,fontSize:13,margin:"0 0 2px"}}>{s.v}</p>
                    <p style={{color:C.txM,fontSize:10,margin:0,textTransform:"uppercase",letterSpacing:".04em"}}>{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:"rgba(212,131,10,.07)",border:"1px solid rgba(212,131,10,.3)",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
              <p style={{color:C.amber,fontWeight:700,fontSize:12,margin:"0 0 4px"}}>⚠️ Como aplicar a atualização:</p>
              <p style={{color:C.txS,fontSize:12,margin:0,lineHeight:1.7}}>
                1. Clique em <strong>"✅ Baixar e Aplicar"</strong> — o arquivo será baixado para o seu computador.<br/>
                2. Substitua o arquivo atual do CRM pelo arquivo baixado.<br/>
                3. Recarregue a página para usar a nova versão.
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setFile(null);setFileInfo(null);setErro("");}} style={{
                padding:"9px 18px",borderRadius:9,border:`1.5px solid ${C.brd}`,background:"transparent",
                color:C.txS,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"
              }}>✕ Cancelar</button>
              <button onClick={aplicarAtualizacao} disabled={applying} style={{
                padding:"9px 22px",borderRadius:9,border:"none",
                background:applying?C.txM:`linear-gradient(135deg,${C.green},#27ae60)`,
                color:"#fff",fontWeight:800,fontSize:13,cursor:applying?"not-allowed":"pointer",fontFamily:"inherit",
                display:"flex",alignItems:"center",gap:8
              }}>
                {applying?"⏳ Preparando...":"✅ Baixar e Aplicar Atualização"}
              </button>
            </div>
          </div>
        )}

        {applied && (
          <div style={{background:`${C.green}10`,border:`1.5px solid ${C.green}40`,borderRadius:12,padding:20,textAlign:"center"}}>
            <p style={{fontSize:36,margin:"0 0 8px"}}>✅</p>
            <p style={{color:C.green,fontWeight:800,fontSize:15,margin:"0 0 6px"}}>Arquivo baixado com sucesso!</p>
            <p style={{color:C.txM,fontSize:12,margin:"0 0 16px"}}>Substitua o arquivo atual pelo arquivo baixado e recarregue a página para usar a nova versão.</p>
            <button onClick={()=>{setFile(null);setFileInfo(null);setApplied(false);}} style={{
              padding:"8px 18px",borderRadius:9,border:`1.5px solid ${C.brd}`,background:"transparent",
              color:C.txS,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"
            }}>🔄 Importar outro arquivo</button>
          </div>
        )}
      </div>

      {/* Changelog */}
      <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:16,padding:20}}>
        <p style={{color:C.tx,fontWeight:800,fontSize:14,margin:"0 0 16px"}}>📋 Histórico de Versões</p>
        {CHANGELOG.map((v,i)=>(
          <div key={i} style={{borderLeft:`3px solid ${corStatus(v.status)}`,paddingLeft:16,marginBottom:20}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
              <span style={{background:bgStatus(v.status),color:corStatus(v.status),border:`1px solid ${corStatus(v.status)}30`,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:800}}>{v.versao}</span>
              <span style={{color:C.txM,fontSize:11}}>{v.data}</span>
              {v.status==="atual"&&<span style={{background:`${C.green}15`,color:C.green,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99}}>✅ Versão atual</span>}
            </div>
            {v.novidades.length>0&&(
              <div style={{marginBottom:v.fixes.length>0?8:0}}>
                {v.novidades.map((n,j)=>(
                  <div key={j} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:4}}>
                    <span style={{color:corStatus(v.status),fontSize:12,minWidth:14}}>+</span>
                    <span style={{color:C.txS,fontSize:12}}>{n}</span>
                  </div>
                ))}
              </div>
            )}
            {v.fixes.length>0&&v.fixes.map((f,j)=>(
              <div key={j} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:4}}>
                <span style={{color:C.amber,fontSize:12,minWidth:14}}>🔧</span>
                <span style={{color:C.txM,fontSize:11}}>{f}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PageAdmin({usuario,users,setUsers}){
  const [tab,setTab]=useState("logs");
  const [showSenhas,setShowSenhas]=useState(false);
  const [editUser,setEditUser]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [senhaMsg,setSenhaMsg]=useState({text:"",ok:false});
  const [adminConf,setAdminConf]=useState("");
  const [filtroAcao,setFiltroAcao]=useState("todos");
  const [filtroUser,setFiltroUser]=useState("todos");
  const [showNovoUser,setShowNovoUser]=useState(false);
  const [novoForm,setNovoForm]=useState({nome:"",u:"",email:"",s:"",role:"recepcao"});
  const [novoMsg,setNovoMsg]=useState({text:"",ok:false});
  const [confirmDel,setConfirmDel]=useState(null);

  const ACOES_CORES={
    LOGIN:"#1e8449", LOGOUT:"#c0392b", SENHA_ALTERADA:"#d4830a",
    REVEAL:"#6c3483", OCULTAR:"#6c3483",
    LOGIN_ERRO:"#c0392b", ACESSO_NEGADO:"#c0392b",
    USER_EDITADO:"#1a5fa8", USER_CRIADO:"#1e8449", USER_REMOVIDO:"#c0392b",
  };

  const logsAll=[..._logs];
  const logsFiltered=logsAll.filter(l=>{
    if(filtroAcao!=="todos"&&l.a!==filtroAcao) return false;
    if(filtroUser!=="todos"&&l.u!==filtroUser) return false;
    return true;
  });

  const acoesUnicas=[...new Set(logsAll.map(l=>l.a))];
  const usersLog=[...new Set(logsAll.map(l=>l.u))];

  const stats={
    logins: logsAll.filter(l=>l.a==="LOGIN").length,
    erros:  logsAll.filter(l=>l.a==="LOGIN_ERRO"||l.a==="ACESSO_NEGADO").length,
    senhas: logsAll.filter(l=>l.a==="SENHA_ALTERADA").length,
    reveals:logsAll.filter(l=>l.a==="REVEAL").length,
  };

  function saveEditUser(){
    if(!editUser) return;
    if(editForm.s&&editForm.s.length<6){setSenhaMsg({text:"Senha mínima 6 caracteres.",ok:false});return;}
    setUsers(prev=>prev.map(u=>u.id===editUser.id?{...u,...editForm}:u));
    auditAdd(usuario.nome,"USER_EDITADO",`Editou usuário: ${editUser.u}`);
    setSenhaMsg({text:"✅ Usuário atualizado!",ok:true});
    setTimeout(()=>{setSenhaMsg({text:"",ok:false});setEditUser(null);},2000);
  }

  function criarUsuario(){
    if(!novoForm.nome.trim()||!novoForm.u.trim()||!novoForm.s.trim()){setNovoMsg({text:"Preencha nome, usuário e senha.",ok:false});return;}
    if(novoForm.s.length < 8){setNovoMsg({text:"Senha deve ter pelo menos 8 caracteres.",ok:false});return;}
    if(!/[A-Z]/.test(novoForm.s)||!/[0-9]/.test(novoForm.s)){setNovoMsg({text:"Senha precisa ter letras maiúsculas e números.",ok:false});return;}
    if(novoForm.s.length<6){setNovoMsg({text:"Senha mínima 6 caracteres.",ok:false});return;}
    if(users.find(u=>u.u.toLowerCase()===novoForm.u.trim().toLowerCase())){setNovoMsg({text:"Login já existe. Escolha outro.",ok:false});return;}
    const novo={...novoForm,id:Date.now(),u:novoForm.u.trim(),nome:novoForm.nome.trim()};
    setUsers(prev=>[...prev,novo]);
    auditAdd(usuario.nome,"USER_CRIADO",`Criou usuário: ${novo.u} (${novo.role})`);
    setNovoMsg({text:"✅ Usuário criado com sucesso!",ok:true});
    setTimeout(()=>{setNovoMsg({text:"",ok:false});setShowNovoUser(false);setNovoForm({nome:"",u:"",email:"",s:"",role:"recepcao"});},2000);
  }

  function excluirUsuario(u){
    if(u.id===usuario.id){alert("Você não pode excluir seu próprio usuário.");return;}
    setUsers(prev=>prev.filter(x=>x.id!==u.id));
    auditAdd(usuario.nome,"USER_REMOVIDO",`Removeu usuário: ${u.u}`);
    setConfirmDel(null);
  }

  const TABS=[
    {k:"logs",    label:"📋 Logs de Acesso"},
    {k:"usuarios",label:"👥 Usuários"},
    {k:"senhas",  label:"🔑 Senhas"},
    {k:"updates", label:"🔄 Atualizações"},
    {k:"resumo",  label:"📊 Resumo"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#0d2137,#1a3550)`,padding:"16px 24px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <span style={{fontSize:24}}>🛡️</span>
          <div>
            <h2 style={{color:"#fff",fontSize:17,fontWeight:900,margin:0}}>Painel Admin — Segurança Cyber</h2>
            <p style={{color:"rgba(168,196,224,.7)",fontSize:11,margin:0}}>Controle total de acessos, usuários e eventos de segurança </p>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            <span style={{background:"rgba(30,132,73,.2)",color:"#6fcf97",border:"1px solid rgba(30,132,73,.4)",padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:700}}>{stats.logins} logins</span>
            {stats.erros>0&&<span style={{background:"rgba(192,57,43,.2)",color:"#f87171",border:"1px solid rgba(192,57,43,.4)",padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:700}}>⚠️ {stats.erros} erros</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:tab===t.k?"rgba(59,157,232,.25)":"rgba(255,255,255,.07)",color:tab===t.k?"#fff":"rgba(168,196,224,.7)",fontWeight:tab===t.k?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",borderBottom:tab===t.k?"2px solid #3b9de8":"2px solid transparent"}}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:20,background:C.bg}}>

        {/* ── ABA LOGS ── */}
        {tab==="logs"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <div>
                <label style={SL}>Filtrar por Ação</label>
                <select value={filtroAcao} onChange={e=>setFiltroAcao(e.target.value)} style={{...SI,width:180}}>
                  <option value="todos">Todas as ações</option>
                  {acoesUnicas.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={SL}>Filtrar por Usuário</label>
                <select value={filtroUser} onChange={e=>setFiltroUser(e.target.value)} style={{...SI,width:180}}>
                  <option value="todos">Todos os usuários</option>
                  {usersLog.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{marginLeft:"auto",alignSelf:"flex-end"}}>
                <span style={{color:C.txM,fontSize:11}}>{logsFiltered.length} evento(s)</span>
              </div>
            </div>
            {logsFiltered.length===0&&(
              <div style={{textAlign:"center",padding:48,color:C.txM}}>
                <p style={{fontSize:36,marginBottom:8}}>📋</p>
                <p style={{fontSize:13}}>Nenhum evento registrado nesta sessão ainda.<br/>Os logs aparecem em tempo real conforme o uso do sistema.</p>
              </div>
            )}
            {logsFiltered.map((l,i)=>{
              const cor=ACOES_CORES[l.a]||C.p;
              const isErro=l.a==="LOGIN_ERRO"||l.a==="ACESSO_NEGADO";
              return(
                <div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 14px",background:isErro?"rgba(192,57,43,.04)":C.card,borderRadius:10,marginBottom:6,border:`1px solid ${isErro?"rgba(192,57,43,.2)":C.brd}`,borderLeft:`3px solid ${cor}`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:cor,flexShrink:0}}/>
                  <span style={{color:C.txM,fontSize:11,minWidth:155,flexShrink:0}}>{l.ts}</span>
                  <span style={{background:`${cor}15`,color:cor,border:`1px solid ${cor}30`,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,minWidth:130,textAlign:"center",flexShrink:0}}>{l.a}</span>
                  <span style={{color:C.tx,fontWeight:600,fontSize:12,minWidth:130,flexShrink:0}}>{l.u}</span>
                  {l.d&&<span style={{color:C.txM,fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.d}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ABA USUÁRIOS ── */}
        {tab==="usuarios"&&(
          <div>
            {/* Confirm delete */}
            {confirmDel&&(
              <ConfirmPopup danger title={`Excluir usuário @${confirmDel.u}?`} msg={`Esta ação removerá o acesso de "${confirmDel.nome}" permanentemente.`} yesLabel="🗑️ Excluir" noLabel="Cancelar" onYes={()=>excluirUsuario(confirmDel)} onNo={()=>setConfirmDel(null)}/>
            )}

            {/* Botão criar */}
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <Btn v="p" sm onClick={()=>setShowNovoUser(p=>!p)}>➕ Novo Usuário</Btn>
            </div>

            {/* Formulário de criação */}
            {showNovoUser&&(
              <div style={{background:C.card,border:`1.5px solid ${C.p}40`,borderRadius:14,padding:20,marginBottom:20,borderTop:`3px solid ${C.p}`}}>
                <p style={{color:C.p,fontWeight:800,fontSize:14,margin:"0 0 16px"}}>➕ Criar Novo Usuário</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div><label style={SL}>Nome completo</label><input value={novoForm.nome} onChange={e=>setNovoForm(p=>({...p,nome:e.target.value}))} placeholder="Ex: Ana Paula" style={SI}/></div>
                  <div><label style={SL}>Login (usuário)</label><input value={novoForm.u} onChange={e=>setNovoForm(p=>({...p,u:e.target.value}))} placeholder="Ex: anapaula" style={SI}/></div>
                  <div><label style={SL}>E-mail</label><input type="email" value={novoForm.email} onChange={e=>setNovoForm(p=>({...p,email:e.target.value}))} placeholder="usuario@drailza.com.br" style={SI}/></div>
                  <div><label style={SL}>Perfil (role)</label>
                    <select value={novoForm.role} onChange={e=>setNovoForm(p=>({...p,role:e.target.value}))} style={SI}>
                      {["admin","medico","recepcao","atendente"].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={SL}>Senha inicial</label>
                  <input type="password" value={novoForm.s} onChange={e=>setNovoForm(p=>({...p,s:e.target.value}))} placeholder="Mínimo 6 caracteres" style={SI}/>
                </div>
                {novoMsg.text&&<div style={{background:novoMsg.ok?`${C.green}10`:"rgba(192,57,43,.08)",border:`1px solid ${novoMsg.ok?C.green:C.red}33`,borderRadius:8,padding:"9px 14px",color:novoMsg.ok?C.green:C.red,fontSize:12,marginBottom:12}}>{novoMsg.text}</div>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn v="g" onClick={()=>{setShowNovoUser(false);setNovoForm({nome:"",u:"",email:"",s:"",role:"recepcao"});}}>Cancelar</Btn>
                  <Btn v="p" onClick={criarUsuario}>✅ Criar Usuário</Btn>
                </div>
              </div>
            )}

            {editUser&&(
              <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:14,padding:20,marginBottom:20,borderTop:`3px solid ${C.p}`}}>
                <p style={{color:C.tx,fontWeight:700,fontSize:14,margin:"0 0 16px"}}>✏️ Editar — {editUser.nome}</p>
                {[["Nome",editForm.nome||"","nome"],["Login (usuário)",editForm.u||"","u"],["E-mail",editForm.email||"","email"]].map(([lb,val,k])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <label style={SL}>{lb}</label>
                    <input value={val} onChange={e=>setEditForm(p=>({...p,[k]:e.target.value}))} style={SI} type={k==="email"?"email":"text"} placeholder={k==="email"?"usuario@drailza.com.br":undefined}/>
                  </div>
                ))}
                <div style={{marginBottom:12}}>
                  <label style={SL}>Perfil (role)</label>
                  <select value={editForm.role||""} onChange={e=>setEditForm(p=>({...p,role:e.target.value}))} style={SI}>
                    {["admin","medico","recepcao","atendente"].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={SL}>Nova Senha (deixe vazio para manter)</label>
                  <input type="password" placeholder="••••••••" onChange={e=>setEditForm(p=>({...p,s:e.target.value}))} style={SI}/>
                </div>
                {senhaMsg.text&&<div style={{background:senhaMsg.ok?`${C.p}10`:"rgba(192,57,43,.08)",border:`1px solid ${senhaMsg.ok?C.p:C.red}33`,borderRadius:8,padding:"9px 14px",color:senhaMsg.ok?C.p:C.red,fontSize:12,marginBottom:12}}>{senhaMsg.text}</div>}
                <div style={{display:"flex",gap:8}}>
                  <Btn v="g" onClick={()=>setEditUser(null)}>Cancelar</Btn>
                  <Btn v="p" onClick={saveEditUser}>✅ Salvar</Btn>
                </div>
              </div>
            )}
            {users.map(u=>{
              const cor=u.role==="admin"?C.red:u.role==="medico"?C.p:C.gold;
              const logsU=logsAll.filter(l=>l.u===u.nome);
              const ultLog=logsU[0];
              return(
                <div key={u.id} style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 18px",marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:44,height:44,borderRadius:12,background:`${cor}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:cor,flexShrink:0}}>{initials(u.nome)}</div>
                  <div style={{flex:1}}>
                    <p style={{color:C.tx,fontWeight:700,fontSize:13,margin:0}}>{u.nome}</p>
                    <p style={{color:C.txM,fontSize:11,margin:"2px 0 4px"}}>@{u.u}{u.email&&<span style={{marginLeft:8,color:C.txM}}>· {u.email}</span>}</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Bdg c={cor}>{u.role}</Bdg>
                      {ultLog&&<span style={{color:C.txM,fontSize:10}}>Último: {ultLog.ts} — {ultLog.a}</span>}
                      <span style={{color:C.txM,fontSize:10}}>{logsU.length} eventos</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn v="blue" sm onClick={()=>{setEditUser(u);setEditForm({nome:u.nome,u:u.u,role:u.role,s:"",email:u.email||""});}}>✏️ Editar</Btn>
                    {u.id!==usuario.id&&<Btn v="red" sm onClick={()=>setConfirmDel(u)}>🗑️</Btn>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ABA SENHAS ── */}
        {tab==="senhas"&&(
          <div>
            <div style={{background:"rgba(192,57,43,.06)",border:"1.5px solid rgba(192,57,43,.3)",borderRadius:14,padding:16,marginBottom:20,display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:24,flexShrink:0}}>⚠️</span>
              <div>
                <p style={{color:C.red,fontWeight:800,fontSize:13,margin:"0 0 4px"}}>Área Restrita — Senhas em Texto Plano</p>
                <p style={{color:C.txS,fontSize:12,margin:0}}>Esta área exibe credenciais dos usuários. Acesso exclusivo ao administrador. Registrado em auditoria.</p>
              </div>
            </div>
            {!showSenhas?(
              <div style={{textAlign:"center",padding:40}}>
                <p style={{fontSize:36,marginBottom:12}}>🔐</p>
                <p style={{color:C.txM,fontSize:13,marginBottom:16}}>Para visualizar as senhas, confirme sua senha de admin.</p>
                <div style={{maxWidth:320,margin:"0 auto"}}>
                  <input type="password" value={adminConf} onChange={e=>setAdminConf(e.target.value)} placeholder="Sua senha de admin" style={{...SI,marginBottom:12}}/>
                  <Btn v="red" full onClick={()=>{
                    const me=users.find(u=>u.id===usuario.id);
                    if(adminConf===me.s){setShowSenhas(true);auditAdd(usuario.nome,"VER_SENHAS","Visualizou senhas de todos os usuários");}
                    else{setSenhaMsg({text:"Senha incorreta.",ok:false});setTimeout(()=>setSenhaMsg({text:"",ok:false}),2500);}
                  }}>🔓 Confirmar e Ver Senhas</Btn>
                  {senhaMsg.text&&<p style={{color:C.red,fontSize:12,marginTop:10}}>{senhaMsg.text}</p>}
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <p style={{color:C.tx,fontWeight:700,fontSize:14,margin:0}}>🔑 Credenciais de Acesso</p>
                  <Btn v="red" sm onClick={()=>{setShowSenhas(false);setAdminConf("");}}>🙈 Ocultar</Btn>
                </div>
                <div style={{background:"#fff",border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"8px 16px",background:C.card2,borderBottom:`1px solid ${C.brd}`}}>
                    {["ID","Usuário","Senha","Perfil"].map(h=><span key={h} style={{color:C.txM,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{h}</span>)}
                  </div>
                  {users.map(u=>(
                    <div key={u.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"12px 16px",borderBottom:`1px solid ${C.brd}`,alignItems:"center"}}>
                      <span style={{color:C.txM,fontSize:12}}>#{u.id}</span>
                      <span style={{color:C.tx,fontWeight:700,fontSize:13}}>@{u.u}</span>
                      <span style={{fontFamily:"monospace",background:`${C.red}10`,color:C.red,border:`1px solid ${C.red}25`,padding:"3px 8px",borderRadius:6,fontSize:12,fontWeight:700}}>{u.s}</span>
                      <Bdg c={u.role==="admin"?C.red:u.role==="medico"?C.p:C.gold}>{u.role}</Bdg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA ATUALIZAÇÕES ── */}
        {tab==="updates"&&(
          <AbaAtualizacoes usuario={usuario}/>
        )}

        {/* ── ABA RESUMO ── */}
        {tab==="resumo"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              {[
                {l:"Logins OK",     v:stats.logins,  c:C.green, icon:"✅"},
                {l:"Erros/Negados", v:stats.erros,   c:C.red,   icon:"❌"},
                {l:"Trocas de Senha",v:stats.senhas, c:C.amber, icon:"🔑"},
                {l:"Reveals Dados", v:stats.reveals, c:C.purple,icon:"👁"},
              ].map((s,i)=>(
                <div key={i} style={{background:C.card,border:`1.5px solid ${s.c}25`,borderRadius:14,padding:"16px 18px",borderTop:`3px solid ${s.c}`}}>
                  <p style={{fontSize:28,margin:"0 0 4px"}}>{s.icon}</p>
                  <p style={{color:s.c,fontSize:26,fontWeight:900,margin:0}}>{s.v}</p>
                  <p style={{color:C.txM,fontSize:11,textTransform:"uppercase",margin:"4px 0 0"}}>{s.l}</p>
                </div>
              ))}
            </div>
            <div style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:14,padding:18,marginBottom:16}}>
              <p style={{color:C.tx,fontWeight:700,fontSize:14,margin:"0 0 14px"}}>👥 Usuários Ativos</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
                {users.map(u=>{
                  const cor=u.role==="admin"?C.red:u.role==="medico"?C.p:C.gold;
                  const logsU=logsAll.filter(l=>l.u===u.nome);
                  return(
                    <div key={u.id} style={{background:C.card2,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.brd}`,display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${cor}18`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:cor,fontSize:14}}>{initials(u.nome)}</div>
                      <div>
                        <p style={{color:C.tx,fontWeight:700,fontSize:12,margin:0}}>{u.nome}</p>
                        <p style={{color:C.txM,fontSize:10,margin:"2px 0 0"}}>@{u.u} · {logsU.length} ações</p>
                      </div>
                      <Bdg c={cor} sm>{u.role}</Bdg>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{background:`${C.p}08`,border:`1.5px solid ${C.p}25`,borderRadius:14,padding:18}}>
              <p style={{color:C.p,fontWeight:700,fontSize:14,margin:"0 0 12px"}}>🔒 Boas Práticas de Segurança</p>
              {["Troque senhas a cada 90 dias","Nunca compartilhe credenciais","Use senha forte: letras + números + símbolos","Faça logout ao sair do sistema","Monitore logs de acesso semanalmente","Ative autenticação em dois fatores quando disponível"].map((d,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <span style={{color:C.green,fontSize:14}}>✓</span>
                  <span style={{color:C.txS,fontSize:13}}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   POPUP PRIORIDADE HOME — fila de solicitações para Dra.
════════════════════════════════════════════════════════════════ */

function StepIndicator({ current }) {
  const steps = [
    { n:1, label:"Paciente", icon:"users" },
    { n:2, label:"Consulta", icon:"cal"   },
    { n:3, label:"Exames",   icon:"exam"  },
  ];
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      gap:0, marginBottom:22, padding:"14px 20px", background:T.sur2,
      borderRadius:14, border:`1px solid ${T.br}` }}>
      {steps.map((s, i) => {
        const done    = current > s.n;
        const active  = current === s.n;
        const pending = current < s.n;
        return (
          <div key={s.n} style={{ display:"flex", alignItems:"center" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <div style={{ width:36, height:36, borderRadius:"50%",
                background: done ? T.gr : active ? "linear-gradient(135deg,#A8722A,#7A5018)" : T.sur,
                border: `2px solid ${done ? T.gr : active ? T.b : T.br}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: active ? "0 4px 14px rgba(168,114,42,.35)" : "none",
                transition:"all .3s" }}>
                {done
                  ? <Ic n="check" sz={15} c="#fff" sw={2.5} />
                  : <Ic n={s.icon} sz={15} c={active?"#fff":T.txS} />
                }
              </div>
              <span style={{ fontSize:10, fontWeight: active?700:500,
                color: done ? T.gr : active ? T.b : T.txS,
                textTransform:"uppercase", letterSpacing:".06em" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width:52, height:2, margin:"0 6px", marginBottom:18,
                background: done ? T.gr : T.br,
                borderRadius:99, transition:"background .3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Popup fluxo sequencial: Paciente → Consulta → Exames ─────────────────────

function PopupNovoPaciente({ onClose, onSave, onSaveConsulta, onSaveExame }) {
  const [step, setStep]   = useState(1);
  const [pacNome, setPacNome] = useState("");
  const [form, setForm] = useState({
    nm:"", nasc:"", sexo:"", tel:"", whatsapp:"",
    email:"", cpf:"", plano:"Particular", st:"Ativo", abc:"", obs:""
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  // ── Consulta form
  const [cForm, setCForm] = useState({
    pac:"", dt:"", hr:"", tipo:"Presencial",
    proc:"1ª Consulta", st:"Aguardando", obs:""
  });
  const cf = (k,v) => setCForm(p=>({...p,[k]:v}));

  // ── Exame form
  const [eDt,    setEDt]    = useState("");
  const [eObs,   setEObs]   = useState("");
  const [eQ,     setEQ]     = useState("");
  const [selList, setSelList] = useState([]);
  const filteredE = EXAMES_LISTA.filter(e => e.toLowerCase().includes(eQ.toLowerCase()));
  const toggleE = nome => setSelList(prev =>
    prev.includes(nome) ? prev.filter(x=>x!==nome) : [...prev, nome]
  );

  // ── Step titles
  const titles = {
    1:"Cadastrar novo paciente",
    2:"Agendar consulta",
    3:"Solicitar exames"
  };

  const handleSavePaciente = () => {
    if(!form.nm.trim()){alert("Nome é obrigatório");return;}
    const novo = {...form, id:"p"+Date.now(), ults:new Date().toLocaleDateString("pt-BR")};
    onSave(novo);
    setPacNome(form.nm);
    setCForm(p=>({...p, pac:form.nm}));
    setStep(2);
  };

  const handleSaveConsulta = () => {
    if(!cForm.dt||!cForm.hr){alert("Preencha data e horário");return;}
    if(onSaveConsulta) onSaveConsulta({...cForm, pac:pacNome, id:"c"+Date.now()});
    setStep(3);
  };

  const handleSaveExames = () => {
    if(selList.length>0 && onSaveExame){
      selList.forEach(tipo=>onSaveExame({id:"e"+Date.now()+Math.random(),pac:pacNome,tipo,dt:eDt,obs:eObs,st:"Agendado"}));
    }
    onClose();
  };

  return (
    <Modal title={titles[step]} onClose={onClose} width={590}>
      <StepIndicator current={step} />

      {/* ── STEP 1: Paciente */}
      {step===1 && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Fld label="Nome completo *">
                <input style={inp} value={form.nm} placeholder="Nome completo"
                  onChange={e=>f("nm",e.target.value)} />
              </Fld>
            </div>
            <Fld label="Data nascimento">
              <input style={inp} type="date" value={form.nasc} onChange={e=>f("nasc",e.target.value)} />
            </Fld>
            <Fld label="Sexo">
              <select style={inp} value={form.sexo} onChange={e=>f("sexo",e.target.value)}>
                <option value="">Selecione</option>
                <option>Feminino</option><option>Masculino</option><option>Outro</option>
              </select>
            </Fld>
            <Fld label="Telefone">
              <input style={inp} value={form.tel} placeholder="(13) 9XXXX-XXXX"
                onChange={e=>f("tel",e.target.value)} />
            </Fld>
            <Fld label="WhatsApp">
              <input style={inp} value={form.whatsapp} placeholder="(13) 9XXXX-XXXX"
                onChange={e=>f("whatsapp",e.target.value)} />
            </Fld>
            <Fld label="E-mail">
              <input style={inp} type="email" value={form.email} placeholder="email@exemplo.com"
                onChange={e=>f("email",e.target.value)} />
            </Fld>
            <Fld label="CPF">
              <input style={inp} value={form.cpf} placeholder="000.000.000-00"
                onChange={e=>f("cpf",e.target.value)} />
            </Fld>
            <Fld label="Plano de saúde">
              <select style={inp} value={form.plano} onChange={e=>f("plano",e.target.value)}>
                {["Particular","Plano 360°","Unimed","Bradesco Saúde","Amil","Hapvida","Outro"]
                  .map(o=><option key={o}>{o}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select style={inp} value={form.st} onChange={e=>f("st",e.target.value)}>
                <option>Ativo</option><option>Inativo</option>
              </select>
            </Fld>
            <Fld label="Classificação ABC">
              <div style={{ display:"flex", gap:8 }}>
                {["A","B","C","—"].map(v => {
                  const val = v==="—"?"":v;
                  const active = form.abc===val;
                  return (
                    <button key={v} onClick={()=>f("abc",val)}
                      style={{ flex:1, padding:"9px 4px", borderRadius:10,
                        border:`1.5px solid ${active?T.b:T.br}`,
                        background:active?T.bL:T.sur, color:active?T.b:T.txM,
                        fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </Fld>
            <div style={{ gridColumn:"1/-1" }}>
              <Fld label="Observações clínicas">
                <textarea style={{ ...inp, resize:"vertical", minHeight:70, lineHeight:1.6 }}
                  value={form.obs} placeholder="Alergias, alertas clínicos..."
                  onChange={e=>f("obs",e.target.value)} />
              </Fld>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            paddingTop:16, borderTop:`1px solid ${T.br}` }}>
            <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={handleSavePaciente} icon="users">
              Cadastrar e agendar consulta →
            </Btn>
          </div>
        </>
      )}

      {/* ── STEP 2: Consulta */}
      {step===2 && (
        <>
          {/* banner paciente cadastrado */}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
            background:T.grB, border:`1px solid ${T.grBr}`, borderRadius:10, marginBottom:18 }}>
            <Ic n="check" sz={16} c={T.gr} sw={2.5} />
            <span style={{ fontSize:13, fontWeight:600, color:T.gr }}>
              Paciente <strong>{pacNome}</strong> cadastrado com sucesso!
            </span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Fld label="Data">
              <input style={inp} type="date" value={cForm.dt} onChange={e=>cf("dt",e.target.value)} />
            </Fld>
            <Fld label="Horário">
              <input style={inp} type="time" value={cForm.hr} onChange={e=>cf("hr",e.target.value)} />
            </Fld>
            <Fld label="Modalidade">
              <div style={{ display:"flex", gap:8 }}>
                {["Presencial","Teleconsulta"].map(t => (
                  <button key={t} onClick={()=>cf("tipo",t)}
                    style={{ flex:1, padding:"10px 8px", borderRadius:10,
                      border:`1.5px solid ${cForm.tipo===t?T.b:T.br}`,
                      background:cForm.tipo===t?T.bL:T.sur, color:cForm.tipo===t?T.b:T.txM,
                      fontWeight:cForm.tipo===t?700:400, fontSize:12.5, cursor:"pointer",
                      fontFamily:"inherit", display:"flex", alignItems:"center",
                      justifyContent:"center", gap:6 }}>
                    <Ic n={t==="Teleconsulta"?"video":"users"} sz={14} c={cForm.tipo===t?T.b:T.txM} />
                    {t}
                  </button>
                ))}
              </div>
            </Fld>
            <Fld label="Procedimento">
              <select style={inp} value={cForm.proc} onChange={e=>cf("proc",e.target.value)}>
                {["1ª Consulta","Consulta Gastroenterologia","Retorno","Resultado de Exame","Acompanhamento"]
                  .map(o=><option key={o}>{o}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select style={inp} value={cForm.st} onChange={e=>cf("st",e.target.value)}>
                <option>Aguardando</option><option>Confirmado</option><option>Cancelado</option>
              </select>
            </Fld>
            <div style={{ gridColumn:"1/-1" }}>
              <Fld label="Observações">
                <textarea style={{ ...inp, resize:"vertical", minHeight:60, lineHeight:1.6 }}
                  value={cForm.obs} onChange={e=>cf("obs",e.target.value)} placeholder="Notas adicionais..." />
              </Fld>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            paddingTop:16, borderTop:`1px solid ${T.br}` }}>
            <Btn variant="ghost" onClick={()=>setStep(3)}>Pular →</Btn>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="secondary" onClick={()=>setStep(1)}>← Voltar</Btn>
              <Btn onClick={handleSaveConsulta} icon="cal">
                Salvar e solicitar exames →
              </Btn>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: Exames */}
      {step===3 && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
            background:T.grB, border:`1px solid ${T.grBr}`, borderRadius:10, marginBottom:18 }}>
            <Ic n="check" sz={16} c={T.gr} sw={2.5} />
            <span style={{ fontSize:13, fontWeight:600, color:T.gr }}>
              Consulta agendada para <strong>{pacNome}</strong>!
            </span>
          </div>
          <Fld label="Data prevista dos exames">
            <input style={inp} type="date" value={eDt} onChange={e=>setEDt(e.target.value)} />
          </Fld>
          <Fld label={`Exames${selList.length>0?` · ${selList.length} selecionado${selList.length!==1?"s":""}`:""}`}>
            <div style={{ position:"relative", marginBottom:8 }}>
              <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }}>
                <Ic n="search" sz={14} c={T.txS} />
              </div>
              <input style={{ ...inp, paddingLeft:34, fontSize:12 }} value={eQ}
                onChange={e=>setEQ(e.target.value)} placeholder="Filtrar exames..." />
            </div>
            <div style={{ border:`1.5px solid ${T.br}`, borderRadius:12, overflow:"hidden",
              maxHeight:210, overflowY:"auto" }}>
              {filteredE.map((e,i) => {
                const checked = selList.includes(e);
                return (
                  <div key={e} onClick={()=>toggleE(e)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 14px",
                      cursor:"pointer", borderBottom:i<filteredE.length-1?`1px solid ${T.br}`:"none",
                      background:checked?T.bL:"transparent", transition:"background .1s" }}
                    onMouseEnter={e2=>{ if(!checked) e2.currentTarget.style.background=T.sur2; }}
                    onMouseLeave={e2=>{ if(!checked) e2.currentTarget.style.background="transparent"; }}>
                    <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                      border:`1.5px solid ${checked?T.b:T.brD}`, background:checked?T.b:T.sur,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {checked && <Ic n="check" sz={11} c="#fff" sw={2.5} />}
                    </div>
                    <span style={{ fontSize:12.5, color:checked?T.b:T.tx, fontWeight:checked?600:400 }}>{e}</span>
                  </div>
                );
              })}
            </div>
          </Fld>
          {selList.length > 0 && (
            <div style={{ background:T.bL, borderRadius:10, padding:"10px 14px",
              marginBottom:14, display:"flex", flexWrap:"wrap", gap:6 }}>
              {selList.map(s => (
                <span key={s} onClick={()=>toggleE(s)}
                  style={{ fontSize:11, fontWeight:600, color:T.b, background:"#fff",
                    border:`1px solid ${T.b}30`, borderRadius:99, padding:"3px 10px",
                    cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}>
                  {s} <span style={{ fontSize:13 }}>×</span>
                </span>
              ))}
            </div>
          )}
          <Fld label="Observações">
            <textarea style={{ ...inp, resize:"vertical", minHeight:55, lineHeight:1.6 }}
              value={eObs} onChange={e=>setEObs(e.target.value)} placeholder="Notas adicionais..." />
          </Fld>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            paddingTop:16, borderTop:`1px solid ${T.br}` }}>
            <Btn variant="ghost" onClick={()=>{ onClose(); }}>Pular e finalizar</Btn>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="secondary" onClick={()=>setStep(2)}>← Voltar</Btn>
              <Btn onClick={handleSaveExames} icon="check">
                {selList.length>0 ? `Solicitar (${selList.length}) e finalizar ✓` : "Finalizar cadastro ✓"}
              </Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Mock prontuário ──────────────────────────────────────────────────────────
const mockProntuarios = {
  p1: [
    { id:"pr1", dt:"2026-03-12", tipo:"Retorno EDA", resumo:"Paciente retorna com melhora dos sintomas após tratamento para H. pylori. Gastrite antral com melhora endoscópica. Mantém omeprazol 20mg. Orientações dietéticas reforçadas. Retorno em 3 meses." },
    { id:"pr2", dt:"2025-11-08", tipo:"1ª Consulta", resumo:"Queixa de epigastralgia há 6 meses, pirose ocasional. Sem disfagia. H. pylori positivo na sorologia. Solicitada EDA. Prescrito omeprazol 20mg 1x/dia." },
  ],
  p2: [
    { id:"pr3", dt:"2026-03-05", tipo:"Retorno Colonoscopia", resumo:"Colonoscopia sem intercorrências. Polipectomia de pólipo séssil 6mm no cólon sigmoide — enviado para anatomopatológico. Resultado pendente. Orientado retorno em 30 dias." },
  ],
  p3: [], p4: [],
};

// ─── Popup ficha paciente — SEM avatar ───────────────────────────────────────


// ─── Dashboard Recepção ─────────────────────────────────────────────────────
function PageHomeRecepcao({ setPage, usuario, pats = [], allExames = [] }) {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);

  // Lê consultas do localStorage
  const consultas = React.useMemo(() => {
    const r = safeLsGet("crm_consultas_v26");
    return Array.isArray(r) ? r : [];
  }, []);

  // Filtra consultas de hoje
  const consultasHoje = consultas.filter(c => {
    const d = c.data || c.dt || c.date || "";
    return d.startsWith(hojeStr);
  });

  // Filtra exames de hoje
  const examesHoje = allExames.filter(e => {
    const d = e.data || e.dt || e.date || "";
    return d.startsWith(hojeStr);
  });

  // Próximas consultas (próximos 7 dias)
  const proximas = consultas.filter(c => {
    const d = c.data || c.dt || c.date || "";
    return d > hojeStr && d <= new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
  }).sort((a,b)=>(a.data||"").localeCompare(b.data||"")).slice(0,8);

  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dataLabel = `${dias[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const StatusBadge = ({ st }) => {
    const map = {
      "Confirmado":   { bg:"#E6F5EE", tx:"#1A7A52", dot:"#1A7A52" },
      "Agendado":     { bg:"#EBF2FB", tx:"#1A5FA8", dot:"#1A5FA8" },
      "Aguardando":   { bg:"#FFF8E6", tx:"#9A6A00", dot:"#F0C060" },
      "Realizado":    { bg:"#F0EEF9", tx:"#4A3A8A", dot:"#B0A0E0" },
      "Cancelado":    { bg:"#FDF0EE", tx:"#C0392B", dot:"#F0A090" },
    };
    const s = map[st] || map["Agendado"];
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:5,
        background:s.bg, color:s.tx, fontSize:10, fontWeight:700,
        padding:"3px 9px", borderRadius:99 }}>
        <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, display:"inline-block" }}/>
        {st || "Agendado"}
      </span>
    );
  };

  return (
    <div className="page" style={{ padding:"24px 28px 48px", display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Hero recepção ── */}
      <div style={{ borderRadius:18, overflow:"hidden", position:"relative",
        background:"linear-gradient(130deg,#0a1929 0%,#0d2137 50%,#1A5FA8 100%)",
        padding:"26px 32px", boxShadow:"0 8px 32px rgba(13,33,55,.25)" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160,
          borderRadius:"50%", background:"rgba(59,157,232,.07)", pointerEvents:"none" }}/>
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.38)",
            letterSpacing:".14em", textTransform:"uppercase", marginBottom:6 }}>
            {dataLabel.toUpperCase()}
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"#fff", letterSpacing:"-.02em", marginBottom:6 }}>
            Olá, {usuario.nome?.split(" ")[0]} 👋 — Recepção
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.5)" }}>
            Aqui estão os atendimentos e exames de hoje.
          </div>
        </div>
        {/* Contadores rápidos no hero */}
        <div style={{ display:"flex", gap:12, marginTop:18 }}>
          {[
            { label:"Consultas hoje",   val:consultasHoje.length, color:"#3B9DE8" },
            { label:"Exames hoje",      val:examesHoje.length,    color:"#86C9A4" },
            { label:"Total pacientes",  val:pats.length,          color:"#B0A0E0" },
          ].map(c => (
            <div key={c.label} style={{ background:"rgba(255,255,255,.08)", backdropFilter:"blur(8px)",
              border:"1px solid rgba(255,255,255,.12)", borderRadius:12,
              padding:"10px 16px", minWidth:120 }}>
              <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.val}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:2 }}>{c.label}</div>
            </div>
          ))}
          <button onClick={()=>setPage("pacientes")}
            style={{ marginLeft:"auto", alignSelf:"flex-end",
              background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)",
              color:"#fff", borderRadius:10, padding:"9px 18px",
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            + Novo paciente
          </button>
        </div>
      </div>

      {/* ── Grid 2 colunas: Consultas | Exames de hoje ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Consultas hoje */}
        <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16,
          boxShadow:"0 2px 12px rgba(13,33,55,.06)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${T.br}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:T.bL,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="cal" sz={16} c={T.b} />
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.tx }}>Consultas de hoje</div>
                <div style={{ fontSize:11, color:T.txS }}>{consultasHoje.length} agendada{consultasHoje.length!==1?"s":""}</div>
              </div>
            </div>
            <button onClick={()=>setPage("agenda")}
              style={{ background:T.bL, color:T.b, border:`1px solid ${T.br}`,
                borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:600,
                cursor:"pointer", fontFamily:"inherit" }}>Ver tudo</button>
          </div>
          <div style={{ overflowY:"auto", maxHeight:320 }}>
            {consultasHoje.length === 0 ? (
              <div style={{ padding:"32px 20px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:13, color:T.txS }}>Nenhuma consulta agendada para hoje</div>
              </div>
            ) : consultasHoje.map((c,i) => (
              <div key={c.id||i} style={{ padding:"12px 20px",
                borderBottom: i < consultasHoje.length-1 ? `1px solid ${T.br}` : "none",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.sur2}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
                    background:"linear-gradient(135deg,#1A5FA8,#3B9DE8)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontWeight:700, fontSize:12 }}>
                    {(c.pac||c.paciente||c.nome||"?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>
                      {c.pac||c.paciente||c.nome||"—"}
                    </div>
                    <div style={{ fontSize:11, color:T.txS }}>
                      {c.hora||c.horario||c.time||"—"} · {c.tipo||c.especialidade||"Consulta"}
                    </div>
                  </div>
                </div>
                <StatusBadge st={c.st||c.status||"Agendado"} />
              </div>
            ))}
          </div>
        </div>

        {/* Exames hoje */}
        <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16,
          boxShadow:"0 2px 12px rgba(13,33,55,.06)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${T.br}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:T.grB,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="exam" sz={16} c={T.gr} />
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.tx }}>Exames de hoje</div>
                <div style={{ fontSize:11, color:T.txS }}>{examesHoje.length} agendado{examesHoje.length!==1?"s":""}</div>
              </div>
            </div>
            <button onClick={()=>setPage("exames")}
              style={{ background:T.grB, color:T.gr, border:`1px solid ${T.grBr}`,
                borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:600,
                cursor:"pointer", fontFamily:"inherit" }}>Ver tudo</button>
          </div>
          <div style={{ overflowY:"auto", maxHeight:320 }}>
            {examesHoje.length === 0 ? (
              <div style={{ padding:"32px 20px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔬</div>
                <div style={{ fontSize:13, color:T.txS }}>Nenhum exame agendado para hoje</div>
              </div>
            ) : examesHoje.map((e,i) => (
              <div key={e.id||i} style={{ padding:"12px 20px",
                borderBottom: i < examesHoje.length-1 ? `1px solid ${T.br}` : "none",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                transition:"background .15s" }}
                onMouseEnter={el=>el.currentTarget.style.background=T.sur2}
                onMouseLeave={el=>el.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
                    background:"linear-gradient(135deg,#1A7A52,#28a86e)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontWeight:700, fontSize:12 }}>
                    {(e.pac||e.paciente||e.nome||"?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>
                      {e.pac||e.paciente||e.nome||"—"}
                    </div>
                    <div style={{ fontSize:11, color:T.txS }}>
                      {e.hora||e.horario||"—"} · {e.tipo||e.exame||"Exame"}
                    </div>
                  </div>
                </div>
                <StatusBadge st={e.st||e.status||"Agendado"} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Próximas consultas (7 dias) ── */}
      <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16,
        boxShadow:"0 2px 12px rgba(13,33,55,.06)" }}>
        <div style={{ padding:"16px 20px 12px", borderBottom:`1px solid ${T.br}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"#EEF2FF",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ic n="clock" sz={16} c="#4A3A8A" />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:T.tx }}>Próximos 7 dias</div>
              <div style={{ fontSize:11, color:T.txS }}>{proximas.length} consulta{proximas.length!==1?"s":""} agendada{proximas.length!==1?"s":""}</div>
            </div>
          </div>
        </div>
        {proximas.length === 0 ? (
          <div style={{ padding:"28px 20px", textAlign:"center" }}>
            <div style={{ fontSize:13, color:T.txS }}>Nenhuma consulta nos próximos 7 dias</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:0 }}>
            {proximas.map((c,i) => (
              <div key={c.id||i} style={{ padding:"12px 20px",
                borderRight: `1px solid ${T.br}`,
                borderBottom: `1px solid ${T.br}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.b,
                  textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>
                  {c.data ? new Date(c.data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"}) : "—"}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>
                  {c.pac||c.paciente||c.nome||"—"}
                </div>
                <div style={{ fontSize:11, color:T.txS, marginTop:2 }}>
                  {c.hora||"—"} · {c.tipo||"Consulta"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function PageHome({ setPage, usuario }) {
  // Lê dados reais do localStorage
  const patsReal = React.useMemo(() => {
    try { const r=safeLsGet("crm_pats_v26"); return Array.isArray(r)?r:[]; } catch { return []; }
  }, []);
  const consultasReal = React.useMemo(() => {
    try { const r=safeLsGet("crm_consultas_v26"); return Array.isArray(r)?r:[]; } catch { return []; }
  }, []);
  const examesReal = React.useMemo(() => {
    try { const r=safeLsGet("crm_exames_v26"); return Array.isArray(r)?r:[]; } catch { return []; }
  }, []);
  const consultas = consultasReal; // compatibilidade com gráficos abaixo

  // Consultas e exames nos próximos 30 dias
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em30 = new Date(hoje); em30.setDate(em30.getDate()+30);
  const consultasConfirmadas = consultasReal.filter(c => {
    try { const d=new Date(c.data||c.date||""); return d>=hoje && d<=em30; } catch{ return false; }
  }).length;
  const examesAgendados = examesReal.filter(e => {
    try { const d=new Date(e.data||e.date||""); return d>=hoje && d<=em30; } catch{ return false; }
  }).length;

  const [activeSeries, setActiveSeries] = useState(
    Object.fromEntries(SERIES_META.map(s => [s.key, true]))
  );
  const toggleSeries = k => setActiveSeries(p => ({ ...p, [k]: !p[k] }));

  const metrics = [
    { icon:"users",  label:"Pacientes",   val:String(patsReal.length),      trend:"", note:"cadastrados",   key:"pacientes", ac:"#A8722A", acBg:"#FDF3E3", pos:true },
    { icon:"cal",    label:"Consultas",   val:String(consultasReal.length),  trend:"", note:"agendadas",     key:"consultas", ac:"#2D7A4F", acBg:"#EDF7F1", pos:true },
    { icon:"exam",   label:"Exames",      val:String(examesReal.length),     trend:"", note:"registrados",   key:"exames",    ac:"#6D4E8A", acBg:"#F4EFF9", pos:true },
    { icon:"money",  label:"Financeiro",  val:"—",                           trend:"", note:"ver relatório", key:"financas",  ac:"#9A6A00", acBg:"#FFF8E6", pos:true },
  ];

  return (
    <div className="page" style={{ padding:"28px 28px 48px", display:"flex", flexDirection:"column", gap:22 }}>

      {/* Hero */}
      <div style={{ position:"relative", borderRadius:20, overflow:"hidden",
        background:"linear-gradient(130deg,#0a1929 0%,#0d2137 45%,#1A5FA8 100%)",
        padding:"32px 36px", boxShadow:"0 12px 40px rgba(28,17,8,.3)" }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:220, height:220,
          borderRadius:"50%", background:"rgba(255,255,255,.03)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-80, right:80, width:180, height:180,
          borderRadius:"50%", background:"rgba(168,114,42,.16)", pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.38)",
            letterSpacing:".14em", textTransform:"uppercase", marginBottom:8 }}>
            {(()=>{const d=new Date();const dias=["DOMINGO","SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO"];const meses=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];return `${dias[d.getDay()]} · ${d.getDate()} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`;})()}
          </div>
          <div style={{ fontSize:30, fontWeight:800, color:"#fff",
            letterSpacing:"-.03em", lineHeight:1.15, marginBottom:8 }}>
            Bom dia, Dra. Ilza 👋
          </div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,.48)", marginBottom:24, maxWidth:480 }}>
            {consultasConfirmadas===0&&examesAgendados===0
              ?<span style={{color:"rgba(255,255,255,.38)"}}>Nenhum agendamento nos próximos 30 dias.</span>
              :<>{consultasConfirmadas>0&&<><span style={{color:"#E8C07A",fontWeight:700}}>{consultasConfirmadas} consulta{consultasConfirmadas!==1?"s":""} confirmada{consultasConfirmadas!==1?"s":""}</span>{examesAgendados>0?" e ":""}</>}{examesAgendados>0&&<span style={{color:"#E8C07A",fontWeight:700}}>{examesAgendados} exame{examesAgendados!==1?"s":""} agendado{examesAgendados!==1?"s":""}</span>}{" "}nos próximos 30 dias.</>}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {[
              { label:"Ver agenda",    icon:"cal",   key:"consultas", solid:true  },
              { label:"Novo paciente", icon:"users", key:"pacientes", solid:false },
            ].map(a => (
              <button key={a.label} onClick={()=>setPage(a.key)}
                style={{ display:"inline-flex", alignItems:"center", gap:7,
                  padding:"9px 18px", borderRadius:10, cursor:"pointer",
                  fontSize:12, fontWeight:600, fontFamily:"'Outfit',sans-serif",
                  background:a.solid?"rgba(255,255,255,.14)":"rgba(255,255,255,.06)",
                  color:a.solid?"#fff":"rgba(255,255,255,.65)",
                  border:a.solid?"1px solid rgba(255,255,255,.22)":"1px solid rgba(255,255,255,.08)",
                  backdropFilter:"blur(10px)", transition:"all .18s" }}
                onMouseEnter={e=>e.currentTarget.style.background=a.solid?"rgba(255,255,255,.24)":"rgba(255,255,255,.12)"}
                onMouseLeave={e=>e.currentTarget.style.background=a.solid?"rgba(255,255,255,.14)":"rgba(255,255,255,.06)"}>
                <Ic n={a.icon} sz={13} c={a.solid?"#fff":"rgba(255,255,255,.65)"} />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {metrics.map(m => (
          <div key={m.key} onClick={()=>setPage(m.key)}
            style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16,
              padding:"20px 20px 16px", cursor:"pointer", transition:"all .22s",
              borderTop:`3px solid ${m.ac}` }}
            onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 14px 36px rgba(44,26,8,.12)"; e.currentTarget.style.transform="translateY(-3px)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:m.acBg,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n={m.icon} sz={19} c={m.ac} />
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:m.pos?T.gr:T.am,
                background:m.pos?T.grB:T.amB, padding:"2px 9px", borderRadius:99 }}>
                {m.pos?"↑":"→"} {m.trend}
              </span>
            </div>
            <div style={{ fontSize:28, fontWeight:800, color:T.tx, letterSpacing:"-.03em", lineHeight:1 }}>{m.val}</div>
            <div style={{ fontSize:12.5, fontWeight:500, color:T.txM, marginTop:5 }}>{m.label}</div>
            <div style={{ fontSize:11, color:T.txS, marginTop:2 }}>{m.note}</div>
          </div>
        ))}
      </div>

      {/* ── v29: LineChart 4 séries ─────────────────────────────────────── */}
      <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:18,
        padding:"22px 24px", boxShadow:"0 1px 4px rgba(44,26,8,.05)" }}>
        {/* cabeçalho */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
          marginBottom:18, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:30, height:30, borderRadius:9, background:T.bL,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="trend" sz={14} c={T.b} />
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:T.tx }}>Evolução mensal</div>
            </div>
            <div style={{ fontSize:11, color:T.txS, marginTop:4, paddingLeft:39 }}>
              Jan – Jun 2026 · clique nas séries para mostrar/ocultar
            </div>
          </div>
          {/* toggle pills */}
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            {SERIES_META.map(s => (
              <button key={s.key} onClick={()=>toggleSeries(s.key)}
                style={{ display:"inline-flex", alignItems:"center", gap:6,
                  padding:"5px 14px", borderRadius:99, border:"none",
                  background:activeSeries[s.key] ? s.color : T.sur2,
                  color:activeSeries[s.key] ? "#fff" : T.txM,
                  fontWeight:600, fontSize:11, fontFamily:"inherit",
                  cursor:"pointer", transition:"all .16s",
                  boxShadow:activeSeries[s.key] ? `0 3px 10px ${s.color}44` : "none",
                  opacity:activeSeries[s.key] ? 1 : .55 }}>
                <span style={{ width:6, height:6, borderRadius:"50%",
                  background:activeSeries[s.key] ? "#fff" : s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={getMockMensal()} margin={{ top:8, right:16, left:-10, bottom:0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={T.br} vertical={false} />
            <XAxis dataKey="mes"
              tick={{ fontSize:11, fill:T.txS, fontFamily:"Outfit" }}
              axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize:10, fill:T.txS, fontFamily:"Outfit" }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
            <Tooltip content={<ChartTooltip />} />
            {SERIES_META.map(s => activeSeries[s.key] && (
              <Line key={s.key} type="monotone" dataKey={s.key}
                stroke={s.color} strokeWidth={2.5}
                dot={{ r:4, fill:s.color, stroke:T.sur, strokeWidth:2 }}
                activeDot={{ r:6, fill:s.color, stroke:T.sur, strokeWidth:2.5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* legenda inferior */}
        <div style={{ display:"flex", justifyContent:"center", gap:22,
          marginTop:14, paddingTop:14, borderTop:`1px solid ${T.br}`, flexWrap:"wrap" }}>
          {SERIES_META.map(s => (
            <div key={s.key} style={{ display:"flex", alignItems:"center", gap:7,
              opacity:activeSeries[s.key] ? 1 : .35, transition:"opacity .15s" }}>
              <div style={{ width:26, height:3, borderRadius:99, background:s.color }} />
              <span style={{ fontSize:11, color:T.txM, fontWeight:500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agenda + Quick actions */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr .55fr", gap:14 }}>
        {/* Próximas consultas — SEM avatar */}
        <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"16px 22px", borderBottom:`1px solid ${T.br}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:30, height:30, borderRadius:9, background:T.bL,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="cal" sz={14} c={T.b} />
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:T.tx }}>Próximas consultas</span>
            </div>
            <button onClick={()=>setPage("consultas")} style={{ background:"none", border:"none",
              cursor:"pointer", fontSize:12, color:T.b, fontWeight:600,
              display:"flex", alignItems:"center", gap:3 }}>
              Ver todas <Ic n="chevR" sz={12} c={T.b} />
            </button>
          </div>
          {consultas.map((c,i) => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:14,
              padding:"12px 22px", borderBottom:i<consultas.length-1?`1px solid ${T.br}`:"none",
              transition:"background .12s", cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.sur2}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {/* ícone de modalidade — sem avatar */}
              <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
                background:c.tipo==="Teleconsulta"?T.grB:T.bL,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n={c.tipo==="Teleconsulta"?"video":"users"} sz={15}
                  c={c.tipo==="Teleconsulta"?T.gr:T.b} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:T.tx,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.pac}</div>
                <div style={{ fontSize:11, color:T.txM, marginTop:1 }}>{c.proc} · {c.hr}</div>
              </div>
              {stBadge(c.st)}
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ background:T.sur, border:`1px solid ${T.br}`, borderRadius:16, padding:"20px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.tx, marginBottom:14 }}>Ações rápidas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[
              { icon:"users", label:"Novo paciente",    key:"pacientes", c:T.b,  bg:T.bL  },
              { icon:"cal",   label:"Agendar consulta", key:"consultas", c:T.gr, bg:T.grB },
              { icon:"exam",  label:"Solicitar exame",  key:"exames",    c:T.pu, bg:T.puB },
              { icon:"money", label:"Ver financeiro",   key:"financas",  c:T.am, bg:T.amB },
            ].map(a => (
              <button key={a.key} onClick={()=>setPage(a.key)}
                style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 12px",
                  borderRadius:11, border:`1px solid ${T.br}`, background:T.sur,
                  cursor:"pointer", transition:"all .15s", textAlign:"left" }}
                onMouseEnter={e=>{ e.currentTarget.style.background=a.bg; e.currentTarget.style.borderColor=a.c+"44"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background=T.sur; e.currentTarget.style.borderColor=T.br; }}>
                <div style={{ width:32, height:32, borderRadius:9, background:a.bg,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ic n={a.icon} sz={14} c={a.c} />
                </div>
                <span style={{ fontSize:12.5, fontWeight:600, color:T.tx, flex:1 }}>{a.label}</span>
                <Ic n="chevR" sz={12} c={T.txS} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Indicador de progresso sequencial ───────────────────────────────────────

// ─── Componentes auxiliares da Telemedicina ───────────────────────────────────
function TeleAvatar({ iniciais, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#1A5FA8,#3B9DE8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "#fff", letterSpacing: ".03em"
    }}>
      {iniciais || "?"}
    </div>
  );
}

function TeleBtn({ onClick, color, style = {}, children, disabled = false }) {
  const bg = color || T.b;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 16px", borderRadius: 9, border: "none",
        background: disabled ? "#ccc" : bg, color: "#fff",
        fontWeight: 700, fontSize: 13, cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit", transition: "opacity .15s", flexShrink: 0,
        ...style
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = ".82"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
    >
      {children}
    </button>
  );
}

function TeleBadge({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "linear-gradient(135deg,#C8972A,#E8C070)",
      color: "#fff", fontSize: 10, fontWeight: 700,
      padding: "2px 7px", borderRadius: 99, letterSpacing: ".04em"
    }}>
      ★ {children}
    </span>
  );
}

function SalaEspera({ onIniciar }) {
  const [fila, setFila] = useState([]);
  const DB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com";

  useEffect(()=>{
    let active = true;
    async function poll() {
      try {
        const r = await fetch(`${DB_URL}/salas_index.json`);
        const data = await r.json();
        if(!active || !data) { setFila([]); return; }
        const lista = Object.entries(data)
          .map(([id,info])=>({ id, ...info }))
          .filter(p=>p.status==="aguardando"||p.status==="atendendo")
          .sort((a,b)=>(a.entrou||0)-(b.entrou||0));
        setFila(lista);
      } catch(e) { /* silencioso */ }
    }
    poll();
    const t = setInterval(poll, 4000);
    return ()=>{ active=false; clearInterval(t); };
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Pacientes aguardando</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#8a6a32", background: "#fff3cd", padding: "4px 10px", borderRadius: 8, border: `0.5px solid ${"#e8d5b0"}` }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, display: "inline-block", animation: "pulse 1.5s infinite" }} />
          {fila.filter(p=>p.status==="aguardando").length} na fila · {fila.filter(p=>p.status==="atendendo").length} em atendimento
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fila.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 20px", color:"#888" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🕐</div>
            <div style={{ fontSize:13 }}>Nenhum paciente aguardando no momento</div>
            <div style={{ fontSize:11, marginTop:4, color:"#aaa" }}>Atualiza automaticamente a cada 4 segundos</div>
          </div>
        )}
        {fila.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white",
            border: `0.5px solid #e0d8cc`, borderLeft: p.plano === "Premium" ? `3px solid ${C.gold}` : p.status==="atendendo"?"3px solid #2D7A4F":"0.5px solid #e0d8cc",
            borderRadius: 12, padding: "12px 14px" }}>
            <TeleAvatar iniciais={(p.nm||p.nome||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nm||p.nome||p.id}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2, display:"flex", gap:8, alignItems:"center" }}>
                <span>{p.ultimaTxt ? `"${p.ultimaTxt.replace("←","").trim()}"` : "Aguardando..."}</span>
                {p.plano==="Premium" && <TeleBadge>Premium</TeleBadge>}
                {p.status==="atendendo" && <span style={{color:"#2D7A4F",fontWeight:600}}>● Em atendimento</span>}
              </div>
            </div>
            <TeleBtn onClick={() => onIniciar({...p, nome:p.nm||p.nome||p.id})}
              color={p.status==="atendendo"?C.green:C.gold}
              style={{ fontSize: 12, padding: "6px 12px" }}>
              {p.status==="atendendo"?"Continuar":"Iniciar"}
            </TeleBtn>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f0e8", borderRadius: 12, fontSize: 13, color: "#2C1F14" }}>
        <strong>Link da sala de espera pública:</strong>
        <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12, color: "#8a6a32", wordBreak: "break-all" }}>
          https://sala-virtual-ecru.vercel.app
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>Pacientes entram por este link e aguardam até a médica iniciar a consulta.</div>
      </div>
    </div>
  );
}

function Videoconsulta({ paciente, onEncerrar }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [anotacao, setAnotacao] = useState("");
  const [duracao, setDuracao] = useState(0);
  const [showReceita, setShowReceita] = useState(false);
  const [showAtestado, setShowAtestado] = useState(false);
  const [receitaData, setReceitaData] = useState({ medicamento: "", posologia: "", dias: "30" });
  const [atestadoDias, setAtestadoDias] = useState("1");
  const [receitaGerada, setReceitaGerada] = useState(null);
  const [atestadoGerado, setAtestadoGerado] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setDuracao(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Impede fechar/navegar durante teleconsulta ativa
  useEffect(() => {
    const handler = e => {
      e.preventDefault();
      e.returnValue = "Há uma teleconsulta em andamento. Tem certeza que deseja sair?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const hoje = new Date().toLocaleDateString("pt-BR");
  // useRef garante que o nome da sala nao muda entre re-renders (evita piscar)
  const roomRef = useRef(null);
  if(!roomRef.current){
    const slug = (paciente?.iniciais||"consulta").toLowerCase().replace(/[^a-z0-9]/g,"-");
    roomRef.current = "ilza-" + slug + "-" + Math.random().toString(36).slice(2,8);
  }
  const roomName = roomRef.current;

  const gerarReceita = () => {
    setReceitaGerada({ ...receitaData, paciente: paciente?.nome, data: hoje, crm: "SP 157236" });
    setShowReceita(false);
  };
  const gerarAtestado = () => {
    setAtestadoGerado({ dias: atestadoDias, paciente: paciente?.nome, data: hoje, crm: "SP 157236" });
    setShowAtestado(false);
  };

  if (!paciente) return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#aaa" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📹</div>
      <div style={{ fontSize: 14 }}>Nenhuma consulta ativa.<br />Inicie uma consulta pela Sala de Espera.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <TeleAvatar iniciais={paciente.iniciais} size={32} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{paciente.nome}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{paciente.motivo}</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 18, fontWeight: 500, color: C.green }}>
          {fmt(duracao)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>

        {/* Jitsi iframe */}
        <div>
          <div style={{ background: "#111", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", position: "relative" }}>
            <iframe
              ref={iframeRef}
              src={`https://meet.jit.si/${roomName}#config.startWithAudioMuted=${!micOn}&config.startWithVideoMuted=${!camOn}&config.prejoinPageEnabled=false&config.toolbarButtons=["microphone","camera","hangup"]&userInfo.displayName=Dra.%20Ilza%20Ezequiel`}
              style={{ width: "100%", height: "100%", border: "none", minHeight: 240 }}
              allow="camera; microphone; fullscreen; display-capture"
              title="Videoconsulta"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <button onClick={() => setMicOn(x => !x)} title="Microfone" style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${micOn ? "#ccc" : C.red}`, background: micOn ? "white" : "#fdecea", cursor: "pointer", fontSize: 14 }}>
              {micOn ? "🎤" : "🔇"}
            </button>
            <button onClick={() => setCamOn(x => !x)} title="Câmera" style={{ width: 36, height: 36, borderRadius: "50%", border: `0.5px solid ${camOn ? "#ccc" : C.red}`, background: camOn ? "white" : "#fdecea", cursor: "pointer", fontSize: 14 }}>
              {camOn ? "📷" : "📷"}
            </button>
            <button onClick={() => setShowReceita(true)} title="Receita" style={{ padding: "0 12px", height: 36, borderRadius: 8, border: `0.5px solid ${C.gold}`, background: "white", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              + Receita
            </button>
            <button onClick={() => setShowAtestado(true)} title="Atestado" style={{ padding: "0 12px", height: 36, borderRadius: 8, border: `0.5px solid ${C.green}`, background: "white", color: C.green, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              + Atestado
            </button>
            <button onClick={onEncerrar} style={{ padding: "0 16px", height: 36, borderRadius: 8, background: C.red, border: "none", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              Encerrar
            </button>
          </div>
        </div>

        {/* Prontuário lateral */}
        <div style={{ background: "white", border: "0.5px solid #e0d8cc", borderRadius: 12, display: "flex", flexDirection: "column", maxHeight: 380, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #e0d8cc", fontSize: 13, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Prontuário
            <span style={{ fontSize: 11, color: C.green }}>● aberto</span>
          </div>
          <div style={{ overflowY: "auto", padding: "12px 14px", flex: 1 }}>
            {[
              ["Diagnósticos", paciente.diagnosticos?.join(", ") || "—"],
              ["Medicações", paciente.medicacoes?.join(", ") || "—"],
              ["Último exame", paciente.ultimoExame || "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{val}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Anotações</div>
              <textarea
                value={anotacao}
                onChange={e => setAnotacao(e.target.value)}
                placeholder="Observações da consulta..."
                style={{ width: "100%", padding: "6px 8px", border: "0.5px solid #ddd", borderRadius: 8, fontSize: 12, resize: "none", height: 80, fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Receita e Atestado gerados */}
      {(receitaGerada || atestadoGerado) && (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          {receitaGerada && (
            <div style={{ flex: 1, background: "#fff9f0", border: `0.5px solid ${"#e8d5b0"}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: "#8a6a32", marginBottom: 6 }}>📄 Receita gerada — {receitaGerada.data}</div>
              <div><strong>Paciente:</strong> {receitaGerada.paciente}</div>
              <div><strong>Medicamento:</strong> {receitaGerada.medicamento}</div>
              <div><strong>Posologia:</strong> {receitaGerada.posologia} · {receitaGerada.dias} dias</div>
              <div><strong>CRM:</strong> {receitaGerada.crm}</div>
              <button style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", background: C.gold, color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
                Baixar PDF
              </button>
            </div>
          )}
          {atestadoGerado && (
            <div style={{ flex: 1, background: "#f0f7ee", border: `0.5px solid ${C.greenLight}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: C.green, marginBottom: 6 }}>📋 Atestado gerado — {atestadoGerado.data}</div>
              <div><strong>Paciente:</strong> {atestadoGerado.paciente}</div>
              <div><strong>Afastamento:</strong> {atestadoGerado.dias} dia(s)</div>
              <div><strong>CRM:</strong> {atestadoGerado.crm}</div>
              <button style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", background: C.green, color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
                Baixar PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Receita */}
      {showReceita && (
        <Modal onClose={() => setShowReceita(false)} title="Nova receita">
          <TeleField label="Medicamento" value={receitaData.medicamento} onChange={v => setReceitaData(d => ({ ...d, medicamento: v }))} placeholder="Ex: Omeprazol 20mg" />
          <TeleField label="Posologia" value={receitaData.posologia} onChange={v => setReceitaData(d => ({ ...d, posologia: v }))} placeholder="Ex: 1 comprimido em jejum" />
          <TeleField label="Duração (dias)" value={receitaData.dias} onChange={v => setReceitaData(d => ({ ...d, dias: v }))} placeholder="30" />
          <TeleBtn onClick={gerarReceita} style={{ width: "100%", marginTop: 12 }}>Gerar receita</TeleBtn>
        </Modal>
      )}

      {/* Modal Atestado */}
      {showAtestado && (
        <Modal onClose={() => setShowAtestado(false)} title="Atestado médico">
          <TeleField label="Dias de afastamento" value={atestadoDias} onChange={setAtestadoDias} placeholder="1" />
          <TeleBtn onClick={gerarAtestado} color={C.green} style={{ width: "100%", marginTop: 12 }}>Gerar atestado</TeleBtn>
        </Modal>
      )}
    </div>
  );
}

// ─── Horários disponíveis para telemedicina ───────────────────────────────────
const HORARIOS = [
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30",
];
const OCUPADOS = ["09:00","14:00","15:30"];

function Agendamento() {
  const [nome, setNome] = useState("");
  const [motivo, setMotivo] = useState("Retorno");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("30");
  const [horario, setHorario] = useState(null);
  const [canal, setCanal] = useState("whatsapp");
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const slug = nome.trim().replace(/\s+/g,"-").toLowerCase().replace(/[^a-z0-9-]/g,"") || "paciente";
  const linkSala = `https://meet.jit.si/DrIlzaEzequiel-${slug}-${data||"consulta"}`.replace(/\s/g,"");
  const telefone = "5513"; // prefixo - numero completo deve vir do cadastro
  const mensagemWA = "Ola! Sua teleconsulta com a Dra. Ilza Ezequiel esta confirmada.\n\n"
    + "Data: " + (data||"a definir") + "\nHorario: " + (horario||"a definir")
    + "\n\nAcesse pelo link:\n" + linkSala
    + "\n\nDuvidas? Responda esta mensagem.";

  const enviarWhatsApp = () => {
    const msg = encodeURIComponent(mensagemWA);
    window.open("https://api.whatsapp.com/send?text=" + msg, "_blank");
  };

  const confirmar = () => {
    if (!nome || !horario) { alert("Preencha o nome e selecione o horario."); return; }
    setEnviando(true);
    setTimeout(() => {
      // Salva em consultas (crm_consultas_v26) para aparecer na lista
      try {
        const key = "crm_consultas_v26";
        const prev = JSON.parse(localStorage.getItem(key)||"[]");
        const nova = {
          id: "c"+Date.now(), pac: nome, dt: data, hr: horario,
          tipo: "Teleconsulta", mod: "Teleconsulta",
          proc: motivo, st: "Confirmado",
          obs: "Link: " + linkSala
        };
        localStorage.setItem(key, JSON.stringify([...prev, nova].sort((a,b)=>a.dt>b.dt?1:-1)));
        // Dispara evento para sincronizar state em tempo real
        window.dispatchEvent(new CustomEvent("crm_consulta_nova", {detail: nova}));
      } catch(e) { console.warn("Erro ao salvar teleconsulta:", e); }

      // Email automático de teleconsulta via EmailJS
      EJS.confirmarTeleconsulta({ pac:nome, dt:data, hr:horario, motivo, link:linkSala });

      setEnviando(false);
      setConfirmado(true);
    }, 900);
  };

  if (confirmado) return (
    <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Teleconsulta agendada!</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>{nome} · {data} às {horario}</div>
      <div style={{ background: "#f5f0e8", borderRadius: 10, padding: "12px 16px", textAlign: "left", fontSize: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Link enviado via {canal === "whatsapp" ? "WhatsApp" : "e-mail"}:</div>
        <div style={{ fontFamily: "monospace", color: "#8a6a32", wordBreak: "break-all" }}>{linkSala}</div>
      </div>
      <TeleBtn onClick={() => { setConfirmado(false); setNome(""); setHorario(null); setData(""); }}>
        Novo agendamento
      </TeleBtn>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <TeleField label="Paciente" value={nome} onChange={setNome} placeholder="Nome completo..." />
        <div>
          <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 }}>Motivo</div>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "0.5px solid #ccc", borderRadius: 8, fontSize: 13 }}>
            {["Retorno", "1ª consulta", "Resultado de exame", "Urgência"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 }}>Data</div>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "0.5px solid #ccc", borderRadius: 8, fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 }}>Duração</div>
          <select value={duracao} onChange={e => setDuracao(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "0.5px solid #ccc", borderRadius: 8, fontSize: 13 }}>
            {["20", "30", "45", "60"].map(d => <option key={d}>{d} minutos</option>)}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 8 }}>Horário disponível</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
        {HORARIOS.map(h => {
          const ocupado = OCUPADOS.includes(h);
          const sel = horario === h;
          return (
            <button key={h} disabled={ocupado} onClick={() => setHorario(h)}
              style={{ padding: "7px 4px", textAlign: "center", fontSize: 12, border: `0.5px solid ${sel ? C.gold : "#ddd"}`, borderRadius: 8, cursor: ocupado ? "default" : "pointer", background: sel ? C.gold : ocupado ? "#f5f5f5" : "white", color: sel ? "white" : ocupado ? "#ccc" : "#555", fontWeight: sel ? 500 : 400 }}>
              {h}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 8 }}>Enviar link via</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["whatsapp", "WhatsApp"], ["email", "E-mail"], ["ambos", "Ambos"]].map(([v, label]) => (
          <button key={v} onClick={() => setCanal(v)} style={{ flex: 1, padding: "8px", border: `0.5px solid ${canal === v ? C.gold : "#ddd"}`, borderRadius: 8, background: canal === v ? "#fff9f0" : "white", color: canal === v ? "#8a6a32" : "#666", fontSize: 12, fontWeight: canal === v ? 500 : 400, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {nome && horario && (
        <div style={{ background: "#f5f0e8", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 4, color: "#2C1F14" }}>Prévia da mensagem</div>
          <div style={{ whiteSpace: "pre-line", color: "#555", lineHeight: 1.6 }}>{mensagemWA}</div>
        </div>
      )}

      <div style={{display:"flex", gap:8, marginTop:4}}>
        <button onClick={confirmar} disabled={enviando||!nome||!horario}
          style={{ flex:1, padding:"11px 0", background:(enviando||!nome||!horario)?"#ccc":C.gold,
            color:"white", border:"none", borderRadius:8, fontSize:13, fontWeight:600,
            cursor:(enviando||!nome||!horario)?"default":"pointer" }}>
          {enviando ? "Confirmando..." : "Confirmar agendamento"}
        </button>
        <button onClick={enviarWhatsApp} disabled={!nome||!horario}
          title="Abrir WhatsApp com mensagem pronta"
          style={{ padding:"11px 14px", background:(!nome||!horario)?"#ccc":"#25d366",
            color:"white", border:"none", borderRadius:8, fontSize:13, fontWeight:600,
            cursor:(!nome||!horario)?"default":"pointer" }}>
          Enviar link WhatsApp
        </button>
      </div>
    </div>
  );
}

function TeleField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", border: "0.5px solid #ccc", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
    </div>
  );
}

// TeleModal: usa o Modal global do CRM

function PageTelemedicina({usuario}) {
  const [aba, setAba] = useState("espera");
  const [consultaAtiva, setConsultaAtiva] = useState(null);

  const iniciarConsulta = (paciente) => {
    setConsultaAtiva(paciente);
    setAba("video");
  };
  const encerrarConsulta = () => {
    setConsultaAtiva(null);
    setAba("espera");
  };

  const abas = [
    { id: "espera", label: "Sala de espera" },
    { id: "video", label: consultaAtiva ? `Em consulta · ${consultaAtiva.iniciais}` : "Videoconsulta" },
    { id: "agenda", label: "Agendar" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', serif", maxWidth: 900, padding: "0.5rem 0",
      height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
        textarea, input, select { font-family: inherit; color: #2C1F14; background: white; }
        textarea:focus, input:focus, select:focus { outline: none; border-color: #B8924A !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e0d8cc; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: `0.5px solid #e0d8cc` }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f5f0e8", border: `1.5px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📹</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#2C1F14" }}>Telemedicina</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>Dra. Ilza Ezequiel · Gastroenterologia · CRM SP 157236</div>
        </div>
        {consultaAtiva && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.green, fontWeight: 500 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
            Consulta ativa
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `0.5px solid #e0d8cc` }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: aba === a.id ? 500 : 400, color: aba === a.id ? C.gold : "#888", border: "none", background: "none", cursor: "pointer", borderBottom: aba === a.id ? `2px solid ${C.gold}` : "2px solid transparent", marginBottom: -1 }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteudo com scroll */}
      <div style={{flex:1, overflowY:"auto", paddingBottom:20}}>
        {aba === "espera" && <SalaEspera onIniciar={iniciarConsulta} />}
        {aba === "video" && <Videoconsulta paciente={consultaAtiva} onEncerrar={encerrarConsulta} />}
        {aba === "agenda" && <Agendamento />}
      </div>
    </div>
  );
}

const NAV=[
  {key:"home",        icon:"⊞",  label:"Início"},
  {key:"whatsapp",    icon:"💬",  label:"WhatsApp"},
  {key:"instagram",   icon:"📸",  label:"Instagram"},
  {key:"tiktok",      icon:"🎵",  label:"TikTok"},
  {key:"pacientes",   icon:"👥",  label:"Pacientes"},
  {key:"exames",      icon:"🔬",  label:"Exames"},
  {key:"agenda",      icon:"📅",  label:"Consultas"},
  {key:"telemedicina",icon:"📹",  label:"Telemedicina"},
  {key:"financas",    icon:"💰",  label:"Financeiro"},
  {key:"estoque",     icon:"📦",  label:"Estoque"},
  {key:"marketing",   icon:"📣",  label:"Marketing"},
  {key:"admin",       icon:"🛡️", label:"Admin — Segurança"},
  {key:"perfil",      icon:"👤",  label:"Perfil"},
];


// ─── PAGE: SALA VIRTUAL ───────────────────────────────────────────────────────
const SALA_MSGS_INIT = {};

function PageSalaVirtual({ pats }) {
  // ── Estado ──
  const [portalPacs, setPortalPacs] = useState({});
  const [msgs, setMsgs]             = useState([]);
  const [selPac, setSelPac]         = useState(null);
  const [texto, setTexto]           = useState("");
  const [busca, setBusca]           = useState("");
  const [view, setView]             = useState("sala"); // "sala" | "chat"
  const [confirmEnc, setConfirmEnc] = useState(false);
  const [msgEnc, setMsgEnc]         = useState("Obrigada pela confiança! Atendimento encerrado. Cuide-se! 🌿");
  const [anexo, setAnexo]           = useState(null);   // { name, dataUrl }
  const [enviando, setEnviando]     = useState(false);
  const bottomRef = useRef();
  const inputRef  = useRef();
  const fileRef   = useRef();

  const DB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com";

  // ── Ler arquivo e converter para base64 ──
  function lerArquivo(file) {
    return new Promise((res, rej) => {
      if (file.size > 3 * 1024 * 1024) { rej(new Error("Arquivo maior que 3MB")); return; }
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  async function onAnexoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await lerArquivo(file);
      setAnexo({ name: file.name, dataUrl });
    } catch(err) {
      alert(err.message || "Erro ao ler arquivo");
    }
    e.target.value = "";
  }

  function getFileIcon(name="") {
    const ext = name.split(".").pop().toLowerCase();
    if (ext==="pdf") return "📕";
    if (["doc","docx"].includes(ext)) return "📘";
    if (["xls","xlsx"].includes(ext)) return "📗";
    if (["png","jpg","jpeg","gif","webp"].includes(ext)) return "🖼️";
    return "📎";
  }

  // ── Download de arquivo base64 ──
  function downloadBase64(dataUrl, fileName) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName || "arquivo";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Polling REST API /salas_index (a cada 5s) ──
  useEffect(()=>{
    let active = true;
    async function poll() {
      try {
        const r = await fetch(`${DB_URL}/salas_index.json`);
        const data = await r.json();
        if(active) setPortalPacs(data || {});
      } catch(e) { console.warn("[Sala] poll salas_index:", e); }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // ── Polling REST API mensagens do paciente selecionado (a cada 3s) ──
  useEffect(()=>{
    if(!selPac) { setMsgs([]); return; }
    let active = true;
    async function pollMsgs() {
      try {
        const r = await fetch(`${DB_URL}/salas/${selPac.id}/msgs.json`);
        const val = await r.json();
        if(!active) return;
        const lista = val
          ? Object.entries(val).map(([k,v])=>({id:k,...v})).sort((a,b)=>(a.tsNum||0)-(b.tsNum||0))
          : [];
        setMsgs(lista);
      } catch(e) { console.warn("[Sala] poll msgs:", e); }
    }
    pollMsgs();
    const id = setInterval(pollMsgs, 3000);
    return () => { active = false; clearInterval(id); };
  }, [selPac]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs]);

  // ── Pacientes do Portal apenas ──
  const allPacientes = useMemo(() => {
    return Object.entries(portalPacs).map(([id, info]) => ({
      id,
      nm:        info.nm    || id,
      plano:     info.plano || "Portal",
      premium:   !!info.premium,
      iniciais:  info.iniciais || (info.nm||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase(),
      status:    info.status || "aguardando",
      ultimaTxt: info.ultimaTxt || "",
      ultimaTs:  info.ultimaTs  || "",
      tsNum:     info.tsNum || 0,
    }));
  }, [portalPacs]);

  const aguardando = allPacientes.filter(p => p.status === "aguardando");
  const atendendo  = allPacientes.filter(p => p.status === "atendendo");
  const filtrados  = aguardando.filter(p => p.nm.toLowerCase().includes(busca.toLowerCase()));

  function naoLidas(pac) {
    return msgs.filter(m => m.de === "pac" && !m.lida && selPac?.id === pac.id).length;
  }

  async function atender(pac) {
    await fetch(`${DB_URL}/salas_index/${pac.id}/status.json`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify("atendendo")
    });
    setSelPac(pac);
    setView("chat");
  }

  function voltarSala() {
    setView("sala");
    setSelPac(null);
    setMsgs([]);
  }

  async function enviar() {
    const txt = texto.trim();
    if (!txt && !anexo) return;
    if (!selPac) return;
    setEnviando(true);
    try {
      const ts = new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
      const msgKey = "m" + Date.now();
      const payload = {
        txt: txt || "",
        de: "dra",
        nome: "Equipe Dra. Ilza",
        ts, tsNum: Date.now(), lida: true
      };
      if (anexo) {
        payload.fileName = anexo.name;
        payload.fileUrl  = anexo.dataUrl;  // base64 data URI
      }
      await fetch(`${DB_URL}/salas/${selPac.id}/msgs/${msgKey}.json`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const preview = anexo ? `← 📎 ${anexo.name}` : `← ${txt.substring(0,50)}`;
      await fetch(`${DB_URL}/salas_index/${selPac.id}/ultimaTxt.json`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(preview)
      });
      setTexto("");
      setAnexo(null);
      setTimeout(()=>inputRef.current?.focus(), 50);
    } catch(err) {
      console.error("[Sala] enviar:", err);
    } finally {
      setEnviando(false);
    }
  }

  function onKey(e) { if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }

  async function encerrar() {
    if(!selPac) return;
    const ts = new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    if(msgEnc.trim()) {
      const msgKey = "m" + Date.now();
      await fetch(`${DB_URL}/salas/${selPac.id}/msgs/${msgKey}.json`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ txt:msgEnc.trim(), de:"dra", nome:"Equipe Dra. Ilza", ts, tsNum:Date.now(), lida:true })
      });
    }
    // Remove da fila
    setTimeout(async()=>{
      await fetch(`${DB_URL}/salas_index/${selPac.id}.json`, { method:"DELETE" });
    }, 800);
    setConfirmEnc(false);
    voltarSala();
  }

  // ────────────────────────────────────
  // RENDER: visão SALA (fila)
  // ────────────────────────────────────
  if(view === "sala") return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"20px 24px 14px", borderBottom:`1px solid ${T.br}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:T.sur }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:T.tx }}>Sala Virtual</div>
          <div style={{ fontSize:11, color:FB_CONFIGURED?T.gr:T.am, fontWeight:600,
            display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
            <span style={{ width:6, height:6, borderRadius:"50%",
              background:FB_CONFIGURED?T.gr:T.am, display:"inline-block" }}/>
            {FB_CONFIGURED ? "Sincronizando com Portal em tempo real" : "Firebase não configurado"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {aguardando.length > 0 && (
            <span style={{ background:T.re, color:"#fff", borderRadius:99,
              padding:"3px 12px", fontSize:11, fontWeight:800 }}>
              {aguardando.length} aguardando
            </span>
          )}
          {atendendo.length > 0 && (
            <span style={{ background:T.gr, color:"#fff", borderRadius:99,
              padding:"3px 12px", fontSize:11, fontWeight:800 }}>
              {atendendo.length} em atendimento
            </span>
          )}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 24px", display:"flex", flexDirection:"column", gap:12 }}>

        {/* Em atendimento */}
        {atendendo.length > 0 && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:T.gr, textTransform:"uppercase",
              letterSpacing:".08em", marginBottom:8 }}>● Em atendimento</div>
            {atendendo.map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                background:T.sur, border:`1px solid ${T.br}`, borderRadius:12, marginBottom:8 }}>
                <div style={{ width:38, height:38, borderRadius:50, background:p.premium?T.bL:"#f0f0f0",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:700, fontSize:13, color:p.premium?T.b:"#888", flexShrink:0 }}>
                  {p.iniciais}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>{p.nm}
                    {p.premium && <span style={{ marginLeft:6, fontSize:10, color:T.b, fontWeight:700 }}>★ Premium</span>}
                  </div>
                  <div style={{ fontSize:11, color:T.gr }}>● Em atendimento · {p.plano}</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>atender(p)}
                    style={{ padding:"7px 14px", borderRadius:9, border:`1px solid ${T.b}`, background:T.bL,
                      color:T.b, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    💬 Chat
                  </button>
                  <button onClick={()=>{ setSelPac(p); setConfirmEnc(true); }}
                    style={{ padding:"7px 14px", borderRadius:9, border:`1px solid ${T.re}`, background:T.reB,
                      color:T.re, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    ✕ Encerrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fila de espera */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:T.txS, textTransform:"uppercase",
            letterSpacing:".08em", marginBottom:8 }}>Aguardando atendimento</div>

          <div style={{ position:"relative", marginBottom:10 }}>
            <div style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }}>
              <Ic n="search" sz={14} c={T.txS}/>
            </div>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar na fila..."
              style={{ ...inp, paddingLeft:34, fontSize:12 }}/>
          </div>

          {filtrados.length === 0 ? (
            <div style={{ padding:"52px 20px", textAlign:"center", color:T.txS }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🚪</div>
              <div style={{ fontSize:14, fontWeight:600, color:T.txM }}>Sala vazia</div>
              <div style={{ fontSize:12, marginTop:6 }}>Nenhum paciente aguardando no Portal</div>
            </div>
          ) : (
            filtrados.map((p, i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                background:T.sur, border:`1px solid ${T.br}`, borderRadius:12, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:50, background:T.bL,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:700, fontSize:11, color:T.b, flexShrink:0 }}>
                  {i+1}
                </div>
                <div style={{ width:36, height:36, borderRadius:50, background:p.premium?T.bL:"#f0f0f0",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:700, fontSize:13, color:p.premium?T.b:"#888", flexShrink:0 }}>
                  {p.iniciais}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.tx }}>{p.nm}
                    {p.premium && <span style={{ marginLeft:6, fontSize:10, color:T.b, fontWeight:700 }}>★</span>}
                  </div>
                  <div style={{ fontSize:11, color:T.txS }}>
                    {p.ultimaTxt ? `"${p.ultimaTxt.substring(0,40)}"` : "Aguardando..."} · {p.ultimaTs}
                  </div>
                </div>
                <button onClick={()=>atender(p)}
                  style={{ padding:"8px 16px", borderRadius:9, border:"none",
                    background:`linear-gradient(135deg,#A8722A,#7A5018)`, color:"#fff",
                    fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  Atender →
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ────────────────────────────────────
  // RENDER: visão CHAT
  // ────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* Header chat */}
      <div style={{ padding:"12px 20px", borderBottom:`1px solid ${T.br}`, background:T.bL,
        display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button onClick={voltarSala}
          style={{ width:32, height:32, borderRadius:50, background:T.sur, border:`1px solid ${T.br}`,
            color:T.b, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
          ←
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:T.txM }}>
            💬 Respondendo como <strong>Equipe Dra. Ilza</strong>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:T.tx }}>
            {selPac?.premium && "★ "}{selPac?.nm}
          </div>
        </div>
        <button onClick={()=>setConfirmEnc(true)}
          style={{ padding:"6px 14px", borderRadius:20, background:T.reB, border:`1px solid ${T.re}`,
            color:T.re, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:5 }}>
          ✕ Encerrar
        </button>
      </div>

      {/* Mensagens */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", background:T.bg,
        display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:T.txS }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.txM }}>Nenhuma mensagem ainda</div>
            <div style={{ fontSize:11, marginTop:6 }}>Inicie a conversa com {selPac?.nm.split(" ")[0]}</div>
          </div>
        )}
        {msgs.map(m => {
          const isDra = m.de === "dra";
          const isImg = m.fileUrl && (m.fileUrl.startsWith("data:image") || /\.(png|jpg|jpeg|gif|webp)$/i.test(m.fileName||""));
          const isPdf = m.fileUrl && (m.fileUrl.startsWith("data:application/pdf") || /\.pdf$/i.test(m.fileName||""));
          const hasFile = !!(m.fileUrl || m.fileName);
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:isDra?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"76%" }}>
                {!isDra && (
                  <div style={{ fontSize:10, color:T.txS, marginBottom:3, paddingLeft:4 }}>
                    {selPac?.nm.split(" ")[0]}
                  </div>
                )}
                <div style={{
                  borderRadius:isDra?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:isDra?"linear-gradient(135deg,#A8722A,#7A5018)":T.sur,
                  color:isDra?"#fff":T.tx,
                  boxShadow:isDra?"0 4px 14px rgba(168,114,42,.28)":"0 1px 4px rgba(44,26,8,.08)",
                  border:isDra?"none":`1px solid ${T.br}`,
                  overflow:"hidden",
                }}>
                  {/* Arquivo */}
                  {hasFile && (
                    <div style={{ padding:"10px 14px", borderBottom: m.txt ? `1px solid ${isDra?"rgba(255,255,255,.15)":T.br}` : "none" }}>
                      {m.fileUrl ? (
                        isImg ? (
                          // Imagem: mostrar preview clicável
                          <img src={m.fileUrl} alt={m.fileName||"imagem"}
                            onClick={()=>downloadBase64(m.fileUrl, m.fileName||"imagem")}
                            style={{ maxWidth:"100%", maxHeight:220, borderRadius:8,
                              display:"block", cursor:"pointer", objectFit:"contain" }}
                            title="Clique para baixar" />
                        ) : (
                          // PDF/DOC/outros: botão de download
                          <button
                            onClick={()=>downloadBase64(m.fileUrl, m.fileName||"arquivo")}
                            style={{ display:"flex", alignItems:"center", gap:10, background:"none",
                              border:"none", cursor:"pointer", padding:0, width:"100%", textAlign:"left" }}>
                            <div style={{ width:42, height:42, borderRadius:10, flexShrink:0,
                              background:isDra?"rgba(255,255,255,.15)":T.bL,
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                              {getFileIcon(m.fileName)}
                            </div>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:isDra?"#fff":T.tx,
                                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:200 }}>
                                {m.fileName||"Arquivo"}
                              </div>
                              <div style={{ fontSize:10, color:isDra?"rgba(255,255,255,.65)":T.txS, marginTop:2 }}>
                                ⬇ Clique para baixar
                              </div>
                            </div>
                          </button>
                        )
                      ) : (
                        // Sem URL (arquivo grande demais / erro)
                        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12,
                          color:isDra?"rgba(255,255,255,.75)":T.txS }}>
                          <span style={{ fontSize:20 }}>{getFileIcon(m.fileName)}</span>
                          <div>
                            <div style={{ fontWeight:600, color:isDra?"#fff":T.tx }}>{m.fileName||"Arquivo"}</div>
                            <div style={{ fontSize:10, opacity:.7 }}>Arquivo muito grande para visualizar</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Texto */}
                  {m.txt && (
                    <div style={{ padding:"10px 14px", fontSize:13, lineHeight:1.55 }}>{m.txt}</div>
                  )}
                </div>
                <div style={{ fontSize:10, color:T.txS, marginTop:3,
                  textAlign:isDra?"right":"left", paddingLeft:isDra?0:4, paddingRight:isDra?4:0 }}>
                  {isDra?"Dra. Ilza · ":""}{m.ts}
                  {isDra && m.lida && <span style={{ marginLeft:4, color:T.b }}>✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Input area com anexo */}
      <div style={{ padding:"12px 24px 16px", background:T.sur, borderTop:`1px solid ${T.br}`, flexShrink:0 }}>
        {anexo && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
            background:T.bL, border:`1px solid ${T.b}30`, borderRadius:10, marginBottom:10 }}>
            <span style={{ fontSize:20 }}>{getFileIcon(anexo.name)}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.b, whiteSpace:"nowrap",
                overflow:"hidden", textOverflow:"ellipsis" }}>{anexo.name}</div>
              <div style={{ fontSize:10, color:T.txS }}>Pronto para enviar</div>
            </div>
            <button onClick={()=>setAnexo(null)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:T.re, padding:2 }}>✕</button>
          </div>
        )}
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          <input ref={fileRef} type="file" style={{ display:"none" }}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={onAnexoChange} />
          <button onClick={()=>fileRef.current?.click()} title="Anexar arquivo (máx 3MB)"
            style={{ width:42, height:42, borderRadius:11, border:`1.5px solid ${T.br}`,
              background:T.sur2, cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", flexShrink:0, transition:"all .15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=T.bL; e.currentTarget.style.borderColor=T.b+"50"; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=T.sur2; e.currentTarget.style.borderColor=T.br; }}>
            <span style={{ fontSize:18 }}>📎</span>
          </button>
          <textarea ref={inputRef} value={texto} onChange={e=>setTexto(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Escrever para ${selPac?.nm.split(" ")[0]}… (Enter para enviar)`}
            rows={1}
            style={{ ...inp, flex:1, resize:"none", lineHeight:1.5,
              paddingTop:10, paddingBottom:10, maxHeight:100, overflowY:"auto" }}/>
          <button onClick={enviar} disabled={(!texto.trim()&&!anexo)||enviando}
            style={{ width:42, height:42, borderRadius:11, border:"none",
              cursor:(texto.trim()||anexo)&&!enviando?"pointer":"not-allowed",
              background:(texto.trim()||anexo)&&!enviando?"linear-gradient(135deg,#A8722A,#7A5018)":T.sur2,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:(texto.trim()||anexo)&&!enviando?"0 4px 14px rgba(168,114,42,.35)":"none",
              transition:"all .15s", flexShrink:0 }}>
            {enviando
              ? <span style={{ width:16, height:16, border:"2px solid #fff", borderTopColor:"transparent",
                  borderRadius:"50%", animation:"spin 1s linear infinite", display:"block" }}/>
              : <Ic n="send" sz={16} c={(texto.trim()||anexo)&&!enviando?"#fff":T.brD}/>
            }
          </button>
        </div>
      </div>

      {/* Modal encerrar */}
      {confirmEnc && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:999999,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"24px 20px", maxWidth:360, width:"100%" }}>
            <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:700, color:T.tx, textAlign:"center", marginBottom:14 }}>
              Encerrar atendimento?
            </div>
            <div style={{ background:T.bL, border:`1px solid ${T.b}30`, borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
              <textarea value={msgEnc} onChange={e=>setMsgEnc(e.target.value)} rows={3}
                style={{ width:"100%", border:"none", background:"transparent",
                  fontFamily:"inherit", fontSize:12, color:T.tx, resize:"none", outline:"none" }}/>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setConfirmEnc(false)}
                style={{ flex:1, padding:12, borderRadius:11, border:`1.5px solid ${T.br}`,
                  background:"#fff", color:T.txM, fontSize:13, fontWeight:600,
                  fontFamily:"inherit", cursor:"pointer" }}>Cancelar</button>
              <button onClick={encerrar}
                style={{ flex:1, padding:12, borderRadius:11, border:"none",
                  background:T.gr, color:"#fff", fontSize:13, fontWeight:700,
                  fontFamily:"inherit", cursor:"pointer" }}>Encerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, collapsed, setCollapsed, onLogout, usuario, getBadge=()=>0, mobileOpen, setMobileOpen, isMobile, fbSyncStatus="idle" }) {
  const isRecepcao = usuario?.role === "recepcao";
  const RECEPCAO_HIDDEN = ["financas","estoque","marketing","admin","telemedicina"];

  const allSections = [
    { label:"CLÍNICA", items:[
      { key:"home",         icon:"home",   label:"Dashboard"    },
      { key:"pacientes",    icon:"users",  label:"Pacientes"    },
      { key:"exames",       icon:"exam",   label:"Exames"       },
      { key:"consultas",    icon:"cal",    label:"Consultas"    },
      { key:"telemedicina", icon:"video",  label:"Telemedicina" },
      { key:"sala",         icon:"sala",   label:"Sala Virtual" },
    ]},
    { label:"GESTÃO", items:[
      { key:"financas", icon:"money", label:"Financeiro" },
      { key:"estoque",  icon:"box",   label:"Estoque"    },
    ]},
    { label:"CANAIS", items:[
      { key:"marketing", icon:"megaph", label:"Marketing" },
      { key:"whatsapp",  icon:"chat",   label:"WhatsApp"  },
      { key:"instagram", icon:"insta",  label:"Instagram" },
      { key:"tiktok",    icon:"tiktok", label:"TikTok"    },
    ]},
  ];

  // Filtra itens proibidos para recepção e remove seções vazias
  const sections = allSections
    .map(sec => ({
      ...sec,
      items: isRecepcao ? sec.items.filter(i => !RECEPCAO_HIDDEN.includes(i.key)) : sec.items
    }))
    .filter(sec => sec.items.length > 0);

  const allBottomItems = [
    { key:"admin",  icon:"shield", label:"Administração" },
    { key:"perfil", icon:"user",   label:"Meu Perfil"    },
  ];
  const bottomItems = isRecepcao
    ? allBottomItems.filter(i => !RECEPCAO_HIDDEN.includes(i.key))
    : allBottomItems;
  const NavItem = ({ item }) => {
    const active = page === item.key;
    const badgeCount = getBadge(item.key);
    return (
      <button onClick={()=>setPage(item.key)} title={collapsed?item.label:undefined}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
          padding:collapsed?"9px 0":"9px 11px", borderRadius:9, border:"none",
          cursor:"pointer", justifyContent:collapsed?"center":"flex-start",
          background:active?T.sideAct:"transparent",
          borderLeft:active?`2.5px solid ${T.sideActBrd}`:"2.5px solid transparent",
          marginBottom:1, transition:"all .14s", position:"relative" }}
        onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=T.sideH; }}
        onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
        {/* Ícone com ponto vermelho de notificação */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <Ic n={item.icon} sz={16} c={active?"#fff":T.sideTx} />
          {badgeCount > 0 && (
            <span style={{
              position:"absolute", top:-4, right:-4,
              width:8, height:8, borderRadius:"50%",
              background:"#E53935",
              border:"1.5px solid "+T.side,
              display:"block"
            }} />
          )}
        </div>
        {!collapsed && (
          <span style={{ fontSize:13, fontWeight:active?600:400,
            color:active?"#fff":T.sideTx, whiteSpace:"nowrap", flex:1 }}>{item.label}</span>
        )}
        {!collapsed && badgeCount > 0 && (
          <span style={{
            marginLeft:"auto", minWidth:18, height:18, borderRadius:9,
            background:"#E53935", color:"#fff",
            fontSize:10, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"0 5px", flexShrink:0
          }}>{badgeCount}</span>
        )}
        {active && !collapsed && badgeCount === 0 && (
          <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%",
            background:T.sideActBrd, flexShrink:0 }} />
        )}
      </button>
    );
  };

  // Em mobile: retorna null quando fechado (mostra como overlay quando aberto)
  if (isMobile && !mobileOpen) return null;

  const sidebarContent = (
    <div style={{ width: isMobile ? 260 : (collapsed ? 62 : 230), background:T.side, display:"flex",
      flexDirection:"column", transition:"width .22s cubic-bezier(.4,0,.2,1)",
      overflow:"hidden", flexShrink:0, userSelect:"none" }}>
      {/* Logo */}
      <div style={{ height:62, display:"flex", alignItems:"center",
        padding:collapsed?"0 15px":"0 14px", gap:10,
        borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
        {!collapsed && (<>
          <div style={{ width:32, height:32, borderRadius:9, overflow:"hidden",
            background:"rgba(255,255,255,.08)", display:"flex", alignItems:"center",
            justifyContent:"center", flexShrink:0 }}>
            <img src={LOGO} alt="Logo" style={{ height:21, objectFit:"contain",
              filter:"brightness(0) invert(1)", opacity:.85 }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#fff", lineHeight:1.2 }}>CRM Médico</div>
            <div style={{ fontSize:10, color:T.sideLabel, lineHeight:1.3 }}>Dra. Ilza · v31</div>
          </div>
        </>)}
        {collapsed && (
          <div style={{ width:32, height:32, borderRadius:9, background:"rgba(255,255,255,.08)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ic n="spark" sz={14} c="#fff" />
          </div>
        )}
        <button onClick={()=>setCollapsed(c=>!c)}
          style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer",
            padding:4, borderRadius:6, display:"flex", flexShrink:0, opacity:.3 }}
          onMouseEnter={e=>e.currentTarget.style.opacity="1"}
          onMouseLeave={e=>e.currentTarget.style.opacity=".3"}>
          <Ic n={collapsed?"chevR":"chevL"} sz={14} c="#fff" />
        </button>
      </div>
      <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
        {sections.map((sec,si) => (
          <div key={si} style={{ marginBottom:6 }}>
            {!collapsed
              ? <div style={{ fontSize:9.5, fontWeight:700, color:T.sideLabel,
                  letterSpacing:".12em", textTransform:"uppercase", padding:"10px 12px 5px" }}>{sec.label}</div>
              : si>0 ? <div style={{ height:1, background:"rgba(255,255,255,.05)", margin:"8px 6px" }}/> : null}
            {sec.items.map(item => <NavItem key={item.key} item={item} />)}
          </div>
        ))}
      </nav>
      <div style={{ padding:"6px 8px 0", borderTop:"1px solid rgba(255,255,255,.06)" }}>
        {bottomItems.map(item => <NavItem key={item.key} item={item} />)}
      </div>
      {/* v29: footer sem avatar — apenas nome + logout */}
      {!collapsed&&(
        <div style={{margin:"0 10px 6px",borderRadius:8,padding:"5px 10px",
          background:fbSyncStatus==="ok"?"rgba(26,122,82,.18)":fbSyncStatus==="syncing"?"rgba(168,114,42,.18)":"rgba(255,255,255,.04)",
          border:`1px solid ${fbSyncStatus==="ok"?"rgba(26,122,82,.35)":fbSyncStatus==="syncing"?"rgba(168,114,42,.35)":"rgba(255,255,255,.08)"}`,
          display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
            background:fbSyncStatus==="ok"?"#1A7A52":fbSyncStatus==="syncing"?"#F0C060":"rgba(255,255,255,.25)",
            animation:fbSyncStatus==="syncing"?"pulse 1s infinite":"none"}}/>
          <span style={{fontSize:9.5,fontWeight:600,
            color:fbSyncStatus==="ok"?"#86C9A4":fbSyncStatus==="syncing"?"#F0C060":"rgba(255,255,255,.25)"}}>
            {fbSyncStatus==="ok"?"Atualizando... ✓":fbSyncStatus==="syncing"?"Sincronizando...":"Aguardando..."}
          </span>
        </div>
      )}
      <div style={{ padding:collapsed?"10px 15px 14px":"10px 12px 14px",
        borderTop:"1px solid rgba(255,255,255,.06)", marginTop:4 }}>
        {!collapsed ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,.75)", lineHeight:1.3 }}>
                {usuario?.nome?.split(" ").slice(0,2).join(" ") || "Usuário"}
              </div>
              <div style={{ fontSize:10, color:T.sideLabel, lineHeight:1.3, textTransform:"capitalize" }}>
                {usuario?.role || "—"}
              </div>
            </div>
            <button style={{ background:"none", border:"none", cursor:"pointer",
              padding:4, borderRadius:6, display:"flex", opacity:.4 }}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity=".4"}>
              <span onClick={onLogout} style={{cursor:"pointer"}}><Ic n="logout" sz={14} c="#fff" /></span>
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"center" }}>
            <Ic n="logout" sz={15} c="rgba(255,255,255,.3)" />
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div style={{
          position:"fixed", inset:0,
          background:"rgba(0,0,0,.5)",
          zIndex:499,
          backdropFilter:"blur(2px)"
        }} onClick={()=>setMobileOpen(false)} />
        <div style={{
          position:"fixed", top:0, left:0, bottom:0,
          zIndex:500,
          boxShadow:"4px 0 24px rgba(0,0,0,.4)",
          display:"flex"
        }}>
          {sidebarContent}
        </div>
      </>
    );
  }
  return sidebarContent;
}


function Topbar({ page, usuario, onMenuToggle, isMobile }) {
  const labels = {
    home:"Dashboard", pacientes:"Pacientes", exames:"Exames", consultas:"Consultas",
    telemedicina:"Telemedicina", financas:"Financeiro", estoque:"Estoque",
    marketing:"Marketing", whatsapp:"WhatsApp", instagram:"Instagram",
    tiktok:"TikTok", admin:"Administração", perfil:"Meu Perfil",
    sala:"Sala Virtual",
  };
  return (
    <div style={{ height:62, background:"#0d2137", borderBottom:"1px solid rgba(59,157,232,.2)",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding: isMobile ? "0 16px" : "0 28px", flexShrink:0 }}>
      <div style={{display:"flex", alignItems:"center", gap: isMobile ? 10 : 0}}>
        {isMobile && (
          <button onClick={onMenuToggle} style={{
            background:"rgba(59,157,232,.12)", border:"1.5px solid rgba(59,157,232,.25)",
            borderRadius:9, width:38, height:38, display:"flex", alignItems:"center",
            justifyContent:"center", cursor:"pointer", flexShrink:0
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth={2} strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>
        )}
        <div>
          <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:700, color:"#fff", letterSpacing:"-.025em" }}>{labels[page]||"CRM"}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:1 }}>Gastroenterologia</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, background:"rgba(59,157,232,.12)",
          border:"1.5px solid rgba(59,157,232,.3)", borderRadius:12, padding: isMobile ? "6px 10px" : "8px 14px" }}>
          <div style={{ width:28, height:28, borderRadius:8,
            background:"linear-gradient(135deg,#1A5FA8,#3B9DE8)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:700, fontSize:11, color:"#fff", flexShrink:0 }}>
            {(usuario?.nome||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}
          </div>
          {!isMobile && <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#fff", lineHeight:1.3 }}>
              {usuario?.nome?.split(" ").slice(0,2).join(" ") || "Usuário"}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.55)", lineHeight:1.2, textTransform:"capitalize" }}>
              {usuario?.role || "—"}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar — SEM avatar no footer ──────────────────────────────────────────



/* ═══════════════════════════════════════════════════════════════════════
   FIREBASE — FONTE ÚNICA DE VERDADE
   Todos os logins lêem e escrevem direto no Firebase Realtime Database.
   localStorage é usado apenas como cache offline/fallback.
   Polling a cada 3s garante que todos os dispositivos vejam os mesmos dados.
═══════════════════════════════════════════════════════════════════════ */
const FB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com";

async function fbWrite(path, value) {
  try {
    const r = await fetch(`${FB_URL}/${path}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return r.ok;
  } catch(e) { return false; }
}

async function fbRead(path) {
  try {
    const r = await fetch(`${FB_URL}/${path}.json`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

// Hook que mantém um estado sincronizado com o Firebase em tempo real
// Todos os logins que usam este hook vêem os mesmos dados
function useFirebaseData(fbPath, lsKey, defaultValue = []) {
  const [data, setData] = useState(() => {
    // Inicia com cache local enquanto carrega do Firebase
    const cached = safeLsGet(lsKey, defaultValue);
    return Array.isArray(cached) ? cached : defaultValue;
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    let lastEtag = null;

    async function fetchFromFB() {
      const val = await fbRead(fbPath);
      if (!active) return;
      if (val && Array.isArray(val) && val.length > 0) {
        const str = JSON.stringify(val);
        if (str !== lastEtag) {
          lastEtag = str;
          setData(val);
          localStorage.setItem(lsKey, str);
        }
      } else if (val === null || (Array.isArray(val) && val.length === 0)) {
        // Firebase vazio — envia o que está no localStorage (primeira vez)
        const local = safeLsGet(lsKey, defaultValue);
        if (local.length > 0) {
          await fbWrite(fbPath, local);
        }
      }
      if (!loaded) setLoaded(true);
    }

    fetchFromFB();
    const id = setInterval(fetchFromFB, 3000); // polling 3s — todos sincronizados
    return () => { active = false; clearInterval(id); };
  }, [fbPath, lsKey]);

  // Função para salvar — escreve no Firebase E no estado local simultaneamente
  const save = useCallback(async (updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Salva no Firebase de forma assíncrona
      fbWrite(fbPath, next);
      // Cache local imediato
      localStorage.setItem(lsKey, JSON.stringify(next));
      return next;
    });
  }, [fbPath, lsKey]);

  return [data, save, loaded];
}

// Status global de conexão com Firebase
function useFirebaseSync() {
  const [syncStatus, setSyncStatus] = React.useState("syncing");
  React.useEffect(() => {
    let active = true;
    async function check() {
      const ok = await fbRead("crm_data/crm_last_sync");
      if (!active) return;
      // Grava timestamp para indicar que este cliente está online
      await fbWrite("crm_data/crm_last_sync", new Date().toISOString());
      setSyncStatus("ok");
    }
    check();
    const id = setInterval(check, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);
  return syncStatus;
}

function CRM({usuario,onLogout,users,setUsers}){
  const fbSyncStatus=useFirebaseSync();
  const [page,setPage]=useState("home");
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Fecha sidebar ao trocar de página no mobile
  const setPageAndClose = (p) => { setPage(p); if(isMobile) setMobileOpen(false); };
  // ── Dados em tempo real do Firebase — todos os logins sincronizados ──
  const [pats, setPats, patsLoaded]           = useFirebaseData("crm_data/crm_pats_v26",      "crm_pats_v26",      []);
  const [allExamesRaw, setAllExamesRaw, exLoaded] = useFirebaseData("crm_data/crm_exames_v26","crm_exames_v26",    []);
  const patsState=[pats,setPats];
  // Fila prioridade
  const [filaPrioridadeVis,setFilaPrioridadeVis]=useState(false);
  const [col,setCol]=useState(false);
  // Atualiza CSS var --sidebar-w para modais se centralizarem corretamente
  useEffect(()=>{
    const w = isMobile ? 0 : (col ? 62 : 230);
    document.documentElement.style.setProperty('--sidebar-w', w+'px');
  },[col, isMobile]);
  const [estoqueItens, setEstoqueItens] = useFirebaseData("crm_data/crm_estoque_v26", "crm_estoque_v26", []);
  const [alertasDismissed,setAlertasDismissed]=useState([]);
  const [showSair,setShowSair]=useState(false);   // ← popup confirmação sair

  // Registrar handler global para o Electron interceptar o botao X da janela
  useEffect(()=>{
    window.__crm_confirm_close=()=>setShowSair(true);
    return()=>{delete window.__crm_confirm_close;};
  },[]);
  const criticos=estoqueItens.filter(i=>i.qtd<=i.min&&!alertasDismissed.includes(i.id));

  // ── Badge Sala Virtual: polling /salas_index a cada 5s ──
  const [salaAguardando, setSalaAguardando] = useState(0);
  const [salaMsgsNovas, setSalaMsgsNovas] = useState(0);
  const lastMsgTsRef = useRef({});
  useEffect(()=>{
    const DB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com";
    let active = true;
    async function pollSala() {
      try {
        const r = await fetch(`${DB_URL}/salas_index.json`);
        const data = await r.json();
        if(!active) return;
        const count = data
          ? Object.values(data).filter(p => p.status === "aguardando").length
          : 0;
        setSalaAguardando(count);
        // Checar mensagens novas de pacientes em todas as salas
        if(data) {
          let novas = 0;
          const ids = Object.keys(data);
          for(const pid of ids) {
            try {
              const rm = await fetch(`${DB_URL}/salas/${pid}/msgs.json`);
              const msgs = await rm.json();
              if(!msgs) continue;
              const lista = Object.values(msgs);
              const ultimo = Math.max(0, ...lista.map(m=>m.tsNum||0));
              const anterior = lastMsgTsRef.current[pid]||0;
              const naoLidas = lista.filter(m=>m.de==="pac"&&!m.lida&&(m.tsNum||0)>0).length;
              if(naoLidas > 0 && ultimo > anterior) novas += naoLidas;
            } catch(e) { /* silencioso */ }
          }
          setSalaMsgsNovas(novas);
        } else { setSalaMsgsNovas(0); }
      } catch(e) { /* silencioso */ }
    }
    pollSala();
    const id = setInterval(pollSala, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const RECEPCAO_BLOCKED = ["financas","estoque","marketing","admin","telemedicina"];
  const visNav=NAV.filter(n=>{
    if(n.key==="financas"&&usuario.role!=="admin"&&usuario.role!=="medico") return false;
    if(n.key==="estoque"&&usuario.role==="atendente") return false;
    if(n.key==="admin"&&usuario.role!=="admin"&&usuario.role!=="medico") return false;
    if(usuario.role==="recepcao"&&RECEPCAO_BLOCKED.includes(n.key)) return false;
    return true;
  });

  const estoqueState=[estoqueItens,setEstoqueItens];

  // useMemo evita recriar os componentes de pagina a cada render
  const allExames = allExamesRaw;
  const setAllExames = setAllExamesRaw;
  const [pacFiltro, setPacFiltro] = useState(null);

  const pages = useMemo(() => ({
    home:        usuario.role==="recepcao" ? <PageHomeRecepcao setPage={setPage} usuario={usuario} pats={pats} allExames={allExames}/> : <PageHome setPage={setPage} usuario={usuario}/>,
    whatsapp:    <PageWhatsApp usuario={usuario} patsState={patsState}/>,
    instagram:   <PageInstagram usuario={usuario} patsState={patsState}/>,
    tiktok:      <PageTikTok usuario={usuario} patsState={patsState}/>,
    pacientes:   <PagePacientes usuario={usuario} estoqueState={estoqueState} pats={pats} setPats={setPats} allExames={allExames} setAllExames={setAllExames} setPage={setPage} setPacFiltro={setPacFiltro}/>,
    exames:      <PageExames usuario={usuario} estoqueState={estoqueState} exames={allExames} setExames={setAllExames} pacFiltro={pacFiltro} setPacFiltro={setPacFiltro}/>,
    consultas:   <PageConsultas usuario={usuario} />,
    agenda:      <PageAgenda usuario={usuario}/>,
    financas:    <PageFinancas usuario={usuario}/>,
    estoque:     <PageEstoque usuario={usuario} estoqueState={estoqueState}/>,
    telemedicina:<PageTelemedicina usuario={usuario}/>,
    sala:        <PageSalaVirtual pats={pats} />,
    marketing:   <PageMarketing usuario={usuario}/>,
    admin:       <PageAdmin usuario={usuario} users={users} setUsers={setUsers}/>,
    perfil:      <PagePerfil usuario={usuario} users={users} setUsers={setUsers}/>,
  }), [page, pats, users, estoqueState, patsState, allExames, pacFiltro]); // eslint-disable-line

  const getBadge=key=>{
    if(key==="whatsapp") return WA_BASE.filter(c=>c.nova).length;
    if(key==="instagram") return IG_BASE.filter(c=>c.nova).length;
    if(key==="tiktok") return TK_BASE.filter(c=>c.nova).length;
    if(key==="estoque") return estoqueItens.filter(i=>i.qtd<=i.min).length;
    if(key==="exames") return allExames.filter(e=>e.st==="Agendado").length;
    if(key==="sala") return salaAguardando + salaMsgsNovas;
    return 0;
  };

  return(
    <>
      <GlobalStyles />
      {/* Popups e alertas que ficam acima de tudo */}
      <EstoqueAlertaPopup itens={criticos} onClose={id=>setAlertasDismissed(p=>[...p,id])}/>
      {showSair&&(
        <ConfirmPopup
          danger
          title="Sair do sistema?"
          msg={`Deseja realmente encerrar a sessao de ${usuario.nome}?`}
          yesLabel="Sim, sair"
          noLabel="Continuar"
          onYes={()=>{auditAdd(usuario.nome,"LOGOUT","");onLogout();}}
          onNo={()=>setShowSair(false)}
        />
      )}

      <div style={{display:"flex",height:"100vh",height:"100dvh",width:"100vw",
        fontFamily:"'Outfit',system-ui,sans-serif",color:T.tx,overflow:"hidden",background:T.bg}}>

        {/* Sidebar v26 — escondido no mobile, overlay quando aberto */}
        <Sidebar
          page={page}
          setPage={setPageAndClose}
          collapsed={isMobile ? false : col}
          setCollapsed={setCol}
          onLogout={()=>setShowSair(true)}
          usuario={usuario}
          getBadge={getBadge}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          fbSyncStatus={fbSyncStatus}
        />

        {/* Main area */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <Topbar page={page} usuario={usuario} isMobile={isMobile} onMenuToggle={()=>setMobileOpen(o=>!o)} />
          <div style={{flex:1,overflowY:"auto",overflowX:"hidden",display:"flex",flexDirection:"column",background:T.bg,minHeight:0,
            }}>
            <div style={{display:"flex",flexDirection:"column",minHeight:"min-content"}}>
              {usuario.role==="recepcao" && RECEPCAO_BLOCKED.includes(page) ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  flex:1,padding:40,gap:16,minHeight:400}}>
                  <div style={{fontSize:52}}>🔒</div>
                  <div style={{fontSize:18,fontWeight:700,color:T.tx}}>Acesso restrito</div>
                  <div style={{fontSize:13,color:T.txM,textAlign:"center",maxWidth:360}}>
                    Seu perfil de Recepção não tem permissão para acessar esta área.
                  </div>
                  <button onClick={()=>setPageAndClose("home")}
                    style={{marginTop:8,background:T.b,color:"#fff",border:"none",
                      borderRadius:10,padding:"10px 24px",fontWeight:700,
                      fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    Voltar ao Dashboard
                  </button>
                </div>
              ) : (
                pages[page]||<div style={{padding:24,color:T.txM}}>Pagina nao encontrada</div>
              )}
            </div>
          </div>
        </div>
      </div>


    </>
  );
}



/* ErrorBoundary — captura qualquer erro React e mostra tela de recuperação */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[CRM ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          height:"100vh", background:"#F2E9DC", fontFamily:"system-ui, sans-serif", padding:32
        }}>
          <div style={{
            background:"#fff", border:"1.5px solid #E8D5BC", borderRadius:16,
            padding:"32px 40px", maxWidth:520, textAlign:"center",
            boxShadow:"0 4px 24px rgba(44,26,8,.08)"
          }}>
            <div style={{fontSize:48, marginBottom:16}}>⚠️</div>
            <h2 style={{color:"#A8722A", fontSize:20, fontWeight:700, margin:"0 0 8px"}}>
              Erro ao carregar o CRM
            </h2>
            <p style={{color:"#7A5C3A", fontSize:13, margin:"0 0 20px", lineHeight:1.6}}>
              {String(this.state.error?.message || "Erro desconhecido")}
            </p>
            <button
              onClick={() => { this.setState({hasError:false,error:null}); window.location.reload(); }}
              style={{
                background:"linear-gradient(135deg,#A8722A,#C89C62)",
                color:"#fff", border:"none", borderRadius:9,
                padding:"10px 24px", fontWeight:700, fontSize:14, cursor:"pointer"
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner(){
  const [users,setUsers]=useState(USERS_INIT);
  const [session,setSession]=useState(null);
  useEffect(()=>{
    if(!session) return;
    const events = ["mousedown","keydown","touchstart","scroll"];
    const handler = () => resetSessionTimer(()=>setSession(null));
    resetSessionTimer(()=>setSession(null));
    events.forEach(e=>document.addEventListener(e,handler,{passive:true}));
    return ()=>{
      clearSessionTimer();
      events.forEach(e=>document.removeEventListener(e,handler));
    };
  },[session]);
  if(!session) return <Login onLogin={setSession} users={users}/>;
  return <CRM usuario={session} onLogout={()=>{ clearSessionTimer(); window._crmUsuario = null; setSession(null); }} users={users} setUsers={setUsers}/>;
}


/* ── Limpeza proativa de chaves corrompidas no boot ── */
(function cleanCorruptedStorage() {
  const KEYS_TO_CLEAN = [
    "crm_pats_v26","crm_consultas_v26","crm_exames_v26",
    "crm_estoque_v26","crm_agenda_v26","crm_agenda_v25",
    "crm_fila_v25","crm_marketing_v26","crm_lancamentos_v26",
  ];
  KEYS_TO_CLEAN.forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const t = raw.trim();
      // Corrompido = não é JSON válido de array/objeto/string
      if (!t.startsWith("[") && !t.startsWith("{") && !t.startsWith('"')) {
        console.warn("[CRM Boot] Limpando chave corrompida:", key, "=>", t.substring(0,30));
        localStorage.removeItem(key);
      } else {
        JSON.parse(t); // testa parse — se falhar, cai no catch
      }
    } catch(e) {
      console.warn("[CRM Boot] JSON inválido removido:", key);
      localStorage.removeItem(key);
    }
  });
})();

export default function App(){
  return (
    <ErrorBoundary>
      <AppInner/>
    </ErrorBoundary>
  );
}
// CRM Dra. Ilza Ezequiel v34 — Dashboard Recepção, tema azul, scroll global

/* ════════════════════════════════════════════════════════════════
   BRIDGE CRM ↔ PORTAL — sincronização Firebase-style via localStorage
   Qualquer mudança nos dados do CRM é broadcast para o Portal
   e vice-versa via storage events + polling
════════════════════════════════════════════════════════════════ */
(function installBridge() {
  const KEYS = {
    pats:     "crm_pats_v26",
    exames:   "crm_exames_v26",
    agenda:   "crm_agenda_v26",
    consultas:"crm_consultas_v26",
    sync:     "crm_portal_sync_ts",
  };

  // Expor API global para Portal HTML ler/escrever dados CRM
  window.CRM_BRIDGE = {
    getPacientes: () => { try { return JSON.parse(localStorage.getItem(KEYS.pats)||"[]"); } catch(e){return[];} },
    getExames:    () => { try { return JSON.parse(localStorage.getItem(KEYS.exames)||"[]"); } catch(e){return[];} },
    getAgenda:    () => { try { return JSON.parse(localStorage.getItem(KEYS.agenda)||"[]"); } catch(e){return[];} },
    getConsultas: () => { try { return JSON.parse(localStorage.getItem(KEYS.consultas)||"[]"); } catch(e){return[];} },

    // Portal escreve mensagem de paciente → CRM recebe
    addMsgPortal: (pacNome, msg) => {
      const msgs = safeLsGet("portal_msgs_inbox");
      msgs.unshift({ id:"pm_"+Date.now(), pac:pacNome, msg, ts: new Date().toLocaleString("pt-BR"), lido:false });
      localStorage.setItem("portal_msgs_inbox", JSON.stringify(msgs));
      localStorage.setItem(KEYS.sync, Date.now().toString());
      window.dispatchEvent(new Event("storage"));
    },

    // CRM escreve resposta → Portal recebe
    addMsgCRM: (pacNome, msg) => {
      const msgs = safeLsGet("portal_msgs_outbox");
      msgs.unshift({ id:"cm_"+Date.now(), pac:pacNome, msg, ts: new Date().toLocaleString("pt-BR"), lido:false });
      localStorage.setItem("portal_msgs_outbox", JSON.stringify(msgs));
      localStorage.setItem(KEYS.sync, Date.now().toString());
      window.dispatchEvent(new Event("storage"));
    },

    // Notificar paciente de nova consulta/exame agendado
    notifyPaciente: (pacNome, tipo, detalhe) => {
      const notifs = safeLsGet("portal_notificacoes");
      notifs.unshift({ id:"n_"+Date.now(), pac:pacNome, tipo, detalhe, ts: new Date().toLocaleString("pt-BR"), lido:false });
      localStorage.setItem("portal_notificacoes", JSON.stringify(notifs.slice(0,100)));
      localStorage.setItem(KEYS.sync, Date.now().toString());
    },

    // Badge para WhatsApp do CRM
    getMsgsPendentes: () => {
      try {
        const msgs = safeLsGet("portal_msgs_inbox");
        return msgs.filter(m=>!m.lido).length;
      } catch(e){return 0;}
    },

    // Sync timestamp
    getLastSync: () => localStorage.getItem(KEYS.sync) || "0",
  };

  // Escuta eventos de storage (Portal rodando em outra aba/janela)
  window.addEventListener("storage", (e) => {
    if (e.key === "portal_msgs_inbox") {
      // Re-render badge no WhatsApp do CRM se visível
      document.title = (() => {
        const n = window.CRM_BRIDGE.getMsgsPendentes();
        return n > 0 ? `(${n}) CRM Dra. Ilza` : "CRM Dra. Ilza";
      })();
    }
  });
})();
