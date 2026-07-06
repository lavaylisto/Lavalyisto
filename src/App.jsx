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

function AperturaObligatoria({sesion,onLogout,onAbierta,empleadas}){
  const hoy=fechaHoyLocal();
  const AK="ll_apertura_"+hoy+"_"+sesion.id;
  const [fondo,setFondo]=useState("15.00");
  const abrir=()=>{
    const d={empleadaNombre:sesion.nombre,empleadaId:sesion.id,fondo:parseFloat(fondo)||15,fecha:new Date().toISOString()};
    try{localStorage.setItem(AK,JSON.stringify(d));}catch{}
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
  const est=getEst(v);const sig=sigEst(v.estado||"recibido");
  const esPag=pagada(v);const pend=saldo(v);
  const cambiar=()=>{if(sig){setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,estado:sig.id}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});}};
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
    </div>
  );
}

function PantallaEmpleada({ventas,setVentas,clientes,setClientes,empleadas,servicios,sesion,addAbono,onLogout,cierreListo,onCierreListo,onResetCierre,salidasCaja,setSalidasCaja,upsertVenta,upsertSalida,upsertCliente}){
  const hoy=fechaHoyLocal();
  const [tab,setTab]=useState("hoy");const [busq,setBusq]=useState("");
  const [fecha,setFecha]=useState(hoy);const [showNueva,setShowNueva]=useState(false);
  const [showCaja,setShowCaja]=useState(false);const [ticket,setTicket]=useState(null);const [showSalidaEmp,setShowSalidaEmp]=useState(false);  const vFecha=ventas.filter(v=>fechaLocal(v.fecha)===fecha&&!v.anulada);
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
        {[{id:"hoy",l:"📋 Ordenes",c:vHoy.length},{id:"cobrar",l:"💸 Cobrar",c:porCob.length},{id:"entregar",l:"📦 Entregar",c:porEnt.length},{id:"nueva",l:"➕ Nueva"}].map(t=>(
          <button key={t.id} style={{flex:1,padding:"12px 4px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:tab===t.id?700:500,color:tab===t.id?"#1a3c5e":"#888",borderBottom:tab===t.id?"2px solid #4db6e4":"none",marginBottom:-2,fontSize:11,position:"relative"}}
            onClick={()=>t.id==="nueva"?setShowNueva(true):setTab(t.id)}>
            {t.l}{t.c>0&&<span style={{position:"absolute",top:5,right:3,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.c}</span>}
          </button>
        ))}
      </div>
      <div style={{padding:12}}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...S.inp,flex:1}} placeholder="🔍 Buscar cliente o folio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
          {tab==="hoy"&&<input type="date" style={{...S.inp,width:140}} value={fecha} onChange={e=>setFecha(e.target.value)}/>}
        </div>
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
        {filtrados.length===0
          ?<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:48,marginBottom:8}}>{tab==="cobrar"?"🎉":"📋"}</div><div>{tab==="cobrar"?"Todo cobrado":tab==="entregar"?"Todo entregado":"Sin ordenes"}</div></div>
          :filtrados.map(v=><OrdenCard key={v.folio} v={v} setVentas={setVentas} addAbono={addAbono} setTicket={setTicket} upsertVenta={upsertVenta}/>)
        }
      </div>
      {showNueva&&(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>➕ Nueva Venta</div>
              <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}} onClick={()=>setShowNueva(false)}>✕</button>
            </div>
            <NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={v=>{setShowNueva(false);setTicket(v);}} servicios={servicios} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente}/>
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
            <CierreCaja ventas={ventas} empleadas={empleadas} onLogout={onLogout} onCierreListo={onCierreListo} onResetCierre={onResetCierre} sesion={sesion} salidasCaja={salidasCaja}/>
          </div>
        </div>
      )}
      {ticket&&<TicketModal venta={ticket} empleadas={empleadas} onClose={()=>setTicket(null)}/>}
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

function NuevaVenta({ventas,setVentas,clientes,setClientes,empleadas,setTicket,servicios,sesion,upsertVenta,upsertCliente}){
  const man=new Date();man.setDate(man.getDate()+1);
  const [cQ,setCQ]=useState("");const [cId,setCId]=useState(null);
  const [nC,setNC]=useState({nombre:"",tel:"",email:"",rfc:"",direccion:""});
  const [mC,setMC]=useState("buscar");
  const empDef=empleadas.find(e=>String(e.id)===String(sesion?.id))||empleadas[0];
  const [empId,setEmpId]=useState(empDef?.id||null);
  const [items,setItems]=useState([{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
  const [entrega,setEntrega]=useState((()=>{const off=man.getTimezoneOffset();const l=new Date(man.getTime()-off*60000);return l.toISOString().split("T")[0];})());
  const [notas,setNotas]=useState("");const [err,setErr]=useState("");
  const [tPago,setTPago]=useState("completo");const [metodo,setMetodo]=useState("Efectivo");const [abono,setAbono]=useState("");
  const cFilt=clientes.filter(c=>c.nombre.toLowerCase().includes(cQ.toLowerCase())||(c.tel&&c.tel.includes(cQ))).slice(0,5);
  const selC=clientes.find(c=>c.id===cId);
  const calcT=()=>items.reduce((a,it)=>{if(it.custom)return a+(parseFloat(it.pC)||0)*(it.piezas||1);const s=servicios.find(s=>s.id===it.servId);return a+(s?s.precio*(it.piezas||1):0);},0);
  const addIt=()=>setItems([...items,{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
  const remIt=i=>setItems(items.filter((_,idx)=>idx!==i));
  const updIt=(i,f,v)=>{const c=[...items];c[i]={...c[i],[f]:v};setItems(c);};
  const reg=()=>{
    if(!cId&&mC==="buscar"){setErr("Selecciona o crea un cliente");return;}
    if(mC==="nuevo"&&!nC.nombre.trim()){setErr("Escribe el nombre del cliente");return;}
    const total=calcT();
    if(tPago==="abono"){const m=parseFloat(abono);if(!m||m<=0||m>=total){setErr("El abono debe ser mayor a 0 y menor al total");return;}}
    let cid=cId,cNom=selC?.nombre,cTel=selC?.tel,cDir=selC?.direccion||"";
    if(mC==="nuevo"){const nc={...nC,id:Date.now()};setClientes(prev=>[...prev,nc]);if(upsertCliente)upsertCliente({...nc,_updatedAt:new Date().toISOString()});cid=nc.id;cNom=nc.nombre;cTel=nc.tel;cDir=nc.direccion||"";}
    let abs=[];
    if(tPago==="completo")abs=[{monto:total,metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    else if(tPago==="abono")abs=[{monto:parseFloat(abono),metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    const v={folio:folio(),fecha:new Date().toISOString(),entrega,clienteId:cid,clienteNombre:cNom,clienteTel:cTel,clienteDireccion:cDir,empleadaId:empId,
      items:items.map(it=>{if(it.custom)return{...it,label:it.lC||"Servicio personalizado",precio:parseFloat(it.pC)||0};const s=servicios.find(s=>s.id===it.servId);return{...it,label:s?.label,precio:s?.precio};}),
      pago:metodo,total,abonos:abs,pagada:tPago==="completo",notas,checkMsgRetiro:false,checkMsgEntrega:false,facturadoSRI:false,estado:"recibido"};
    setVentas([v,...ventas]);setTicket(v);if(upsertVenta)upsertVenta(v);
    setCQ("");setCId(null);setNC({nombre:"",tel:"",email:"",rfc:"",direccion:""});
    setItems([{servId:servicios[0]?.id,piezas:1,custom:false,lC:"",pC:""}]);
    setNotas("");setErr("");setAbono("");setTPago("completo");
  };
  const total=calcT();
  return(
    <div style={S.panel}>
      <h2 style={S.ptitle}>Nueva Venta</h2>
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
            {[["nombre","Nombre *"],["tel","Telefono"],["email","Email"],["rfc","RUC/RFC"]].map(([k,l])=><input key={k} style={S.inp} placeholder={l} value={nC[k]} onChange={e=>setNC({...nC,[k]:e.target.value})}/>)}
            <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="📍 Direccion" value={nC.direccion} onChange={e=>setNC({...nC,direccion:e.target.value})}/>
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
        <div style={{marginTop:10}}><label style={S.lbl}>Fecha de entrega</label><input type="date" style={S.inp} value={entrega} onChange={e=>setEntrega(e.target.value)}/></div>
        <div style={{marginTop:8}}><label style={S.lbl}>Empleada</label>
          <select style={S.inp} value={empId} onChange={e=>setEmpId(parseInt(e.target.value))}>
            {empleadas.filter(e=>e.activa).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div style={{marginTop:8}}><label style={S.lbl}>Notas</label><textarea style={{...S.inp,minHeight:56,resize:"vertical"}} placeholder="Instrucciones..." value={notas} onChange={e=>setNotas(e.target.value)}/></div>
      </Card>
      {err&&<div style={S.err}>{err}</div>}
      <button style={S.btnP} onClick={reg}>🧾 Registrar Venta</button>
    </div>
  );
}

function VentaCardItem({v,empleadas,setTicket,addAbono,setVentas,esAdmin,upsertVenta}){
  const [showAb,setShowAb]=useState(false);
  const emp=empleadas.find(e=>e.id===v.empleadaId);
  const pend=saldo(v);const esPag=pagada(v);
  const abs=v.abonos||[];const totAb=abs.reduce((a,ab)=>a+ab.monto,0);
  const est=getEst(v);
  const toggle=f=>setVentas&&setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,[f]:!vv[f]}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const cambEst=nv=>setVentas&&setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,estado:nv}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
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
  const [nv,setNv]=useState({nombre:"",metaVentas:20,montoBonus:20});
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const mes=mesK(new Date());
  const add=()=>{if(!nv.nombre.trim())return;const ne={id:Date.now(),nombre:nv.nombre,activa:true,metaVentas:parseInt(nv.metaVentas)||20,montoBonus:parseFloat(nv.montoBonus)||0};setEmpleadas(prev=>[...prev,ne]);if(upsertEmpleada)upsertEmpleada({...ne,_updatedAt:new Date().toISOString()});setNv({nombre:"",metaVentas:20,montoBonus:20});};
  const tog=id=>setEmpleadas(prev=>{const next=prev.map(e=>e.id===id?{...e,activa:!e.activa}:e);const updated=next.find(e=>e.id===id);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});
  const save2=()=>{setEmpleadas(prev=>{const next=prev.map(e=>e.id===editId?{...e,...ed,metaVentas:parseInt(ed.metaVentas)||20,montoBonus:parseFloat(ed.montoBonus)||0}:e);const updated=next.find(e=>e.id===editId);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});setEditId(null);};
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
              </div>
              <div style={{display:"flex",gap:8}}><button style={{...S.btnP,flex:1}} onClick={save2}>✓ Guardar</button><button style={S.btnC} onClick={()=>setEditId(null)}>Cancelar</button></div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{e.nombre}</div><div style={{fontSize:12,color:"#888"}}>{e.vm} ventas este mes</div>{esAdmin&&<div style={{fontSize:11,color:"#4db6e4"}}>Meta: {meta} · Bono: ${e.montoBonus||0}</div>}</div>
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


function CierreCaja({ventas,empleadas,onLogout,onCierreListo,onResetCierre,sesion,salidasCaja}){
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
  const [paso,setPaso]=useState(1);
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
    const d={fecha:new Date().toISOString(),emp:sesion?.nombre||"",bills,coins,totEf,fd,efN,tPic:parseFloat(tPic)||0,tJep:parseFloat(tJep)||0,totTr,totTa,dEf,dTr,dTa,dTot,espEf,espEfBruto,espTr,espTa,espTot,totMisSalidas,misSalidas,nv:todosAbonos.length,tv:todosAbonos.reduce((a,ab)=>a+ab.monto,0)};
    try{localStorage.setItem(CK,JSON.stringify(d));}catch{}
    setCg(d);
    if(onCierreListo)onCierreListo();
    imprimir(d);
    // Logout inmediato despues de imprimir (no hay forma de cancelarlo)
    setTimeout(()=>{if(onLogout)onLogout();},2000);
  };
  const regAp=()=>{
    const d={empleadaNombre:empleadas.find(e=>String(e.id)===String(aEmp))?.nombre||"",fondo:parseFloat(fondo)||15,fecha:new Date().toISOString()};
    try{localStorage.setItem(AK,JSON.stringify(d));}catch{}
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
        <button style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#2e7d32,#388e3c)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={()=>{setCg(null);setPaso(1);setModo("cierre");if(onResetCierre)onResetCierre();}}>🔄 Realizar otro cierre</button>
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
        {[{n:1,l:"💵 Billetes"},{n:2,l:"🪙 Monedas"},{n:3,l:"🏦 Digital"},{n:4,l:"✅ Confirmar"}].map(p=>(
          <div key={p.n} style={{...S.badge,background:paso>=p.n?"#1a3c5e":"#e8f0f7",color:paso>=p.n?"#fff":"#888",padding:"6px 10px",fontSize:11,whiteSpace:"nowrap",cursor:paso>p.n?"pointer":"default"}} onClick={()=>{if(paso>p.n)setPaso(p.n);}}>{p.n}. {p.l}</div>
        ))}
      </div>
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
const { data: salidasCaja, setData: setSalidasCaja, upsert: upsertSalida } = useCollection("salidasCaja", "ll_salidas_caja", []);  const [showSalida,setShowSalida]=useState(false);
  const [ticketV,setTicketV]=useState(null);
  // Servicios visibles (excluye los eliminados, que quedan marcados en la nube)
  const serviciosActivos=servicios.filter(s=>!s.eliminada);

  const esAdmin=sesion.rol==="Administrador";
  const addAbono=(f,ab)=>setVentas(prev=>{const next=prev.map(v=>{if(v.folio!==f)return v;const abono={...ab,cobradoPorId:sesion.id,cobradoPorNombre:sesion.nombre};const abs=[...(v.abonos||[]),abono];return{...v,abonos:abs,pagada:saldo({...v,abonos:abs})<=0};});const updated=next.find(v=>v.folio===f);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const handleCierreListo=()=>{
    setCierreOk(true);
    setCajaOk(false);
    setEsperandoApertura(true);
  };
  const exportarDatos=()=>{const d={ventas,clientes,empleadas,inventario,servicios,gastos,depositos,salidasCaja};const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="respaldo-"+hoy+".json";a.click();};
  const importarDatos=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.ventas)setVentas(d.ventas);if(d.clientes)setClientes(d.clientes);if(d.empleadas)setEmpleadas(d.empleadas);if(d.inventario)setInventario(d.inventario);if(d.servicios)setServicios(d.servicios);if(d.gastos)setGastos(d.gastos);if(d.depositos)setDepositos(d.depositos);if(d.salidasCaja)setSalidasCaja(d.salidasCaja);alert("✅ Datos importados");}catch{alert("❌ Error al importar");}};r.readAsText(f);};
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
  />;
  if(!esAdmin)return <PantallaEmpleada ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} servicios={serviciosActivos} sesion={sesion} addAbono={addAbono} onLogout={onLogout} cierreListo={cierreOk} onCierreListo={handleCierreListo} onResetCierre={()=>{setCierreOk(false);setEsperandoApertura(true);}} salidasCaja={salidasCaja} setSalidasCaja={setSalidasCaja} upsertVenta={upsertVenta} upsertSalida={upsertSalida} upsertCliente={upsertCliente}/>;
  const tabs=[
    {id:"ventas",icon:"🧾",l:"Venta"},{id:"historial",icon:"📋",l:"Historial"},
    {id:"pendientes",icon:"⏳",l:"Pendientes",b:pCount},{id:"resumen",icon:"📈",l:"Resumen día"},
    {id:"reportes",icon:"📊",l:"Reportes"},{id:"depositos",icon:"🏦",l:"Depósitos"},
    {id:"conciliacion",icon:"🏛️",l:"Conciliación"},
    {id:"gastos",icon:"🛒",l:"Gastos"},{id:"inventario",icon:"📦",l:"Inventario"},
    {id:"equipo",icon:"👩",l:"Equipo"},{id:"caja",icon:"💰",l:"Caja"},
    {id:"config",icon:"⚙️",l:"Config"},{id:"usuarios",icon:"🔑",l:"Usuarios"},
  ];
  return(<div style={S.app}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#4db6e4;border-radius:3px}`}</style>
    <div style={S.hdr}><div style={S.hdrI}>
      <span style={S.logo}>🫧 Lava<span style={{color:"#4db6e4"}}>&</span>Listo</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:12,color:"#a0c4da"}}>👑 {sesion.nombre}</span>
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
      {tab==="ventas"&&<NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={setTicketV} servicios={serviciosActivos} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente}/>}
      {tab==="historial"&&<Historial ventas={ventas} setVentas={setVentas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} esAdmin={esAdmin} upsertVenta={upsertVenta}/>}
      {tab==="pendientes"&&<Pendientes ventas={ventas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} setVentas={setVentas} upsertVenta={upsertVenta}/>}
      {tab==="resumen"&&<ResumenDia ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="reportes"&&<Reportes ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="depositos"&&<Depositos depositos={depositos} setDepositos={setDepositos} ventas={ventas} salidasCaja={salidasCaja} upsertDeposito={upsertDeposito}/>}
      {tab==="conciliacion"&&<Conciliacion ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} depositos={depositos} setDepositos={setDepositos} upsertDeposito={upsertDeposito}/>}
      {tab==="gastos"&&<Gastos gastos={gastos} setGastos={setGastos} sesion={sesion} upsertGasto={upsertGasto}/>}
      {tab==="inventario"&&<Inventario inventario={inventario} setInventario={setInventario} upsertInventario={upsertInventario}/>}
      {tab==="equipo"&&<Equipo empleadas={empleadas} setEmpleadas={setEmpleadas} ventas={ventas} esAdmin={esAdmin} upsertEmpleada={upsertEmpleada}/>}
      {tab==="caja"&&<CierreCaja ventas={ventas} empleadas={empleadas} onLogout={onLogout} onCierreListo={handleCierreListo} onResetCierre={()=>setCierreOk(false)} sesion={sesion} salidasCaja={salidasCaja}/>}
      {tab==="config"&&<Configuracion servicios={servicios} setServicios={setServicios} exportarDatos={exportarDatos} importarDatos={importarDatos} upsertVenta={upsertVenta} upsertServicio={upsertServicio}/>}
      {tab==="usuarios"&&<GestionUsuarios/>}
    </div>
    {ticketV&&<TicketModal venta={ticketV} empleadas={empleadas} onClose={()=>setTicketV(null)}/>}
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
