import { useState, useMemo } from "react";

// 📣 CAMPAÑAS DE WHATSAPP — recuperar clientes, evitar que se vayan y lograr la segunda visita.
// Cada envío queda registrado (quién, cuándo, a quién, qué mensaje) en la colección "campanasEnvios",
// y el sistema mide solo si el cliente VOLVIÓ después del mensaje y cuánto gastó.

const C = { navy: "#001847", mint: "#00E5B8", cyan: "#4DD9E8", azul: "#1a3c5e", gris: "#888" };
const DIA = 86400000;
const VENTANA_RETORNO_DIAS = 30;   // si vuelve dentro de 30 días después del mensaje, cuenta como "volvió"
const NO_REPETIR_DIAS = 21;        // no volver a escribir al mismo cliente antes de 21 días
const LIMITE_DIARIO = 10;          // sugerido para que WhatsApp no marque el número como spam

const SEGMENTOS = [
  {
    id: "recuperar", icon: "💔", l: "Recuperar",
    desc: "3 o más visitas y más de 45 días sin venir",
    filtro: (c) => c.visitas >= 3 && c.diasSin > 45,
    plantilla: "¡Hola {nombre}! 👋 Te extrañamos en Lava & Listo 💙. Solo para ti: {promo}, {vigencia}. Tu código: *{codigo}* — muéstralo al dejar tus prendas 📲. ¡Te esperamos!",
  },
  {
    id: "riesgo", icon: "⚠️", l: "En riesgo",
    desc: "2 o más visitas y entre 30 y 45 días sin venir",
    filtro: (c) => c.visitas >= 2 && c.diasSin >= 30 && c.diasSin <= 45,
    plantilla: "¡Hola {nombre}! 😊 En Lava & Listo te tenemos una promo: {promo}, {vigencia}. Tu código: *{codigo}* — muéstralo al dejar tus prendas 📲. ¿Te esperamos?",
  },
  {
    id: "segunda", icon: "🔁", l: "Segunda visita",
    desc: "1 sola visita, hace entre 14 y 90 días",
    filtro: (c) => c.visitas === 1 && c.diasSin >= 14 && c.diasSin <= 90,
    plantilla: "¡Hola {nombre}! Gracias por confiar en Lava & Listo 💙. Para tu segunda visita tienes {promo}, {vigencia}. Tu código: *{codigo}* — muéstralo al dejar tus prendas 📲. ¡Te esperamos!",
  },
];

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const telWA = (t) => {
  const d = String(t || "").replace(/\D/g, "");
  if (/^09\d{8}$/.test(d)) return "593" + d.slice(1);
  if (/^5939\d{8}$/.test(d)) return d;
  return "";
};

const categoria = (label) => {
  const s = norm(label);
  if (/ZAPAT|PAR|TENIS|CALZADO|BOTA|SANDAL|SNEAK|ZAPATILLA|MOCASIN|TACON/.test(s)) return "calzado";
  if (/EDRED|COBIJ|COBERT|PLUMON|CUBRECAMA|FRAZAD|SABANA/.test(s)) return "edredon";
  return "otro";
};
const textoServicio = (cat) =>
  cat === "calzado" ? "tu próximo lavado de zapatos"
  : cat === "edredon" ? "tu próximo edredón o cobija"
  : "tu próximo lavado de zapatos o edredón";

// 🎁 Promo según lo que el cliente suele traer. Si vino por zapatos → promo de zapatos, etc.
// Ropa por libra NO lleva descuento: se le ofrece entrega a domicilio gratis en Ricaurte.
const PROMOS_DEFAULT = {
  calzado: "2 pares de zapatos por $4.99 👟 (precio exclusivo de esta campaña)",
  edredon: "el segundo edredón al 50% de descuento 🛏️ (aplican restricciones)",
  otro: "entrega a domicilio GRATIS de tu ropa en Ricaurte 🛵",
};
const TIPO_CUPON = { calzado: "CAMP_ZAPATOS", edredon: "CAMP_EDREDON", otro: "CAMP_ENTREGA", custom: "CAMP_OTRA" };
const DIAS_N = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_N = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const finDeMes = () => { const d = new Date(); return hoyLocal().slice(0, 8) + String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0"); };
const textoVigencia = (dias, hasta) => {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const ds = orden.filter((d) => dias.includes(d)).map((d) => DIAS_N[d]);
  const lista = ds.length <= 1 ? ds.join("") : ds.slice(0, -1).join(", ") + " y " + ds[ds.length - 1];
  const [y, m, d] = (hasta || "").split("-").map(Number);
  const esFinMes = hasta && new Date(y, m, 0).getDate() === d;
  const cuando = esFinMes ? "de " + MESES_N[m - 1] : "hasta el " + d + " de " + MESES_N[m - 1];
  return (ds.length ? "válido solo los " + lista + " " : "válido ") + cuando;
};
const genCodigo = (existentes) => {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 50; i++) {
    let c = "LL-C-"; for (let j = 0; j < 4; j++) c += abc[Math.floor(Math.random() * abc.length)];
    if (!existentes.some((x) => x.id === c || x.codigo === c)) return c;
  }
  return "LL-C-" + Date.now().toString(36).toUpperCase().slice(-4);
};

const PROMO_LABEL = { calzado: "👟 Vino por zapatos", edredon: "🛏️ Vino por edredones/cobijas", otro: "👕 Vino por ropa (entrega gratis en Ricaurte)" };

const fmtF = (iso) => { try { return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return ""; } };

export default function Campanas({ ventas = [], clientes = [], envios = [], setEnvios, upsertEnvio, cupones = [], setCupones, upsertCupon, sesion }) {
  const [seg, setSeg] = useState("recuperar");
  const [vista, setVista] = useState("lista"); // lista | historial
  const [plantillas, setPlantillas] = useState(() => {
    try { return { ...Object.fromEntries(SEGMENTOS.map((s) => [s.id, s.plantilla])), ...JSON.parse(localStorage.getItem("ll_campanas_plantillas_v3") || "{}") }; }
    catch { return Object.fromEntries(SEGMENTOS.map((s) => [s.id, s.plantilla])); }
  });
  const [editando, setEditando] = useState(false);
  const [editPromos, setEditPromos] = useState(false);
  const [vig, setVig] = useState(() => {
    const def = { dias: [4, 5], hasta: finDeMes() };
    try { const v = JSON.parse(localStorage.getItem("ll_campanas_vigencia") || "null"); return v && v.hasta >= hoyLocal() ? v : def; } catch { return def; }
  });
  const guardarVig = (v) => { setVig(v); try { localStorage.setItem("ll_campanas_vigencia", JSON.stringify(v)); } catch {} };
  const vigTxt = textoVigencia(vig.dias, vig.hasta);
  const [abierto, setAbierto] = useState(null);       // cliente con historial abierto
  const [eleccion, setEleccion] = useState({});       // promo elegida por cliente: calzado | edredon | otro | custom
  const [personal, setPersonal] = useState({});       // texto de promo personalizada por cliente
  const [promos, setPromos] = useState(() => {
    try { return { ...PROMOS_DEFAULT, ...JSON.parse(localStorage.getItem("ll_campanas_promos_v2") || "{}") }; }
    catch { return PROMOS_DEFAULT; }
  });
  const guardarPromo = (k, txt) => {
    const p = { ...promos, [k]: txt };
    setPromos(p);
    try { localStorage.setItem("ll_campanas_promos_v2", JSON.stringify(p)); } catch {}
  };
  const [verContactados, setVerContactados] = useState(false);
  const ahora = Date.now();

  const guardarPlantilla = (txt) => {
    const p = { ...plantillas, [seg]: txt };
    setPlantillas(p);
    try { localStorage.setItem("ll_campanas_plantillas_v3", JSON.stringify(p)); } catch {}
  };

  // Ventas válidas (sin anuladas ni en $0)
  const vValidas = useMemo(() => (ventas || []).filter((v) => v && v.folio && !v.anulada && Number(v.total) > 0 && v.fecha), [ventas]);

  // Resumen por cliente
  const resumen = useMemo(() => {
    const porId = new Map();
    (clientes || []).forEach((c) => { if (c && !c.eliminada) porId.set(String(c.id), c); });
    const m = new Map();
    vValidas.forEach((v) => {
      const cli = porId.get(String(v.clienteId));
      if (cli?.esInterno) return;
      const key = v.clienteId != null && v.clienteId !== "" ? "id:" + v.clienteId : "n:" + norm(v.clienteNombre);
      const t = new Date(v.fecha).getTime();
      let r = m.get(key);
      if (!r) {
        r = { key, clienteId: v.clienteId, nombre: (cli?.nombre || v.clienteNombre || "").trim(), tel: cli?.tel || v.clienteTel || "", visitas: 0, gasto: 0, ultima: 0, cats: {}, compras: [] };
        m.set(key, r);
      }
      r.visitas++; r.gasto += Number(v.total) || 0;
      r.compras.push({ folio: v.folio, fecha: v.fecha, total: Number(v.total) || 0, items: (v.items || []).map((it) => it.label).filter(Boolean) });
      if (t > r.ultima) r.ultima = t;
      (v.items || []).forEach((it) => { const c = categoria(it.label); r.cats[c] = (r.cats[c] || 0) + 1; });
    });
    return [...m.values()].map((r) => {
      const top = Object.entries(r.cats).filter(([k]) => k !== "otro").sort((a, b) => b[1] - a[1])[0]?.[0] || "otro";
      r.compras.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      return { ...r, diasSin: Math.floor((ahora - r.ultima) / DIA), servicio: top, wa: telWA(r.tel) };
    });
  }, [vValidas, clientes]);

  // Último envío por cliente
  const ultimoEnvio = useMemo(() => {
    const m = new Map();
    (envios || []).forEach((e) => { const k = e.clienteKey; if (!m.has(k) || e.fecha > m.get(k).fecha) m.set(k, e); });
    return m;
  }, [envios]);

  // Resultado de cada envío: ¿volvió dentro de la ventana?
  const resultado = (e) => {
    const t0 = new Date(e.fecha).getTime();
    const vs = vValidas.filter((v) => {
      const mismo = e.clienteId != null && e.clienteId !== "" ? String(v.clienteId) === String(e.clienteId) : norm(v.clienteNombre) === norm(e.clienteNombre);
      const t = new Date(v.fecha).getTime();
      return mismo && t > t0 && t <= t0 + VENTANA_RETORNO_DIAS * DIA;
    });
    return { volvio: vs.length > 0, monto: vs.reduce((s, v) => s + (Number(v.total) || 0), 0), primera: vs.map((v) => v.fecha).sort()[0] };
  };

  const segActual = SEGMENTOS.find((s) => s.id === seg);
  const lista = resumen
    .filter(segActual.filtro)
    .map((c) => {
      const ue = ultimoEnvio.get(c.key);
      const reciente = ue && ahora - new Date(ue.fecha).getTime() < NO_REPETIR_DIAS * DIA;
      return { ...c, ue, reciente };
    })
    .filter((c) => verContactados || !c.reciente)
    .sort((a, b) => b.gasto - a.gasto);

  const hoyStr = new Date().toISOString().slice(0, 10);
  const enviadosHoy = (envios || []).filter((e) => (e.fecha || "").slice(0, 10) === hoyStr).length;

  const promoDe = (c) => {
    const k = eleccion[c.key] || c.servicio;
    if (k === "custom") return (personal[c.key] || "").trim() || promos[c.servicio] || promos.otro;
    return promos[k] || promos.otro;
  };

  const mensajePara = (c, codigo = "LL-C-••••") => plantillas[seg]
    .replaceAll("{vigencia}", vigTxt)
    .replaceAll("{codigo}", codigo)
    .replaceAll("{nombre}", (c.nombre.split(" ")[0] || "").charAt(0) + (c.nombre.split(" ")[0] || "").slice(1).toLowerCase())
    .replaceAll("{servicio}", textoServicio(c.servicio))
    .replaceAll("{promo}", promoDe(c));

  const enviar = (c) => {
    if (!c.wa) return;
    if (enviadosHoy >= LIMITE_DIARIO && !window.confirm(`Ya van ${enviadosHoy} mensajes hoy. Se recomienda máximo ${LIMITE_DIARIO} al día para que WhatsApp no bloquee el número. ¿Enviar de todas formas?`)) return;
    const codigo = genCodigo(cupones || []);
    const msg = mensajePara(c, codigo);
    const tipoPromo = eleccion[c.key] || c.servicio;
    const cupon = {
      id: codigo, codigo, campana: true, tipo: TIPO_CUPON[tipoPromo] || "CAMP_OTRA",
      promoTitulo: promoDe(c), precio: tipoPromo === "calzado" ? 4.99 : null,
      clienteId: c.clienteId ?? null, clienteNombre: c.nombre, telefono: c.tel || "",
      fechaEmision: new Date().toISOString(), fechaInicio: hoyLocal(), fechaFin: vig.hasta, caduca: vig.hasta,
      dias: vig.dias, reglaAplicada: "campaña " + seg, segmento: seg,
      estado: "vigente", folioCanje: null, fechaCanje: null, facturadoPorCanje: null, mensajeEnviado: true,
      generadoPor: sesion?.nombre || "",
    };
    setCupones && setCupones((p) => [cupon, ...(p || [])]);
    upsertCupon && upsertCupon(cupon);
    window.open("https://wa.me/" + c.wa + "?text=" + encodeURIComponent(msg), "_blank");
    const e = {
      id: "ENV-" + Date.now().toString(36).toUpperCase(),
      fecha: new Date().toISOString(),
      segmento: seg,
      clienteKey: c.key,
      clienteId: c.clienteId ?? null,
      clienteNombre: c.nombre,
      tel: c.wa,
      mensaje: msg,
      codigo,
      servicioHabitual: c.servicio,
      promo: promoDe(c),
      promoTipo: eleccion[c.key] || c.servicio,
      visitasAlEnviar: c.visitas,
      diasSinAlEnviar: c.diasSin,
      enviadoPor: sesion?.nombre || "",
    };
    setEnvios && setEnvios((p) => [e, ...(p || [])]);
    upsertEnvio && upsertEnvio(e);
  };

  // KPIs
  const kpis = useMemo(() => {
    const evaluables = (envios || []).filter((e) => e.fecha);
    let volvieron = 0, monto = 0;
    evaluables.forEach((e) => { const r = resultado(e); if (r.volvio) { volvieron++; monto += r.monto; } });
    return { total: evaluables.length, volvieron, monto, pct: evaluables.length ? Math.round((volvieron / evaluables.length) * 100) : 0 };
  }, [envios, vValidas]);

  const st = {
    card: { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 6px rgba(26,60,94,.08)" },
    pill: (a) => ({ padding: "7px 12px", borderRadius: 20, border: "1.5px solid " + (a ? C.azul : "#d0dce8"), background: a ? C.azul : "#f8fbfd", color: a ? "#fff" : C.gris, fontSize: 12, cursor: "pointer", fontWeight: 600 }),
    kpi: { background: "#fff", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 6px rgba(26,60,94,.08)", textAlign: "center" },
    btnWA: (ok) => ({ background: ok ? "#25D366" : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: ok ? "pointer" : "not-allowed", whiteSpace: "nowrap" }),
  };

  return (
    <div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.azul, marginBottom: 12, fontWeight: 700 }}>📣 Campañas WhatsApp</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
        <div style={st.kpi}><div style={{ fontSize: 20, fontWeight: 800, color: C.azul }}>{kpis.total}</div><div style={{ fontSize: 11, color: C.gris }}>Enviados</div></div>
        <div style={st.kpi}><div style={{ fontSize: 20, fontWeight: 800, color: "#2e7d32" }}>{kpis.volvieron}</div><div style={{ fontSize: 11, color: C.gris }}>Volvieron</div></div>
        <div style={st.kpi}><div style={{ fontSize: 20, fontWeight: 800, color: C.azul }}>{kpis.pct}%</div><div style={{ fontSize: 11, color: C.gris }}>Retorno</div></div>
        <div style={st.kpi}><div style={{ fontSize: 20, fontWeight: 800, color: "#2e7d32" }}>${kpis.monto.toFixed(0)}</div><div style={{ fontSize: 11, color: C.gris }}>Generado</div></div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button style={st.pill(vista === "lista")} onClick={() => setVista("lista")}>📋 Por enviar</button>
        <button style={st.pill(vista === "historial")} onClick={() => setVista("historial")}>🗂️ Historial y resultados</button>
      </div>

      {vista === "lista" && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {SEGMENTOS.map((s) => (
              <button key={s.id} style={st.pill(seg === s.id)} onClick={() => { setSeg(s.id); setEditando(false); }}>
                {s.icon} {s.l} ({resumen.filter(s.filtro).length})
              </button>
            ))}
          </div>

          <div style={st.card}>
            <div style={{ fontSize: 12, color: C.gris, marginBottom: 6 }}>{segActual.desc}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.azul, marginBottom: 4 }}>Mensaje ({"{nombre}"}, {"{promo}"}, {"{vigencia}"} y {"{codigo}"} se completan solos)</div>
            {editando ? (
              <>
                <textarea value={plantillas[seg]} onChange={(e) => guardarPlantilla(e.target.value)} rows={4}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #d0dce8", fontSize: 13, fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button style={st.pill(true)} onClick={() => setEditando(false)}>✓ Listo</button>
                  <button style={st.pill(false)} onClick={() => guardarPlantilla(segActual.plantilla)}>Restaurar</button>
                </div>
              </>
            ) : (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 10, fontSize: 13, color: "#333" }}>
                {plantillas[seg]} <button onClick={() => setEditando(true)} style={{ border: "none", background: "none", color: "#2563a8", cursor: "pointer", fontWeight: 700 }}>✏️ Editar</button>
              </div>
            )}
          </div>

          <div style={st.card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.azul, marginBottom: 6 }}>📅 Vigencia del cupón</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button key={d} style={{ ...st.pill(vig.dias.includes(d)), padding: "4px 9px", fontSize: 11 }}
                  onClick={() => guardarVig({ ...vig, dias: vig.dias.includes(d) ? vig.dias.filter((x) => x !== d) : [...vig.dias, d] })}>
                  {DIAS_N[d].slice(0, 3)}
                </button>
              ))}
              <span style={{ fontSize: 11, color: C.gris, alignSelf: "center", marginLeft: 6 }}>hasta</span>
              <input type="date" value={vig.hasta} min={hoyLocal()} onChange={(e) => e.target.value && guardarVig({ ...vig, hasta: e.target.value })}
                style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1.5px solid #d0dce8" }} />
            </div>
            <div style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>➜ "{vigTxt}" · cada mensaje lleva un código único que se canjea en Venta › Cupón</div>
          </div>

          <div style={st.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.azul }}>🎁 Promo según lo que trae el cliente</div>
              <button onClick={() => setEditPromos(!editPromos)} style={{ border: "none", background: "none", color: "#2563a8", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{editPromos ? "✓ Listo" : "✏️ Editar"}</button>
            </div>
            {Object.keys(PROMOS_DEFAULT).map((k) => (
              <div key={k} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: C.gris }}>{PROMO_LABEL[k]} · {lista.filter((c) => c.servicio === k).length} en este grupo</div>
                {editPromos
                  ? <input value={promos[k]} onChange={(e) => guardarPromo(k, e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1.5px solid #d0dce8", fontSize: 13 }} />
                  : <div style={{ fontSize: 13, color: "#333", fontWeight: 600 }}>{promos[k]}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: enviadosHoy >= LIMITE_DIARIO ? "#c62828" : C.gris, fontWeight: 600 }}>Hoy: {enviadosHoy}/{LIMITE_DIARIO} mensajes</span>
            <label style={{ display: "flex", gap: 5, alignItems: "center", color: "#555", cursor: "pointer" }}>
              <input type="checkbox" checked={verContactados} onChange={(e) => setVerContactados(e.target.checked)} />
              Ver también los contactados hace menos de {NO_REPETIR_DIAS} días
            </label>
          </div>

          {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20, fontSize: 13 }}>No hay clientes pendientes en este grupo 🎉</div>}
          {lista.map((c) => (
            <div key={c.key} style={{ ...st.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: c.reciente ? 0.6 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: C.azul, fontSize: 14 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: C.gris }}>
                  {c.visitas} visita{c.visitas > 1 ? "s" : ""} · ${c.gasto.toFixed(2)} · hace {c.diasSin} días
                  {c.servicio !== "otro" && <> · {c.servicio === "calzado" ? "👟" : "🛏️"}</>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.gris }}>🎁 Ofrecer:</span>
                  <select value={eleccion[c.key] || c.servicio} onChange={(e) => setEleccion({ ...eleccion, [c.key]: e.target.value })}
                    style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1.5px solid #d0dce8", background: "#f8fbfd", color: C.azul, maxWidth: 260 }}>
                    <option value="calzado">👟 {promos.calzado}</option>
                    <option value="edredon">🛏️ {promos.edredon}</option>
                    <option value="otro">🛵 {promos.otro}</option>
                    <option value="custom">✍️ Otra promo (escribir)</option>
                  </select>
                  <button onClick={() => setAbierto(abierto === c.key ? null : c.key)}
                    style={{ border: "none", background: "#e8f0f7", color: C.azul, borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {abierto === c.key ? "▲ Ocultar compras" : "🧾 Ver compras (" + c.compras.length + ")"}
                  </button>
                </div>
                {(eleccion[c.key] || c.servicio) === "custom" && (
                  <input placeholder="Ej: lavado de mochila a $3" value={personal[c.key] || ""} onChange={(e) => setPersonal({ ...personal, [c.key]: e.target.value })}
                    style={{ marginTop: 4, width: "100%", padding: 6, borderRadius: 6, border: "1.5px solid #d0dce8", fontSize: 12 }} />
                )}
                <div style={{ marginTop: 6, background: "#dcf8c6", borderRadius: "10px 10px 10px 2px", padding: "8px 10px", fontSize: 12, color: "#111", maxWidth: 440, boxShadow: "0 1px 1px rgba(0,0,0,.1)", whiteSpace: "pre-wrap" }}>
                  {mensajePara(c)}
                </div>
                {abierto === c.key && (
                  <div style={{ marginTop: 8, background: "#f8fbfd", borderRadius: 8, padding: 8, border: "1px solid #e8f0f7" }}>
                    {(() => {
                      const cnt = { calzado: 0, edredon: 0, otro: 0 };
                      c.compras.forEach((v) => v.items.forEach((l) => { cnt[categoria(l)]++; }));
                      return (
                        <div style={{ fontSize: 11, color: C.azul, fontWeight: 700, marginBottom: 6 }}>
                          👟 Zapatos: {cnt.calzado} · 🛏️ Edredones/cama: {cnt.edredon} · 👕 Ropa y otros: {cnt.otro} · Ticket prom.: ${(c.gasto / c.visitas).toFixed(2)}
                        </div>
                      );
                    })()}
                    {c.compras.map((v) => (
                      <div key={v.folio} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, padding: "4px 0", borderTop: "1px dashed #e0e8f0" }}>
                        <span style={{ color: C.gris, whiteSpace: "nowrap" }}>{fmtF(v.fecha)}</span>
                        <span style={{ flex: 1, color: "#333" }}>{v.items.join(" · ") || "—"}</span>
                        <span style={{ fontWeight: 700, color: C.azul }}>${v.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {c.ue && <div style={{ fontSize: 11, color: "#2563a8" }}>Último mensaje: {fmtF(c.ue.fecha)} por {c.ue.enviadoPor || "—"}</div>}
                {!c.wa && <div style={{ fontSize: 11, color: "#c62828", fontWeight: 600 }}>⚠️ Sin teléfono válido — complétalo en Clientes</div>}
              </div>
              <button style={st.btnWA(!!c.wa)} disabled={!c.wa} onClick={() => enviar(c)}>📲 Enviar</button>
            </div>
          ))}
        </>
      )}

      {vista === "historial" && (
        <div>
          {(envios || []).length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20, fontSize: 13 }}>Aún no se han enviado mensajes.</div>}
          {[...(envios || [])].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).map((e) => {
            const r = resultado(e);
            const s = SEGMENTOS.find((x) => x.id === e.segmento);
            const vencido = ahora - new Date(e.fecha).getTime() > VENTANA_RETORNO_DIAS * DIA;
            return (
              <div key={e.id} style={{ ...st.card, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.azul, fontSize: 13 }}>{e.clienteNombre}</div>
                    <div style={{ fontSize: 11, color: C.gris }}>{s?.icon} {s?.l || e.segmento} · {fmtF(e.fecha)} · por {e.enviadoPor || "—"}</div>
                    {e.promo && <div style={{ fontSize: 11, color: "#2e7d32" }}>🎁 {e.promo}</div>}
                    {e.codigo && (() => { const cu = (cupones || []).find((x) => x.codigo === e.codigo); return (
                      <div style={{ fontSize: 11, color: cu?.estado === "usado" ? "#2e7d32" : "#555", fontWeight: 600 }}>
                        🎟️ {e.codigo} · {cu?.estado === "usado" ? "✅ Canjeado " + fmtF(cu.fechaCanje) : "Sin canjear"}
                      </div>); })()}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                    {r.volvio
                      ? <span style={{ color: "#2e7d32" }}>✅ Volvió {fmtF(r.primera)}<br />${r.monto.toFixed(2)}</span>
                      : vencido ? <span style={{ color: "#c62828" }}>❌ No volvió</span>
                      : <span style={{ color: "#e65100" }}>⏳ Esperando</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
