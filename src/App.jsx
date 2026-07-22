import { useState, useEffect } from "react";
import { useCollection } from "./hooks/useFirestore";


const KEYS = { ventas:"ll_ventas", clientes:"ll_clientes", empleadas:"ll_empleadas", inventario:"ll_inventario", servicios:"ll_servicios" };
const load = (k,d) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch { return d; } };
const save = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };

const SERVICIOS_DEFAULT = [
  {id:"001",label:"LAVADO + SECADO 15LB",precio:4.50},{id:"002",label:"LAVADO + SECADO 25 LB",precio:6.50},
  {id:"003",label:"LIMPIEZA PROFESIONAL 1 PAR",precio:3.50},{id:"004",label:"3 PARES (PACK AHORRO)",precio:8.50},
  {id:"005",label:"5 PARES (PACK FAMILIAR)",precio:12.99},{id:"006",label:"COMBO 15LB + 1 PAR ZAPATOS",precio:5.99},
  {id:"007",label:"COMBO 25LB + 2 PAR ZAPATOS",precio:9.99},{id:"008",label:"PACK ESTUDIANTES (2 PARES)",precio:6.00},
  {id:"009",label:"PACK EXPRESS ZAPATOS",precio:4.50},{id:"010",label:"MIERCOLES ZAPATOS (4 PARES)",precio:9.99},
  {id:"011",label:"LAVADO EDREDON 2 PLAZAS",precio:6.00},{id:"012",label:"LAVADO EDREDON 2.5 PLAZAS",precio:8.00},
  {id:"013",label:"LAVADO EDREDON 3 PLAZAS",precio:8.00},{id:"014",label:"LAVADO 2 COBIJAS PEQUENAS",precio:4.00},
  {id:"015",label:"LAVADO 2 COBIJAS GRANDES",precio:6.00},{id:"016",label:"LAVADO 1 COBIJA GRANDE",precio:6.00},
  {id:"017",label:"LIBRA ADICIONAL",precio:0.30},{id:"018",label:"LAVADO EN SECO TERNO",precio:10.50},
  {id:"019",label:"LAVADO EN SECO SACO",precio:5.50},{id:"020",label:"PRELAVADO BASICO",precio:1.00},
  {id:"021",label:"LAVADO ALMOHADA ESTANDAR",precio:3.50},{id:"022",label:"SOLO SECADO",precio:5.00},
  {id:"023",label:"LAVADO ROPA + COBIJAS 16LB",precio:6.50},{id:"024",label:"SERVICIO EXPRESS",precio:1.50},
  {id:"025",label:"PLANCHADO CAMISA",precio:1.25},{id:"026",label:"LAVADO Y PLANCHADO CAMISA",precio:2.30},
  {id:"027",label:"10 PARES DE ZAPATOS",precio:24.99},{id:"028",label:"LAVADO ROPA INDUSTRIAL",precio:10.00},
  {id:"029",label:"LAVADO SABANAS Y 1 COBIJA",precio:5.00},{id:"030",label:"LAVADO 1 MOCHILA",precio:3.50},
  {id:"031",label:"LAVADO 1 SACO",precio:5.75},{id:"032",label:"LAVADO ABRIGO",precio:10.50},
  {id:"033",label:"CAPA Y BIRRETE",precio:12.00},{id:"034",label:"LAVADO COLCHAS",precio:7.00},
  {id:"035",label:"LAVADO EN SECO ZAPATOS GAMUZA",precio:4.50},{id:"036",label:"COLCHA GRANDE",precio:10.00},
  {id:"037",label:"SACO 3/4",precio:9.00},
];
const PAGOS = ["Efectivo","Transferencia Pichincha","Transferencia JEP","Tarjeta"];
const esTr = m => m && m.startsWith("Transferencia");
const INSUMOS_DEFAULT = [
  {id:1,nombre:"Detergente (kg)",stock:10,min:3,unidad:"kg"},
  {id:2,nombre:"Suavizante (L)",stock:5,min:2,unidad:"L"},
  {id:3,nombre:"Bolsas de empaque",stock:100,min:20,unidad:"pzas"},
];
const EMPLEADAS_DEFAULT = [
  {id:1,nombre:"Ana Garcia",activa:true,metaVentas:20,montoBonus:20},
  {id:2,nombre:"Maria Lopez",activa:true,metaVentas:20,montoBonus:20},
];
// 🎯 INCENTIVOS: comisión por impulsación de promo + bonos por meta grupal (editable desde el panel admin)
const INCENTIVOS_DEFAULT = [{id:"config",comisionImpulso:0.40,bonoMetaPct:1,bonoExcedentePct:10}];
// Calcula la meta $ del mes (mismo criterio que el Dashboard BI: promedio ponderado de últimos 3 meses +10%)
function calcMetaMes(ventas,mesSel){
  const vOk=ventas.filter(v=>!v.anulada);
  const porMes={};vOk.forEach(v=>{const k=mesK(v.fecha);porMes[k]=(porMes[k]||0)+v.total;});
  const hoyD=new Date();const diaMes=hoyD.getDate();const diasMes=new Date(hoyD.getFullYear(),hoyD.getMonth()+1,0).getDate();
  const vMes=vOk.filter(v=>mesK(v.fecha)===mesSel);
  const ventaMes=vMes.reduce((a,v)=>a+v.total,0);
  const cerrados=Object.keys(porMes).filter(k=>k<mesSel).sort();
  const ult3=cerrados.slice(-3).map(k=>porMes[k]);
  let meta;
  if(ult3.length>0){
    const pesos=ult3.length===3?[0.2,0.3,0.5]:ult3.length===2?[0.4,0.6]:[1];
    const prom=ult3.reduce((a,b,i)=>a+b*pesos[i],0);
    meta=Math.max(10,Math.ceil((prom*1.10)/10)*10);
  }else{
    const proy=(ventaMes/Math.max(1,diaMes))*diasMes;
    meta=Math.max(10,Math.ceil(proy/10)*10);
  }
  return{meta,ventaMes,vMes};
}
const USUARIOS_DEFAULT = [
  {id:1,usuario:"admin",clave:"admin123",rol:"Administrador",nombre:"Administrador"},
  {id:2,usuario:"ana",clave:"1234",rol:"Empleada",nombre:"Ana Garcia"},
  {id:3,usuario:"maria",clave:"1234",rol:"Empleada",nombre:"Maria Lopez"},
];
const ESTADOS = [
  {id:"recibido",label:"Recibido",color:"#f59e0b",bg:"#fff8e1",icon:"📥"},
  {id:"proceso",label:"En proceso",color:"#1565c0",bg:"#e3f2fd",icon:"🔄"},
  {id:"listo",label:"Listo para retirar",color:"#2e7d32",bg:"#e8f5e9",icon:"✅"},
  {id:"entregado",label:"Entregado",color:"#888",bg:"#f0f0f0",icon:"📦"},
];
const BILLETES=[100,50,20,10,5,1];
const MONEDAS=[0.50,0.25,0.10,0.05,0.01];
const folio=()=>"LL-"+Date.now().toString(36).toUpperCase();
const fmt=d=>new Date(d).toLocaleString("es-MX",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtD=d=>new Date(d).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
const semISO=d=>{const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()+3-((dt.getDay()+6)%7));const w1=new Date(dt.getFullYear(),0,4);return dt.getFullYear()+"-W"+String(1+Math.round(((dt-w1)/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,"0");};
const mesK=d=>{const dt=new Date(d);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");};
const saldo=v=>v.total-(v.abonos||[]).reduce((a,ab)=>a+ab.monto,0);
const pagada=v=>saldo(v)<=0;
const getEst=v=>ESTADOS.find(e=>e.id===(v.estado||"recibido"))||ESTADOS[0];
const sigEst=actual=>{const i=ESTADOS.findIndex(e=>e.id===actual);return i<ESTADOS.length-1?ESTADOS[i+1]:null;};

const esLavadoSeco = label => label && label.toUpperCase().includes("SECO");
const calcGanancia = (items) => items.reduce((acc, it) => {
  const subtotal = (it.precio||0) * (it.piezas||1);
  return acc + (esLavadoSeco(it.label) ? subtotal * 0.20 : subtotal);
}, 0);

// ===== WhatsApp obligatorio =====
// Normaliza teléfonos de Ecuador al formato internacional para wa.me (593...)
const telWa = t => {
  if(!t) return null;
  let d = String(t).replace(/\D/g,"");
  if(!d) return null;
  if(d.startsWith("593")) return d;
  if(d.startsWith("0")) d = d.slice(1);
  if(d.length < 8) return null;
  return "593" + d;
};
const EMO = {
  burbuja:"\u{1FAE7}", saludo:"\u{1F44B}", check:"\u2705", folio:"\u{1F4CB}",
  item:"\u{1F539}", dinero:"\u{1F4B5}", reloj:"\u23F3", fecha:"\u{1F4C5}",
  corazon:"\u{1F499}", pin:"\u{1F4CD}", fiesta:"\u{1F389}", brillo:"\u2728",
  hora:"\u{1F550}"
};
const msgWa = (v, tipo) => {
  const L = "\u2501".repeat(15);
  const E = EMO;
  const items = (v.items||[]).map(it=>`  ${E.item} ${it.label}${it.piezas>1?` x${it.piezas}`:""}`).join("\n");
  const pend = saldo(v);
  if(tipo==="recibido") return `${E.burbuja} *LAVA & LISTO* ${E.burbuja}\n_Lavanderia & Limpieza Especializada_\n${L}\n¡Hola *${v.clienteNombre}*! ${E.saludo}\nTu orden fue *RECIBIDA* ${E.check}\n\n${E.folio} *Folio:* ${v.folio}\n${L}\n*DETALLE DEL SERVICIO:*\n${items}\n${L}\n${E.dinero} *Total:* $${v.total.toFixed(2)}\n${pend>0?`${E.reloj} *Saldo pendiente:* $${pend.toFixed(2)}`:`${E.check} *Pagado en su totalidad*`}\n${E.fecha} *Entrega estimada:* ${fmtD(v.entrega)}\n${L}\n¡Gracias por confiar en nosotros! ${E.corazon}\n${E.pin} Ricaurte, Cuenca`;
  return `${E.burbuja} *LAVA & LISTO* ${E.burbuja}\n_Lavanderia & Limpieza Especializada_\n${L}\n¡Hola *${v.clienteNombre}*! ${E.fiesta}\n\nTu pedido *${v.folio}* ya esta\n${E.brillo} *LISTO PARA RETIRAR* ${E.brillo}\n${L}${pend>0?`\n${E.reloj} *Saldo al retirar:* $${pend.toFixed(2)}\n${L}`:""}\n${E.hora} Te esperamos en nuestro local\n¡Gracias por tu preferencia! ${E.corazon}\n${E.pin} Ricaurte, Cuenca`;
};

// ===== Cumpleaños =====
const esCumpleHoy=nac=>{
  if(!nac)return false;
  const p=String(nac).split("-");if(p.length<3)return false;
  const hoy=new Date();
  return parseInt(p[1])===hoy.getMonth()+1&&parseInt(p[2])===hoy.getDate();
};
// Días que faltan para el cumpleaños (0 = hoy). null si no tiene fecha.
const diasParaCumple=nac=>{
  if(!nac)return null;
  const p=String(nac).split("-");if(p.length<3)return null;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  let prox=new Date(hoy.getFullYear(),parseInt(p[1])-1,parseInt(p[2]));
  if(prox<hoy)prox=new Date(hoy.getFullYear()+1,parseInt(p[1])-1,parseInt(p[2]));
  return Math.round((prox-hoy)/86400000);
};
const DESC_CUMPLE=0.10; // 🎂 10% de descuento el día del cumpleaños
const msgWaCumple=c=>{
  const L="\u2501".repeat(15);
  return `\u{1FAE7} *LAVA & LISTO* \u{1FAE7}\n_Lavanderia & Limpieza Especializada_\n${L}\n\u{1F382} *\u00A1FELIZ CUMPLEA\u00D1OS, ${c.nombre}!* \u{1F389}\n\nHoy es tu d\u00EDa y en Lava & Listo\nqueremos celebrarlo contigo \u{1F499}\n${L}\n\u2728 *10% DE DESCUENTO* \u2728\nen todos nuestros servicios,\nsolo por ser tu cumplea\u00F1os \u{1F381}\n\n\u{1F4C5} V\u00E1lido HOY presentando este mensaje\n${L}\n\u00A1Te esperamos para consentirte!\n\u{1F4CD} Ricaurte, Cuenca`;
};
const waCumpleUrl=c=>{
  const tel=telWa(c.tel);
  if(!tel)return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(msgWaCumple(c))}`;
};

// Modal obligatorio: no se puede continuar sin abrir WhatsApp y confirmar el envío.
// Si el cliente no tiene teléfono válido, se registra la excepción con motivo.
function WhatsAppObligatorio({venta,tipo,onConfirm,onCancel}){
  const [abierto,setAbierto]=useState(false);
  const tel=telWa(venta.clienteTel);
  const msg=msgWa(venta,tipo);
  const abrir=()=>{window.open(`https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msg)}`,"_blank");setAbierto(true);};
  return(
    <div style={S.ov}>
      <div style={S.tbox}>
        <div style={{textAlign:"center",fontSize:36,marginBottom:6}}>{"\u{1F4F2}"}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",textAlign:"center",marginBottom:4}}>
          {tipo==="recibido"?"Confirmar orden por WhatsApp":"Avisar: listo para retirar"}
        </div>
        <div style={{fontSize:12,color:"#888",textAlign:"center",marginBottom:12}}>
          {tipo==="recibido"?"Paso obligatorio: avisa al cliente que su orden fue recibida.":"Paso obligatorio: avisa al cliente antes de marcar la orden como lista."}
        </div>
        <div style={S.trow}><span>Cliente</span><strong>{venta.clienteNombre}</strong></div>
        <div style={S.trow}><span>Folio</span><span>{venta.folio}</span></div>
        {tel
          ? <div style={S.trow}><span>WhatsApp</span><strong style={{color:"#2e7d32"}}>+{tel}</strong></div>
          : <div style={{...S.err,marginTop:8}}>⚠️ El cliente no tiene un número de WhatsApp válido registrado.</div>}
        <div style={{background:"#f0f4f8",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#555",whiteSpace:"pre-wrap",margin:"10px 0",maxHeight:160,overflowY:"auto"}}>{msg}</div>
        {tel&&(<>
          <button style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={abrir}>📲 Abrir WhatsApp con el mensaje</button>
          <button disabled={!abierto} style={{width:"100%",padding:"12px",background:abierto?"linear-gradient(135deg,#2e7d32,#388e3c)":"#e0e0e0",color:abierto?"#fff":"#999",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:abierto?"pointer":"not-allowed",marginBottom:8}} onClick={()=>onConfirm({enviado:true,fecha:new Date().toISOString()})}>✅ Ya envié el mensaje</button>
          {!abierto&&<div style={{fontSize:11,color:"#888",textAlign:"center",marginBottom:8}}>Primero abre WhatsApp y envía el mensaje para poder confirmar.</div>}
        </>)}
        {!tel&&<button style={{width:"100%",padding:"12px",background:"#fff3e0",color:"#e65100",border:"1.5px solid #e65100",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={()=>{const m=window.prompt("Motivo (ej: cliente sin celular, se avisará por llamada):");if(m===null)return;onConfirm({enviado:false,sinTelefono:true,motivo:m,fecha:new Date().toISOString()});}}>⚠️ Continuar sin WhatsApp (registrar motivo)</button>}
        {onCancel&&<button style={{width:"100%",padding:"10px",background:"transparent",color:"#888",border:"1px solid #d0dce8",borderRadius:10,fontSize:13,cursor:"pointer"}} onClick={onCancel}>Cancelar</button>}
      </div>
    </div>
  );
}


// ─── FECHA LOCAL ECUADOR (UTC-5) ──────────────────────────────────
const fechaHoyLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};
// Convierte cualquier fecha ISO (UTC) a fecha local para comparar
const fechaLocal = (isoStr) => {
  if (!isoStr) return "";
  const dt = new Date(isoStr);
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};
const semISO_local = (isoStr) => semISO(new Date(isoStr));
const mesK_local = (isoStr) => mesK(new Date(isoStr));

const expCSV=(ventas,titulo,empleadas)=>{
  const enc=["Folio","Fecha","Cliente","Servicios","Total","Pagado","Pendiente","Metodo","Estado","Notas"];
  const filas=ventas.map(v=>{
    const p=(v.abonos||[]).reduce((a,ab)=>a+ab.monto,0);
    const m=[...new Set((v.abonos||[]).map(ab=>ab.metodo))].join("/");
    return[v.folio,fmt(v.fecha),v.clienteNombre||"",v.items.map(it=>it.label).join("|"),"$"+v.total.toFixed(2),"$"+p.toFixed(2),"$"+(v.total-p).toFixed(2),m,v.estado||"recibido",v.notas||""];
  });
  const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=titulo+"-"+fechaHoyLocal()+".csv";a.click();
};

const S={
  app:{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#f0f4f8",paddingBottom:40},
  hdr:{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",padding:"14px 20px",boxShadow:"0 2px 12px rgba(26,60,94,.25)"},
  hdrI:{maxWidth:700,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",fontWeight:700},
  tabBar:{background:"#fff",display:"flex",overflowX:"auto",borderBottom:"2px solid #e8f0f7",maxWidth:700,margin:"0 auto",position:"sticky",top:0,zIndex:10},
  tabBtn:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 10px",border:"none",background:"transparent",cursor:"pointer",color:"#888",fontFamily:"'DM Sans',sans-serif",fontWeight:500,whiteSpace:"nowrap",minWidth:60,fontSize:11},
  tabAct:{color:"#1a3c5e",borderBottom:"2px solid #4db6e4",marginBottom:-2,fontWeight:700},
  content:{maxWidth:700,margin:"0 auto",padding:"14px 12px"},
  panel:{},
  ptitle:{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#1a3c5e",marginBottom:14,fontWeight:700},
  card:{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:14,boxShadow:"0 1px 6px rgba(26,60,94,.08)"},
  ctitle:{fontSize:12,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10},
  inp:{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #d0dce8",fontSize:14,fontFamily:"'DM Sans',sans-serif",background:"#f8fbfd",outline:"none",color:"#1a3c5e"},
  lbl:{display:"block",fontSize:12,color:"#888",marginBottom:4,fontWeight:500},
  btnP:{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"},
  btnS:{background:"#e8f0f7",color:"#1a3c5e",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"},
  btnR:{background:"#ffebee",color:"#c62828",border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,cursor:"pointer",fontWeight:700},
  btnT:{background:"#f0f4f8",color:"#1a3c5e",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"},
  btnC:{background:"#e8f0f7",color:"#1a3c5e",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:"pointer"},
  pill:{padding:"6px 12px",borderRadius:20,border:"1.5px solid #d0dce8",background:"#f8fbfd",color:"#888",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500},
  pillA:{background:"#1a3c5e",color:"#fff",border:"1.5px solid #1a3c5e"},
  badge:{display:"inline-block",padding:"3px 8px",borderRadius:12,fontSize:11,fontWeight:600},
  vcard:{background:"#f8fbfd",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1.5px solid #e8f0f7"},
  kgrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14},
  kpi:{background:"#fff",borderRadius:10,padding:"12px",display:"flex",gap:10,alignItems:"center",boxShadow:"0 1px 6px rgba(26,60,94,.08)"},
  err:{background:"#ffebee",color:"#c62828",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:10,fontWeight:500},
  alrt:{background:"#fff3e0",color:"#e65100",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:12,fontWeight:500},
  empty:{textAlign:"center",color:"#aaa",padding:"20px 0",fontSize:13},
  chk:{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#555",cursor:"pointer"},
  ov:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,padding:16},
  tbox:{background:"#fff",borderRadius:14,padding:"24px 22px",width:"100%",maxWidth:340,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.2)"},
  trow:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,marginBottom:5,color:"#333"},
  tdiv:{borderTop:"1.5px dashed #d0dce8",margin:"10px 0"},
  drop:{background:"#fff",border:"1.5px solid #d0dce8",borderRadius:8,marginTop:4,boxShadow:"0 4px 12px rgba(0,0,0,.1)",zIndex:20,position:"relative"},
  dropI:{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f0f4f8",fontSize:14},
  ctag:{background:"#e8f5e9",color:"#2e7d32",padding:"8px 12px",borderRadius:8,fontSize:13,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6},
  total:{background:"#e8f5fd",borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:15,color:"#1a3c5e",textAlign:"right"},
};

function Card({title,children}){return <div style={S.card}><div style={S.ctitle}>{title}</div>{children}</div>;}

function TicketModal({venta,empleadas,onClose}){
  if(!venta)return null;
  const emp=empleadas.find(e=>e.id===venta.empleadaId);
  const pend=saldo(venta);const abs=venta.abonos||[];
  const totAb=abs.reduce((a,ab)=>a+ab.monto,0);
  const est=getEst(venta);
  const print2=()=>{
    const orig=document.getElementById("tp");
    if(!orig){window.print();return;}
    const html=orig.innerHTML;
    const w=window.open("","_blank","width=400,height=800");
    if(!w)return;
    const thtml="<html><head><title>Comprobante</title>"
      +"<style>body{font-family:sans-serif;padding:10px;max-width:340px;margin:0 auto}.copy{border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:8px}.lbl{text-align:center;font-size:10px;color:#aaa;font-weight:bold;margin-bottom:8px;border-bottom:1px dashed #ccc;padding-bottom:6px}@media print{body{margin:0;padding:5px}}</style>"
      +"</head><body>"
      +"<div class='copy'><div class='lbl'>✂️ COPIA CLIENTE</div>"+html+"</div>"
      +"<div style='border-top:2px dashed #ccc;margin:10px 0;text-align:center;font-size:11px;color:#aaa'>— cortar aquí —</div>"
      +"<div class='copy'><div class='lbl'>✂️ COPIA NEGOCIO</div>"+html+"</div>"
      +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
    w.document.write(thtml);
    w.document.close();
  };
  return(
    <div style={S.ov}>
      <div style={S.tbox} id="tp">
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:32}}>🫧</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1a3c5e"}}>Lava<span style={{color:"#4db6e4"}}>&</span>Listo</div>
        </div>
        <div style={S.tdiv}/>
        {[["Folio",venta.folio],["Fecha",fmt(venta.fecha)],["Entrega",fmtD(venta.entrega)],["Cliente",venta.clienteNombre]].map(([k,v])=><div key={k} style={S.trow}><span>{k}</span><span>{v}</span></div>)}
        {venta.clienteTel&&<div style={S.trow}><span>Tel</span><span>{venta.clienteTel}</span></div>}
        {venta.clienteDireccion&&<div style={S.trow}><span>Dir</span><span style={{fontSize:11}}>{venta.clienteDireccion}</span></div>}
        {emp&&<div style={S.trow}><span>Atendio</span><span>{emp.nombre}</span></div>}
        <div style={{...S.trow,color:est.color}}><span>Estado</span><span>{est.icon} {est.label}</span></div>
        <div style={S.tdiv}/>
        {venta.items.map((it,i)=><div key={i} style={S.trow}><span>{it.label}{it.piezas>1?` x${it.piezas}`:""}</span><span>${(it.precio*it.piezas).toFixed(2)}</span></div>)}
        <div style={S.tdiv}/>
        <div style={{...S.trow,fontSize:16,fontWeight:800}}><span>TOTAL</span><span>${venta.total.toFixed(2)}</span></div>
        {abs.length>0&&<>{abs.map((ab,i)=><div key={i} style={S.trow}><span>{ab.metodo}</span><span style={{color:"#2e7d32"}}>-${ab.monto.toFixed(2)}</span></div>)}<div style={S.trow}><span>Pagado</span><strong style={{color:"#2e7d32"}}>${totAb.toFixed(2)}</strong></div></>}
        {pend>0&&<div style={{background:"#fff3e0",borderRadius:8,padding:"8px 10px",marginTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:"#e65100"}}>⚠️ Pendiente</span><strong style={{color:"#e65100"}}>${pend.toFixed(2)}</strong></div>}
        {pend<=0&&<div style={{background:"#e8f5e9",borderRadius:8,padding:"8px 10px",marginTop:8,textAlign:"center"}}><span style={{fontSize:13,fontWeight:700,color:"#2e7d32"}}>✅ Pagado completo</span></div>}
        {venta.notas&&<div style={{fontSize:11,color:"#888",marginTop:8}}>Nota: {venta.notas}</div>}
        <div style={{...S.tdiv}}/><div style={{textAlign:"center",fontSize:11,color:"#aaa"}}>¡Gracias! 💙</div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button style={{background:"#1a3c5e",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={print2}>🖨️ Imprimir 2 copias</button>
        <button style={S.btnC} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

function AbonoModal({venta,onSave,onClose}){
  const [monto,setMonto]=useState("");const [metodo,setMetodo]=useState("Efectivo");
  const pend=saldo(venta);
  return(
    <div style={S.ov}>
      <div style={S.tbox}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#1a3c5e",fontWeight:700,marginBottom:14}}>💰 Registrar pago</div>
        <div style={S.trow}><span>Cliente</span><strong>{venta.clienteNombre}</strong></div>
        <div style={{...S.trow,color:"#e65100",fontWeight:700}}><span>Pendiente</span><span>${pend.toFixed(2)}</span></div>
        <div style={S.tdiv}/>
        <label style={S.lbl}>Monto</label>
        <input type="number" style={{...S.inp,marginBottom:8}} placeholder={`Max $${pend.toFixed(2)}`} value={monto} onChange={e=>setMonto(e.target.value)}/>
        <button style={{...S.btnS,marginBottom:10,width:"100%",background:"#e8f5fd",color:"#1565c0"}} onClick={()=>setMonto(String(pend))}>Pagar saldo completo</button>
        <label style={S.lbl}>Metodo</label>
        <select style={{...S.inp,marginBottom:14}} value={metodo} onChange={e=>setMetodo(e.target.value)}>{PAGOS.map(p=><option key={p}>{p}</option>)}</select>
        <div style={{display:"flex",gap:8}}>
          <button style={{...S.btnP,flex:1}} onClick={()=>{const m=parseFloat(monto);if(!m||m<=0||m>pend)return;onSave({monto:m,metodo,fecha:new Date().toISOString()});}}>Guardar</button>
          <button style={{...S.btnC,flex:1}} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({onLogin}){
  const [u,setU]=useState("");const [c,setC]=useState("");const [err,setErr]=useState("");const [show,setShow]=useState(false);
  // Sincronizar usuarios con Firestore al abrir el login:
  // - Si la nube tiene usuarios, se descargan a este dispositivo.
  // - Si la nube está vacía (primera vez), se suben los usuarios locales.
  useEffect(()=>{(async()=>{
    try{
      const {db}=await import("./firebase");
      const {collection,getDocs,setDoc,doc}=await import("firebase/firestore");
      const snap=await getDocs(collection(db,"usuarios"));
      const nube=snap.docs.map(d=>d.data());
      if(nube.length===0){
        const locales=load("ll_usuarios",USUARIOS_DEFAULT);
        for(const us of locales){await setDoc(doc(collection(db,"usuarios"),String(us.id)),{...us,_updatedAt:new Date().toISOString()},{merge:true});}
      }else{
        save("ll_usuarios",nube.filter(us=>!us.eliminada));
      }
    }catch(e){console.log("No se pudo sincronizar usuarios:",e);}
  })();},[]);
  const go=()=>{
    const users=load("ll_usuarios",USUARIOS_DEFAULT);
    const found=users.find(x=>x.usuario.toLowerCase()===u.toLowerCase().trim()&&x.clave===c);
    if(!found){setErr("Usuario o clave incorrectos");return;}
    onLogin(found);
  };
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"40px 32px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48}}>🫧</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#1a3c5e",marginTop:8}}>Lava<span style={{color:"#4db6e4"}}>&</span>Listo</div>
          <div style={{fontSize:13,color:"#888",marginTop:4}}>Sistema de ventas</div>
        </div>
        <label style={{...S.lbl,fontSize:13,fontWeight:600}}>👤 Usuario</label>
        <input style={{...S.inp,padding:"12px 14px",fontSize:15,marginBottom:14}} placeholder="Tu usuario" value={u} onChange={e=>{setU(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} autoCapitalize="none"/>
        <label style={{...S.lbl,fontSize:13,fontWeight:600}}>🔒 Contraseña</label>
        <div style={{position:"relative",marginBottom:20}}>
          <input type={show?"text":"password"} style={{...S.inp,padding:"12px 44px 12px 14px",fontSize:15}} placeholder="Tu contraseña" value={c} onChange={e=>{setC(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/>
          <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16}}>{show?"🙈":"👁️"}</button>
        </div>
        {err&&<div style={S.err}>{err}</div>}
        <button style={{...S.btnP,padding:"14px",fontSize:16,borderRadius:12}} onClick={go}>Ingresar →</button>
      </div>
    </div>
  );
}

function AperturaObligatoria({sesion,onLogout,onAbierta,empleadas,upsertCaja}){
  const hoy=fechaHoyLocal();
  const AK="ll_apertura_"+hoy+"_"+sesion.id;
  const [fondo,setFondo]=useState("15.00");
  const abrir=()=>{
    const d={id:"ap_"+hoy+"_"+sesion.id+"_"+Date.now(),tipo:"apertura",dia:hoy,empleadaNombre:sesion.nombre,empleadaId:sesion.id,fondo:parseFloat(fondo)||15,fecha:new Date().toISOString()};
    try{localStorage.setItem(AK,JSON.stringify(d));}catch{}
    if(upsertCaja)upsertCaja(d); // ☁️ apertura guardada en la nube
    onAbierta();
  };
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48}}>🔓</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#1a3c5e",marginTop:8}}>Apertura de Caja</div>
          <div style={{fontSize:13,color:"#888",marginTop:6}}>Hola <strong>{sesion.nombre}</strong>, antes de iniciar debes abrir la caja.</div>
        </div>
        <div style={{background:"#f0f4f8",borderRadius:12,padding:16,marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:13,color:"#555",marginBottom:8}}>Fondo inicial en caja:</div>
          <input type="number" style={{...S.inp,fontSize:22,fontWeight:800,textAlign:"center",border:"2px solid #4db6e4"}} value={fondo} onChange={e=>setFondo(e.target.value)}/>
          <div style={{fontSize:11,color:"#4db6e4",marginTop:6}}>💡 El fondo estandar es $15.00</div>
        </div>
        <button style={{...S.btnP,padding:"14px",fontSize:16,borderRadius:12,marginBottom:10}} onClick={abrir}>🔓 Abrir caja e iniciar dia</button>
        <button style={{width:"100%",padding:"10px",background:"transparent",color:"#888",border:"1px solid #d0dce8",borderRadius:10,fontSize:13,cursor:"pointer"}} onClick={onLogout}>Cerrar sesion</button>
      </div>
    </div>
  );
}

// OrdenCard es componente SEPARADO (no dentro de map ni de PantallaEmpleada)
function OrdenCard({v,setVentas,addAbono,setTicket,upsertVenta}){
  const [showAb,setShowAb]=useState(false);
  const [waListo,setWaListo]=useState(false);
  const est=getEst(v);const sig=sigEst(v.estado||"recibido");
  const esPag=pagada(v);const pend=saldo(v);
  const aplicarEstado=(nuevoEstado,extra={})=>setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,estado:nuevoEstado,...extra}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const cambiar=()=>{
    if(!sig)return;
    if(sig.id==="listo"){setWaListo(true);return;} // WhatsApp obligatorio antes de "listo"
    aplicarEstado(sig.id);
  };
  const toggle=f=>setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,[f]:!vv[f]}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  return(
    <div style={{borderRadius:14,border:`2px solid ${est.color}`,background:"#fff",marginBottom:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
      <div style={{background:est.bg,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:800,fontSize:14,color:est.color}}>{est.icon} {est.label}</div>
        <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>
      </div>
      <div style={{padding:"12px 14px"}}>
        <div style={{fontWeight:700,fontSize:16,color:"#1a3c5e"}}>{v.clienteNombre}</div>
        {v.clienteTel&&<div style={{fontSize:12,color:"#888",marginTop:2}}>📱 {v.clienteTel}</div>}
        <div style={{fontSize:13,color:"#555",margin:"6px 0"}}>{v.items.map((it,i)=><span key={i}>{it.label}{it.piezas>1?` x${it.piezas}`:""}{i<v.items.length-1?" · ":""}</span>)}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
          <div>
            <div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>${v.total.toFixed(2)}</div>
            {!esPag&&<div style={{background:"#c62828",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:800,marginTop:2}}>💸 DEBE ${pend.toFixed(2)}</div>}
            {esPag&&<div style={{background:"#2e7d32",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700,marginTop:2}}>✅ PAGADO</div>}
          </div>
          <div style={{fontSize:12,color:"#888"}}>📅 {fmtD(v.entrega)}</div>
        </div>
        <label style={{...S.chk,fontSize:13,marginTop:8}}>
          <input type="checkbox" checked={v.checkMsgRetiro||false} onChange={()=>toggle("checkMsgRetiro")}/>
          <span>📲 Avisé al cliente</span>
        </label>
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
          {sig&&<button style={{flex:1,padding:"10px",background:sig.bg,color:sig.color,border:`1.5px solid ${sig.color}`,borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={cambiar}>{sig.icon} {sig.label}</button>}
          {!esPag&&<button style={{flex:1,padding:"10px",background:"#e8f5e9",color:"#2e7d32",border:"1.5px solid #2e7d32",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={()=>setShowAb(true)}>💰 Cobrar</button>}
          <button style={{padding:"10px 14px",background:"#f0f4f8",color:"#1a3c5e",border:"none",borderRadius:10,fontSize:12,cursor:"pointer"}} onClick={()=>setTicket(v)}>🧾</button>
        </div>
      </div>
      {showAb&&<AbonoModal venta={v} onSave={ab=>{addAbono(v.folio,ab);setShowAb(false);}} onClose={()=>setShowAb(false)}/>}
      {waListo&&<WhatsAppObligatorio venta={v} tipo="listo" onConfirm={info=>{aplicarEstado("listo",{checkMsgRetiro:info.enviado,msgListo:info});setWaListo(false);}} onCancel={()=>setWaListo(false)}/>}
    </div>
  );
}

function MisIncentivos({ventas,empleadas,sesion,cfgInc}){
  const mesAct=mesK(new Date());
  const {meta,ventaMes,vMes}=calcMetaMes(ventas,mesAct);
  const pct=meta>0?(ventaMes/meta)*100:0;
  const pctBarra=Math.min(100,pct);
  const excedente=Math.max(0,ventaMes-meta);
  const grupoBono=empleadas.filter(e=>e.activa&&e.bonoGrupal);
  const nActivas=Math.max(1,grupoBono.length);
  const cumplida=ventaMes>=meta;
  const bonoMetaTotal=cumplida?meta*((cfgInc.bonoMetaPct||0)/100):0;
  const bonoExcedenteTotal=excedente>0?excedente*((cfgInc.bonoExcedentePct||0)/100):0;
  const miBonoMeta=bonoMetaTotal/nActivas;
  const miBonoExcedente=bonoExcedenteTotal/nActivas;
  // Mis impulsaciones del mes (ventas donde YO impulsé una promo)
  const misVentasConImp=vMes.filter(v=>v.empleadaId===sesion.id&&(v.impulsos||[]).length>0);
  const misImpulsos=misVentasConImp.reduce((a,v)=>a+(v.impulsos||[]).length,0);
  const comisionImpulso=cfgInc.comisionImpulso||0;
  const miGananciaImpulsos=misImpulsos*comisionImpulso;
  const colorBarra=pct>=100?"#4caf50":pct>=70?"#4db6e4":"#f59e0b";
  return(<div style={{padding:"4px 4px 20px"}}>
    <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:14,padding:"18px",marginBottom:14,color:"#fff",boxShadow:"0 4px 16px rgba(26,60,94,.3)"}}>
      <div style={{fontSize:12,fontWeight:600,color:"#a0c4da",textTransform:"uppercase",letterSpacing:0.5}}>🎯 Meta grupal del mes</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:4}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700}}>${ventaMes.toFixed(2)} <span style={{fontSize:14,fontWeight:400,color:"#a0c4da"}}>/ ${meta.toFixed(2)}</span></div>
        <div style={{fontSize:22,fontWeight:800,color:pct>=100?"#a5d6a7":"#81d4fa"}}>{pct.toFixed(0)}%</div>
      </div>
      <div style={{marginTop:10,background:"rgba(255,255,255,.15)",borderRadius:8,height:12,overflow:"hidden"}}>
        <div style={{width:`${pctBarra}%`,height:"100%",background:colorBarra,borderRadius:8,transition:"width .3s"}}/>
      </div>
      {!cumplida&&<div style={{fontSize:12,color:"#a0c4da",marginTop:8}}>Faltan ${(meta-ventaMes).toFixed(2)} para llegar a la meta 💪</div>}
      {cumplida&&excedente===0&&<div style={{fontSize:12,color:"#a5d6a7",marginTop:8}}>¡Meta cumplida! 🎉</div>}
      {excedente>0&&<div style={{fontSize:12,color:"#a5d6a7",marginTop:8}}>¡Superada por ${excedente.toFixed(2)}! 🚀</div>}
    </div>

    <Card title="💰 Mi bono grupal estimado (repartido solo entre Karen y Nicol)">
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:18,color:cumplida?"#2e7d32":"#888"}}>${miBonoMeta.toFixed(2)}</div>
          <div style={{fontSize:11,color:"#888"}}>Por llegar al 100%</div>
        </div>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:18,color:excedente>0?"#2e7d32":"#888"}}>${miBonoExcedente.toFixed(2)}</div>
          <div style={{fontSize:11,color:"#888"}}>Por superar la meta</div>
        </div>
      </div>
      <div style={{fontSize:11,color:"#aaa",marginTop:10,textAlign:"center"}}>Se actualiza en tiempo real según las ventas del mes. Se confirma al cierre de mes.</div>
    </Card>

    <Card title="🎁 Mis impulsaciones de promos este mes">
      <div style={{display:"flex",gap:10,marginBottom:6}}>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:20,color:"#1a3c5e"}}>{misImpulsos}</div>
          <div style={{fontSize:11,color:"#888"}}>Impulsaciones</div>
        </div>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:20,color:"#2e7d32"}}>${miGananciaImpulsos.toFixed(2)}</div>
          <div style={{fontSize:11,color:"#888"}}>Ganado por impulsar</div>
        </div>
      </div>
      <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>${comisionImpulso.toFixed(2)} por cada promo que impulsas y se concreta en una venta 🎯</div>
    </Card>
  </div>);
}

function IncentivosAdmin({cfgInc,setIncentivosArr,upsertIncentivo,ventas,empleadas}){
  const [ed,setEd]=useState({comisionImpulso:cfgInc.comisionImpulso,bonoMetaPct:cfgInc.bonoMetaPct,bonoExcedentePct:cfgInc.bonoExcedentePct});
  const [guardado,setGuardado]=useState(false);
  const guardar=()=>{
    const nuevo={id:"config",comisionImpulso:parseFloat(ed.comisionImpulso)||0,bonoMetaPct:parseFloat(ed.bonoMetaPct)||0,bonoExcedentePct:parseFloat(ed.bonoExcedentePct)||0};
    setIncentivosArr([nuevo]);
    if(upsertIncentivo)upsertIncentivo({...nuevo,_updatedAt:new Date().toISOString()});
    setGuardado(true);setTimeout(()=>setGuardado(false),2000);
  };
  const mesAct=mesK(new Date());
  const {meta,ventaMes}=calcMetaMes(ventas,mesAct);
  const grupoBono=empleadas.filter(e=>e.activa&&e.bonoGrupal);
  const nActivas=Math.max(1,grupoBono.length);
  const bonoMetaTotal=meta*((parseFloat(ed.bonoMetaPct)||0)/100);
  const excedente=Math.max(0,ventaMes-meta);
  const bonoExcedenteTotal=excedente*((parseFloat(ed.bonoExcedentePct)||0)/100);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🎯 Incentivos y bonos</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Esto define lo que ven en su pestaña "📈 Bonos" las colaboradoras con usuario. La meta $ es la misma del Dashboard BI (automática). El bono grupal se reparte solo entre quienes tengan marcado "🎯 Participa en el bono grupal" en la pestaña Equipo.</div>
    <Card title="⚙️ Configuración">
      <div><label style={S.lbl}>Comisión por impulsación concretada ($) — aplica a todas las que facturan</label><input type="number" step="0.01" style={S.inp} value={ed.comisionImpulso} onChange={e=>setEd({...ed,comisionImpulso:e.target.value})}/></div>
      <div style={{marginTop:10}}><label style={S.lbl}>Bono grupal por llegar al 100% de la meta (% de la meta)</label><input type="number" step="0.1" style={S.inp} value={ed.bonoMetaPct} onChange={e=>setEd({...ed,bonoMetaPct:e.target.value})}/></div>
      <div style={{marginTop:10}}><label style={S.lbl}>Bono grupal por superar la meta (% del excedente)</label><input type="number" step="0.1" style={S.inp} value={ed.bonoExcedentePct} onChange={e=>setEd({...ed,bonoExcedentePct:e.target.value})}/></div>
      <button style={{...S.btnP,marginTop:14}} onClick={guardar}>{guardado?"✅ Guardado":"💾 Guardar configuración"}</button>
    </Card>
    <Card title="👀 Vista previa del mes actual">
      <div style={{fontSize:13,marginBottom:6}}>Meta: <strong>${meta.toFixed(2)}</strong> · Ventas: <strong>${ventaMes.toFixed(2)}</strong></div>
      <div style={{fontSize:12,color:"#888",marginBottom:6}}>Reparten el bono grupal: {grupoBono.length?grupoBono.map(e=>e.nombre).join(", "):"nadie marcado todavía — ve a Equipo y marca a Karen y Nicol"}</div>
      <div style={{fontSize:13,marginBottom:6}}>Bono por meta (si se cumple, entre {nActivas}): <strong>${bonoMetaTotal.toFixed(2)}</strong> total → <strong>${(bonoMetaTotal/nActivas).toFixed(2)}</strong> c/u</div>
      <div style={{fontSize:13}}>Bono por excedente actual (${excedente.toFixed(2)} sobre la meta): <strong>${bonoExcedenteTotal.toFixed(2)}</strong> total → <strong>${(bonoExcedenteTotal/nActivas).toFixed(2)}</strong> c/u</div>
    </Card>
  </div>);
}

function PantallaEmpleada({ventas,setVentas,clientes,setClientes,empleadas,servicios,sesion,addAbono,onLogout,cierreListo,onCierreListo,onResetCierre,salidasCaja,setSalidasCaja,upsertVenta,upsertSalida,upsertCliente,upsertCaja,cupones,setCupones,upsertCupon,promos,cfgInc}){
  const hoy=fechaHoyLocal();
  const [tab,setTab]=useState("hoy");const [busq,setBusq]=useState("");
  const [fecha,setFecha]=useState(hoy);const [showNueva,setShowNueva]=useState(false);
  const [showCaja,setShowCaja]=useState(false);const [ticket,setTicket]=useState(null);const [cuponSugE,setCuponSugE]=useState(null);const [showSalidaEmp,setShowSalidaEmp]=useState(false);  const vFecha=ventas.filter(v=>fechaLocal(v.fecha)===fecha&&!v.anulada);
  const vHoy=ventas.filter(v=>fechaLocal(v.fecha)===hoy&&!v.anulada);
  const porCob=ventas.filter(v=>!pagada(v)&&!v.anulada);
  const porEnt=ventas.filter(v=>pagada(v)&&!v.anulada&&(v.estado||"recibido")!=="entregado");
  const lista=tab==="cobrar"?porCob:tab==="entregar"?porEnt:vFecha;
  const filtrados=busq?lista.filter(v=>v.clienteNombre?.toLowerCase().includes(busq.toLowerCase())||v.folio.toLowerCase().includes(busq.toLowerCase())):lista;
  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#f0f4f8",paddingBottom:40}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#4db6e4;border-radius:3px}`}</style>
      <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#fff",fontWeight:700}}>🫧 Lava<span style={{color:"#4db6e4"}}>&</span>Listo</div>
            <div style={{fontSize:12,color:"#a0c4da"}}>Hola, {sesion.nombre} 👋</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowCaja(true)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",cursor:"pointer",fontWeight:600}}>💰 Caja</button>
            <button onClick={()=>setShowSalidaEmp(true)} style={{background:"rgba(220,50,50,.35)",border:"none",borderRadius:8,color:"#ffcccc",fontSize:12,padding:"6px 12px",cursor:"pointer",fontWeight:600}}>💸 Salida</button>
            {cierreListo
              ?<button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",cursor:"pointer"}}>Salir</button>
              :<button onClick={()=>alert("Debes hacer el cierre de caja antes de salir.")} style={{background:"rgba(255,80,80,.3)",border:"none",borderRadius:8,color:"#ffcccc",fontSize:12,padding:"6px 12px",cursor:"not-allowed"}}>🔒 Salir</button>
            }
          </div>
        </div>
      </div>
      <div style={{background:"#fff",display:"flex",borderBottom:"2px solid #e8f0f7",position:"sticky",top:0,zIndex:10}}>
        {[{id:"hoy",l:"📋 Ordenes",c:vHoy.length},{id:"cobrar",l:"💸 Cobrar",c:porCob.length},{id:"entregar",l:"📦 Entregar",c:porEnt.length},{id:"bonos",l:"📈 Bonos"},{id:"nueva",l:"➕ Nueva"}].map(t=>(
          <button key={t.id} style={{flex:1,padding:"12px 4px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:tab===t.id?700:500,color:tab===t.id?"#1a3c5e":"#888",borderBottom:tab===t.id?"2px solid #4db6e4":"none",marginBottom:-2,fontSize:11,position:"relative"}}
            onClick={()=>t.id==="nueva"?setShowNueva(true):setTab(t.id)}>
            {t.l}{t.c>0&&<span style={{position:"absolute",top:5,right:3,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.c}</span>}
          </button>
        ))}
      </div>
      <div style={{padding:12}}>
        {tab!=="bonos"&&(<div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...S.inp,flex:1}} placeholder="🔍 Buscar cliente o folio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
          {tab==="hoy"&&<input type="date" style={{...S.inp,width:140}} value={fecha} onChange={e=>setFecha(e.target.value)}/>}
        </div>)}
        {tab==="hoy"&&(
          <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto"}}>
            {ESTADOS.map(est=>{
              const cnt=vFecha.filter(v=>(v.estado||"recibido")===est.id).length;
              return <div key={est.id} style={{background:est.bg,borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:70,border:`1.5px solid ${est.color}`,flexShrink:0}}>
                <div style={{fontSize:16}}>{est.icon}</div>
                <div style={{fontWeight:800,fontSize:18,color:est.color}}>{cnt}</div>
                <div style={{fontSize:9,color:est.color}}>{est.label}</div>
              </div>;
            })}
          </div>
        )}
        {tab==="bonos"
          ?<MisIncentivos ventas={ventas} empleadas={empleadas} sesion={sesion} cfgInc={cfgInc||INCENTIVOS_DEFAULT[0]}/>
          :filtrados.length===0
            ?<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:48,marginBottom:8}}>{tab==="cobrar"?"🎉":"📋"}</div><div>{tab==="cobrar"?"Todo cobrado":tab==="entregar"?"Todo entregado":"Sin ordenes"}</div></div>
            :filtrados.map(v=><OrdenCard key={v.folio} v={v} setVentas={setVentas} addAbono={addAbono} setTicket={setTicket} upsertVenta={upsertVenta}/>)
        }
      </div>
      {showNueva&&(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:16,width:"96vw",maxWidth:1300,maxHeight:"92vh",overflowY:"auto",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>➕ Nueva Venta</div>
              <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}} onClick={()=>setShowNueva(false)}>✕</button>
            </div>
            <NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={v=>{setShowNueva(false);setTicket(v);}} servicios={servicios} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos}/>
          </div>
        </div>
      )}
      {showCaja&&(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>💰 Caja</div>
              <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}} onClick={()=>setShowCaja(false)}>✕</button>
            </div>
            <CierreCaja ventas={ventas} empleadas={empleadas} onLogout={onLogout} onCierreListo={onCierreListo} onResetCierre={onResetCierre} sesion={sesion} salidasCaja={salidasCaja} setVentas={setVentas} upsertVenta={upsertVenta} upsertCaja={upsertCaja}/>
          </div>
        </div>
      )}
      {ticket&&<TicketModal venta={ticket} empleadas={empleadas} onClose={()=>{setCuponSugE(ticket);setTicket(null);}}/>}
      {cuponSugE&&<CuponSugerido venta={cuponSugE} clientes={clientes} ventas={ventas} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} sesion={sesion} promos={promos} onClose={()=>setCuponSugE(null)}/>}
      {showSalidaEmp&&<SalidaCaja sesion={sesion} salidasCaja={salidasCaja||[]} setSalidasCaja={setSalidasCaja} onClose={()=>setShowSalidaEmp(false)} upsertSalida={upsertSalida}/>}
    </div>
  );
}

// ─── BUSCADOR DE SERVICIOS ─────────────────────────────────────────
function ServicioBuscador({servId,piezas,servicios,onServChange,onPiezasChange}){
  const selSrv=servicios.find(s=>s.id===servId)||servicios[0];
  const [busq,setBusq]=useState("");
  const [open,setOpen]=useState(false);
  const filtrados=busq?servicios.filter(s=>s.label.toLowerCase().includes(busq.toLowerCase())).slice(0,8):servicios.slice(0,8);
  return(
    <div style={{display:"flex",gap:6,alignItems:"flex-start",position:"relative"}}>
      <div style={{flex:1,position:"relative"}}>
        <input
          style={{...S.inp}}
          placeholder="Escribir para buscar servicio..."
          value={open?busq:(selSrv?`${selSrv.label} — $${selSrv.precio.toFixed(2)}`:"")}
          onFocus={()=>{setOpen(true);setBusq("");}}
          onChange={e=>{setBusq(e.target.value);setOpen(true);}}
          onBlur={()=>setTimeout(()=>setOpen(false),200)}
        />
        {open&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid #4db6e4",borderRadius:8,zIndex:50,boxShadow:"0 4px 16px rgba(0,0,0,.15)",maxHeight:220,overflowY:"auto"}}>
            {filtrados.length===0?<div style={{padding:"10px 14px",color:"#aaa",fontSize:13}}>Sin resultados</div>
              :filtrados.map(s=>(
              <div key={s.id} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f0f4f8",fontSize:13,background:s.id===servId?"#e8f5fd":"#fff"}}
                onMouseDown={()=>{onServChange(s.id);setBusq("");setOpen(false);}}>
                <div style={{fontWeight:600}}>{s.label}</div>
                <div style={{color:"#4db6e4",fontWeight:700,fontSize:12}}>${s.precio.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <input type="number" min={1} style={{...S.inp,width:56,textAlign:"center"}} value={piezas} onChange={e=>onPiezasChange(e.target.value)}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 🎁 PROMOS DEL DÍA — EDITA AQUÍ TU LISTA
// dias: null = todos los días · [1]=lunes, [2]=martes, [3]=miércoles,
//       [4]=jueves, [5]=viernes, [6]=sábado, [0]=domingo
// tipo "servicio": al tocarla agrega ese servicio del catálogo (servId)
// tipo "descuento": al tocarla agrega un descuento de $monto a la venta
// ═══════════════════════════════════════════════════════════════════
// Promos de fábrica: se usan solo si el admin aún no ha guardado ninguna en la nube
const DEFAULT_PROMOS=[
  {id:"promo_2zapatos",tipo:"custom",dias:null,activa:true,emoji:"👟",
   titulo:"2 pares de zapatos por $5.99",
   detalle:"Antes $7.00 — ¡ahorra $1.01!",antes:7.00,precio:5.99,
   label:"🎁 PROMO: 2 PARES DE ZAPATOS",claves:["zapato","tenis","calzado","sneaker","pares"]},
  {id:"promo_sabanas",tipo:"custom",dias:null,activa:true,emoji:"🛏️",
   titulo:"2 juegos de sábanas completos por $3.99",
   detalle:"Antes $5.00 · Adicional: ¡elige el perfumado! 🌸",antes:5.00,precio:3.99,
   label:"🎁 PROMO: 2 JUEGOS DE SÁBANAS + PERFUMADO",claves:["sabana"]},
  {id:"promo_edredon",tipo:"descuento",monto:1.00,dias:null,activa:true,emoji:"🫧",
   titulo:"$1 de descuento en cualquier edredón",
   detalle:"Adicional: ¡elige el perfumado! 🌸",
   labelDescuento:"🎁 PROMO: -$1 EN TU EDREDÓN + PERFUMADO",
   minCompra:5.00,claves:["edredon","cobija","cobertor","plumon"]},
];
// Cuántas promos mostrar como máximo en la ventana (las del día van primero)
const PROMOS_MAX=5;
const DOW_LBL=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// La ventana sale al tocar "Registrar venta": último recordatorio antes de cerrar
const promosDeHoy=(promos,servicios)=>{
  const dow=new Date().getDay();
  const resolver=p=>{
    if(p.activa===false)return null;
    if(p.tipo==="descuento")return{...p,precioTxt:`-$${(p.monto||0).toFixed(2)}`};
    if(p.tipo==="custom")return{...p,precioTxt:`$${(p.precio||0).toFixed(2)}`};
    const s=servicios.find(x=>x.id===p.servId&&!x.eliminada);
    if(!s)return null; // si el servicio ya no existe, la promo no se muestra
    return{...p,precioTxt:`$${s.precio.toFixed(2)}`,detalle:p.detalle};
  };
  return (promos&&promos.length?promos:DEFAULT_PROMOS)
    .filter(p=>!p.dias||p.dias.length===0||p.dias.includes(dow))
    .sort((a,b)=>((a.dias&&a.dias.length)?0:1)-((b.dias&&b.dias.length)?0:1)) // primero las exclusivas de hoy
    .map(resolver).filter(Boolean).slice(0,PROMOS_MAX);
};

function PromosDelDia({promos,servicios,onAgregar,onCerrar}){
  const activas=promosDeHoy(promos,servicios);
  if(activas.length===0)return null;
  const nombreDia=new Date().toLocaleDateString("es-EC",{weekday:"long"});
  return(
    <div style={{...S.ov,zIndex:90}}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.35)"}}>
        <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:"18px 18px 0 0",padding:"18px 20px",textAlign:"center"}}>
          <div style={{fontSize:36}}>🎁</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#fff"}}>Promos del día · exclusivas para ti</div>
          <div style={{fontSize:12,color:"#a0c4da",textTransform:"capitalize"}}>{nombreDia} · ¿Le ofreciste las promos al cliente? 💪</div>
        </div>
        <div style={{padding:"14px 16px"}}>
          {activas.map(p=>(
            <button key={p.id} onClick={()=>onAgregar(p)} style={{display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",background:p.dias?"#fff8e1":"#f8fbfd",border:`1.5px solid ${p.dias?"#f59e0b":"#e8f0f7"}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{fontSize:26}}>{p.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1a3c5e"}}>{p.titulo}</div>
                <div style={{fontSize:11,color:"#888"}}>{p.detalle}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {p.antes&&<div style={{fontSize:11,color:"#c62828",textDecoration:"line-through"}}>${p.antes.toFixed(2)}</div>}
                <div style={{fontWeight:800,fontSize:15,color:p.tipo==="descuento"?"#2e7d32":"#1a3c5e"}}>{p.precioTxt}</div>
              </div>
            </button>
          ))}
          <div style={{fontSize:11,color:"#888",textAlign:"center",margin:"4px 0 10px"}}>👆 Toca una promo para sumarla a esta venta antes de cerrarla</div>
          <button style={{...S.btnP,width:"100%"}} onClick={onCerrar}>✓ Registrar venta sin promo</button>
        </div>
      </div>
    </div>
  );
}

function NuevaVenta({ventas,setVentas,clientes,setClientes,empleadas,setTicket,servicios,sesion,upsertVenta,upsertCliente,cupones=[],setCupones,upsertCupon,promos}){
  const man=new Date();man.setDate(man.getDate()+1);
  const [cQ,setCQ]=useState("");const [cId,setCId]=useState(null);
  const [nC,setNC]=useState({nombre:"",tel:"",cedula:"",email:"",rfc:"",direccion:"",nacimiento:""});
  const [mC,setMC]=useState("buscar");
  const empDef=empleadas.find(e=>e.nombre&&sesion?.nombre&&e.nombre.trim().toLowerCase()===sesion.nombre.trim().toLowerCase())
    ||empleadas.find(e=>String(e.id)===String(sesion?.id))
    ||empleadas[0];
  const [empId,setEmpId]=useState(empDef?.id||null);
  const [items,setItems]=useState([{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
  const [entrega,setEntrega]=useState((()=>{const off=man.getTimezoneOffset();const l=new Date(man.getTime()-off*60000);return l.toISOString().split("T")[0];})());
  const [notas,setNotas]=useState("");const [err,setErr]=useState("");
  const [tPago,setTPago]=useState("completo");const [metodo,setMetodo]=useState("Efectivo");const [abono,setAbono]=useState("");
  const [waVenta,setWaVenta]=useState(null);
  const [showPromos,setShowPromos]=useState(false); // 🎁 sale al tocar "Registrar venta"
  const [promoOfrecida,setPromoOfrecida]=useState(false); // ya se ofreció en esta venta
  const [impulsos,setImpulsos]=useState([]); // 🎯 promos impulsadas en esta venta (para métricas por colaboradora)
  const [cupInput,setCupInput]=useState("");const [cupApl,setCupApl]=useState(null);const [cupErr,setCupErr]=useState(""); // 🎟️ cupón
  const [descCumple,setDescCumple]=useState(false); // 🎂 10% cumpleaños
  const cFilt=clientes.filter(c=>c.nombre.toLowerCase().includes(cQ.toLowerCase())||(c.tel&&c.tel.includes(cQ))).slice(0,5);
  const selC=clientes.find(c=>c.id===cId);
  const calcT=()=>items.reduce((a,it)=>{if(it.custom)return a+(parseFloat(it.pC)||0)*(it.piezas||1);const s=servicios.find(s=>s.id===it.servId);return a+(s?s.precio*(it.piezas||1):0);},0);
  const addIt=()=>setItems([...items,{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
  const remIt=i=>setItems(items.filter((_,idx)=>idx!==i));
  const updIt=(i,f,v)=>{const c=[...items];c[i]={...c[i],[f]:v};setItems(c);};
  const validarCupon=()=>{
    const code=cupInput.trim().toUpperCase();
    if(!code){setCupErr("Escribe el número del cupón");return;}
    if(cupApl){setCupErr("Ya hay un cupón aplicado en esta venta (un cupón por venta)");return;}
    const cup=cupones.find(c=>String(c.id).toUpperCase()===code);
    if(!cup){setCupErr("Cupón no encontrado — verifica el número");return;}
    if(cup.estado==="usado"){setCupErr(`Este cupón ya fue canjeado${cup.usadoEn?` en la venta ${cup.usadoEn}`:""} ❌`);return;}
    if(fechaHoyLocal()>cup.caduca){setCupErr(`Cupón caducado el ${fmtD(cup.caduca)} ⌛`);return;}
    const min=cup.minCompra||((cup.promoTipo==="descuento")?CUPON_MIN_COMPRA_DESC:0);
    if(cup.promoTipo==="descuento"&&posActual()<min){setCupErr(`Este cupón aplica en compras desde $${min.toFixed(2)} — agrega primero los servicios 🛒`);return;}
    if(cup.promoTipo==="descuento")setItems(prev=>[...prev,{servId:servicios[0]?.id,piezas:1,custom:true,deCupon:true,lC:`${cup.promoLabel} · ${cup.id}`,pC:String(-Math.abs(cup.promoMonto||1))}]);
    else setItems(prev=>[...prev,{servId:servicios[0]?.id,piezas:1,custom:true,deCupon:true,lC:`${cup.promoLabel} · ${cup.id}`,pC:String(cup.promoPrecio||0)}]);
    setCupApl(cup);setCupErr("");setCupInput("");
  };
  const quitarCupon=()=>{setItems(prev=>{const sinCup=prev.filter(it=>!it.deCupon);return sinCup.length?sinCup:[{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}];});setCupApl(null);setCupErr("");};
  const cerrarPromos=()=>setShowPromos(false);
  const posActual=()=>items.reduce((a,it)=>{const pr=it.custom?(parseFloat(it.pC)||0):(servicios.find(s=>s.id===it.servId)?.precio||0);const sub=pr*(it.piezas||1);return a+(sub>0?sub:0);},0);
  const agregarPromo=p=>{
    if(p.tipo==="descuento"&&posActual()<(p.minCompra||CUPON_MIN_COMPRA_DESC)){
      alert(`El descuento de $${p.monto.toFixed(2)} aplica en compras desde $${(p.minCompra||CUPON_MIN_COMPRA_DESC).toFixed(2)}. Agrega primero los servicios del cliente. 🛒`);
      return;
    }
    setImpulsos(prev=>[...prev,{promoId:p.id,titulo:p.titulo,fecha:new Date().toISOString()}]); // 🎯 impulsación registrada
    if(p.tipo==="descuento"){
      setItems(prev=>[...prev,{servId:servicios[0]?.id,piezas:1,custom:true,lC:p.labelDescuento,pC:String(-Math.abs(p.monto))}]);
    }else if(p.tipo==="custom"){
      setItems(prev=>[...prev,{servId:servicios[0]?.id,piezas:1,custom:true,lC:p.label,pC:String(p.precio)}]);
    }else{
      const s=servicios.find(x=>x.id===p.servId);
      if(s)setItems(prev=>{
        // Si el primer renglón sigue intacto (servicio por defecto, 1 pieza), se reemplaza por la promo
        const intacto=prev.length===1&&!prev[0].custom&&prev[0].servId===servicios[0]?.id&&(prev[0].piezas||1)===1;
        return[...(intacto?[]:prev),{servId:s.id,piezas:1,custom:false,lC:"",pC:""}];
      });
    }
    cerrarPromos();
  };
  const reg=(saltarPromos=false)=>{
    // 🎁 Antes de cerrar la venta: recordar las promos del día (1 vez por venta)
    if(!saltarPromos&&!promoOfrecida&&promosDeHoy(promos,servicios).length>0){
      setPromoOfrecida(true);setShowPromos(true);return;
    }
    if(!cId&&mC==="buscar"){setErr("Selecciona o crea un cliente");return;}
    if(mC==="nuevo"&&!nC.nombre.trim()){setErr("Escribe el nombre del cliente");return;}
    const bruto=calcT();
    const cumpleOk=(mC==="buscar"&&clientes.find(c=>c.id===cId&&esCumpleHoy(c.nacimiento)))||(mC==="nuevo"&&esCumpleHoy(nC.nacimiento));
    const descC=cumpleOk&&descCumple?+(bruto*DESC_CUMPLE).toFixed(2):0;
    const total=+(bruto-descC).toFixed(2);
    if(tPago==="abono"){const m=parseFloat(abono);if(!m||m<=0||m>=total){setErr("El abono debe ser mayor a 0 y menor al total");return;}}
    if(cupApl){ // 🎟️ revalidación final del cupón
      const cup=cupones.find(c=>c.id===cupApl.id);
      if(!cup||cup.estado==="usado"){setErr("El cupón ya no está disponible — quítalo para continuar");return;}
      if(fechaHoyLocal()>cup.caduca){setErr(`El cupón caducó el ${fmtD(cup.caduca)} — quítalo para continuar`);return;}
      const min=cup.minCompra||((cup.promoTipo==="descuento")?CUPON_MIN_COMPRA_DESC:0);
      if(cup.promoTipo==="descuento"&&posActual()<min){setErr(`El cupón aplica en compras desde $${min.toFixed(2)}`);return;}
    }
    let cid=cId,cNom=selC?.nombre,cTel=selC?.tel,cDir=selC?.direccion||"";
    if(mC==="nuevo"){const nc={...nC,id:Date.now()};setClientes(prev=>[...prev,nc]);if(upsertCliente)upsertCliente({...nc,_updatedAt:new Date().toISOString()});cid=nc.id;cNom=nc.nombre;cTel=nc.tel;cDir=nc.direccion||"";}
    let abs=[];
    if(tPago==="completo")abs=[{monto:total,metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    else if(tPago==="abono")abs=[{monto:parseFloat(abono),metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    const v={folio:folio(),fecha:new Date().toISOString(),entrega,clienteId:cid,clienteNombre:cNom,clienteTel:cTel,clienteDireccion:cDir,empleadaId:empId,
      impulsos, // 🎯 quién impulsó qué promos (empleadaId ya viaja en la venta)
      items:[...items.map(it=>{if(it.custom)return{...it,label:it.lC||"Servicio personalizado",precio:parseFloat(it.pC)||0};const s=servicios.find(s=>s.id===it.servId);return{...it,label:s?.label,precio:s?.precio};}),...(descC>0?[{custom:true,piezas:1,label:"🎂 DESCUENTO CUMPLEAÑOS (-10%)",precio:-descC}]:[])],
      pago:metodo,total,abonos:abs,pagada:tPago==="completo",notas,checkMsgRetiro:false,checkMsgEntrega:false,facturadoSRI:false,estado:"recibido",
      cuponId:cupApl?.id||null};
    setVentas([v,...ventas]);if(upsertVenta)upsertVenta(v);
    if(cupApl){ // 🎟️ quemar el cupón: un solo uso, sincronizado en la nube
      const usado={...cupApl,estado:"usado",usadoEn:v.folio,usadoFecha:new Date().toISOString()};
      if(setCupones)setCupones(prev=>prev.map(c=>c.id===cupApl.id?usado:c));
      if(upsertCupon)upsertCupon(usado);
    }
    setWaVenta(v); // WhatsApp obligatorio antes de mostrar el ticket
    setCQ("");setCId(null);setNC({nombre:"",tel:"",cedula:"",email:"",rfc:"",direccion:"",nacimiento:""});setDescCumple(false);setImpulsos([]);setCupApl(null);setCupInput("");setCupErr("");
    setItems([{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
    setNotas("");setErr("");setAbono("");setTPago("completo");
  };
  const confirmarWaRecibido=info=>{
    const v2={...waVenta,msgRecibido:info};
    setVentas(prev=>{const next=prev.map(vv=>vv.folio===waVenta.folio?{...vv,msgRecibido:info}:vv);return next;});
    if(upsertVenta)upsertVenta(v2);
    setWaVenta(null);setTicket(v2);
    setPromoOfrecida(false); // 🎁 la siguiente venta volverá a recordar las promos al guardar
  };
  const clienteCumple=(mC==="buscar"&&selC&&esCumpleHoy(selC.nacimiento))||(mC==="nuevo"&&esCumpleHoy(nC.nacimiento));
  const cuponClienteVig=(mC==="buscar"&&selC)?(cupones||[]).find(c=>String(c.clienteId)===String(selC.id)&&cuponVigente(c)&&(!cupApl||c.id!==cupApl.id)):null;
  const promosHoy=promosDeHoy(promos,servicios);
  const nombreCumple=mC==="buscar"?selC?.nombre:nC.nombre||"el cliente";
  const totalBruto=calcT();
  const descMonto=clienteCumple&&descCumple?+(totalBruto*DESC_CUMPLE).toFixed(2):0;
  const total=+(totalBruto-descMonto).toFixed(2);
  const detItems=items.map(it=>{
    const s=it.custom?null:servicios.find(s=>s.id===it.servId);
    const precio=it.custom?(parseFloat(it.pC)||0):(s?.precio||0);
    return{label:it.custom?(it.lC||"Personalizado"):(s?.label||""),sub:+(precio*(it.piezas||1)).toFixed(2)};
  });
  const valorTotal=+detItems.filter(d=>d.sub>0).reduce((a,d)=>a+d.sub,0).toFixed(2);
  const descPromos=+(-detItems.filter(d=>d.sub<0).reduce((a,d)=>a+d.sub,0)).toFixed(2);
  const descTotal=+(descPromos+descMonto).toFixed(2);
  return(
    <div style={{...S.panel,maxWidth:1500,width:"100%"}}>
      <h2 style={S.ptitle}>Nueva Venta</h2>
      <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
      <div style={{flex:"2 1 380px",minWidth:320}}>
      <Card title="👤 Cliente">
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {["buscar","nuevo"].map(m=><button key={m} style={{...S.pill,...(mC===m?S.pillA:{})}} onClick={()=>setMC(m)}>{m==="buscar"?"Buscar":"Nuevo cliente"}</button>)}
        </div>
        {mC==="buscar"?(
          <div>
            <input style={S.inp} placeholder="Nombre o telefono..." value={cQ} onChange={e=>{setCQ(e.target.value);setCId(null);}}/>
            {cQ&&cFilt.length>0&&!cId&&<div style={S.drop}>{cFilt.map(c=><div key={c.id} style={S.dropI} onClick={()=>{setCId(c.id);setCQ(c.nombre);}}><strong>{c.nombre}</strong> <span style={{color:"#888",fontSize:12}}>{c.tel}</span></div>)}</div>}
            {cId&&selC&&<div style={S.ctag}>✓ {selC.nombre}{selC.tel?` · ${selC.tel}`:""}<button style={{background:"none",border:"none",color:"#2e7d32",cursor:"pointer",fontWeight:700}} onClick={()=>{setCId(null);setCQ("");}}>✕</button></div>}
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["nombre","Nombre *"],["tel","Telefono"],["cedula","Cedula"],["email","Email"],["rfc","RUC/RFC"]].map(([k,l])=><input key={k} style={S.inp} placeholder={l} value={nC[k]||""} onChange={e=>setNC({...nC,[k]:e.target.value})}/>)}
            <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="📍 Direccion" value={nC.direccion} onChange={e=>setNC({...nC,direccion:e.target.value})}/>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>🎂 Fecha de nacimiento (opcional)</label><input type="date" style={S.inp} value={nC.nacimiento} onChange={e=>setNC({...nC,nacimiento:e.target.value})}/></div>
          </div>
        )}
        {clienteCumple&&(
          <div style={{background:"linear-gradient(135deg,#fff8e1,#ffecb3)",border:"2px solid #f59e0b",borderRadius:12,padding:"12px 14px",marginTop:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:28}}>🎂</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:"#b45309",fontSize:14}}>¡Hoy es el cumpleaños de {nombreCumple}!</div>
                <div style={{fontSize:12,color:"#92600a"}}>Felicítale y aplícale su 10% de descuento 🎉</div>
              </div>
              {descCumple
                ?<div style={{...S.badge,background:"#e8f5e9",color:"#2e7d32",fontSize:12}}>✓ 10% aplicado</div>
                :<button style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setDescCumple(true)}>🎁 Aplicar 10%</button>}
            </div>
          </div>
        )}
      </Card>
      <Card title="🧺 Servicios">
        {items.map((it,i)=>(
          <div key={i} style={{marginBottom:10,background:"#f8fbfd",borderRadius:8,padding:10,border:"1px solid #e8f0f7"}}>
            <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.custom?{}:S.pillA)}} onClick={()=>updIt(i,"custom",false)}>Del menu</button>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.custom?S.pillA:{})}} onClick={()=>updIt(i,"custom",true)}>Personalizado</button>
              {items.length>1&&<button style={{...S.btnR,marginLeft:"auto"}} onClick={()=>remIt(i)}>✕</button>}
            </div>
            {it.custom?(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
                <input style={S.inp} placeholder="Nombre del servicio" value={it.lC} onChange={e=>updIt(i,"lC",e.target.value)}/>
                <input type="number" style={{...S.inp,width:80}} placeholder="$Precio" value={it.pC} onChange={e=>updIt(i,"pC",e.target.value)}/>
                <input type="number" min={1} style={{...S.inp,width:56,textAlign:"center"}} value={it.piezas} onChange={e=>updIt(i,"piezas",parseInt(e.target.value)||1)}/>
              </div>
            ):(
              <ServicioBuscador servId={it.servId} piezas={it.piezas} servicios={servicios} onServChange={v=>updIt(i,"servId",v)} onPiezasChange={v=>updIt(i,"piezas",parseInt(v)||1)}/>
            )}
          </div>
        ))}
        <button style={{background:"#e8f5fd",color:"#1a7dbf",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}} onClick={addIt}>+ Agregar servicio</button>
        <div style={S.total}>
          {descMonto>0&&<div style={{fontSize:12,color:"#888"}}>Subtotal: ${totalBruto.toFixed(2)} · <span style={{color:"#b45309",fontWeight:700}}>🎂 -10%: -${descMonto.toFixed(2)}</span></div>}
          Total: <strong>${total.toFixed(2)}</strong>
          {items.some(it=>{const lbl=it.custom?it.lC:(servicios.find(s=>s.id===it.servId)?.label||"");return esLavadoSeco(lbl);})&&
            <div style={{fontSize:11,color:"#ff9800",marginTop:4}}>🧺 Incluye lavado en seco — solo cuenta el 20% como ganancia</div>
          }
        </div>
      </Card>
      <Card title="💳 Pago">
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[{id:"completo",l:"✅ Pago completo"},{id:"abono",l:"💵 Abono"},{id:"retiro",l:"⏳ Paga al retirar"}].map(op=>(
            <button key={op.id} style={{...S.pill,...(tPago===op.id?S.pillA:{})}} onClick={()=>setTPago(op.id)}>{op.l}</button>
          ))}
        </div>
        {tPago!=="retiro"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.lbl}>Metodo</label><select style={S.inp} value={metodo} onChange={e=>setMetodo(e.target.value)}>{PAGOS.map(p=><option key={p}>{p}</option>)}</select></div>
            {tPago==="abono"&&<div><label style={S.lbl}>Monto abono</label><input type="number" style={S.inp} placeholder={`Max $${total.toFixed(2)}`} value={abono} onChange={e=>setAbono(e.target.value)}/></div>}
          </div>
        )}
        <div style={{marginTop:12,background:"#f8fbfd",border:"1.5px dashed #4db6e4",borderRadius:10,padding:"10px 12px"}}>
          <label style={S.lbl}>🎟️ ¿El cliente tiene cupón?</label>
          {cupApl?(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <div>
                <div style={{fontWeight:800,color:"#00a887",fontSize:14}}>✓ {cupApl.id} aplicado</div>
                <div style={{fontSize:11,color:"#888"}}>{cupApl.promoEmoji} {cupApl.promoTitulo}</div>
              </div>
              <button style={S.btnR} onClick={quitarCupon}>Quitar</button>
            </div>
          ):(
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <input style={{...S.inp,textTransform:"uppercase",letterSpacing:1,flex:1}} placeholder="LL-XXXX" value={cupInput} onChange={e=>{setCupInput(e.target.value.toUpperCase());setCupErr("");}} onKeyDown={e=>{if(e.key==="Enter")validarCupon();}}/>
              <button style={S.btnS} onClick={validarCupon}>✓ Validar</button>
            </div>
          )}
          {cupErr&&<div style={{fontSize:12,color:"#c62828",fontWeight:600,marginTop:5}}>{cupErr}</div>}
        </div>
        <div style={{marginTop:10}}><label style={S.lbl}>Fecha de entrega</label><input type="date" style={S.inp} value={entrega} onChange={e=>setEntrega(e.target.value)}/></div>
        <div style={{marginTop:8}}><label style={S.lbl}>Empleada</label>
          <select style={S.inp} value={empId} onChange={e=>setEmpId(parseInt(e.target.value))}>
            {empleadas.filter(e=>e.activa).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div style={{marginTop:8}}><label style={S.lbl}>Notas</label><textarea style={{...S.inp,minHeight:56,resize:"vertical"}} placeholder="Instrucciones..." value={notas} onChange={e=>setNotas(e.target.value)}/></div>
      </Card>
      </div>
      <div style={{flex:"1 1 300px",minWidth:290,maxWidth:360}}>
      <div style={{position:"sticky",top:12}}>
        {/* 🔔 Caja de recordatorios: junto a los datos del cliente, arriba del resumen */}
        <div style={{background:"#E6FFFA",borderRadius:14,padding:"14px 16px",boxShadow:"0 4px 14px rgba(0,0,0,.08)",border:"1.5px solid #00E5B8"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#00695C",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🔔 Recordatorios para el cliente</div>
          {clienteCumple&&!descCumple&&(
            <div style={{background:"#fff",borderRadius:8,padding:"9px 11px",fontSize:13,marginBottom:7,color:"#00695C",fontWeight:600}}>🎂 <strong>{nombreCumple}</strong> cumple hoy — ¡ofrécele el 10% de descuento!</div>
          )}
          {cuponClienteVig&&(
            <div style={{background:"#fff",borderRadius:8,padding:"9px 11px",fontSize:13,marginBottom:7,color:"#00695C",fontWeight:600}}>🎟️ Tiene el cupón <strong>{cuponClienteVig.id}</strong> vigente (vence {fmtD(cuponClienteVig.caduca)}) — recuérdaselo</div>
          )}
          {promosHoy.length>0&&(<>
            <div style={{fontSize:11,fontWeight:700,color:"#00695C",textTransform:"uppercase",letterSpacing:0.5,margin:"4px 0 6px"}}>🎁 Promos que puedes ofrecer hoy</div>
            {promosHoy.map(p=>(
              <div key={p.id} style={{background:"#fff",borderRadius:8,padding:"9px 11px",fontSize:13,color:"#00695C",marginBottom:6}}>
                <div style={{fontWeight:700}}>{p.emoji} {p.titulo}</div>
                {p.detalle&&<div style={{fontSize:11,color:"#4a9c92",marginTop:1}}>{p.detalle}</div>}
              </div>
            ))}
          </>)}
          {!(clienteCumple&&!descCumple)&&!cuponClienteVig&&promosHoy.length===0&&(
            <div style={{fontSize:12,color:"#999"}}>Sin recordatorios activos por ahora.</div>
          )}
        </div>

        <div style={{marginTop:12,background:"linear-gradient(160deg,#1a3c5e,#2563a8)",borderRadius:16,padding:"18px",color:"#fff",boxShadow:"0 6px 20px rgba(26,60,94,.35)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#a0c4da",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>🫧 Resumen de pago</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:6}}>
            <span style={{color:"#cfe3f2"}}>Valor total</span><strong>${valorTotal.toFixed(2)}</strong>
          </div>
          {detItems.filter(d=>d.sub<0).map((d,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#00E5B8",marginBottom:3}}>
              <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6}}>{d.label}</span><span>-${Math.abs(d.sub).toFixed(2)}</span>
            </div>
          ))}
          {descMonto>0&&(
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#00E5B8",marginBottom:3}}>
              <span>🎂 Cumpleaños (-10%)</span><span>-${descMonto.toFixed(2)}</span>
            </div>
          )}
          {cupApl&&(
            <div style={{background:"rgba(0,229,184,.15)",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#00E5B8",fontWeight:700,marginBottom:6}}>
              🎟️ Cupón {cupApl.id} aplicado
            </div>
          )}
          {descTotal>0&&(
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,color:"#00E5B8",borderTop:"1px dashed rgba(255,255,255,.25)",marginTop:6,paddingTop:6}}>
              <span>Descuento Lava&Listo</span><span>-${descTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{borderTop:"2px solid rgba(255,255,255,.3)",marginTop:10,paddingTop:10}}>
            <div style={{fontSize:12,color:"#a0c4da"}}>Valor a pagar</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:800,color:"#4DD9E8"}}>${total.toFixed(2)}</div>
          </div>
          {tPago==="abono"&&(parseFloat(abono)||0)>0&&(
            <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",marginTop:8,fontSize:12}}>
              💵 Abona hoy: <strong>${(parseFloat(abono)||0).toFixed(2)}</strong> · Saldo: <strong>${Math.max(0,total-(parseFloat(abono)||0)).toFixed(2)}</strong>
            </div>
          )}
          {tPago==="retiro"&&<div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",marginTop:8,fontSize:12}}>⏳ Paga al retirar: <strong>${total.toFixed(2)}</strong></div>}

        </div>
        {err&&<div style={{background:"#ffebee",color:"#c62828",borderRadius:8,padding:"10px 12px",marginTop:12,fontSize:12,fontWeight:600}}>{err}</div>}
        <button style={{...S.btnP,width:"100%",marginTop:12}} onClick={()=>reg()}>🧾 Registrar Venta</button>
      </div>
      </div>
      </div>
      {showPromos&&!waVenta&&<PromosDelDia promos={promos} servicios={servicios} onAgregar={agregarPromo} onCerrar={()=>{setShowPromos(false);reg(true);}}/>}
      {waVenta&&<WhatsAppObligatorio venta={waVenta} tipo="recibido" onConfirm={confirmarWaRecibido}/>}
    </div>
  );
}

function VentaCardItem({v,empleadas,setTicket,addAbono,setVentas,esAdmin,upsertVenta}){
  const [showAb,setShowAb]=useState(false);
  const [waListo,setWaListo]=useState(false);
  const emp=empleadas.find(e=>e.id===v.empleadaId);
  const pend=saldo(v);const esPag=pagada(v);
  const abs=v.abonos||[];const totAb=abs.reduce((a,ab)=>a+ab.monto,0);
  const est=getEst(v);
  const toggle=f=>setVentas&&setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,[f]:!vv[f]}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const aplicarEstado=(nv,extra={})=>setVentas&&setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,estado:nv,...extra}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const cambEst=nv=>{
    if(nv==="listo"&&(v.estado||"recibido")!=="listo"){setWaListo(true);return;} // WhatsApp obligatorio
    aplicarEstado(nv);
  };
  return(
    <>
      <div style={{...S.vcard,borderLeft:`4px solid ${v.anulada?"#9e9e9e":esPag?"#4caf50":"#ff9800"}`,opacity:v.anulada?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontWeight:700,color:"#1a3c5e"}}>{esAdmin?v.clienteNombre:v.folio}</div>
            <div style={{fontSize:11,color:"#888"}}>{v.folio} · {fmt(v.fecha)}</div>
            {emp&&<div style={{fontSize:11,color:"#4db6e4"}}>👩 {emp.nombre}</div>}
            <div style={{...S.badge,background:est.bg,color:est.color,marginTop:4}}>{est.icon} {est.label}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:16,color:"#1a3c5e"}}>${v.total.toFixed(2)}</div>
            <div style={{...S.badge,background:esPag?"#e8f5e9":"#fff3e0",color:esPag?"#2e7d32":"#e65100"}}>{esPag?"✅ Pagado":`⏳ $${pend.toFixed(2)}`}</div>
          </div>
        </div>
        <div style={{fontSize:12,color:"#555",marginTop:6}}>{v.items.map((it,i)=><span key={i}>{it.label}{it.piezas>1?` x${it.piezas}`:""}{esLavadoSeco(it.label)&&<span style={{color:"#ff9800",fontSize:10}}> (20%)</span>}{i<v.items.length-1?" · ":""}</span>)}</div>
        <div style={{fontSize:12,color:"#555",marginTop:2}}>📅 {fmtD(v.entrega)}</div>
        {v.anulada&&<div style={{background:"#ffebee",borderRadius:6,padding:"6px 10px",marginTop:6,fontSize:12,color:"#c62828"}}>❌ ANULADA — {v.motivoAnulacion}</div>}
        {abs.length>0&&<div style={{marginTop:8,background:"#f0faf4",borderRadius:8,padding:"8px 10px"}}>
          {abs.map((ab,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#2e7d32"}}><span>{ab.metodo} · {fmtD(ab.fecha)}{ab.cobradoPorNombre?` · ${ab.cobradoPorNombre}`:""}</span><strong>+${ab.monto.toFixed(2)}</strong></div>)}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,borderTop:"1px dashed #c8e6c9",marginTop:4,paddingTop:4}}><span style={{color:"#888"}}>Pagado</span><span style={{color:"#2e7d32",fontWeight:700}}>${totAb.toFixed(2)} / ${v.total.toFixed(2)}</span></div>
        </div>}
        {esAdmin&&setVentas&&<div style={{marginTop:8}}>
          <label style={S.lbl}>Estado:</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
            {ESTADOS.map(e=><button key={e.id} style={{...S.pill,fontSize:11,padding:"4px 8px",...((v.estado||"recibido")===e.id?{background:e.bg,color:e.color,border:`1.5px solid ${e.color}`}:{})}} onClick={()=>cambEst(e.id)}>{e.icon} {e.label}</button>)}
          </div>
        </div>}
        {setVentas&&esAdmin&&<div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          <label style={S.chk}><input type="checkbox" checked={v.checkMsgRetiro||false} onChange={()=>toggle("checkMsgRetiro")}/><span>📲 Msg retiro</span></label>
          <label style={S.chk}><input type="checkbox" checked={v.checkMsgEntrega||false} onChange={()=>toggle("checkMsgEntrega")}/><span>✅ Entregado</span></label>
          <label style={{...S.chk,color:v.facturadoSRI?"#2e7d32":"#555"}}><input type="checkbox" checked={v.facturadoSRI||false} onChange={()=>toggle("facturadoSRI")}/><span>🧾 SRI</span></label>
        </div>}
        <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
          <button style={S.btnT} onClick={()=>setTicket(v)}>🧾 Ticket</button>
          {!esPag&&!v.anulada&&<button style={{...S.btnT,background:"#fff3e0",color:"#e65100"}} onClick={()=>setShowAb(true)}>💰 Pago</button>}
          {!v.anulada&&esAdmin&&setVentas&&<button style={{...S.btnT,background:"#ffebee",color:"#c62828"}} onClick={()=>{const m=window.prompt("Motivo de anulacion:");if(m===null)return;setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,anulada:true,motivoAnulacion:m}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});}}>❌ Anular</button>}
        </div>
      </div>
      {showAb&&<AbonoModal venta={v} onSave={ab=>{addAbono(v.folio,ab);setShowAb(false);}} onClose={()=>setShowAb(false)}/>}
      {waListo&&<WhatsAppObligatorio venta={v} tipo="listo" onConfirm={info=>{aplicarEstado("listo",{checkMsgRetiro:info.enviado,msgListo:info});setWaListo(false);}} onCancel={()=>setWaListo(false)}/>}
    </>
  );
}

function Historial({ventas,setVentas,empleadas,setTicket,addAbono,esAdmin,upsertVenta}){
  const [fP,setFP]=useState("Todos");const [fE,setFE]=useState("Todos");
  const [fEmp,setFEmp]=useState("Todos");const [fF,setFF]=useState("");const [busq,setBusq]=useState("");
  const filtered=ventas.filter(v=>{
    if(fP!=="Todos"){const m=(v.abonos||[]).map(a=>a.metodo);const ok=m.some(x=>x===fP||esTr(x)&&fP==="Transferencia");if(!ok&&v.pago!==fP)return false;}
    if(fE==="Pagadas"&&!pagada(v))return false;
    if(fE==="Pendientes"&&pagada(v))return false;
    if(fEmp!=="Todos"&&String(v.empleadaId)!==fEmp)return false;
    if(fF&&!fechaLocal(v.fecha).startsWith(fF))return false;
    if(busq&&!v.clienteNombre?.toLowerCase().includes(busq.toLowerCase())&&!v.folio.toLowerCase().includes(busq.toLowerCase()))return false;
    return true;
  });
  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>Historial</h2>
      <Card title="🔍 Filtros">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input style={S.inp} placeholder="Buscar..." value={busq} onChange={e=>setBusq(e.target.value)}/>
          <input type="month" style={S.inp} value={fF} onChange={e=>setFF(e.target.value)}/>
          <select style={S.inp} value={fP} onChange={e=>setFP(e.target.value)}><option>Todos</option>{PAGOS.map(p=><option key={p}>{p}</option>)}</select>
          <select style={S.inp} value={fE} onChange={e=>setFE(e.target.value)}><option>Todos</option><option>Pagadas</option><option>Pendientes</option></select>
          {esAdmin&&<select style={{...S.inp,gridColumn:"1/-1"}} value={fEmp} onChange={e=>setFEmp(e.target.value)}><option value="Todos">Todas las empleadas</option>{empleadas.map(e=><option key={e.id} value={String(e.id)}>{e.nombre}</option>)}</select>}
        </div>
      </Card>
      <div style={{fontSize:12,color:"#888",marginBottom:8}}>{filtered.length} ventas — Total: ${filtered.reduce((a,v)=>a+v.total,0).toFixed(2)}</div>
      {filtered.length===0?<div style={S.empty}>Sin resultados</div>:filtered.map(v=><VentaCardItem key={v.folio} v={v} empleadas={empleadas} setTicket={setTicket} addAbono={addAbono} setVentas={setVentas} esAdmin={esAdmin} upsertVenta={upsertVenta}/>)}
    </div>
  );
}

function PendienteItem({v,empleadas,setTicket,addAbono,setVentas,upsertVenta}){
  const [showAb,setShowAb]=useState(false);
  const emp=empleadas.find(e=>e.id===v.empleadaId);
  const pend=saldo(v);const esPag=pagada(v);
  const abs=v.abonos||[];const totAb=abs.reduce((a,ab)=>a+ab.monto,0);
  const est=getEst(v);
  const toggle=f=>setVentas&&setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,[f]:!vv[f]}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  return(
    <div>
      <div style={{...S.vcard,borderLeft:`4px solid ${esPag?"#ff9800":"#e53935"}`}}>
        <div style={{display:"flex",gap:6,marginBottom:6}}>
          {!esPag&&<div style={{background:"#c62828",color:"#fff",padding:"4px 12px",borderRadius:8,fontWeight:800,fontSize:13,display:"inline-block"}}>💸 PENDIENTE DE COBRO — ${saldo(v).toFixed(2)}</div>}
          {esPag&&(v.estado||"recibido")!=="entregado"&&<div style={{background:"#e65100",color:"#fff",padding:"4px 12px",borderRadius:8,fontWeight:800,fontSize:13,display:"inline-block"}}>📦 PENDIENTE DE RETIRO</div>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <div>
            <div style={{fontWeight:700,color:"#1a3c5e",fontSize:15}}>{v.clienteNombre}</div>
            <div style={{fontSize:11,color:"#888"}}>{v.folio} · {fmt(v.fecha)}</div>
            {emp&&<div style={{fontSize:11,color:"#4db6e4"}}>👩 {emp.nombre}</div>}
            <div style={{fontSize:12,color:"#555",marginTop:4}}>{v.items.map((it,i)=><span key={i}>{it.label}{i<v.items.length-1?" · ":""}</span>)}</div>
            <div style={{fontSize:12,color:"#555"}}>📅 {fmtD(v.entrega)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>${v.total.toFixed(2)}</div>
            {!esPag&&<div style={{fontSize:13,color:"#e53935",fontWeight:700}}>Debe: ${pend.toFixed(2)}</div>}
            {totAb>0&&<div style={{fontSize:11,color:"#2e7d32"}}>Abonado: ${totAb.toFixed(2)}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          <label style={S.chk}><input type="checkbox" checked={v.checkMsgRetiro||false} onChange={()=>toggle("checkMsgRetiro")}/><span>📲 Avisé</span></label>
          <label style={S.chk}><input type="checkbox" checked={v.checkMsgEntrega||false} onChange={()=>toggle("checkMsgEntrega")}/><span>✅ Entregado</span></label>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8}}>
          <button style={S.btnT} onClick={()=>setTicket(v)}>🧾 Ticket</button>
          {!esPag&&<button style={{...S.btnT,background:"#e8f5e9",color:"#2e7d32",fontWeight:700}} onClick={()=>setShowAb(true)}>💰 Cobrar</button>}
        </div>
      </div>
      {showAb&&<AbonoModal venta={v} onSave={ab=>{addAbono(v.folio,ab);setShowAb(false);}} onClose={()=>setShowAb(false)}/>}
    </div>
  );
}

function Pendientes({ventas,empleadas,setTicket,addAbono,setVentas,upsertVenta}){
  const [filtro,setFiltro]=useState("todos");const [busq,setBusq]=useState("");
  const porCob=ventas.filter(v=>!pagada(v)&&!v.anulada);
  const porEnt=ventas.filter(v=>pagada(v)&&!v.anulada&&(v.estado||"recibido")!=="entregado");
  const lista=filtro==="cobrar"?porCob:filtro==="entregar"?porEnt:[...porCob,...porEnt];
  const dedup=lista.filter((v,i,a)=>a.findIndex(x=>x.folio===v.folio)===i);
  const filtrados=busq?dedup.filter(v=>v.clienteNombre?.toLowerCase().includes(busq.toLowerCase())||v.folio.toLowerCase().includes(busq.toLowerCase())):dedup;
  const totCob=porCob.reduce((a,v)=>a+saldo(v),0);
  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>⏳ Pendientes</h2>
      <div style={S.kgrid}>
        <div style={{background:"#c62828",borderRadius:12,padding:"14px",display:"flex",gap:12,alignItems:"center",cursor:"pointer",boxShadow:"0 2px 8px rgba(198,40,40,.3)"}} onClick={()=>setFiltro("cobrar")}>
          <div style={{fontSize:28}}>💸</div><div><div style={{fontWeight:800,fontSize:22,color:"#fff"}}>${totCob.toFixed(2)}</div><div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.9)"}}>PENDIENTE DE COBRO</div><div style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>{porCob.length} ordenes</div></div>
        </div>
        <div style={{background:"#e65100",borderRadius:12,padding:"14px",display:"flex",gap:12,alignItems:"center",cursor:"pointer",boxShadow:"0 2px 8px rgba(230,81,0,.3)"}} onClick={()=>setFiltro("entregar")}>
          <div style={{fontSize:28}}>📦</div><div><div style={{fontWeight:800,fontSize:22,color:"#fff"}}>{porEnt.length}</div><div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.9)"}}>PENDIENTE RETIRO</div><div style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>Por entregar</div></div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[{id:"todos",l:"📋 Todos"},{id:"cobrar",l:"💸 Cobro"},{id:"entregar",l:"📦 Retiro"}].map(f=><button key={f.id} style={{...S.pill,...(filtro===f.id?S.pillA:{}),fontSize:12}} onClick={()=>setFiltro(f.id)}>{f.l}</button>)}
      </div>
      <input style={{...S.inp,marginBottom:12}} placeholder="🔍 Buscar cliente o folio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
      {filtrados.length===0?<div style={{textAlign:"center",padding:"30px",color:"#aaa"}}><div style={{fontSize:36}}>🎉</div><div>Sin pendientes</div></div>
        :filtrados.map(v=><PendienteItem key={v.folio} v={v} empleadas={empleadas} setTicket={setTicket} addAbono={addAbono} setVentas={setVentas} upsertVenta={upsertVenta}/>)}
    </div>
  );
}

function Reportes({ventas,empleadas,salidasCaja}){
  const hoy=fechaHoyLocal();
  const sem=semISO(new Date());const mes=mesK(new Date());
  const [mesS,setMesS]=useState(mes);const [sub,setSub]=useState("resumen");
  const [desde,setDesde]=useState(mes+"-01");const [hasta,setHasta]=useState(hoy);
  const vHoy=ventas.filter(v=>fechaLocal(v.fecha)===hoy&&!v.anulada);
  const vSem=ventas.filter(v=>semISO(v.fecha)===sem&&!v.anulada);
  const vMes=ventas.filter(v=>mesK(v.fecha)===mesS&&!v.anulada);
  const vRng=ventas.filter(v=>!v.anulada&&fechaLocal(v.fecha)>=desde&&fechaLocal(v.fecha)<=hasta);
  const sum=a=>a.reduce((x,v)=>x+v.total,0);
  const cob=a=>a.reduce((x,v)=>x+(v.abonos||[]).reduce((y,ab)=>y+ab.monto,0),0);
  const pend=a=>a.reduce((x,v)=>x+saldo(v),0);
  const efC=vMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo==="Efectivo")).reduce((a,ab)=>a+ab.monto,0);
  const picC=vMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo==="Transferencia Pichincha")).reduce((a,ab)=>a+ab.monto,0);
  const jepC=vMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo==="Transferencia JEP")).reduce((a,ab)=>a+ab.monto,0);
  const tarC=vMes.flatMap(v=>(v.abonos||[]).filter(a=>a.metodo==="Tarjeta")).reduce((a,ab)=>a+ab.monto,0);
  const totCob=efC+picC+jepC+tarC;const pendMes=pend(vMes);const totV=sum(vMes);
  const cuadre=Math.abs(totV-(totCob+pendMes))<0.01;
  const xMes=(()=>{const m={};ventas.filter(v=>!v.anulada).forEach(v=>{const k=mesK(v.fecha);m[k]=(m[k]||0)+v.total;});return Object.entries(m).sort().slice(-6).map(([k,v])=>({l:k.slice(5)+"/"+k.slice(0,4),v}));})();
  const eStats=empleadas.map(e=>{const mv=ventas.filter(v=>v.empleadaId===e.id&&mesK(v.fecha)===mesS&&!v.anulada);return{...e,cnt:mv.length,tot:mv.reduce((a,v)=>a+v.total,0)};}).sort((a,b)=>b.cnt-a.cnt);
  const KPI=({icon,label,val,sub,color})=>(<div style={{...S.kpi,borderLeft:`4px solid ${color}`}}><div style={{fontSize:22}}>{icon}</div><div><div style={{fontWeight:800,fontSize:18,color}}>{val}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"#888"}}>{sub}</div>}</div></div>);
  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>📊 Reportes</h2>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[{id:"resumen",l:"📈 Resumen"},{id:"depositos",l:"💵 Depositos"},{id:"salidas",l:"💸 Salidas"},{id:"cuadre",l:"🧮 Cuadre"},{id:"ventas",l:"📋 Ventas"},{id:"excel",l:"📥 Excel"}].map(t=>(
          <button key={t.id} style={{...S.pill,...(sub===t.id?S.pillA:{}),fontSize:12}} onClick={()=>setSub(t.id)}>{t.l}</button>
        ))}
      </div>
      <div style={{marginBottom:12}}><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={mesS} onChange={e=>setMesS(e.target.value)}/></div>
      {sub==="resumen"&&(<div>
        <div style={S.kgrid}>
          <KPI icon="☀️" label="Hoy" val={`$${sum(vHoy).toFixed(2)}`} sub={`${vHoy.length} ventas`} color="#f59e0b"/>
          <KPI icon="📅" label="Esta semana" val={`$${sum(vSem).toFixed(2)}`} sub={`${vSem.length} ventas`} color="#4db6e4"/>
          <KPI icon="💚" label="Cobrado mes" val={`$${totCob.toFixed(2)}`} sub="Pagos recibidos" color="#4caf50"/>
          <KPI icon="⏳" label="Por cobrar" val={`$${pendMes.toFixed(2)}`} sub="Pendiente" color="#e53935"/>
        </div>
        <Card title="📈 Ventas por mes">
          {xMes.map(m=>{const max=Math.max(...xMes.map(x=>x.v),1);return(<div key={m.l} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}><span>{m.l}</span><strong>${m.v.toFixed(2)}</strong></div>
            <div style={{background:"#e8f0f7",borderRadius:4,height:10}}><div style={{background:"#1a3c5e",width:`${(m.v/max)*100}%`,height:"100%",borderRadius:4}}/></div>
          </div>);})}
        </Card>
        <Card title="🏆 Ranking">
          {eStats.map((e,i)=>{const meta=e.metaVentas||20;const pct=Math.min(100,(e.cnt/meta)*100);return(<div key={e.id} style={{padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"👤"}</div>
              <div style={{flex:1}}><div style={{fontWeight:600}}>{e.nombre}</div><div style={{fontSize:12,color:"#888"}}>{e.cnt} ventas · ${e.tot.toFixed(2)}</div></div>
              {e.cnt>=meta&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 Bono</div>}
            </div>
            <div style={{background:"#e8f0f7",borderRadius:6,height:6,marginTop:6}}><div style={{background:e.cnt>=meta?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
          </div>);})}
        </Card>
      </div>)}
      {sub==="depositos"&&(<div>
        <Card title="💵 Resumen de depositos por dia">
          <p style={{fontSize:13,color:"#555",marginBottom:12}}>Efectivo cobrado cada dia — esto es lo que debes depositar al banco.</p>
          {(()=>{
            const dias={};
            ventas.filter(v=>!v.anulada).forEach(v=>{
              (v.abonos||[]).forEach(ab=>{
                const d=fechaLocal(ab.fecha);
                if(!dias[d])dias[d]={efectivo:0,pichincha:0,jep:0,tarjeta:0,total:0};
                if(ab.metodo==="Efectivo")dias[d].efectivo+=ab.monto;
                else if(ab.metodo==="Transferencia Pichincha")dias[d].pichincha+=ab.monto;
                else if(ab.metodo==="Transferencia JEP")dias[d].jep+=ab.monto;
                else if(ab.metodo==="Tarjeta")dias[d].tarjeta+=ab.monto;
                dias[d].total+=ab.monto;
              });
            });
            const sorted=Object.entries(dias).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
            if(sorted.length===0)return <div style={{color:"#aaa",textAlign:"center",padding:20}}>Sin datos aun</div>;
            return sorted.map(([fecha,d])=>(
              <div key={fecha} style={{borderBottom:"1px solid #f0f4f8",padding:"10px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:700,color:"#1a3c5e",fontSize:15}}>{new Date(fecha+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}</div>
                    <div style={{fontSize:11,color:"#888"}}>{fecha}</div>
                  </div>
                  <div style={{background:"#1a3c5e",color:"#fff",padding:"4px 14px",borderRadius:8,fontWeight:800,fontSize:15}}>${d.total.toFixed(2)}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {d.efectivo>0&&<div style={{background:"#e8f5e9",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#2e7d32",fontWeight:600}}>💵 Depositar banco</span><strong style={{color:"#2e7d32"}}>${d.efectivo.toFixed(2)}</strong></div>}
                  {d.pichincha>0&&<div style={{background:"#e3f2fd",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#1565c0",fontWeight:600}}>🏦 Pichincha</span><strong style={{color:"#1565c0"}}>${d.pichincha.toFixed(2)}</strong></div>}
                  {d.jep>0&&<div style={{background:"#e3f2fd",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#1565c0",fontWeight:600}}>🏦 JEP</span><strong style={{color:"#1565c0"}}>${d.jep.toFixed(2)}</strong></div>}
                  {d.tarjeta>0&&<div style={{background:"#f3e8fd",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#7c3aed",fontWeight:600}}>💳 Tarjeta</span><strong style={{color:"#7c3aed"}}>${d.tarjeta.toFixed(2)}</strong></div>}
                </div>
              </div>
            ));
          })()}
        </Card>
      </div>)}

      {sub==="salidas"&&(()=>{
        const salidasMes=(salidasCaja||[]).filter(s=>!s.eliminada&&s.fecha&&s.fecha.startsWith(mesS));
        const totMes=parseFloat(salidasMes.reduce((a,s)=>a+s.monto,0).toFixed(2));
        // Agrupar por día (más reciente primero)
        const porDia={};
        salidasMes.forEach(s=>{if(!porDia[s.fecha])porDia[s.fecha]=[];porDia[s.fecha].push(s);});
        const dias=Object.entries(porDia).sort((a,b)=>b[0].localeCompare(a[0]));
        // Resumen por persona
        const porQuien={};
        salidasMes.forEach(s=>{porQuien[s.quien||"Sin registrar"]=(porQuien[s.quien||"Sin registrar"]||0)+s.monto;});
        const imprimirSalidas=()=>{
          const w=window.open("","_blank","width=700,height=650");
          if(!w)return;
          const rows=dias.map(([dia,lista])=>{
            const nombreDia=new Date(dia+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
            const totDia=lista.reduce((a,s)=>a+s.monto,0);
            return "<tr><td colspan='3' style='background:#e8f0f7;padding:5px;font-weight:bold;text-transform:capitalize'>"+nombreDia+"</td><td style='background:#e8f0f7;padding:5px;text-align:right;font-weight:bold'>-$"+totDia.toFixed(2)+"</td></tr>"
              +lista.map(s=>"<tr style='border-bottom:1px solid #eee'><td style='padding:4px'>"+(s.hora||"")+"</td><td style='padding:4px'>"+s.motivo+"</td><td style='padding:4px'>"+(s.quien||"")+"</td><td style='padding:4px;text-align:right;color:#c62828;font-weight:bold'>-$"+s.monto.toFixed(2)+"</td></tr>").join("");
          }).join("");
          const quienHtml=Object.entries(porQuien).sort((a,b)=>b[1]-a[1]).map(([q,m])=>"<div style='font-size:12px'>"+q+": <strong>-$"+m.toFixed(2)+"</strong></div>").join("");
          const html="<html><head><title>Salidas de caja del mes</title><style>body{font-family:sans-serif;padding:20px}h2{color:#1a3c5e;text-align:center}table{border-collapse:collapse;width:100%;font-size:11px}</style></head><body>"
            +"<h2>🫧 Lava&amp;Listo — Salidas de caja "+mesS+"</h2>"
            +"<table><tr><th style='background:#1a3c5e;color:#fff;padding:5px;text-align:left'>Hora</th><th style='background:#1a3c5e;color:#fff;padding:5px;text-align:left'>Motivo</th><th style='background:#1a3c5e;color:#fff;padding:5px;text-align:left'>Registró</th><th style='background:#1a3c5e;color:#fff;padding:5px;text-align:right'>Monto</th></tr>"+rows+"</table>"
            +"<div style='border:2px solid #c62828;background:#ffebee;border-radius:10px;padding:12px;text-align:center;margin-top:14px'><div style='font-size:20px;font-weight:800;color:#c62828'>TOTAL SALIDAS DEL MES: -$"+totMes.toFixed(2)+"</div></div>"
            +"<h3 style='color:#1a3c5e;margin-top:14px'>Por persona</h3>"+quienHtml
            +"<p style='font-size:10px;color:#aaa;text-align:center'>Impreso: "+new Date().toLocaleString("es-MX")+"</p>"
            +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
          w.document.write(html);w.document.close();
        };
        return(<div>
          <div style={S.kgrid}>
            <div style={{...S.kpi,borderLeft:"4px solid #c62828"}}><div style={{fontSize:22}}>💸</div><div><div style={{fontWeight:800,fontSize:18,color:"#c62828"}}>-${totMes.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Total salidas {mesS}</div></div></div>
            <div style={{...S.kpi,borderLeft:"4px solid #ff9800"}}><div style={{fontSize:22}}>🧾</div><div><div style={{fontWeight:800,fontSize:18,color:"#ff9800"}}>{salidasMes.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Movimientos</div></div></div>
          </div>
          <button style={{...S.btnP,marginBottom:14,width:"auto",padding:"9px 16px",fontSize:13}} onClick={imprimirSalidas}>🖨️ Imprimir listado del mes</button>
          {Object.keys(porQuien).length>0&&(
            <Card title="👩 Salidas por persona">
              {Object.entries(porQuien).sort((a,b)=>b[1]-a[1]).map(([q,m])=>{
                const pct=totMes>0?Math.min(100,(m/totMes)*100):0;
                return(<div key={q} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:2}}><span style={{fontWeight:600}}>{q}</span><strong style={{color:"#c62828"}}>-${m.toFixed(2)}</strong></div>
                  <div style={{background:"#e8f0f7",borderRadius:4,height:8}}><div style={{background:"#c62828",width:`${pct}%`,height:"100%",borderRadius:4}}/></div>
                </div>);
              })}
            </Card>
          )}
          <Card title={`💸 Detalle día por día (${salidasMes.length})`}>
            {dias.length===0?<div style={S.empty}>Sin salidas de caja en {mesS}</div>:dias.map(([dia,lista])=>{
              const totDia=lista.reduce((a,s)=>a+s.monto,0);
              const nombreDia=new Date(dia+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
              return(
                <div key={dia} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#e8f0f7",borderRadius:8,padding:"6px 12px",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#1a3c5e",textTransform:"capitalize"}}>{nombreDia}</span>
                    <strong style={{color:"#c62828",fontSize:13}}>-${totDia.toFixed(2)}</strong>
                  </div>
                  {lista.map(s=>(
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 12px",borderBottom:"1px solid #f0f4f8",fontSize:13}}>
                      <div><span style={{color:"#c62828",fontWeight:700}}>-${s.monto.toFixed(2)}</span> {s.motivo} <span style={{color:"#888",fontSize:11}}>({s.quien})</span></div>
                      <span style={{color:"#888",fontSize:11}}>{s.hora}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>
        </div>);
      })()}
      {sub==="cuadre"&&(<div>
        {!cuadre&&<div style={{background:"#ffebee",border:"2px solid #e53935",borderRadius:10,padding:"12px 16px",marginBottom:14}}><div style={{fontWeight:800,color:"#c62828",fontSize:15}}>⚠️ El cuadre no coincide</div><div style={{fontSize:13,color:"#c62828",marginTop:4}}>Total ${totV.toFixed(2)} ≠ Cobrado ${totCob.toFixed(2)} + Pendiente ${pendMes.toFixed(2)}</div></div>}
        {cuadre&&<div style={{background:"#e8f5e9",border:"2px solid #4caf50",borderRadius:10,padding:"12px 16px",marginBottom:14}}><div style={{fontWeight:800,color:"#2e7d32",fontSize:15}}>✅ Cuadre perfecto</div></div>}
        <Card title="🧮 Cuadre del mes">
          {[{l:"Total ventas del mes",v:totV,c:"#1a3c5e"},{l:"✅ Efectivo cobrado",v:efC,c:"#2e7d32"},{l:"✅ Pichincha cobrado",v:picC,c:"#2e7d32"},{l:"✅ JEP cobrado",v:jepC,c:"#2e7d32"},{l:"✅ Tarjeta cobrado",v:tarC,c:"#2e7d32"},{l:"⏳ Pendiente por cobrar",v:pendMes,c:"#e65100"}].map(r=>(
            <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}><span style={{fontSize:13}}>{r.l}</span><strong style={{color:r.c,fontSize:15}}>${r.v.toFixed(2)}</strong></div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:"2px solid #1a3c5e"}}><span style={{fontWeight:700}}>Cobrado + Pendiente</span><strong style={{color:cuadre?"#2e7d32":"#c62828",fontSize:16}}>${(totCob+pendMes).toFixed(2)}</strong></div>
        </Card>
      </div>)}
      {sub==="ventas"&&(<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
          <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
        </div>
        <div style={{fontSize:12,color:"#888",marginBottom:8}}>{vRng.length} ventas · Total: ${sum(vRng).toFixed(2)} · Cobrado: ${cob(vRng).toFixed(2)} · Pendiente: ${pend(vRng).toFixed(2)}</div>
        {vRng.slice(0,50).map(v=>{const ep=pagada(v);return(<div key={v.folio} style={{...S.vcard,borderLeft:`4px solid ${ep?"#4caf50":"#ff9800"}`}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div><div style={{fontWeight:700}}>{v.clienteNombre}</div><div style={{fontSize:11,color:"#888"}}>{v.folio} · {fmt(v.fecha)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:15}}>${v.total.toFixed(2)}</div><div style={{...S.badge,background:ep?"#e8f5e9":"#fff3e0",color:ep?"#2e7d32":"#e65100"}}>{ep?"✅ Pagado":`⏳ $${saldo(v).toFixed(2)}`}</div></div>
          </div>
        </div>);})}
      </div>)}
      {sub==="excel"&&(<Card title="📥 Excel">
        {[{l:"Hoy",a:vHoy,t:"hoy"},{l:"Semana",a:vSem,t:"semana"},{l:"Mes",a:vMes,t:"mes"},{l:"Todo",a:ventas.filter(v=>!v.anulada),t:"completo"}].map(r=>(
          <button key={r.t} style={{...S.btnP,marginBottom:8}} onClick={()=>expCSV(r.a,`reporte-${r.t}`,empleadas)}>{r.l} ({r.a.length} ventas · ${sum(r.a).toFixed(2)})</button>
        ))}
      </Card>)}
    </div>
  );
}

function Inventario({inventario,setInventario,upsertInventario}){
  const [nv,setNv]=useState({nombre:"",stock:0,min:1,unidad:"pzas"});
  const activos=inventario.filter(i=>!i.eliminada);
  const upd=(id,f,v)=>setInventario(prev=>{const next=prev.map(i=>i.id===id?{...i,[f]:v}:i);const updated=next.find(i=>i.id===id);if(updated&&upsertInventario)upsertInventario({...updated,_updatedAt:new Date().toISOString()});return next;});
  const del=id=>{if(!window.confirm("¿Eliminar este insumo?"))return;setInventario(prev=>{const next=prev.map(i=>i.id===id?{...i,eliminada:true}:i);const borrado=next.find(i=>i.id===id);if(borrado&&upsertInventario)upsertInventario({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const add=()=>{if(!nv.nombre.trim())return;const ni={...nv,id:Date.now(),stock:parseFloat(nv.stock)||0};setInventario(prev=>[...prev,ni]);if(upsertInventario)upsertInventario({...ni,_updatedAt:new Date().toISOString()});setNv({nombre:"",stock:0,min:1,unidad:"pzas"});};
  const bajo=activos.filter(i=>i.stock<=i.min);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📦 Inventario</h2>
    {bajo.length>0&&<div style={S.alrt}>⚠️ Stock bajo: {bajo.map(i=>i.nombre).join(", ")}</div>}
    <Card title="📋 Insumos">
      {activos.map(it=>(<div key={it.id} style={S.vcard}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600}}>{it.nombre}</div><div style={{fontSize:12,color:"#888"}}>Min: {it.min} {it.unidad}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{...S.badge,background:it.stock<=it.min?"#ffebee":"#e8f5e9",color:it.stock<=it.min?"#c62828":"#2e7d32",fontSize:14,fontWeight:700}}>{it.stock} {it.unidad}</div>
            <button style={S.btnR} onClick={()=>del(it.id)}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
          <button style={S.btnS} onClick={()=>upd(it.id,"stock",Math.max(0,it.stock-1))}>−</button>
          <input type="number" style={{...S.inp,width:70,textAlign:"center",padding:"4px 6px"}} value={it.stock} onChange={e=>upd(it.id,"stock",parseFloat(e.target.value)||0)}/>
          <button style={S.btnS} onClick={()=>upd(it.id,"stock",it.stock+1)}>+</button>
        </div>
      </div>))}
    </Card>
    <Card title="➕ Agregar">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="Nombre" value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Stock" value={nv.stock} onChange={e=>setNv({...nv,stock:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Minimo" value={nv.min} onChange={e=>setNv({...nv,min:e.target.value})}/>
        <input style={S.inp} placeholder="Unidad" value={nv.unidad} onChange={e=>setNv({...nv,unidad:e.target.value})}/>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>Agregar</button>
    </Card>
  </div>);
}

function Equipo({empleadas,setEmpleadas,ventas,esAdmin,upsertEmpleada}){
  const [nv,setNv]=useState({nombre:"",metaVentas:20,montoBonus:20,bonoGrupal:false});
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const mes=mesK(new Date());
  const add=()=>{if(!nv.nombre.trim())return;const ne={id:Date.now(),nombre:nv.nombre,activa:true,metaVentas:parseInt(nv.metaVentas)||20,montoBonus:parseFloat(nv.montoBonus)||0,bonoGrupal:!!nv.bonoGrupal};setEmpleadas(prev=>[...prev,ne]);if(upsertEmpleada)upsertEmpleada({...ne,_updatedAt:new Date().toISOString()});setNv({nombre:"",metaVentas:20,montoBonus:20,bonoGrupal:false});};
  const tog=id=>setEmpleadas(prev=>{const next=prev.map(e=>e.id===id?{...e,activa:!e.activa}:e);const updated=next.find(e=>e.id===id);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});
  const save2=()=>{setEmpleadas(prev=>{const next=prev.map(e=>e.id===editId?{...e,...ed,metaVentas:parseInt(ed.metaVentas)||20,montoBonus:parseFloat(ed.montoBonus)||0,bonoGrupal:!!ed.bonoGrupal}:e);const updated=next.find(e=>e.id===editId);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});setEditId(null);};
  const stats=empleadas.map(e=>{const mv=ventas.filter(v=>v.empleadaId===e.id&&mesK(v.fecha)===mes);return{...e,vm:mv.length,tm:mv.reduce((a,v)=>a+v.total,0)};});
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>👩 Equipo & Bonos</h2>
    <Card title="👩 Empleadas">
      {stats.map(e=>{const meta=e.metaVentas||20;const pct=Math.min(100,(e.vm/meta)*100);const bono=e.vm>=meta;return(
        <div key={e.id} style={{...S.vcard,opacity:e.activa?1:0.6}}>
          {editId===e.id?(
            <div>
              <div style={{display:"grid",gap:8,marginBottom:8}}>
                <div><label style={S.lbl}>Nombre</label><input style={S.inp} value={ed.nombre||""} onChange={ev=>setEd({...ed,nombre:ev.target.value})}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><label style={S.lbl}>Meta ventas/mes</label><input type="number" style={S.inp} value={ed.metaVentas||20} onChange={ev=>setEd({...ed,metaVentas:ev.target.value})}/></div>
                  <div><label style={S.lbl}>Bono ($)</label><input type="number" style={S.inp} value={ed.montoBonus||0} onChange={ev=>setEd({...ed,montoBonus:ev.target.value})}/></div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginTop:4,cursor:"pointer"}}>
                  <input type="checkbox" checked={!!ed.bonoGrupal} onChange={ev=>setEd({...ed,bonoGrupal:ev.target.checked})}/>
                  🎯 Participa en el bono grupal (meta mensual)
                </label>
              </div>
              <div style={{display:"flex",gap:8}}><button style={{...S.btnP,flex:1}} onClick={save2}>✓ Guardar</button><button style={S.btnC} onClick={()=>setEditId(null)}>Cancelar</button></div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{e.nombre}</div><div style={{fontSize:12,color:"#888"}}>{e.vm} ventas este mes</div>{esAdmin&&<div style={{fontSize:11,color:"#4db6e4"}}>Meta: {meta} · Bono: ${e.montoBonus||0}{e.bonoGrupal?" · 🎯 En bono grupal":""}</div>}</div>
                <div style={{display:"flex",gap:6}}>
                  {bono&&<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 {esAdmin?`$${e.montoBonus||0}`:"¡Bono!"}</div>}
                  {esAdmin&&<button style={S.btnS} onClick={()=>{setEditId(e.id);setEd({...e});}}>✏️</button>}
                  {esAdmin&&<button style={{...S.btnS,background:e.activa?"#ffebee":"#e8f5e9",color:e.activa?"#c62828":"#2e7d32"}} onClick={()=>tog(e.id)}>{e.activa?"Desactivar":"Activar"}</button>}
                </div>
              </div>
              <div style={{marginTop:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:3}}><span>Progreso bono</span><span>{e.vm}/{meta}</span></div>
                <div style={{background:"#e8f0f7",borderRadius:6,height:8}}><div style={{background:bono?"#f59e0b":"#4db6e4",width:`${pct}%`,height:"100%",borderRadius:6}}/></div>
              </div>
            </>
          )}
        </div>
      );})}
    </Card>
    {esAdmin&&<Card title="➕ Agregar empleada">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="Nombre completo" value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/>
        <div><label style={S.lbl}>Meta ventas/mes</label><input type="number" style={S.inp} value={nv.metaVentas} onChange={e=>setNv({...nv,metaVentas:e.target.value})}/></div>
        <div><label style={S.lbl}>Monto bono ($)</label><input type="number" style={S.inp} value={nv.montoBonus} onChange={e=>setNv({...nv,montoBonus:e.target.value})}/></div>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>Agregar empleada</button>
    </Card>}
  </div>);
}

const CATS=["Insumos/Suministros","Servicios","Arriendo","Sueldos","Mantenimiento","Publicidad","Equipos","Otros"];
function Gastos({gastos,setGastos,sesion,upsertGasto}){
  const [nv,setNv]=useState({descripcion:"",categoria:"Insumos/Suministros",proveedor:"",numeroFactura:"",monto:"",fecha:fechaHoyLocal(),metodoPago:"Efectivo",notas:""});
  const [fMes,setFMes]=useState(mesK(new Date()));const [fCat,setFCat]=useState("Todas");const [err,setErr]=useState("");
  const add=()=>{if(!nv.descripcion.trim()||!nv.monto){setErr("Completa descripcion y monto");return;}const ng={...nv,id:Date.now(),monto:parseFloat(nv.monto),registradoPor:sesion.nombre};setGastos(prev=>[ng,...prev]);if(upsertGasto)upsertGasto({...ng,_updatedAt:new Date().toISOString()});setNv({descripcion:"",categoria:"Insumos/Suministros",proveedor:"",numeroFactura:"",monto:"",fecha:fechaHoyLocal(),metodoPago:"Efectivo",notas:""});setErr("");};
  const del=id=>{if(!window.confirm("Eliminar?"))return;setGastos(prev=>{const next=prev.map(g=>g.id===id?{...g,eliminada:true}:g);const borrado=next.find(g=>g.id===id);if(borrado&&upsertGasto)upsertGasto({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const fil=gastos.filter(g=>!g.eliminada&&(!fMes||fechaLocal(g.fecha).startsWith(fMes))&&(fCat==="Todas"||g.categoria===fCat));
  const tot=fil.reduce((a,g)=>a+g.monto,0);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🛒 Gastos & Facturas</h2>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #e53935"}}><div style={{fontSize:22}}>💸</div><div><div style={{fontWeight:800,fontSize:18,color:"#e53935"}}>${tot.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Total gastos</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #ff9800"}}><div style={{fontSize:22}}>🧾</div><div><div style={{fontWeight:800,fontSize:18,color:"#ff9800"}}>{fil.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Facturas</div></div></div>
    </div>
    <Card title="🔍 Filtros">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={fMes} onChange={e=>setFMes(e.target.value)}/></div>
        <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={fCat} onChange={e=>setFCat(e.target.value)}><option>Todas</option>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
      </div>
    </Card>
    <Card title="➕ Registrar gasto">
      {err&&<div style={S.err}>{err}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Descripcion *</label><input style={S.inp} placeholder="Ej: Detergente..." value={nv.descripcion} onChange={e=>setNv({...nv,descripcion:e.target.value})}/></div>
        <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={nv.categoria} onChange={e=>setNv({...nv,categoria:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label style={S.lbl}>Monto *</label><input type="number" style={S.inp} placeholder="$0.00" value={nv.monto} onChange={e=>setNv({...nv,monto:e.target.value})}/></div>
        <div><label style={S.lbl}>Proveedor</label><input style={S.inp} value={nv.proveedor} onChange={e=>setNv({...nv,proveedor:e.target.value})}/></div>
        <div><label style={S.lbl}>N° Factura</label><input style={S.inp} value={nv.numeroFactura} onChange={e=>setNv({...nv,numeroFactura:e.target.value})}/></div>
        <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={nv.fecha} onChange={e=>setNv({...nv,fecha:e.target.value})}/></div>
        <div><label style={S.lbl}>Metodo</label><select style={S.inp} value={nv.metodoPago} onChange={e=>setNv({...nv,metodoPago:e.target.value})}>{PAGOS.map(p=><option key={p}>{p}</option>)}</select></div>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>💾 Registrar gasto</button>
    </Card>
    <Card title={`🧾 Facturas (${fil.length})`}>
      {fil.length===0?<div style={S.empty}>Sin gastos</div>:fil.map(g=>(
        <div key={g.id} style={{...S.vcard,borderLeft:"4px solid #e53935"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div><div style={{fontWeight:700}}>{g.descripcion}</div><div style={{fontSize:11,color:"#888"}}>{g.categoria} · {fmtD(g.fecha)}</div>{g.proveedor&&<div style={{fontSize:11}}>🏪 {g.proveedor}</div>}{g.numeroFactura&&<div style={{fontSize:11,color:"#4db6e4"}}>🧾 {g.numeroFactura}</div>}</div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#e53935"}}>${g.monto.toFixed(2)}</div><div style={{...S.badge,background:"#f3e8fd",color:"#7c3aed",marginTop:4}}>{g.metodoPago}</div>{sesion.rol==="Administrador"&&<button style={{...S.btnR,display:"block",marginTop:4}} onClick={()=>del(g.id)}>✕</button>}</div>
          </div>
        </div>
      ))}
    </Card>
  </div>);
}

function Configuracion({servicios,setServicios,exportarDatos,importarDatos,upsertVenta,upsertServicio}){
  const [nv,setNv]=useState({label:"",precio:""});const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});const [busq,setBusq]=useState("");
  const activos=servicios.filter(s=>!s.eliminada);
  const add=()=>{if(!nv.label.trim()||!nv.precio)return;const ns={id:"c-"+Date.now(),label:nv.label.toUpperCase(),precio:parseFloat(nv.precio)};setServicios(prev=>[...prev,ns]);if(upsertServicio)upsertServicio({...ns,_updatedAt:new Date().toISOString()});setNv({label:"",precio:""});};
  const del=id=>{if(!window.confirm("¿Eliminar este servicio?"))return;setServicios(prev=>{const next=prev.map(s=>s.id===id?{...s,eliminada:true}:s);const borrado=next.find(s=>s.id===id);if(borrado&&upsertServicio)upsertServicio({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const sav=()=>{setServicios(prev=>{const next=prev.map(s=>s.id===editId?{...s,label:ed.label.toUpperCase(),precio:parseFloat(ed.precio)}:s);const updated=next.find(s=>s.id===editId);if(updated&&upsertServicio)upsertServicio({...updated,_updatedAt:new Date().toISOString()});return next;});setEditId(null);};
  const fil=activos.filter(s=>s.label.toLowerCase().includes(busq.toLowerCase()));
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>⚙️ Configuracion</h2>
    <Card title="💾 Respaldo">
      <button style={{...S.btnP,marginBottom:10,background:"linear-gradient(135deg,#f59e0b,#d97706)"}} onClick={async()=>{
        if(!window.confirm("Se subirán TODOS los datos de este dispositivo a Firestore (ventas, gastos, salidas, usuarios, etc.). ¿Continuar?"))return;
        try{
          const{db}=await import("./firebase");
          const{collection,setDoc,doc}=await import("firebase/firestore");
          const cols=[
            ["ventas","ll_ventas","folio"],
            ["clientes","ll_clientes","id"],
            ["empleadas","ll_empleadas","id"],
            ["inventario","ll_inventario","id"],
            ["servicios","ll_servicios","id"],
            ["gastos","ll_gastos","id"],
            ["depositos","ll_depositos","id"],
            ["salidasCaja","ll_salidas_caja","id"],
            ["usuarios","ll_usuarios","id"],
            ["cajas","ll_cajas","id"],
            ["cupones","ll_cupones","id"],
            ["promos","ll_promos","id"],
          ];
          let tot=0;
          for(const [col,key,idField] of cols){
            const items=JSON.parse(localStorage.getItem(key)||"[]");
            for(const it of items){
              if(it[idField]==null)continue;
              await setDoc(doc(collection(db,col),String(it[idField])),{...it,_updatedAt:new Date().toISOString()},{merge:true});
              tot++;
            }
          }
          alert("✅ "+tot+" registros subidos a Firestore");
        }catch(e){alert("❌ Error al subir: "+e.message);}
      }}>🔥 Subir TODO a Firestore</button>
            <button style={{...S.btnP,marginBottom:10}} onClick={exportarDatos}>📥 Exportar datos</button>
      <label style={{...S.btnP,display:"block",textAlign:"center",cursor:"pointer",background:"#e8f5fd",color:"#1a3c5e",padding:"13px",borderRadius:10,fontSize:15,fontWeight:700}}>📤 Importar datos<input type="file" accept=".json" style={{display:"none"}} onChange={importarDatos}/></label>
    </Card>
    <Card title="➕ Agregar servicio">
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
        <input style={S.inp} placeholder="Nombre del servicio" value={nv.label} onChange={e=>setNv({...nv,label:e.target.value})}/>
        <input type="number" style={{...S.inp,width:90}} placeholder="$Precio" value={nv.precio} onChange={e=>setNv({...nv,precio:e.target.value})}/>
      </div>
      <button style={{...S.btnP,marginTop:8}} onClick={add}>Agregar</button>
    </Card>
    <Card title={`📋 Servicios (${activos.length})`}>
      <input style={{...S.inp,marginBottom:10}} placeholder="Buscar..." value={busq} onChange={e=>setBusq(e.target.value)}/>
      {fil.map(s=>(<div key={s.id} style={{...S.vcard,padding:"8px 12px"}}>
        {editId===s.id?(
          <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
            <input style={S.inp} value={ed.label||""} onChange={e=>setEd({...ed,label:e.target.value})}/>
            <input type="number" style={{...S.inp,width:80}} value={ed.precio||""} onChange={e=>setEd({...ed,precio:e.target.value})}/>
            <button style={{...S.btnS,background:"#e8f5e9",color:"#2e7d32"}} onClick={sav}>✓</button>
          </div>
        ):(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{s.label}</div><div style={{fontSize:12,color:"#4db6e4",fontWeight:700}}>${s.precio.toFixed(2)}</div></div>
            <div style={{display:"flex",gap:6}}>
              <button style={S.btnS} onClick={()=>{setEditId(s.id);setEd({label:s.label,precio:s.precio});}}>✏️</button>
              <button style={S.btnR} onClick={()=>del(s.id)}>✕</button>
            </div>
          </div>
        )}
      </div>))}
    </Card>
  </div>);
}

function GestionUsuarios(){
  const [users,setUsers]=useState(()=>load("ll_usuarios",USUARIOS_DEFAULT));
  const [nv,setNv]=useState({usuario:"",clave:"",nombre:"",rol:"Empleada"});
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const [showC,setShowC]=useState({});const [msg,setMsg]=useState("");const [err,setErr]=useState("");
  useEffect(()=>save("ll_usuarios",users),[users]);
  const visibles=users.filter(u=>!u.eliminada);
  // Sube un usuario a Firestore (crear, editar o marcar eliminado)
  const subirUsuario=async(u)=>{
    try{
      const{db}=await import("./firebase");
      const{collection,setDoc,doc}=await import("firebase/firestore");
      await setDoc(doc(collection(db,"usuarios"),String(u.id)),{...u,_updatedAt:new Date().toISOString()},{merge:true});
    }catch(e){console.log("No se pudo subir usuario:",e);}
  };
  const add=()=>{
    if(!nv.usuario.trim()||!nv.clave.trim()||!nv.nombre.trim()){setErr("Completa todos los campos");return;}
    if(visibles.find(u=>u.usuario.toLowerCase()===nv.usuario.toLowerCase())){setErr("Ese usuario ya existe");return;}
    const nuevo={...nv,id:Date.now()};
    setUsers(prev=>[...prev,nuevo]);subirUsuario(nuevo);
    setNv({usuario:"",clave:"",nombre:"",rol:"Empleada"});setErr("");setMsg("✅ Usuario creado y subido a la nube");setTimeout(()=>setMsg(""),3000);
  };
  const del=id=>{
    if(visibles.filter(u=>u.rol==="Administrador").length<=1&&visibles.find(u=>u.id===id)?.rol==="Administrador"){alert("Debe haber al menos un administrador");return;}
    if(!window.confirm("Eliminar?"))return;
    setUsers(prev=>{const next=prev.map(u=>u.id===id?{...u,eliminada:true}:u);const borrado=next.find(u=>u.id===id);if(borrado)subirUsuario(borrado);return next;});
  };
  const sav=()=>{const clave=ed.nuevaClave?.trim()?ed.nuevaClave:ed.clave;setUsers(prev=>{const next=prev.map(u=>u.id===editId?{...u,nombre:ed.nombre,usuario:ed.usuario,clave,rol:ed.rol}:u);const updated=next.find(u=>u.id===editId);if(updated)subirUsuario(updated);return next;});setEditId(null);setMsg("✅ Actualizado y subido a la nube");setTimeout(()=>setMsg(""),3000);};
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🔑 Usuarios</h2>
    {msg&&<div style={{background:"#e8f5e9",color:"#2e7d32",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:12,fontWeight:600}}>{msg}</div>}
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12}}>☁️ Los usuarios se guardan en la nube y se descargan a cada dispositivo al abrir la pantalla de ingreso. Si creas o cambias un usuario, en los otros dispositivos aparecerá al volver a la pantalla de login.</div>
    <Card title="👥 Usuarios del sistema">
      {visibles.map(u=>(<div key={u.id} style={S.vcard}>
        {editId===u.id?(
          <div>
            <div style={{fontWeight:700,color:"#1a3c5e",marginBottom:10}}>✏️ Editando: {u.nombre}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Nombre</label><input style={S.inp} value={ed.nombre||""} onChange={e=>setEd({...ed,nombre:e.target.value})}/></div>
              <div><label style={S.lbl}>Usuario</label><input style={S.inp} value={ed.usuario||""} onChange={e=>setEd({...ed,usuario:e.target.value})} autoCapitalize="none"/></div>
              <div><label style={S.lbl}>Rol</label><select style={S.inp} value={ed.rol||"Empleada"} onChange={e=>setEd({...ed,rol:e.target.value})}><option>Administrador</option><option>Empleada</option></select></div>
              <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Nueva contraseña (vacío = no cambia)</label><input type="password" style={S.inp} placeholder="Nueva contraseña..." value={ed.nuevaClave||""} onChange={e=>setEd({...ed,nuevaClave:e.target.value})}/>{ed.nuevaClave&&<div style={{fontSize:11,color:"#2e7d32",marginTop:4}}>✅ Se cambiara la contraseña al guardar</div>}</div>
            </div>
            <div style={{display:"flex",gap:8}}><button style={{...S.btnP,flex:1}} onClick={sav}>✓ Guardar</button><button style={S.btnC} onClick={()=>setEditId(null)}>Cancelar</button></div>
          </div>
        ):(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{u.nombre}</div>
              <div style={{fontSize:12,color:"#888"}}>👤 <strong>{u.usuario}</strong> · 🔒 <span style={{letterSpacing:2}}>{showC[u.id]?u.clave:"••••••"}</span>
                <button onClick={()=>setShowC(prev=>({...prev,[u.id]:!prev[u.id]}))} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,marginLeft:4}}>{showC[u.id]?"🙈":"👁️"}</button>
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{...S.badge,background:u.rol==="Administrador"?"#e8f5fd":"#f3e8fd",color:u.rol==="Administrador"?"#1565c0":"#7c3aed"}}>{u.rol==="Administrador"?"👑":"👩"} {u.rol}</div>
              <button style={S.btnS} onClick={()=>{setEditId(u.id);setEd({...u,nuevaClave:""});}}>✏️</button>
              <button style={S.btnR} onClick={()=>del(u.id)}>✕</button>
            </div>
          </div>
        )}
      </div>))}
    </Card>
    <Card title="➕ Agregar usuario">
      {err&&<div style={S.err}>{err}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Nombre completo</label><input style={S.inp} value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/></div>
        <div><label style={S.lbl}>Usuario</label><input style={S.inp} value={nv.usuario} onChange={e=>setNv({...nv,usuario:e.target.value})} autoCapitalize="none"/></div>
        <div><label style={S.lbl}>Contraseña</label><input type="password" style={S.inp} value={nv.clave} onChange={e=>setNv({...nv,clave:e.target.value})}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Rol</label><select style={S.inp} value={nv.rol} onChange={e=>setNv({...nv,rol:e.target.value})}><option>Administrador</option><option>Empleada</option></select></div>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>➕ Crear usuario</button>
    </Card>
  </div>);
}

// ─── SALIDA DE CAJA ────────────────────────────────────────────────
function SalidaCaja({sesion,salidasCaja,setSalidasCaja,onClose,upsertSalida}){
  const [monto,setMonto]=useState("");
  const [motivo,setMotivo]=useState("");
  const hoy=fechaHoyLocal();
  const salidasHoy=(salidasCaja||[]).filter(s=>s.fecha===hoy&&!s.eliminada);
  const totHoy=salidasHoy.reduce((a,s)=>a+s.monto,0);

  const registrar=()=>{
    const m=parseFloat(monto);
    if(!m||m<=0){alert("Ingresa un monto válido");return;}
    if(!motivo.trim()){alert("Ingresa el motivo");return;}
    const salida={
      id:Date.now(),fecha:hoy,
      hora:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),
      monto:m,motivo:motivo.trim(),
      quien:sesion.nombre,quienId:sesion.id,
    };
    setSalidasCaja(prev=>[salida,...prev]);if(upsertSalida)upsertSalida({...salida,_updatedAt:new Date().toISOString()});
    setMonto("");setMotivo("");
  };

  const eliminar=id=>{
    if(!window.confirm("¿Eliminar esta salida?"))return;
    setSalidasCaja(prev=>{
      const next=prev.map(s=>s.id===id?{...s,eliminada:true}:s);
      const borrada=next.find(s=>s.id===id);
      if(borrada&&upsertSalida)upsertSalida({...borrada,_updatedAt:new Date().toISOString()});
      return next;
    });
  };

  return(
    <div style={S.ov}>
      <div style={{...S.tbox,maxWidth:400}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>💸 Salida de Caja</div>
          <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}} onClick={onClose}>✕</button>
        </div>
        <div style={{background:"#ffebee",borderRadius:8,padding:"8px 12px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:13,color:"#c62828",fontWeight:600}}>Total salidas hoy</span>
          <strong style={{color:"#c62828"}}>${totHoy.toFixed(2)}</strong>
        </div>
        <label style={S.lbl}>Monto de la salida *</label>
        <input type="number" style={{...S.inp,marginBottom:10,fontSize:18,fontWeight:700}} placeholder="$0.00" value={monto} onChange={e=>setMonto(e.target.value)}/>
        <label style={S.lbl}>Motivo *</label>
        <input style={{...S.inp,marginBottom:14}} placeholder="Ej: Compra detergente, pago servicio..." value={motivo} onChange={e=>setMotivo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&registrar()}/>
        <button style={{...S.btnP,background:"linear-gradient(135deg,#c62828,#e53935)",marginBottom:14}} onClick={registrar}>💸 Registrar salida</button>
        {salidasHoy.length>0&&(
          <div>
            <div style={{fontSize:12,color:"#888",fontWeight:700,marginBottom:6}}>SALIDAS DEL DÍA:</div>
            {salidasHoy.map(s=>(
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f0f4f8"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#c62828"}}>-${s.monto.toFixed(2)} <span style={{color:"#555",fontWeight:400}}>{s.motivo}</span></div>
                  <div style={{fontSize:11,color:"#888"}}>{s.hora} · {s.quien}</div>
                </div>
                <button style={S.btnR} onClick={()=>eliminar(s.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function CierreCaja({ventas,empleadas,onLogout,onCierreListo,onResetCierre,sesion,salidasCaja,setVentas,upsertVenta,upsertCaja}){
  const hoy=fechaHoyLocal();
  const uid=sesion?.id||"admin";
  // AK: apertura de esta sesion especifica (sessionStorage = se borra al cerrar sesion)
  const AK="ll_apertura_"+hoy+"_"+uid;
  // CK de sesion: clave unica por sesion (incluye timestamp de login)
  // CK unico por sesion - SIEMPRE diferente porque _sesId es timestamp
  // Si no hay _sesId (no deberia pasar), usar timestamp actual como fallback
  const sesId=sesion?._sesId||Date.now().toString();
  const CK="ll_cierre_"+hoy+"_"+uid+"_"+sesId;
  const [modo,setModo]=useState(()=>{try{return localStorage.getItem(AK)?"cierre":"apertura";}catch{return"apertura";}});
  const [ap,setAp]=useState(()=>{try{const a=localStorage.getItem(AK);return a?JSON.parse(a):null;}catch{return null;}});
  // cg: cierre de ESTA sesion (no del dia completo)
  // cg SIEMPRE empieza null - nunca leer del localStorage al montar
  // Esto garantiza que cada sesion empieza con cierre limpio
  const [cg,setCg]=useState(null);
  const [aEmp,setAEmp]=useState(empleadas[0]?.id||null);const [fondo,setFondo]=useState("15.00");
  // empId ya no se usa — el cierre filtra por sesion.id automaticamente
  const [bills,setBills]=useState(()=>Object.fromEntries(BILLETES.map(b=>[b,""])));
  const [coins,setCoins]=useState(()=>Object.fromEntries(MONEDAS.map(m=>[m,""])));
  const [tPic,setTPic]=useState("");const [tJep,setTJep]=useState("");const [tTar,setTTar]=useState("");
  const [paso,setPaso]=useState(0); // paso 0 = revisión obligatoria de estados
  const [revisado,setRevisado]=useState(false);
  const [waRevision,setWaRevision]=useState(null); // venta a la que hay que avisar desde la revisión
  // ---- Revisión de órdenes antes del cierre ----
  const activas=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado");
  const listosSinAviso=activas.filter(v=>(v.estado||"recibido")==="listo"&&!v.checkMsgRetiro&&!v.msgListo);
  const atrasadas=activas.filter(v=>["recibido","proceso"].includes(v.estado||"recibido")&&fechaLocal(v.entrega)<hoy);
  const puedeContinuar=listosSinAviso.length===0&&revisado;
  const marcarAvisada=(venta,info)=>{
    if(setVentas)setVentas(prev=>{const next=prev.map(vv=>vv.folio===venta.folio?{...vv,checkMsgRetiro:info.enviado,msgListo:info}:vv);const updated=next.find(vv=>vv.folio===venta.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
    setWaRevision(null);
  };
  const todosAbonos=ventas.filter(v=>!v.anulada).flatMap(v=>(v.abonos||[]).filter(ab=>{
    const tieneId=ab.cobradoPorId!=null;
    const mismoUsuario=tieneId
      ? String(ab.cobradoPorId)===String(uid)
      : String(v.empleadaId)===String(uid);
    // Comparar fecha LOCAL del abono (no UTC) con hoy local
    const fechaLocalAbono=ab.fecha?(()=>{const dt=new Date(ab.fecha);const off=dt.getTimezoneOffset();const l=new Date(dt.getTime()-off*60000);return l.toISOString().split("T")[0];})():"";
    const esHoy=fechaLocalAbono===hoy;
    return mismoUsuario&&esHoy;
  }));
  // Cobros del usuario
  const espEfBruto=todosAbonos.filter(a=>a.metodo==="Efectivo").reduce((a,ab)=>a+ab.monto,0);
  const espTr=todosAbonos.filter(a=>esTr(a.metodo)).reduce((a,ab)=>a+ab.monto,0);
  const espTa=todosAbonos.filter(a=>a.metodo==="Tarjeta").reduce((a,ab)=>a+ab.monto,0);
  // Salidas de caja de este usuario hoy — se descuentan del efectivo esperado (sin las eliminadas)
  const misSalidas=(salidasCaja||[]).filter(s=>String(s.quienId)===String(uid)&&s.fecha===hoy&&!s.eliminada);
  const totMisSalidas=parseFloat(misSalidas.reduce((a,s)=>a+s.monto,0).toFixed(2));
  const espEf=parseFloat((espEfBruto-totMisSalidas).toFixed(2)); // efectivo esperado neto
  const espTot=parseFloat((espEf+espTr+espTa).toFixed(2));
  // Para el resumen de ventas del dia (todas las ventas, no solo cobros)
  const vHoy=ventas.filter(v=>fechaLocal(v.fecha)===hoy&&!v.anulada);
  const vEmp=vHoy; // se mantiene para el conteo de ventas en ticket
  const totB=BILLETES.reduce((a,b)=>a+(parseFloat(bills[b])||0)*b,0);
  const totC=MONEDAS.reduce((a,m)=>a+(parseFloat(coins[m])||0)*m,0);
  const totEf=parseFloat((totB+totC).toFixed(2));
  const totTr=(parseFloat(tPic)||0)+(parseFloat(tJep)||0);
  const totTa=parseFloat(tTar)||0;
  const fd=ap?.fondo!=null?ap.fondo:15; // usa el fondo real de apertura
  const efN=parseFloat((totEf-fd).toFixed(2));
  const vR=parseFloat((efN+totTr+totTa).toFixed(2));
  const dEf=parseFloat((efN-espEf).toFixed(2));
  const dTr=parseFloat((totTr-espTr).toFixed(2));
  const dTa=parseFloat((totTa-espTa).toFixed(2));
  const dTot=parseFloat((vR-espTot).toFixed(2));
  const DB=({d})=><span style={{fontWeight:700,fontSize:13,color:d===0?"#2e7d32":d>0?"#1565c0":"#c62828"}}>{d===0?"✅ Cuadra":d>0?`+$${d.toFixed(2)}`:`⚠️ Falta $${Math.abs(d).toFixed(2)}`}</span>;
  const CD=({valor,cantidad,onChange,tipo})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
      <div style={{background:tipo==="billete"?"#fff8e1":"#e8f5e9",borderRadius:6,padding:"4px 10px",fontSize:14,fontWeight:700,color:tipo==="billete"?"#f59e0b":"#2e7d32",minWidth:52,textAlign:"center"}}>${valor}</div>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <button style={{...S.btnS,width:30,textAlign:"center"}} onClick={()=>onChange(Math.max(0,(parseFloat(cantidad)||0)-1))}>−</button>
        <input type="number" min="0" style={{...S.inp,width:56,textAlign:"center",padding:"6px 4px"}} value={cantidad} onChange={e=>onChange(e.target.value)}/>
        <button style={{...S.btnS,width:30,textAlign:"center"}} onClick={()=>onChange((parseFloat(cantidad)||0)+1)}>+</button>
        <div style={{minWidth:60,textAlign:"right",fontWeight:700,color:"#1a3c5e",fontSize:12}}>${((parseFloat(cantidad)||0)*valor).toFixed(2)}</div>
      </div>
    </div>
  );
  const imprimir=d=>{
    const w=window.open("","_blank","width=420,height=700");if(!w)return;
    const rowB=BILLETES.filter(b=>(parseFloat(d.bills[b])||0)>0).map(b=>'<div class="row"><span>$'+b+"×"+d.bills[b]+"</span><span>$"+(b*d.bills[b]).toFixed(2)+"</span></div>").join("");
    const rowM=MONEDAS.filter(m=>(parseFloat(d.coins[m])||0)>0).map(m=>'<div class="row"><span>$'+m+"×"+d.coins[m]+"</span><span>$"+(m*d.coins[m]).toFixed(2)+"</span></div>").join("");
    const resClass=d.dTot===0?"res ok":d.dTot>0?"res info":"res bad";
    const resText=d.dTot===0?"CAJA CUADRADA":d.dTot>0?"SOBRA $"+d.dTot.toFixed(2):"FALTA $"+Math.abs(d.dTot).toFixed(2);
    const html="<html><head><title>Cierre</title><style>body{font-family:sans-serif;padding:16px;max-width:360px;margin:0 auto}h2{text-align:center;color:#1a3c5e}.row{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}.div{border-top:1px dashed #ccc;margin:10px 0}.res{text-align:center;font-size:20px;font-weight:800;padding:12px;border-radius:8px;margin:12px 0}.ok{color:#2e7d32;background:#e8f5e9}.bad{color:#c62828;background:#ffebee}.info{color:#1565c0;background:#e3f2fd}</style></head><body>"
      +"<div style='text-align:center;font-size:32px'>🫧</div><h2>Lava&amp;Listo — CIERRE</h2>"
      +"<div class='div'></div>"
      +"<div class='row'><span>Fecha</span><span>"+new Date(d.fecha).toLocaleString("es-MX")+"</span></div>"
      +"<div class='row'><span>Empleada</span><span>"+d.emp+"</span></div>"
      +"<div class='row'><span>Cobros</span><span>"+d.nv+" · $"+d.tv.toFixed(2)+"</span></div>"
      +"<div class='div'></div><strong>💵 Efectivo</strong>"+rowB+rowM
      +"<div class='row'><strong>Total efectivo</strong><strong>$"+d.totEf.toFixed(2)+"</strong></div>"
      +"<div class='row' style='color:#e65100'><span>— Fondo caja</span><span>-$"+d.fd.toFixed(2)+"</span></div>"
      +"<div class='row'><strong>Efectivo neto</strong><strong>$"+d.efN.toFixed(2)+"</strong></div>"
      +(d.totMisSalidas>0?"<div class='row' style='color:#c62828'><span>💸 Salidas de caja</span><span>-$"+d.totMisSalidas.toFixed(2)+"</span></div><div class='row' style='color:#c62828'><strong>Efectivo esperado (neto)</strong><strong>$"+d.espEf.toFixed(2)+"</strong></div>":"")
      +"<div class='div'></div>"
      +"<div class='row'><span>Pichincha</span><span>$"+d.tPic.toFixed(2)+"</span></div>"
      +"<div class='row'><span>JEP</span><span>$"+d.tJep.toFixed(2)+"</span></div>"
      +"<div class='row'><span>Tarjeta</span><span>$"+d.totTa.toFixed(2)+"</span></div>"
      +"<div class='div'></div>"
      +"<div class='"+resClass+"'>"+resText+"</div>"
      +"<p style='text-align:center;font-size:10px;color:#aaa'>Lava&amp;Listo · "+new Date().toLocaleString("es-MX")+"</p>"
      +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
    w.document.write(html);
    w.document.close();
  };
  const confirmar=()=>{
    const hoyC=fechaHoyLocal();
    const d={id:"ci_"+hoyC+"_"+(sesion?.id||"x")+"_"+Date.now(),tipo:"cierre",dia:hoyC,empleadaId:sesion?.id,fecha:new Date().toISOString(),emp:sesion?.nombre||"",bills,coins,totEf,fd,efN,tPic:parseFloat(tPic)||0,tJep:parseFloat(tJep)||0,totTr,totTa,dEf,dTr,dTa,dTot,espEf,espEfBruto,espTr,espTa,espTot,totMisSalidas,misSalidas,nv:todosAbonos.length,tv:todosAbonos.reduce((a,ab)=>a+ab.monto,0)};
    try{localStorage.setItem(CK,JSON.stringify(d));}catch{}
    if(upsertCaja)upsertCaja(d); // ☁️ cierre guardado en la nube
    setCg(d);
    if(onCierreListo)onCierreListo();
    imprimir(d);
    // Logout inmediato despues de imprimir (no hay forma de cancelarlo)
    setTimeout(()=>{if(onLogout)onLogout();},2000);
  };
  const regAp=()=>{
    const hoyA=fechaHoyLocal();
    const d={id:"ap_"+hoyA+"_"+(sesion?.id||"x")+"_"+Date.now(),tipo:"apertura",dia:hoyA,empleadaNombre:empleadas.find(e=>String(e.id)===String(aEmp))?.nombre||"",empleadaId:aEmp,fondo:parseFloat(fondo)||15,fecha:new Date().toISOString()};
    try{localStorage.setItem(AK,JSON.stringify(d));}catch{}
    if(upsertCaja)upsertCaja(d); // ☁️ apertura guardada en la nube
    setAp(d);setModo("cierre");
  };
  // Si ya hay cierre de esta sesion, mostrar resultado pero permitir nuevo cierre
  if(cg){return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:380,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:48,marginBottom:8}}>{cg.dTot===0?"✅":cg.dTot>0?"📈":"⚠️"}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>
          {cg.dTot===0?"¡Caja Cuadrada!":cg.dTot>0?`Sobran $${cg.dTot.toFixed(2)}`:`Faltan $${Math.abs(cg.dTot).toFixed(2)}`}
        </div>
        <div style={{fontSize:13,color:"#888",marginBottom:16}}>{new Date(cg.fecha).toLocaleString("es-MX")}</div>
        <div style={{background:"#f0f4f8",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>💵 Efectivo neto</span><strong>${(cg.efN||0).toFixed(2)}</strong></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>🏦 Transferencias</span><strong>${(cg.totTr||0).toFixed(2)}</strong></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>💳 Tarjeta</span><strong>${(cg.totTa||0).toFixed(2)}</strong></div>
        </div>
        <button style={{width:"100%",padding:"12px",background:"#1a3c5e",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={()=>imprimir(cg)}>🖨️ Reimprimir ticket</button>
        <button style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#2e7d32,#388e3c)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={()=>{setCg(null);setPaso(0);setRevisado(false);setModo("cierre");if(onResetCierre)onResetCierre();}}>🔄 Realizar otro cierre</button>
        <button style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#c62828,#e53935)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={()=>{if(onLogout)onLogout();}}>🚪 Salir</button>
      </div>
    </div>
  );}
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>💰 Caja</h2>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button style={{...S.pill,...(modo==="apertura"?S.pillA:{})}} onClick={()=>setModo("apertura")}>🔓 Apertura</button>
      <button style={{...S.pill,...(modo==="cierre"?S.pillA:{})}} onClick={()=>setModo("cierre")}>🔒 Cierre</button>
    </div>
    {modo==="apertura"&&(<Card title="🔓 Apertura de caja">
      {ap&&<div style={{...S.alrt,background:"#e8f5e9",color:"#2e7d32",marginBottom:10}}>✅ Ya abierta por <strong>{ap.empleadaNombre}</strong> · Fondo: ${ap.fondo.toFixed(2)}</div>}
      <label style={S.lbl}>Empleada que abre</label>
      <select style={{...S.inp,marginBottom:10}} value={aEmp} onChange={e=>setAEmp(e.target.value)}>{empleadas.filter(e=>e.activa).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
      <label style={S.lbl}>💵 Fondo inicial ($)</label>
      <input type="number" style={{...S.inp,fontSize:20,fontWeight:700,marginBottom:14}} value={fondo} onChange={e=>setFondo(e.target.value)}/>
      <button style={S.btnP} onClick={regAp}>🔓 Registrar apertura</button>
    </Card>)}
    {modo==="cierre"&&(<div>
      {ap&&<div style={{background:"#e8f5fd",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13}}>
        🔓 <strong>{ap.empleadaNombre}</strong> · Fondo: <strong>${ap.fondo.toFixed(2)}</strong>
        <div style={{fontSize:11,color:"#1565c0",marginTop:4}}>
          💡 Cobros de hoy: 💵 ${espEfBruto.toFixed(2)} · 🏦 ${espTr.toFixed(2)} · 💳 ${espTa.toFixed(2)}
        </div>
        {totMisSalidas>0&&<div style={{fontSize:12,color:"#c62828",fontWeight:700,marginTop:4,background:"#ffebee",borderRadius:6,padding:"4px 8px"}}>
          💸 Salidas de caja: -${totMisSalidas.toFixed(2)}
          {misSalidas.map(s=><span key={s.id} style={{display:"block",fontWeight:400,fontSize:11}}>• {s.motivo}: ${s.monto.toFixed(2)}</span>)}
          → Efectivo neto esperado: <strong>${espEf.toFixed(2)}</strong>
        </div>}
        {espTot===0&&totMisSalidas===0&&<div style={{fontSize:11,color:"#2e7d32",fontWeight:700,marginTop:4}}>Sin cobros — si solo tienes el fondo cuadrará en ✅</div>}
      </div>}
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
        {[{n:0,l:"📋 Revisión"},{n:1,l:"💵 Billetes"},{n:2,l:"🪙 Monedas"},{n:3,l:"🏦 Digital"},{n:4,l:"✅ Confirmar"}].map(p=>(
          <div key={p.n} style={{...S.badge,background:paso>=p.n?"#1a3c5e":"#e8f0f7",color:paso>=p.n?"#fff":"#888",padding:"6px 10px",fontSize:11,whiteSpace:"nowrap",cursor:paso>p.n?"pointer":"default"}} onClick={()=>{if(paso>p.n)setPaso(p.n);}}>{p.n}. {p.l}</div>
        ))}
      </div>
      {paso===0&&<Card title="📋 Paso 0 — Revisión obligatoria de órdenes">
        <div style={{fontSize:12,color:"#888",marginBottom:10}}>Antes de contar el dinero, verifica que el estado de cada orden refleje la realidad del día.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
          {ESTADOS.map(e=>{const cnt=e.id==="entregado"?ventas.filter(v=>!v.anulada&&v.estado==="entregado"&&fechaLocal(v.fecha)===hoy).length:activas.filter(v=>(v.estado||"recibido")===e.id).length;return(
            <div key={e.id} style={{background:e.bg,borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
              <div style={{fontSize:16}}>{e.icon}</div>
              <div style={{fontSize:16,fontWeight:800,color:e.color}}>{cnt}</div>
              <div style={{fontSize:9,color:e.color}}>{e.label}</div>
            </div>);})}
        </div>
        {listosSinAviso.length>0&&<div style={{background:"#ffebee",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:800,color:"#c62828",marginBottom:6}}>🚫 {listosSinAviso.length} orden(es) LISTAS sin avisar al cliente — debes avisar para poder cerrar:</div>
          {listosSinAviso.map(v=>(
            <div key={v.folio} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:8,padding:"8px 10px",marginBottom:6}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#1a3c5e"}}>{v.clienteNombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.folio} · 📅 {fmtD(v.entrega)}</div>
              </div>
              <button style={{padding:"8px 12px",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setWaRevision(v)}>📲 Avisar</button>
            </div>
          ))}
        </div>}
        {atrasadas.length>0&&<div style={{background:"#fff3e0",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#e65100",marginBottom:6}}>⚠️ {atrasadas.length} orden(es) con fecha de entrega vencida y aún sin terminar — revisa si el estado es correcto:</div>
          {atrasadas.map(v=><div key={v.folio} style={{fontSize:12,color:"#555",marginBottom:2}}>• {v.clienteNombre} · {v.folio} · {getEst(v).icon} {getEst(v).label} · entrega {fmtD(v.entrega)}</div>)}
        </div>}
        {listosSinAviso.length===0&&atrasadas.length===0&&<div style={{background:"#e8f5e9",borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:13,color:"#2e7d32",fontWeight:600}}>✅ Sin pendientes críticos: todas las órdenes listas tienen aviso enviado.</div>}
        <label style={{...S.chk,fontSize:13,background:"#f0f4f8",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <input type="checkbox" checked={revisado} onChange={()=>setRevisado(!revisado)}/>
          <span>He revisado el estado de <strong>todas</strong> las órdenes y son correctos.</span>
        </label>
        <button disabled={!puedeContinuar} style={{...S.btnP,background:puedeContinuar?undefined:"#e0e0e0",color:puedeContinuar?undefined:"#999",cursor:puedeContinuar?"pointer":"not-allowed"}} onClick={()=>{if(puedeContinuar)setPaso(1);}}>Continuar al conteo de billetes →</button>
        {!puedeContinuar&&<div style={{fontSize:11,color:"#c62828",textAlign:"center",marginTop:6}}>{listosSinAviso.length>0?"Envía los avisos pendientes y marca la casilla de revisión.":"Marca la casilla de revisión para continuar."}</div>}
        {waRevision&&<WhatsAppObligatorio venta={waRevision} tipo="listo" onConfirm={info=>marcarAvisada(waRevision,info)} onCancel={()=>setWaRevision(null)}/>}
      </Card>}
      {paso===1&&<Card title="💵 Paso 1 — Billetes">
        {BILLETES.map(b=><CD key={b} valor={b} cantidad={bills[b]} tipo="billete" onChange={v=>setBills(prev=>({...prev,[b]:v}))}/>)}
        <div style={{background:"#fff8e1",borderRadius:8,padding:"10px",marginTop:10,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Total billetes:</span><span style={{fontWeight:800,fontSize:16,color:"#f59e0b"}}>${totB.toFixed(2)}</span></div>
        <button style={{...S.btnP,marginTop:10}} onClick={()=>setPaso(2)}>Siguiente: Monedas →</button>
      </Card>}
      {paso===2&&<Card title="🪙 Paso 2 — Monedas">
        {MONEDAS.map(m=><CD key={m} valor={m} cantidad={coins[m]} tipo="moneda" onChange={v=>setCoins(prev=>({...prev,[m]:v}))}/>)}
        <div style={{background:"#e8f5e9",borderRadius:8,padding:"10px",marginTop:10,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Total efectivo:</span><span style={{fontWeight:800,fontSize:16,color:"#1a3c5e"}}>${totEf.toFixed(2)}</span></div>
        <div style={{display:"flex",gap:8,marginTop:10}}><button style={{...S.btnC,flex:1}} onClick={()=>setPaso(1)}>← Billetes</button><button style={{...S.btnP,flex:2}} onClick={()=>setPaso(3)}>Digital →</button></div>
      </Card>}
      {paso===3&&<Card title="🏦 Paso 3 — Pagos digitales">
        <label style={S.lbl}>🏦 Pichincha</label><input type="number" style={{...S.inp,marginBottom:10}} placeholder="$0.00" value={tPic} onChange={e=>setTPic(e.target.value)}/>
        <label style={S.lbl}>🏦 JEP</label><input type="number" style={{...S.inp,marginBottom:10}} placeholder="$0.00" value={tJep} onChange={e=>setTJep(e.target.value)}/>
        <label style={S.lbl}>💳 Tarjeta</label><input type="number" style={{...S.inp,marginBottom:10}} placeholder="$0.00" value={tTar} onChange={e=>setTTar(e.target.value)}/>
        <div style={{display:"flex",gap:8}}><button style={{...S.btnC,flex:1}} onClick={()=>setPaso(2)}>← Monedas</button><button style={{...S.btnP,flex:2}} onClick={()=>setPaso(4)}>Ver resultado →</button></div>
      </Card>}
      {paso===4&&(<div>
        <Card title="✅ Resumen">
          <div style={{marginBottom:10}}>
            {BILLETES.filter(b=>(parseFloat(bills[b])||0)>0).map(b=><div key={b} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555"}}><span>${b}×{bills[b]}</span><span>${(b*bills[b]).toFixed(2)}</span></div>)}
            {MONEDAS.filter(m=>(parseFloat(coins[m])||0)>0).map(m=><div key={m} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#555"}}><span>${m}×{coins[m]}</span><span>${(m*coins[m]).toFixed(2)}</span></div>)}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,borderTop:"1px solid #e8f0f7",marginTop:4,paddingTop:4}}><span>Total efectivo</span><span>${totEf.toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#e65100"}}><span>— Fondo caja</span><span>-${fd.toFixed(2)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,color:"#1a3c5e"}}><span>Efectivo neto</span><span>${efN.toFixed(2)}</span></div>
          </div>
          <div style={{borderTop:"1px dashed #d0dce8",paddingTop:8,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>🏦 Pichincha</span><strong>${(parseFloat(tPic)||0).toFixed(2)}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>🏦 JEP</span><strong>${(parseFloat(tJep)||0).toFixed(2)}</strong></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>💳 Tarjeta</span><strong>${totTa.toFixed(2)}</strong></div>
          </div>
          <div style={{borderTop:"2px solid #1a3c5e",paddingTop:8}}>
            {[{l:"💵 Efectivo",c:efN,e:espEf,d:dEf},{l:"🏦 Transferencias",c:totTr,e:espTr,d:dTr},{l:"💳 Tarjeta",c:totTa,e:espTa,d:dTa}].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f0f4f8"}}>
                <div><div style={{fontSize:13,fontWeight:600}}>{r.l}</div><div style={{fontSize:11,color:"#888"}}>Contado ${r.c.toFixed(2)} / Esperado ${r.e.toFixed(2)}</div></div>
                <DB d={r.d}/>
              </div>
            ))}
          </div>
          <div style={{background:dTot===0?"#e8f5e9":dTot>0?"#e3f2fd":"#ffebee",borderRadius:10,padding:14,marginTop:10,textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:dTot===0?"#2e7d32":dTot>0?"#1565c0":"#c62828"}}>{dTot===0?"✅ CAJA CUADRADA":dTot>0?`📈 SOBRA $${dTot.toFixed(2)}`:`⚠️ FALTA $${Math.abs(dTot).toFixed(2)}`}</div>
          </div>
        </Card>
        <div style={{background:"#fff3e0",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#e65100"}}>⚠️ Al confirmar <strong>no podras modificarlo</strong> y la sesion se cerrara.</div>
        <div style={{display:"flex",gap:8}}><button style={{...S.btnC,flex:1}} onClick={()=>setPaso(3)}>← Corregir</button><button style={{...S.btnP,flex:2,background:"linear-gradient(135deg,#2e7d32,#388e3c)"}} onClick={confirmar}>✅ Confirmar e imprimir</button></div>
      </div>)}
    </div>)}
  </div>);
}

export default function LavaListo(){
  const [ses,setSes]=useState(null);

  const login=u=>{
    // Cada login genera un ID de sesion unico con timestamp
    const sesId=Date.now().toString();
    const sesData={...u, _sesId: sesId};
    // Guardar en localStorage (no sessionStorage - mas confiable)
    try{localStorage.setItem("ll_sesion_activa",JSON.stringify(sesData));}catch{}
    setSes(sesData);
  };

  const logout=()=>{
    try{localStorage.removeItem("ll_sesion_activa");}catch{}
    setSes(null);
  };

  // Al montar: verificar si hay sesion activa
  useEffect(()=>{
    try{
      const s=localStorage.getItem("ll_sesion_activa");
      if(s){
        const sesData=JSON.parse(s);
        // Solo restaurar sesion si tiene _sesId (sesion valida)
        if(sesData._sesId) setSes(sesData);
        else localStorage.removeItem("ll_sesion_activa");
      }
    }catch{}
  },[]);

  if(!ses)return <LoginScreen onLogin={login}/>;
  return <AppContent key={ses._sesId} sesion={ses} onLogout={logout}/>;
}

// ═══════════════════════════════════════════════════════════════════
// 🎟️ CUPONES PROMO — sorteo para clientes poco frecuentes
// Caducidad: 10 días desde la emisión · Número único · Un solo uso
// ═══════════════════════════════════════════════════════════════════
const CUPON_DIAS_VALIDEZ=10;
const CUPON_MIN_COMPRA_DESC=5.00; // 💵 Compra mínima por defecto para promos de descuento (editable por promo desde el panel de Promos)
const normTxt=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
// 🎯 Targeting: usa las palabras clave configuradas en cada promo (panel de Promos) para saber si el cliente YA la consume
const consumeCategoria=(vs,promo)=>{
  const claves=promo?.claves;if(!claves||claves.length===0)return false;
  return vs.some(v=>(v.items||[]).some(it=>{const l=normTxt(it.label);return claves.some(k=>l.includes(normTxt(k)));}));
};
const nombreCategoria=promo=>promo?.claves?.[0]||promo?.titulo||"este servicio";
const CUPON_DIAS_INACTIVO=30; // cliente "poco frecuente": +30 días sin comprar (o sin compras)
const genCodigoCupon=existentes=>{
  const abc="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin caracteres confusos (0/O, 1/I/L)
  for(let i=0;i<50;i++){
    let c="LL-";for(let j=0;j<4;j++)c+=abc[Math.floor(Math.random()*abc.length)];
    if(!existentes.some(x=>x.id===c))return c;
  }
  return "LL-"+Date.now().toString(36).toUpperCase().slice(-5);
};
const cuponVigente=c=>c.estado!=="usado"&&fechaHoyLocal()<=c.caduca;
const estadoCupon=c=>c.estado==="usado"?{l:"Usado",bg:"#eceff1",col:"#546e7a",i:"✔️"}:fechaHoyLocal()>c.caduca?{l:"Caducado",bg:"#ffebee",col:"#c62828",i:"⌛"}:{l:"Vigente",bg:"#e8f5e9",col:"#2e7d32",i:"🟢"};
const msgWaCupon=c=>{
  const L="\u2501".repeat(15);
  return `\u{1FAE7} *LAVA & LISTO* \u{1FAE7}\n_Lavanderia & Limpieza Especializada_\n${L}\n\u{1F39F}\uFE0F *\u00A1FELICIDADES, ${c.clienteNombre}!*\nHas ganado un cup\u00F3n promo \u{1F381}\n${L}\n${c.promoEmoji} *${c.promoTitulo}*\n\n\u{1F39F}\uFE0F N\u00FAmero de cup\u00F3n:\n\u{1F449} *${c.id}* \u{1F448}\n\n\u{1F4C5} V\u00E1lido hasta el *${fmtD(c.caduca)}*\n(${CUPON_DIAS_VALIDEZ} d\u00EDas desde hoy)\n${L}\nPresenta este n\u00FAmero al pagar.${c.minCompra?`\n\u{1F6D2} V\u00E1lido en compras desde $${c.minCompra.toFixed(2)}`:""}\nUn solo uso \u00B7 No acumulable con\notras promociones.\n\u{1F4CD} Ricaurte, Cuenca \u00B7 \u00A1Te esperamos! \u{1F499}`;
};
const imprimirCupon=c=>{
  const w=window.open("","_blank","width=480,height=640");
  if(!w){alert("Permite las ventanas emergentes para imprimir el cupón");return;}
  w.document.write(`<!DOCTYPE html><html><head><title>Cupón ${c.id}</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;display:flex;justify-content:center;padding:20px;background:#fff}
    .cup{width:360px;border:3px dashed #001847;border-radius:16px;overflow:hidden}
    .top{background:#001847;color:#fff;text-align:center;padding:16px}
    .top .brand{font-size:20px;font-weight:800;letter-spacing:1px}
    .top .sub{font-size:10px;color:#4DD9E8;letter-spacing:2px;text-transform:uppercase}
    .mid{text-align:center;padding:18px 16px 10px}
    .gana{font-size:11px;color:#00a887;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .promo{font-size:21px;font-weight:800;color:#001847;margin:6px 0}
    .det{font-size:12px;color:#666}
    .cod{margin:14px auto 6px;background:#e6fffa;border:2px solid #00E5B8;border-radius:10px;display:inline-block;padding:8px 22px;font-size:24px;font-weight:800;letter-spacing:3px;color:#001847}
    .cad{font-size:12px;color:#c0392b;font-weight:700;margin-top:6px}
    .cli{font-size:11px;color:#888;margin-top:4px}
    .foot{border-top:1px dashed #ccc;margin-top:12px;padding:10px 16px;font-size:9px;color:#999;text-align:center;line-height:1.5}
    @media print{body{padding:0}}
  </style></head><body><div class="cup">
    <div class="top"><div class="brand">🫧 LAVA &amp; LISTO</div><div class="sub">Lavandería &amp; Limpieza Especializada</div></div>
    <div class="mid">
      <div class="gana">🎟️ Cupón Promo · ¡Para ti!</div>
      <div class="promo">${c.promoEmoji} ${c.promoTitulo}</div>
      <div class="det">${c.promoDetalle||""}</div>
      <div class="cod">${c.id}</div>
      <div class="cad">⏰ Válido hasta el ${fmtD(c.caduca)}</div>
      ${c.minCompra?`<div class="det" style="color:#001847;font-weight:700;margin-top:4px">🛒 Válido en compras desde $${c.minCompra.toFixed(2)}</div>`:""}
      <div class="cli">Emitido: ${fmtD(c.emitido)} · Cliente: ${c.clienteNombre}</div>
    </div>
    <div class="foot">Presenta este cupón y su número al pagar · Un solo uso · No acumulable con otras promociones · Válido ${CUPON_DIAS_VALIDEZ} días desde su emisión · 📍 Ricaurte, Cuenca · @lavaylistoecuador</div>
  </div><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
};

// 🎟️ Al imprimir la venta: cupón sugerido según el historial del cliente
// (la promo del listado cuya categoría MENOS ocupa)
const construirCupon=(cli,p,motivo,existentes,sesion)=>{
  const emitido=fechaHoyLocal();
  const cad=new Date();cad.setDate(cad.getDate()+CUPON_DIAS_VALIDEZ);
  return{
    id:genCodigoCupon(existentes),
    promoId:p.id,promoTipo:p.tipo,promoTitulo:p.titulo,promoDetalle:p.detalle||"",promoEmoji:p.emoji,
    promoLabel:p.tipo==="descuento"?p.labelDescuento:p.label,
    promoPrecio:p.tipo==="custom"?p.precio:null,promoMonto:p.tipo==="descuento"?p.monto:null,
    clienteId:cli.id,clienteNombre:cli.nombre,clienteTel:cli.tel||"",
    emitido,caduca:cad.toISOString().slice(0,10),
    motivo:motivo||"",minCompra:p.tipo==="descuento"?(p.minCompra||CUPON_MIN_COMPRA_DESC):null,
    estado:"vigente",generadoPor:sesion?.nombre||"",fecha:new Date().toISOString()
  };
};
function CuponSugerido({venta,clientes,ventas,cupones,setCupones,upsertCupon,sesion,promos,onClose}){
  const listaPromos=(promos&&promos.length?promos:DEFAULT_PROMOS).filter(p=>p.activa!==false);
  const [sug]=useState(()=>{
    const cli=clientes.find(c=>String(c.id)===String(venta.clienteId)&&!c.eliminada);
    if(!cli)return null;
    if(venta.cuponId)return null; // acaba de canjear uno: no regalar otro de inmediato
    if(cupones.some(c=>String(c.clienteId)===String(cli.id)&&cuponVigente(c)))return null; // ya tiene uno vigente
    const vsCli=ventas.filter(v=>String(v.clienteId)===String(cli.id)&&!v.anulada);
    if(listaPromos.length===0)return null;
    const usos=listaPromos.map(p=>{
      const n=vsCli.filter(v=>(v.items||[]).some(it=>{const l=normTxt(it.label);return(p.claves||[]).some(k=>l.includes(normTxt(k)));})).length;
      return{p,n};
    });
    const minN=Math.min(...usos.map(u=>u.n));
    const cand=usos.filter(u=>u.n===minN);
    const eleg=cand[Math.floor(Math.random()*cand.length)];
    const cat=nombreCategoria(eleg.p);
    const motivo=minN===0?`Nunca ha llevado ${cat} — ¡venta cruzada!`:`Es el servicio que menos ocupa: solo ${minN} ${minN===1?"vez":"veces"} (${cat})`;
    return{cli,promo:eleg.p,motivo};
  });
  const [generado,setGenerado]=useState(null);
  if(!sug)return null;
  const generar=()=>{
    if(generado)return generado;
    const cup=construirCupon(sug.cli,sug.promo,sug.motivo,cupones,sesion);
    if(setCupones)setCupones(pv=>[cup,...pv]);
    if(upsertCupon)upsertCupon(cup); // ☁️ a la nube
    setGenerado(cup);
    return cup;
  };
  return(
    <div style={{...S.ov,zIndex:95}}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.35)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#00a887,#00E5B8)",padding:"16px 20px",textAlign:"center"}}>
          <div style={{fontSize:34}}>🎟️</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#fff"}}>Cupón sugerido para este cliente</div>
          <div style={{fontSize:12,color:"#e6fffa"}}>Imprímelo y entrégalo junto con su pedido 🫧</div>
        </div>
        <div style={{padding:"16px 18px"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#001847"}}>👤 {sug.cli.nombre}</div>
          <div style={{background:"#fff8e1",borderRadius:8,padding:"6px 10px",margin:"8px 0",fontSize:12,color:"#b45309",fontWeight:600}}>🎯 {sug.motivo}</div>
          <div style={{background:"#f8fbfd",border:"1.5px dashed #4db6e4",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#1a3c5e"}}>{sug.promo.emoji} {sug.promo.titulo}</div>
            <div style={{fontSize:11,color:"#888"}}>{sug.promo.detalle}</div>
            <div style={{fontSize:11,color:"#c0392b",fontWeight:600,marginTop:4}}>⏰ Caducará en {CUPON_DIAS_VALIDEZ} días</div>
            {sug.promo.tipo==="descuento"&&<div style={{fontSize:11,color:"#1a3c5e",fontWeight:600}}>🛒 Compra mínima ${(sug.promo.minCompra||CUPON_MIN_COMPRA_DESC).toFixed(2)}</div>}
            {generado&&<div style={{marginTop:6,fontWeight:800,letterSpacing:2,color:"#00a887",fontSize:16}}>Nº {generado.id} ✓</div>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            <button style={{...S.btnP,flex:"1 1 100%"}} onClick={()=>{const c=generar();imprimirCupon(c);}}>🖨️ Generar e imprimir cupón</button>
            {sug.cli.tel&&<a href="#" style={{background:"#25d366",color:"#fff",borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:700,textDecoration:"none",flex:1,textAlign:"center"}} onClick={e=>{e.preventDefault();const c=generar();window.open(`https://wa.me/${telWa(c.clienteTel)}?text=${encodeURIComponent(msgWaCupon(c))}`,"_blank");}}>💬 Enviar WhatsApp</a>}
            <button style={{...S.btnC,flex:1}} onClick={onClose}>{generado?"✓ Listo":"Omitir"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 🎁 PROMOS: administración completa (crear, editar, activar/desactivar,
// eliminar) — reemplaza la lista fija; todo se guarda en la nube.
// ═══════════════════════════════════════════════════════════════════
const PROMO_VACIA={tipo:"custom",emoji:"🎁",titulo:"",detalle:"",precio:"",antes:"",monto:"",minCompra:"",claves:"",dias:[]};
function PromosAdmin({promos,setPromos,upsertPromo,servicios}){
  const [form,setForm]=useState(PROMO_VACIA);
  const [editId,setEditId]=useState(null);
  const lista=(promos&&promos.length?promos:DEFAULT_PROMOS);
  const guardar=()=>{
    if(!form.titulo.trim()){alert("Escribe el título de la promo");return;}
    if(form.tipo==="custom"&&!form.precio){alert("Escribe el precio de la promo");return;}
    if(form.tipo==="descuento"&&!form.monto){alert("Escribe el monto del descuento");return;}
    const claves=form.claves.split(",").map(s=>s.trim()).filter(Boolean);
    const base={
      id:editId||("promo_"+Date.now()),
      tipo:form.tipo,emoji:form.emoji||"🎁",titulo:form.titulo.trim(),detalle:form.detalle.trim(),
      dias:form.dias&&form.dias.length?form.dias:null,activa:true,claves,
      precio:form.tipo==="custom"?parseFloat(form.precio)||0:null,
      antes:form.tipo==="custom"&&form.antes?parseFloat(form.antes):null,
      label:form.tipo==="custom"?`🎁 PROMO: ${form.titulo.toUpperCase()}`:null,
      monto:form.tipo==="descuento"?parseFloat(form.monto)||0:null,
      minCompra:form.tipo==="descuento"&&form.minCompra?parseFloat(form.minCompra):null,
      labelDescuento:form.tipo==="descuento"?`🎁 PROMO: -$${(parseFloat(form.monto)||0).toFixed(2)} · ${form.titulo.toUpperCase()}`:null,
      _updatedAt:new Date().toISOString()
    };
    setPromos(prev=>{
      const existe=prev.some(p=>p.id===base.id);
      const next=existe?prev.map(p=>p.id===base.id?{...p,...base}:p):[...prev,base];
      return next;
    });
    if(upsertPromo)upsertPromo(base); // ☁️ a la nube
    setForm(PROMO_VACIA);setEditId(null);
  };
  const editar=p=>{
    setEditId(p.id);
    setForm({
      tipo:p.tipo,emoji:p.emoji||"🎁",titulo:p.titulo||"",detalle:p.detalle||"",
      precio:p.precio!=null?String(p.precio):"",antes:p.antes!=null?String(p.antes):"",
      monto:p.monto!=null?String(p.monto):"",minCompra:p.minCompra!=null?String(p.minCompra):"",
      claves:(p.claves||[]).join(", "),dias:p.dias||[]
    });
  };
  const cancelar=()=>{setEditId(null);setForm(PROMO_VACIA);};
  const toggleActiva=p=>{
    const upd={...p,activa:p.activa===false,_updatedAt:new Date().toISOString()};
    setPromos(prev=>prev.map(x=>x.id===p.id?upd:x));
    if(upsertPromo)upsertPromo(upd);
  };
  const eliminar=p=>{
    if(!window.confirm(`¿Eliminar la promo "${p.titulo}"? Esta acción no se puede deshacer.`))return;
    setPromos(prev=>prev.filter(x=>x.id!==p.id));
    if(upsertPromo)upsertPromo({...p,activa:false,eliminada:true,_updatedAt:new Date().toISOString()});
  };
  const toggleDia=d=>setForm(f=>({...f,dias:f.dias.includes(d)?f.dias.filter(x=>x!==d):[...f.dias,d]}));
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🎁 Promos</h2>
    <Card title={editId?"✏️ Editar promo":"➕ Nueva promo"}>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        <button style={{...S.pill,flex:1,...(form.tipo==="custom"?S.pillA:{})}} onClick={()=>setForm({...form,tipo:"custom"})}>💲 Precio especial</button>
        <button style={{...S.pill,flex:1,...(form.tipo==="descuento"?S.pillA:{})}} onClick={()=>setForm({...form,tipo:"descuento"})}>➖ Descuento en $</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:8,marginBottom:8}}>
        <input style={{...S.inp,textAlign:"center",fontSize:20}} placeholder="🎁" value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})}/>
        <input style={S.inp} placeholder="Título (ej. 2 pares de zapatos por $5.99)" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/>
      </div>
      <input style={{...S.inp,marginBottom:8}} placeholder="Detalle (ej. Antes $7.00 · elige el perfumado)" value={form.detalle} onChange={e=>setForm({...form,detalle:e.target.value})}/>
      {form.tipo==="custom"?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={S.lbl}>Precio de la promo</label><input type="number" style={S.inp} placeholder="5.99" value={form.precio} onChange={e=>setForm({...form,precio:e.target.value})}/></div>
          <div><label style={S.lbl}>Precio antes (tachado, opcional)</label><input type="number" style={S.inp} placeholder="7.00" value={form.antes} onChange={e=>setForm({...form,antes:e.target.value})}/></div>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={S.lbl}>Monto del descuento</label><input type="number" style={S.inp} placeholder="1.00" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></div>
          <div><label style={S.lbl}>Compra mínima (opcional)</label><input type="number" style={S.inp} placeholder={`Por defecto $${CUPON_MIN_COMPRA_DESC.toFixed(2)}`} value={form.minCompra} onChange={e=>setForm({...form,minCompra:e.target.value})}/></div>
        </div>
      )}
      <label style={S.lbl}>¿Qué días aplica?</label>
      <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
        {DOW_LBL.map((l,i)=>(
          <button key={i} style={{...S.pill,fontSize:11,padding:"5px 10px",...(form.dias.includes(i)?S.pillA:{})}} onClick={()=>toggleDia(i)}>{l}</button>
        ))}
      </div>
      <div style={{fontSize:11,color:"#888",marginBottom:8}}>{form.dias.length===0?"Sin días marcados = aplica todos los días":`Solo aplica: ${form.dias.map(d=>DOW_LBL[d]).join(", ")}`}</div>
      <label style={S.lbl}>Palabras clave para detectar consumo (opcional, separadas por coma)</label>
      <input style={{...S.inp,marginBottom:4}} placeholder="ej. zapato, tenis, calzado" value={form.claves} onChange={e=>setForm({...form,claves:e.target.value})}/>
      <div style={{fontSize:11,color:"#888",marginBottom:10}}>Se usan para el sorteo de cupones: si el cliente nunca ha comprado algo con estas palabras, se le sugiere esta promo.</div>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btnP,flex:1}} onClick={guardar}>{editId?"✓ Guardar cambios":"➕ Agregar promo"}</button>
        {editId&&<button style={S.btnC} onClick={cancelar}>Cancelar</button>}
      </div>
    </Card>
    <Card title={`📋 Promos configuradas (${lista.length})`}>
      {lista.length===0?<div style={S.empty}>Sin promos configuradas.</div>:lista.map(p=>(
        <div key={p.id} style={{...S.vcard,borderLeft:`4px solid ${p.activa===false?"#bbb":"#4db6e4"}`,opacity:p.activa===false?0.6:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14}}>{p.emoji} {p.titulo} {p.activa===false&&<span style={{...S.badge,background:"#eee",color:"#888",fontSize:10}}>Inactiva</span>}</div>
              <div style={{fontSize:11,color:"#888"}}>{p.detalle}</div>
              <div style={{fontSize:11,color:"#4db6e4",marginTop:3}}>
                {p.tipo==="descuento"?`Descuento -$${(p.monto||0).toFixed(2)}${p.minCompra?` · mín. $${p.minCompra.toFixed(2)}`:""}`:`$${(p.precio||0).toFixed(2)}${p.antes?` (antes $${p.antes.toFixed(2)})`:""}`}
                {" · "}{(!p.dias||p.dias.length===0)?"Todos los días":p.dias.map(d=>DOW_LBL[d]).join(", ")}
              </div>
              {p.claves&&p.claves.length>0&&<div style={{fontSize:10,color:"#aaa",marginTop:2}}>🎯 {p.claves.join(", ")}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
              <button style={S.btnS} onClick={()=>editar(p)}>✏️</button>
              <button style={{...S.btnS,background:p.activa===false?"#e8f5e9":"#fff3e0",color:p.activa===false?"#2e7d32":"#e65100"}} onClick={()=>toggleActiva(p)}>{p.activa===false?"▶️ Activar":"⏸️ Pausar"}</button>
              <button style={S.btnR} onClick={()=>eliminar(p)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
    </Card>
  </div>);
}

function Cupones({cupones,setCupones,upsertCupon,clientes,ventas,sesion,promos}){
  const [prev,setPrev]=useState(null); // preview del sorteo antes de generar
  const [soloInactivos,setSoloInactivos]=useState(true);
  const listaPromos=(promos&&promos.length?promos:DEFAULT_PROMOS).filter(p=>p.activa!==false);
  const activos=clientes.filter(c=>!c.eliminada);
  const hoy=fechaHoyLocal();
  const conUltima=activos.map(c=>{
    const vs=ventas.filter(v=>String(v.clienteId)===String(c.id)&&!v.anulada);
    const ultima=vs.length?vs.map(v=>fechaLocal(v.fecha)).sort().slice(-1)[0]:null;
    const diasSin=ultima?Math.round((new Date(hoy)-new Date(ultima))/86400000):9999;
    return{...c,vs,ultima,diasSin};
  });
  const elegibles=soloInactivos?conUltima.filter(c=>c.diasSin>=CUPON_DIAS_INACTIVO):conUltima;
  const sortear=()=>{
    if(elegibles.length===0){alert(soloInactivos?"No hay clientes con más de 30 días sin comprar. Prueba incluyendo a todos.":"No hay clientes registrados.");return;}
    if(listaPromos.length===0){alert("No hay promos activas en tu listado. Ve a la pestaña 🎁 Promos y crea o activa alguna.");return;}
    const cli=elegibles[Math.floor(Math.random()*elegibles.length)];
    // 🎯 Solo promos del listado (activas), dirigidas a lo que el cliente NO consume
    const noConsume=listaPromos.filter(p=>!consumeCategoria(cli.vs,p));
    const pool=noConsume.length>0?noConsume:listaPromos;
    const p=pool[Math.floor(Math.random()*pool.length)];
    const cat=nombreCategoria(p);
    const motivo=noConsume.some(x=>x.id===p.id)
      ?(cli.vs.length===0?`Cliente nuevo sin compras — ideal para estrenar ${cat}`:`Nunca ha llevado ${cat} — ¡venta cruzada!`)
      :`Ya consume todo el listado — cupón de refuerzo`;
    setPrev({cli,promo:p,motivo});
  };
  const generar=()=>{
    if(!prev)return;
    const emitido=fechaHoyLocal();
    const cad=new Date();cad.setDate(cad.getDate()+CUPON_DIAS_VALIDEZ);
    const p=prev.promo;
    const cup={
      id:genCodigoCupon(cupones),
      promoId:p.id,promoTipo:p.tipo,promoTitulo:p.titulo,promoDetalle:p.detalle||"",promoEmoji:p.emoji,
      promoLabel:p.tipo==="descuento"?p.labelDescuento:p.label,
      promoPrecio:p.tipo==="custom"?p.precio:null,promoMonto:p.tipo==="descuento"?p.monto:null,
      clienteId:prev.cli.id,clienteNombre:prev.cli.nombre,clienteTel:prev.cli.tel||"",
      emitido,caduca:cad.toISOString().slice(0,10),
      motivo:prev.motivo||"",minCompra:p.tipo==="descuento"?(p.minCompra||CUPON_MIN_COMPRA_DESC):null,
      estado:"vigente",generadoPor:sesion?.nombre||"",fecha:new Date().toISOString()
    };
    setCupones(pv=>[cup,...pv]);
    if(upsertCupon)upsertCupon(cup); // ☁️ cupón guardado en la nube
    setPrev(null);
  };
  const lista=[...cupones].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const nVig=lista.filter(cuponVigente).length;
  const nUsa=lista.filter(c=>c.estado==="usado").length;
  const tasa=lista.length?((nUsa/lista.length)*100).toFixed(0):0;
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🎟️ Cupones Promo</h2>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #1a3c5e"}}><div style={{fontSize:22}}>🎟️</div><div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>{lista.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Emitidos</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #4caf50"}}><div style={{fontSize:22}}>✔️</div><div><div style={{fontWeight:800,fontSize:18,color:"#2e7d32"}}>{nUsa}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Canjeados · {tasa}%</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #f59e0b"}}><div style={{fontSize:22}}>🟢</div><div><div style={{fontWeight:800,fontSize:18,color:"#f59e0b"}}>{nVig}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Vigentes</div></div></div>
    </div>
    <Card title="🎲 Sortear un cupón">
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        <button style={{...S.pill,fontSize:12,...(soloInactivos?S.pillA:{})}} onClick={()=>setSoloInactivos(true)}>😴 Solo poco frecuentes (+{CUPON_DIAS_INACTIVO} días) · {conUltima.filter(c=>c.diasSin>=CUPON_DIAS_INACTIVO).length}</button>
        <button style={{...S.pill,fontSize:12,...(!soloInactivos?S.pillA:{})}} onClick={()=>setSoloInactivos(false)}>👥 Todos · {conUltima.length}</button>
      </div>
      {!prev
        ?<button style={{...S.btnP,width:"100%"}} onClick={sortear}>🎲 Sortear cliente y promo</button>
        :(<div style={{background:"linear-gradient(135deg,#e6fffa,#f0fdfb)",border:"2px solid #00E5B8",borderRadius:12,padding:"14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#00a887",textTransform:"uppercase",letterSpacing:1}}>Resultado del sorteo</div>
            <div style={{fontWeight:800,fontSize:16,color:"#001847",marginTop:4}}>👤 {prev.cli.nombre}</div>
            <div style={{fontSize:11,color:"#888"}}>{prev.cli.diasSin>=9000?"Nunca ha comprado":`Última compra hace ${prev.cli.diasSin} días`}{prev.cli.tel?` · 📱 ${prev.cli.tel}`:" · ⚠️ sin teléfono"}</div>
            <div style={{fontWeight:700,fontSize:14,color:"#1a3c5e",marginTop:8}}>{prev.promo.emoji} {prev.promo.titulo}</div>
            <div style={{fontSize:11,color:"#888"}}>{prev.promo.detalle}</div>
            <div style={{background:"#fff8e1",borderRadius:8,padding:"6px 10px",marginTop:6,fontSize:12,color:"#b45309",fontWeight:600}}>🎯 {prev.motivo}</div>
            {prev.promo.tipo==="descuento"&&<div style={{fontSize:11,color:"#1a3c5e",fontWeight:600,marginTop:4}}>🛒 Válido en compras desde ${(prev.promo.minCompra||CUPON_MIN_COMPRA_DESC).toFixed(2)}</div>}
            <div style={{fontSize:11,color:"#c0392b",fontWeight:600,marginTop:6}}>⏰ Caducará en {CUPON_DIAS_VALIDEZ} días si lo generas hoy</div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button style={{...S.btnP,flex:1}} onClick={generar}>✓ Generar cupón</button>
              <button style={S.btnS} onClick={sortear}>🎲 Volver a sortear</button>
              <button style={S.btnC} onClick={()=>setPrev(null)}>✕</button>
            </div>
          </div>)}
    </Card>
    <Card title={`📜 Cupones emitidos (${lista.length})`}>
      {lista.length===0?<div style={S.empty}>Aún no has emitido cupones. ¡Sortea el primero! 🎲</div>:lista.slice(0,60).map(c=>{
        const est=estadoCupon(c);
        const url=c.clienteTel?`https://wa.me/${telWa(c.clienteTel)}?text=${encodeURIComponent(msgWaCupon(c))}`:null;
        return(<div key={c.id} style={{...S.vcard,borderLeft:`4px solid ${est.col}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:1,color:"#001847"}}>{c.id} <span style={{...S.badge,background:est.bg,color:est.col,fontSize:10,letterSpacing:0}}>{est.i} {est.l}</span></div>
              <div style={{fontSize:13,fontWeight:600,marginTop:2}}>{c.promoEmoji} {c.promoTitulo}</div>
              <div style={{fontSize:11,color:"#888"}}>👤 {c.clienteNombre} · Emitido {fmtD(c.emitido)} · Caduca {fmtD(c.caduca)}</div>
              {c.estado==="usado"&&<div style={{fontSize:11,color:"#546e7a"}}>✔️ Canjeado en {c.usadoEn} el {fmtD(c.usadoFecha)}</div>}
            </div>
            {cuponVigente(c)&&(
              <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                <button style={S.btnS} onClick={()=>imprimirCupon(c)}>🖨️ Imprimir</button>
                {url&&<a href={url} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,textDecoration:"none"}}>💬 Enviar</a>}
              </div>
            )}
          </div>
        </div>);
      })}
    </Card>
  </div>);
}

// ─── CLIENTES: GESTIÓN COMPLETA (ADMIN) ───────────────────────────
// Edición de nombre, teléfono, cédula, email y dirección + historial
// de ventas por cliente. Al editar, se propagan nombre/teléfono/dirección
// a las órdenes activas (no entregadas ni anuladas) para que los mensajes
// de WhatsApp y tickets salgan con los datos correctos.
function Clientes({clientes,setClientes,upsertCliente,ventas,setVentas,upsertVenta}){
  const [q,setQ]=useState("");
  const [orden,setOrden]=useState("recientes");
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const [histId,setHistId]=useState(null);
  const activos=clientes.filter(c=>!c.eliminada);
  const stats=activos.map(c=>{
    const vs=ventas.filter(v=>String(v.clienteId)===String(c.id)&&!v.anulada);
    const gastado=vs.reduce((a,v)=>a+v.total,0);
    const pendiente=vs.reduce((a,v)=>a+saldo(v),0);
    const ultima=vs.length?vs.map(v=>v.fecha).sort().slice(-1)[0]:null;
    return {...c,vs,compras:vs.length,gastado,pendiente,ultima};
  });
  const fil=stats.filter(c=>{
    const s=q.toLowerCase().trim();
    if(!s)return true;
    return (c.nombre||"").toLowerCase().includes(s)||(c.tel||"").includes(s)||(c.cedula||"").includes(s)||(c.email||"").toLowerCase().includes(s);
  }).sort((a,b)=>{
    if(orden==="gastado")return b.gastado-a.gastado;
    if(orden==="compras")return b.compras-a.compras;
    if(orden==="nombre")return (a.nombre||"").localeCompare(b.nombre||"");
    return (b.ultima||"").localeCompare(a.ultima||"");
  });
  const abrirEdicion=c=>{setEditId(c.id);setEd({nombre:c.nombre||"",tel:c.tel||"",cedula:c.cedula||"",email:c.email||"",rfc:c.rfc||"",direccion:c.direccion||"",nacimiento:c.nacimiento||""});setHistId(null);};
  const guardar=()=>{
    if(!ed.nombre.trim()){alert("El nombre es obligatorio");return;}
    const datos={nombre:ed.nombre.trim(),tel:ed.tel.trim(),cedula:ed.cedula.trim(),email:ed.email.trim(),rfc:ed.rfc.trim(),direccion:ed.direccion.trim(),nacimiento:ed.nacimiento||""};
    setClientes(prev=>{
      const next=prev.map(c=>c.id===editId?{...c,...datos}:c);
      const upd=next.find(c=>c.id===editId);
      if(upd&&upsertCliente)upsertCliente({...upd,_updatedAt:new Date().toISOString()});
      return next;
    });
    // Sincroniza los datos de contacto en las órdenes activas del cliente
    setVentas(prev=>prev.map(v=>{
      if(String(v.clienteId)!==String(editId)||v.anulada||(v.estado||"recibido")==="entregado")return v;
      const v2={...v,clienteNombre:datos.nombre,clienteTel:datos.tel,clienteDireccion:datos.direccion};
      if(upsertVenta)upsertVenta(v2);
      return v2;
    }));
    setEditId(null);
  };
  const eliminar=c=>{
    const msg=c.compras>0
      ?`${c.nombre} tiene ${c.compras} venta(s). Se ocultará de la lista pero su historial de ventas se conserva. ¿Eliminar?`
      :`¿Eliminar a ${c.nombre}?`;
    if(!window.confirm(msg))return;
    setClientes(prev=>{
      const next=prev.map(x=>x.id===c.id?{...x,eliminada:true}:x);
      const upd=next.find(x=>x.id===c.id);
      if(upd&&upsertCliente)upsertCliente({...upd,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const totalCartera=stats.reduce((a,c)=>a+c.gastado,0);
  const totalPend=stats.reduce((a,c)=>a+c.pendiente,0);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>👥 Clientes</h2>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #1a3c5e"}}><div style={{fontSize:22}}>👥</div><div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>{activos.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Clientes activos</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #4caf50"}}><div style={{fontSize:22}}>💚</div><div><div style={{fontWeight:800,fontSize:18,color:"#2e7d32"}}>${totalCartera.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Ventas históricas</div>{totalPend>0&&<div style={{fontSize:11,color:"#e65100"}}>⏳ ${totalPend.toFixed(2)} por cobrar</div>}</div></div>
    </div>
    {(()=>{
      const conCumple=stats.map(c=>({...c,dc:diasParaCumple(c.nacimiento)})).filter(c=>c.dc!==null&&c.dc<=7).sort((a,b)=>a.dc-b.dc);
      if(conCumple.length===0)return null;
      const hoyC=conCumple.filter(c=>c.dc===0);
      const prox=conCumple.filter(c=>c.dc>0);
      return(<Card title="🎂 Cumpleaños">
        {hoyC.map(c=>{
          const url=waCumpleUrl(c);
          return(<div key={c.id} style={{background:"linear-gradient(135deg,#fff8e1,#ffecb3)",border:"2px solid #f59e0b",borderRadius:12,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:24}}>🎉</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,color:"#b45309",fontSize:14}}>¡Hoy cumple {c.nombre}!</div>
              <div style={{fontSize:11,color:"#92600a"}}>Envíale su felicitación con el 10% de descuento</div>
            </div>
            {url
              ?<a href={url} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,textDecoration:"none",flexShrink:0}}>💬 Felicitar</a>
              :<span style={{fontSize:11,color:"#c62828"}}>Sin teléfono</span>}
          </div>);
        })}
        {prox.length>0&&(<div>
          <div style={{fontSize:11,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,margin:"4px 0 4px"}}>Próximos 7 días</div>
          {prox.map(c=>(<div key={c.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:"1px solid #f0f4f8"}}>
            <span>🎂 {c.nombre}</span>
            <span style={{color:"#888",fontSize:12}}>{c.dc===1?"mañana":`en ${c.dc} días`} ({c.nacimiento.slice(8,10)}/{c.nacimiento.slice(5,7)})</span>
          </div>))}
        </div>)}
      </Card>);
    })()}
    <Card title="🔍 Buscar cliente">
      <input style={S.inp} placeholder="Nombre, teléfono, cédula o email..." value={q} onChange={e=>setQ(e.target.value)}/>
      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        {[{id:"recientes",l:"🕐 Recientes"},{id:"gastado",l:"💵 Más gastan"},{id:"compras",l:"🧾 Más compran"},{id:"nombre",l:"🔤 A-Z"}].map(o=>(
          <button key={o.id} style={{...S.pill,fontSize:11,...(orden===o.id?S.pillA:{})}} onClick={()=>setOrden(o.id)}>{o.l}</button>
        ))}
      </div>
    </Card>
    <Card title={`📇 Directorio (${fil.length})`}>
      {fil.length===0?<div style={S.empty}>Sin clientes{q?` que coincidan con "${q}"`:""}</div>:fil.slice(0,100).map(c=>(
        <div key={c.id} style={{...S.vcard,borderLeft:`4px solid ${c.pendiente>0?"#ff9800":"#4db6e4"}`}}>
          {editId===c.id?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Nombre *</label><input style={S.inp} value={ed.nombre} onChange={e=>setEd({...ed,nombre:e.target.value})}/></div>
                <div><label style={S.lbl}>Teléfono</label><input style={S.inp} placeholder="09..." value={ed.tel} onChange={e=>setEd({...ed,tel:e.target.value})}/></div>
                <div><label style={S.lbl}>Cédula</label><input style={S.inp} value={ed.cedula} onChange={e=>setEd({...ed,cedula:e.target.value})}/></div>
                <div><label style={S.lbl}>Email</label><input style={S.inp} value={ed.email} onChange={e=>setEd({...ed,email:e.target.value})}/></div>
                <div><label style={S.lbl}>RUC</label><input style={S.inp} value={ed.rfc} onChange={e=>setEd({...ed,rfc:e.target.value})}/></div>
                <div><label style={S.lbl}>🎂 Nacimiento</label><input type="date" style={S.inp} value={ed.nacimiento} onChange={e=>setEd({...ed,nacimiento:e.target.value})}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Dirección</label><input style={S.inp} placeholder="📍 Dirección" value={ed.direccion} onChange={e=>setEd({...ed,direccion:e.target.value})}/></div>
              </div>
              <div style={{fontSize:11,color:"#888",marginBottom:8}}>ℹ️ El nombre y teléfono se actualizarán también en sus órdenes activas.</div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btnP,flex:1}} onClick={guardar}>✓ Guardar cambios</button>
                <button style={S.btnC} onClick={()=>setEditId(null)}>Cancelar</button>
              </div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15}}>{c.nombre}</div>
                  <div style={{fontSize:12,color:"#888"}}>
                    {c.tel?`📱 ${c.tel}`:"📱 sin teléfono"}{c.cedula?` · 🪪 ${c.cedula}`:""}
                  </div>
                  {c.email&&<div style={{fontSize:11,color:"#888"}}>✉️ {c.email}</div>}
                  {c.nacimiento&&<div style={{fontSize:11,color:esCumpleHoy(c.nacimiento)?"#b45309":"#888",fontWeight:esCumpleHoy(c.nacimiento)?700:400}}>🎂 {c.nacimiento.slice(8,10)}/{c.nacimiento.slice(5,7)}{esCumpleHoy(c.nacimiento)?" · ¡HOY cumple años! 🎉":""}</div>}
                  {c.direccion&&<div style={{fontSize:11,color:"#888"}}>📍 {c.direccion}</div>}
                  <div style={{fontSize:11,color:"#4db6e4",marginTop:3}}>
                    {c.compras} compra{c.compras!==1?"s":""} · ${c.gastado.toFixed(2)}{c.ultima?` · última: ${fmtD(c.ultima)}`:""}
                  </div>
                  {c.pendiente>0&&<div style={{...S.badge,background:"#fff3e0",color:"#e65100",marginTop:4}}>⏳ Debe ${c.pendiente.toFixed(2)}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  <button style={S.btnS} onClick={()=>abrirEdicion(c)}>✏️ Editar</button>
                  <button style={S.btnS} onClick={()=>setHistId(histId===c.id?null:c.id)}>{histId===c.id?"▲ Ocultar":"📋 Historial"}</button>
                  <button style={S.btnR} onClick={()=>eliminar(c)}>🗑️</button>
                </div>
              </div>
              {histId===c.id&&(
                <div style={{marginTop:10,borderTop:"1.5px dashed #d0dce8",paddingTop:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Historial de ventas ({c.vs.length})</div>
                  {c.vs.length===0?<div style={S.empty}>Sin ventas registradas</div>:
                    [...c.vs].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,30).map(v=>{
                      const est=getEst(v);const p=pagada(v);
                      return(<div key={v.folio} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f0f4f8",fontSize:13}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:600}}>{v.folio} <span style={{...S.badge,background:est.bg,color:est.color,fontSize:10}}>{est.icon} {est.label}</span></div>
                          <div style={{fontSize:11,color:"#888"}}>{fmt(v.fecha)} · {(v.items||[]).map(it=>it.label).join(", ").slice(0,60)}{(v.items||[]).map(it=>it.label).join(", ").length>60?"…":""}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontWeight:800}}>${v.total.toFixed(2)}</div>
                          <div style={{...S.badge,background:p?"#e8f5e9":"#fff3e0",color:p?"#2e7d32":"#e65100",fontSize:10}}>{p?"✅ Pagado":`⏳ $${saldo(v).toFixed(2)}`}</div>
                        </div>
                      </div>);
                    })}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#1a3c5e",paddingTop:8}}>
                    <span>Total histórico</span><span>${c.gastado.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </Card>
  </div>);
}

// ─── DASHBOARD BI: META MENSUAL AUTOMÁTICA + PROGRESO + BONOS ─────
// La meta se calcula sola con el historial completo: promedio de los
// últimos 3 meses cerrados + 10% de crecimiento (redondeado a $10).
// Si aún no hay meses cerrados, usa la proyección del mes en curso.
function DashboardBI({ventas,empleadas,gastos}){
  const hoyD=new Date();
  const mesAct=mesK(hoyD);
  const diaMes=hoyD.getDate();
  const diasMes=new Date(hoyD.getFullYear(),hoyD.getMonth()+1,0).getDate();
  const [mesSel,setMesSel]=useState(mesAct);
  const esMesActual=mesSel===mesAct;
  const vOk=ventas.filter(v=>!v.anulada);
  // Totales por mes (historial completo)
  const porMes={};vOk.forEach(v=>{const k=mesK(v.fecha);porMes[k]={tot:(porMes[k]?.tot||0)+v.total,cnt:(porMes[k]?.cnt||0)+1};});
  const vMes=vOk.filter(v=>mesK(v.fecha)===mesSel);
  const ventaMes=vMes.reduce((a,v)=>a+v.total,0);
  const cobradoMes=vOk.flatMap(v=>(v.abonos||[]).filter(ab=>mesK(ab.fecha)===mesSel)).reduce((a,ab)=>a+ab.monto,0);
  // Meta automática: promedio de últimos 3 meses cerrados anteriores al mes seleccionado, +10%
  const cerrados=Object.keys(porMes).filter(k=>k<mesSel).sort();
  const ult3=cerrados.slice(-3).map(k=>porMes[k].tot);
  const diasTranscurridos=esMesActual?diaMes:diasMes;
  let meta,origenMeta;
  if(ult3.length>0){
    // Ponderado: el mes más reciente pesa más (50/30/20) — refleja mejor la tendencia real
    const pesos=ult3.length===3?[0.2,0.3,0.5]:ult3.length===2?[0.4,0.6]:[1];
    const prom=ult3.reduce((a,b,i)=>a+b*pesos[i],0);
    meta=Math.max(10,Math.ceil((prom*1.10)/10)*10);
    origenMeta=`Promedio ponderado de ${ult3.length} mes${ult3.length>1?"es":""} (los recientes pesan más: $${prom.toFixed(0)}) + 10% de crecimiento`;
  }else{
    const proy=(ventaMes/Math.max(1,diasTranscurridos))*diasMes;
    meta=Math.max(10,Math.ceil(proy/10)*10);
    origenMeta="Sin meses cerrados aún — meta según el ritmo del propio mes";
  }
  const pct=Math.min(100,meta>0?(ventaMes/meta)*100:0);
  const pctReal=meta>0?(ventaMes/meta)*100:0;
  const pctEsperado=(diasTranscurridos/diasMes)*100;
  const faltante=Math.max(0,meta-ventaMes);
  const diasRestantes=Math.max(0,diasMes-diasTranscurridos);
  const ritmoNecesario=diasRestantes>0?faltante/diasRestantes:0;
  const adelantada=pctReal>=pctEsperado;
  const ritmoActual=ventaMes/Math.max(1,diasTranscurridos);
  // ── Patrón por día de la semana (últimos 90 días, incluye días en cero) ──
  const diario={};vOk.forEach(v=>{const f=fechaLocal(v.fecha);diario[f]=(diario[f]||0)+v.total;});
  const fechasCon=Object.keys(diario).sort();
  const sumDow=[0,0,0,0,0,0,0],cntDow=[0,0,0,0,0,0,0];
  if(fechasCon.length){
    const lim=new Date(hoyD);lim.setDate(lim.getDate()-90);
    let d0=new Date(fechasCon[0]+"T12:00:00");if(d0<lim)d0=lim;
    const ayer=new Date(hoyD);ayer.setDate(ayer.getDate()-1);
    for(let d=new Date(d0);d<=ayer;d.setDate(d.getDate()+1)){
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      sumDow[d.getDay()]+=diario[k]||0;cntDow[d.getDay()]++;
    }
  }
  const histDias=cntDow.reduce((a,b)=>a+b,0);
  const promDow=sumDow.map((s,i)=>cntDow[i]>0?s/cntDow[i]:0);
  // Proyección: patrón semanal escalado por el ritmo del mes actual
  const proySimple=ritmoActual*diasMes;
  let proyeccion=proySimple,proyMetodo="simple",fechaMetaEst=null;
  const dowDe=dia=>new Date(hoyD.getFullYear(),hoyD.getMonth(),dia).getDay();
  if(esMesActual&&histDias>=14){
    let expMTD=0;for(let d=1;d<=diasTranscurridos;d++)expMTD+=promDow[dowDe(d)];
    const factor=expMTD>0?Math.min(1.8,Math.max(0.6,ventaMes/expMTD)):1;
    let acum=ventaMes;
    for(let d=diasTranscurridos+1;d<=diasMes;d++){
      acum+=promDow[dowDe(d)]*factor;
      if(!fechaMetaEst&&acum>=meta)fechaMetaEst=new Date(hoyD.getFullYear(),hoyD.getMonth(),d);
    }
    proyeccion=acum;proyMetodo="inteligente";
    if(ventaMes>=meta)fechaMetaEst=null;
  }else if(ritmoActual>0){
    const dpm=Math.ceil(meta/ritmoActual);
    if(dpm<=diasMes&&ventaMes<meta)fechaMetaEst=new Date(hoyD.getFullYear(),hoyD.getMonth(),dpm);
  }
  const brechaProy=+(proyeccion-meta).toFixed(2);
  // Comparativa vs mes pasado a la misma altura + mejor día
  const [aY,aM]=mesSel.split("-").map(Number);
  const prevK=`${aM===1?aY-1:aY}-${String(aM===1?12:aM-1).padStart(2,"0")}`;
  const prevMTD=vOk.filter(v=>{const f=fechaLocal(v.fecha);return f.startsWith(prevK)&&parseInt(f.slice(8))<=diasTranscurridos;}).reduce((a,v)=>a+v.total,0);
  const varMTD=prevMTD>0?((ventaMes-prevMTD)/prevMTD)*100:null;
  const DOWN=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const mejorDow=promDow.some(x=>x>0)?promDow.indexOf(Math.max(...promDow)):null;
  let quedanMejor=0;if(mejorDow!==null&&esMesActual)for(let d=diasTranscurridos+1;d<=diasMes;d++)if(dowDe(d)===mejorDow)quedanMejor++;
  // Serie de meses para la gráfica (hasta 12)
  const serieKeys=[...new Set([...Object.keys(porMes),mesAct])].sort().slice(-12);
  const serie=serieKeys.map(k=>({k,l:k.slice(5)+"/"+k.slice(2,4),v:porMes[k]?.tot||0}));
  const maxSerie=Math.max(...serie.map(s=>s.v),meta,1);
  // Ventas por día del mes seleccionado
  const porDia={};vMes.forEach(v=>{const d=parseInt(fechaLocal(v.fecha).slice(8));porDia[d]=(porDia[d]||0)+v.total;});
  const dias=Array.from({length:esMesActual?diaMes:diasMes},(_,i)=>({d:i+1,v:porDia[i+1]||0}));
  const maxDia=Math.max(...dias.map(x=>x.v),1);
  // Métodos de pago (cobros del mes seleccionado)
  const metodos=PAGOS.map(p=>({p,v:vOk.flatMap(v=>(v.abonos||[]).filter(ab=>ab.metodo===p&&mesK(ab.fecha)===mesSel)).reduce((a,ab)=>a+ab.monto,0)})).filter(m=>m.v>0);
  const totMet=metodos.reduce((a,m)=>a+m.v,0);
  const colMet={"Efectivo":"#4caf50","Transferencia Pichincha":"#1565c0","Transferencia JEP":"#7c3aed","Tarjeta":"#e65100"};
  // Top servicios y top clientes del mes
  const srvMap={};vMes.forEach(v=>(v.items||[]).forEach(it=>{const sub=(it.precio||0)*(it.piezas||1);if(!srvMap[it.label])srvMap[it.label]={v:0,n:0};srvMap[it.label].v+=sub;srvMap[it.label].n+=(it.piezas||1);}));
  const topSrv=Object.entries(srvMap).sort((a,b)=>b[1].v-a[1].v).slice(0,5);
  const cliMap={};vMes.forEach(v=>{const n=v.clienteNombre||"Sin nombre";if(!cliMap[n])cliMap[n]={v:0,n:0};cliMap[n].v+=v.total;cliMap[n].n++;});
  const topCli=Object.entries(cliMap).sort((a,b)=>b[1].v-a[1].v).slice(0,5);
  // Gastos y utilidad estimada del mes
  const gastosMes=(gastos||[]).filter(g=>!g.eliminada&&fechaLocal(g.fecha).startsWith(mesSel)).reduce((a,g)=>a+g.monto,0);
  const utilidad=ventaMes-gastosMes;
  // Bonos por empleada (mes seleccionado)
  const bonos=empleadas.filter(e=>e.activa||vMes.some(v=>v.empleadaId===e.id)).map(e=>{
    const mv=vMes.filter(v=>v.empleadaId===e.id);
    const metaE=e.metaVentas||20;
    const cumple=mv.length>=metaE;
    return{...e,cnt:mv.length,tot:mv.reduce((a,v)=>a+v.total,0),metaE,cumple,pctE:Math.min(100,(mv.length/metaE)*100)};
  }).sort((a,b)=>b.cnt-a.cnt);
  const totBonos=bonos.filter(b=>b.cumple).reduce((a,b)=>a+(b.montoBonus||0),0);
  const semColor=pctReal>=100?"#4caf50":adelantada?"#4db6e4":"#e53935";
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🚀 Dashboard BI</h2>
    <div style={{marginBottom:12}}><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={mesSel} onChange={e=>setMesSel(e.target.value||mesAct)}/></div>

    {/* META MENSUAL AUTOMÁTICA */}
    <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:14,padding:"18px 18px 16px",marginBottom:14,color:"#fff",boxShadow:"0 4px 16px rgba(26,60,94,.3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#a0c4da",textTransform:"uppercase",letterSpacing:0.5}}>🎯 Meta del mes (automática)</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,marginTop:2}}>${meta.toFixed(2)}</div>
          <div style={{fontSize:11,color:"#a0c4da",marginTop:2}}>{origenMeta}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:26,fontWeight:800,color:semColor==="#e53935"?"#ffab91":semColor==="#4caf50"?"#a5d6a7":"#81d4fa"}}>{pctReal.toFixed(0)}%</div>
          <div style={{fontSize:11,color:"#a0c4da"}}>alcanzado</div>
        </div>
      </div>
      <div style={{marginTop:12,position:"relative"}}>
        <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,height:14,overflow:"hidden"}}>
          <div style={{background:pctReal>=100?"#4caf50":"#4dd9e8",width:`${pct}%`,height:"100%",borderRadius:8,transition:"width .4s"}}/>
        </div>
        {esMesActual&&<div title="Avance esperado a hoy" style={{position:"absolute",top:-3,bottom:-3,left:`${Math.min(100,pctEsperado)}%`,width:2,background:"#fff",opacity:0.9}}/>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:6,color:"#e3f2fd"}}>
        <span>Vendido: <strong>${ventaMes.toFixed(2)}</strong></span>
        {esMesActual&&<span>Esperado a hoy: {pctEsperado.toFixed(0)}%</span>}
        <span>Falta: <strong>${faltante.toFixed(2)}</strong></span>
      </div>
      {esMesActual&&(
        <div style={{marginTop:10,background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 12px",fontSize:12}}>
          {pctReal>=100
            ?<span>🎉 <strong>¡Meta cumplida!</strong> Todo lo que vendas ahora es crecimiento extra.</span>
            :adelantada
              ?<span>💪 Vas <strong>adelantada</strong>. Proyección de cierre: <strong>${proyeccion.toFixed(2)}</strong>.</span>
              :<span>⚡ Necesitas <strong>${ritmoNecesario.toFixed(2)}/día</strong> los próximos {diasRestantes} día{diasRestantes!==1?"s":""} para llegar. Proyección actual: ${proyeccion.toFixed(2)}.</span>}
        </div>
      )}
    </div>

    <Card title="🔎 Camino a la meta (detalle)">
      {esMesActual?(<>
        {[
          ["📆 Días transcurridos",`${diasTranscurridos} de ${diasMes} (${((diasTranscurridos/diasMes)*100).toFixed(0)}% del mes)`],
          ["⏳ Días restantes",`${diasRestantes} día${diasRestantes!==1?"s":""}`],
          ["💵 Vendido hasta hoy",`$${ventaMes.toFixed(2)} (${pctReal.toFixed(1)}% de la meta)`],
          ["🎯 Meta del mes",`$${meta.toFixed(2)}`],
          ["🧗 Falta para la meta",`$${faltante.toFixed(2)} (${Math.max(0,100-pctReal).toFixed(1)}%)`],
          ["🏃 Ritmo actual",`$${ritmoActual.toFixed(2)} por día`],
          ["⚡ Ritmo necesario",faltante<=0?"¡Ya llegaste! 🎉":`$${ritmoNecesario.toFixed(2)} por día los próximos ${diasRestantes} día${diasRestantes!==1?"s":""}`],
          ...(varMTD!==null?[["📊 vs mes pasado (a esta altura)",`${varMTD>=0?"▲ +":"▼ "}${varMTD.toFixed(1)}% ($${ventaMes.toFixed(0)} vs $${prevMTD.toFixed(0)})`]]:[]),
          ...(mejorDow!==null?[["🌟 Tu mejor día de venta",`${DOWN[mejorDow]} (prom. $${promDow[mejorDow].toFixed(2)})${quedanMejor>0?` · quedan ${quedanMejor} este mes 💪`:""}`]]:[]),
        ].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderBottom:"1px solid #f0f4f8"}}>
            <span style={{color:"#666"}}>{l}</span><strong style={{textAlign:"right"}}>{v}</strong>
          </div>
        ))}
        <div style={{background:brechaProy>=0?"#e8f5e9":"#fff3e0",border:`1.5px solid ${brechaProy>=0?"#4caf50":"#ff9800"}`,borderRadius:10,padding:"10px 12px",marginTop:10}}>
          <div style={{fontSize:11,fontWeight:700,color:brechaProy>=0?"#2e7d32":"#e65100",textTransform:"uppercase",letterSpacing:0.5}}>🔮 Proyección de cierre {proyMetodo==="inteligente"?"· inteligente":"· simple"}</div>
          <div style={{fontWeight:800,fontSize:20,color:brechaProy>=0?"#2e7d32":"#e65100"}}>${proyeccion.toFixed(2)}</div>
          <div style={{fontSize:12,color:brechaProy>=0?"#2e7d32":"#b45309",marginTop:2}}>
            {brechaProy>=0
              ?`Al ritmo actual cerrarías $${brechaProy.toFixed(2)} POR ENCIMA de la meta 🎉${fechaMetaEst?` · La alcanzarías el ${fechaMetaEst.toLocaleDateString("es-EC",{day:"numeric",month:"long"})}`:""}`
              :`Al ritmo actual cerrarías $${Math.abs(brechaProy).toFixed(2)} por debajo de la meta. Sube el ritmo a $${ritmoNecesario.toFixed(2)}/día para lograrla 💪`}
          </div>
          <div style={{fontSize:10,color:"#888",marginTop:5}}>{proyMetodo==="inteligente"
            ?"Calculada con tu patrón real por día de la semana (últimos 90 días) ajustado al ritmo de este mes — más precisa que un promedio simple."
            :"Promedio diario simple — se volverá más precisa cuando haya al menos 2 semanas de historial."}</div>
        </div>
      </>):(
        <div style={{textAlign:"center",padding:"8px 0"}}>
          <div style={{fontSize:32}}>{pctReal>=100?"🏆":"📊"}</div>
          <div style={{fontWeight:800,fontSize:18,color:pctReal>=100?"#2e7d32":"#1a3c5e"}}>{pctReal>=100?"¡Meta cumplida!":"Mes cerrado"}</div>
          <div style={{fontSize:13,color:"#666",marginTop:4}}>Vendido: <strong>${ventaMes.toFixed(2)}</strong> de ${meta.toFixed(2)} ({pctReal.toFixed(1)}%){pctReal<100?` · Faltaron $${faltante.toFixed(2)}`:` · Superada por $${(ventaMes-meta).toFixed(2)}`}</div>
        </div>
      )}
    </Card>

    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #4caf50"}}><div style={{fontSize:22}}>💚</div><div><div style={{fontWeight:800,fontSize:18,color:"#2e7d32"}}>${cobradoMes.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Cobrado en el mes</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #4db6e4"}}><div style={{fontSize:22}}>🧾</div><div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>{vMes.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Ventas · ticket ${vMes.length?(ventaMes/vMes.length).toFixed(2):"0.00"}</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #e53935"}}><div style={{fontSize:22}}>🛒</div><div><div style={{fontWeight:800,fontSize:18,color:"#e53935"}}>-${gastosMes.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Gastos del mes</div></div></div>
      <div style={{...S.kpi,borderLeft:`4px solid ${utilidad>=0?"#4caf50":"#e53935"}`}}><div style={{fontSize:22}}>{utilidad>=0?"📈":"📉"}</div><div><div style={{fontWeight:800,fontSize:18,color:utilidad>=0?"#2e7d32":"#c62828"}}>${utilidad.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Utilidad estimada</div></div></div>
    </div>

    <Card title="📊 Evolución mensual vs meta">
      <div style={{position:"relative"}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:150,padding:"14px 2px 0"}}>
          {serie.map(s=>{
            const h=Math.max(4,(s.v/maxSerie)*110);
            const esSel=s.k===mesSel;
            return(<div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:3,minWidth:0,height:"100%"}}>
              <div style={{fontSize:9,fontWeight:700,color:esSel?"#1a3c5e":"#aaa"}}>${s.v>=1000?(s.v/1000).toFixed(1)+"k":s.v.toFixed(0)}</div>
              <div title={`${s.l}: $${s.v.toFixed(2)}`} style={{width:"100%",maxWidth:34,height:h,background:esSel?"linear-gradient(180deg,#4dd9e8,#1a3c5e)":"#c8dcec",borderRadius:"5px 5px 0 0"}}/>
              <div style={{fontSize:9,color:esSel?"#1a3c5e":"#888",fontWeight:esSel?800:500}}>{s.l}</div>
            </div>);
          })}
        </div>
        {/* Línea de meta: se dibuja a la altura proporcional de la meta (base de barras = 14px de etiqueta inferior) */}
        <div style={{position:"absolute",left:0,right:0,bottom:14+(meta/maxSerie)*110,borderTop:"2px dashed #f59e0b",pointerEvents:"none"}}>
          <span style={{position:"absolute",right:0,top:-16,fontSize:9,fontWeight:700,color:"#f59e0b",background:"#fff8e1",padding:"1px 6px",borderRadius:6}}>Meta ${meta.toFixed(0)}</span>
        </div>
      </div>
    </Card>

    <Card title="📅 Ventas por día del mes">
      {dias.every(d=>d.v===0)?<div style={S.empty}>Sin ventas en {mesSel}</div>:(
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80}}>
          {dias.map(x=>(
            <div key={x.d} title={`Día ${x.d}: $${x.v.toFixed(2)}`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:"100%",height:Math.max(2,(x.v/maxDia)*60),background:x.v>0?"#4db6e4":"#eef3f8",borderRadius:2}}/>
              {(x.d===1||x.d%5===0)&&<div style={{fontSize:8,color:"#aaa"}}>{x.d}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>

    {metodos.length>0&&<Card title="💳 Cobros por método de pago">
      <div style={{display:"flex",height:14,borderRadius:8,overflow:"hidden",marginBottom:10}}>
        {metodos.map(m=><div key={m.p} title={`${m.p}: $${m.v.toFixed(2)}`} style={{width:`${(m.v/totMet)*100}%`,background:colMet[m.p]||"#888"}}/>)}
      </div>
      {metodos.map(m=>(
        <div key={m.p} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}>
          <span><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:colMet[m.p]||"#888",marginRight:6}}/>{m.p}</span>
          <strong>${m.v.toFixed(2)} <span style={{color:"#888",fontWeight:500,fontSize:11}}>({((m.v/totMet)*100).toFixed(0)}%)</span></strong>
        </div>
      ))}
    </Card>}

    <Card title="🧺 Top servicios del mes">
      {topSrv.length===0?<div style={S.empty}>Sin datos</div>:topSrv.map(([lbl,d],i)=>{
        const max=topSrv[0][1].v;
        return(<div key={lbl} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
            <span style={{fontWeight:600}}>{i+1}. {lbl} <span style={{color:"#888"}}>×{d.n}</span></span><strong>${d.v.toFixed(2)}</strong>
          </div>
          <div style={{background:"#e8f0f7",borderRadius:4,height:8}}><div style={{background:"#1a3c5e",width:`${(d.v/max)*100}%`,height:"100%",borderRadius:4}}/></div>
        </div>);
      })}
    </Card>

    <Card title="⭐ Top clientes del mes">
      {topCli.length===0?<div style={S.empty}>Sin datos</div>:topCli.map(([n,d],i)=>(
        <div key={n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f0f4f8",fontSize:13}}>
          <span><span style={{fontWeight:800,color:"#4db6e4"}}>{i+1}.</span> <span style={{fontWeight:600}}>{n}</span> <span style={{color:"#888",fontSize:11}}>({d.n} compra{d.n!==1?"s":""})</span></span>
          <strong>${d.v.toFixed(2)}</strong>
        </div>
      ))}
    </Card>

    <Card title="🎯 Impulsaciones de promos">
      {(()=>{
        const conImp=vMes.filter(v=>(v.impulsos||[]).length>0);
        const totImp=vMes.reduce((a,v)=>a+((v.impulsos||[]).length),0);
        if(totImp===0)return <div style={S.empty}>Sin impulsaciones registradas en {mesSel}. Cada vez que una colaboradora toca una promo en la ventana de venta, se registra aquí. 🎁</div>;
        const porEmp={};
        vMes.forEach(v=>{const n=(v.impulsos||[]).length;if(n===0)return;const e=empleadas.find(x=>x.id===v.empleadaId);const nom=e?.nombre||"Sin asignar";if(!porEmp[nom])porEmp[nom]={imp:0,ventas:0,monto:0};porEmp[nom].imp+=n;porEmp[nom].ventas++;porEmp[nom].monto+=v.total;});
        const rank=Object.entries(porEmp).sort((a,b)=>b[1].imp-a[1].imp);
        const porPromo={};
        vMes.forEach(v=>(v.impulsos||[]).forEach(im=>{porPromo[im.titulo]=(porPromo[im.titulo]||0)+1;}));
        const topP=Object.entries(porPromo).sort((a,b)=>b[1]-a[1]);
        const maxI=rank[0][1].imp;
        return(<>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontWeight:800,fontSize:20,color:"#1a3c5e"}}>{totImp}</div><div style={{fontSize:11,color:"#888"}}>Impulsaciones</div></div>
            <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontWeight:800,fontSize:20,color:"#1a3c5e"}}>{conImp.length}</div><div style={{fontSize:11,color:"#888"}}>Ventas con promo</div></div>
            <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontWeight:800,fontSize:20,color:"#2e7d32"}}>{vMes.length?((conImp.length/vMes.length)*100).toFixed(0):0}%</div><div style={{fontSize:11,color:"#888"}}>De las ventas</div></div>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Por colaboradora</div>
          {rank.map(([nom,d],i)=>(
            <div key={nom} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:2}}>
                <span style={{fontWeight:600}}>{i===0?"🏆 ":""}{nom} <span style={{color:"#888",fontSize:11}}>({d.ventas} venta{d.ventas!==1?"s":""})</span></span>
                <strong>{d.imp} impulso{d.imp!==1?"s":""}</strong>
              </div>
              <div style={{background:"#e8f0f7",borderRadius:4,height:8}}><div style={{background:i===0?"#f59e0b":"#4db6e4",width:`${(d.imp/maxI)*100}%`,height:"100%",borderRadius:4}}/></div>
            </div>
          ))}
          <div style={{fontSize:11,fontWeight:700,color:"#4db6e4",textTransform:"uppercase",letterSpacing:0.5,margin:"10px 0 4px"}}>Promos más impulsadas</div>
          {topP.map(([t,n])=>(
            <div key={t} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}>
              <span>{t}</span><strong>×{n}</strong>
            </div>
          ))}
        </>);
      })()}
    </Card>

    <Card title="🌟 Bonos por empleada">
      {bonos.length===0?<div style={S.empty}>Sin empleadas activas</div>:(
        <>
          {bonos.map(b=>(
            <div key={b.id} style={{padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{b.nombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{b.cnt}/{b.metaE} ventas · ${b.tot.toFixed(2)}</div>
                </div>
                {b.cumple
                  ?<div style={{...S.badge,background:"#fff8e1",color:"#f59e0b"}}>🌟 Bono ${(b.montoBonus||0).toFixed(2)}</div>
                  :<div style={{fontSize:11,color:"#888"}}>Faltan {b.metaE-b.cnt}</div>}
              </div>
              <div style={{background:"#e8f0f7",borderRadius:6,height:8,marginTop:5}}>
                <div style={{background:b.cumple?"#f59e0b":"#4db6e4",width:`${b.pctE}%`,height:"100%",borderRadius:6}}/>
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 2px",fontWeight:800,color:"#1a3c5e",fontSize:14}}>
            <span>💰 Total bonos a pagar</span><span style={{color:totBonos>0?"#f59e0b":"#888"}}>${totBonos.toFixed(2)}</span>
          </div>
        </>
      )}
    </Card>
  </div>);
}

function AppContent({sesion,onLogout}){
  const hoy=fechaHoyLocal();
  const AK="ll_apertura_"+hoy+"_"+sesion.id;
  // CK unico por sesion - _sesId es timestamp unico por cada login
  const sesId=sesion._sesId||Date.now().toString();
  const CK="ll_cierre_"+hoy+"_"+sesion.id+"_"+sesId;
  // Estos 3 estados siempre empiezan en false porque AppContent se remonta con key={sesId}
  const [cajaOk,setCajaOk]=useState(false);
  const [cierreOk,setCierreOk]=useState(false);
  const [esperandoApertura,setEsperandoApertura]=useState(false);
  const [tab,setTab]=useState("ventas");
  const { data: ventas, setData: setVentas, upsert: upsertVenta } = useCollection("ventas", KEYS.ventas, []);
const { data: clientes, setData: setClientes, upsert: upsertCliente } = useCollection("clientes", KEYS.clientes, []);
const { data: empleadas, setData: setEmpleadas, upsert: upsertEmpleada } = useCollection("empleadas", KEYS.empleadas, EMPLEADAS_DEFAULT);
const { data: inventario, setData: setInventario, upsert: upsertInventario } = useCollection("inventario", KEYS.inventario, INSUMOS_DEFAULT);
const { data: servicios, setData: setServicios, upsert: upsertServicio } = useCollection("servicios", KEYS.servicios, SERVICIOS_DEFAULT);
const { data: gastos, setData: setGastos, upsert: upsertGasto } = useCollection("gastos", "ll_gastos", []);
const { data: depositos, setData: setDepositos, upsert: upsertDeposito } = useCollection("depositos", "ll_depositos", []);
const { data: salidasCaja, setData: setSalidasCaja, upsert: upsertSalida } = useCollection("salidasCaja", "ll_salidas_caja", []);
const { data: cajas, upsert: upsertCaja, nube } = useCollection("cajas", "ll_cajas", []);
const { data: cupones, setData: setCupones, upsert: upsertCupon } = useCollection("cupones", "ll_cupones", []);
const { data: promos, setData: setPromos, upsert: upsertPromo } = useCollection("promos", "ll_promos", []);
const { data: incentivosArr, setData: setIncentivosArr, upsert: upsertIncentivo } = useCollection("configIncentivos", "ll_config_incentivos", INCENTIVOS_DEFAULT);
const cfgInc = incentivosArr[0] || INCENTIVOS_DEFAULT[0];
const [showSalida,setShowSalida]=useState(false);
  const [ticketV,setTicketV]=useState(null);
  const [cuponSug,setCuponSug]=useState(null); // 🎟️ cupón sugerido tras imprimir la venta
  // Servicios visibles (excluye los eliminados, que quedan marcados en la nube)
  const serviciosActivos=servicios.filter(s=>!s.eliminada);

  const esAdmin=sesion.rol==="Administrador";
  const addAbono=(f,ab)=>setVentas(prev=>{const next=prev.map(v=>{if(v.folio!==f)return v;const abono={...ab,cobradoPorId:sesion.id,cobradoPorNombre:sesion.nombre};const abs=[...(v.abonos||[]),abono];return{...v,abonos:abs,pagada:saldo({...v,abonos:abs})<=0};});const updated=next.find(v=>v.folio===f);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const handleCierreListo=()=>{
    setCierreOk(true);
    setCajaOk(false);
    setEsperandoApertura(true);
  };
  const exportarDatos=()=>{const d={ventas,clientes,empleadas,inventario,servicios,gastos,depositos,salidasCaja,cajas,cupones,promos};const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="respaldo-"+hoy+".json";a.click();};
  // Importa un respaldo .json Y lo sube a Firestore (antes solo quedaba en este dispositivo)
  const importarDatos=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const cols=[
          [d.ventas,setVentas,upsertVenta],
          [d.clientes,setClientes,upsertCliente],
          [d.empleadas,setEmpleadas,upsertEmpleada],
          [d.inventario,setInventario,upsertInventario],
          [d.servicios,setServicios,upsertServicio],
          [d.gastos,setGastos,upsertGasto],
          [d.depositos,setDepositos,upsertDeposito],
          [d.salidasCaja,setSalidasCaja,upsertSalida],
          [d.cajas,null,upsertCaja],
          [d.cupones,setCupones,upsertCupon],
          [d.promos,setPromos,upsertPromo],
        ];
        let tot=0;
        cols.forEach(([arr,setter,upsertFn])=>{
          if(!arr)return;
          if(setter)setter(arr);
          if(upsertFn)arr.forEach(item=>{upsertFn({...item,_updatedAt:new Date().toISOString()});tot++;}); // ☁️ sube cada registro a Firestore
        });
        alert(`✅ Datos importados y subidos a la nube (${tot} registros)`);
      }catch{alert("❌ Error al importar");}
    };
    r.readAsText(f);
  };
  const pCount=ventas.filter(v=>(!pagada(v)&&!v.anulada)||(pagada(v)&&!v.anulada&&(v.estado||"recibido")!=="entregado")).length;

  // Si cerró caja y quiere seguir trabajando, DEBE abrir caja nuevamente
  if(!cajaOk||esperandoApertura)return <AperturaObligatoria
    sesion={sesion}
    onLogout={onLogout}
    onAbierta={()=>{
      setCajaOk(true);
      setEsperandoApertura(false);
      setCierreOk(false); // nuevo turno = nuevo cierre requerido
    }}
    empleadas={empleadas}
    upsertCaja={upsertCaja}
  />;
  if(!esAdmin)return <PantallaEmpleada ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} servicios={serviciosActivos} sesion={sesion} addAbono={addAbono} onLogout={onLogout} cierreListo={cierreOk} onCierreListo={handleCierreListo} onResetCierre={()=>{setCierreOk(false);setEsperandoApertura(true);}} salidasCaja={salidasCaja} setSalidasCaja={setSalidasCaja} upsertVenta={upsertVenta} upsertSalida={upsertSalida} upsertCliente={upsertCliente} upsertCaja={upsertCaja} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos} cfgInc={cfgInc}/>;
  const tabs=[
    {id:"ventas",icon:"🧾",l:"Venta"},{id:"historial",icon:"📋",l:"Historial"},
    {id:"pendientes",icon:"⏳",l:"Pendientes",b:pCount},{id:"bi",icon:"🚀",l:"Dashboard"},
    {id:"clientes",icon:"👥",l:"Clientes"},{id:"promosAdmin",icon:"🎁",l:"Promos"},{id:"cupones",icon:"🎟️",l:"Cupones"},{id:"resumen",icon:"📈",l:"Resumen día"},
    {id:"reportes",icon:"📊",l:"Reportes"},{id:"depositos",icon:"🏦",l:"Depósitos"},
    {id:"conciliacion",icon:"🏛️",l:"Conciliación"},
    {id:"gastos",icon:"🛒",l:"Gastos"},{id:"inventario",icon:"📦",l:"Inventario"},
    {id:"equipo",icon:"👩",l:"Equipo"},{id:"incentivosAdmin",icon:"🎯",l:"Incentivos"},{id:"caja",icon:"💰",l:"Caja"},
    {id:"config",icon:"⚙️",l:"Config"},{id:"usuarios",icon:"🔑",l:"Usuarios"},
  ];
  return(<div style={S.app}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#4db6e4;border-radius:3px}`}</style>
    <div style={S.hdr}><div style={S.hdrI}>
      <span style={S.logo}>🫧 Lava<span style={{color:"#4db6e4"}}>&</span>Listo</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span title={nube?"Sincronizado con la nube":"Sin conexión a la nube — guardando en este dispositivo"} style={{fontSize:12,color:"#a0c4da"}}>{nube?"☁️":"📴"} 👑 {sesion.nombre}</span>
        <button onClick={()=>setShowSalida(true)} style={{background:"rgba(220,50,50,.3)",border:"none",borderRadius:6,color:"#ffcccc",fontSize:11,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>💸 Salida</button>
        {cierreOk?<button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,color:"#fff",fontSize:11,padding:"4px 10px",cursor:"pointer"}}>Salir</button>:<button onClick={()=>alert("Debes hacer el cierre de caja antes de salir.")} style={{background:"rgba(255,80,80,.3)",border:"none",borderRadius:6,color:"#ffcccc",fontSize:11,padding:"4px 10px",cursor:"not-allowed"}}>🔒 Salir</button>}
      </div>
    </div></div>
    <div style={S.tabBar}>
      {tabs.map(t=>(<button key={t.id} style={{...S.tabBtn,...(tab===t.id?S.tabAct:{})}} onClick={()=>setTab(t.id)}>
        <span style={{position:"relative"}}>{t.icon}{t.b>0&&<span style={{position:"absolute",top:-4,right:-8,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.b}</span>}</span>
        <span>{t.l}</span>
      </button>))}
    </div>
    <div style={S.content}>
      {tab==="ventas"&&<NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={setTicketV} servicios={serviciosActivos} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos}/>}
      {tab==="historial"&&<Historial ventas={ventas} setVentas={setVentas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} esAdmin={esAdmin} upsertVenta={upsertVenta}/>}
      {tab==="pendientes"&&<Pendientes ventas={ventas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} setVentas={setVentas} upsertVenta={upsertVenta}/>}
      {tab==="bi"&&<DashboardBI ventas={ventas} empleadas={empleadas} gastos={gastos}/>}
      {tab==="clientes"&&<Clientes clientes={clientes} setClientes={setClientes} upsertCliente={upsertCliente} ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta}/>}
      {tab==="promosAdmin"&&<PromosAdmin promos={promos} setPromos={setPromos} upsertPromo={upsertPromo} servicios={servicios}/>}
      {tab==="cupones"&&<Cupones cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} clientes={clientes} ventas={ventas} sesion={sesion} promos={promos}/>}
      {tab==="resumen"&&<ResumenDia ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="reportes"&&<Reportes ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="depositos"&&<Depositos depositos={depositos} setDepositos={setDepositos} ventas={ventas} salidasCaja={salidasCaja} upsertDeposito={upsertDeposito}/>}
      {tab==="conciliacion"&&<Conciliacion ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} depositos={depositos} setDepositos={setDepositos} upsertDeposito={upsertDeposito}/>}
      {tab==="gastos"&&<Gastos gastos={gastos} setGastos={setGastos} sesion={sesion} upsertGasto={upsertGasto}/>}
      {tab==="inventario"&&<Inventario inventario={inventario} setInventario={setInventario} upsertInventario={upsertInventario}/>}
      {tab==="equipo"&&<Equipo empleadas={empleadas} setEmpleadas={setEmpleadas} ventas={ventas} esAdmin={esAdmin} upsertEmpleada={upsertEmpleada}/>}
      {tab==="incentivosAdmin"&&<IncentivosAdmin cfgInc={cfgInc} setIncentivosArr={setIncentivosArr} upsertIncentivo={upsertIncentivo} ventas={ventas} empleadas={empleadas}/>}
      {tab==="caja"&&<CierreCaja ventas={ventas} empleadas={empleadas} onLogout={onLogout} onCierreListo={handleCierreListo} onResetCierre={()=>setCierreOk(false)} sesion={sesion} salidasCaja={salidasCaja} setVentas={setVentas} upsertVenta={upsertVenta} upsertCaja={upsertCaja}/>}
      {tab==="config"&&<Configuracion servicios={servicios} setServicios={setServicios} exportarDatos={exportarDatos} importarDatos={importarDatos} upsertVenta={upsertVenta} upsertServicio={upsertServicio}/>}
      {tab==="usuarios"&&<GestionUsuarios/>}
    </div>
    {ticketV&&<TicketModal venta={ticketV} empleadas={empleadas} onClose={()=>{setCuponSug(ticketV);setTicketV(null);}}/>}
    {cuponSug&&<CuponSugerido venta={cuponSug} clientes={clientes} ventas={ventas} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} sesion={sesion} promos={promos} onClose={()=>setCuponSug(null)}/>}
    {showSalida&&<SalidaCaja sesion={sesion} salidasCaja={salidasCaja} setSalidasCaja={setSalidasCaja} onClose={()=>setShowSalida(false)} upsertSalida={upsertSalida}/>}
  </div>);
}

// ─── RESUMEN DEL DÍA — COBROS Y DEPÓSITO ──────────────────────────
// Muestra SOLO los pagos recibidos en la fecha seleccionada (de cualquier
// factura, incluso de días anteriores), las salidas de caja de todos,
// y el valor a depositar = efectivo cobrado − salidas de caja.
function ResumenDia({ventas,empleadas,salidasCaja}){
  const hoy=fechaHoyLocal();
  const [fechaSel,setFechaSel]=useState(hoy);
  const [verDetalle,setVerDetalle]=useState(false);

  // ── COBROS: cada abono cuenta el día que se RECIBIÓ, no el día que se facturó
  const cobros=[];
  ventas.filter(v=>!v.anulada).forEach(v=>{
    (v.abonos||[]).forEach(ab=>{
      if(!ab.fecha||fechaLocal(ab.fecha)!==fechaSel)return;
      const emp=empleadas.find(e=>String(e.id)===String(v.empleadaId));
      const quien=ab.cobradoPorNombre||emp?.nombre||"Sin asignar";
      cobros.push({
        monto:ab.monto,metodo:ab.metodo,fecha:ab.fecha,quien,
        folio:v.folio,cliente:v.clienteNombre||"",
        factAnterior:fechaLocal(v.fecha)!==fechaSel,
      });
    });
  });

  const cobradores=[...new Set(cobros.map(c=>c.quien))];
  const esEf=m=>m==="Efectivo";
  const esTa=m=>m==="Tarjeta";
  const sumC=(fn,quien)=>parseFloat(cobros.filter(c=>fn(c.metodo)&&(quien==null||c.quien===quien)).reduce((a,c)=>a+c.monto,0).toFixed(2));
  const sumQ=quien=>parseFloat(cobros.filter(c=>c.quien===quien).reduce((a,c)=>a+c.monto,0).toFixed(2));
  const filas=[
    {label:"EFECTIVO",fn:esEf,bg:"#e8f5e9",color:"#2e7d32"},
    {label:"TRANSFERENCIA",fn:esTr,bg:"#e3f2fd",color:"#1565c0"},
    {label:"TARJETA",fn:esTa,bg:"#f3e8fd",color:"#7c3aed"},
  ];
  const totEf=sumC(esEf,null);
  const totTr=sumC(esTr,null);
  const totTa=sumC(esTa,null);
  const totCobrado=parseFloat((totEf+totTr+totTa).toFixed(2));
  const efAnterior=parseFloat(cobros.filter(c=>esEf(c.metodo)&&c.factAnterior).reduce((a,c)=>a+c.monto,0).toFixed(2));

  // ── SALIDAS DE CAJA del día (de todos, sin las eliminadas)
  const salidasDia=(salidasCaja||[]).filter(s=>s.fecha===fechaSel&&!s.eliminada);
  const totSalidas=parseFloat(salidasDia.reduce((a,s)=>a+s.monto,0).toFixed(2));

  // ── VALOR A DEPOSITAR = efectivo cobrado − salidas de caja
  const aDepositar=parseFloat((totEf-totSalidas).toFixed(2));

  const th={padding:"8px 10px",background:"#1a3c5e",color:"#fff",fontSize:12,fontWeight:700,textAlign:"center",whiteSpace:"nowrap"};
  const td=(align="right")=>({padding:"8px 10px",fontSize:13,textAlign:align,borderBottom:"1px solid #e8f0f7",whiteSpace:"nowrap"});
  const fmtC=n=>n===0?"0.00":"$"+n.toFixed(2);

  const imprimirResumen=()=>{
    const hdrs=["FORMA DE PAGO",...cobradores.map(c=>c.toUpperCase()),"TOTAL"];
    const rows=filas.map(f=>[f.label,...cobradores.map(q=>sumC(f.fn,q)),sumC(f.fn,null)]);
    rows.push(["TOTAL COBRADO",...cobradores.map(q=>sumQ(q)),totCobrado]);
    const tableHtml="<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;font-size:12px'>"
      +"<tr>"+hdrs.map(h=>"<th style='background:#1a3c5e;color:#fff;padding:6px'>"+h+"</th>").join("")+"</tr>"
      +rows.map(r=>"<tr>"+r.map((c,i)=>"<td style='text-align:"+(i===0?"left":"right")+";padding:5px'>"+(typeof c==="number"?"$"+c.toFixed(2):c)+"</td>").join("")+"</tr>").join("")
      +"</table>";
    const cobrosOrd=[...cobros].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
    const detHtml=cobrosOrd.length>0
      ?"<h3 style='color:#2e7d32;margin-top:14px'>Detalle de cobros ("+cobrosOrd.length+")</h3>"
        +"<table cellpadding='4' cellspacing='0' style='border-collapse:collapse;width:100%;font-size:11px'>"
        +"<tr><th style='background:#e8f5e9;text-align:left;padding:4px'>Hora</th><th style='background:#e8f5e9;text-align:left;padding:4px'>Cliente</th><th style='background:#e8f5e9;text-align:left;padding:4px'>Forma</th><th style='background:#e8f5e9;text-align:left;padding:4px'>Cobró</th><th style='background:#e8f5e9;text-align:right;padding:4px'>Monto</th></tr>"
        +cobrosOrd.map(c=>{
          const hora=c.fecha?new Date(c.fecha).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):"";
          const tag=c.factAnterior?" <span style='color:#e65100;font-weight:bold'>(FACT. ANTERIOR)</span>":"";
          return "<tr style='border-bottom:1px solid #eee'><td style='padding:4px'>"+hora+"</td><td style='padding:4px'>"+(c.cliente||"")+tag+"</td><td style='padding:4px'>"+c.metodo+"</td><td style='padding:4px'>"+c.quien+"</td><td style='padding:4px;text-align:right;color:#2e7d32;font-weight:bold'>+$"+c.monto.toFixed(2)+"</td></tr>";
        }).join("")
        +"<tr><td colspan='4' style='padding:4px;font-weight:bold'>TOTAL COBRADO</td><td style='padding:4px;text-align:right;font-weight:bold'>$"+totCobrado.toFixed(2)+"</td></tr>"
        +"</table>"
      :"";
    const salHtml=salidasDia.length>0
      ?"<h3 style='color:#c62828;margin-top:14px'>Detalle de salidas de caja ("+salidasDia.length+")</h3>"
        +"<table cellpadding='4' cellspacing='0' style='border-collapse:collapse;width:100%;font-size:11px'>"
        +"<tr><th style='background:#ffebee;text-align:left;padding:4px'>Hora</th><th style='background:#ffebee;text-align:left;padding:4px'>Motivo</th><th style='background:#ffebee;text-align:left;padding:4px'>Registró</th><th style='background:#ffebee;text-align:right;padding:4px'>Monto</th></tr>"
        +salidasDia.map(s=>"<tr style='border-bottom:1px solid #eee'><td style='padding:4px'>"+(s.hora||"")+"</td><td style='padding:4px'>"+s.motivo+"</td><td style='padding:4px'>"+s.quien+"</td><td style='padding:4px;text-align:right;color:#c62828;font-weight:bold'>-$"+s.monto.toFixed(2)+"</td></tr>").join("")
        +"<tr><td colspan='3' style='padding:4px;font-weight:bold'>TOTAL SALIDAS</td><td style='padding:4px;text-align:right;font-weight:bold;color:#c62828'>-$"+totSalidas.toFixed(2)+"</td></tr>"
        +"</table>"
      :"";
    const w=window.open("","_blank","width=700,height=650");
    if(!w)return;
    const html="<html><head><title>Resumen de cobros y depósito</title><style>body{font-family:sans-serif;padding:20px}h2{color:#1a3c5e;text-align:center}.dep{border:2px solid #2e7d32;background:#e8f5e9;border-radius:10px;padding:14px;text-align:center;margin-top:14px}</style></head><body>"
      +"<h2>🫧 Lava&amp;Listo — Resumen de cobros "+fechaSel+"</h2>"
      +tableHtml
      +(efAnterior>0?"<p style='font-size:11px;color:#555'>Incluye $"+efAnterior.toFixed(2)+" en efectivo por cobro de facturas de días anteriores.</p>":"")
      +detHtml
      +salHtml
      +"<div class='dep'><div style='font-size:13px;color:#2e7d32'>Efectivo cobrado $"+totEf.toFixed(2)+" − Salidas de caja $"+totSalidas.toFixed(2)+"</div>"
      +"<div style='font-size:26px;font-weight:800;color:#1b5e20'>VALOR A DEPOSITAR: $"+aDepositar.toFixed(2)+"</div>"
      +"<div style='font-size:11px;color:#555'>Debe coincidir con el efectivo físico en caja</div></div>"
      +"<p style='font-size:11px;color:#888;margin-top:10px'>Transferencias y tarjeta ($"+(totTr+totTa).toFixed(2)+") ya están en el banco — no entran al depósito de efectivo.</p>"
      +"<p style='font-size:10px;color:#aaa;text-align:center'>Impreso: "+new Date().toLocaleString("es-MX")+"</p>"
      +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
    w.document.write(html);w.document.close();
  };

  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>📈 Resumen del Día — Cobros y Depósito</h2>
      <p style={{fontSize:13,color:"#555",marginBottom:12}}>Solo pagos recibidos en la fecha seleccionada, sin importar cuándo se facturó.</p>

      <div style={{marginBottom:14,display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={fechaSel} onChange={e=>setFechaSel(e.target.value)}/></div>
        <button style={{...S.btnP,width:"auto",padding:"9px 16px",fontSize:13}} onClick={imprimirResumen}>🖨️ Imprimir</button>
      </div>

      {cobros.length===0&&salidasDia.length===0
        ?<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:40,marginBottom:8}}>💤</div><div>Sin cobros ni salidas registrados en esta fecha</div></div>
        :<>
      {/* TABLA DE COBROS POR EMPLEADA */}
      <div style={{overflowX:"auto",marginBottom:10}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:400,background:"#fff"}}>
          <thead><tr>
            <th style={{...th,textAlign:"left"}}>COBROS DEL DÍA</th>
            {cobradores.map(q=><th key={q} style={{...th,background:"#1a5276"}}>{q.split(" ")[0].toUpperCase()}</th>)}
            <th style={{...th,background:"#2563a8"}}>TOTAL</th>
          </tr></thead>
          <tbody>
            {filas.map((f,i)=>(
              <tr key={f.label} style={{background:i%2===0?"#f8fbfd":"#fff"}}>
                <td style={td("left")}><span style={{background:f.bg,color:f.color,borderRadius:4,padding:"3px 8px",fontSize:11,fontWeight:700}}>{f.label}</span></td>
                {cobradores.map(q=><td key={q} style={td()}>{fmtC(sumC(f.fn,q))}</td>)}
                <td style={{...td(),fontWeight:800,color:f.color}}>{fmtC(sumC(f.fn,null))}</td>
              </tr>
            ))}
            <tr style={{background:"#e8f5fd"}}>
              <td style={{...td("left"),fontWeight:800,color:"#1a3c5e"}}>TOTAL COBRADO</td>
              {cobradores.map(q=><td key={q} style={{...td(),fontWeight:800,color:"#1a3c5e"}}>${sumQ(q).toFixed(2)}</td>)}
              <td style={{...td(),fontWeight:800,fontSize:15,color:"#1a3c5e"}}>${totCobrado.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {efAnterior>0&&<div style={{background:"#e8f5fd",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#1565c0"}}>ℹ️ Incluye <strong>${efAnterior.toFixed(2)}</strong> en efectivo por cobros de facturas de días anteriores</div>}

      {/* DETALLE DE COBROS */}
      <button style={{...S.btnT,marginBottom:12}} onClick={()=>setVerDetalle(!verDetalle)}>{verDetalle?"▲ Ocultar detalle":"▼ Ver detalle de cobros ("+cobros.length+")"}</button>
      {verDetalle&&(
        <Card title="🧾 Detalle de cobros">
          {[...cobros].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"")).map((c,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0f4f8",fontSize:13}}>
              <div>
                <span style={{color:"#2e7d32",fontWeight:700}}>+${c.monto.toFixed(2)}</span> {c.cliente} <span style={{color:"#888",fontSize:11}}>({c.metodo} · {c.quien})</span>
                {c.factAnterior&&<span style={{background:"#fff3e0",color:"#e65100",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,marginLeft:6}}>FACT. ANTERIOR</span>}
              </div>
              <span style={{color:"#888",fontSize:11}}>{c.fecha?new Date(c.fecha).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}):""}</span>
            </div>
          ))}
        </Card>
      )}

      {/* SALIDAS DE CAJA DEL DÍA */}
      <Card title={"💸 Salidas de caja — Total: -$"+totSalidas.toFixed(2)}>
        {salidasDia.length===0?<div style={S.empty}>Sin salidas registradas</div>:salidasDia.map(s=>(
          <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0f4f8",fontSize:13}}>
            <div><span style={{color:"#c62828",fontWeight:700}}>-${s.monto.toFixed(2)}</span> {s.motivo} <span style={{color:"#888",fontSize:11}}>({s.quien})</span></div>
            <span style={{color:"#888",fontSize:11}}>{s.hora}</span>
          </div>
        ))}
      </Card>

      {/* CUADRE PARA EL DEPÓSITO */}
      <div style={S.kgrid}>
        <div style={{...S.kpi,borderLeft:"4px solid #4caf50"}}><div style={{fontSize:22}}>💵</div><div><div style={{fontWeight:800,fontSize:18,color:"#4caf50"}}>${totEf.toFixed(2)}</div><div style={{fontSize:12,color:"#888"}}>Efectivo cobrado</div></div></div>
        <div style={{...S.kpi,borderLeft:"4px solid #c62828"}}><div style={{fontSize:22}}>💸</div><div><div style={{fontWeight:800,fontSize:18,color:"#c62828"}}>-${totSalidas.toFixed(2)}</div><div style={{fontSize:12,color:"#888"}}>Salidas de caja</div></div></div>
      </div>
      <div style={{background:"#e8f5e9",border:"2px solid #4caf50",borderRadius:14,padding:"16px 18px",textAlign:"center",marginBottom:10}}>
        <div style={{fontSize:13,color:"#2e7d32",fontWeight:600}}>🏦 VALOR A DEPOSITAR</div>
        <div style={{fontWeight:800,fontSize:30,color:aDepositar<0?"#c62828":"#1b5e20"}}>${aDepositar.toFixed(2)}</div>
        <div style={{fontSize:11,color:"#555"}}>Efectivo cobrado ${totEf.toFixed(2)} − Salidas ${totSalidas.toFixed(2)} · Debe coincidir con el efectivo en caja</div>
      </div>
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>🏦 Transferencias y tarjeta (${(totTr+totTa).toFixed(2)}) ya están en el banco — no entran al depósito de efectivo.</div>
      </>}
    </div>
  );
}


// ─── DEPÓSITOS ─────────────────────────────────────────────────────
function Depositos({depositos,setDepositos,ventas,salidasCaja,upsertDeposito}){
  const hoy=fechaHoyLocal();
  const [mesVer,setMesVer]=useState(mesK(new Date()));
  const [formDia,setFormDia]=useState(null); // dia seleccionado para ingresar deposito
  const [formData,setFormData]=useState({banco:"Pichincha",monto:"",comprobante:"",notas:""});
  const BANCOS=["Pichincha","JEP","Guayaquil","Pacífico","Produbanco","Otro"];

  // Días del mes con COBROS (por fecha en que se recibió cada pago)
  const diasConVentas=(()=>{
    const map={};
    ventas.filter(v=>!v.anulada).forEach(v=>{
      (v.abonos||[]).forEach(ab=>{
        const diaAb=fechaLocal(ab.fecha);
        if(!diaAb.startsWith(mesVer))return;
        if(!map[diaAb])map[diaAb]={efectivo:0,pichincha:0,jep:0,tarjeta:0,salidas:0,ventas:[]};
        if(ab.metodo==="Efectivo")map[diaAb].efectivo+=ab.monto;
        else if(ab.metodo==="Transferencia Pichincha")map[diaAb].pichincha+=ab.monto;
        else if(ab.metodo==="Transferencia JEP")map[diaAb].jep+=ab.monto;
        else if(ab.metodo==="Tarjeta")map[diaAb].tarjeta+=ab.monto;
        if(!map[diaAb].ventas.find(f=>f===v.folio))map[diaAb].ventas.push(v.folio);
      });
    });
    // Restar las salidas de caja de cada día — el depósito es el efectivo NETO
    (salidasCaja||[]).filter(s=>!s.eliminada&&s.fecha&&s.fecha.startsWith(mesVer)).forEach(s=>{
      if(!map[s.fecha])map[s.fecha]={efectivo:0,pichincha:0,jep:0,tarjeta:0,salidas:0,ventas:[]};
      map[s.fecha].salidas+=s.monto;
    });
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  })();

  const depPorDia=dia=>depositos.filter(d=>d.fecha===dia&&!d.eliminada);

  const guardarDeposito=()=>{
    if(!formData.monto||!formData.comprobante.trim()){alert("Ingresa monto y número de comprobante");return;}
    const nd={...formData,id:Date.now(),fecha:formDia,monto:parseFloat(formData.monto),creadoEn:new Date().toISOString()};setDepositos(prev=>[nd,...prev]);if(upsertDeposito)upsertDeposito({...nd,_updatedAt:new Date().toISOString()});
    setFormDia(null);setFormData({banco:"Pichincha",monto:"",comprobante:"",notas:""});
  };
  const eliminar=id=>{if(!window.confirm("¿Eliminar?"))return;setDepositos(prev=>{const next=prev.map(d=>d.id===id?{...d,eliminada:true}:d);const borrado=next.find(d=>d.id===id);if(borrado&&upsertDeposito)upsertDeposito({...borrado,_updatedAt:new Date().toISOString()});return next;});};

  const totDepMes=depositos.filter(d=>!d.eliminada&&d.fecha.startsWith(mesVer)).reduce((a,d)=>a+d.monto,0);
  const totEfMes=diasConVentas.reduce((a,[,d])=>a+Math.max(0,d.efectivo-d.salidas),0);
  const diasPendientes=diasConVentas.filter(([dia,d])=>{const neto=d.efectivo-d.salidas;return neto>0&&depPorDia(dia).reduce((a,dd)=>a+dd.monto,0)<neto-0.01;}).length;

  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>🏦 Cuadres de Caja Diarios</h2>
      <p style={{fontSize:13,color:"#555",marginBottom:14}}>Registra el comprobante de depósito de cada día. El monto a depositar ya descuenta las salidas de caja.</p>

      {/* RESUMEN DEL MES */}
      <div style={S.kgrid}>
        <div style={{...S.kpi,borderLeft:"4px solid #1a3c5e"}}>
          <div style={{fontSize:22}}>💵</div>
          <div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>${totEfMes.toFixed(2)}</div><div style={{fontSize:12,color:"#888"}}>Efectivo neto {mesVer}</div></div>
        </div>
        <div style={{...S.kpi,borderLeft:`4px solid ${diasPendientes>0?"#e53935":"#4caf50"}`}}>
          <div style={{fontSize:22}}>{diasPendientes>0?"⚠️":"✅"}</div>
          <div><div style={{fontWeight:800,fontSize:18,color:diasPendientes>0?"#e53935":"#4caf50"}}>{diasPendientes>0?`${diasPendientes} días`:"Al día"}</div><div style={{fontSize:12,color:"#888"}}>Pendiente depósito</div></div>
        </div>
      </div>

      <div style={{marginBottom:14}}><label style={S.lbl}>Ver mes</label><input type="month" style={S.inp} value={mesVer} onChange={e=>setMesVer(e.target.value)}/></div>

      {diasConVentas.length===0
        ?<div style={S.empty}>No hay ventas cobradas en {mesVer}</div>
        :diasConVentas.map(([dia,datos])=>{
          const deps=depPorDia(dia);
          const totDep=deps.reduce((a,d)=>a+d.monto,0);
          const efDia=parseFloat(Math.max(0,datos.efectivo-datos.salidas).toFixed(2));
          const diferencia=parseFloat((totDep-efDia).toFixed(2));
          const cuadrado=Math.abs(diferencia)<0.01;
          const pendiente=efDia>0&&totDep<efDia-0.01;
          const nombreDia=new Date(dia+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"});
          const esHoy=dia===hoy;

          return(
            <div key={dia} style={{borderRadius:14,border:`2px solid ${cuadrado?"#4caf50":pendiente?"#e53935":"#ff9800"}`,background:"#fff",marginBottom:14,overflow:"hidden"}}>
              {/* CABECERA DEL DÍA */}
              <div style={{background:cuadrado?"#e8f5e9":pendiente?"#ffebee":"#fff3e0",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:cuadrado?"#2e7d32":pendiente?"#c62828":"#e65100",textTransform:"capitalize"}}>
                    {cuadrado?"✅":"⚠️"} {nombreDia}{esHoy?" (HOY)":""}
                  </div>
                  <div style={{fontSize:11,color:"#888"}}>{dia}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>💵 ${efDia.toFixed(2)}</div>
                  <div style={{fontSize:11,color:"#888"}}>a depositar</div>
                </div>
              </div>

              <div style={{padding:"12px 16px"}}>
                {/* COBROS DEL DÍA */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                  {datos.efectivo>0&&<div style={{background:"#e8f5e9",color:"#2e7d32",padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:600}}>💵 Efectivo: ${datos.efectivo.toFixed(2)}</div>}
                  {datos.salidas>0&&<div style={{background:"#ffebee",color:"#c62828",padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:600}}>💸 Salidas: -${datos.salidas.toFixed(2)}</div>}
                  {datos.pichincha>0&&<div style={{background:"#e3f2fd",color:"#1565c0",padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:600}}>🏦 Pichincha: ${datos.pichincha.toFixed(2)}</div>}
                  {datos.jep>0&&<div style={{background:"#e3f2fd",color:"#1565c0",padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:600}}>🏦 JEP: ${datos.jep.toFixed(2)}</div>}
                  {datos.tarjeta>0&&<div style={{background:"#f3e8fd",color:"#7c3aed",padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:600}}>💳 Tarjeta: ${datos.tarjeta.toFixed(2)}</div>}
                  <div style={{background:"#f0f4f8",color:"#888",padding:"4px 10px",borderRadius:8,fontSize:12}}>{datos.ventas.length} venta{datos.ventas.length!==1?"s":""}</div>
                </div>

                {/* DEPÓSITOS REGISTRADOS */}
                {deps.length>0&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:12,color:"#888",fontWeight:600,marginBottom:6}}>DEPÓSITOS REGISTRADOS:</div>
                    {deps.map(d=>(
                      <div key={d.id} style={{background:"#f8fbfd",borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e8f0f7"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>🏦 {d.banco} — ${d.monto.toFixed(2)}</div>
                          <div style={{fontSize:11,color:"#4db6e4"}}>Comprobante: <strong>{d.comprobante}</strong></div>
                          {d.notas&&<div style={{fontSize:11,color:"#888"}}>{d.notas}</div>}
                        </div>
                        <button style={S.btnR} onClick={()=>eliminar(d.id)}>✕</button>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,padding:"6px 0",borderTop:"1px solid #e8f0f7"}}>
                      <span>Total depositado</span>
                      <span style={{color:cuadrado?"#2e7d32":"#e65100"}}>${totDep.toFixed(2)} / ${efDia.toFixed(2)}</span>
                    </div>
                    {!cuadrado&&efDia>0&&<div style={{background:"#ffebee",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#c62828",fontWeight:700,marginTop:4}}>
                      ⚠️ Faltan ${Math.abs(diferencia).toFixed(2)} por depositar
                    </div>}
                    {cuadrado&&<div style={{background:"#e8f5e9",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#2e7d32",fontWeight:700,marginTop:4}}>
                      ✅ Cuadre completo — día cerrado
                    </div>}
                  </div>
                )}

                {/* FORMULARIO AGREGAR DEPÓSITO */}
                {formDia===dia?(
                  <div style={{background:"#f0f4f8",borderRadius:10,padding:12}}>
                    <div style={{fontWeight:700,color:"#1a3c5e",marginBottom:10}}>💾 Ingresar comprobante de depósito</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div><label style={S.lbl}>Banco</label>
                        <select style={S.inp} value={formData.banco} onChange={e=>setFormData({...formData,banco:e.target.value})}>
                          {BANCOS.map(b=><option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div><label style={S.lbl}>Monto depositado *</label><input type="number" style={S.inp} placeholder={`$${efDia.toFixed(2)}`} value={formData.monto} onChange={e=>setFormData({...formData,monto:e.target.value})}/></div>
                      <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>N° Comprobante *</label><input style={S.inp} placeholder="Número de referencia del banco" value={formData.comprobante} onChange={e=>setFormData({...formData,comprobante:e.target.value})}/></div>
                      <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notas</label><input style={S.inp} placeholder="Observaciones..." value={formData.notas} onChange={e=>setFormData({...formData,notas:e.target.value})}/></div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...S.btnP,flex:2}} onClick={guardarDeposito}>✅ Guardar depósito</button>
                      <button style={{...S.btnC,flex:1}} onClick={()=>setFormDia(null)}>Cancelar</button>
                    </div>
                  </div>
                ):(
                  <button
                    style={{...S.btnP,background:cuadrado?"#e8f5e9":"linear-gradient(135deg,#1a3c5e,#2563a8)",color:cuadrado?"#2e7d32":"#fff",border:cuadrado?"2px solid #4caf50":"none",fontSize:13,padding:"10px"}}
                    onClick={()=>{setFormDia(dia);setFormData({banco:"Pichincha",monto:efDia>0?efDia.toFixed(2):"",comprobante:"",notas:""});}}>
                    {cuadrado?"➕ Agregar otro depósito":"💾 Ingresar comprobante de depósito"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}


// ─── CONCILIACIÓN BANCARIA ─────────────────────────────────────────
// Compara los movimientos del sistema contra el estado de cuenta del banco.
// Cada movimiento tiene un check "conciliado" que se guarda en Firestore.
function Conciliacion({ventas,setVentas,upsertVenta,depositos,setDepositos,upsertDeposito}){
  const [mesVer,setMesVer]=useState(mesK(new Date()));
  const [soloPend,setSoloPend]=useState(false);

  // Transferencias y tarjeta: cada abono del mes por método
  const movs={pichincha:[],jep:[],tarjeta:[]};
  ventas.filter(v=>!v.anulada).forEach(v=>{
    (v.abonos||[]).forEach((ab,idx)=>{
      const d=fechaLocal(ab.fecha);
      if(!d||!d.startsWith(mesVer))return;
      const item={folio:v.folio,idx,fecha:d,fechaISO:ab.fecha,cliente:v.clienteNombre||"",monto:ab.monto,conciliado:!!ab.conciliado,quien:ab.cobradoPorNombre||""};
      if(ab.metodo==="Transferencia Pichincha")movs.pichincha.push(item);
      else if(ab.metodo==="Transferencia JEP")movs.jep.push(item);
      else if(ab.metodo==="Tarjeta")movs.tarjeta.push(item);
    });
  });
  // Depósitos de efectivo registrados en el mes
  const depsMes=depositos.filter(d=>!d.eliminada&&d.fecha&&d.fecha.startsWith(mesVer));

  const toggleAbono=(folio,idx)=>setVentas(prev=>{
    const next=prev.map(v=>{
      if(v.folio!==folio)return v;
      const abs=(v.abonos||[]).map((ab,i)=>i===idx?{...ab,conciliado:!ab.conciliado}:ab);
      return{...v,abonos:abs};
    });
    const updated=next.find(v=>v.folio===folio);
    if(updated&&upsertVenta)upsertVenta(updated);
    return next;
  });
  const toggleDep=id=>setDepositos(prev=>{
    const next=prev.map(d=>d.id===id?{...d,conciliado:!d.conciliado}:d);
    const updated=next.find(d=>d.id===id);
    if(updated&&upsertDeposito)upsertDeposito({...updated,_updatedAt:new Date().toISOString()});
    return next;
  });

  const resumen=lista=>{
    const tot=parseFloat(lista.reduce((a,m)=>a+m.monto,0).toFixed(2));
    const con=parseFloat(lista.filter(m=>m.conciliado).reduce((a,m)=>a+m.monto,0).toFixed(2));
    return{tot,con,pend:parseFloat((tot-con).toFixed(2)),nPend:lista.filter(m=>!m.conciliado).length};
  };
  const rDep=resumen(depsMes);
  const rPic=resumen(movs.pichincha);
  const rJep=resumen(movs.jep);
  const rTar=resumen(movs.tarjeta);
  const totalPend=parseFloat((rDep.pend+rPic.pend+rJep.pend+rTar.pend).toFixed(2));
  const nTotalPend=rDep.nPend+rPic.nPend+rJep.nPend+rTar.nPend;
  const todoConciliado=nTotalPend===0&&(depsMes.length+movs.pichincha.length+movs.jep.length+movs.tarjeta.length)>0;

  const ordenar=lista=>[...lista].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));

  const Seccion=({titulo,color,bg,lista,tipo,r})=>{
    const items=ordenar(lista).filter(m=>!soloPend||!m.conciliado);
    return(
      <div style={{background:"#fff",borderRadius:12,marginBottom:14,overflow:"hidden",boxShadow:"0 1px 6px rgba(26,60,94,.08)"}}>
        <div style={{background:bg,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <div style={{fontWeight:800,fontSize:14,color}}>{titulo}</div>
          <div style={{fontSize:12,fontWeight:700,color}}>
            {r.nPend===0?"✅ Conciliado":"⏳ Faltan $"+r.pend.toFixed(2)+" ("+r.nPend+")"}
            <span style={{fontWeight:400,color:"#888",marginLeft:8}}>Total: ${r.tot.toFixed(2)}</span>
          </div>
        </div>
        <div style={{padding:"6px 14px 10px"}}>
          {items.length===0
            ?<div style={{...S.empty,padding:"12px 0"}}>{lista.length===0?"Sin movimientos este mes":"Todo conciliado ✅"}</div>
            :items.map((m,i)=>(
              <label key={(m.folio||m.id)+"-"+(m.idx!=null?m.idx:i)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f4f8",cursor:"pointer",opacity:m.conciliado?0.65:1}}>
                <input type="checkbox" checked={m.conciliado||false} style={{width:18,height:18,accentColor:"#2e7d32",flexShrink:0}}
                  onChange={()=>tipo==="dep"?toggleDep(m.id):toggleAbono(m.folio,m.idx)}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a3c5e",textDecoration:m.conciliado?"line-through":"none"}}>
                    {tipo==="dep"?("🏦 "+m.banco+" · Comprobante "+m.comprobante):m.cliente}
                  </div>
                  <div style={{fontSize:11,color:"#888"}}>
                    {m.fecha}{m.quien?" · "+m.quien:""}{tipo==="dep"&&m.notas?" · "+m.notas:""}
                  </div>
                </div>
                <div style={{fontWeight:800,fontSize:14,color:m.conciliado?"#2e7d32":color}}>${m.monto.toFixed(2)}</div>
              </label>
            ))
          }
        </div>
      </div>
    );
  };

  const imprimirConciliacion=()=>{
    const secHtml=(titulo,lista,tipo)=>{
      if(lista.length===0)return "";
      const r=resumen(lista);
      return "<h3 style='color:#1a3c5e;margin-top:16px'>"+titulo+"</h3>"
        +"<table cellpadding='4' cellspacing='0' style='border-collapse:collapse;width:100%;font-size:11px'>"
        +"<tr><th style='background:#e8f0f7;text-align:center;padding:4px'>✓</th><th style='background:#e8f0f7;text-align:left;padding:4px'>Fecha</th><th style='background:#e8f0f7;text-align:left;padding:4px'>"+(tipo==="dep"?"Banco / Comprobante":"Cliente")+"</th><th style='background:#e8f0f7;text-align:right;padding:4px'>Monto</th></tr>"
        +ordenar(lista).map(m=>"<tr style='border-bottom:1px solid #eee'>"
          +"<td style='text-align:center;padding:4px'>"+(m.conciliado?"✔":"◻")+"</td>"
          +"<td style='padding:4px'>"+m.fecha+"</td>"
          +"<td style='padding:4px'>"+(tipo==="dep"?(m.banco+" · "+m.comprobante):m.cliente)+"</td>"
          +"<td style='padding:4px;text-align:right;font-weight:bold'>$"+m.monto.toFixed(2)+"</td></tr>").join("")
        +"<tr><td colspan='3' style='padding:4px;font-weight:bold'>Total: $"+r.tot.toFixed(2)+" · Conciliado: $"+r.con.toFixed(2)+"</td><td style='padding:4px;text-align:right;font-weight:bold;color:"+(r.pend>0?"#c62828":"#2e7d32")+"'>"+(r.pend>0?"Pendiente $"+r.pend.toFixed(2):"✔ OK")+"</td></tr>"
        +"</table>";
    };
    const w=window.open("","_blank","width=750,height=700");
    if(!w)return;
    const banner=todoConciliado
      ?"<div style='border:2px solid #2e7d32;background:#e8f5e9;border-radius:10px;padding:12px;text-align:center;font-size:18px;font-weight:800;color:#1b5e20;margin-top:14px'>✅ MES TOTALMENTE CONCILIADO</div>"
      :"<div style='border:2px solid #c62828;background:#ffebee;border-radius:10px;padding:12px;text-align:center;font-size:16px;font-weight:800;color:#c62828;margin-top:14px'>⏳ PENDIENTE POR CONCILIAR: $"+totalPend.toFixed(2)+" ("+nTotalPend+" movimientos)</div>";
    const html="<html><head><title>Conciliación bancaria</title><style>body{font-family:sans-serif;padding:20px}h2{color:#1a3c5e;text-align:center}</style></head><body>"
      +"<h2>🫧 Lava&amp;Listo — Conciliación bancaria "+mesVer+"</h2>"
      +secHtml("💵 Depósitos de efectivo registrados",depsMes,"dep")
      +secHtml("🏦 Transferencias Pichincha recibidas",movs.pichincha,"ab")
      +secHtml("🏦 Transferencias JEP recibidas",movs.jep,"ab")
      +secHtml("💳 Cobros con tarjeta",movs.tarjeta,"ab")
      +banner
      +"<p style='font-size:10px;color:#aaa;text-align:center'>Impreso: "+new Date().toLocaleString("es-MX")+"</p>"
      +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
    w.document.write(html);w.document.close();
  };

  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>🏛️ Conciliación bancaria</h2>
      <p style={{fontSize:13,color:"#555",marginBottom:12}}>Compara con tu estado de cuenta: marca ✓ cada movimiento a medida que lo encuentres en el banco. Los checks se guardan en la nube.</p>

      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:140}}><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={mesVer} onChange={e=>setMesVer(e.target.value)}/></div>
        <button style={{...S.pill,...(soloPend?S.pillA:{}),padding:"9px 14px"}} onClick={()=>setSoloPend(!soloPend)}>⏳ Solo pendientes</button>
        <button style={{...S.btnP,width:"auto",padding:"9px 16px",fontSize:13}} onClick={imprimirConciliacion}>🖨️ Imprimir</button>
      </div>

      {/* ESTADO GLOBAL */}
      <div style={{background:todoConciliado?"#e8f5e9":"#fff3e0",border:"2px solid "+(todoConciliado?"#4caf50":"#ff9800"),borderRadius:12,padding:"12px 16px",marginBottom:14,textAlign:"center"}}>
        {todoConciliado
          ?<div style={{fontWeight:800,fontSize:16,color:"#2e7d32"}}>✅ Mes totalmente conciliado</div>
          :<>
            <div style={{fontWeight:800,fontSize:16,color:"#e65100"}}>⏳ Pendiente por conciliar: ${totalPend.toFixed(2)}</div>
            <div style={{fontSize:12,color:"#888"}}>{nTotalPend} movimiento{nTotalPend!==1?"s":""} sin verificar en el estado de cuenta</div>
          </>}
      </div>

      <Seccion titulo="💵 Depósitos de efectivo" color="#1a3c5e" bg="#e8f0f7" lista={depsMes} tipo="dep" r={rDep}/>
      <Seccion titulo="🏦 Transferencias Pichincha" color="#1565c0" bg="#e3f2fd" lista={movs.pichincha} tipo="ab" r={rPic}/>
      <Seccion titulo="🏦 Transferencias JEP" color="#1565c0" bg="#e3f2fd" lista={movs.jep} tipo="ab" r={rJep}/>
      <Seccion titulo="💳 Tarjeta" color="#7c3aed" bg="#f3e8fd" lista={movs.tarjeta} tipo="ab" r={rTar}/>

      <div style={{fontSize:12,color:"#888"}}>💡 Consejo: abre el estado de cuenta del banco en el celular o impreso, y ve marcando aquí cada valor que encuentres. Lo que quede sin ✓ al final es lo que hay que investigar (depósito no realizado, transferencia mal registrada, etc.).</div>
    </div>
  );
}
