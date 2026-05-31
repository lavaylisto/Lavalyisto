import { useState, useEffect } from "react";

const KEYS = {
  ventas: "ll_ventas", clientes: "ll_clientes",
  empleadas: "ll_empleadas", inventario: "ll_inventario",
  servicios: "ll_servicios",
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

const PAGOS = ["Efectivo", "Transferencia Pichincha", "Transferencia JEP", "Tarjeta"];
const esTranferencia = (m) => m && m.startsWith("Transferencia");
const INSUMOS_DEFAULT = [
  { id: 1, nombre: "Detergente (kg)", stock: 10, min: 3, unidad: "kg" },
  { id: 2, nombre: "Suavizante (L)", stock: 5, min: 2, unidad: "L" },
  { id: 3, nombre: "Bolsas de empaque", stock: 100, min: 20, unidad: "pzas" },
  { id: 4, nombre: "Ganchos", stock: 50, min: 10, unidad: "pzas" },
];
const EMPLEADAS_DEFAULT = [
  { id: 1, nombre: "Ana García", activa: true, metaVentas: 20, montoBonus: 20 },
  { id: 2, nombre: "María López", activa: true, metaVentas: 20, montoBonus: 20 },
];

const folio = () => "LL-" + Date.now().toString(36).toUpperCase();
const fmt = (d) => new Date(d).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) => new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const semanaISO = (d) => { const dt = new Date(d); dt.setHours(0,0,0,0); dt.setDate(dt.getDate()+3-((dt.getDay()+6)%7)); const w1=new Date(dt.getFullYear(),0,4); return `${dt.getFullYear()}-W${String(1+Math.round(((dt-w1)/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,"0")}`; };
const mesKey = (d) => { const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
const saldoPendiente = (v) => v.total - (v.abonos || []).reduce((a, ab) => a + ab.monto, 0);
const estaPagada = (v) => saldoPendiente(v) <= 0;

// ─── EXPORTAR CSV ──────────────────────────────────────────────────
const exportarCSV = (ventas, titulo, empleadas) => {
  const enc = ["Folio","Fecha","Entrega","Cliente","Teléfono","Empleada","Servicios","Total","Pagado","Pendiente","Método pago","Msg Retiro","Msg Entrega","Facturado SRI","Notas"];
  const filas = ventas.map(v => {
    const emp = empleadas.find(e => e.id === v.empleadaId);
    const pagado = (v.abonos || []).reduce((a, ab) => a + ab.monto, 0);
    const pendiente = v.total - pagado;
    const servicios = v.items.map(it => `${it.label}${it.piezas > 1 ? ` x${it.piezas}` : ""}`).join(" | ");
    const metodos = [...new Set((v.abonos || []).map(ab => ab.metodo))].join("/");
    return [v.folio, fmt(v.fecha), fmtDate(v.entrega), v.clienteNombre||"", v.clienteTel||"", emp?.nombre||"", servicios, `$${v.total.toFixed(2)}`, `$${pagado.toFixed(2)}`, `$${pendiente.toFixed(2)}`, metodos||v.pago||"", v.checkMsgRetiro?"SI":"NO", v.checkMsgEntrega?"SI":"NO", v.facturadoSRI?"SI":"NO", v.notas||""];
  });
  const csv = [enc, ...filas].map(f => f.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${titulo}-${new Date().toISOString().split("T")[0]}.csv`; a.click();
};

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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1a3c5e"}}>Lava<span style={{color:"#4db6e4"}}>&</span>Listo</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>Servicio de Lavandería Profesional</div>
        </div>
        <div style={S.ticketDivider}/>
        <div style={S.ticketRow}><span>Folio</span><strong>{venta.folio}</strong></div>
        <div style={S.ticketRow}><span>Fecha</span><span>{fmt(venta.fecha)}</span></div>
        <div style={S.ticketRow}><span>Entrega</span><span>{fmtDate(venta.entrega)}</span></div>
        <div style={S.ticketRow}><span>Cliente</span><span>{venta.clienteNombre}</span></div>
        {venta.clienteTel && <div style={S.ticketRow}><span>Tel</span><span>{venta.clienteTel}</span></div>}
        {venta.clienteDireccion && <div style={S.ticketRow}><span>📍 Dir</span><span style={{fontSize:11,maxWidth:160,textAlign:"right"}}>{venta.clienteDireccion}</span></div>}
        {emp && <div style={S.ticketRow}><span>Atendió</span><span>{emp.nombre}</span></div>}
        {venta.facturadoSRI && <div style={{...S.ticketRow,color:"#2e7d32",fontWeight:700}}><span>🧾 Facturado SRI</span><span>✅</span></div>}
        <div style={S.ticketDivider}/>
        <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6}}>SERVICIOS</div>
        {venta.items.map((it,i) => (
          <div key={i} style={S.ticketRow}>
            <span>{it.label}{it.piezas>1?` x${it.piezas}`:""}</span>
            <span>${(it.precio*it.piezas).toFixed(2)}</span>
          </div>
        ))}
        <div style={S.ticketDivider}/>
        <div style={{...S.ticketRow,fontSize:16,fontWeight:800}}><span>TOTAL</span><span style={{color:"#1a3c5e"}}>${venta.total.toFixed(2)}</span></div>
        {abonos.length>0&&(<>
          <div style={S.ticketDivider}/>
          <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6}}>PAGOS REGISTRADOS</div>
          {abonos.map((ab,i)=><div key={i} style={S.ticketRow}><span>{ab.metodo} · {fmtDate(ab.fecha)}</span><span style={{color:"#2e7d32"}}>-${ab.monto.toFixed(2)}</span></div>)}
          <div style={{...S.ticketRow,marginTop:4}}><span>Total pagado</span><strong style={{color:"#2e7d32"}}>${totalAbonado.toFixed(2)}</strong></div>
        </>)}
        {pendiente>0&&<div style={{background:"#fff3e0",borderRadius:8,padding:"8px 10px",marginTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:"#e65100"}}>⚠️ Saldo pendiente</span><strong style={{color:"#e65100"}}>${pendiente.toFixed(2)}</strong></div>}
        {pendiente<=0&&<div style={{background:"#e8f5e9",borderRadius:8,padding:"8px 10px",marginTop:8,textAlign:"center"}}><span style={{fontSize:13,fontWeight:700,color:"#2e7d32"}}>✅ Pagado completo</span></div>}
        {venta.notas&&<div style={{fontSize:11,color:"#888",marginTop:8}}>Nota: {venta.notas}</div>}
        <div style={S.ticketDivider}/>
        <div style={{textAlign:"center",fontSize:11,color:"#aaa",marginTop:8}}>¡Gracias por tu preferencia! 💙</div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button style={S.btnPrint} onClick={()=>{
          const style=document.createElement("style");
          style.innerHTML=`
            @media print {
              body * { visibility: hidden; }
              #ticket-print, #ticket-print * { visibility: visible; }
              #ticket-print { position: fixed; top: 0; left: 0; width: 48%; }
              #ticket-copy { visibility: visible; position: fixed; top: 0; left: 52%; width: 48%; border-left: 1px dashed #ccc; padding-left: 10px; }
              #ticket-copy * { visibility: visible; }
            }
          `;
          document.head.appendChild(style);
          const original=document.getElementById("ticket-print");
          const copy=original.cloneNode(true);
          copy.id="ticket-copy";
          const copyLabel=document.createElement("div");
          copyLabel.style.cssText="text-align:center;font-size:10px;color:#aaa;margin-bottom:8px;font-weight:bold;";
          copyLabel.innerText="— COPIA NEGOCIO —";
          copy.insertBefore(copyLabel,copy.firstChild);
          const origLabel=document.createElement("div");
          origLabel.style.cssText="text-align:center;font-size:10px;color:#aaa;margin-bottom:8px;font-weight:bold;";
          origLabel.innerText="— COPIA CLIENTE —";
          original.insertBefore(origLabel,original.firstChild);
          document.body.appendChild(copy);
          window.print();
          document.head.removeChild(style);
          document.body.removeChild(copy);
          original.removeChild(origLabel);
        }}>🖨️ Imprimir 2 copias</button>
        <button style={S.btnClose} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function AbonoModal({ venta, onSave, onClose }) {
  const [monto,setMonto]=useState("");
  const [metodo,setMetodo]=useState("Efectivo");
  const pendiente=saldoPendiente(venta);
  const guardar=()=>{const m=parseFloat(monto);if(!m||m<=0||m>pendiente) return;onSave({monto:m,metodo,fecha:new Date().toISOString()});};
  return (
    <div style={S.overlay}>
      <div style={S.ticketBox}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#1a3c5e",fontWeight:700,marginBottom:14}}>💰 Registrar pago</div>
        <div style={S.ticketRow}><span>Cliente</span><strong>{venta.clienteNombre}</strong></div>
        <div style={S.ticketRow}><span>Total</span><span>${venta.total.toFixed(2)}</span></div>
        <div style={{...S.ticketRow,color:"#e65100",fontWeight:700}}><span>Saldo pendiente</span><span>${pendiente.toFixed(2)}</span></div>
        <div style={S.ticketDivider}/>
        <label style={S.label}>Monto a pagar</label>
        <input type="number" style={{...S.input,marginBottom:10}} placeholder={`Máximo $${pendiente.toFixed(2)}`} value={monto} onChange={e=>setMonto(e.target.value)}/>
        <button style={{...S.btnSmall,marginBottom:10,background:"#e8f5fd",color:"#1565c0"}} onClick={()=>setMonto(String(pendiente))}>Pagar saldo completo</button>
        <label style={S.label}>Método de pago</label>
        <select style={{...S.input,marginBottom:14}} value={metodo} onChange={e=>setMetodo(e.target.value)}>
          {PAGOS.map(p=><option key={p}>{p}</option>)}
        </select>
        <div style={{display:"flex",gap:8}}>
          <button style={{...S.btnPrimary,flex:1}} onClick={guardar}>Guardar pago</button>
          <button style={{...S.btnClose,flex:1}} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── USUARIOS ──────────────────────────────────────────────────────
const USUARIOS_DEFAULT = [
  { id: 1, usuario: "admin", clave: "admin123", rol: "Administrador", nombre: "Administrador" },
  { id: 2, usuario: "ana", clave: "1234", rol: "Empleada", nombre: "Ana García" },
  { id: 3, usuario: "maria", clave: "1234", rol: "Empleada", nombre: "María López" },
];

// ─── LOGIN ─────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [showClave, setShowClave] = useState(false);
  const usuarios = load("ll_usuarios", USUARIOS_DEFAULT);

  const ingresar = () => {
    const u = usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase().trim() && u.clave === clave);
    if (!u) { setError("Usuario o clave incorrectos"); return; }
    setError("");
    onLogin(u);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1a3c5e 0%,#2563a8 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');* {box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 32px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🫧</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#1a3c5e" }}>
            Lava<span style={{ color: "#4db6e4" }}>&</span>Listo
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Sistema de ventas</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 6, fontWeight: 600 }}>👤 Usuario</label>
          <input
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #d0dce8", fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", color: "#1a3c5e", background: "#f8fbfd" }}
            placeholder="Ingresa tu usuario"
            value={usuario}
            onChange={e => { setUsuario(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && ingresar()}
            autoCapitalize="none"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 6, fontWeight: 600 }}>🔒 Clave</label>
          <div style={{ position: "relative" }}>
            <input
              type={showClave ? "text" : "password"}
              style={{ width: "100%", padding: "12px 44px 12px 14px", borderRadius: 10, border: "1.5px solid #d0dce8", fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", color: "#1a3c5e", background: "#f8fbfd" }}
              placeholder="Ingresa tu clave"
              value={clave}
              onChange={e => { setClave(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && ingresar()}
            />
            <button onClick={() => setShowClave(!showClave)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#888" }}>
              {showClave ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#ffebee", color: "#c62828", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, fontWeight: 500, textAlign: "center" }}>
            ❌ {error}
          </div>
        )}

        <button
          style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#1a3c5e,#2563a8)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}
          onClick={ingresar}>
          Ingresar →
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#bbb" }}>
          ¿Olvidaste tu clave? Contacta al administrador
        </div>
      </div>
    </div>
  );
}

// ─── APERTURA OBLIGATORIA ──────────────────────────────────────────
function AperturaObligatoria({ sesion, onLogout, onAbierta, empleadas }) {
  const hoy = new Date().toISOString().split("T")[0];
  const APERTURA_KEY = "ll_apertura_" + hoy;
  const [fondo, setFondo] = useState("15.00");
  const [abriendo, setAbriendo] = useState(false);

  const abrir = () => {
    setAbriendo(true);
    const datos = {
      empleadaId: sesion.id,
      empleadaNombre: sesion.nombre,
      fondo: parseFloat(fondo) || 15,
      fecha: new Date().toISOString(),
    };
    try { localStorage.setItem(APERTURA_KEY, JSON.stringify(datos)); } catch {}

    // Imprimir ticket apertura
    const w = window.open("", "_blank", "width=380,height=400");
    if (w) {
      w.document.write(`
        <html><head><title>Apertura de Caja</title>
        <style>body{font-family:sans-serif;padding:20px;max-width:320px;margin:0 auto;text-align:center}
        h2{color:#1a3c5e}.divider{border-top:1px dashed #ccc;margin:12px 0}
        .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px;text-align:left}
        .big{font-size:26px;font-weight:800;color:#1a3c5e}</style></head>
        <body>
        <div style="font-size:36px">🫧</div>
        <h2>Lava&amp;Listo</h2>
        <p><strong>APERTURA DE CAJA</strong></p>
        <div class="divider"></div>
        <div class="row"><span>Fecha</span><span>${new Date(datos.fecha).toLocaleString("es-MX")}</span></div>
        <div class="row"><span>Abrió</span><span>${datos.empleadaNombre}</span></div>
        <div class="divider"></div>
        <p style="font-size:13px;color:#888">Fondo inicial en caja:</p>
        <div class="big">$${datos.fondo.toFixed(2)}</div>
        <div class="divider"></div>
        <p style="font-size:11px;color:#aaa">Lava&amp;Listo · Sistema de ventas</p>
        <script>window.print();window.close();</script>
        </body></html>
      `);
      w.document.close();
    }

    setTimeout(() => onAbierta(), 500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1a3c5e 0%,#2563a8 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 28px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔓</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "#1a3c5e" }}>Apertura de Caja</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
            Hola <strong>{sesion.nombre}</strong>, antes de iniciar debes abrir la caja del día.
          </div>
        </div>

        <div style={{ background: "#f0f4f8", borderRadius: 12, padding: "16px", marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>📅 {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <div style={{ fontSize: 13, color: "#555" }}>Fondo que debe haber en caja al iniciar:</div>
          <div style={{ position: "relative", margin: "12px auto", maxWidth: 160 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: "#1a3c5e" }}>$</span>
            <input
              type="number"
              style={{ ...{width:"100%",padding:"12px 12px 12px 30px",borderRadius:10,border:"2px solid #4db6e4",fontSize:22,fontWeight:800,color:"#1a3c5e",textAlign:"center",background:"#fff",outline:"none"} }}
              value={fondo}
              onChange={e => setFondo(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 11, color: "#4db6e4" }}>💡 El fondo estándar es $15.00</div>
        </div>

        <button
          style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#1a3c5e,#2563a8)", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", marginBottom: 10 }}
          onClick={abrir}
          disabled={abriendo}>
          {abriendo ? "Abriendo..." : "🔓 Abrir caja e iniciar día"}
        </button>

        <button
          style={{ width: "100%", padding: "10px", background: "transparent", color: "#888", border: "1px solid #d0dce8", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
          onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────
export default function LavaListo() {
  const [sesion, setSesion] = useState(() => {
    try { const s = sessionStorage.getItem("ll_sesion"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  const handleLogin = (usuario) => {
    try { sessionStorage.setItem("ll_sesion", JSON.stringify(usuario)); } catch {}
    setSesion(usuario);
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem("ll_sesion"); } catch {}
    setSesion(null);
  };

  if (!sesion) return <LoginScreen onLogin={handleLogin} />;

  return <AppContent sesion={sesion} onLogout={handleLogout} />;
}

function AppContent({ sesion, onLogout }) {
  const hoy = new Date().toISOString().split("T")[0];
  const APERTURA_KEY = "ll_apertura_" + hoy;
  const cajaAbierta = !!load(APERTURA_KEY, null);

  const [tab,setTab]=useState("ventas");
  const [ventas,setVentas]=useState(()=>load(KEYS.ventas,[]));
  const [clientes,setClientes]=useState(()=>load(KEYS.clientes,[]));
  const [empleadas,setEmpleadas]=useState(()=>load(KEYS.empleadas,EMPLEADAS_DEFAULT));
  const [inventario,setInventario]=useState(()=>load(KEYS.inventario,INSUMOS_DEFAULT));
  const [servicios,setServicios]=useState(()=>load(KEYS.servicios,SERVICIOS_DEFAULT));
  const [gastos,setGastos]=useState(()=>load("ll_gastos",[]));
  const [ticketVenta,setTicketVenta]=useState(null);
  const [cajaListaState, setCajaListaState] = useState(cajaAbierta);

  useEffect(()=>save(KEYS.ventas,ventas),[ventas]);
  useEffect(()=>save(KEYS.clientes,clientes),[clientes]);
  useEffect(()=>save(KEYS.empleadas,empleadas),[empleadas]);
  useEffect(()=>save(KEYS.inventario,inventario),[inventario]);
  useEffect(()=>save(KEYS.servicios,servicios),[servicios]);
  useEffect(()=>save("ll_gastos",gastos),[gastos]);

  const pendientesCount = ventas.filter(v => (!estaPagada(v) && !v.anulada) || (estaPagada(v) && !v.anulada && !v.checkMsgEntrega)).length;

  const addAbono=(f,abono)=>{
    setVentas(prev=>prev.map(v=>{
      if(v.folio!==f) return v;
      const abonos=[...(v.abonos||[]),abono];
      return {...v,abonos,pagada:saldoPendiente({...v,abonos})<=0};
    }));
  };

  const exportarDatos=()=>{
    const datos={ventas,clientes,empleadas,inventario,servicios,exportado:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(datos,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`lavalisto-respaldo-${new Date().toISOString().split("T")[0]}.json`;a.click();
  };

  const importarDatos=(e)=>{
    const file=e.target.files[0];if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const datos=JSON.parse(ev.target.result);
        if(datos.ventas) setVentas(datos.ventas);
        if(datos.clientes) setClientes(datos.clientes);
        if(datos.empleadas) setEmpleadas(datos.empleadas);
        if(datos.inventario) setInventario(datos.inventario);
        if(datos.servicios) setServicios(datos.servicios);
        alert("✅ Datos importados correctamente");
      }catch{alert("❌ Error al importar el archivo");}
    };
    reader.readAsText(file);
  };

  const esAdmin = sesion.rol === "Administrador";
  const tabs=[
    {id:"ventas",icon:"🧾",label:"Nueva Venta"},
    {id:"historial",icon:"📋",label:"Historial"},
    {id:"pendientes",icon:"⏳",label:"Pendientes",badge:pendientesCount},
    ...(esAdmin?[{id:"reportes",icon:"📊",label:"Reportes"}]:[{id:"misventas",icon:"📊",label:"Mis Ventas"}]),
    ...(esAdmin?[{id:"gastos",icon:"🛒",label:"Gastos"}]:[]),
    ...(esAdmin?[{id:"inventario",icon:"📦",label:"Inventario"}]:[]),
    {id:"equipo",icon:"👩",label:"Equipo"},
    {id:"caja",icon:"💰",label:"Caja"},
    ...(esAdmin?[{id:"config",icon:"⚙️",label:"Config"}]:[]),
    ...(esAdmin?[{id:"usuarios",icon:"🔑",label:"Usuarios"}]:[]),
  ];

  // Si la caja no está abierta, mostrar pantalla de apertura obligatoria
  if (!cajaListaState) {
    return <AperturaObligatoria sesion={sesion} onLogout={onLogout} onAbierta={() => setCajaListaState(true)} empleadas={empleadas}/>;
  }

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @media print { body * { visibility:hidden; } #ticket-print, #ticket-print * { visibility:visible; } #ticket-print { position:fixed; top:0; left:0; } }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-thumb { background:#4db6e4; border-radius:3px; }
      `}</style>
      <div style={S.header}>
        <div style={S.headerInner}>
          <span style={S.logo}>🫧 Lava<span style={{color:"#4db6e4"}}>&</span>Listo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#a0c4da", fontFamily: "'DM Sans',sans-serif" }}>
              👤 {sesion.nombre}
            </span>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Salir
            </button>
          </div>
        </div>
      </div>
      <div style={S.tabBar}>
        {tabs.map(t=>(
          <button key={t.id} style={{...S.tabBtn,...(tab===t.id?S.tabActive:{})}} onClick={()=>setTab(t.id)}>
            <span style={{position:"relative"}}>
              {t.icon}
              {t.badge>0&&<span style={{position:"absolute",top:-4,right:-8,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.badge}</span>}
            </span>
            <span style={{fontSize:11}}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={S.content}>
        {tab==="ventas"&&<NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={setTicketVenta} servicios={servicios} sesion={sesion}/>}
        {tab==="historial"&&<Historial ventas={esAdmin?ventas:ventas.filter(v=>String(v.empleadaId)===String(sesion.id))} setVentas={setVentas} empleadas={empleadas} setTicket={setTicketVenta} addAbono={addAbono} esAdmin={esAdmin} sesion={sesion}/>}
        {tab==="pendientes"&&<Pendientes ventas={ventas} empleadas={empleadas} setTicket={setTicketVenta} addAbono={addAbono} esAdmin={esAdmin} setVentas={setVentas}/>}
        {tab==="reportes"&&esAdmin&&<Reportes ventas={ventas} empleadas={empleadas}/>}
        {tab==="misventas"&&!esAdmin&&<MisVentas ventas={ventas} sesion={sesion} empleadas={empleadas} setTicket={setTicketVenta}/>}
        {tab==="inventario"&&esAdmin&&<Inventario inventario={inventario} setInventario={setInventario}/>}
        {tab==="equipo"&&<Equipo empleadas={empleadas} setEmpleadas={setEmpleadas} ventas={ventas} esAdmin={esAdmin}/>}
        {tab==="config"&&esAdmin&&<Configuracion servicios={servicios} setServicios={setServicios} exportarDatos={exportarDatos} importarDatos={importarDatos} ventas={ventas} empleadas={empleadas}/>}
        {tab==="caja"&&<CierreCaja ventas={ventas} empleadas={empleadas} sesion={sesion}/>}
        {tab==="gastos"&&esAdmin&&<Gastos gastos={gastos} setGastos={setGastos} sesion={sesion}/>}
        {tab==="usuarios"&&esAdmin&&<GestionUsuarios/>}
      </div>
      {ticketVenta&&<TicketModal venta={ticketVenta} empleadas={empleadas} onClose={()=>setTicketVenta(null)}/>}
    </div>
  );
}

// ─── NUEVA VENTA ───────────────────────────────────────────────────
function NuevaVenta({ ventas, setVentas, clientes, setClientes, empleadas, setTicket, servicios }) {
  const hoy=new Date();const manana=new Date(hoy);manana.setDate(hoy.getDate()+1);
  const [clienteQ,setClienteQ]=useState("");
  const [clienteId,setClienteId]=useState(null);
  const [nuevoCliente,setNuevoCliente]=useState({nombre:"",tel:"",email:"",rfc:"",direccion:""});
  const [modoCliente,setModoCliente]=useState("buscar");
  const [empleadaId,setEmpleadaId]=useState(empleadas[0]?.id||null);
  const [items,setItems]=useState([{servId:servicios[0]?.id,piezas:1,personalizado:false,labelCustom:"",precioCustom:""}]);
  const [entrega,setEntrega]=useState(manana.toISOString().split("T")[0]);
  const [notas,setNotas]=useState("");
  const [error,setError]=useState("");
  const [tipoPago,setTipoPago]=useState("completo");
  const [metodoPago,setMetodoPago]=useState("Efectivo");
  const [montoAbono,setMontoAbono]=useState("");

  const clientesFilt=clientes.filter(c=>c.nombre.toLowerCase().includes(clienteQ.toLowerCase())||(c.tel&&c.tel.includes(clienteQ))).slice(0,5);
  const selCliente=clientes.find(c=>c.id===clienteId);

  const calcTotal=()=>items.reduce((acc,it)=>{
    if(it.personalizado) return acc+(parseFloat(it.precioCustom)||0)*(it.piezas||1);
    const s=servicios.find(s=>s.id===it.servId);
    return acc+(s?s.precio*(it.piezas||1):0);
  },0);

  const addItem=()=>setItems([...items,{servId:servicios[0]?.id,piezas:1,personalizado:false,labelCustom:"",precioCustom:""}]);
  const removeItem=(i)=>setItems(items.filter((_,idx)=>idx!==i));
  const updateItem=(i,field,val)=>{const c=[...items];c[i]={...c[i],[field]:val};setItems(c);};

  const registrar=()=>{
    if(!clienteId&&modoCliente==="buscar"){setError("Selecciona o crea un cliente");return;}
    if(modoCliente==="nuevo"&&!nuevoCliente.nombre.trim()){setError("Escribe el nombre del cliente");return;}
    const total=calcTotal();
    if(tipoPago==="abono"){const m=parseFloat(montoAbono);if(!m||m<=0||m>=total){setError("El abono debe ser mayor a 0 y menor al total");return;}}
    let cid=clienteId,cNombre=selCliente?.nombre,cTel=selCliente?.tel,cDir=selCliente?.direccion||"";
    if(modoCliente==="nuevo"){const nc={...nuevoCliente,id:Date.now()};setClientes(prev=>[...prev,nc]);cid=nc.id;cNombre=nc.nombre;cTel=nc.tel;cDir=nc.direccion||"";}
    let abonos=[];
    if(tipoPago==="completo") abonos=[{monto:total,metodo:metodoPago,fecha:new Date().toISOString()}];
    else if(tipoPago==="abono") abonos=[{monto:parseFloat(montoAbono),metodo:metodoPago,fecha:new Date().toISOString()}];
    const venta={
      folio:folio(),fecha:new Date().toISOString(),entrega,
      clienteId:cid,clienteNombre:cNombre,clienteTel:cTel,clienteDireccion:cDir,empleadaId,
      items:items.map(it=>{
        if(it.personalizado) return {...it,label:it.labelCustom||"Servicio personalizado",precio:parseFloat(it.precioCustom)||0};
        const s=servicios.find(s=>s.id===it.servId);
        return {...it,label:s?.label,precio:s?.precio};
      }),
      pago:metodoPago,total,abonos,pagada:tipoPago==="completo",
      notas,checkMsgRetiro:false,checkMsgEntrega:false,facturadoSRI:false,
    };
    setVentas([venta,...ventas]);
    setTicket(venta);
    setClienteQ("");setClienteId(null);setNuevoCliente({nombre:"",tel:"",email:"",rfc:"",direccion:""});
    setItems([{servId:servicios[0]?.id,piezas:1,personalizado:false,labelCustom:"",precioCustom:""}]);
    setNotas("");setError("");setMontoAbono("");setTipoPago("completo");
  };

  const total=calcTotal();
  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Nueva Venta</h2>
      <Card title="👤 Cliente">
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {["buscar","nuevo"].map(m=>(
            <button key={m} style={{...S.pill,...(modoCliente===m?S.pillActive:{})}} onClick={()=>setModoCliente(m)}>
              {m==="buscar"?"Buscar cliente":"Nuevo cliente"}
            </button>
          ))}
        </div>
        {modoCliente==="buscar"?(
          <div>
            <input style={S.input} placeholder="Buscar por nombre o teléfono..." value={clienteQ} onChange={e=>{setClienteQ(e.target.value);setClienteId(null);}}/>
            {clienteQ&&clientesFilt.length>0&&!clienteId&&(
              <div style={S.dropdown}>
                {clientesFilt.map(c=>(
                  <div key={c.id} style={S.dropItem} onClick={()=>{setClienteId(c.id);setClienteQ(c.nombre);}}>
                    <strong>{c.nombre}</strong> <span style={{color:"#888",fontSize:12}}>{c.tel}</span>
                  </div>
                ))}
              </div>
            )}
            {clienteId&&selCliente&&(
              <div style={S.clienteTag}>✓ {selCliente.nombre}{selCliente.tel?` · ${selCliente.tel}`:""}
                <button style={S.tagX} onClick={()=>{setClienteId(null);setClienteQ("");}}>✕</button>
              </div>
            )}
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["nombre","Nombre *"],["tel","Teléfono"],["email","Email"],["rfc","RUC/RFC"]].map(([k,label])=>(
              <input key={k} style={S.input} placeholder={label} value={nuevoCliente[k]} onChange={e=>setNuevoCliente({...nuevoCliente,[k]:e.target.value})}/>
            ))}
            <input style={{...S.input,gridColumn:"1/-1"}} placeholder="📍 Dirección" value={nuevoCliente.direccion} onChange={e=>setNuevoCliente({...nuevoCliente,direccion:e.target.value})}/>
          </div>
        )}
      </Card>

      <Card title="🧺 Servicios">
        {items.map((it,i)=>(
          <div key={i} style={{marginBottom:10,background:"#f8fbfd",borderRadius:8,padding:10,border:"1px solid #e8f0f7"}}>
            <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.personalizado?{}:S.pillActive)}} onClick={()=>updateItem(i,"personalizado",false)}>Del menú</button>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.personalizado?S.pillActive:{})}} onClick={()=>updateItem(i,"personalizado",true)}>✏️ Personalizado</button>
              {items.length>1&&<button style={{...S.btnRemove,marginLeft:"auto"}} onClick={()=>removeItem(i)}>✕</button>}
            </div>
            {it.personalizado?(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
                <input style={S.input} placeholder="Nombre del servicio" value={it.labelCustom} onChange={e=>updateItem(i,"labelCustom",e.target.value)}/>
                <input type="number" style={{...S.input,width:80}} placeholder="$Precio" value={it.precioCustom} onChange={e=>updateItem(i,"precioCustom",e.target.value)}/>
                <input type="number" min={1} style={{...S.input,width:56,textAlign:"center"}} value={it.piezas} onChange={e=>updateItem(i,"piezas",parseInt(e.target.value)||1)}/>
              </div>
            ):(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <select style={{...S.input,flex:1}} value={it.servId} onChange={e=>updateItem(i,"servId",e.target.value)}>
                  {servicios.map(s=><option key={s.id} value={s.id}>{s.label} — ${s.precio.toFixed(2)}</option>)}
                </select>
                <input type="number" min={1} style={{...S.input,width:56,textAlign:"center"}} value={it.piezas} onChange={e=>updateItem(i,"piezas",parseInt(e.target.value)||1)}/>
              </div>
            )}
          </div>
        ))}
        <button style={S.btnAdd} onClick={addItem}>+ Agregar servicio</button>
        <div style={S.totalBox}>Total: <strong>${total.toFixed(2)}</strong></div>
      </Card>

      <Card title="💳 Pago">
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[{id:"completo",label:"✅ Pago completo"},{id:"abono",label:"💵 Abono"},{id:"retiro",label:"⏳ Paga al retirar"}].map(op=>(
            <button key={op.id} style={{...S.pill,...(tipoPago===op.id?S.pillActive:{}),fontSize:12}} onClick={()=>setTipoPago(op.id)}>{op.label}</button>
          ))}
        </div>
        {tipoPago!=="retiro"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.label}>Método de pago</label>
              <select style={S.input} value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}>
                {PAGOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            {tipoPago==="abono"&&<div><label style={S.label}>Monto del abono</label>
              <input type="number" style={S.input} placeholder={`Max $${total.toFixed(2)}`} value={montoAbono} onChange={e=>setMontoAbono(e.target.value)}/>
            </div>}
          </div>
        )}
        {tipoPago==="completo"&&<div style={S.pagoResumen}>✅ Paga <strong>${total.toFixed(2)}</strong> ahora · {metodoPago}</div>}
        {tipoPago==="abono"&&montoAbono&&<div style={{...S.pagoResumen,background:"#fff3e0",color:"#e65100"}}>💵 Abono: <strong>${parseFloat(montoAbono).toFixed(2)}</strong> · Pendiente: <strong>${(total-parseFloat(montoAbono)).toFixed(2)}</strong></div>}
        {tipoPago==="retiro"&&<div style={{...S.pagoResumen,background:"#fff3e0",color:"#e65100"}}>⏳ Pagará <strong>${total.toFixed(2)}</strong> al retirar</div>}
        <div style={{marginTop:10}}><label style={S.label}>Fecha de entrega</label>
          <input type="date" style={S.input} value={entrega} onChange={e=>setEntrega(e.target.value)}/>
        </div>
        <div style={{marginTop:8}}><label style={S.label}>Empleada</label>
          <select style={S.input} value={empleadaId} onChange={e=>setEmpleadaId(parseInt(e.target.value))}>
            {empleadas.filter(e=>e.activa).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div style={{marginTop:8}}><label style={S.label}>Notas</label>
          <textarea style={{...S.input,minHeight:56,resize:"vertical"}} placeholder="Instrucciones especiales..." value={notas} onChange={e=>setNotas(e.target.value)}/>
        </div>
      </Card>
      {error&&<div style={S.error}>{error}</div>}
      <button style={S.btnPrimary} onClick={registrar}>🧾 Registrar Venta</button>
    </div>
  );
}

// ─── VENTA CARD ────────────────────────────────────────────────────
function VentaCardItem({ v, empleadas, setTicket, addAbono, setVentas, esAdmin }) {
  const [showAbono,setShowAbono]=useState(false);
  const emp=empleadas.find(e=>e.id===v.empleadaId);
  const pendiente=saldoPendiente(v);
  const pagada=estaPagada(v);
  const abonos=v.abonos||[];
  const totalAbonado=abonos.reduce((a,ab)=>a+ab.monto,0);
  const toggleField=(field)=>setVentas&&setVentas(prev=>prev.map(vv=>vv.folio===v.folio?{...vv,[field]:!vv[field]}:vv));
  return (
    <>
      <div style={{...S.ventaCard,borderLeft:`4px solid ${v.anulada?"#9e9e9e":pagada?"#4caf50":"#ff9800"}`,opacity:v.anulada?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {esAdmin
              ? <div style={{fontWeight:700,color:"#1a3c5e"}}>{v.clienteNombre}</div>
              : <div style={{fontWeight:700,color:"#1a3c5e"}}>{v.folio}</div>
            }
            <div style={{fontSize:11,color:"#888"}}>{v.folio} · {fmt(v.fecha)}</div>
            {emp&&<div style={{fontSize:11,color:"#4db6e4"}}>👩 {emp.nombre}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:16,color:"#1a3c5e"}}>${v.total.toFixed(2)}</div>
            <div style={{...S.badge,background:pagada?"#e8f5e9":"#fff3e0",color:pagada?"#2e7d32":"#e65100"}}>
              {pagada?"✅ Pagado":`⏳ Debe $${pendiente.toFixed(2)}`}
            </div>
            {v.facturadoSRI&&<div style={{...S.badge,background:"#e8f5e9",color:"#2e7d32",marginTop:2}}>🧾 SRI</div>}
          </div>
        </div>
        <div style={{fontSize:12,color:"#555",marginTop:6}}>
          {v.items.map((it,i)=><span key={i}>{it.label}{it.piezas>1?` ×${it.piezas}`:""}{i<v.items.length-1?" · ":""}</span>)}
        </div>
        <div style={{fontSize:12,color:"#555",marginTop:2}}>📅 Entrega: {fmtDate(v.entrega)}</div>
        {v.anulada&&<div style={{background:"#ffebee",borderRadius:6,padding:"6px 10px",marginTop:6,fontSize:12,color:"#c62828"}}>❌ <strong>ANULADA</strong> — {v.motivoAnulacion} · {v.fechaAnulacion?fmtDate(v.fechaAnulacion):""}</div>}
        {abonos.length>0&&(
          <div style={{marginTop:8,background:"#f0faf4",borderRadius:8,padding:"8px 10px"}}>
            {abonos.map((ab,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#2e7d32"}}>
                <span>💚 {ab.metodo} · {fmtDate(ab.fecha)}</span>
                <strong>+${ab.monto.toFixed(2)}</strong>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,borderTop:"1px dashed #c8e6c9",marginTop:4,paddingTop:4}}>
              <span style={{color:"#888"}}>Pagado</span>
              <span style={{color:"#2e7d32",fontWeight:700}}>${totalAbonado.toFixed(2)} / ${v.total.toFixed(2)}</span>
            </div>
          </div>
        )}
        {setVentas&&(
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <label style={S.checkLabel}><input type="checkbox" checked={v.checkMsgRetiro||false} onChange={()=>toggleField("checkMsgRetiro")}/><span>📲 Msg retiro</span></label>
            <label style={S.checkLabel}><input type="checkbox" checked={v.checkMsgEntrega||false} onChange={()=>toggleField("checkMsgEntrega")}/><span>✅ Msg entrega</span></label>
            <label style={{...S.checkLabel,color:v.facturadoSRI?"#2e7d32":"#555"}}>
              <input type="checkbox" checked={v.facturadoSRI||false} onChange={()=>toggleField("facturadoSRI")}/>
              <span>🧾 Facturado SRI</span>
            </label>
          </div>
        )}
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
          <button style={S.btnTicket} onClick={()=>setTicket(v)}>🧾 Ticket</button>
          {!pagada&&<button style={{...S.btnTicket,background:"#fff3e0",color:"#e65100"}} onClick={()=>setShowAbono(true)}>💰 Registrar pago</button>}
          {!v.anulada&&setVentas&&esAdmin&&<button style={{...S.btnTicket,background:"#ffebee",color:"#c62828"}} onClick={()=>{
            const motivo=window.prompt("Motivo de anulación / nota de crédito:");
            if(motivo===null) return;
            setVentas(prev=>prev.map(vv=>vv.folio===v.folio?{...vv,anulada:true,motivoAnulacion:motivo,fechaAnulacion:new Date().toISOString()}:vv));
          }}>❌ Anular</button>}
          {v.anulada&&<div style={{...S.badge,background:"#ffebee",color:"#c62828",padding:"4px 10px"}}>❌ ANULADA</div>}
        </div>
      </div>
      {showAbono&&<AbonoModal venta={v} onSave={(abono)=>{addAbono(v.folio,abono);setShowAbono(false);}} onClose={()=>setShowAbono(false)}/>}
    </>
  );
}

// ─── HISTORIAL ─────────────────────────────────────────────────────
function Historial({ ventas, setVentas, empleadas, setTicket, addAbono, esAdmin, sesion }) {
  const [filtPago,setFiltPago]=useState("Todos");
  const [filtEst,setFiltEst]=useState("Todos");
  const [filtSRI,setFiltSRI]=useState("Todos");
  const [filtEmp,setFiltEmp]=useState("Todos");
  const [filtFecha,setFiltFecha]=useState("");
  const [busq,setBusq]=useState("");
  const filtered=ventas.filter(v=>{
    if(filtPago!=="Todos"){const m=(v.abonos||[]).map(a=>a.metodo);const match=filtPago==="Transferencia"?m.some(x=>esTranferencia(x)):m.includes(filtPago)||v.pago===filtPago;if(!match) return false;}
    if(filtEst==="Pagadas"&&!estaPagada(v)) return false;
    if(filtEst==="Pendientes"&&estaPagada(v)) return false;
    if(filtSRI==="Facturadas"&&!v.facturadoSRI) return false;
    if(filtSRI==="Sin factura"&&v.facturadoSRI) return false;
    if(filtEmp!=="Todos"&&String(v.empleadaId)!==filtEmp) return false;
    if(filtFecha&&!v.fecha.startsWith(filtFecha)) return false;
    if(busq&&!v.clienteNombre?.toLowerCase().includes(busq.toLowerCase())&&!v.folio.toLowerCase().includes(busq.toLowerCase())) return false;
    return true;
  });
  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Historial de Ventas</h2>
      <Card title="🔍 Filtros">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {esAdmin && <input style={S.input} placeholder="Buscar cliente o folio..." value={busq} onChange={e=>setBusq(e.target.value)}/>}
          <input type="month" style={{...S.input,...(!esAdmin?{gridColumn:"1/-1"}:{})}} value={filtFecha} onChange={e=>setFiltFecha(e.target.value)}/>
          <select style={S.input} value={filtPago} onChange={e=>setFiltPago(e.target.value)}>
            <option>Todos</option>{PAGOS.map(p=><option key={p}>{p}</option>)}
          </select>
          <select style={S.input} value={filtEst} onChange={e=>setFiltEst(e.target.value)}>
            <option>Todos</option><option>Pagadas</option><option>Pendientes</option>
          </select>
          {esAdmin && <select style={S.input} value={filtSRI} onChange={e=>setFiltSRI(e.target.value)}>
            <option>Todos</option><option>Facturadas</option><option>Sin factura</option>
          </select>}
          {esAdmin && <select style={S.input} value={filtEmp} onChange={e=>setFiltEmp(e.target.value)}>
            <option value="Todos">Todas las empleadas</option>
            {empleadas.map(e=><option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
          </select>}
        </div>
      </Card>
      <div style={{fontSize:12,color:"#888",marginBottom:8}}>
        {filtered.length} venta{filtered.length!==1?"s":""} — Total: ${filtered.reduce((a,v)=>a+v.total,0).toFixed(2)}
      </div>
      {filtered.length===0?<div style={S.empty}>No hay ventas con esos filtros</div>
        :filtered.map(v=><VentaCardItem key={v.folio} v={v} empleadas={empleadas} setTicket={setTicket} addAbono={addAbono} setVentas={setVentas} esAdmin={esAdmin}/>)}
    </div>
  );
}

// ─── PENDIENTES ────────────────────────────────────────────────────
function Pendientes({ ventas, empleadas, setTicket, addAbono, esAdmin, setVentas }) {
  const [filtro, setFiltro] = useState("todos"); // todos | pago | retiro
  const [busq, setBusq] = useState("");

  const pendientes = ventas.filter(v => !estaPagada(v) && !v.anulada);

  // Pendientes de PAGO (deben dinero)
  const pendientePago = pendientes.filter(v => saldoPendiente(v) > 0);
  // Pendientes de RETIRO (pagado pero no entregado aún — msg entrega no enviado)
  const pendienteRetiro = ventas.filter(v => estaPagada(v) && !v.anulada && !v.checkMsgEntrega);

  const mostrar = filtro === "pago" ? pendientePago
    : filtro === "retiro" ? pendienteRetiro
    : [...pendientes, ...pendienteRetiro.filter(v => estaPagada(v))];

  const filtrados = mostrar.filter(v =>
    !busq || v.clienteNombre?.toLowerCase().includes(busq.toLowerCase()) || v.folio.toLowerCase().includes(busq.toLowerCase())
  );

  const totalPorCobrar = pendientePago.reduce((a, v) => a + saldoPendiente(v), 0);

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>⏳ Pendientes</h2>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={{ ...S.kpi, borderLeft: "4px solid #e53935", cursor: "pointer" }} onClick={() => setFiltro("pago")}>
          <div style={{ fontSize: 22 }}>💸</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#e53935" }}>${totalPorCobrar.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: "#1a3c5e", fontWeight: 600 }}>Pendiente cobro</div>
            <div style={{ fontSize: 11, color: "#888" }}>{pendientePago.length} órdenes</div>
          </div>
        </div>
        <div style={{ ...S.kpi, borderLeft: "4px solid #ff9800", cursor: "pointer" }} onClick={() => setFiltro("retiro")}>
          <div style={{ fontSize: 22 }}>📦</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#ff9800" }}>{pendienteRetiro.length}</div>
            <div style={{ fontSize: 12, color: "#1a3c5e", fontWeight: 600 }}>Pendiente retiro</div>
            <div style={{ fontSize: 11, color: "#888" }}>Listas para entregar</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "todos", label: "📋 Todos" },
          { id: "pago", label: "💸 Pendiente cobro" },
          { id: "retiro", label: "📦 Pendiente retiro" },
        ].map(f => (
          <button key={f.id} style={{ ...S.pill, ...(filtro === f.id ? S.pillActive : {}), fontSize: 12 }}
            onClick={() => setFiltro(f.id)}>{f.label}</button>
        ))}
      </div>

      <input style={{ ...S.input, marginBottom: 12 }} placeholder="🔍 Buscar cliente o folio..."
        value={busq} onChange={e => setBusq(e.target.value)} />

      {filtrados.length === 0 ? (
        <div style={{ ...S.empty, paddingTop: 30 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div>{filtro === "retiro" ? "¡Todo entregado!" : filtro === "pago" ? "¡Todo cobrado!" : "¡Sin pendientes!"}</div>
        </div>
      ) : (
        filtrados.map(v => (
          <PendienteItem key={v.folio} v={v} empleadas={empleadas} setTicket={setTicket} addAbono={addAbono} setVentas={setVentas}/>
        ))
      )}
    </div>
  );
}

function PendienteItem({ v, empleadas, setTicket, addAbono, setVentas }) {
  const [showAbono, setShowAbono] = useState(false);
  const emp = empleadas.find(e => e.id === v.empleadaId);
  const pendiente = saldoPendiente(v);
  const pagada = estaPagada(v);
  const abonos = v.abonos || [];
  const totalAbonado = abonos.reduce((a, ab) => a + ab.monto, 0);

  const toggleField = (field) => setVentas && setVentas(prev =>
    prev.map(vv => vv.folio === v.folio ? { ...vv, [field]: !vv[field] } : vv)
  );

  return (
    <div>
      <div style={{ ...S.ventaCard, borderLeft: `4px solid ${pagada ? "#ff9800" : "#e53935"}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {!pagada && <div style={{ ...S.badge, background: "#ffebee", color: "#c62828" }}>💸 Pendiente cobro</div>}
          {pagada && !v.checkMsgEntrega && <div style={{ ...S.badge, background: "#fff3e0", color: "#e65100" }}>📦 Pendiente retiro</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#1a3c5e", fontSize: 15 }}>{v.clienteNombre}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{v.folio} · {fmt(v.fecha)}</div>
            {emp && <div style={{ fontSize: 11, color: "#4db6e4" }}>👩 Registró: {emp.nombre}</div>}
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              {v.items.map((it, i) => <span key={i}>{it.label}{it.piezas > 1 ? ` ×${it.piezas}` : ""}{i < v.items.length - 1 ? " · " : ""}</span>)}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>📅 Entrega: {fmtDate(v.entrega)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1a3c5e" }}>${v.total.toFixed(2)}</div>
            {!pagada && <div style={{ fontSize: 13, color: "#e53935", fontWeight: 700 }}>Debe: ${pendiente.toFixed(2)}</div>}
            {totalAbonado > 0 && <div style={{ fontSize: 11, color: "#2e7d32" }}>Abonado: ${totalAbonado.toFixed(2)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgRetiro||false} onChange={() => toggleField("checkMsgRetiro")}/>
            <span>📲 Msg retiro enviado</span>
          </label>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgEntrega||false} onChange={() => toggleField("checkMsgEntrega")}/>
            <span>✅ Entregado al cliente</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={S.btnTicket} onClick={() => setTicket(v)}>🧾 Ticket</button>
          {!pagada && (
            <button style={{ ...S.btnTicket, background: "#e8f5e9", color: "#2e7d32", fontWeight: 700 }}
              onClick={() => setShowAbono(true)}>
              💰 Cobrar
            </button>
          )}
        </div>
      </div>
      {showAbono && (
        <AbonoModal venta={v}
          onSave={(abono) => { addAbono(v.folio, abono); setShowAbono(false); }}
          onClose={() => setShowAbono(false)}/>
      )}
    </div>
  );
}

// ─── REPORTES CON EXPORTACIÓN EXCEL ───────────────────────────────
function Reportes({ ventas, empleadas }) {
  const hoy=new Date().toISOString().split("T")[0];
  const semana=semanaISO(new Date());
  const mes=mesKey(new Date());
  const [mesSelec,setMesSelec]=useState(mes);
  const [empSelec,setEmpSelec]=useState("Todos");

  const ventasHoy=ventas.filter(v=>v.fecha.startsWith(hoy));
  const ventasSem=ventas.filter(v=>semanaISO(v.fecha)===semana);
  const ventasMes=ventas.filter(v=>mesKey(v.fecha)===mesSelec);
  const ventasMesEmp=empSelec==="Todos"?ventasMes:ventasMes.filter(v=>String(v.empleadaId)===empSelec);

  const sum=arr=>arr.reduce((a,v)=>a+v.total,0);
  const cobrado=arr=>arr.reduce((a,v)=>a+(v.abonos||[]).reduce((x,ab)=>x+ab.monto,0),0);
  const porCobrar=arr=>arr.reduce((a,v)=>a+saldoPendiente(v),0);

  const byPago=PAGOS.map(p=>({label:p,val:ventasMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo===p)).reduce((a,ab)=>a+ab.monto,0)}));
  const totalCobradoMes=byPago.reduce((a,p)=>a+p.val,0);

  const ventasPorMes=(()=>{const map={};ventas.forEach(v=>{const k=mesKey(v.fecha);map[k]=(map[k]||0)+v.total;});return Object.entries(map).sort().slice(-6).map(([k,v])=>({label:k.slice(5)+"/"+k.slice(0,4),val:v}));})();

  const empStats=empleadas.map(e=>{
    const mv=ventas.filter(v=>v.empleadaId===e.id&&mesKey(v.fecha)===mesSelec);
    return {...e,count:mv.length,total:mv.reduce((a,v)=>a+v.total,0)};
  }).sort((a,b)=>b.count-a.count);

  const BtnExport=({label,arr,titulo})=>(
    <button style={{...S.btnSmall,background:"#e8f5e9",color:"#2e7d32",display:"flex",alignItems:"center",gap:4}}
      onClick={()=>exportarCSV(arr,titulo,empleadas)}>
      📥 {label}
    </button>
  );

  const KPI=({icon,label,val,sub,color})=>(
    <div style={{...S.kpi,borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div><div style={{fontWeight:800,fontSize:18,color}}>{val}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"#888"}}>{sub}</div>}</div>
    </div>
  );

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>📊 Reportes</h2>

      {/* EXPORTAR */}
      <Card title="📥 Exportar a Excel">
        <p style={{fontSize:13,color:"#555",marginBottom:12}}>Descarga reportes en formato CSV que se abren directamente en Excel.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <BtnExport label="Reporte hoy" arr={ventasHoy} titulo="reporte-hoy"/>
          <BtnExport label="Reporte semanal" arr={ventasSem} titulo="reporte-semana"/>
          <BtnExport label="Reporte mensual" arr={ventasMes} titulo={`reporte-${mesSelec}`}/>
          <BtnExport label="Todas las ventas" arr={ventas} titulo="reporte-completo"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
          <div>
            <label style={S.label}>Mes para reporte</label>
            <input type="month" style={S.input} value={mesSelec} onChange={e=>setMesSelec(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Filtrar por empleada</label>
            <select style={S.input} value={empSelec} onChange={e=>setEmpSelec(e.target.value)}>
              <option value="Todos">Todas</option>
              {empleadas.map(e=><option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        {empSelec!=="Todos"&&(
          <button style={{...S.btnSmall,marginTop:8,background:"#e8f5e9",color:"#2e7d32"}}
            onClick={()=>exportarCSV(ventasMesEmp,`reporte-${empleadas.find(e=>String(e.id)===empSelec)?.nombre}-${mesSelec}`,empleadas)}>
            📥 Exportar reporte por empleada
          </button>
        )}
      </Card>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <KPI icon="☀️" label="Ventas hoy" val={`$${sum(ventasHoy).toFixed(2)}`} sub={`${ventasHoy.length} órdenes`} color="#f59e0b"/>
        <KPI icon="📅" label="Esta semana" val={`$${sum(ventasSem).toFixed(2)}`} sub={`${ventasSem.length} órdenes`} color="#4db6e4"/>
        <KPI icon="💚" label="Cobrado este mes" val={`$${cobrado(ventasMes).toFixed(2)}`} sub="Pagos recibidos" color="#4caf50"/>
        <KPI icon="⏳" label="Por cobrar" val={`$${porCobrar(ventasMes).toFixed(2)}`} sub="Saldo pendiente" color="#e53935"/>
      </div>

      <Card title="💳 Cobros del mes por método">
        {byPago.map(p=>(
          <div key={p.label} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>{p.label}</span><strong>${p.val.toFixed(2)}</strong></div>
            <div style={{background:"#e8f0f7",borderRadius:4,height:8}}>
              <div style={{background:p.label==="Efectivo"?"#4caf50":esTranferencia(p.label)?"#4db6e4":"#ff9800",width:`${totalCobradoMes?(p.val/totalCobradoMes)*100:0}%`,height:"100%",borderRadius:4}}/>
            </div>
          </div>
        ))}
      </Card>

      <Card title="📈 Ventas por mes (últimos 6)">
        {ventasPorMes.length===0?<div style={S.empty}>Sin datos</div>:ventasPorMes.map(m=>{
          const max=Math.max(...ventasPorMes.map(x=>x.val),1);
          return(
            <div key={m.label} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}><span>{m.label}</span><strong>${m.val.toFixed(2)}</strong></div>
              <div style={{background:"#e8f0f7",borderRadius:4,height:10}}><div style={{background:"#1a3c5e",width:`${(m.val/max)*100}%`,height:"100%",borderRadius:4}}/></div>
            </div>
          );
        })}
      </Card>

      <Card title="🏆 Ranking empleadas">
        {empStats.map((e,i)=>{
          const meta=e.metaVentas||20;
          const pct=Math.min(100,(e.count/meta)*100);
          const ganoBono=e.count>=meta;
          return(
            <div key={e.id} style={{padding:"10px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"👤"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{e.nombre}</div>
                  <div style={{fontSize:12,color:"#888"}}>{e.count} ventas · ${e.total.toFixed(2)} · Meta: {meta}</div>
                </div>
                {ganoBono&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 ${e.montoBonus||0}</div>}
              </div>
              <div style={{marginTop:6}}>
                <div style={{background:"#e8f0f7",borderRadius:6,height:6}}><div style={{background:ganoBono?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── INVENTARIO ────────────────────────────────────────────────────
function Inventario({ inventario, setInventario }) {
  const [nuevo,setNuevo]=useState({nombre:"",stock:0,min:1,unidad:"pzas"});
  const update=(id,field,val)=>setInventario(prev=>prev.map(i=>i.id===id?{...i,[field]:val}:i));
  const eliminar=(id)=>setInventario(prev=>prev.filter(i=>i.id!==id));
  const agregar=()=>{if(!nuevo.nombre.trim()) return;setInventario(prev=>[...prev,{...nuevo,id:Date.now(),stock:parseFloat(nuevo.stock)||0}]);setNuevo({nombre:"",stock:0,min:1,unidad:"pzas"});};
  const bajoStock=inventario.filter(i=>i.stock<=i.min);
  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Inventario de Insumos</h2>
      {bajoStock.length>0&&<div style={S.alerta}>⚠️ Stock bajo: {bajoStock.map(i=>i.nombre).join(", ")}</div>}
      <Card title="📋 Insumos">
        {inventario.map(item=>(
          <div key={item.id} style={S.ventaCard}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:600}}>{item.nombre}</div><div style={{fontSize:12,color:"#888"}}>Mínimo: {item.min} {item.unidad}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{...S.badge,background:item.stock<=item.min?"#ffebee":"#e8f5e9",color:item.stock<=item.min?"#c62828":"#2e7d32",fontSize:14,fontWeight:700}}>{item.stock} {item.unidad}</div>
                <button style={S.btnRemove} onClick={()=>eliminar(item.id)}>✕</button>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
              <button style={S.btnSmall} onClick={()=>update(item.id,"stock",Math.max(0,item.stock-1))}>−</button>
              <input type="number" style={{...S.input,width:70,textAlign:"center",padding:"4px 6px"}} value={item.stock} onChange={e=>update(item.id,"stock",parseFloat(e.target.value)||0)}/>
              <button style={S.btnSmall} onClick={()=>update(item.id,"stock",item.stock+1)}>+</button>
            </div>
          </div>
        ))}
      </Card>
      <Card title="➕ Agregar insumo">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={{...S.input,gridColumn:"1/-1"}} placeholder="Nombre" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/>
          <input type="number" style={S.input} placeholder="Stock inicial" value={nuevo.stock} onChange={e=>setNuevo({...nuevo,stock:e.target.value})}/>
          <input type="number" style={S.input} placeholder="Stock mínimo" value={nuevo.min} onChange={e=>setNuevo({...nuevo,min:e.target.value})}/>
          <input style={S.input} placeholder="Unidad (kg,L,pzas)" value={nuevo.unidad} onChange={e=>setNuevo({...nuevo,unidad:e.target.value})}/>
        </div>
        <button style={{...S.btnPrimary,marginTop:10}} onClick={agregar}>Agregar</button>
      </Card>
    </div>
  );
}

// ─── EQUIPO ────────────────────────────────────────────────────────
function Equipo({ empleadas, setEmpleadas, ventas, esAdmin }) {
  const [nuevo,setNuevo]=useState({nombre:"",metaVentas:20,montoBonus:20});
  const [editId,setEditId]=useState(null);
  const [editData,setEditData]=useState({nombre:"",metaVentas:20,montoBonus:20});
  const mes=mesKey(new Date());

  const agregar=()=>{
    if(!nuevo.nombre.trim()) return;
    setEmpleadas(prev=>[...prev,{id:Date.now(),nombre:nuevo.nombre,activa:true,metaVentas:parseInt(nuevo.metaVentas)||20,montoBonus:parseFloat(nuevo.montoBonus)||0}]);
    setNuevo({nombre:"",metaVentas:20,montoBonus:20});
  };
  const toggle=(id)=>setEmpleadas(prev=>prev.map(e=>e.id===id?{...e,activa:!e.activa}:e));
  const iniciarEdicion=(e)=>{setEditId(e.id);setEditData({nombre:e.nombre,metaVentas:e.metaVentas||20,montoBonus:e.montoBonus||0});};
  const guardarEdicion=()=>{
    setEmpleadas(prev=>prev.map(e=>e.id===editId?{...e,...editData,metaVentas:parseInt(editData.metaVentas)||20,montoBonus:parseFloat(editData.montoBonus)||0}:e));
    setEditId(null);
  };
  const empStats=empleadas.map(e=>{
    const mv=ventas.filter(v=>v.empleadaId===e.id&&mesKey(v.fecha)===mes);
    return {...e,ventasMes:mv.length,totalMes:mv.reduce((a,v)=>a+v.total,0)};
  });

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Equipo & Bonos</h2>
      <Card title="👩 Empleadas">
        {empStats.map(e=>{
          const meta=e.metaVentas||20;
          const bono=e.montoBonus||0;
          const pct=Math.min(100,(e.ventasMes/meta)*100);
          const ganoBono=e.ventasMes>=meta;
          return(
            <div key={e.id} style={{...S.ventaCard,opacity:e.activa?1:0.6}}>
              {editId===e.id?(
                <div>
                  <div style={{fontWeight:700,color:"#1a3c5e",marginBottom:8}}>✏️ Editando</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:8}}>
                    <div><label style={S.label}>Nombre</label><input style={S.input} value={editData.nombre} onChange={ev=>setEditData({...editData,nombre:ev.target.value})}/></div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={S.label}>Meta ventas/mes</label><input type="number" style={S.input} value={editData.metaVentas} onChange={ev=>setEditData({...editData,metaVentas:ev.target.value})}/></div>
                      <div><label style={S.label}>Monto bono ($)</label><input type="number" style={S.input} value={editData.montoBonus} onChange={ev=>setEditData({...editData,montoBonus:ev.target.value})}/></div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...S.btnPrimary,flex:1}} onClick={guardarEdicion}>✓ Guardar</button>
                    <button style={S.btnClose} onClick={()=>setEditId(null)}>Cancelar</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{e.nombre}</div>
                      <div style={{fontSize:12,color:"#888"}}>{e.ventasMes} ventas este mes</div>
                      {esAdmin && <div style={{fontSize:11,color:"#4db6e4"}}>Meta: {meta} ventas · Bono: ${bono}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      {ganoBono&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 {esAdmin?`$${bono}`:"¡Bono!"}</div>}
                      {esAdmin && <button style={S.btnSmall} onClick={()=>iniciarEdicion(e)}>✏️</button>}
                      {esAdmin && <button style={{...S.btnSmall,background:e.activa?"#ffebee":"#e8f5e9",color:e.activa?"#c62828":"#2e7d32"}} onClick={()=>toggle(e.id)}>{e.activa?"Desactivar":"Activar"}</button>}
                    </div>
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:3}}><span>Progreso bono</span><span>{e.ventasMes}/{meta}</span></div>
                    <div style={{background:"#e8f0f7",borderRadius:6,height:8}}><div style={{background:ganoBono?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </Card>
      {esAdmin && <Card title="➕ Agregar empleada">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={{...S.input,gridColumn:"1/-1"}} placeholder="Nombre completo" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/>
          <div><label style={S.label}>Meta ventas/mes</label><input type="number" style={S.input} value={nuevo.metaVentas} onChange={e=>setNuevo({...nuevo,metaVentas:e.target.value})}/></div>
          <div><label style={S.label}>Monto bono ($)</label><input type="number" style={S.input} value={nuevo.montoBonus} onChange={e=>setNuevo({...nuevo,montoBonus:e.target.value})}/></div>
        </div>
        <button style={{...S.btnPrimary,marginTop:10}} onClick={agregar}>Agregar empleada</button>
      </Card>}
    </div>
  );
}

// ─── CONFIGURACION ─────────────────────────────────────────────────
function Configuracion({ servicios, setServicios, exportarDatos, importarDatos }) {
  const [nuevo,setNuevo]=useState({label:"",precio:""});
  const [editId,setEditId]=useState(null);
  const [editData,setEditData]=useState({label:"",precio:""});
  const [busq,setBusq]=useState("");

  const agregar=()=>{
    if(!nuevo.label.trim()||!nuevo.precio) return;
    setServicios(prev=>[...prev,{id:"custom-"+Date.now(),label:nuevo.label.toUpperCase(),precio:parseFloat(nuevo.precio)}]);
    setNuevo({label:"",precio:""});
  };
  const eliminar=(id)=>setServicios(prev=>prev.filter(s=>s.id!==id));
  const iniciarEdicion=(s)=>{setEditId(s.id);setEditData({label:s.label,precio:s.precio});};
  const guardarEdicion=()=>{
    setServicios(prev=>prev.map(s=>s.id===editId?{...s,label:editData.label.toUpperCase(),precio:parseFloat(editData.precio)}:s));
    setEditId(null);
  };
  const filtrados=servicios.filter(s=>s.label.toLowerCase().includes(busq.toLowerCase()));

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>⚙️ Configuración</h2>
      <Card title="💾 Respaldo de datos">
        <p style={{fontSize:13,color:"#555",marginBottom:12}}>Exporta todos tus datos para guardar o restaurar en otro dispositivo.</p>
        <button style={{...S.btnPrimary,marginBottom:10}} onClick={exportarDatos}>📥 Exportar datos (Respaldo)</button>
        <label style={{...S.btnPrimary,display:"block",textAlign:"center",cursor:"pointer",background:"#e8f5fd",color:"#1a3c5e",padding:"13px",borderRadius:10,fontSize:15,fontWeight:700}}>
          📤 Importar datos (Restaurar)
          <input type="file" accept=".json" style={{display:"none"}} onChange={importarDatos}/>
        </label>
        <p style={{fontSize:11,color:"#aaa",marginTop:8}}>⚠️ Importar reemplazará todos los datos actuales.</p>
      </Card>
      <Card title="➕ Agregar nuevo servicio">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
          <input style={S.input} placeholder="Nombre del servicio" value={nuevo.label} onChange={e=>setNuevo({...nuevo,label:e.target.value})}/>
          <input type="number" style={{...S.input,width:90}} placeholder="$Precio" value={nuevo.precio} onChange={e=>setNuevo({...nuevo,precio:e.target.value})}/>
        </div>
        <button style={{...S.btnPrimary,marginTop:8}} onClick={agregar}>Agregar servicio</button>
      </Card>
      <Card title={`📋 Servicios (${servicios.length})`}>
        <input style={{...S.input,marginBottom:10}} placeholder="Buscar servicio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
        {filtrados.map(s=>(
          <div key={s.id} style={{...S.ventaCard,padding:"8px 12px"}}>
            {editId===s.id?(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
                <input style={S.input} value={editData.label} onChange={e=>setEditData({...editData,label:e.target.value})}/>
                <input type="number" style={{...S.input,width:80}} value={editData.precio} onChange={e=>setEditData({...editData,precio:e.target.value})}/>
                <button style={{...S.btnSmall,background:"#e8f5e9",color:"#2e7d32"}} onClick={guardarEdicion}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.label}</div>
                  <div style={{fontSize:12,color:"#4db6e4",fontWeight:700}}>${s.precio.toFixed(2)}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={S.btnSmall} onClick={()=>iniciarEdicion(s)}>✏️</button>
                  <button style={S.btnRemove} onClick={()=>eliminar(s.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── CIERRE DE CAJA ────────────────────────────────────────────────
const BILLETES = [100, 50, 20, 10, 5, 1];
const MONEDAS = [0.50, 0.25, 0.10, 0.05, 0.01];

function CierreCaja({ ventas, empleadas }) {
  const hoy = new Date().toISOString().split("T")[0];
  const APERTURA_KEY = "ll_apertura_" + hoy;
  const CIERRE_KEY = "ll_cierre_" + hoy;

  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem(APERTURA_KEY) ? "cierre" : "apertura"; } catch { return "apertura"; }
  });
  const [apertura, setApertura] = useState(() => {
    try { const a = localStorage.getItem(APERTURA_KEY); return a ? JSON.parse(a) : null; } catch { return null; }
  });
  const [cierreGuardado, setCierreGuardado] = useState(() => {
    try { const c = localStorage.getItem(CIERRE_KEY); return c ? JSON.parse(c) : null; } catch { return null; }
  });

  // APERTURA STATE
  const [aperturaEmpleada, setAperturaEmpleada] = useState(empleadas[0]?.id || null);
  const [fondoInicial, setFondoInicial] = useState("15.00");

  // CIERRE STATE - conteo por denominación
  const [empleadaId, setEmpleadaId] = useState(empleadas[0]?.id || null);
  const [billetes, setBilletes] = useState(() => Object.fromEntries(BILLETES.map(b => [b, ""])));
  const [monedas, setMonedas] = useState(() => Object.fromEntries(MONEDAS.map(m => [m, ""])));
  const [transferPichincha, setTransferPichincha] = useState("");
  const [transferJEP, setTransferJEP] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [paso, setPaso] = useState(1); // 1=billetes, 2=monedas, 3=transferencias, 4=resultado
  const [confirmado, setConfirmado] = useState(false);

  const ventasHoy = ventas.filter(v => v.fecha.startsWith(hoy) && !v.anulada);
  const ventasEmp = empleadaId === "todos" ? ventasHoy : ventasHoy.filter(v => String(v.empleadaId) === String(empleadaId));

  const esperadoEfectivo = ventasEmp.flatMap(v => (v.abonos || []).filter(a => a.metodo === "Efectivo")).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTransferencia = ventasEmp.flatMap(v => (v.abonos || []).filter(a => esTranferencia(a.metodo))).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTarjeta = ventasEmp.flatMap(v => (v.abonos || []).filter(a => a.metodo === "Tarjeta")).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTotal = esperadoEfectivo + esperadoTransferencia + esperadoTarjeta;

  // Calcular totales del conteo
  const totalBilletes = BILLETES.reduce((a, b) => a + (parseFloat(billetes[b]) || 0) * b, 0);
  const totalMonedas = MONEDAS.reduce((a, m) => a + (parseFloat(monedas[m]) || 0) * m, 0);
  const totalEfectivo = parseFloat((totalBilletes + totalMonedas).toFixed(2));
  const totalTransfer = (parseFloat(transferPichincha) || 0) + (parseFloat(transferJEP) || 0);
  const totalTarjeta = parseFloat(tarjeta) || 0;
  const fondo = apertura?.fondo || 15;
  const efNeto = parseFloat((totalEfectivo - fondo).toFixed(2));
  const ventasReales = parseFloat((efNeto + totalTransfer + totalTarjeta).toFixed(2));
  const difEf = parseFloat((efNeto - esperadoEfectivo).toFixed(2));
  const difTr = parseFloat((totalTransfer - esperadoTransferencia).toFixed(2));
  const difTa = parseFloat((totalTarjeta - esperadoTarjeta).toFixed(2));
  const difTotal = parseFloat((ventasReales - esperadoTotal).toFixed(2));

  const confirmarCierre = () => {
    const datos = {
      fecha: new Date().toISOString(),
      empleada: empleadas.find(e => String(e.id) === String(empleadaId))?.nombre || "Todas",
      billetes, monedas, totalBilletes, totalMonedas, totalEfectivo,
      transferPichincha: parseFloat(transferPichincha) || 0,
      transferJEP: parseFloat(transferJEP) || 0,
      totalTransfer, totalTarjeta, fondo, efNeto, ventasReales,
      esperadoEfectivo, esperadoTransferencia, esperadoTarjeta, esperadoTotal,
      difEf, difTr, difTa, difTotal,
      totalVentas: ventasEmp.length,
      totalVentasVal: ventasEmp.reduce((a, v) => a + v.total, 0),
    };
    try { localStorage.setItem(CIERRE_KEY, JSON.stringify(datos)); } catch {}
    setCierreGuardado(datos);
    setConfirmado(true);
    imprimirCierre(datos);
  };

  const imprimirCierre = (d) => {
    const w = window.open("", "_blank", "width=420,height=700");
    w.document.write(`
      <html><head><title>Cierre de Caja</title>
      <style>
        body{font-family:sans-serif;padding:16px;max-width:360px;margin:0 auto}
        h2{text-align:center;color:#1a3c5e;margin:4px 0}.sub{text-align:center;color:#888;font-size:12px;margin-bottom:12px}
        .row{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
        .row-sm{display:flex;justify-content:space-between;margin:2px 0;font-size:12px;color:#555}
        .divider{border-top:1px dashed #ccc;margin:10px 0}
        .total{font-size:16px;font-weight:800;margin:4px 0}
        .ok{color:#2e7d32;font-weight:700}.bad{color:#c62828;font-weight:700}.info{color:#1565c0;font-weight:700}
        .result{text-align:center;font-size:20px;font-weight:800;padding:12px;border-radius:8px;margin:12px 0}
        .result.ok{background:#e8f5e9;color:#2e7d32}.result.bad{background:#ffebee;color:#c62828}.result.info{background:#e3f2fd;color:#1565c0}
        table{width:100%;border-collapse:collapse;font-size:12px}
        td{padding:3px 4px}td:last-child{text-align:right}
        .logo{text-align:center;font-size:32px;margin-bottom:4px}
      </style></head><body>
      <div class="logo">🫧</div>
      <h2>Lava&Listo</h2>
      <div class="sub">CIERRE DE CAJA</div>
      <div class="divider"></div>
      <div class="row"><span>Fecha</span><span>${new Date(d.fecha).toLocaleString("es-MX")}</span></div>
      <div class="row"><span>Empleada</span><span>${d.empleada}</span></div>
      <div class="row"><span>Ventas del día</span><span>${d.totalVentas} órdenes · $${d.totalVentasVal.toFixed(2)}</span></div>
      <div class="divider"></div>
      <strong>💵 CONTEO DE EFECTIVO</strong>
      <table style="margin-top:6px">
        ${BILLETES.filter(b => (parseFloat(d.billetes[b]) || 0) > 0).map(b => `<tr><td>$${b} × ${d.billetes[b]}</td><td>$${(b * d.billetes[b]).toFixed(2)}</td></tr>`).join("")}
        ${MONEDAS.filter(m => (parseFloat(d.monedas[m]) || 0) > 0).map(m => `<tr><td>$${m} × ${d.monedas[m]}</td><td>$${(m * d.monedas[m]).toFixed(2)}</td></tr>`).join("")}
        <tr style="font-weight:700;border-top:1px solid #ccc"><td>Total efectivo</td><td>$${d.totalEfectivo.toFixed(2)}</td></tr>
        <tr style="color:#e65100"><td>— Fondo caja</td><td>-$${d.fondo.toFixed(2)}</td></tr>
        <tr style="font-weight:800"><td>Efectivo neto</td><td>$${d.efNeto.toFixed(2)}</td></tr>
      </table>
      <div class="divider"></div>
      <div class="row"><span>🏦 Transf. Pichincha</span><span>$${d.transferPichincha.toFixed(2)}</span></div>
      <div class="row"><span>🏦 Transf. JEP</span><span>$${d.transferJEP.toFixed(2)}</span></div>
      <div class="row"><span>💳 Tarjeta</span><span>$${d.totalTarjeta.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="row total"><span>TOTAL CONTADO</span><span>$${(d.efNeto + d.totalTransfer + d.totalTarjeta).toFixed(2)}</span></div>
      <div class="row total"><span>TOTAL ESPERADO</span><span>$${d.esperadoTotal.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="row"><span>Efectivo</span><span class="${d.difEf===0?"ok":d.difEf>0?"info":"bad"}">${d.difEf===0?"✅ Cuadra":d.difEf>0?`+$${d.difEf.toFixed(2)}`:`-$${Math.abs(d.difEf).toFixed(2)}`}</span></div>
      <div class="row"><span>Transferencias</span><span class="${d.difTr===0?"ok":d.difTr>0?"info":"bad"}">${d.difTr===0?"✅ Cuadra":d.difTr>0?`+$${d.difTr.toFixed(2)}`:`-$${Math.abs(d.difTr).toFixed(2)}`}</span></div>
      <div class="row"><span>Tarjeta</span><span class="${d.difTa===0?"ok":d.difTa>0?"info":"bad"}">${d.difTa===0?"✅ Cuadra":d.difTa>0?`+$${d.difTa.toFixed(2)}`:`-$${Math.abs(d.difTa).toFixed(2)}`}</span></div>
      <div class="${d.difTotal===0?"result ok":d.difTotal>0?"result info":"result bad"}">
        ${d.difTotal===0?"✅ CAJA CUADRADA":d.difTotal>0?`📈 SOBRA $${d.difTotal.toFixed(2)}`:`⚠️ FALTA $${Math.abs(d.difTotal).toFixed(2)}`}
      </div>
      <div class="divider"></div>
      <p style="text-align:center;font-size:10px;color:#aaa">Lava&Listo · Sistema de ventas<br>Cierre generado: ${new Date().toLocaleString("es-MX")}</p>
      <script>window.print();window.close();</script>
      </body></html>
    `);
    w.document.close();
  };

  const registrarApertura = () => {
    const datos = {
      empleadaId: aperturaEmpleada,
      empleadaNombre: empleadas.find(e => String(e.id) === String(aperturaEmpleada))?.nombre || "",
      fondo: parseFloat(fondoInicial) || 15,
      fecha: new Date().toISOString(),
    };
    try { localStorage.setItem(APERTURA_KEY, JSON.stringify(datos)); } catch {}
    setApertura(datos);
    setModo("cierre");
    const w = window.open("", "_blank", "width=380,height=400");
    if (w) {
      w.document.write(`<html><head><title>Apertura</title><style>body{font-family:sans-serif;padding:20px;max-width:320px;margin:0 auto;text-align:center}h2{color:#1a3c5e}.divider{border-top:1px dashed #ccc;margin:12px 0}.row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px;text-align:left}.big{font-size:26px;font-weight:800;color:#1a3c5e}</style></head><body><div style="font-size:36px">🫧</div><h2>Lava&Listo</h2><p><strong>APERTURA DE CAJA</strong></p><div class="divider"></div><div class="row"><span>Fecha</span><span>${new Date(datos.fecha).toLocaleString("es-MX")}</span></div><div class="row"><span>Abrió</span><span>${datos.empleadaNombre}</span></div><div class="divider"></div><p>Fondo inicial:</p><div class="big">$${datos.fondo.toFixed(2)}</div><div class="divider"></div><p style="font-size:11px;color:#aaa">Lava&Listo · Sistema de ventas</p><script>window.print();window.close();</script></body></html>`);
      w.document.close();
    }
  };

  const DifBadge = ({ dif }) => (
    <span style={{ fontWeight: 700, fontSize: 13, color: dif === 0 ? "#2e7d32" : dif > 0 ? "#1565c0" : "#c62828" }}>
      {dif === 0 ? "✅ Cuadra" : dif > 0 ? `📈 Sobra $${dif.toFixed(2)}` : `⚠️ Falta $${Math.abs(dif).toFixed(2)}`}
    </span>
  );

  const ContadorDenominacion = ({ valor, cantidad, onChange, tipo }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f4f8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ background: tipo === "billete" ? "#fff8e1" : "#e8f5e9", borderRadius: 6, padding: "4px 10px", fontSize: 14, fontWeight: 700, color: tipo === "billete" ? "#f59e0b" : "#2e7d32", minWidth: 56, textAlign: "center" }}>
          ${valor}
        </div>
        <span style={{ fontSize: 12, color: "#888" }}>× cantidad</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{ ...S.btnSmall, width: 32, textAlign: "center" }} onClick={() => onChange(Math.max(0, (parseFloat(cantidad) || 0) - 1))}>−</button>
        <input type="number" min="0" style={{ ...S.input, width: 60, textAlign: "center", padding: "6px 4px" }}
          value={cantidad} onChange={e => onChange(e.target.value)} />
        <button style={{ ...S.btnSmall, width: 32, textAlign: "center" }} onClick={() => onChange((parseFloat(cantidad) || 0) + 1)}>+</button>
        <div style={{ minWidth: 64, textAlign: "right", fontWeight: 700, color: "#1a3c5e", fontSize: 13 }}>
          ${((parseFloat(cantidad) || 0) * valor).toFixed(2)}
        </div>
      </div>
    </div>
  );

  // Si el cierre ya fue confirmado hoy, mostrar solo el resultado
  if (cierreGuardado) {
    const d = cierreGuardado;
    return (
      <div style={S.panel}>
        <h2 style={S.panelTitle}>💰 Caja</h2>
        <div style={{ background: "#e8f5fd", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13 }}>
          🔓 Apertura: <strong>{apertura?.empleadaNombre}</strong> · Fondo: <strong>${apertura?.fondo?.toFixed(2)}</strong>
        </div>
        <div style={{ ...S.kpi, borderLeft: `4px solid ${d.difTotal === 0 ? "#4caf50" : d.difTotal > 0 ? "#1565c0" : "#e53935"}`, marginBottom: 14 }}>
          <div style={{ fontSize: 32 }}>{d.difTotal === 0 ? "✅" : d.difTotal > 0 ? "📈" : "⚠️"}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: d.difTotal === 0 ? "#2e7d32" : d.difTotal > 0 ? "#1565c0" : "#e53935" }}>
              {d.difTotal === 0 ? "¡Caja cuadrada!" : d.difTotal > 0 ? `Sobran $${d.difTotal.toFixed(2)}` : `Faltan $${Math.abs(d.difTotal).toFixed(2)}`}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>Cierre realizado · {new Date(d.fecha).toLocaleString("es-MX")}</div>
            <div style={{ fontSize: 11, color: "#e65100" }}>El cierre del día ya fue confirmado</div>
          </div>
        </div>
        <Card title="📊 Resumen del cierre">
          <div style={{ fontSize: 13, marginBottom: 8 }}>💵 Efectivo contado: <strong>${d.totalEfectivo.toFixed(2)}</strong> — Fondo: <strong>${d.fondo.toFixed(2)}</strong> = Neto: <strong>${d.efNeto.toFixed(2)}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>🏦 Pichincha: <strong>${d.transferPichincha.toFixed(2)}</strong> · JEP: <strong>${d.transferJEP.toFixed(2)}</strong></div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>💳 Tarjeta: <strong>${d.totalTarjeta.toFixed(2)}</strong></div>
          {[{l:"💵 Efectivo",dif:d.difEf},{l:"🏦 Transferencias",dif:d.difTr},{l:"💳 Tarjeta",dif:d.difTa}].map(r=>(
            <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #f0f4f8"}}>
              <span style={{fontSize:13}}>{r.l}</span><DifBadge dif={r.dif}/>
            </div>
          ))}
        </Card>
        <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg,#2e7d32,#388e3c)" }} onClick={() => imprimirCierre(d)}>
          🖨️ Reimprimir ticket de cierre
        </button>
      </div>
    );
  }

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>💰 Caja</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={{ ...S.pill, ...(modo === "apertura" ? S.pillActive : {}) }} onClick={() => setModo("apertura")}>🔓 Apertura</button>
        <button style={{ ...S.pill, ...(modo === "cierre" ? S.pillActive : {}) }} onClick={() => setModo("cierre")}>🔒 Cierre</button>
      </div>

      {/* APERTURA */}
      {modo === "apertura" && (
        <div>
          {apertura && <div style={{ ...S.alerta, background: "#e8f5e9", color: "#2e7d32" }}>✅ Caja ya abierta hoy por <strong>{apertura.empleadaNombre}</strong> con fondo de <strong>${apertura.fondo.toFixed(2)}</strong></div>}
          <Card title="🔓 Apertura de caja">
            <label style={S.label}>Empleada que abre caja</label>
            <select style={{ ...S.input, marginBottom: 10 }} value={aperturaEmpleada} onChange={e => setAperturaEmpleada(e.target.value)}>
              {empleadas.filter(e => e.activa).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <label style={S.label}>💵 Fondo inicial en caja</label>
            <input type="number" style={{ ...S.input, marginBottom: 14, fontSize: 18, fontWeight: 700 }} value={fondoInicial} onChange={e => setFondoInicial(e.target.value)} />
            <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#888" }}>Fondo que queda en caja</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1a3c5e" }}>${parseFloat(fondoInicial || 0).toFixed(2)}</div>
            </div>
            <button style={S.btnPrimary} onClick={registrarApertura}>🔓 Registrar apertura e imprimir ticket</button>
          </Card>
        </div>
      )}

      {/* CIERRE */}
      {modo === "cierre" && (
        <div>
          {apertura && <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>🔓 Abierta por <strong>{apertura.empleadaNombre}</strong> · Fondo: <strong>${apertura.fondo.toFixed(2)}</strong></div>}

          {/* RESUMEN ESPERADO */}
          <Card title="📋 Lo esperado del día">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ ...S.kpi, borderLeft: "4px solid #1a3c5e", padding: 10 }}>
                <div style={{ fontSize: 18 }}>🧾</div>
                <div><div style={{ fontWeight: 800, fontSize: 16, color: "#1a3c5e" }}>{ventasEmp.length}</div><div style={{ fontSize: 11, color: "#888" }}>Ventas hoy</div></div>
              </div>
              <div style={{ ...S.kpi, borderLeft: "4px solid #4caf50", padding: 10 }}>
                <div style={{ fontSize: 18 }}>💰</div>
                <div><div style={{ fontWeight: 800, fontSize: 16, color: "#4caf50" }}>${(esperadoTotal + fondo).toFixed(2)}</div><div style={{ fontSize: 11, color: "#888" }}>Esperado en caja</div></div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>💵 Efectivo: <strong>${esperadoEfectivo.toFixed(2)}</strong> + fondo <strong>${fondo.toFixed(2)}</strong> = <strong>${(esperadoEfectivo + fondo).toFixed(2)}</strong></div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>🏦 Transferencias: <strong>${esperadoTransferencia.toFixed(2)}</strong></div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>💳 Tarjeta: <strong>${esperadoTarjeta.toFixed(2)}</strong></div>
          </Card>

          {/* PASOS */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
            {[{n:1,l:"💵 Billetes"},{n:2,l:"🪙 Monedas"},{n:3,l:"🏦 Digital"},{n:4,l:"✅ Confirmar"}].map(p => (
              <div key={p.n} style={{ ...S.badge, background: paso >= p.n ? "#1a3c5e" : "#e8f0f7", color: paso >= p.n ? "#fff" : "#888", padding: "6px 10px", fontSize: 11, whiteSpace: "nowrap", cursor: paso > p.n ? "pointer" : "default" }}
                onClick={() => { if (!confirmado && paso > p.n) setPaso(p.n); }}>
                {p.n}. {p.l}
              </div>
            ))}
          </div>

          {/* PASO 1: BILLETES */}
          {paso === 1 && (
            <Card title="💵 Paso 1 — Cuenta los billetes">
              {BILLETES.map(b => (
                <ContadorDenominacion key={b} valor={b} cantidad={billetes[b]} tipo="billete"
                  onChange={val => setBilletes(prev => ({ ...prev, [b]: val }))} />
              ))}
              <div style={{ background: "#fff8e1", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Total billetes:</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#f59e0b" }}>${totalBilletes.toFixed(2)}</span>
              </div>
              <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={() => setPaso(2)}>Siguiente: Monedas →</button>
            </Card>
          )}

          {/* PASO 2: MONEDAS */}
          {paso === 2 && (
            <Card title="🪙 Paso 2 — Cuenta las monedas">
              {MONEDAS.map(m => (
                <ContadorDenominacion key={m} valor={m} cantidad={monedas[m]} tipo="moneda"
                  onChange={val => setMonedas(prev => ({ ...prev, [m]: val }))} />
              ))}
              <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Total monedas:</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#2e7d32" }}>${totalMonedas.toFixed(2)}</span>
              </div>
              <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>💵 Total efectivo:</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#1a3c5e" }}>${totalEfectivo.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={{ ...S.btnClose, flex: 1 }} onClick={() => setPaso(1)}>← Billetes</button>
                <button style={{ ...S.btnPrimary, flex: 2 }} onClick={() => setPaso(3)}>Siguiente: Digital →</button>
              </div>
            </Card>
          )}

          {/* PASO 3: TRANSFERENCIAS Y TARJETA */}
          {paso === 3 && (
            <Card title="🏦 Paso 3 — Pagos digitales">
              <label style={S.label}>🏦 Transferencias Banco Pichincha</label>
              <input type="number" style={{ ...S.input, marginBottom: 12 }} placeholder="$0.00" value={transferPichincha} onChange={e => setTransferPichincha(e.target.value)} />
              <label style={S.label}>🏦 Transferencias JEP</label>
              <input type="number" style={{ ...S.input, marginBottom: 12 }} placeholder="$0.00" value={transferJEP} onChange={e => setTransferJEP(e.target.value)} />
              <label style={S.label}>💳 Pagos con tarjeta</label>
              <input type="number" style={{ ...S.input, marginBottom: 12 }} placeholder="$0.00" value={tarjeta} onChange={e => setTarjeta(e.target.value)} />
              <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>🏦 Total transferencias:</span><strong>${totalTransfer.toFixed(2)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}><span>💳 Tarjeta:</span><strong>${totalTarjeta.toFixed(2)}</strong></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btnClose, flex: 1 }} onClick={() => setPaso(2)}>← Monedas</button>
                <button style={{ ...S.btnPrimary, flex: 2 }} onClick={() => setPaso(4)}>Ver resultado →</button>
              </div>
            </Card>
          )}

          {/* PASO 4: RESULTADO Y CONFIRMACIÓN */}
          {paso === 4 && !confirmado && (
            <div>
              <Card title="✅ Paso 4 — Resumen del cierre">
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3c5e", marginBottom: 6 }}>💵 Efectivo</div>
                  {BILLETES.filter(b => (parseFloat(billetes[b]) || 0) > 0).map(b => (
                    <div key={b} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                      <span>${b} × {billetes[b]}</span><span>${(b * billetes[b]).toFixed(2)}</span>
                    </div>
                  ))}
                  {MONEDAS.filter(m => (parseFloat(monedas[m]) || 0) > 0).map(m => (
                    <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                      <span>${m} × {monedas[m]}</span><span>${(m * monedas[m]).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, borderTop: "1px solid #e8f0f7", marginTop: 4, paddingTop: 4 }}>
                    <span>Total efectivo contado</span><span>${totalEfectivo.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e65100" }}>
                    <span>— Fondo que queda en caja</span><span>-${fondo.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, color: "#1a3c5e" }}>
                    <span>Efectivo neto</span><span>${efNeto.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ borderTop: "1px dashed #d0dce8", paddingTop: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>🏦 Pichincha</span><strong>${(parseFloat(transferPichincha)||0).toFixed(2)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>🏦 JEP</span><strong>${(parseFloat(transferJEP)||0).toFixed(2)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>💳 Tarjeta</span><strong>${totalTarjeta.toFixed(2)}</strong></div>
                </div>
                <div style={{ borderTop: "2px solid #1a3c5e", paddingTop: 8 }}>
                  {[{l:"💵 Efectivo (neto)",c:efNeto,e:esperadoEfectivo,d:difEf},{l:"🏦 Transferencias",c:totalTransfer,e:esperadoTransferencia,d:difTr},{l:"💳 Tarjeta",c:totalTarjeta,e:esperadoTarjeta,d:difTa}].map(r => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0f4f8" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.l}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Contado ${r.c.toFixed(2)} / Esperado ${r.e.toFixed(2)}</div>
                      </div>
                      <DifBadge dif={r.d}/>
                    </div>
                  ))}
                </div>
                <div style={{ background: difTotal === 0 ? "#e8f5e9" : difTotal > 0 ? "#e3f2fd" : "#ffebee", borderRadius: 10, padding: "14px", marginTop: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: difTotal === 0 ? "#2e7d32" : difTotal > 0 ? "#1565c0" : "#c62828" }}>
                    {difTotal === 0 ? "✅ ¡CAJA CUADRADA!" : difTotal > 0 ? `📈 SOBRA $${difTotal.toFixed(2)}` : `⚠️ FALTA $${Math.abs(difTotal).toFixed(2)}`}
                  </div>
                </div>
              </Card>
              <div style={{ background: "#fff3e0", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#e65100" }}>
                ⚠️ Una vez confirmado el cierre <strong>no podrás modificarlo</strong>. Revisa bien antes de confirmar.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btnClose, flex: 1 }} onClick={() => setPaso(3)}>← Corregir</button>
                <button style={{ ...S.btnPrimary, flex: 2, background: "linear-gradient(135deg,#2e7d32,#388e3c)" }} onClick={confirmarCierre}>
                  ✅ Confirmar e imprimir cierre
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function PendienteItem({ v, empleadas, setTicket, addAbono, setVentas }) {
  const [showAbono, setShowAbono] = useState(false);
  const emp = empleadas.find(e => e.id === v.empleadaId);
  const pendiente = saldoPendiente(v);
  const pagada = estaPagada(v);
  const abonos = v.abonos || [];
  const totalAbonado = abonos.reduce((a, ab) => a + ab.monto, 0);

  const toggleField = (field) => setVentas && setVentas(prev =>
    prev.map(vv => vv.folio === v.folio ? { ...vv, [field]: !vv[field] } : vv)
  );

  return (
    <div>
      <div style={{ ...S.ventaCard, borderLeft: `4px solid ${pagada ? "#ff9800" : "#e53935"}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {!pagada && <div style={{ ...S.badge, background: "#ffebee", color: "#c62828" }}>💸 Pendiente cobro</div>}
          {pagada && !v.checkMsgEntrega && <div style={{ ...S.badge, background: "#fff3e0", color: "#e65100" }}>📦 Pendiente retiro</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#1a3c5e", fontSize: 15 }}>{v.clienteNombre}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{v.folio} · {fmt(v.fecha)}</div>
            {emp && <div style={{ fontSize: 11, color: "#4db6e4" }}>👩 Registró: {emp.nombre}</div>}
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              {v.items.map((it, i) => <span key={i}>{it.label}{it.piezas > 1 ? ` ×${it.piezas}` : ""}{i < v.items.length - 1 ? " · " : ""}</span>)}
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>📅 Entrega: {fmtDate(v.entrega)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1a3c5e" }}>${v.total.toFixed(2)}</div>
            {!pagada && <div style={{ fontSize: 13, color: "#e53935", fontWeight: 700 }}>Debe: ${pendiente.toFixed(2)}</div>}
            {totalAbonado > 0 && <div style={{ fontSize: 11, color: "#2e7d32" }}>Abonado: ${totalAbonado.toFixed(2)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgRetiro||false} onChange={() => toggleField("checkMsgRetiro")}/>
            <span>📲 Msg retiro enviado</span>
          </label>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={v.checkMsgEntrega||false} onChange={() => toggleField("checkMsgEntrega")}/>
            <span>✅ Entregado al cliente</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={S.btnTicket} onClick={() => setTicket(v)}>🧾 Ticket</button>
          {!pagada && (
            <button style={{ ...S.btnTicket, background: "#e8f5e9", color: "#2e7d32", fontWeight: 700 }}
              onClick={() => setShowAbono(true)}>
              💰 Cobrar
            </button>
          )}
        </div>
      </div>
      {showAbono && (
        <AbonoModal venta={v}
          onSave={(abono) => { addAbono(v.folio, abono); setShowAbono(false); }}
          onClose={() => setShowAbono(false)}/>
      )}
    </div>
  );
}

// ─── REPORTES CON EXPORTACIÓN EXCEL ───────────────────────────────
function Reportes({ ventas, empleadas }) {
  const hoy=new Date().toISOString().split("T")[0];
  const semana=semanaISO(new Date());
  const mes=mesKey(new Date());
  const [mesSelec,setMesSelec]=useState(mes);
  const [empSelec,setEmpSelec]=useState("Todos");

  const ventasHoy=ventas.filter(v=>v.fecha.startsWith(hoy));
  const ventasSem=ventas.filter(v=>semanaISO(v.fecha)===semana);
  const ventasMes=ventas.filter(v=>mesKey(v.fecha)===mesSelec);
  const ventasMesEmp=empSelec==="Todos"?ventasMes:ventasMes.filter(v=>String(v.empleadaId)===empSelec);

  const sum=arr=>arr.reduce((a,v)=>a+v.total,0);
  const cobrado=arr=>arr.reduce((a,v)=>a+(v.abonos||[]).reduce((x,ab)=>x+ab.monto,0),0);
  const porCobrar=arr=>arr.reduce((a,v)=>a+saldoPendiente(v),0);

  const byPago=PAGOS.map(p=>({label:p,val:ventasMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo===p)).reduce((a,ab)=>a+ab.monto,0)}));
  const totalCobradoMes=byPago.reduce((a,p)=>a+p.val,0);

  const ventasPorMes=(()=>{const map={};ventas.forEach(v=>{const k=mesKey(v.fecha);map[k]=(map[k]||0)+v.total;});return Object.entries(map).sort().slice(-6).map(([k,v])=>({label:k.slice(5)+"/"+k.slice(0,4),val:v}));})();

  const empStats=empleadas.map(e=>{
    const mv=ventas.filter(v=>v.empleadaId===e.id&&mesKey(v.fecha)===mesSelec);
    return {...e,count:mv.length,total:mv.reduce((a,v)=>a+v.total,0)};
  }).sort((a,b)=>b.count-a.count);

  const BtnExport=({label,arr,titulo})=>(
    <button style={{...S.btnSmall,background:"#e8f5e9",color:"#2e7d32",display:"flex",alignItems:"center",gap:4}}
      onClick={()=>exportarCSV(arr,titulo,empleadas)}>
      📥 {label}
    </button>
  );

  const KPI=({icon,label,val,sub,color})=>(
    <div style={{...S.kpi,borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div><div style={{fontWeight:800,fontSize:18,color}}>{val}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"#888"}}>{sub}</div>}</div>
    </div>
  );

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>📊 Reportes</h2>

      {/* EXPORTAR */}
      <Card title="📥 Exportar a Excel">
        <p style={{fontSize:13,color:"#555",marginBottom:12}}>Descarga reportes en formato CSV que se abren directamente en Excel.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <BtnExport label="Reporte hoy" arr={ventasHoy} titulo="reporte-hoy"/>
          <BtnExport label="Reporte semanal" arr={ventasSem} titulo="reporte-semana"/>
          <BtnExport label="Reporte mensual" arr={ventasMes} titulo={`reporte-${mesSelec}`}/>
          <BtnExport label="Todas las ventas" arr={ventas} titulo="reporte-completo"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
          <div>
            <label style={S.label}>Mes para reporte</label>
            <input type="month" style={S.input} value={mesSelec} onChange={e=>setMesSelec(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Filtrar por empleada</label>
            <select style={S.input} value={empSelec} onChange={e=>setEmpSelec(e.target.value)}>
              <option value="Todos">Todas</option>
              {empleadas.map(e=><option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        {empSelec!=="Todos"&&(
          <button style={{...S.btnSmall,marginTop:8,background:"#e8f5e9",color:"#2e7d32"}}
            onClick={()=>exportarCSV(ventasMesEmp,`reporte-${empleadas.find(e=>String(e.id)===empSelec)?.nombre}-${mesSelec}`,empleadas)}>
            📥 Exportar reporte por empleada
          </button>
        )}
      </Card>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <KPI icon="☀️" label="Ventas hoy" val={`$${sum(ventasHoy).toFixed(2)}`} sub={`${ventasHoy.length} órdenes`} color="#f59e0b"/>
        <KPI icon="📅" label="Esta semana" val={`$${sum(ventasSem).toFixed(2)}`} sub={`${ventasSem.length} órdenes`} color="#4db6e4"/>
        <KPI icon="💚" label="Cobrado este mes" val={`$${cobrado(ventasMes).toFixed(2)}`} sub="Pagos recibidos" color="#4caf50"/>
        <KPI icon="⏳" label="Por cobrar" val={`$${porCobrar(ventasMes).toFixed(2)}`} sub="Saldo pendiente" color="#e53935"/>
      </div>

      <Card title="💳 Cobros del mes por método">
        {byPago.map(p=>(
          <div key={p.label} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>{p.label}</span><strong>${p.val.toFixed(2)}</strong></div>
            <div style={{background:"#e8f0f7",borderRadius:4,height:8}}>
              <div style={{background:p.label==="Efectivo"?"#4caf50":esTranferencia(p.label)?"#4db6e4":"#ff9800",width:`${totalCobradoMes?(p.val/totalCobradoMes)*100:0}%`,height:"100%",borderRadius:4}}/>
            </div>
          </div>
        ))}
      </Card>

      <Card title="📈 Ventas por mes (últimos 6)">
        {ventasPorMes.length===0?<div style={S.empty}>Sin datos</div>:ventasPorMes.map(m=>{
          const max=Math.max(...ventasPorMes.map(x=>x.val),1);
          return(
            <div key={m.label} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}><span>{m.label}</span><strong>${m.val.toFixed(2)}</strong></div>
              <div style={{background:"#e8f0f7",borderRadius:4,height:10}}><div style={{background:"#1a3c5e",width:`${(m.val/max)*100}%`,height:"100%",borderRadius:4}}/></div>
            </div>
          );
        })}
      </Card>

      <Card title="🏆 Ranking empleadas">
        {empStats.map((e,i)=>{
          const meta=e.metaVentas||20;
          const pct=Math.min(100,(e.count/meta)*100);
          const ganoBono=e.count>=meta;
          return(
            <div key={e.id} style={{padding:"10px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"👤"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{e.nombre}</div>
                  <div style={{fontSize:12,color:"#888"}}>{e.count} ventas · ${e.total.toFixed(2)} · Meta: {meta}</div>
                </div>
                {ganoBono&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 ${e.montoBonus||0}</div>}
              </div>
              <div style={{marginTop:6}}>
                <div style={{background:"#e8f0f7",borderRadius:6,height:6}}><div style={{background:ganoBono?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── INVENTARIO ────────────────────────────────────────────────────
function Inventario({ inventario, setInventario }) {
  const [nuevo,setNuevo]=useState({nombre:"",stock:0,min:1,unidad:"pzas"});
  const update=(id,field,val)=>setInventario(prev=>prev.map(i=>i.id===id?{...i,[field]:val}:i));
  const eliminar=(id)=>setInventario(prev=>prev.filter(i=>i.id!==id));
  const agregar=()=>{if(!nuevo.nombre.trim()) return;setInventario(prev=>[...prev,{...nuevo,id:Date.now(),stock:parseFloat(nuevo.stock)||0}]);setNuevo({nombre:"",stock:0,min:1,unidad:"pzas"});};
  const bajoStock=inventario.filter(i=>i.stock<=i.min);
  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Inventario de Insumos</h2>
      {bajoStock.length>0&&<div style={S.alerta}>⚠️ Stock bajo: {bajoStock.map(i=>i.nombre).join(", ")}</div>}
      <Card title="📋 Insumos">
        {inventario.map(item=>(
          <div key={item.id} style={S.ventaCard}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:600}}>{item.nombre}</div><div style={{fontSize:12,color:"#888"}}>Mínimo: {item.min} {item.unidad}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{...S.badge,background:item.stock<=item.min?"#ffebee":"#e8f5e9",color:item.stock<=item.min?"#c62828":"#2e7d32",fontSize:14,fontWeight:700}}>{item.stock} {item.unidad}</div>
                <button style={S.btnRemove} onClick={()=>eliminar(item.id)}>✕</button>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
              <button style={S.btnSmall} onClick={()=>update(item.id,"stock",Math.max(0,item.stock-1))}>−</button>
              <input type="number" style={{...S.input,width:70,textAlign:"center",padding:"4px 6px"}} value={item.stock} onChange={e=>update(item.id,"stock",parseFloat(e.target.value)||0)}/>
              <button style={S.btnSmall} onClick={()=>update(item.id,"stock",item.stock+1)}>+</button>
            </div>
          </div>
        ))}
      </Card>
      <Card title="➕ Agregar insumo">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={{...S.input,gridColumn:"1/-1"}} placeholder="Nombre" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/>
          <input type="number" style={S.input} placeholder="Stock inicial" value={nuevo.stock} onChange={e=>setNuevo({...nuevo,stock:e.target.value})}/>
          <input type="number" style={S.input} placeholder="Stock mínimo" value={nuevo.min} onChange={e=>setNuevo({...nuevo,min:e.target.value})}/>
          <input style={S.input} placeholder="Unidad (kg,L,pzas)" value={nuevo.unidad} onChange={e=>setNuevo({...nuevo,unidad:e.target.value})}/>
        </div>
        <button style={{...S.btnPrimary,marginTop:10}} onClick={agregar}>Agregar</button>
      </Card>
    </div>
  );
}

// ─── EQUIPO ────────────────────────────────────────────────────────
function Equipo({ empleadas, setEmpleadas, ventas, esAdmin }) {
  const [nuevo,setNuevo]=useState({nombre:"",metaVentas:20,montoBonus:20});
  const [editId,setEditId]=useState(null);
  const [editData,setEditData]=useState({nombre:"",metaVentas:20,montoBonus:20});
  const mes=mesKey(new Date());

  const agregar=()=>{
    if(!nuevo.nombre.trim()) return;
    setEmpleadas(prev=>[...prev,{id:Date.now(),nombre:nuevo.nombre,activa:true,metaVentas:parseInt(nuevo.metaVentas)||20,montoBonus:parseFloat(nuevo.montoBonus)||0}]);
    setNuevo({nombre:"",metaVentas:20,montoBonus:20});
  };
  const toggle=(id)=>setEmpleadas(prev=>prev.map(e=>e.id===id?{...e,activa:!e.activa}:e));
  const iniciarEdicion=(e)=>{setEditId(e.id);setEditData({nombre:e.nombre,metaVentas:e.metaVentas||20,montoBonus:e.montoBonus||0});};
  const guardarEdicion=()=>{
    setEmpleadas(prev=>prev.map(e=>e.id===editId?{...e,...editData,metaVentas:parseInt(editData.metaVentas)||20,montoBonus:parseFloat(editData.montoBonus)||0}:e));
    setEditId(null);
  };
  const empStats=empleadas.map(e=>{
    const mv=ventas.filter(v=>v.empleadaId===e.id&&mesKey(v.fecha)===mes);
    return {...e,ventasMes:mv.length,totalMes:mv.reduce((a,v)=>a+v.total,0)};
  });

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>Equipo & Bonos</h2>
      <Card title="👩 Empleadas">
        {empStats.map(e=>{
          const meta=e.metaVentas||20;
          const bono=e.montoBonus||0;
          const pct=Math.min(100,(e.ventasMes/meta)*100);
          const ganoBono=e.ventasMes>=meta;
          return(
            <div key={e.id} style={{...S.ventaCard,opacity:e.activa?1:0.6}}>
              {editId===e.id?(
                <div>
                  <div style={{fontWeight:700,color:"#1a3c5e",marginBottom:8}}>✏️ Editando</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:8}}>
                    <div><label style={S.label}>Nombre</label><input style={S.input} value={editData.nombre} onChange={ev=>setEditData({...editData,nombre:ev.target.value})}/></div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={S.label}>Meta ventas/mes</label><input type="number" style={S.input} value={editData.metaVentas} onChange={ev=>setEditData({...editData,metaVentas:ev.target.value})}/></div>
                      <div><label style={S.label}>Monto bono ($)</label><input type="number" style={S.input} value={editData.montoBonus} onChange={ev=>setEditData({...editData,montoBonus:ev.target.value})}/></div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...S.btnPrimary,flex:1}} onClick={guardarEdicion}>✓ Guardar</button>
                    <button style={S.btnClose} onClick={()=>setEditId(null)}>Cancelar</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{e.nombre}</div>
                      <div style={{fontSize:12,color:"#888"}}>{e.ventasMes} ventas este mes</div>
                      {esAdmin && <div style={{fontSize:11,color:"#4db6e4"}}>Meta: {meta} ventas · Bono: ${bono}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      {ganoBono&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 {esAdmin?`$${bono}`:"¡Bono!"}</div>}
                      {esAdmin && <button style={S.btnSmall} onClick={()=>iniciarEdicion(e)}>✏️</button>}
                      {esAdmin && <button style={{...S.btnSmall,background:e.activa?"#ffebee":"#e8f5e9",color:e.activa?"#c62828":"#2e7d32"}} onClick={()=>toggle(e.id)}>{e.activa?"Desactivar":"Activar"}</button>}
                    </div>
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:3}}><span>Progreso bono</span><span>{e.ventasMes}/{meta}</span></div>
                    <div style={{background:"#e8f0f7",borderRadius:6,height:8}}><div style={{background:ganoBono?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </Card>
      {esAdmin && <Card title="➕ Agregar empleada">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={{...S.input,gridColumn:"1/-1"}} placeholder="Nombre completo" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/>
          <div><label style={S.label}>Meta ventas/mes</label><input type="number" style={S.input} value={nuevo.metaVentas} onChange={e=>setNuevo({...nuevo,metaVentas:e.target.value})}/></div>
          <div><label style={S.label}>Monto bono ($)</label><input type="number" style={S.input} value={nuevo.montoBonus} onChange={e=>setNuevo({...nuevo,montoBonus:e.target.value})}/></div>
        </div>
        <button style={{...S.btnPrimary,marginTop:10}} onClick={agregar}>Agregar empleada</button>
      </Card>}
    </div>
  );
}

// ─── CONFIGURACION ─────────────────────────────────────────────────
function Configuracion({ servicios, setServicios, exportarDatos, importarDatos }) {
  const [nuevo,setNuevo]=useState({label:"",precio:""});
  const [editId,setEditId]=useState(null);
  const [editData,setEditData]=useState({label:"",precio:""});
  const [busq,setBusq]=useState("");

  const agregar=()=>{
    if(!nuevo.label.trim()||!nuevo.precio) return;
    setServicios(prev=>[...prev,{id:"custom-"+Date.now(),label:nuevo.label.toUpperCase(),precio:parseFloat(nuevo.precio)}]);
    setNuevo({label:"",precio:""});
  };
  const eliminar=(id)=>setServicios(prev=>prev.filter(s=>s.id!==id));
  const iniciarEdicion=(s)=>{setEditId(s.id);setEditData({label:s.label,precio:s.precio});};
  const guardarEdicion=()=>{
    setServicios(prev=>prev.map(s=>s.id===editId?{...s,label:editData.label.toUpperCase(),precio:parseFloat(editData.precio)}:s));
    setEditId(null);
  };
  const filtrados=servicios.filter(s=>s.label.toLowerCase().includes(busq.toLowerCase()));

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>⚙️ Configuración</h2>
      <Card title="💾 Respaldo de datos">
        <p style={{fontSize:13,color:"#555",marginBottom:12}}>Exporta todos tus datos para guardar o restaurar en otro dispositivo.</p>
        <button style={{...S.btnPrimary,marginBottom:10}} onClick={exportarDatos}>📥 Exportar datos (Respaldo)</button>
        <label style={{...S.btnPrimary,display:"block",textAlign:"center",cursor:"pointer",background:"#e8f5fd",color:"#1a3c5e",padding:"13px",borderRadius:10,fontSize:15,fontWeight:700}}>
          📤 Importar datos (Restaurar)
          <input type="file" accept=".json" style={{display:"none"}} onChange={importarDatos}/>
        </label>
        <p style={{fontSize:11,color:"#aaa",marginTop:8}}>⚠️ Importar reemplazará todos los datos actuales.</p>
      </Card>
      <Card title="➕ Agregar nuevo servicio">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
          <input style={S.input} placeholder="Nombre del servicio" value={nuevo.label} onChange={e=>setNuevo({...nuevo,label:e.target.value})}/>
          <input type="number" style={{...S.input,width:90}} placeholder="$Precio" value={nuevo.precio} onChange={e=>setNuevo({...nuevo,precio:e.target.value})}/>
        </div>
        <button style={{...S.btnPrimary,marginTop:8}} onClick={agregar}>Agregar servicio</button>
      </Card>
      <Card title={`📋 Servicios (${servicios.length})`}>
        <input style={{...S.input,marginBottom:10}} placeholder="Buscar servicio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
        {filtrados.map(s=>(
          <div key={s.id} style={{...S.ventaCard,padding:"8px 12px"}}>
            {editId===s.id?(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
                <input style={S.input} value={editData.label} onChange={e=>setEditData({...editData,label:e.target.value})}/>
                <input type="number" style={{...S.input,width:80}} value={editData.precio} onChange={e=>setEditData({...editData,precio:e.target.value})}/>
                <button style={{...S.btnSmall,background:"#e8f5e9",color:"#2e7d32"}} onClick={guardarEdicion}>✓</button>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{s.label}</div>
                  <div style={{fontSize:12,color:"#4db6e4",fontWeight:700}}>${s.precio.toFixed(2)}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={S.btnSmall} onClick={()=>iniciarEdicion(s)}>✏️</button>
                  <button style={S.btnRemove} onClick={()=>eliminar(s.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── CIERRE DE CAJA ────────────────────────────────────────────────
function CierreCaja({ ventas, empleadas }) {
  const hoy = new Date().toISOString().split("T")[0];
  const APERTURA_KEY = "ll_apertura_" + hoy;

  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem(APERTURA_KEY) ? "cierre" : "apertura"; } catch { return "apertura"; }
  });
  const [apertura, setApertura] = useState(() => {
    try { const a = localStorage.getItem(APERTURA_KEY); return a ? JSON.parse(a) : null; } catch { return null; }
  });

  // APERTURA STATE
  const [aperturaEmpleada, setAperturaEmpleada] = useState(empleadas[0]?.id || null);
  const [fondoInicial, setFondoInicial] = useState("15.00");

  // CIERRE STATE
  const [empleadaId, setEmpleadaId] = useState(empleadas[0]?.id || null);
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [montoTarjeta, setMontoTarjeta] = useState("");
  const [resultado, setResultado] = useState(null);

  const registrarApertura = () => {
    const datos = {
      empleadaId: aperturaEmpleada,
      empleadaNombre: empleadas.find(e => String(e.id) === String(aperturaEmpleada))?.nombre || "",
      fondo: parseFloat(fondoInicial) || 15,
      fecha: new Date().toISOString(),
    };
    try { localStorage.setItem(APERTURA_KEY, JSON.stringify(datos)); } catch {}
    setApertura(datos);
    setModo("cierre");

    // Imprimir ticket de apertura
    const w = window.open("", "_blank", "width=380,height=400");
    w.document.write(`
      <html><head><title>Apertura de Caja</title>
      <style>body{font-family:sans-serif;padding:20px;max-width:320px;margin:0 auto;text-align:center}
      h2{color:#1a3c5e}.divider{border-top:1px dashed #ccc;margin:12px 0}
      .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px;text-align:left}
      .big{font-size:22px;font-weight:800;color:#1a3c5e}</style></head>
      <body>
      <div style="font-size:36px">🫧</div>
      <h2>Lava&Listo</h2>
      <p><strong>APERTURA DE CAJA</strong></p>
      <div class="divider"></div>
      <div class="row"><span>Fecha</span><span>${new Date(datos.fecha).toLocaleString("es-MX")}</span></div>
      <div class="row"><span>Abrió</span><span>${datos.empleadaNombre}</span></div>
      <div class="divider"></div>
      <p>Fondo inicial en caja:</p>
      <div class="big">$${datos.fondo.toFixed(2)}</div>
      <div class="divider"></div>
      <p style="font-size:11px;color:#aaa">Lava&Listo · Sistema de ventas</p>
      <script>window.print();window.close();</script>
      </body></html>
    `);
    w.document.close();
  };

  const ventasHoy = ventas.filter(v => v.fecha.startsWith(hoy) && !v.anulada);
  const ventasEmp = empleadaId === "todos"
    ? ventasHoy
    : ventasHoy.filter(v => String(v.empleadaId) === String(empleadaId));

  const esperadoEfectivo = ventasEmp.flatMap(v => (v.abonos || []).filter(a => a.metodo === "Efectivo")).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTransferencia = ventasEmp.flatMap(v => (v.abonos || []).filter(a => esTranferencia(a.metodo))).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTarjeta = ventasEmp.flatMap(v => (v.abonos || []).filter(a => a.metodo === "Tarjeta")).reduce((a, ab) => a + ab.monto, 0);
  const esperadoTotal = esperadoEfectivo + esperadoTransferencia + esperadoTarjeta;

  const calcularCierre = () => {
    const ef = parseFloat(montoEfectivo) || 0;
    const tr = parseFloat(montoTransferencia) || 0;
    const ta = parseFloat(montoTarjeta) || 0;
    const fondo = apertura?.fondo || 15;
    const contadoTotal = ef + tr + ta;
    // Efectivo neto = lo contado menos el fondo que siempre queda
    const efNeto = ef - fondo;
    const esperadoEfConFondo = esperadoEfectivo + fondo;
    const ventasReales = efNeto + tr + ta;
    setResultado({
      ef, tr, ta, contadoTotal, fondo, efNeto,
      ventasReales,
      difEf: efNeto - esperadoEfectivo,
      difTr: tr - esperadoTransferencia,
      difTa: ta - esperadoTarjeta,
      difTotal: ventasReales - esperadoTotal,
      esperadoEfConFondo,
      fecha: new Date().toISOString(),
      empleada: empleadas.find(e => String(e.id) === String(empleadaId))?.nombre || "Todas",
      totalVentas: ventasEmp.length,
      totalVentasVal: ventasEmp.reduce((a, v) => a + v.total, 0),
    });
  };

  const DifBadge = ({ dif }) => (
    <span style={{ fontWeight: 700, color: dif === 0 ? "#2e7d32" : dif > 0 ? "#1565c0" : "#c62828" }}>
      {dif === 0 ? "✅ Cuadra" : dif > 0 ? `📈 Sobra $${dif.toFixed(2)}` : `⚠️ Falta $${Math.abs(dif).toFixed(2)}`}
    </span>
  );

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>💰 Caja</h2>

      {/* TABS APERTURA / CIERRE */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={{ ...S.pill, ...(modo === "apertura" ? S.pillActive : {}) }} onClick={() => setModo("apertura")}>🔓 Apertura</button>
        <button style={{ ...S.pill, ...(modo === "cierre" ? S.pillActive : {}) }} onClick={() => setModo("cierre")}>🔒 Cierre</button>
      </div>

      {/* APERTURA */}
      {modo === "apertura" && (
        <div>
          {apertura && (
            <div style={{ ...S.alerta, background: "#e8f5e9", color: "#2e7d32" }}>
              ✅ Caja ya abierta hoy por <strong>{apertura.empleadaNombre}</strong> con fondo de <strong>${apertura.fondo.toFixed(2)}</strong>
            </div>
          )}
          <Card title="🔓 Apertura de caja">
            <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Registra la apertura del día con el fondo inicial en caja.</p>
            <label style={S.label}>Empleada que abre caja</label>
            <select style={{ ...S.input, marginBottom: 10 }} value={aperturaEmpleada} onChange={e => setAperturaEmpleada(e.target.value)}>
              {empleadas.filter(e => e.activa).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <label style={S.label}>💵 Fondo inicial en caja</label>
            <input type="number" style={{ ...S.input, marginBottom: 14, fontSize: 18, fontWeight: 700 }}
              value={fondoInicial} onChange={e => setFondoInicial(e.target.value)} />
            <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#888" }}>Fondo que queda en caja</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1a3c5e" }}>${parseFloat(fondoInicial || 0).toFixed(2)}</div>
            </div>
            <button style={S.btnPrimary} onClick={registrarApertura}>🔓 Registrar apertura e imprimir ticket</button>
          </Card>
        </div>
      )}

      {/* CIERRE */}
      {modo === "cierre" && (
        <div>
          {apertura && (
            <div style={{ background: "#e8f5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
              🔓 Abierta por <strong>{apertura.empleadaNombre}</strong> · Fondo: <strong>${apertura.fondo.toFixed(2)}</strong>
            </div>
          )}

      <Card title="📋 Resumen del día">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ ...S.kpi, borderLeft: "4px solid #1a3c5e" }}>
            <div style={{ fontSize: 20 }}>🧾</div>
            <div><div style={{ fontWeight: 800, fontSize: 16, color: "#1a3c5e" }}>{ventasEmp.length}</div><div style={{ fontSize: 11, color: "#888" }}>Ventas hoy</div></div>
          </div>
          <div style={{ ...S.kpi, borderLeft: "4px solid #4caf50" }}> 
            <div style={{ fontSize: 20 }}>💵</div>
            <div><div style={{ fontWeight: 800, fontSize: 16, color: "#4caf50" }}>${(esperadoTotal + (apertura?.fondo || 0)).toFixed(2)}</div><div style={{ fontSize: 11, color: "#888" }}>Esperado en caja</div></div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>💵 Efectivo esperado: <strong>${esperadoEfectivo.toFixed(2)}</strong></div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>🏦 Transferencia esperada: <strong>${esperadoTransferencia.toFixed(2)}</strong></div>
        <div style={{ fontSize: 12, color: "#555" }}>💳 Tarjeta esperada: <strong>${esperadoTarjeta.toFixed(2)}</strong></div>
      </Card>

      <Card title="👩 Seleccionar empleada">
        <select style={S.input} value={empleadaId} onChange={e => { setEmpleadaId(e.target.value); setResultado(null); }}>
          <option value="todos">Todas las empleadas</option>
          {empleadas.filter(e => e.activa).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </Card>

      <Card title="🔢 Ingresa el dinero contado">
        <div style={{ marginBottom: 10 }}>
          <label style={S.label}>💵 Efectivo en caja</label>
          <input type="number" style={S.input} placeholder="$0.00" value={montoEfectivo} onChange={e => { setMontoEfectivo(e.target.value); setResultado(null); }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={S.label}>🏦 Transferencias recibidas</label>
          <input type="number" style={S.input} placeholder="$0.00" value={montoTransferencia} onChange={e => { setMontoTransferencia(e.target.value); setResultado(null); }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>💳 Pagos con tarjeta</label>
          <input type="number" style={S.input} placeholder="$0.00" value={montoTarjeta} onChange={e => { setMontoTarjeta(e.target.value); setResultado(null); }} />
        </div>
        <button style={S.btnPrimary} onClick={calcularCierre}>🧮 Calcular cierre de caja</button>
      </Card>

      {resultado && (
        <div>
          <div style={{ ...S.kpi, borderLeft: `4px solid ${resultado.difTotal === 0 ? "#4caf50" : resultado.difTotal > 0 ? "#1565c0" : "#e53935"}`, marginBottom: 14 }}>
            <div style={{ fontSize: 28 }}>{resultado.difTotal === 0 ? "✅" : resultado.difTotal > 0 ? "📈" : "⚠️"}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: resultado.difTotal === 0 ? "#2e7d32" : resultado.difTotal > 0 ? "#1565c0" : "#e53935" }}>
                {resultado.difTotal === 0 ? "¡Caja cuadrada!" : resultado.difTotal > 0 ? `Sobran $${resultado.difTotal.toFixed(2)}` : `Faltan $${Math.abs(resultado.difTotal).toFixed(2)}`}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>Ventas reales: ${resultado.ventasReales.toFixed(2)} · Esperado: ${esperadoTotal.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: "#e65100", fontWeight: 600 }}>💵 Fondo restado: ${resultado.fondo.toFixed(2)} queda en caja</div>
            </div>
          </div>

          <Card title="📊 Detalle por método">
            <div style={{ background: "#fff3e0", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#e65100", fontWeight: 600 }}>
              💵 Efectivo contado: ${resultado.ef.toFixed(2)} — Fondo ${resultado.fondo.toFixed(2)} = <strong>Neto ${resultado.efNeto.toFixed(2)}</strong>
            </div>
            {[
              { label: "💵 Efectivo (neto)", contado: resultado.efNeto, esperado: esperadoEfectivo, dif: resultado.difEf },
              { label: "🏦 Transferencia", contado: resultado.tr, esperado: esperadoTransferencia, dif: resultado.difTr },
              { label: "💳 Tarjeta", contado: resultado.ta, esperado: esperadoTarjeta, dif: resultado.difTa },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f4f8" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#888" }}>Contado: ${row.contado.toFixed(2)} / Esperado: ${row.esperado.toFixed(2)}</div>
                  <DifBadge dif={row.dif} />
                </div>
              </div>
            ))}
          </Card>

          <button style={{ ...S.btnPrimary, background: "linear-gradient(135deg,#2e7d32,#388e3c)", marginTop: 4 }} onClick={() => {
            const w = window.open("", "_blank", "width=400,height=600");
            w.document.write(`
              <html><head><title>Cierre de Caja</title>
              <style>body{font-family:sans-serif;padding:20px;max-width:340px;margin:0 auto}
              h2{text-align:center;color:#1a3c5e}.row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
              .divider{border-top:1px dashed #ccc;margin:10px 0}.total{font-size:18px;font-weight:800}
              .ok{color:#2e7d32}.bad{color:#c62828}.info{color:#1565c0}
              .header{text-align:center;margin-bottom:16px}.logo{font-size:32px}</style>
              </head><body>
              <div class="header"><div class="logo">🫧</div><h2>Lava&amp;Listo</h2><p>CIERRE DE CAJA</p></div>
              <div class="divider"></div>
              <div class="row"><span>Fecha</span><span>${new Date(resultado.fecha).toLocaleString("es-MX")}</span></div>
              <div class="row"><span>Empleada</span><span>${resultado.empleada}</span></div>
              <div class="row"><span>Ventas del día</span><span>${resultado.totalVentas} · $${resultado.totalVentasVal.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row"><span>💵 Efectivo contado</span><span>$${resultado.ef.toFixed(2)}</span></div>
              <div class="row"><span>— Fondo que queda</span><span>-$${resultado.fondo.toFixed(2)}</span></div>
              <div class="row"><span>💵 Efectivo neto</span><span>$${resultado.efNeto.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row"><span>💵 Efectivo contado</span><span>$${resultado.ef.toFixed(2)}</span></div>
              <div class="row"><span>💵 Efectivo esperado</span><span>$${esperadoEfectivo.toFixed(2)}</span></div>
              <div class="row"><span>Diferencia</span><span class="${resultado.difEf===0?"ok":resultado.difEf>0?"info":"bad"}">${resultado.difEf===0?"✅ Cuadra":resultado.difEf>0?`+$${resultado.difEf.toFixed(2)}`:`-$${Math.abs(resultado.difEf).toFixed(2)}`}</span></div>
              <div class="divider"></div>
              <div class="row"><span>🏦 Transfer contada</span><span>$${resultado.tr.toFixed(2)}</span></div>
              <div class="row"><span>🏦 Transfer esperada</span><span>$${esperadoTransferencia.toFixed(2)}</span></div>
              <div class="row"><span>Diferencia</span><span class="${resultado.difTr===0?"ok":resultado.difTr>0?"info":"bad"}">${resultado.difTr===0?"✅ Cuadra":resultado.difTr>0?`+$${resultado.difTr.toFixed(2)}`:`-$${Math.abs(resultado.difTr).toFixed(2)}`}</span></div>
              <div class="divider"></div>
              <div class="row total"><span>TOTAL CONTADO</span><span>$${resultado.contadoTotal.toFixed(2)}</span></div>
              <div class="row total"><span>TOTAL ESPERADO</span><span>$${esperadoTotal.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row total"><span>RESULTADO</span><span class="${resultado.difTotal===0?"ok":resultado.difTotal>0?"info":"bad"}">${resultado.difTotal===0?"✅ CUADRA":resultado.difTotal>0?`📈 SOBRA $${resultado.difTotal.toFixed(2)}`:`⚠️ FALTA $${Math.abs(resultado.difTotal).toFixed(2)}`}</span></div>
              <div class="divider"></div>
              <p style="text-align:center;font-size:11px;color:#aaa">Lava&amp;Listo · Sistema de ventas</p>
              <script>window.print();window.close();</script>
              </body></html>
            `);
            w.document.close();
          }}>🖨️ Imprimir ticket de cierre</button>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

// ─── MIS VENTAS (EMPLEADA) ─────────────────────────────────────────
function MisVentas({ ventas, sesion, empleadas, setTicket }) {
  const hoy = new Date().toISOString().split("T")[0];
  const semana = semanaISO(new Date());
  const mes = mesKey(new Date());

  // Solo sus ventas, sin datos de otros clientes
  const misVentas = ventas.filter(v => String(v.empleadaId) === String(sesion.id) && !v.anulada);
  const hoyV = misVentas.filter(v => v.fecha.startsWith(hoy));
  const semV = misVentas.filter(v => semanaISO(v.fecha) === semana);
  const mesV = misVentas.filter(v => mesKey(v.fecha) === mes);

  const sum = arr => arr.reduce((a, v) => a + v.total, 0);
  const emp = empleadas.find(e => String(e.id) === String(sesion.id));
  const meta = emp?.metaVentas || 20;
  const bono = emp?.montoBonus || 0;
  const pct = Math.min(100, (mesV.length / meta) * 100);
  const ganoBono = mesV.length >= meta;

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
      <h2 style={S.panelTitle}>📊 Mis Ventas</h2>
      <div style={{ background: "linear-gradient(135deg,#1a3c5e,#2563a8)", borderRadius: 12, padding: "14px 16px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Bienvenida,</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>{sesion.nombre} 👋</div>
      </div>

      <div style={S.kpiGrid}>
        <KPI icon="☀️" label="Hoy" val={`$${sum(hoyV).toFixed(2)}`} sub={`${hoyV.length} ventas`} color="#f59e0b"/>
        <KPI icon="📅" label="Esta semana" val={`$${sum(semV).toFixed(2)}`} sub={`${semV.length} ventas`} color="#4db6e4"/>
        <KPI icon="📆" label="Este mes" val={`$${sum(mesV).toFixed(2)}`} sub={`${mesV.length} ventas`} color="#1a3c5e"/>
        <KPI icon={ganoBono?"🌟":"🎯"} label={ganoBono?"¡Bono ganado!":"Meta del mes"} val={ganoBono?`$${bono}`:`${mesV.length}/${meta}`} sub={ganoBono?"¡Felicidades!":"ventas"} color={ganoBono?"#f59e0b":"#7c3aed"}/>
      </div>

      {/* PROGRESO BONO */}
      <Card title="🌟 Progreso hacia tu bono">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>{mesV.length} ventas realizadas</span>
          <span style={{ fontWeight: 700 }}>Meta: {meta} ventas = ${bono} de bono</span>
        </div>
        <div style={{ background: "#e8f0f7", borderRadius: 8, height: 14, marginBottom: 8 }}>
          <div style={{ background: ganoBono ? "#f59e0b" : "linear-gradient(90deg,#4db6e4,#1a3c5e)", width: `${pct}%`, height: "100%", borderRadius: 8, transition: "width .5s" }}/>
        </div>
        {ganoBono
          ? <div style={{ textAlign: "center", color: "#f59e0b", fontWeight: 700, fontSize: 15 }}>🌟 ¡Felicidades! Ganaste tu bono de ${bono}</div>
          : <div style={{ textAlign: "center", color: "#888", fontSize: 13 }}>Te faltan {meta - mesV.length} ventas para tu bono</div>
        }
      </Card>

      {/* MIS ÓRDENES DE HOY — sin mostrar clientes, solo servicios y totales */}
      <Card title={`🧾 Mis órdenes de hoy (${hoyV.length})`}>
        {hoyV.length === 0
          ? <div style={S.empty}>Sin ventas hoy todavía</div>
          : hoyV.map(v => (
            <div key={v.folio} style={{ ...S.ventaCard, borderLeft: `4px solid ${estaPagada(v)?"#4caf50":"#ff9800"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1a3c5e" }}>{v.folio}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{fmt(v.fecha)}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                    {v.items.map((it, i) => <span key={i}>{it.label}{it.piezas > 1 ? ` ×${it.piezas}` : ""}{i < v.items.length - 1 ? " · " : ""}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#1a3c5e" }}>${v.total.toFixed(2)}</div>
                  <div style={{ ...S.badge, background: estaPagada(v) ? "#e8f5e9" : "#fff3e0", color: estaPagada(v) ? "#2e7d32" : "#e65100" }}>
                    {estaPagada(v) ? "✅ Pagado" : `⏳ Pendiente`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <label style={S.checkLabel}><input type="checkbox" checked={v.checkMsgRetiro||false} readOnly/><span>📲 Retiro</span></label>
                <label style={S.checkLabel}><input type="checkbox" checked={v.checkMsgEntrega||false} readOnly/><span>✅ Entrega</span></label>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}

// ─── GASTOS ────────────────────────────────────────────────────────
const CATEGORIAS_GASTO = ["Insumos/Suministros","Servicios (agua,luz,internet)","Arriendo","Sueldos","Mantenimiento","Publicidad","Equipos","Otros"];

function Gastos({ gastos, setGastos, sesion }) {
  const [nuevo, setNuevo] = useState({
    descripcion: "", categoria: "Insumos/Suministros", proveedor: "",
    numeroFactura: "", monto: "", fecha: new Date().toISOString().split("T")[0],
    metodoPago: "Efectivo", notas: ""
  });
  const [filtroMes, setFiltroMes] = useState(mesKey(new Date()));
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [error, setError] = useState("");

  const agregar = () => {
    if (!nuevo.descripcion.trim() || !nuevo.monto) { setError("Completa descripción y monto"); return; }
    const gasto = { ...nuevo, id: Date.now(), monto: parseFloat(nuevo.monto), registradoPor: sesion.nombre, creadoEn: new Date().toISOString() };
    setGastos(prev => [gasto, ...prev]);
    setNuevo({ descripcion: "", categoria: "Insumos/Suministros", proveedor: "", numeroFactura: "", monto: "", fecha: new Date().toISOString().split("T")[0], metodoPago: "Efectivo", notas: "" });
    setError("");
  };

  const eliminar = (id) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    setGastos(prev => prev.filter(g => g.id !== id));
  };

  const filtrados = gastos.filter(g => {
    if (filtroMes && !g.fecha.startsWith(filtroMes)) return false;
    if (filtroCategoria !== "Todas" && g.categoria !== filtroCategoria) return false;
    return true;
  });

  const totalFiltrado = filtrados.reduce((a, g) => a + g.monto, 0);

  const porCategoria = CATEGORIAS_GASTO.map(cat => ({
    cat, total: filtrados.filter(g => g.categoria === cat).reduce((a, g) => a + g.monto, 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  const exportarGastos = () => {
    const enc = ["Fecha","Descripción","Categoría","Proveedor","N° Factura","Monto","Método pago","Registrado por","Notas"];
    const filas = filtrados.map(g => [g.fecha, g.descripcion, g.categoria, g.proveedor||"", g.numeroFactura||"", `$${g.monto.toFixed(2)}`, g.metodoPago, g.registradoPor||"", g.notas||""]);
    const csv = [enc, ...filas].map(f => f.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `gastos-${filtroMes||"todos"}.csv`; a.click();
  };

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>🛒 Gastos & Facturas de Compra</h2>

      {/* RESUMEN */}
      <div style={S.kpiGrid}>
        <div style={{ ...S.kpi, borderLeft: "4px solid #e53935" }}>
          <div style={{ fontSize: 22 }}>💸</div>
          <div><div style={{ fontWeight: 800, fontSize: 18, color: "#e53935" }}>${totalFiltrado.toFixed(2)}</div><div style={{ fontSize: 11, color: "#888" }}>Total gastos</div></div>
        </div>
        <div style={{ ...S.kpi, borderLeft: "4px solid #ff9800" }}>
          <div style={{ fontSize: 22 }}>🧾</div>
          <div><div style={{ fontWeight: 800, fontSize: 18, color: "#ff9800" }}>{filtrados.length}</div><div style={{ fontSize: 11, color: "#888" }}>Facturas</div></div>
        </div>
      </div>

      {/* FILTROS */}
      <Card title="🔍 Filtros">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={S.label}>Mes</label><input type="month" style={S.input} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}/></div>
          <div><label style={S.label}>Categoría</label>
            <select style={S.input} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option>Todas</option>{CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button style={{ ...S.btnSmall, marginTop: 8, background: "#e8f5e9", color: "#2e7d32" }} onClick={exportarGastos}>📥 Exportar a Excel</button>
      </Card>

      {/* POR CATEGORÍA */}
      {porCategoria.length > 0 && (
        <Card title="📊 Por categoría">
          {porCategoria.map(x => (
            <div key={x.cat} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                <span>{x.cat}</span><strong>${x.total.toFixed(2)}</strong>
              </div>
              <div style={{ background: "#e8f0f7", borderRadius: 4, height: 8 }}>
                <div style={{ background: "#e53935", width: `${totalFiltrado ? (x.total/totalFiltrado)*100 : 0}%`, height: "100%", borderRadius: 4 }}/>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* NUEVO GASTO */}
      <Card title="➕ Registrar factura / gasto">
        {error && <div style={S.error}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Descripción *</label>
            <input style={S.input} placeholder="Ej: Detergente industrial, pago luz..." value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>Categoría</label>
            <select style={S.input} value={nuevo.categoria} onChange={e => setNuevo({ ...nuevo, categoria: e.target.value })}>
              {CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Monto *</label>
            <input type="number" style={S.input} placeholder="$0.00" value={nuevo.monto} onChange={e => setNuevo({ ...nuevo, monto: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>Proveedor</label>
            <input style={S.input} placeholder="Nombre del proveedor" value={nuevo.proveedor} onChange={e => setNuevo({ ...nuevo, proveedor: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>N° Factura / Comprobante</label>
            <input style={S.input} placeholder="001-001-000123" value={nuevo.numeroFactura} onChange={e => setNuevo({ ...nuevo, numeroFactura: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>Fecha</label>
            <input type="date" style={S.input} value={nuevo.fecha} onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>Método de pago</label>
            <select style={S.input} value={nuevo.metodoPago} onChange={e => setNuevo({ ...nuevo, metodoPago: e.target.value })}>
              {PAGOS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Notas</label>
            <textarea style={{ ...S.input, minHeight: 50, resize: "vertical" }} placeholder="Observaciones adicionales..." value={nuevo.notas} onChange={e => setNuevo({ ...nuevo, notas: e.target.value })}/>
          </div>
        </div>
        <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={agregar}>💾 Registrar gasto</button>
      </Card>

      {/* LISTA */}
      <Card title={`🧾 Facturas registradas (${filtrados.length})`}>
        {filtrados.length === 0 ? <div style={S.empty}>No hay gastos en este período</div>
          : filtrados.map(g => (
            <div key={g.id} style={{ ...S.ventaCard, borderLeft: "4px solid #e53935" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1a3c5e" }}>{g.descripcion}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{g.categoria} · {fmtDate(g.fecha)}</div>
                  {g.proveedor && <div style={{ fontSize: 11, color: "#555" }}>🏪 {g.proveedor}</div>}
                  {g.numeroFactura && <div style={{ fontSize: 11, color: "#4db6e4" }}>🧾 {g.numeroFactura}</div>}
                  {g.registradoPor && <div style={{ fontSize: 11, color: "#888" }}>👤 {g.registradoPor}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#e53935" }}>${g.monto.toFixed(2)}</div>
                  <div style={{ ...S.badge, background: "#f3e8fd", color: "#7c3aed", marginBottom: 4 }}>{g.metodoPago}</div>
                  {sesion.rol === "Administrador" && (
                    <button style={S.btnRemove} onClick={() => eliminar(g.id)}>✕</button>
                  )}
                </div>
              </div>
              {g.notas && <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>📝 {g.notas}</div>}
            </div>
          ))}
      </Card>
    </div>
  );
}

// ─── GESTIÓN DE USUARIOS ───────────────────────────────────────────
function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState(() => load("ll_usuarios", USUARIOS_DEFAULT));
  const [nuevo, setNuevo] = useState({ usuario: "", clave: "", nombre: "", rol: "Empleada" });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [error, setError] = useState("");
  const [showClaves, setShowClaves] = useState({});
  const [showNuevaClave, setShowNuevaClave] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => save("ll_usuarios", usuarios), [usuarios]);

  const agregar = () => {
    if (!nuevo.usuario.trim() || !nuevo.clave.trim() || !nuevo.nombre.trim()) { setError("Completa todos los campos"); return; }
    if (usuarios.find(u => u.usuario.toLowerCase() === nuevo.usuario.toLowerCase())) { setError("Ese usuario ya existe"); return; }
    setUsuarios(prev => [...prev, { ...nuevo, id: Date.now() }]);
    setNuevo({ usuario: "", clave: "", nombre: "", rol: "Empleada" });
    setError("");
    setMsg("✅ Usuario creado correctamente");
    setTimeout(() => setMsg(""), 3000);
  };

  const eliminar = (id) => {
    if (usuarios.filter(u => u.rol === "Administrador").length <= 1 && usuarios.find(u => u.id === id)?.rol === "Administrador") {
      alert("Debe haber al menos un administrador"); return;
    }
    if (!window.confirm("¿Eliminar este usuario?")) return;
    setUsuarios(prev => prev.filter(u => u.id !== id));
  };

  const iniciarEdicion = (u) => {
    setEditId(u.id);
    setEditData({ nombre: u.nombre, usuario: u.usuario, clave: u.clave, rol: u.rol, nuevaClave: "" });
  };

  const guardarEdicion = () => {
    if (!editData.nombre.trim() || !editData.usuario.trim()) { setError("Nombre y usuario son obligatorios"); return; }
    const claveActual = editData.nuevaClave.trim() ? editData.nuevaClave : editData.clave;
    setUsuarios(prev => prev.map(u => u.id === editId ? { ...u, nombre: editData.nombre, usuario: editData.usuario, clave: claveActual, rol: editData.rol } : u));
    setEditId(null);
    setError("");
    setMsg("✅ Usuario actualizado correctamente");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div style={S.panel}>
      <h2 style={S.panelTitle}>🔑 Gestión de Usuarios</h2>

      {msg && <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{msg}</div>}

      <Card title="👥 Usuarios del sistema">
        {usuarios.map(u => (
          <div key={u.id} style={S.ventaCard}>
            {editId === u.id ? (
              <div>
                <div style={{ fontWeight: 700, color: "#1a3c5e", marginBottom: 10 }}>✏️ Editando: {u.nombre}</div>
                {error && <div style={S.error}>{error}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>Nombre completo</label>
                    <input style={S.input} value={editData.nombre||""} onChange={e => setEditData({ ...editData, nombre: e.target.value })}/>
                  </div>
                  <div>
                    <label style={S.label}>Usuario (login)</label>
                    <input style={S.input} value={editData.usuario||""} onChange={e => setEditData({ ...editData, usuario: e.target.value })} autoCapitalize="none"/>
                  </div>
                  <div>
                    <label style={S.label}>Rol</label>
                    <select style={S.input} value={editData.rol||"Empleada"} onChange={e => setEditData({ ...editData, rol: e.target.value })}>
                      <option>Administrador</option><option>Empleada</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={S.label}>Nueva contraseña <span style={{ color: "#aaa", fontWeight: 400 }}>(dejar vacío para no cambiar)</span></label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showNuevaClave ? "text" : "password"}
                        style={{ ...S.input, paddingRight: 44 }}
                        placeholder="Nueva contraseña..."
                        value={editData.nuevaClave||""}
                        onChange={e => setEditData({ ...editData, nuevaClave: e.target.value })}
                      />
                      <button onClick={() => setShowNuevaClave(!showNuevaClave)}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                        {showNuevaClave ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {editData.nuevaClave && <div style={{ fontSize: 11, color: "#2e7d32", marginTop: 4 }}>✅ Se cambiará la contraseña al guardar</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btnPrimary, flex: 1 }} onClick={guardarEdicion}>✓ Guardar cambios</button>
                  <button style={S.btnClose} onClick={() => { setEditId(null); setError(""); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nombre}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    👤 usuario: <strong>{u.usuario}</strong>
                    {" · "}
                    🔒 clave: <span style={{ letterSpacing: 2 }}>{showClaves[u.id] ? u.clave : "••••••"}</span>
                    <button onClick={() => setShowClaves(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, marginLeft: 4 }}>
                      {showClaves[u.id] ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ ...S.badge, background: u.rol === "Administrador" ? "#e8f5fd" : "#f3e8fd", color: u.rol === "Administrador" ? "#1565c0" : "#7c3aed" }}>
                    {u.rol === "Administrador" ? "👑" : "👩"} {u.rol}
                  </div>
                  <button style={S.btnSmall} onClick={() => iniciarEdicion(u)}>✏️ Editar</button>
                  <button style={S.btnRemove} onClick={() => eliminar(u.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card title="➕ Agregar usuario nuevo">
        {error && !editId && <div style={S.error}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Nombre completo</label>
            <input style={S.input} placeholder="Ej: María González" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}/>
          </div>
          <div>
            <label style={S.label}>Usuario (para login)</label>
            <input style={S.input} placeholder="Ej: maria" value={nuevo.usuario} onChange={e => setNuevo({ ...nuevo, usuario: e.target.value })} autoCapitalize="none"/>
          </div>
          <div>
            <label style={S.label}>Contraseña</label>
            <input type="password" style={S.input} placeholder="Contraseña segura" value={nuevo.clave} onChange={e => setNuevo({ ...nuevo, clave: e.target.value })}/>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Rol</label>
            <select style={S.input} value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}>
              <option>Administrador</option><option>Empleada</option>
            </select>
          </div>
        </div>
        <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={agregar}>➕ Crear usuario</button>
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return <div style={S.card}><div style={S.cardTitle}>{title}</div>{children}</div>;
}

const S={
  app:{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#f0f4f8",paddingBottom:40},
  header:{background:"linear-gradient(135deg,#1a3c5e 0%,#2563a8 100%)",padding:"16px 20px",boxShadow:"0 2px 12px rgba(26,60,94,.25)"},
  headerInner:{maxWidth:700,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",fontWeight:700},
  tabBar:{background:"#fff",display:"flex",overflowX:"auto",borderBottom:"2px solid #e8f0f7",maxWidth:700,margin:"0 auto",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 8px rgba(0,0,0,.06)"},
  tabBtn:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 12px",border:"none",background:"transparent",cursor:"pointer",color:"#888",fontFamily:"'DM Sans',sans-serif",fontWeight:500,whiteSpace:"nowrap",minWidth:68},
  tabActive:{color:"#1a3c5e",borderBottom:"2px solid #4db6e4",marginBottom:-2,fontWeight:700},
  content:{maxWidth:700,margin:"0 auto",padding:"16px 12px"},
  panel:{},
  panelTitle:{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#1a3c5e",marginBottom:14,fontWeight:700},
  card:{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:14,boxShadow:"0 1px 6px rgba(26,60,94,.08)"},
  cardTitle:{fontSize:13,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,marginBottom:12},
  input:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #d0dce8",fontSize:14,fontFamily:"'DM Sans',sans-serif",background:"#f8fbfd",outline:"none",color:"#1a3c5e"},
  label:{display:"block",fontSize:12,color:"#888",marginBottom:4,fontWeight:500},
  btnPrimary:{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"},
  btnAdd:{background:"#e8f5fd",color:"#1a7dbf",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnRemove:{background:"#ffebee",color:"#c62828",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:700},
  btnSmall:{background:"#e8f0f7",color:"#1a3c5e",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnTicket:{background:"#f0f4f8",color:"#1a3c5e",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnPrint:{background:"#1a3c5e",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnClose:{background:"#e8f0f7",color:"#1a3c5e",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  totalBox:{background:"#e8f5fd",borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:15,color:"#1a3c5e",textAlign:"right"},
  pagoResumen:{background:"#e8f5e9",color:"#2e7d32",borderRadius:8,padding:"9px 12px",fontSize:13,fontWeight:500,marginTop:4},
  dropdown:{background:"#fff",border:"1.5px solid #d0dce8",borderRadius:8,marginTop:4,boxShadow:"0 4px 12px rgba(0,0,0,.1)",zIndex:20,position:"relative"},
  dropItem:{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f0f4f8",fontSize:14},
  clienteTag:{background:"#e8f5e9",color:"#2e7d32",padding:"8px 12px",borderRadius:8,fontSize:13,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6},
  tagX:{background:"none",border:"none",color:"#2e7d32",cursor:"pointer",fontSize:14,fontWeight:700},
  pill:{padding:"6px 14px",borderRadius:20,border:"1.5px solid #d0dce8",background:"#f8fbfd",color:"#888",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500},
  pillActive:{background:"#1a3c5e",color:"#fff",border:"1.5px solid #1a3c5e"},
  badge:{display:"inline-block",padding:"3px 8px",borderRadius:12,fontSize:11,fontWeight:600},
  ventaCard:{background:"#f8fbfd",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1.5px solid #e8f0f7"},
  kpiGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14},
  kpi:{background:"#fff",borderRadius:10,padding:"14px",display:"flex",gap:12,alignItems:"center",boxShadow:"0 1px 6px rgba(26,60,94,.08)"},
  error:{background:"#ffebee",color:"#c62828",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:10,fontWeight:500},
  alerta:{background:"#fff3e0",color:"#e65100",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:12,fontWeight:500},
  empty:{textAlign:"center",color:"#aaa",padding:"20px 0",fontSize:13},
  checkLabel:{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#555",cursor:"pointer"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,padding:16},
  ticketBox:{background:"#fff",borderRadius:14,padding:"24px 22px",width:"100%",maxWidth:340,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.2)"},
  ticketHeader:{textAlign:"center",marginBottom:12},
  ticketLogo:{fontSize:32,marginBottom:4},
  ticketDivider:{borderTop:"1.5px dashed #d0dce8",margin:"10px 0"},
  ticketRow:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,marginBottom:5,color:"#333"},
};
