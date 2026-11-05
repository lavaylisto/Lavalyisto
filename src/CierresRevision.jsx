import { useState } from "react";

// 💰 CIERRES DE CAJA — revisión física (Dayana) y faltantes por colaboradora.
// Solo se consideran los cierres hechos con el sistema nuevo (soloEfectivo:true): se cuadra únicamente
// el EFECTIVO; transferencias y tarjeta se muestran como información.

const C = { azul: "#1a3c5e", gris: "#888", verde: "#2e7d32", rojo: "#c62828", azulC: "#1565c0" };
const $ = (n) => "$" + (Number(n) || 0).toFixed(2);
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDia = (dia) => { try { return new Date(dia + "T12:00:00").toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" }); } catch { return dia; } };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Diferencia final de un cierre: la que confirmó Dayana al revisar, o la del cierre si aún no se revisa
export const difFinalCierre = (c) => (c?.dEf ?? 0);
export const esCierreNuevo = (c) => c && c.tipo === "cierre" && c.soloEfectivo && !c.anulado;

// ¿Esta sesión puede aceptar cierres? Dayana Pacheco, Micaela (Mica) y Natalia (por nombre) o una empleada con aceptaCierres:true
export const puedeAceptarCierres = (sesion, empleadas = []) => {
  const emp = (empleadas || []).find((e) => String(e.id) === String(sesion?.id));
  const n = norm(sesion?.nombre) + " " + norm(emp?.nombre);
  return !!(emp?.aceptaCierres || (n.includes("dayana") && n.includes("pacheco")) || n.includes("micaela") || /\bmica\b/.test(n) || n.includes("natalia"));
};

const card = { background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 12, boxShadow: "0 1px 6px rgba(26,60,94,.08)", border: "1px solid #e8f0f7" };
const fila = { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" };
const btn = (bg) => ({ padding: "10px 12px", background: bg, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" });
const inp = { boxSizing: "border-box", width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #d0dce8", fontSize: 14 };

function Diferencia({ d, grande }) {
  const col = Math.abs(d) < 0.005 ? C.verde : d > 0 ? C.azulC : C.rojo;
  const txt = Math.abs(d) < 0.005 ? "✅ Cuadra" : d > 0 ? `📈 Sobrante ${$(d)}` : `⚠️ Faltante ${$(Math.abs(d))}`;
  return <span style={{ fontWeight: 800, color: col, fontSize: grande ? 18 : 13 }}>{txt}</span>;
}

// Resumen de un cierre: ventas en efectivo, transferencias, salidas y valor a depositar
export function ResumenCierre({ c }) {
  const salidas = c.misSalidas || [];
  return (
    <div>
      <div style={{ fontSize: 11, color: C.gris, fontWeight: 700, marginBottom: 2 }}>RESUMEN DE VENTAS</div>
      <div style={fila}><span>💵 Efectivo de ventas</span><strong>{$(c.espEfBruto)}</strong></div>
      <div style={fila}><span>🏦 Transferencias</span><strong>{$(c.espTr)}</strong></div>
      {(c.espTa || 0) > 0 && <div style={fila}><span>💳 Tarjeta</span><strong>{$(c.espTa)}</strong></div>}
      <div style={{ ...fila, color: C.gris, fontSize: 12 }}><span>Total cobrado</span><span>{$(c.tv)}</span></div>

      <div style={{ fontSize: 11, color: C.gris, fontWeight: 700, margin: "8px 0 2px" }}>SALIDAS DE CAJA</div>
      {salidas.length === 0 && <div style={{ fontSize: 12, color: "#aaa" }}>Sin salidas</div>}
      {salidas.map((s, i) => (
        <div key={s.id || i} style={{ ...fila, fontSize: 12, color: C.rojo }}><span>💸 {s.motivo || s.descripcion || s.concepto || "Salida"}</span><span>-{$(s.monto)}</span></div>
      ))}
      {salidas.length > 0 && <div style={{ ...fila, color: C.rojo }}><strong>Total salidas</strong><strong>-{$(c.totMisSalidas)}</strong></div>}

      <div style={{ borderTop: "1px dashed #d0dce8", marginTop: 6, paddingTop: 6 }}>
        <div style={fila}><span>Efectivo esperado (ventas − salidas)</span><strong>{$(c.espEf)}</strong></div>
        <div style={fila}><span>Efectivo contado por {c.emp?.split(" ")[0] || "colaboradora"}</span><strong>{$(c.efN)}</strong></div>
        <div style={fila}><span>Diferencia en el cierre</span><Diferencia d={c.dEf || 0} /></div>
      </div>
      <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "8px 10px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ color: C.azul }}>🏦 Valor a depositar</strong>
        <strong style={{ fontSize: 18, color: C.azul }}>{$(c.efN)}</strong>
      </div>
    </div>
  );
}

// ✅ Pantalla de Dayana: cierres de días anteriores pendientes de revisar el dinero físicamente
export function RevisionCierres({ cajas = [], upsertCaja, sesion }) {
  const hoy = hoyLocal();
  const [abierto, setAbierto] = useState(null);
  const [obs, setObs] = useState({});
  const [verAceptados, setVerAceptados] = useState(false);

  const cierres = (cajas || []).filter(esCierreNuevo);
  // Recién al día siguiente: solo cierres de días ANTERIORES a hoy
  const pendientes = cierres.filter((c) => !c.revision && c.dia < hoy).sort((a, b) => a.dia.localeCompare(b.dia) || (a.fecha || "").localeCompare(b.fecha || ""));
  const deHoy = cierres.filter((c) => !c.revision && c.dia === hoy).length;
  const aceptados = cierres.filter((c) => c.revision).sort((a, b) => (b.revision.fecha || "").localeCompare(a.revision.fecha || "")).slice(0, 15);

  const resolver = (c, estado) => {
    const motivo = (obs[c.id] || "").trim();
    if (estado === "rechazado" && !motivo) { alert("Escribe el motivo del rechazo"); return; }
    const msg = `¿${estado === "aceptado" ? "Aceptar" : "Rechazar"} el cierre de ${c.emp} del ${fmtDia(c.dia)}?${motivo ? "\n\nMotivo: " + motivo : ""}`;
    if (!window.confirm(msg)) return;
    const act = {
      ...c,
      revision: { estado, por: sesion?.nombre || "", porId: sesion?.id ?? null, fecha: new Date().toISOString(), motivo, difFinal: c.dEf ?? 0 },
      estadoRevision: estado,
    };
    if (upsertCaja) upsertCaja(act);
    setAbierto(null);
  };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.azul, fontWeight: 700, marginBottom: 4 }}>✅ Aceptar cierres de caja</div>
      <div style={{ fontSize: 12, color: C.gris, marginBottom: 12 }}>
        Revisa físicamente el dinero de cada cierre y acéptalo o recházalo. Los cierres aparecen aquí recién al día siguiente.
        {deHoy > 0 && <> Hoy hay {deHoy} cierre{deHoy > 1 ? "s que aparecerán" : " que aparecerá"} mañana.</>}
      </div>

      {pendientes.length === 0 && <div style={{ ...card, textAlign: "center", color: C.verde, fontWeight: 700 }}>🎉 No hay cierres pendientes de aceptar</div>}

      {pendientes.map((c) => {
        const abiertoEste = abierto === c.id;
        return (
          <div key={c.id} style={{ ...card, borderLeft: "4px solid " + ((c.dEf || 0) < 0 ? C.rojo : (c.dEf || 0) > 0 ? C.azulC : C.verde) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setAbierto(abiertoEste ? null : c.id)}>
              <div>
                <div style={{ fontWeight: 800, color: C.azul, fontSize: 14 }}>{c.emp}</div>
                <div style={{ fontSize: 12, color: C.gris, textTransform: "capitalize" }}>{fmtDia(c.dia)} · {new Date(c.fecha).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Diferencia d={c.dEf || 0} />
                <div style={{ fontSize: 11, color: C.gris }}>{abiertoEste ? "▲ cerrar" : "▼ revisar"}</div>
              </div>
            </div>
            {abiertoEste && (
              <div style={{ marginTop: 10 }}>
                <ResumenCierre c={c} />
                <div style={{ background: "#f8fbfd", borderRadius: 8, padding: 10, marginTop: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: C.azul }}>📝 Motivo (obligatorio si rechazas)</label>
                  <textarea rows={2} style={{ ...inp, fontSize: 13, marginTop: 4 }} value={obs[c.id] || ""} onChange={(e) => setObs({ ...obs, [c.id]: e.target.value })} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={{ ...btn("linear-gradient(135deg,#c62828,#e53935)"), flex: 1 }} onClick={() => resolver(c, "rechazado")}>✕ Rechazar</button>
                    <button style={{ ...btn("linear-gradient(135deg,#2e7d32,#388e3c)"), flex: 2 }} onClick={() => resolver(c, "aceptado")}>✅ Aceptar cierre</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button style={{ background: "none", border: "none", color: "#2563a8", fontWeight: 700, cursor: "pointer", fontSize: 13, margin: "6px 0" }} onClick={() => setVerAceptados(!verAceptados)}>
        {verAceptados ? "▲ Ocultar" : "🗂️ Ver"} últimos cierres revisados
      </button>
      {verAceptados && aceptados.map((c) => (
        <div key={c.id} style={{ ...card, padding: "8px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.azul, fontSize: 13 }}>{c.emp} · <span style={{ textTransform: "capitalize" }}>{fmtDia(c.dia)}</span></div>
              <div style={{ fontSize: 11, color: c.revision.estado === "rechazado" ? C.rojo : C.verde, fontWeight: 600 }}>{c.revision.estado === "rechazado" ? "✕ Rechazado" : "✅ Aceptado"} por {c.revision.por} · {new Date(c.revision.fecha).toLocaleString("es-EC")}</div>
              {c.revision.motivo && <div style={{ fontSize: 11, color: "#555" }}>📝 {c.revision.motivo}</div>}
            </div>
            <div style={{ textAlign: "right" }}><Diferencia d={c.dEf || 0} /><div style={{ fontSize: 11, color: C.gris }}>Depositar {$(c.efN)}</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ⚠️ Pantalla de la colaboradora: sus faltantes de caja (se descuentan a fin de mes)
export function FaltantesCaja({ cajas = [], sesion }) {
  const mesHoy = hoyLocal().slice(0, 7);
  const [mes, setMes] = useState(mesHoy);
  const mios = (cajas || []).filter((c) => esCierreNuevo(c) && String(c.empleadaId) === String(sesion?.id) && (c.dia || "").startsWith(mes))
    .sort((a, b) => b.dia.localeCompare(a.dia));
  const conFaltante = mios.filter((c) => difFinalCierre(c) < -0.004);
  const conSobrante = mios.filter((c) => difFinalCierre(c) > 0.004);
  const totFalt = conFaltante.reduce((a, c) => a + Math.abs(difFinalCierre(c)), 0);
  const totFaltConf = conFaltante.filter((c) => c.revision?.estado === "aceptado").reduce((a, c) => a + Math.abs(difFinalCierre(c)), 0);

  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: C.azul, fontWeight: 700, marginBottom: 10 }}>⚠️ Faltantes de caja</div>
      <input type="month" style={{ ...inp, marginBottom: 12, maxWidth: 200 }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />

      <div style={{ ...card, background: totFalt > 0 ? "#ffebee" : "#e8f5e9", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.gris }}>Total faltantes del mes</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: totFalt > 0 ? C.rojo : C.verde }}>{$(totFalt)}</div>
        {totFalt > 0 && <div style={{ fontSize: 12, color: C.rojo }}>Se descontará en tu rol de pagos de fin de mes. Aceptados: {$(totFaltConf)}</div>}
      </div>

      {mios.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20, fontSize: 13 }}>No tienes cierres en este mes.</div>}
      {mios.map((c) => {
        const d = difFinalCierre(c);
        return (
          <div key={c.id} style={{ ...card, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: C.azul, fontSize: 13, textTransform: "capitalize" }}>{fmtDia(c.dia)}</div>
                <div style={{ fontSize: 11, color: C.gris }}>
                  Esperado {$(c.espEf)} · Contado {$(c.efN)}
                </div>
                <div style={{ fontSize: 11, color: !c.revision ? "#e65100" : c.revision.estado === "rechazado" ? C.rojo : C.verde, fontWeight: 600 }}>
                  {!c.revision ? "⏳ Pendiente de revisión" : c.revision.estado === "rechazado" ? `✕ Rechazado por ${c.revision.por}` : `✔️ Aceptado por ${c.revision.por}`}
                </div>
                {c.revision?.motivo && <div style={{ fontSize: 11, color: "#555" }}>📝 {c.revision.motivo}</div>}
              </div>
              <Diferencia d={d} />
            </div>
          </div>
        );
      })}
      {conSobrante.length > 0 && <div style={{ fontSize: 11, color: C.gris, marginTop: 4 }}>Los sobrantes los regulariza la administradora.</div>}
    </div>
  );
}

// 🏦 Para Depósitos (admin): diferencias de cierre de un día y regularización de sobrantes
export function DiferenciasCierreDia({ dia, cajas = [], upsertCaja, esAdmin, sesion }) {
  const delDia = (cajas || []).filter((c) => esCierreNuevo(c) && c.dia === dia);
  if (delDia.length === 0) return null;
  const regularizar = (c) => {
    const nota = window.prompt(`Regularizar sobrante de ${$(difFinalCierre(c))} de ${c.emp}.\nEscribe el motivo o cómo se regularizó:`);
    if (nota == null) return;
    if (!nota.trim()) { alert("Escribe el motivo para regularizar"); return; }
    if (upsertCaja) upsertCaja({ ...c, sobranteRegularizado: { por: sesion?.nombre || "Administración", fecha: new Date().toISOString(), nota: nota.trim(), monto: difFinalCierre(c) } });
  };
  return (
    <div style={{ background: "#f8fbfd", borderRadius: 8, padding: "8px 10px", marginBottom: 10, border: "1px solid #e8f0f7" }}>
      <div style={{ fontSize: 12, color: C.gris, fontWeight: 700, marginBottom: 4 }}>CIERRES DE CAJA DEL DÍA</div>
      {delDia.map((c) => {
        const d = difFinalCierre(c);
        return (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0", borderTop: "1px dashed #e0e8f0", flexWrap: "wrap" }}>
            <div style={{ fontSize: 12 }}>
              <strong style={{ color: C.azul }}>{c.emp}</strong> · contado {$(c.efN)}
              <span style={{ color: !c.revision ? "#e65100" : c.revision.estado === "rechazado" ? C.rojo : C.verde, marginLeft: 6 }}>{!c.revision ? "⏳ sin revisar" : c.revision.estado === "rechazado" ? "✕ rechazado" : "✔️ aceptado"}</span>
              {c.revision?.estado === "rechazado" && c.revision.motivo && <div style={{ fontSize: 11, color: C.rojo }}>Motivo: {c.revision.motivo}</div>}
              {c.sobranteRegularizado && <div style={{ fontSize: 11, color: C.verde }}>✅ Sobrante regularizado por {c.sobranteRegularizado.por}: {c.sobranteRegularizado.nota}</div>}
              {d < -0.004 && <div style={{ fontSize: 11, color: C.rojo }}>Faltante: se descuenta a fin de mes</div>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Diferencia d={d} />
              {esAdmin && d > 0.004 && !c.sobranteRegularizado && (
                <button style={{ ...btn("#1565c0"), padding: "5px 9px", fontSize: 11 }} onClick={() => regularizar(c)}>Regularizar</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
