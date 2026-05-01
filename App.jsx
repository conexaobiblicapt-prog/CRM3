Agora entendo toda a arquitetura. Vou criar o patch exato para integrar no CRM — substituindo as funções de Jitsi pelo sistema WebRTC próprio, com geração de link, sala de espera em tempo real e abertura da sala da médica.Arquitetou integração de sistema de videoconsulta no CRMArquitetou integração de sistema de videoconsulta no CRMAgora tenho tudo. Vou criar o patch completo para o App.jsx:Patch file for App.jsx - integrates WebRTC video room into CRM Telemedicina sectionPatch file for App.jsx - integrates WebRTC video room into CRM Telemedicina sectionPatch file for App.jsx - integrates WebRTC video room into CRM Telemedicina sectionApp_videoconsulta_patch.jsxConcluído


// ════════════════════════════════════════════════════════════════
// PATCH: Integração WebRTC no CRM — Dra. Ilza Ezequiel
//
// INSTRUÇÕES:
// 1. Coloque videoconsulta-sala.html na raiz do projeto (mesmo nível de index.html)
// 2. No App.jsx, encontre cada bloco marcado com "SUBSTITUIR:" e
//    troque pelo bloco novo correspondente.
// 3. Os comentários "// LINHA ~XXXX" indicam a localização no arquivo original.
// ════════════════════════════════════════════════════════════════


// ────────────────────────────────────────────────────────────────
// [1/5] SUBSTITUIR as funções gerarSalaTelemedicina + gerarLinkTelemedicina
//       + constante SALA_MEDICA  (LINHA ~2555–2566)
// ────────────────────────────────────────────────────────────────

// ── URL base da página de videoconsulta (mesmo domínio do CRM) ──
const VIDEO_ROOM_BASE = (() => {
  // Em produção (Vercel/Netlify), pega o origin automaticamente.
  // Troque apenas se o arquivo HTML estiver em outro domínio.
  return window.location.origin;
})();

// Gera ID único de sala por paciente + timestamp (evita reutilização)
function gerarSalaTelemedicina(pacienteId) {
  const slug = (pacienteId || "sala").replace(/[^a-zA-Z0-9]/g, "");
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug}_${ts}_${rand}`;
}

// Link que vai para o PACIENTE (abre videoconsulta-sala.html como role=patient)
function gerarLinkTelemedicina(pacienteId, pacienteNome) {
  const roomId = gerarSalaTelemedicina(pacienteId);
  const nome   = encodeURIComponent(pacienteNome || "Paciente");
  return `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=patient&room=${roomId}&name=${nome}`;
}

// Link para a MÉDICA (abre videoconsulta-sala.html como role=doctor)
function gerarLinkMedica(roomId) {
  return `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=doctor&room=${roomId}&name=Dra.%20Ilza%20Ezequiel`;
}

// Extrai o roomId de um link de paciente já gerado
function extrairRoomId(linkPaciente) {
  try {
    return new URL(linkPaciente).searchParams.get("room");
  } catch(e) { return null; }
}

// ── Storage helpers para sala de espera em tempo real ──
function salaSetState(roomId, data) {
  localStorage.setItem(`sv_room_${roomId}_state`, JSON.stringify({ ...data, ts: Date.now() }));
  window.dispatchEvent(new Event("storage"));
  if (typeof BroadcastChannel !== "undefined") {
    try { new BroadcastChannel("sv_video_" + roomId).postMessage({ key: "state", data }); } catch(e) {}
  }
}
function salaGetState(roomId) {
  try { return JSON.parse(localStorage.getItem(`sv_room_${roomId}_state`)); } catch(e) { return null; }
}


// ────────────────────────────────────────────────────────────────
// [2/5] SUBSTITUIR o componente ModalTelemedicina inteiro
//       (LINHA ~2659–2774)
// ────────────────────────────────────────────────────────────────

function ModalTelemedicina({ paciente, onClose }) {
  // Cada vez que o modal abre, gera IDs frescos
  const [roomId]       = React.useState(() => gerarSalaTelemedicina(paciente.id));
  const [linkPac]      = React.useState(() => {
    const slug = (paciente.id || "sala").replace(/[^a-zA-Z0-9]/g, "");
    const ts   = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 7);
    const id   = `${slug}_${ts}_${rand}`;
    return `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=patient&room=${id}&name=${encodeURIComponent(paciente.nm || "Paciente")}`;
  });
  const linkMed        = React.useMemo(() => gerarLinkMedica(extrairRoomId(linkPac)), [linkPac]);

  const [copPac, setCopPac] = React.useState(false);
  const [copMed, setCopMed] = React.useState(false);

  // Presença do paciente (polling localStorage)
  const [presenca, setPresenca] = React.useState(null); // null | "aguardando" | "entrou"
  React.useEffect(() => {
    const rid = extrairRoomId(linkPac);
    if (!rid) return;
    const check = () => {
      const st = salaGetState(rid);
      if (st?.patientJoined) setPresenca("entrou");
    };
    check();
    const t = setInterval(check, 2000);
    const handler = () => check();
    window.addEventListener("storage", handler);
    return () => { clearInterval(t); window.removeEventListener("storage", handler); };
  }, [linkPac]);

  function copiar(url, setFn) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setFn(true); setTimeout(() => setFn(false), 2200); });
    } else {
      const t = document.createElement("textarea");
      t.value = url; document.body.appendChild(t); t.select();
      document.execCommand("copy"); document.body.removeChild(t);
      setFn(true); setTimeout(() => setFn(false), 2200);
    }
  }

  const enviarWA = () => {
    const nome = paciente.nm.split(" ")[0];
    const msg  =
      `Olá ${nome}! 😊\n\n` +
      `Sua *videoconsulta* com a Dra. Ilza Ezequiel está pronta.\n\n` +
      `📹 *Clique no link para entrar na sala:*\n${linkPac}\n\n` +
      `📌 _Dicas: use Chrome ou Safari, permita câmera e microfone, prefira local tranquilo._\n\n` +
      `Qualquer dúvida estamos à disposição! 💙\n_Equipe Dra. Ilza Ezequiel | Gastroenterologia_`;
    window.open(
      "https://wa.me/55" + (paciente.tel || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(msg),
      "_blank"
    );
  };

  const abrirSalaDoctor = () => window.open(linkMed, "_blank");
  const abrirSalaPatient = () => window.open(linkPac, "_blank");

  const presencaColor = presenca === "entrou" ? C.green : presenca === "aguardando" ? C.gold : C.txM;
  const presencaLabel = presenca === "entrou" ? "✅ Paciente na sala!" : presenca === "aguardando" ? "⏳ Aguardando..." : "⬜ Sala não acessada";

  return (
    <Modal title={"📹 Videoconsulta — " + paciente.nm} onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status de presença */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: presenca === "entrou" ? `${C.green}10` : `${C.p}08`,
          border: `1px solid ${presenca === "entrou" ? C.green : C.p}25`,
          borderRadius: 12, padding: "12px 16px"
        }}>
          <span style={{ fontSize: 28 }}>🎥</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.p, marginBottom: 3 }}>
              Sala WebRTC — Peer-to-peer criptografado
            </div>
            <div style={{ fontSize: 11, color: C.txM, lineHeight: 1.6 }}>
              Link exclusivo para este paciente. Não precisa instalar nada — funciona no navegador.
            </div>
          </div>
          <div style={{
            background: presencaColor + "18", border: `1px solid ${presencaColor}40`,
            borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
            color: presencaColor, whiteSpace: "nowrap"
          }}>
            {presencaLabel}
          </div>
        </div>

        {/* Link do paciente */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.txM, marginBottom: 6 }}>
            🔗 Link do paciente (role=patient)
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              flex: 1, background: C.card2, border: `1px solid ${C.brd}`,
              borderRadius: 8, padding: "9px 12px", fontSize: 11,
              color: C.txS, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5
            }}>
              {linkPac}
            </div>
            <button
              onClick={() => copiar(linkPac, setCopPac)}
              style={{
                flexShrink: 0,
                background: copPac ? `${C.green}15` : `${C.p}12`,
                border: `1px solid ${copPac ? C.green : C.p}30`,
                color: copPac ? C.green : C.p,
                borderRadius: 8, padding: "9px 14px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              {copPac ? "✅ Copiado!" : "📋 Copiar"}
            </button>
          </div>
        </div>

        {/* Link da médica */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.txM, marginBottom: 6 }}>
            👩‍⚕️ Seu link (role=doctor) — mesma sala
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              flex: 1, background: `${C.teal}08`, border: `1px solid ${C.teal}25`,
              borderRadius: 8, padding: "9px 12px", fontSize: 11,
              color: C.txS, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5
            }}>
              {linkMed}
            </div>
            <button
              onClick={() => copiar(linkMed, setCopMed)}
              style={{
                flexShrink: 0,
                background: copMed ? `${C.green}15` : `${C.teal}12`,
                border: `1px solid ${copMed ? C.green : C.teal}30`,
                color: copMed ? C.green : C.teal,
                borderRadius: 8, padding: "9px 14px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              {copMed ? "✅" : "📋"}
            </button>
          </div>
        </div>

        {/* Enviar ao paciente */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.txM, marginBottom: 8 }}>
            📤 Enviar link ao paciente
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={enviarWA}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#25D366", border: "none", color: "#fff",
                borderRadius: 8, padding: "9px 16px", fontSize: 12,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
              }}
            >
              📱 WhatsApp
            </button>
            {paciente.email && (
              <button
                onClick={() => {
                  const sub  = encodeURIComponent("Link Videoconsulta — Dra. Ilza Ezequiel");
                  const body = encodeURIComponent(
                    `Olá ${paciente.nm.split(" ")[0]},\n\nSua videoconsulta está pronta.\n\nAcesse: ${linkPac}\n\nDúvidas: (13) 97802-8137\nEquipe Dra. Ilza Ezequiel`
                  );
                  window.open(`mailto:${paciente.email}?subject=${sub}&body=${body}`, "_blank");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: `${C.p}12`, border: `1px solid ${C.p}30`,
                  color: C.p, borderRadius: 8, padding: "9px 16px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                }}
              >
                📧 E-mail
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: C.brd }} />

        {/* Abrir salas */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={abrirSalaDoctor}
            style={{
              flex: 1, background: `linear-gradient(135deg,${C.teal},#1abc9c)`,
              border: "none", color: "#fff", borderRadius: 10, padding: "13px 0",
              fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 4px 14px ${C.teal}35`
            }}
          >
            👩‍⚕️ Abrir minha sala
          </button>
          <button
            onClick={abrirSalaPatient}
            style={{
              flex: 1, background: `linear-gradient(135deg,${C.p},${C.pG})`,
              border: "none", color: "#fff", borderRadius: 10, padding: "13px 0",
              fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 4px 14px ${C.p}35`
            }}
          >
            🎥 Abrir sala do paciente
          </button>
        </div>

        <p style={{ color: C.txM, fontSize: 10, margin: 0, textAlign: "center", lineHeight: 1.6 }}>
          🔒 WebRTC peer-to-peer · Vídeo direto sem servidor intermediário · Sinalização via localStorage
        </p>
      </div>
    </Modal>
  );
}


// ────────────────────────────────────────────────────────────────
// [3/5] SUBSTITUIR o componente SalaEspera inteiro (LINHA ~7054)
//       Mantém o poll do Firebase + adiciona botão "Gerar Sala de Vídeo"
// ────────────────────────────────────────────────────────────────

function SalaEspera({ onIniciar }) {
  const [fila, setFila]   = useState([]);
  const [salas, setSalas] = useState({}); // { [pacienteId]: { linkPac, linkMed, roomId } }
  const DB_URL = "https://crm-dra-ilza-default-rtdb.firebaseio.com";

  // Poll fila Firebase
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const r    = await fetch(`${DB_URL}/salas_index.json`);
        const data = await r.json();
        if (!active || !data) { setFila([]); return; }
        const lista = Object.entries(data)
          .map(([id, info]) => ({ id, ...info }))
          .filter(p => p.status === "aguardando" || p.status === "atendendo")
          .sort((a, b) => (a.entrou || 0) - (b.entrou || 0));
        setFila(lista);
      } catch(e) { /* silencioso */ }
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Presença em tempo real via localStorage (atualizado pelo videoconsulta-sala.html)
  const [presencas, setPresencas] = useState({});
  useEffect(() => {
    const check = () => {
      const novo = {};
      Object.entries(salas).forEach(([pid, s]) => {
        const st = salaGetState(s.roomId);
        novo[pid] = st?.patientJoined ? "entrou" : "aguardando";
      });
      setPresencas(novo);
    };
    check();
    const t = setInterval(check, 2000);
    window.addEventListener("storage", check);
    return () => { clearInterval(t); window.removeEventListener("storage", check); };
  }, [salas]);

  function gerarSala(pac) {
    const nome   = pac.nm || pac.nome || pac.id;
    const pid    = pac.id;
    const slug   = pid.replace(/[^a-zA-Z0-9]/g, "");
    const ts     = Date.now().toString(36);
    const rand   = Math.random().toString(36).slice(2, 7);
    const roomId = `${slug}_${ts}_${rand}`;
    const linkPac = `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=patient&room=${roomId}&name=${encodeURIComponent(nome)}`;
    const linkMed = `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=doctor&room=${roomId}&name=Dra.%20Ilza%20Ezequiel`;
    setSalas(prev => ({ ...prev, [pid]: { linkPac, linkMed, roomId } }));
  }

  function copiarLink(pid) {
    const s = salas[pid];
    if (!s) return;
    navigator.clipboard?.writeText(s.linkPac)
      .catch(() => { const t = document.createElement("textarea"); t.value = s.linkPac; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); });
  }

  function enviarWA(pac) {
    const s = salas[pac.id];
    if (!s) { alert("Gere a sala primeiro!"); return; }
    const nome = (pac.nm || pac.nome || "Paciente").split(" ")[0];
    const msg  =
      `Olá ${nome}! 😊\n\n` +
      `Sua videoconsulta com a Dra. Ilza Ezequiel está pronta.\n\n` +
      `📹 Clique para entrar: ${s.linkPac}\n\n` +
      `Aguarde a Dra. iniciar a chamada na sala de espera. Cuide-se! 💙`;
    window.open("https://wa.me/55" + (pac.tel || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(msg), "_blank");
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Pacientes aguardando</span>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
          color: "#8a6a32", background: "#fff3cd", padding: "4px 10px",
          borderRadius: 8, border: "0.5px solid #e8d5b0"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, display: "inline-block", animation: "pulse 1.5s infinite" }} />
          {fila.filter(p => p.status === "aguardando").length} na fila ·{" "}
          {fila.filter(p => p.status === "atendendo").length} em atendimento
        </div>
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fila.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "#888" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🕐</div>
            <div style={{ fontSize: 13 }}>Nenhum paciente aguardando no momento</div>
            <div style={{ fontSize: 11, marginTop: 4, color: "#aaa" }}>Atualiza automaticamente a cada 4s</div>
          </div>
        )}

        {fila.map((p) => {
          const sala     = salas[p.id];
          const presenca = presencas[p.id];
          const nome     = p.nm || p.nome || p.id;

          return (
            <div key={p.id} style={{
              background: "white",
              border: `0.5px solid #e0d8cc`,
              borderLeft: p.plano === "Premium"
                ? `3px solid ${C.gold}`
                : p.status === "atendendo" ? `3px solid ${C.green}` : "0.5px solid #e0d8cc",
              borderRadius: 12, overflow: "hidden"
            }}>
              {/* Linha principal */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                <TeleAvatar iniciais={nome.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase()} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{nome}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{p.ultimaTxt ? `"${p.ultimaTxt.replace("←", "").trim()}"` : "Aguardando..."}</span>
                    {p.plano === "Premium" && <TeleBadge>Premium</TeleBadge>}
                    {p.status === "atendendo" && <span style={{ color: C.green, fontWeight: 600 }}>● Atendendo</span>}
                  </div>
                </div>

                {/* Botões */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!sala ? (
                    <TeleBtn
                      onClick={() => gerarSala(p)}
                      color={C.p}
                      style={{ fontSize: 11, padding: "6px 12px" }}
                    >
                      📹 Gerar sala
                    </TeleBtn>
                  ) : (
                    <>
                      {/* Status presença */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                        background: presenca === "entrou" ? `${C.green}15` : `${C.gold}15`,
                        color: presenca === "entrou" ? C.green : "#8a6a32"
                      }}>
                        {presenca === "entrou" ? "✅ Na sala" : "⏳ Enviado"}
                      </span>
                      {/* Abrir sala (médica) */}
                      <TeleBtn
                        onClick={() => window.open(sala.linkMed, "_blank")}
                        color={presenca === "entrou" ? C.green : C.gold}
                        style={{ fontSize: 11, padding: "6px 12px" }}
                      >
                        {presenca === "entrou" ? "🟢 Iniciar chamada" : "📹 Abrir sala"}
                      </TeleBtn>
                      {/* Enviar WA */}
                      <TeleBtn
                        onClick={() => enviarWA(p)}
                        color="#25D366"
                        style={{ fontSize: 11, padding: "6px 10px" }}
                      >
                        📱
                      </TeleBtn>
                      {/* Copiar link */}
                      <TeleBtn
                        onClick={() => copiarLink(p.id)}
                        color={C.txM}
                        style={{ fontSize: 11, padding: "6px 10px", background: "#f5f5f5" }}
                      >
                        📋
                      </TeleBtn>
                    </>
                  )}

                  {/* Botão Iniciar chat (sala virtual original) */}
                  <TeleBtn
                    onClick={() => onIniciar({ ...p, nome })}
                    color={p.status === "atendendo" ? C.green : C.gold}
                    style={{ fontSize: 11, padding: "6px 12px" }}
                  >
                    {p.status === "atendendo" ? "💬 Chat" : "💬"}
                  </TeleBtn>
                </div>
              </div>

              {/* Link gerado (expansível) */}
              {sala && (
                <div style={{
                  background: "#f9f6f1", borderTop: "0.5px solid #e0d8cc",
                  padding: "8px 14px", fontSize: 11
                }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <span style={{ color: "#aaa", fontWeight: 600 }}>Paciente: </span>
                      <span style={{ fontFamily: "monospace", color: C.p, wordBreak: "break-all" }}>
                        {sala.linkPac.slice(0, 60)}...
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        onClick={() => navigator.clipboard?.writeText(sala.linkPac)}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid ${C.p}30`, background: `${C.p}08`, color: C.p, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                      >
                        📋 Copiar link paciente
                      </button>
                      <button
                        onClick={() => navigator.clipboard?.writeText(sala.linkMed)}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid ${C.teal}30`, background: `${C.teal}08`, color: C.teal, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                      >
                        👩‍⚕️ Copiar link Dra.
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f0e8", borderRadius: 12, fontSize: 13, color: "#2C1F14" }}>
        <strong>Como funciona:</strong>
        <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 2, fontSize: 12, color: "#555" }}>
          <li>Clique em <strong>📹 Gerar sala</strong> ao lado do paciente</li>
          <li>Envie o link via WhatsApp (📱) ou copie (📋)</li>
          <li>Aguarde o status mudar para <strong style={{ color: C.green }}>✅ Na sala</strong></li>
          <li>Clique em <strong style={{ color: C.green }}>🟢 Iniciar chamada</strong></li>
        </ol>
        <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(26,95,168,.08)", borderRadius: 8, fontSize: 11, color: C.p }}>
          🔒 WebRTC peer-to-peer — vídeo direto, sem servidor de mídia intermediário
        </div>
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────
// [4/5] SUBSTITUIR o componente Videoconsulta inteiro (LINHA ~7128)
//       Remove iframe Jitsi → abre videoconsulta-sala.html em nova aba
//       + mantém prontuário, receita, atestado
// ────────────────────────────────────────────────────────────────

function Videoconsulta({ paciente, onEncerrar }) {
  const [anotacao, setAnotacao]       = useState("");
  const [duracao, setDuracao]         = useState(0);
  const [showReceita, setShowReceita] = useState(false);
  const [showAtestado, setShowAtestado] = useState(false);
  const [receitaData, setReceitaData] = useState({ medicamento: "", posologia: "", dias: "30" });
  const [atestadoDias, setAtestadoDias] = useState("1");
  const [receitaGerada, setReceitaGerada]   = useState(null);
  const [atestadoGerado, setAtestadoGerado] = useState(null);

  // Sala gerada ao montar o componente
  const salaRef = React.useRef(null);
  if (!salaRef.current && paciente) {
    const pid  = paciente.id || paciente.nome || "sala";
    const nome = paciente.nome || paciente.nm || "Paciente";
    const slug = pid.replace(/[^a-zA-Z0-9]/g, "");
    const ts   = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 7);
    const rid  = `${slug}_${ts}_${rand}`;
    salaRef.current = {
      roomId:   rid,
      linkPac:  `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=patient&room=${rid}&name=${encodeURIComponent(nome)}`,
      linkMed:  `${VIDEO_ROOM_BASE}/videoconsulta-sala.html?role=doctor&room=${rid}&name=Dra.%20Ilza%20Ezequiel`,
    };
  }
  const sala = salaRef.current;

  // Presença do paciente
  const [presenca, setPresenca] = useState(null);
  useEffect(() => {
    if (!sala) return;
    const check = () => {
      const st = salaGetState(sala.roomId);
      setPresenca(st?.patientJoined ? "entrou" : st ? "aguardando" : null);
    };
    check();
    const t = setInterval(check, 2000);
    window.addEventListener("storage", check);
    return () => { clearInterval(t); window.removeEventListener("storage", check); };
  }, [sala]);

  // Timer de duração
  useEffect(() => {
    const t = setInterval(() => setDuracao(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Aviso de navegação durante consulta ativa
  useEffect(() => {
    const handler = e => {
      e.preventDefault();
      e.returnValue = "Há uma teleconsulta em andamento. Tem certeza que deseja sair?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const fmt   = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const hoje  = new Date().toLocaleDateString("pt-BR");

  const gerarReceita  = () => { setReceitaGerada({ ...receitaData, paciente: paciente?.nome, data: hoje, crm: "SP 157236" }); setShowReceita(false); };
  const gerarAtestado = () => { setAtestadoGerado({ dias: atestadoDias, paciente: paciente?.nome, data: hoje, crm: "SP 157236" }); setShowAtestado(false); };

  if (!paciente) return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#aaa" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📹</div>
      <div style={{ fontSize: 14 }}>Nenhuma consulta ativa.<br />Inicie pela Sala de Espera.</div>
    </div>
  );

  const presencaColor = presenca === "entrou" ? C.green : presenca === "aguardando" ? C.gold : C.txM;
  const presencaLabel = presenca === "entrou" ? "✅ Paciente na sala" : presenca === "aguardando" ? "⏳ Paciente na fila" : "⬜ Aguardando envio";

  return (
    <div>
      {/* Header paciente + timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <TeleAvatar iniciais={paciente.iniciais} size={32} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{paciente.nome}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{paciente.motivo}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
            background: presencaColor + "15", color: presencaColor, border: `1px solid ${presencaColor}30`
          }}>
            {presencaLabel}
          </span>
          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 500, color: C.green }}>
            {fmt(duracao)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>

        {/* Painel da videoconsulta */}
        <div>
          {/* Box principal */}
          <div style={{
            background: "linear-gradient(135deg,#0d2137,#1a3550)",
            borderRadius: 12, aspectRatio: "16/9", position: "relative",
            overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: 240
          }}>
            {/* Fundo decorativo */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 60% at 30% 40%,rgba(26,140,130,.2) 0%,transparent 70%)", pointerEvents: "none" }} />

            {presenca !== "entrou" ? (
              /* Sala gerada, aguardando */
              <div style={{ textAlign: "center", color: "#fff", position: "relative", zIndex: 1, padding: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sala criada</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 20, lineHeight: 1.7, maxWidth: 280 }}>
                  Envie o link ao paciente. Quando ele entrar na sala de espera,<br />
                  o status mudará para <strong style={{ color: "#4ade80" }}>✅ Na sala</strong> e você poderá iniciar a chamada.
                </div>
                {/* Link */}
                <div style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "8px 12px", fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.6)", marginBottom: 12, wordBreak: "break-all", textAlign: "left", maxWidth: 360 }}>
                  {sala?.linkPac}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => navigator.clipboard?.writeText(sala?.linkPac || "")}
                    style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    📋 Copiar link
                  </button>
                  <button
                    onClick={() => {
                      if (!sala) return;
                      const msg = `Olá! Sua videoconsulta está pronta:\n${sala.linkPac}`;
                      window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg), "_blank");
                    }}
                    style={{ background: "#25D366", border: "none", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    📱 WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              /* Paciente na sala → botão iniciar chamada */
              <div style={{ textAlign: "center", color: "#fff", position: "relative", zIndex: 1, padding: 24 }}>
                <div style={{ fontSize: 52, marginBottom: 12, animation: "pulse 1.5s infinite" }}>🟢</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{paciente.nome} está na sala!</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginBottom: 24 }}>
                  Clique para abrir a videochamada em uma nova aba
                </div>
                <button
                  onClick={() => sala && window.open(sala.linkMed, "_blank")}
                  style={{
                    background: "linear-gradient(135deg,#1A8C82,#22B5A8)",
                    border: "none", color: "#fff", borderRadius: 12,
                    padding: "16px 40px", fontSize: 16, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 6px 24px rgba(26,140,130,.5)",
                    display: "flex", alignItems: "center", gap: 10, margin: "0 auto"
                  }}
                >
                  📹 Iniciar videochamada
                </button>
                <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                  Abre em nova aba · WebRTC peer-to-peer
                </div>
              </div>
            )}
          </div>

          {/* Controles inferiores */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {sala && (
              <button
                onClick={() => window.open(sala.linkMed, "_blank")}
                title="Abrir sala da médica"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", height: 36, borderRadius: 8, background: C.teal, border: "none", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                📹 Abrir minha sala
              </button>
            )}
            <button onClick={() => setShowReceita(true)} style={{ padding: "0 12px", height: 36, borderRadius: 8, border: `0.5px solid ${C.gold}`, background: "white", color: C.gold, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              + Receita
            </button>
            <button onClick={() => setShowAtestado(true)} style={{ padding: "0 12px", height: 36, borderRadius: 8, border: `0.5px solid ${C.green}`, background: "white", color: C.green, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              + Atestado
            </button>
            <button onClick={onEncerrar} style={{ padding: "0 16px", height: 36, borderRadius: 8, background: C.red, border: "none", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              Encerrar
            </button>
          </div>
        </div>

        {/* Prontuário lateral — inalterado */}
        <div style={{ background: "white", border: "0.5px solid #e0d8cc", borderRadius: 12, display: "flex", flexDirection: "column", maxHeight: 380, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #e0d8cc", fontSize: 13, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Prontuário
            <span style={{ fontSize: 11, color: C.green }}>● aberto</span>
          </div>
          <div style={{ overflowY: "auto", padding: "12px 14px", flex: 1 }}>
            {[
              ["Diagnósticos", paciente.diagnosticos?.join(", ") || "—"],
              ["Medicações",   paciente.medicacoes?.join(", ")   || "—"],
              ["Último exame", paciente.ultimoExame               || "—"],
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

      {/* Receita e Atestado gerados — inalterado */}
      {(receitaGerada || atestadoGerado) && (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          {receitaGerada && (
            <div style={{ flex: 1, background: "#fff9f0", border: "0.5px solid #e8d5b0", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: "#8a6a32", marginBottom: 6 }}>📄 Receita — {receitaGerada.data}</div>
              <div><strong>Paciente:</strong> {receitaGerada.paciente}</div>
              <div><strong>Medicamento:</strong> {receitaGerada.medicamento}</div>
              <div><strong>Posologia:</strong> {receitaGerada.posologia} · {receitaGerada.dias} dias</div>
              <div><strong>CRM:</strong> {receitaGerada.crm}</div>
            </div>
          )}
          {atestadoGerado && (
            <div style={{ flex: 1, background: "#f0f7ee", border: "0.5px solid #b7e1c7", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: C.green, marginBottom: 6 }}>📋 Atestado — {atestadoGerado.data}</div>
              <div><strong>Paciente:</strong> {atestadoGerado.paciente}</div>
              <div><strong>Afastamento:</strong> {atestadoGerado.dias} dia(s)</div>
              <div><strong>CRM:</strong> {atestadoGerado.crm}</div>
            </div>
          )}
        </div>
      )}

      {showReceita && (
        <Modal onClose={() => setShowReceita(false)} title="Nova receita">
          <TeleField label="Medicamento" value={receitaData.medicamento} onChange={v => setReceitaData(d => ({ ...d, medicamento: v }))} placeholder="Ex: Omeprazol 20mg" />
          <TeleField label="Posologia"   value={receitaData.posologia}   onChange={v => setReceitaData(d => ({ ...d, posologia: v }))}   placeholder="Ex: 1 comprimido em jejum" />
          <TeleField label="Duração (dias)" value={receitaData.dias}     onChange={v => setReceitaData(d => ({ ...d, dias: v }))}         placeholder="30" />
          <TeleBtn onClick={gerarReceita} style={{ width: "100%", marginTop: 12 }}>Gerar receita</TeleBtn>
        </Modal>
      )}
      {showAtestado && (
        <Modal onClose={() => setShowAtestado(false)} title="Atestado médico">
          <TeleField label="Dias de afastamento" value={atestadoDias} onChange={setAtestadoDias} placeholder="1" />
          <TeleBtn onClick={gerarAtestado} color={C.green} style={{ width: "100%", marginTop: 12 }}>Gerar atestado</TeleBtn>
        </Modal>
      )}
    </div>
  );
}


// ────────────────────────────────────────────────────────────────
// [5/5] NENHUMA MUDANÇA em PageTelemedicina — já usa os componentes
//       atualizados acima. Nada a fazer.
// ────────────────────────────────────────────────────────────────
//
// DEPLOY CHECKLIST:
// ─────────────────
// ✅ 1. Copie videoconsulta-sala.html para a raiz pública do projeto
//       (mesmo diretório que index.html / public/)
// ✅ 2. No Vercel: vercel.json -> adicione a rota se necessário:
//       { "rewrites": [{ "source": "/videoconsulta-sala.html", "destination": "/videoconsulta-sala.html" }] }
// ✅ 3. Substitua os 4 blocos acima no App.jsx pelos novos
// ✅ 4. Para múltiplos usuários simultâneos em browsers diferentes:
//       Substitua salaSetState/salaGetState por Firebase RTDB:
//       firebase.database().ref(`rooms/${roomId}/state`).set(data)
//       — a lógica de negócio permanece idêntica
// ────────────────────────────────────────────────────────────────
