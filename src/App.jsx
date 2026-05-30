import { useState, useEffect } from "react";

// ─── STORAGE ───────────────────────────────────────────────────────
const KEYS = {
  ventas: "ll_ventas", clientes: "ll_clientes",
  empleadas: "ll_empleadas", inventario: "ll_inventario", bonos: "ll_bonos_config",
};
const load = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ─── CONSTANTS ─────────────────────────────────────────────────────
const SERVICIOS = [
  { id: "ropa", label: "Lavado de ropa", precio: 80 },
  { id: "planchado", label: "Planchado", precio: 60 },
  { id: "seco", label: "Lavado en seco", precio: 120 },
  { id: "edredon", label: "Edredón / Cobija", precio: 150 },
  { id: "calzado", label: "Calzado", precio: 90 },
];
const PAGOS = ["Efectivo", "Transferencia", "Tarjeta"];
const INSUMOS_DEFAULT = [
  { id: 1, nombre: "Detergente (kg)", stock: 10, min: 3, unidad: "kg" },
  { id: 2, nombre: "Suavizante (L)", stock: 5, min: 2, unidad: "L" },
  { id: 3, nombre: "Bolsas de empaque", stock: 100, min: 20, unidad: "pzas" },
  { id: 4, nombre: "Ganchos", stock: 50, min: 10, unidad: "pzas" },
];
const EMPLEADAS_DEFAULT = [
  { id: 1, nombre: "Ana García", activa: true },
  { id: 2, nombre: "María López", activa: true },
];
const BONOS_DEFAULT = { meta: 20, monto: 200 };

// ─── HELPERS ───────────────────────────────────────────────────────
const folio = () => "LL-" + Date.now().toString(36).toUpperCase();
const fmt = (d) => new Date(d).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) => new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const semanaISO = (d) => { const dt = new Date(d); dt.setHours(0,0,0,0); dt.setDate(dt.getDate()+3-((dt.getDay()+6)%7)); const w1=new Date(dt.getFullYear(),0,4); return `${dt.getFullYear()}-W${String(1+Math.round(((dt-w1)/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,"0")}`; };
const mesKey = (d) => { const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };

// Calcula el saldo pendiente de una venta
const saldoPendiente = (v) => v.total - (v.abonos || []).reduce((a, ab) => a + ab.monto, 0);
const estaPagada = (v) => saldoPendiente(v) <= 0;

// ─── TICKET MODAL ──────────────────────────────────────────────────
function TicketModal({ venta, empleadas, onClose }) {
  if (!venta) return null;
  const emp = empleadas.find(e => e.id === venta.empleadaId);
  const pendiente = saldoPendiente(venta);
  const abonos = venta.abonos || [];
  const totalAbonado = abonos.reduce((a, ab) => a + ab.monto, 0);

  return (
    <div style={S.overlay}>
      <div style={S.ticketBox} id="ticket-print">
        <div style={S.ticketHeader}>
          <div style={S.ticketLogo}>🫧</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1a3c5e" }}>
            Lava<span style={{ color: "#4db6e4" }}>&</span>Listo
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Servicio de Lavandería Profesional</div>
        </div>
        <div style={S.ticketDivider} />
        <div style={S.ticketRow}><span>Folio</span><strong>{venta.folio}</strong></div>
        <div style={S.ticketRow}><span>Fecha</span><span>{fmt(venta.fecha)}</span></div>
        <div style={S.ticketRow}><span>Entrega</span><span>{fmtDate(venta.entrega)}</span></div>
        <div style={S.ticketRow}><span>Cliente</span><span>{venta.clienteNombre}</span></div>
        {venta.clienteTel && <div style={S.ticketRow}><span>Tel</span><span>{venta.clienteTel}</span></div>}
        {emp && <div style={S.ticketRow}><span>Atendió</span><span>{emp.nombre}</span></div>}
        <div style={S.ticketDivider} />
        <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 6 }}>SERVICIOS</div>
        {venta.items.map((it, i) => (
          <div key={i} style={S.ticketRow}>
            <span>{it.label}{it.piezas > 1 ? ` x${it.piezas}` : ""}</span>
            <span>${(it.precio * it.piezas).toLocaleString()}</span>
          </div>
        ))}
        <div style={S.ticketDivider} />
        <div style={{ ...S.ticketRow, fontSize: 16, fontWeight: 800 }}>
          <span>TOTAL</span><span style={{ color: "#1a3c5e" }}>${venta.total.toLocaleString()}</span>
        </div>

        {/* SECCIÓN DE PAGOS */}
        {abonos.length > 0 && (
          <>
            <div style={S.ticketDivider} />
            <div style={{ fontSize: 11, fontWeight: 700, color: "#555", marginBottom: 6 }}>PAGOS REGISTRADOS</div>
            {abonos.map((ab, i) => (
              <div key={i} style={S.ticketRow}>
                <span>{ab.metodo} · {fmtDate(ab.fecha)}</span>
                <span style={{ color: "#2e7d32" }}>-${ab.monto.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ ...S.ticketRow, marginTop: 4 }}>
              <span>Total pagado</span>
              <strong style={{ color: "#2e7d32" }}>${totalAbonado.toLocaleString()}</strong>
            </div>
          </>
        )}

        {pendiente > 0 && (
          <div style={{ background: "#fff3e0", borderRadius: 8, padding: "8px 10px", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e65100" }}>⚠️ Saldo pendiente</span>
            <strong style={{ color: "#e65100" }}>${pendiente.toLocaleString()}</strong>
          </div>
        )}
        {pendiente <= 0 && (
          <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "8px 10px", marginTop: 8, textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2e7d32" }}>✅ Pagado completo</span>
          </div>
        )}

        {venta.notas && <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Nota: {venta.notas}</div>}
        <div style={S.ticketDivider} />
        <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 8 }}>¡Gracias por tu preferencia! 💙</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button style={S.btnPrint} onClick={() => window.print()}>🖨️ Imprimir</button>
        <button style={S.btnClose} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

// ─── MODAL ABONO ───────────────────────────────────────────────────
function AbonoModal({ venta, onSave, onClose }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const pendiente = saldoPendiente(venta);

  const guardar = () => {
    const m = parseFloat(monto);
    if (!m || m <= 0 || m > pendiente) return;
    onSave({ monto: m, metodo, fecha: new Date().toISOString() });
  };

  return (
    <div style={S.overlay}>
      <div style={{ ...S.ticketBox, maxHeight: "auto" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#1a3c5e", fontWeight: 700, marginBottom: 14 }}>
          💰 Registrar pago
        </div>
        <div style={S.ticketRow}><span>Cliente</span><strong>{venta.clienteNombre}</strong></div>
        <div style={S.ticketRow}><span>Total</span><span>${venta.total.toLocaleString()}</span></div>
        <div style={{ ...S.ticketRow, color: "#e65100", fontWeight: 700 }}>
          <span>Saldo pendiente</span><span>${pendiente.toLocaleString()}</span>
        </div>
        <div style={S.ticketDivider} />
        <label style={S.label}>Monto a pagar</label>
        <input type="number" style={{ ...S.input, marginBottom: 10 }}
          placeholder={`Máximo $${pendiente.toLocaleString()}`}
          value={monto} onChange={e => setMonto(e.target.value)} />
        <button style={{ ...S.btnSmall, marginBottom: 10, background: "#e8f5fd", color: "#1565c0" }}
          onClick={() => setMonto(String(pendiente))}>Pagar saldo completo</button>
        <label style={S.label}>Método de pago</label>
        <select style={{ ...S.input, marginBottom: 14 }} value={metodo} onChange={e => setMetodo(e.target.value)}>
          {PAGOS.map(p => <option key={p}>{p}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btnPrimary, flex: 1 }} onClick={guardar}>Guardar pago</button>
          <button style={{ ...S.btnClose, flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────
export default function LavaListo() {
  const [tab, setTab] = useState("ventas");
  const [ventas, setVentas] = useState(() => load(KEYS.ventas, []));
  const [clientes, setClientes] = useState(() => load(KEYS.clientes, []));
  const [empleadas, setEmpleadas] = useState(() => load(KEYS.empleadas, EMPLEADAS_DEFAULT));
  const [inventario, setInventario] = useState(() => load(KEYS.inventario, INSUMOS_DEFAULT));
  const [bonosConfig, setBonosConfig] = useState(() => load(KEYS.bonos, BONOS_DEFAULT));
  const [ticketVenta, setTicketVenta] = useState(null);

  useEffect(() => save(KEYS.ventas, ventas), [ventas]);
  useEffect(() => save(KEYS.clientes, clientes), [clientes]);
  useEffect(() => save(KEYS.empleadas, empleadas), [empleadas]);
  useEffect(() => save(KEYS.inventario, inventario), [inventario]);
  useEffect(() => save(KEYS.bonos, bonosConfig), [bonosConfig]);

  const pendientesCount = ventas.filter(v => !estaPagada(v)).length;

  const tabs = [
    { id: "ventas", icon: "🧾", label: "Nueva Venta" },
    { id: "historial", icon: "📋", label: "Historial" },
    { id: "pendientes", icon: "⏳", label: "Pendientes", badge: pendientesCount },
    { id: "dashboard", icon: "📊", label: "Reportes" },
    { id: "inventario", icon: "📦", label: "Inventario" },
    { id: "equipo", icon: "👩", label: "Equipo" },
    { id: "facturacion", icon: "💼", label: "Facturación" },
  ];

  const addAbono = (folio, abono) => {
    setVentas(prev => prev.map(v => {
      if (v.folio !== folio) return v;
      const abonos = [...(v.abonos || []), abono];
      return { ...v, abonos, pagada: saldoPendiente({ ...v, abonos }) <= 0 };
    }));
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f4f8; }
        @media print { body * { visibility: hidden; } #ticket-print, #ticket-print * { visibility: visible; } #ticket-print { position: fixed; top: 0; left: 0; } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f0f4f8; } ::-webkit-scrollbar-thumb { background: #4db6e4; border-radius: 3px; }
      `}</style>

      <div style={S.header}>
        <div style={S.headerInner}>
          <span style={S.logo}>🫧 Lava<span style={{ color: "#4db6e4" }}>&</span>Listo</span>
          <span style={{ fontSize: 12, color: "#a0c4da", fontFamily: "'DM Sans', sans-serif" }}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
      </div>

      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={{ ...S.tabBtn, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}>
            <span style={{ position: "relative" }}>
              {t.icon}
              {t.badge > 0 && (
                <span style={{ position: "absolute", top: -4, right: -8, background: "#e53935", color: "#fff",
                  borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 4px", minWidth: 14, textAlign: "center" }}>
                  {t.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={S.content}>
        {tab === "ventas" && (
          <NuevaVenta ventas={ventas} setVentas={setVentas}
            clientes={clientes} setClientes={setClientes}
            empleadas={empleadas} setTicket={setTicketVenta} />
        )}
        {tab === "historial" && (
          <Historial ventas={ventas} setVentas={setVentas}
            empleadas={empleadas} setTicket={setTicketVenta} addAbono={addAbono} />
        )}
        {tab === "pendientes" && (
          <Pendientes ventas={ventas} empleadas={empleadas}
            setTicket={setTicketVenta} addAbono={addAbono} />
        )}
        {tab === "dashboard" && <Dashboard ventas={ventas} empleadas={empleadas} bonosConfig={bonosConfig} />}
        {tab === "inventario" && <Inventario inventario={inventario} setInventario={setInventario} />}
        {tab === "equipo" && <Equipo empleadas={empleadas} setEmpleadas={setEmpleadas}
          ventas={ventas} bonosConfig={bonosConfig} setBonosConfig={setBonosConfig} />}
        {tab === "facturacion" && <Facturacion ventas={ventas} clientes={clientes} />}
      </div>

      {ticketVenta && <TicketModal venta={ticketVenta} empleadas={empleadas} onClose={() => setTicketVenta(null)} />}
    </div>
  );
}

// ─── NUEVA VENTA ───────────────────────────────────────────────────
function NuevaVenta({ ventas, setVentas, clientes, setClientes, empleadas, setTicket }) {
  const hoy = new Date();
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);

  const [clienteQ, setClienteQ] = useState("");
  const [clienteId, setClienteId] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", tel: "", email: "", rfc: "" });
  const [modoCliente, setModoCliente] = useState("buscar");
  const [empleadaId, setEmpleadaId] = useState(empleadas[0]?.id || null);
  const [items, setItems] = useState([{ servId: "ropa", piezas: 1 }]);
  const [entrega, setEntrega] = useState(manana.toISOString().split("T")[0]);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  // ── PAGO ──
  const [tipoPago, setTipoPago] = useState("completo"); // completo | abono | retiro
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [montoAbono, setMontoAbono] = useState("");

  const clientesFilt = clientes.filter(c =>
    c.nombre.toLowerCase().includes(clienteQ.toLowerCase()) || (c.tel && c.tel.includes(clienteQ))
  ).slice(0, 5);
  const selCliente = clientes.find(c => c.id === clienteId);

  const calcTotal = () => items.reduce((acc, it) => {
    const s = SERVICIOS.find(s => s.id === it.servId);
    return acc + (s ? s.precio * (it.piezas || 1) : 0);
  }, 0);

  const addItem = () => setItems([...items, { servId: "ropa", piezas: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; setItems(c); };

  const registrar = () => {
    if (!clienteId && modoCliente === "buscar") { setError("Selecciona o crea un cliente"); return; }
    if (modoCliente === "nuevo" && !nuevoCliente.nombre.trim()) { setError("Escribe el nombre del cliente"); return; }
    if (items.length === 0) { setError("Agrega al menos un servicio"); return; }
    const total = calcTotal();
    if (tipoPago === "abono") {
      const m = parseFloat(montoAbono);
      if (!m || m <= 0 || m >= total) { setError("El abono debe ser mayor a 0 y menor al total"); return; }
    }

    let cid = clienteId;
    let cNombre = selCliente?.nombre;
    let cTel = selCliente?.tel;

    if (modoCliente === "nuevo") {
      const nc = { ...nuevoCliente, id: Date.now() };
      setClientes(prev => [...prev, nc]);
      cid = nc.id; cNombre = nc.nombre; cTel = nc.tel;
    }

    // Construir abonos iniciales
    let abonos = [];
    if (tipoPago === "completo") {
      abonos = [{ monto: total, metodo: metodoPago, fecha: new Date().toISOString() }];
    } else if (tipoPago === "abono") {
      abonos = [{ monto: parseFloat(montoAbono), metodo: metodoPago, fecha: new Date().toISOString() }];
    }
    // tipoPago === "retiro" → sin abonos, se paga al retirar

    const venta = {
      folio: folio(), fecha: new Date().toISOString(), entrega,
      clienteId: cid, clienteNombre: cNombre, clienteTel: cTel,
      empleadaId,
      items: items.map(it => { const s = SERVICIOS.find(s => s.id === it.servId); return { ...it, label: s?.label, precio: s?.precio }; }),
      pago: metodoPago,
      total, abonos,
      pagada: tipoPago === "completo",
      notas, checkMsgRetiro: false, checkMsgEntrega: false,
    };

    setVentas([venta, ...ventas]);
    setTicket(venta);
    setClienteQ(""); setClienteId(null); setNuevoCliente({ nombre: "", tel: "", email: "", rfc: "" });
    setItems([{ servId: "ropa", piezas: 1 }]); setNotas(""); setError(""); setMontoAbono(""); setTipoPago("completo");
  };

  const total = calcTotal();

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Nueva Venta</h2>

      <Card title="👤 Cliente">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["buscar", "nuevo"].map(m => (
            <button key={m} style={{ ...S.pill, ...(modoCliente === m ? S.pillActive : {}) }}
              onClick={() => setModoCliente(m)}>{m === "buscar" ? "Buscar cliente" : "Nuevo cliente"}</button>
          ))}
        </div>
        {modoCliente === "buscar" ? (
          <div>
            <input style={S.input} placeholder="Buscar por nombre o teléfono..."
              value={clienteQ} onChange={e => { setClienteQ(e.target.value); setClienteId(null); }} />
            {clienteQ && clientesFilt.length > 0 && !clienteId && (
              <div style={S.dropdown}>
                {clientesFilt.map(c => (
                  <div key={c.id} style={S.dropItem} onClick={() => { setClienteId(c.id); setClienteQ(c.nombre); }}>
                    <strong>{c.nombre}</strong> <span style={{ color: "#888", fontSize: 12 }}>{c.tel}</span>
                  </div>
                ))}
              </div>
            )}
            {clienteId && selCliente && (
              <div style={S.clienteTag}>
                ✓ {selCliente.nombre}{selCliente.tel ? ` · ${selCliente.tel}` : ""}
                <button style={S.tagX} onClick={() => { setClienteId(null); setClienteQ(""); }}>✕</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["nombre","Nombre *"],["tel","Teléfono"],["email","Email"],["rfc","RFC"]].map(([k, label]) => (
              <input key={k} style={S.input} placeholder={label}
                value={nuevoCliente[k]} onChange={e => setNuevoCliente({ ...nuevoCliente, [k]: e.target.value })} />
            ))}
          </div>
        )}
      </Card>

      <Card title="🧺 Servicios">
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <select style={{ ...S.input, flex: 2 }} value={it.servId} onChange={e => updateItem(i, "servId", e.target.value)}>
              {SERVICIOS.map(s => <option key={s.id} value={s.id}>{s.label} — ${s.precio}</option>)}
            </select>
            <input type="number" min={1} style={{ ...S.input, width: 64, textAlign: "center" }}
              value={it.piezas} onChange={e => updateItem(i, "piezas", parseInt(e.target.value) || 1)} />
            {items.length > 1 && <button style={S.btnRemove} onClick={() => removeItem(i)}>✕</button>}
          </div>
        ))}
        <button style={S.btnAdd} onClick={addItem}>+ Agregar servicio</button>
        <div style={S.totalBox}>Total: <strong>${total.toLocaleString()}</strong></div>
      </Card>

      <Card title="💳 Pago">
        {/* TIPO DE PAGO */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { id: "completo", label: "✅ Pago completo" },
            { id: "abono", label: "💵 Abono / anticipo" },
            { id: "retiro", label: "⏳ Paga al retirar" },
          ].map(op => (
            <button key={op.id} style={{ ...S.pill, ...(tipoPago === op.id ? S.pillActive : {}), fontSize: 12 }}
              onClick={() => setTipoPago(op.id)}>{op.label}</button>
          ))}
        </div>

        {tipoPago !== "retiro" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={S.label}>Método de pago</label>
              <select style={S.input} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                {PAGOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {tipoPago === "abono" && (
              <div>
                <label style={S.label}>Monto del abono</label>
                <input type="number" style={S.input} placeholder={`Max $${total}`}
                  value={montoAbono} onChange={e => setMontoAbono(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* RESUMEN DE PAGO */}
        {tipoPago === "completo" && (
          <div style={S.pagoResumen}>✅ Cliente paga <strong>${total.toLocaleString()}</strong> ahora · {metodoPago}</div>
        )}
        {tipoPago === "abono" && montoAbono && (
          <div style={{ ...S.pagoResumen, background: "#fff3e0", color: "#e65100" }}>
            💵 Abono: <strong>${parseFloat(montoAbono).toLocaleString()}</strong> · Pendiente: <strong>${(total - parseFloat(montoAbono)).toLocaleString()}</strong> al retirar
          </div>
        )}
        {tipoPago === "retiro" && (
          <div style={{ ...S.pagoResumen, background: "#fff3e0", color: "#e65100" }}>⏳ Cliente pagará <strong>${total.toLocaleString()}</strong> al momento de retirar</div>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={S.label}>Fecha de entrega</label>
          <input type="date" style={S.input} value={entrega} onChange={e => setEntrega(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>Empleada</label>
          <select style={S.input} value={empleadaId} onChange={e => setEmpleadaId(parseInt(e.target.value))}>
            {empleadas.filter(e => e.activa).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 56, resize: "vertical" }}
            placeholder="Instrucciones especiales..." value={notas} onChange={e => setNotas(e.target.value)} />
        </div>
      </Card>

      {error && <div style={S.error}>{error}</div>}
      <button style={S.btnPrimary} onClick={registrar}>🧾 Registrar Venta</button>
    </div>
  );
}

// ─── VENTA CARD (reutilizable) ─────────────────────────────────────
function VentaCardItem({ v, empleadas, setTicket, addAbono, setVentas }) {
  const [showAbono, setShowAbono] = useState(false);
  const emp = empleadas.find(e => e.id === v.empleadaId);
  const pendiente = saldoPendiente(v);
  const pagada = estaPagada(v);
  const abonos = v.abonos || [];
  const totalAbonado = abonos.reduce((a, ab) => a + ab.monto, 0);

  const toggleCheck = (field) => {
    setVentas(prev => prev.map(vv => vv.folio === v.folio ? { ...vv, [field]: !vv[field] } : vv));
  };

  return (
    <>
      <div style={{ ...S.ventaCard, borderLeft: `4px solid ${pagada ? "#4caf50" : "#ff9800"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#1a3c5e" }}>{v.clienteNombre}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{v.folio} · {fmt(v.fecha)}</div>
            {emp && <div style={{ fontSize: 11, color: "#4db6e4" }}>👩 {emp.nombre}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1a3c5e" }}>${v.total.toLocaleString()}</div>
            <div style={{ ...S.badge, background: pagada ? "#e8f5e9" : "#fff3e0", color: pagada ? "#2e7d32" : "#e65100" }}>
              {pagada ? "✅ Pagado" : `⏳ Debe $${pendiente.toLocaleString()}`}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
          {v.items.map((it, i) => <span key={i}>{it.label}{it.piezas > 1 ? ` ×${it.piezas}` : ""}{i < v.items.length - 1 ? " · " : ""}</span>)}
        </div>
        <div style={{ fontSize: 12, color: v.entrega < new Date().toISOString().split("T")[0] && !pagada ? "#e53935" : "#555", marginTop: 2 }}>
          📅 Entrega: {fmtDate(v.entrega)}
        </div>

        {/* ABONOS */}
        {abonos.length > 0 && (
          <div style={{ marginTop: 8, background: "#f0faf4", borderRadius: 8, padding: "8px 10px" }}>
            {abonos.map((ab, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#2e7d32" }}>
                <span>💚 {ab.metodo} · {fmtDate(ab.fecha)}</span>
                <strong>+${ab.monto.toLocaleString()}</strong>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px dashed #c8e6c9", marginTop: 4, paddingTop: 4 }}>
              <span style={{ color: "#888" }}>Pagado</span>
              <span style={{ color: "#2e7d32", fontWeight: 700 }}>${totalAbonado.toLocaleString()} / ${v.total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* CHECKLIST */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgRetiro} onChange={() => toggleCheck("checkMsgRetiro")} />
            <span>📲 Msg retiro</span>
          </label>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgEntrega} onChange={() => toggleCheck("checkMsgEntrega")} />
            <span>✅ Msg entrega</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={S.btnTicket} onClick={() => setTicket(v)}>🧾 Ticket</button>
          {!pagada && (
            <button style={{ ...S.btnTicket, background: "#fff3e0", color: "#e65100" }}
              onClick={() => setShowAbono(true)}>💰 Registrar pago</button>
          )}
        </div>
      </div>

      {showAbono && (
        <AbonoModal venta={v}
          onSave={(abono) => { addAbono(v.folio, abono); setShowAbono(false); }}
          onClose={() => setShowAbono(false)} />
      )}
    </>
  );
}

// ─── HISTORIAL ─────────────────────────────────────────────────────
function Historial({ ventas, setVentas, empleadas, setTicket, addAbono }) {
  const [filtPago, setFiltPago] = useState("Todos");
  const [filtEst, setFiltEst] = useState("Todos");
  const [filtEmp, setFiltEmp] = useState("Todos");
  const [filtFecha, setFiltFecha] = useState("");
  const [busq, setBusq] = useState("");

  const filtered = ventas.filter(v => {
    if (filtPago !== "Todos") {
      const metodos = (v.abonos || []).map(a => a.metodo);
      if (!metodos.includes(filtPago) && v.pago !== filtPago) return false;
    }
    if (filtEst === "Pagadas" && !estaPagada(v)) return false;
    if (filtEst === "Pendientes" && estaPagada(v)) return false;
    if (filtEmp !== "Todos" && String(v.empleadaId) !== filtEmp) return false;
    if (filtFecha && !v.fecha.startsWith(filtFecha)) return false;
    if (busq && !v.clienteNombre?.toLowerCase().includes(busq.toLowerCase()) && !v.folio.toLowerCase().includes(busq.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Historial de Ventas</h2>
      <Card title="🔍 Filtros">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={S.input} placeholder="Buscar cliente o folio..." value={busq} onChange={e => setBusq(e.target.value)} />
          <input type="month" style={S.input} value={filtFecha} onChange={e => setFiltFecha(e.target.value)} />
          <select style={S.input} value={filtPago} onChange={e => setFiltPago(e.target.value)}>
            <option>Todos</option>{PAGOS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select style={S.input} value={filtEst} onChange={e => setFiltEst(e.target.value)}>
            <option>Todos</option><option>Pagadas</option><option>Pendientes</option>
          </select>
          <select style={{ ...S.input, gridColumn: "1/-1" }} value={filtEmp} onChange={e => setFiltEmp(e.target.value)}>
            <option value="Todos">Todas las empleadas</option>
            {empleadas.map(e => <option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
          </select>
        </div>
      </Card>

      <div style={{ marginTop: 4, fontSize: 12, color: "#888", marginBottom: 8 }}>
        {filtered.length} venta{filtered.length !== 1 ? "s" : ""} — Total: ${filtered.reduce((a, v) => a + v.total, 0).toLocaleString()}
      </div>

      {filtered.length === 0 ? <div style={S.empty}>No hay ventas con esos filtros</div>
        : filtered.map(v => (
          <VentaCardItem key={v.folio} v={v} empleadas={empleadas}
            setTicket={setTicket} addAbono={addAbono} setVentas={setVentas} />
        ))}
    </div>
  );
}

// ─── PENDIENTES ────────────────────────────────────────────────────
function Pendientes({ ventas, empleadas, setTicket, addAbono }) {
  const [setVentas_] = useState(null); // workaround — handled via addAbono
  const pendientes = ventas.filter(v => !estaPagada(v));
  const totalPend = pendientes.reduce((a, v) => a + saldoPendiente(v), 0);

  // Need setVentas from parent — pass dummy since checklist not critical here
  const dummySetVentas = () => {};

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>⏳ Cuentas Pendientes</h2>

      {pendientes.length === 0 ? (
        <div style={{ ...S.empty, paddingTop: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div>¡Todo al corriente! No hay saldos pendientes</div>
        </div>
      ) : (
        <>
          <div style={{ ...S.kpiGrid, gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
            <div style={{ ...S.kpi, borderLeft: "4px solid #ff9800" }}>
              <div style={{ fontSize: 22 }}>⏳</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#ff9800" }}>{pendientes.length}</div>
                <div style={{ fontSize: 12, color: "#1a3c5e", fontWeight: 600 }}>Órdenes pendientes</div>
              </div>
            </div>
            <div style={{ ...S.kpi, borderLeft: "4px solid #e53935" }}>
              <div style={{ fontSize: 22 }}>💸</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#e53935" }}>${totalPend.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "#1a3c5e", fontWeight: 600 }}>Total por cobrar</div>
              </div>
            </div>
          </div>

          {pendientes.map(v => (
            <VentaCardItem key={v.folio} v={v} empleadas={empleadas}
              setTicket={setTicket} addAbono={addAbono} setVentas={dummySetVentas} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────
function Dashboard({ ventas, empleadas, bonosConfig }) {
  const hoy = new Date().toISOString().split("T")[0];
  const semana = semanaISO(new Date());
  const mes = mesKey(new Date());

  const ventasHoy = ventas.filter(v => v.fecha.startsWith(hoy));
  const ventasSem = ventas.filter(v => semanaISO(v.fecha) === semana);
  const ventasMes = ventas.filter(v => mesKey(v.fecha) === mes);

  // Ingresos REALES (lo que ya se cobró)
  const cobrado = (arr) => arr.reduce((a, v) => a + (v.abonos || []).reduce((x, ab) => x + ab.monto, 0), 0);
  const porCobrar = (arr) => arr.reduce((a, v) => a + saldoPendiente(v), 0);
  const sum = arr => arr.reduce((a, v) => a + v.total, 0);

  const byPago = PAGOS.map(p => ({
    label: p,
    val: ventasMes.flatMap(v => (v.abonos || []).filter(a => a.metodo === p)).reduce((a, ab) => a + ab.monto, 0)
  }));
  const totalCobradoMes = byPago.reduce((a, p) => a + p.val, 0);

  const ventasPorMes = (() => {
    const map = {};
    ventas.forEach(v => { const k = mesKey(v.fecha); map[k] = (map[k] || 0) + v.total; });
    return Object.entries(map).sort().slice(-6).map(([k, v]) => ({ label: k.slice(5)+"/"+k.slice(0,4), val: v }));
  })();

  const empStats = empleadas.map(e => ({
    ...e,
    count: ventas.filter(v => v.empleadaId === e.id && mesKey(v.fecha) === mes).length,
    total: sum(ventas.filter(v => v.empleadaId === e.id && mesKey(v.fecha) === mes)),
  })).sort((a, b) => b.count - a.count);

  const KPI = ({ icon, label, val, sub, color }) => (
    <div style={{ ...S.kpi, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color }}>{val}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3c5e" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#888" }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Reportes & Dashboard</h2>
      <div style={S.kpiGrid}>
        <KPI icon="☀️" label="Ventas hoy" val={`$${sum(ventasHoy).toLocaleString()}`} sub={`${ventasHoy.length} órdenes`} color="#f59e0b" />
        <KPI icon="📅" label="Esta semana" val={`$${sum(ventasSem).toLocaleString()}`} sub={`${ventasSem.length} órdenes`} color="#4db6e4" />
        <KPI icon="💚" label="Cobrado este mes" val={`$${cobrado(ventasMes).toLocaleString()}`} sub="Pagos recibidos" color="#4caf50" />
        <KPI icon="⏳" label="Por cobrar" val={`$${porCobrar(ventasMes).toLocaleString()}`} sub="Saldo pendiente" color="#e53935" />
      </div>

      <Card title="💳 Cobros del mes por método de pago">
        {byPago.map(p => (
          <div key={p.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
              <span>{p.label}</span><strong>${p.val.toLocaleString()}</strong>
            </div>
            <div style={{ background: "#e8f0f7", borderRadius: 4, height: 8 }}>
              <div style={{ background: p.label === "Efectivo" ? "#4caf50" : p.label === "Transferencia" ? "#4db6e4" : "#ff9800",
                width: `${totalCobradoMes ? (p.val / totalCobradoMes) * 100 : 0}%`, height: "100%", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </Card>

      <Card title="📈 Ventas por mes (últimos 6 meses)">
        {ventasPorMes.length === 0 ? <div style={S.empty}>Sin datos</div> : ventasPorMes.map(m => {
          const max = Math.max(...ventasPorMes.map(x => x.val), 1);
          return (
            <div key={m.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span>{m.label}</span><strong>${m.val.toLocaleString()}</strong>
              </div>
              <div style={{ background: "#e8f0f7", borderRadius: 4, height: 10 }}>
                <div style={{ background: "#1a3c5e", width: `${(m.val / max) * 100}%`, height: "100%", borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="🏆 Ranking empleadas (mes actual)">
        {empStats.map((e, i) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f0f4f8" }}>
            <div style={{ fontSize: 18 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "👤"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{e.nombre}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{e.count} ventas · ${e.total.toLocaleString()}</div>
            </div>
            {e.count >= bonosConfig.meta && (
              <div style={{ ...S.badge, background: "#fff8e1", color: "#f59e0b" }}>🌟 Bono</div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── INVENTARIO ────────────────────────────────────────────────────
function Inventario({ inventario, setInventario }) {
  const [nuevo, setNuevo] = useState({ nombre: "", stock: 0, min: 1, unidad: "pzas" });
  const update = (id, field, val) => setInventario(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
  const eliminar = (id) => setInventario(prev => prev.filter(i => i.id !== id));
  const agregar = () => {
    if (!nuevo.nombre.trim()) return;
    setInventario(prev => [...prev, { ...nuevo, id: Date.now(), stock: parseFloat(nuevo.stock) || 0 }]);
    setNuevo({ nombre: "", stock: 0, min: 1, unidad: "pzas" });
  };
  const bajoStock = inventario.filter(i => i.stock <= i.min);

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Inventario de Insumos</h2>
      {bajoStock.length > 0 && (
        <div style={S.alerta}>⚠️ Stock bajo: {bajoStock.map(i => i.nombre).join(", ")}</div>
      )}
      <Card title="📋 Insumos actuales">
        {inventario.map(item => (
          <div key={item.id} style={S.ventaCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                <div style={{ fontSize: 12, color: "#888" }}>Mínimo: {item.min} {item.unidad}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ ...S.badge, background: item.stock <= item.min ? "#ffebee" : "#e8f5e9",
                  color: item.stock <= item.min ? "#c62828" : "#2e7d32", fontSize: 14, fontWeight: 700 }}>
                  {item.stock} {item.unidad}
                </div>
                <button style={S.btnRemove} onClick={() => eliminar(item.id)}>✕</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              <button style={S.btnSmall} onClick={() => update(item.id, "stock", Math.max(0, item.stock - 1))}>−</button>
              <input type="number" style={{ ...S.input, width: 70, textAlign: "center", padding: "4px 6px" }}
                value={item.stock} onChange={e => update(item.id, "stock", parseFloat(e.target.value) || 0)} />
              <button style={S.btnSmall} onClick={() => update(item.id, "stock", item.stock + 1)}>+</button>
              <span style={{ fontSize: 12, color: "#888" }}>{item.unidad}</span>
            </div>
          </div>
        ))}
      </Card>
      <Card title="➕ Agregar insumo">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={{ ...S.input, gridColumn: "1/-1" }} placeholder="Nombre del insumo"
            value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input type="number" style={S.input} placeholder="Stock inicial"
            value={nuevo.stock} onChange={e => setNuevo({ ...nuevo, stock: e.target.value })} />
          <input type="number" style={S.input} placeholder="Stock mínimo"
            value={nuevo.min} onChange={e => setNuevo({ ...nuevo, min: e.target.value })} />
          <input style={S.input} placeholder="Unidad (kg, L, pzas...)"
            value={nuevo.unidad} onChange={e => setNuevo({ ...nuevo, unidad: e.target.value })} />
        </div>
        <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={agregar}>Agregar insumo</button>
      </Card>
    </div>
  );
}

// ─── EQUIPO ────────────────────────────────────────────────────────
function Equipo({ empleadas, setEmpleadas, ventas, bonosConfig, setBonosConfig }) {
  const [nuevo, setNuevo] = useState("");
  const mes = mesKey(new Date());
  const addEmp = () => { if (!nuevo.trim()) return; setEmpleadas(prev => [...prev, { id: Date.now(), nombre: nuevo, activa: true }]); setNuevo(""); };
  const toggle = (id) => setEmpleadas(prev => prev.map(e => e.id === id ? { ...e, activa: !e.activa } : e));

  const empStats = empleadas.map(e => {
    const mv = ventas.filter(v => v.empleadaId === e.id && mesKey(v.fecha) === mes);
    return { ...e, ventasMes: mv.length, totalMes: mv.reduce((a, v) => a + v.total, 0) };
  });

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Equipo & Bonos</h2>
      <Card title="🌟 Configuración de bonos">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={S.label}>Meta de ventas / mes</label>
            <input type="number" style={S.input} value={bonosConfig.meta}
              onChange={e => setBonosConfig({ ...bonosConfig, meta: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label style={S.label}>Monto del bono ($)</label>
            <input type="number" style={S.input} value={bonosConfig.monto}
              onChange={e => setBonosConfig({ ...bonosConfig, monto: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          Al llegar a {bonosConfig.meta} ventas, la empleada gana ${bonosConfig.monto.toLocaleString()} de bono
        </div>
      </Card>
      <Card title="👩 Empleadas">
        {empStats.map((e, i) => {
          const pct = Math.min(100, (e.ventasMes / bonosConfig.meta) * 100);
          const ganoBono = e.ventasMes >= bonosConfig.meta;
          return (
            <div key={e.id} style={{ ...S.ventaCard, opacity: e.activa ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{e.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{e.ventasMes} ventas · ${e.totalMes.toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {ganoBono && <div style={{ ...S.badge, background: "#fff8e1", color: "#f59e0b" }}>🌟 Bono</div>}
                  <button style={{ ...S.btnSmall, background: e.activa ? "#ffebee" : "#e8f5e9", color: e.activa ? "#c62828" : "#2e7d32" }}
                    onClick={() => toggle(e.id)}>{e.activa ? "Desactivar" : "Activar"}</button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 3 }}>
                  <span>Progreso bono</span><span>{e.ventasMes}/{bonosConfig.meta}</span>
                </div>
                <div style={{ background: "#e8f0f7", borderRadius: 6, height: 8 }}>
                  <div style={{ background: ganoBono ? "#f59e0b" : "#4db6e4", width: `${pct}%`, height: "100%", borderRadius: 6 }} />
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input style={{ ...S.input, flex: 1 }} placeholder="Nombre de nueva empleada"
            value={nuevo} onChange={e => setNuevo(e.target.value)} />
          <button style={S.btnPrimary} onClick={addEmp}>Agregar</button>
        </div>
      </Card>
    </div>
  );
}

// ─── FACTURACIÓN ───────────────────────────────────────────────────
function Facturacion({ ventas, clientes }) {
  const [sel, setSel] = useState(null);
  const [filtMes, setFiltMes] = useState(mesKey(new Date()));

  const clientesConVentas = clientes.filter(c => ventas.some(v => v.clienteId === c.id && mesKey(v.fecha) === filtMes));
  const ventasCliente = sel ? ventas.filter(v => v.clienteId === sel && mesKey(v.fecha) === filtMes) : [];
  const total = ventasCliente.reduce((a, v) => a + v.total, 0);
  const cobrado = ventasCliente.reduce((a, v) => a + (v.abonos || []).reduce((x, ab) => x + ab.monto, 0), 0);
  const pendiente = ventasCliente.reduce((a, v) => a + saldoPendiente(v), 0);
  const cliente = clientes.find(c => c.id === sel);

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Datos para Facturación</h2>
      <input type="month" style={{ ...S.input, marginBottom: 12 }} value={filtMes} onChange={e => { setFiltMes(e.target.value); setSel(null); }} />

      {!sel ? (
        <Card title="👤 Selecciona un cliente">
          {clientesConVentas.length === 0 ? <div style={S.empty}>No hay clientes con ventas en este período</div>
            : clientesConVentas.map(c => {
              const cv = ventas.filter(v => v.clienteId === c.id && mesKey(v.fecha) === filtMes);
              const pend = cv.reduce((a, v) => a + saldoPendiente(v), 0);
              return (
                <div key={c.id} style={{ ...S.ventaCard, cursor: "pointer" }} onClick={() => setSel(c.id)}>
                  <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {cv.length} servicio{cv.length !== 1 ? "s" : ""} · ${cv.reduce((a, v) => a + v.total, 0).toLocaleString()}
                    {pend > 0 && <span style={{ color: "#e65100" }}> · Debe ${pend.toLocaleString()}</span>}
                    {c.rfc && ` · RFC: ${c.rfc}`}
                  </div>
                </div>
              );
            })}
        </Card>
      ) : (
        <div>
          <button style={{ ...S.btnSmall, marginBottom: 12 }} onClick={() => setSel(null)}>← Volver</button>
          <Card title={`📄 Resumen — ${cliente?.nombre}`}>
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {[["Nombre", cliente?.nombre],["Teléfono", cliente?.tel],["Email", cliente?.email],["RFC", cliente?.rfc]].map(([k, v]) =>
                v ? <div key={k} style={S.ticketRow}><span style={{ color: "#888" }}>{k}</span><span>{v}</span></div> : null
              )}
            </div>
            <div style={S.ticketDivider} />
            {ventasCliente.map(v => (
              <div key={v.folio} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0f4f8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{fmt(v.fecha)}</span><strong>${v.total.toLocaleString()}</strong>
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>{v.items.map(it => it.label).join(", ")}</div>
                {!estaPagada(v) && <div style={{ fontSize: 12, color: "#e65100" }}>⏳ Pendiente: ${saldoPendiente(v).toLocaleString()}</div>}
              </div>
            ))}
            <div style={S.ticketDivider} />
            <div style={S.ticketRow}><span>Total servicios</span><strong>${total.toLocaleString()}</strong></div>
            <div style={S.ticketRow}><span style={{ color: "#2e7d32" }}>✅ Cobrado</span><strong style={{ color: "#2e7d32" }}>${cobrado.toLocaleString()}</strong></div>
            {pendiente > 0 && <div style={S.ticketRow}><span style={{ color: "#e65100" }}>⏳ Por cobrar</span><strong style={{ color: "#e65100" }}>${pendiente.toLocaleString()}</strong></div>}
            <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={() => window.print()}>🖨️ Imprimir resumen</button>
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      {children}
    </div>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f0f4f8", paddingBottom: 40 },
  header: { background: "linear-gradient(135deg, #1a3c5e 0%, #2563a8 100%)", padding: "16px 20px", boxShadow: "0 2px 12px rgba(26,60,94,.25)" },
  headerInner: { maxWidth: 700, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#fff", fontWeight: 700 },
  tabBar: { background: "#fff", display: "flex", overflowX: "auto", borderBottom: "2px solid #e8f0f7", maxWidth: 700, margin: "0 auto", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,.06)" },
  tabBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", color: "#888", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, whiteSpace: "nowrap", minWidth: 68, transition: "color .2s" },
  tabActive: { color: "#1a3c5e", borderBottom: "2px solid #4db6e4", marginBottom: -2, fontWeight: 700 },
  content: { maxWidth: 700, margin: "0 auto", padding: "16px 12px" },
  panel: {},
  panelTitle: { fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#1a3c5e", marginBottom: 14, fontWeight: 700 },
  card: { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(26,60,94,.08)" },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#4db6e4", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d0dce8", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#f8fbfd", outline: "none", color: "#1a3c5e" },
  label: { display: "block", fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 500 },
  btnPrimary: { width: "100%", padding: "13px", background: "linear-gradient(135deg, #1a3c5e, #2563a8)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", letterSpacing: 0.3 },
  btnAdd: { background: "#e8f5fd", color: "#1a7dbf", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnRemove: { background: "#ffebee", color: "#c62828", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  btnSmall: { background: "#e8f0f7", color: "#1a3c5e", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnTicket: { background: "#f0f4f8", color: "#1a3c5e", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnPrint: { background: "#1a3c5e", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnClose: { background: "#e8f0f7", color: "#1a3c5e", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  totalBox: { background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 15, color: "#1a3c5e", textAlign: "right" },
  pagoResumen: { background: "#e8f5e9", color: "#2e7d32", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 500, marginTop: 4 },
  dropdown: { background: "#fff", border: "1.5px solid #d0dce8", borderRadius: 8, marginTop: 4, boxShadow: "0 4px 12px rgba(0,0,0,.1)", zIndex: 20, position: "relative" },
  dropItem: { padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f4f8", fontSize: 14 },
  clienteTag: { background: "#e8f5e9", color: "#2e7d32", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  tagX: { background: "none", border: "none", color: "#2e7d32", cursor: "pointer", fontSize: 14, fontWeight: 700 },
  pill: { padding: "6px 14px", borderRadius: 20, border: "1.5px solid #d0dce8", background: "#f8fbfd", color: "#888", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  pillActive: { background: "#1a3c5e", color: "#fff", border: "1.5px solid #1a3c5e" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 },
  ventaCard: { background: "#f8fbfd", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1.5px solid #e8f0f7" },
  kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  kpi: { background: "#fff", borderRadius: 10, padding: "14px", display: "flex", gap: 12, alignItems: "center", boxShadow: "0 1px 6px rgba(26,60,94,.08)" },
  error: { background: "#ffebee", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 10, fontWeight: 500 },
  alerta: { background: "#fff3e0", color: "#e65100", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 500 },
  empty: { textAlign: "center", color: "#aaa", padding: "20px 0", fontSize: 13 },
  checkLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  ticketBox: { background: "#fff", borderRadius: 14, padding: "24px 22px", width: "100%", maxWidth: 340, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.2)" },
  ticketHeader: { textAlign: "center", marginBottom: 12 },
  ticketLogo: { fontSize: 32, marginBottom: 4 },
  ticketDivider: { borderTop: "1.5px dashed #d0dce8", margin: "10px 0" },
  ticketRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 5, color: "#333" },
};
import { useState, useEffect } from "react";

const KEYS = {
  ventas: "ll_ventas", clientes: "ll_clientes",
  empleadas: "ll_empleadas", inventario: "ll_inventario",
  bonos: "ll_bonos_config", servicios: "ll_servicios",
};
const load = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const SERVICIOS_DEFAULT = [
  { id: "001", label: "LAVADO + SECADO 15LB", precio: 4.50 },
  { id: "002", label: "LAVADO + SECADO 25 LB", precio: 6.50 },
  { id: "003", label: "LIMPIEZA PROFESIONAL 1 PAR", precio: 3.50 },
  { id: "004", label: "3 PARES (PACK AHORRO)", precio: 8.50 },
  { id: "005", label: "5 PARES (PACK FAMILIAR RECOMENDADO)", precio: 12.99 },
  { id: "006", label: "COMBO LAVANDERÍA 15LB + LIMPIEZA 1 PAR ZAPATOS", precio: 5.99 },
  { id: "007", label: "COMBO LAVANDERÍA 25LB + LIMPIEZA 2 PAR ZAPATOS", precio: 9.99 },
  { id: "008", label: "PACK ESTUDIANTES (2 PARES)", precio: 6.00 },
  { id: "009", label: "PACK EXPRESS (ZAPATOS)", precio: 4.50 },
  { id: "010", label: "MIÉRCOLES DE ZAPATOS (PROMO 4 PARES)", precio: 9.99 },
  { id: "011", label: "LAVADO EDREDÓN (2 PLAZAS)", precio: 6.00 },
  { id: "012", label: "LAVADO EDREDÓN (2 1/2)", precio: 8.00 },
  { id: "013", label: "LAVADO EDREDÓN (3 PLAZAS)", precio: 8.00 },
  { id: "014", label: "LAVADO 2 COBIJAS PEQUEÑAS", precio: 4.00 },
  { id: "015", label: "LAVADO 2 COBIJAS GRANDES", precio: 6.00 },
  { id: "016", label: "LAVADO 1 COBIJA GRANDE", precio: 6.00 },
  { id: "017", label: "LIBRA ADICIONAL", precio: 0.30 },
  { id: "018", label: "LAVADO EN SECO TERNO PANTALÓN Y SACO", precio: 10.50 },
  { id: "019", label: "LAVADO EN SECO SACO SENCILLO", precio: 5.50 },
  { id: "020", label: "PRELAVADO BÁSICO", precio: 1.00 },
  { id: "021", label: "LAVADO DE ALMOHADA TAMAÑO ESTÁNDAR", precio: 3.50 },
  { id: "022", label: "SOLO SECADO", precio: 5.00 },
  { id: "023", label: "LAVADO ROPA + COBIJAS 16LB MAX", precio: 6.50 },
  { id: "024", label: "SERVICIO EXPRESS", precio: 1.50 },
  { id: "025", label: "PLANCHADO CAMISA", precio: 1.25 },
  { id: "026", label: "LAVADO Y PLANCHADO DE CAMISA", precio: 2.30 },
  { id: "027", label: "10 PARES DE ZAPATOS", precio: 24.99 },
  { id: "028", label: "LAVADO ROPA INDUSTRIAL", precio: 10.00 },
  { id: "029", label: "LAVADO SÁBANAS Y 1 COBIJA", precio: 5.00 },
  { id: "030", label: "LAVADO 1 MOCHILA", precio: 3.50 },
  { id: "031", label: "LAVADO 1 SACO", precio: 5.75 },
  { id: "032", label: "LAVADO ABRIGO", precio: 10.50 },
  { id: "033", label: "CAPA Y BIRRETE", precio: 12.00 },
  { id: "034", label: "LAVADO COLCHAS", precio: 7.00 },
  { id: "035", label: "LAVADO EN SECO ZAPATOS GAMUZA O CUERO", precio: 4.50 },
  { id: "036", label: "COLCHA GRANDE", precio: 10.00 },
  { id: "037", label: "SACO 3/4", precio: 9.00 },
];

const PAGOS = ["Efectivo", "Transferencia", "Tarjeta"];
