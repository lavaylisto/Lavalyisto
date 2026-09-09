import { useState, useEffect, useRef } from "react";
import { useCollection } from "./hooks/useFirestore";
import { storage } from "./firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";


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
  {id:"017",label:"LIBRA ADICIONAL",precio:0.30,limite:3},{id:"018",label:"LAVADO EN SECO TERNO",precio:10.50},
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
// 🛍️ PRODUCTOS: artículos que se venden directamente (no pasan por Producción). Cada venta descuenta el stock solo.
const PRODUCTOS_DEFAULT = [];
// 📒 KARDEX — ficha de movimientos de cada producto/insumo: fecha/hora, tipo, cantidad, folio de referencia y saldo resultante
const KARDEX_PRODUCTOS_DEFAULT = [];
const KARDEX_INSUMOS_DEFAULT = [];
const registrarKardex=({itemId,itemNombre,tipo,cantidad,folio,motivo,saldoResultante,registradoPor,precioUnitario,proveedor},{setKardex,upsertKardex}) => {
  const entry={id:"kx_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),itemId,itemNombre:itemNombre||"",tipo,cantidad,folio:folio||null,motivo:motivo||null,saldoResultante,registradoPor:registradoPor||null,precioUnitario:precioUnitario!=null?precioUnitario:null,proveedor:proveedor||null,fecha:new Date().toISOString()};
  if(setKardex)setKardex(prev=>[entry,...prev]);
  if(upsertKardex)upsertKardex(entry);
  return entry;
};
const TIPO_KARDEX_LBL={venta:{label:"Venta",icon:"🛍️",color:"#c62828"},nota_credito:{label:"Nota de crédito",icon:"↩️",color:"#2e7d32"},ajuste_manual:{label:"Ajuste manual",icon:"✏️",color:"#1565c0"},ingreso_inicial:{label:"Ingreso inicial",icon:"🆕",color:"#7b1fa2"},entrada_factura:{label:"Entrada por factura",icon:"🧾",color:"#2e7d32"},consumo:{label:"Consumo/uso",icon:"📉",color:"#c62828"}};
// 🆕 Genera un código correlativo nuevo para un insumo (INS-0001, INS-0002...) buscando el mayor número ya usado
const generarCodigoInsumo=inventario=>{
  const nums=(inventario||[]).map(i=>{const m=(i.codigo||"").match(/INS-(\d+)/i);return m?parseInt(m[1]):0;});
  const siguiente=(nums.length?Math.max(...nums):0)+1;
  return "INS-"+String(siguiente).padStart(4,"0");
};

// 🎟️ SORTEO POR BOLETOS — datos semilla (vacío, se crea desde el panel admin)
const SORTEOS_DEFAULT = [];
const BOLETOS_SORTEO_DEFAULT = [];
// Encuentra el sorteo activo hoy: activo:true Y dentro del rango de fechas
const sorteoActivoHoy=sorteos=>{
  const hoy=fechaHoyLocal();
  return (sorteos||[]).find(s=>s.activo&&!s.eliminado&&(!s.fechaInicio||hoy>=s.fechaInicio)&&(!s.fechaFin||hoy<=s.fechaFin))||null;
};
// 🎟️ Genera 0, 1 o 2 boletos para una venta que se acaba de pagar por completo:
//   - 1 boleto "monto" si el total de la venta alcanza el mínimo del sorteo activo
//   - 1 boleto "perfume" si la venta incluye al menos un producto con categoria:"aromatizador"
// Cada motivo genera un documento SEPARADO con su propio número correlativo (2 papeles físicos si aplican ambos).
// 👕 Extrae las libras de un nombre de servicio (ej. "LAVADO + SECADO 15LB" → 15)
const librasDeLabel=lbl=>{const m=(lbl||"").match(/(\d+)\s*LB/i);return m?parseInt(m[1]):null;};
// 👕 Libras totales de una venta (solo cuenta renglones que NO son de zapatos)
const librasDeVenta=(venta,esZapatoLbl)=>{
  let total=0;
  (venta.items||[]).forEach(it=>{
    if(esZapatoLbl(it.label))return;
    const lb=librasDeLabel(it.label);
    if(lb)total+=lb*(it.piezas||1);
  });
  return total;
};
// 🏭 ¿Había alguna máquina de ese tipo (lavadora/secadora, sin contar las de zapatos) LIBRE en un momento histórico exacto?
// Se reconstruye mirando el historial de cargas: si ninguna carga de ese tipo de máquina estaba activa en ese instante, estaba libre.
const habiaMaquinaLibreEn=(instante,tipoMaquina,cargas,maquinas)=>{
  const t=new Date(instante).getTime();
  const maquinasDelTipo=maquinas.filter(m=>m.tipo===tipoMaquina&&m.categoria!=="zapatos");
  return maquinasDelTipo.some(m=>{
    const ocupadaEnT=cargas.some(c=>c.maquinaId===m.id&&c.grupo!=="zapatos"&&new Date(c.inicio).getTime()<=t&&(!c.finReal||new Date(c.finReal).getTime()>=t));
    return !ocupadaEnT;
  });
};
// ⏰ Calcula los minutos transcurridos entre dos fechas contando SOLO horario laboral (9:15am-8pm por defecto).
// Las máquinas no trabajan después de las 8pm, así que si una orden queda de un día para otro, esas horas
// nocturnas no cuentan como demora — solo se descuentan las horas reales dentro del horario de atención.
const minutosLaboralesEntre=(inicioIso,finIso,horaAbre=9,minAbre=15,horaCierra=20,minCierra=0)=>{
  const fin=new Date(finIso);
  let cursor=new Date(inicioIso);
  if(fin<=cursor)return 0;
  let total=0,guard=0;
  while(cursor<fin&&guard<90){
    guard++;
    const apertura=new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate(),horaAbre,minAbre,0,0);
    const cierre=new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate(),horaCierra,minCierra,0,0);
    if(cursor<apertura)cursor=new Date(apertura);
    const tope=cierre<fin?cierre:fin;
    if(cursor<tope)total+=(tope-cursor)/60000;
    cursor=new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+1,horaAbre,minAbre,0,0);
  }
  return total;
};
const generarBoletosParaVenta=(venta,{sorteos,setSorteos,upsertSorteo,setBoletosSorteo,upsertBoletoSorteo,productos})=>{
  const sorteo=sorteoActivoHoy(sorteos);
  if(!sorteo)return[];
  if(venta.boletoSorteoGenerado)return[]; // 🔒 ya se generaron boletos para esta venta, no duplicar
  const motivos=[];
  // 🎟️ Un boleto por CADA vez que se alcanza el umbral (ej. $47 con umbral $10 = 4 boletos, no 1)
  if(sorteo.umbralMonto&&sorteo.umbralMonto>0){
    const vecesAlcanzado=Math.floor((venta.total||0)/sorteo.umbralMonto);
    for(let i=0;i<vecesAlcanzado;i++)motivos.push("monto");
  }
  const tienePerfume=(venta.items||[]).some(it=>{
    if(!it.esProducto)return false;
    const p=(productos||[]).find(x=>x.id===it.productoId);
    return p?.categoria==="aromatizador";
  });
  if(tienePerfume)motivos.push("perfume");
  if(venta.boletoResenaSolicitado)motivos.push("resena");
  if(motivos.length===0)return[];
  let ultimo=sorteo.ultimoNumeroBoleto||0;
  const nuevos=motivos.map(motivo=>{
    ultimo+=1;
    return{
      id:"bol_"+sorteo.id+"_"+ultimo, // 🔒 id determinístico: si por alguna razón se reintenta, sobreescribe en vez de duplicar
      numeroBoleto:ultimo,
      sorteoId:sorteo.id,
      clienteNombre:venta.clienteNombre||"",
      clienteTelefono:venta.clienteTel||"",
      montoVenta:venta.total||0,
      ventaId:venta.folio,
      motivo,
      fecha:new Date().toISOString(),
    };
  });
  setBoletosSorteo(prev=>[...nuevos,...prev]);
  nuevos.forEach(b=>{if(upsertBoletoSorteo)upsertBoletoSorteo({...b,_updatedAt:new Date().toISOString()});});
  const sorteoActualizado={...sorteo,ultimoNumeroBoleto:ultimo};
  setSorteos(prev=>prev.map(s=>s.id===sorteo.id?sorteoActualizado:s));
  if(upsertSorteo)upsertSorteo({...sorteoActualizado,_updatedAt:new Date().toISOString()});
  return nuevos;
};
// 🎟️ Imprime un boleto en formato angosto (58/80mm) — sin datos personales del cliente en el papel
const imprimirBoletoSorteo=(boleto,sorteo)=>{
  const w=window.open("","_blank","width=320,height=520");
  if(!w)return;
  const html="<html><head><meta charset='UTF-8'><title>Boleto #"+boleto.numeroBoleto+"</title><style>"
    +"body{font-family:sans-serif;margin:0;padding:14px;width:280px;text-align:center}"
    +".lbl{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px}"
    +".num{font-size:58px;font-weight:900;color:#000;letter-spacing:2px;margin:12px 0}"
    +".premio{font-size:16px;font-weight:800;margin:6px 0}"
    +".div{border-top:2px dashed #000;margin:10px 0}"
    +"@media print{body{margin:0;padding:8px}}"
    +"</style></head><body>"
    +"<div class='lbl'>🎟️ Boleto de sorteo</div>"
    +"<div class='num'>#"+String(boleto.numeroBoleto).padStart(4,"0")+"</div>"
    +"<div class='div'></div>"
    +"<div class='premio'>"+(sorteo?.premio||"")+"</div>"
    +"<div class='lbl' style='margin-top:4px'>"+(sorteo?.nombre||"")+"</div>"
    +"<div class='div'></div>"
    +"<div style='font-size:13px;font-weight:700;color:#1a3c5e'>"+(boleto.clienteNombre||"")+"</div>"
    +"<div style='font-size:11px;color:#888;margin-top:2px'>Orden: "+(boleto.ventaId||"")+"</div>"
    +"<div style='font-size:11px;color:#888;margin-top:6px'>"+fmtD(boleto.fecha)+"</div>"
    +"<div style='font-size:10px;color:#aaa;margin-top:10px'>🫧 Lava&amp;Listo · Ricaurte, Cuenca</div>"
    +"<scr"+"ipt>window.print();window.close();</"+"script></body></html>";
  w.document.write(html);
  w.document.close();
};
// 🎟️ Mensaje y enlace de WhatsApp para confirmar la participación del cliente en el sorteo
const msgWaBoletoSorteo=(boleto,sorteo)=>{
  const L="\u2501".repeat(15);
  return `\u{1F39F}\uFE0F *LAVA & LISTO* \u{1F39F}\uFE0F\n${L}\n\u00A1Ya est\u00E1s participando! \u{1F389}\n\nTu boleto *#${boleto.numeroBoleto}* qued\u00F3 registrado en el sorteo de:\n\u{1F381} *${sorteo?.premio||""}*\n\n${L}\n\u00A1Mucha suerte! \u{1F499}\n\u{1F4CD} Ricaurte, Cuenca`;
};
const waBoletoSorteoUrl=(boleto,sorteo)=>{
  const tel=telWa(boleto.clienteTelefono);
  if(!tel)return null;
  return `https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msgWaBoletoSorteo(boleto,sorteo))}`;
};
// 🎟️ Etiqueta legible para cada motivo de boleto
const etiquetaMotivoBoleto=motivo=>motivo==="monto"?"Por monto de compra":motivo==="perfume"?"Por aromatizador textil":motivo==="resena"?"Por reseña/seguir en redes":motivo;
const EMPLEADAS_DEFAULT = [
  {id:1,nombre:"Ana Garcia",activa:true,metaVentas:20,montoBonus:20},
  {id:2,nombre:"Maria Lopez",activa:true,metaVentas:20,montoBonus:20},
];
// 🏭 PRODUCCIÓN — Fase 1: catálogo semilla de máquinas del local
const MAQUINAS_DEFAULT = [
  {id:"L1",nombre:"Lavadora 1",tipo:"lavadora",categoria:"general",zona:"Cuarto principal",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"L2",nombre:"Lavadora 2",tipo:"lavadora",categoria:"general",zona:"Cuarto principal",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"L3",nombre:"Lavadora 3",tipo:"lavadora",categoria:"general",zona:"Cuarto principal",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"S1",nombre:"Secadora 1",tipo:"secadora",categoria:"general",zona:"Cuarto principal",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"S2",nombre:"Secadora 2",tipo:"secadora",categoria:"general",zona:"Cuarto principal",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"S3",nombre:"Secadora 3",tipo:"secadora",categoria:"general",zona:"Afuera",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"S4",nombre:"Secadora 4",tipo:"secadora",categoria:"general",zona:"Afuera",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"1LZ",nombre:"Lavadora Zapatos",tipo:"lavadora",categoria:"zapatos",zona:"Afuera",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
  {id:"1SZ",nombre:"Secadora Zapatos",tipo:"secadora",categoria:"zapatos",zona:"Afuera",capacidadKg:null,estado:"libre",cargaActualId:null,finProgramado:null},
];
// 📋 TAREAS — Fase 1: plantillas semilla (§4 de la especificación). LV=lun-vie, SAB=sábado, DOM=domingo.
const LV=["lun","mar","mie","jue","vie"];
const LVS=["lun","mar","mie","jue","vie","sab"]; // 🧾 lunes a sábado — turno de recepción
const DIAS_KEY=["dom","lun","mar","mie","jue","vie","sab"]; // índice = Date.getDay()
// 📷 TAREAS — comprime una foto (máx 800px, como pide la especificación) y la sube a Firebase Storage; devuelve la URL de descarga
const comprimirImagen=(file,maxDim=800)=>new Promise((resolve,reject)=>{
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    let{width,height}=img;
    if(width>maxDim||height>maxDim){
      if(width>height){height=Math.round(height*(maxDim/width));width=maxDim;}
      else{width=Math.round(width*(maxDim/height));height=maxDim;}
    }
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    canvas.getContext("2d").drawImage(img,0,0,width,height);
    canvas.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error("No se pudo comprimir la imagen"));},"image/jpeg",0.8);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("No se pudo leer la imagen"));};
  img.src=url;
});
const subirFoto=async(file,carpeta)=>{
  if(!storage)throw new Error("Firebase Storage no está configurado.");
  const blob=await comprimirImagen(file);
  const nombre=`${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
  const r=storageRef(storage,nombre);
  // ⏱️ Si la subida no responde en 20 segundos (ej. problema de conexión o de configuración de Storage),
  // se cancela con un error claro en vez de dejar la pantalla "cargando" para siempre.
  const conTiempoLimite=(promesa,ms,mensaje)=>Promise.race([
    promesa,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(mensaje)),ms))
  ]);
  await conTiempoLimite(uploadBytes(r,blob,{contentType:"image/jpeg"}),20000,"La subida tardó demasiado — revisa tu conexión a internet e intenta de nuevo.");
  return await conTiempoLimite(getDownloadURL(r),10000,"No se pudo obtener el enlace de la foto — intenta de nuevo.");
};
// 🔔 Sonido de alerta corto (sin archivo externo) para avisos nuevos, ej. restregado que llega
const reproducirSonidoAlerta=()=>{
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    const ctx=new Ctx();
    [880,660].forEach((freq,i)=>{
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type="sine";o.frequency.value=freq;
      const t0=ctx.currentTime+i*0.18;
      g.gain.setValueAtTime(0.0001,t0);
      g.gain.exponentialRampToValueAtTime(0.35,t0+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+0.3);
      o.start(t0);o.stop(t0+0.32);
    });
  }catch{}
};
const PLANTILLAS_TAREAS_DEFAULT=[
  // — LUNES A VIERNES: APERTURA (Karen, límite 9:30) —
  {id:"t01",titulo:"Abrir local y dejar mostrador operativo para clientes de la mañana",descripcion:null,area:"general",bloque:"apertura",diasSemana:LV,horaLimite:"09:30",orden:1,activa:true,requiereFoto:false},
  {id:"t02",titulo:"Encender máquinas y verificar funcionamiento (L1–L3, S1–S4)",descripcion:null,area:"atras",bloque:"apertura",diasSemana:LV,horaLimite:"09:30",orden:2,activa:true,requiereFoto:false},
  {id:"t03",titulo:"Limpiar área de lavado: mesa de clasificación y pisos",descripcion:null,area:"atras",bloque:"apertura",diasSemana:LV,horaLimite:"09:30",orden:3,activa:true,requiereFoto:false},
  {id:"t04",titulo:"Verificar insumos de lavado: detergente, suavizante, quitamanchas",descripcion:"Dejar nota si falta algo",area:"atras",bloque:"apertura",diasSemana:LV,horaLimite:"09:30",orden:4,activa:true,requiereFoto:false},
  {id:"t05",titulo:"Revisar órdenes pendientes del día anterior y priorizar entregas de hoy",descripcion:null,area:"general",bloque:"apertura",diasSemana:LV,horaLimite:"09:30",orden:5,activa:true,requiereFoto:false},
  // — MEDIA JORNADA (Karen, límite 13:00) —
  {id:"t06",titulo:"Actualizar estados de todas las órdenes en el sistema",descripcion:"Nada 'lavando' que ya terminó",area:"atras",bloque:"media_jornada",diasSemana:LV,horaLimite:"13:00",orden:6,activa:true,requiereFoto:false},
  {id:"t07",titulo:"Guardar objetos encontrados en fundas ziploc etiquetadas con nº de orden",descripcion:null,area:"atras",bloque:"media_jornada",diasSemana:LV,horaLimite:"13:00",orden:7,activa:true,requiereFoto:false},
  {id:"t08",titulo:"Limpiar mesa de doblado",descripcion:null,area:"atras",bloque:"media_jornada",diasSemana:LV,horaLimite:"13:00",orden:8,activa:true,requiereFoto:false},
  // — CAMBIO DE TURNO (Karen y Nicole juntas, límite 13:45) —
  {id:"t09",titulo:"Repaso de órdenes en proceso y entregas de la tarde (2 min)",descripcion:null,area:"general",bloque:"cambio_turno",diasSemana:LV,horaLimite:"13:45",orden:9,activa:true,requiereFoto:false},
  {id:"t10",titulo:"Confirmar en el tablero que ninguna máquina tenga carga vencida (roja)",descripcion:null,area:"general",bloque:"cambio_turno",diasSemana:LV,horaLimite:"13:45",orden:10,activa:true,requiereFoto:false},
  // — TARDE (Nicole, límite 15:00) —
  {id:"t11",titulo:"Limpiar y ordenar mostrador y área de atención",descripcion:null,area:"adelante",bloque:"media_jornada",diasSemana:LV,horaLimite:"15:00",orden:11,activa:true,requiereFoto:false},
  {id:"t12",titulo:"Revisar insumos de adelante: fundas, perfume, hojas, cintas, insumos de oficina",descripcion:"Dejar nota si falta algo",area:"adelante",bloque:"media_jornada",diasSemana:LV,horaLimite:"15:00",orden:12,activa:true,requiereFoto:false},
  {id:"t13",titulo:"Verificar órdenes listas etiquetadas y organizadas para entrega",descripcion:null,area:"adelante",bloque:"media_jornada",diasSemana:LV,horaLimite:"15:00",orden:13,activa:true,requiereFoto:false},
  // — CIERRE (límite 18:00) —
  {id:"t14",titulo:"Limpiar filtros de pelusa de las 4 secadoras",descripcion:null,area:"atras",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:14,activa:true,requiereFoto:false},
  {id:"t15",titulo:"Revisar tambores de lavadoras (que no queden prendas) y limpiar empaques",descripcion:null,area:"atras",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:15,activa:true,requiereFoto:false},
  {id:"t16",titulo:"Barrer/trapear área de lavado y sacar basura de atrás",descripcion:null,area:"atras",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:16,activa:true,requiereFoto:false},
  {id:"t17",titulo:"Limpiar mostrador y barrer área de atención",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:17,activa:true,requiereFoto:false},
  {id:"t18",titulo:"Sacar basura de adelante",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:18,activa:true,requiereFoto:false},
  {id:"t19",titulo:"Cuadre de caja",descripcion:"Módulo Caja",area:"adelante",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:19,activa:true,requiereFoto:false},
  {id:"t20",titulo:"Dejar nota a administración con pendientes del día (si los hay) y apagar equipos",descripcion:null,area:"general",bloque:"cierre",diasSemana:LV,horaLimite:"18:00",orden:20,activa:true,requiereFoto:false},
  // — SÁBADO —
  {id:"s01",titulo:"Encender máquinas y verificar funcionamiento (L1–L3, S1–S4)",descripcion:null,area:"atras",bloque:"apertura",diasSemana:["sab"],horaLimite:"08:30",orden:1,activa:true,requiereFoto:false},
  {id:"s02",titulo:"Revisar órdenes pendientes del día anterior y priorizar entregas de hoy",descripcion:null,area:"general",bloque:"apertura",diasSemana:["sab"],horaLimite:"08:30",orden:2,activa:true,requiereFoto:false},
  {id:"s03",titulo:"Limpiar y ordenar mostrador y área de atención",descripcion:null,area:"adelante",bloque:"apertura",diasSemana:["sab"],horaLimite:"08:30",orden:3,activa:true,requiereFoto:false},
  {id:"s04",titulo:"Actualizar estados de todas las órdenes en el sistema",descripcion:"Nada 'lavando' que ya terminó",area:"atras",bloque:"cierre",diasSemana:["sab"],horaLimite:"13:00",orden:4,activa:true,requiereFoto:false},
  {id:"s05",titulo:"Revisar insumos de adelante: fundas, perfume, hojas, cintas, insumos de oficina",descripcion:"Dejar nota si falta algo",area:"adelante",bloque:"cierre",diasSemana:["sab"],horaLimite:"13:00",orden:5,activa:true,requiereFoto:false},
  {id:"s06",titulo:"Cuadre de caja parcial",descripcion:"Módulo Caja",area:"adelante",bloque:"cierre",diasSemana:["sab"],horaLimite:"13:00",orden:6,activa:true,requiereFoto:false},
  {id:"s07",titulo:"Dejar nota con pendientes para Karen (turno de la tarde)",descripcion:null,area:"general",bloque:"cierre",diasSemana:["sab"],horaLimite:"13:00",orden:7,activa:true,requiereFoto:false},
  {id:"s08",titulo:"Leer nota dejada por Nicole en la mañana",descripcion:null,area:"general",bloque:"apertura",diasSemana:["sab"],horaLimite:"14:15",orden:8,activa:true,requiereFoto:false},
  {id:"s09",titulo:"Verificar máquinas y órdenes en proceso",descripcion:null,area:"atras",bloque:"apertura",diasSemana:["sab"],horaLimite:"14:15",orden:9,activa:true,requiereFoto:false},
  {id:"s10",titulo:"Limpiar filtros de pelusa de las 4 secadoras",descripcion:null,area:"atras",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:10,activa:true,requiereFoto:false},
  {id:"s11",titulo:"Revisar tambores de lavadoras (que no queden prendas) y limpiar empaques",descripcion:null,area:"atras",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:11,activa:true,requiereFoto:false},
  {id:"s12",titulo:"Barrer/trapear área de lavado y sacar basura de atrás",descripcion:null,area:"atras",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:12,activa:true,requiereFoto:false},
  {id:"s13",titulo:"Limpiar mostrador y barrer área de atención",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:13,activa:true,requiereFoto:false},
  {id:"s14",titulo:"Sacar basura de adelante",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:14,activa:true,requiereFoto:false},
  {id:"s15",titulo:"Cuadre de caja",descripcion:"Módulo Caja",area:"adelante",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:15,activa:true,requiereFoto:false},
  {id:"s16",titulo:"Dejar nota a administración con pendientes del día (si los hay) y apagar equipos",descripcion:null,area:"general",bloque:"cierre",diasSemana:["sab"],horaLimite:"18:00",orden:16,activa:true,requiereFoto:false},
  // — DOMINGO (Natalia o Micaela) —
  {id:"d01",titulo:"Encender equipos, dejar mostrador operativo",descripcion:null,area:"general",bloque:"apertura",diasSemana:["dom"],horaLimite:"09:30",orden:1,activa:true,requiereFoto:false},
  {id:"d02",titulo:"Revisar órdenes del día",descripcion:null,area:"general",bloque:"apertura",diasSemana:["dom"],horaLimite:"09:30",orden:2,activa:true,requiereFoto:false},
  {id:"d03",titulo:"Limpiar filtros de pelusa de las secadoras",descripcion:null,area:"general",bloque:"cierre",diasSemana:["dom"],horaLimite:"18:00",orden:3,activa:true,requiereFoto:false},
  {id:"d04",titulo:"Barrer y sacar basura",descripcion:null,area:"general",bloque:"cierre",diasSemana:["dom"],horaLimite:"18:00",orden:4,activa:true,requiereFoto:false},
  {id:"d05",titulo:"Cuadre de caja",descripcion:"Módulo Caja",area:"general",bloque:"cierre",diasSemana:["dom"],horaLimite:"18:00",orden:5,activa:true,requiereFoto:false},
  // — SEMANALES (límite 18:00 del día indicado) —
  {id:"w01",titulo:"Limpieza profunda de baño/lavabo",descripcion:null,area:"general",bloque:"semanal",diasSemana:["lun"],horaLimite:"18:00",orden:1,activa:true,requiereFoto:false},
  {id:"w02",titulo:"Limpiar vidrios y puerta de entrada",descripcion:null,area:"adelante",bloque:"semanal",diasSemana:["mie"],horaLimite:"18:00",orden:2,activa:true,requiereFoto:false},
  {id:"w03",titulo:"Inventario completo de atrás: detergente, suavizante, quitamanchas, cloro y demás químicos",descripcion:"Registrar cantidades y dejar nota de compras",area:"atras",bloque:"semanal",diasSemana:["vie"],horaLimite:"18:00",orden:3,activa:true,requiereFoto:true},
  {id:"w04",titulo:"Inventario completo de adelante: fundas, perfume, hojas, cinta masking, cinta adhesiva, insumos de oficina",descripcion:"Registrar cantidades y dejar nota de compras",area:"adelante",bloque:"semanal",diasSemana:["vie"],horaLimite:"18:00",orden:4,activa:true,requiereFoto:true},
  {id:"w05",titulo:"Limpieza exterior de máquinas (paneles, puertas, detrás)",descripcion:null,area:"atras",bloque:"semanal",diasSemana:["vie"],horaLimite:"18:00",orden:5,activa:true,requiereFoto:false},
  // — RECEPCIONISTA (lunes a sábado, turno 13:30–18:00) — visibles SOLO para el rol funcional "recepcionista" —
  {id:"rec01",titulo:"Revisar las órdenes de trabajo y avisar por WhatsApp a los clientes con servicio listo para retirar",descripcion:null,area:"adelante",bloque:"apertura",diasSemana:LVS,horaLimite:"13:45",orden:1,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec02",titulo:"Facturar lo pendiente (checklist de Facturación SRI)",descripcion:null,area:"adelante",bloque:"media_jornada",diasSemana:LVS,horaLimite:"16:30",orden:2,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec03",titulo:"Limpiar su área de trabajo (mostrador y oficina)",descripcion:null,area:"adelante",bloque:"media_jornada",diasSemana:LVS,horaLimite:"16:30",orden:3,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec04",titulo:"Imprimir el Resumen del día y adjuntar el comprobante de depósito",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:LVS,horaLimite:"18:00",orden:4,activa:true,requiereFoto:true,rolRequerido:"recepcionista"},
  {id:"rec05",titulo:"Realizar el depósito del efectivo si todavía no se ha hecho",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:LVS,horaLimite:"18:00",orden:5,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec06",titulo:"Dejar el piso limpio y toda la oficina ordenada antes de salir",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:LVS,horaLimite:"18:00",orden:6,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec07",titulo:"Revisar inventario de perfume, fundas e insumos de oficina — anotar o reponer lo que falte",descripcion:"Dos veces por semana: lunes y viernes",area:"adelante",bloque:"semanal",diasSemana:["lun","vie"],horaLimite:"17:00",orden:7,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
  {id:"rec08",titulo:"Sacar la basura",descripcion:null,area:"adelante",bloque:"cierre",diasSemana:["lun","mie","vie"],horaLimite:"18:00",orden:8,activa:true,requiereFoto:false,rolRequerido:"recepcionista"},
];
// 🎯 INCENTIVOS: comisión por impulsación de promo + bonos por meta grupal (editable desde el panel admin)
const INCENTIVOS_DEFAULT = [{id:"config",comisionImpulso:0.40,bonoMetaPct:1,bonoExcedentePct:10,comisionPerfume:0.40}];
// 📋 EVALUACIÓN DE DESEMPEÑO — pesos (deben sumar 100), metas, y tiempos estándar por etapa (minutos)
const EVAL_CONFIG_DEFAULT=[{
  id:"config",
  pesos:{protocolo:15,ticket:5,quejas:10,tiempoOrdenes:20,registroTiempo:15,reprocesos:10,tareas:15,asistencia:10,ventaPerfumes:0},
  metas:{protocolo:90,ticket:8,quejas:1,tiempoOrdenes:90,registroTiempo:90,reprocesos:1,tareas:95,asistencia:95,ventaPerfumes:5},
  // ⏱️ Tiempos estándar reales (minutos) — ropa vs zapatos son distintos procesos con distinta duración
  tiemposEstandar:{lavado:67,centrifugado:15,secado:70,doblado:20},
  tiemposEstandarZapatos:{lavado:78,centrifugado:15,secado:90}, // 1.3h lavado, 15min centrifugado (6-7 pares), 1.5h secado (20 pares)
  toleranciaPuntualidadMin:10, // minutos de tolerancia para contar como "a tiempo"
}];
const EVAL_INDICADORES=[
  {key:"protocolo",label:"% clientes atendidos con protocolo completo",unidad:"%",grupo:"Atención y ventas"},
  {key:"ticket",label:"Ticket promedio por cliente",unidad:"$",grupo:"Atención y ventas",invertido:false},
  {key:"quejas",label:"N° de quejas del mes",unidad:"#",grupo:"Atención y ventas",esMaximo:true},
  {key:"tiempoOrdenes",label:"% órdenes entregadas dentro del tiempo estándar",unidad:"%",grupo:"Tiempos de proceso"},
  {key:"registroTiempo",label:"% órdenes registradas a tiempo en el sistema",unidad:"%",grupo:"Tiempos de proceso"},
  {key:"reprocesos",label:"N° de reprocesos del mes",unidad:"#",grupo:"Tiempos de proceso",esMaximo:true},
  {key:"tareas",label:"% de tareas diarias cumplidas",unidad:"%",grupo:"Tareas"},
  {key:"asistencia",label:"% de asistencia/puntualidad",unidad:"%",grupo:"Tareas"},
  {key:"ventaPerfumes",label:"Venta de aromatizadores/perfumes (meta 5 al mes)",unidad:"#",grupo:"Atención y ventas"},
];
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
// 📋 EVALUACIÓN DE DESEMPEÑO — calcula los 8 indicadores de una colaboradora para un mes específico,
// usando ÚNICAMENTE datos que ya existen en el sistema (ventas, cargas de producción, tareas, quejas).
function calcularKPIsEmpleada(empleadaId,mes,{ventas,eventosProduccion,tareasDiarias,quejas,cargas,empleada,config,calificacionesAudio,ventasPerfumeReg}){
  const empId=String(empleadaId);
  const enMes=fechaIso=>mesK(new Date(fechaIso))===mes;

  // --- ATENCIÓN Y VENTAS ---
  const ventasMes=(ventas||[]).filter(v=>!v.anulada&&String(v.empleadaId)===empId&&enMes(v.fecha));
  // 🎧 Protocolo: promedio de las calificaciones manuales de audios escuchados este mes (2 por semana, ~8 al mes)
  const audiosDelMes=(calificacionesAudio||[]).filter(c=>String(c.empleadaId)===empId&&enMes(c.fecha));
  const pctProtocolo=audiosDelMes.length>0?audiosDelMes.reduce((a,c)=>a+c.calificacion,0)/audiosDelMes.length:null;
  const ticketProm=ventasMes.length>0?ventasMes.reduce((a,v)=>a+v.total,0)/ventasMes.length:null;
  const quejasMes=(quejas||[]).filter(q=>String(q.empleadaId)===empId&&enMes(q.fecha)).length;
  // 🧴 Ventas de aromatizador/perfume registradas manualmente este mes
  const perfumesMes=(ventasPerfumeReg||[]).filter(r=>String(r.empleadaId)===empId&&enMes(r.fecha)).length;

  // --- TIEMPOS DE PROCESO ---
  // Cargas (lavado/centrifugado/secado) que ELLA inició y ya se retiraron, dentro del mes
  const cargasDelMes=(cargas||[]).filter(c=>String(c.empleadaId)===empId&&c.finReal&&["lavado","centrifugado","secado"].includes(c.tipo)&&enMes(c.inicio));
  const dentroDeTiempo=cargasDelMes.filter(c=>{
    const duracionReal=(new Date(c.finReal)-new Date(c.inicio))/60000;
    const tablaEstandar=c.grupo==="zapatos"?(config.tiemposEstandarZapatos||config.tiemposEstandar):config.tiemposEstandar;
    const estandar=(tablaEstandar&&tablaEstandar[c.tipo])||c.minutosProgramados||45;
    return duracionReal<=estandar*1.15; // 15% de margen sobre el estándar
  });
  const pctTiempoOrdenes=cargasDelMes.length>0?(dentroDeTiempo.length/cargasDelMes.length)*100:null;
  const reprocesosMes=cargasDelMes.filter(c=>c.esRepeticion).length;

  // "Registrado a tiempo": entre el fin de una etapa y el inicio de la siguiente (misma orden, misma persona),
  // el tiempo debe ser realista (≥3 min) — así se detecta si varias etapas se marcaron todas juntas al final del día.
  const eventosMes=(eventosProduccion||[]).filter(ev=>String(ev.empleadaId)===empId&&enMes(ev.timestamp));
  const porFolio={};
  eventosMes.forEach(ev=>{(porFolio[ev.ventaFolio]=porFolio[ev.ventaFolio]||[]).push(ev);});
  let transicionesTotal=0,transicionesOk=0;
  Object.values(porFolio).forEach(evs=>{
    const ordenados=[...evs].sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
    for(let i=1;i<ordenados.length;i++){
      transicionesTotal++;
      const gapMin=(new Date(ordenados[i].timestamp)-new Date(ordenados[i-1].timestamp))/60000;
      if(gapMin>=3)transicionesOk++;
    }
  });
  const pctRegistroTiempo=transicionesTotal>0?(transicionesOk/transicionesTotal)*100:null;

  // --- TAREAS ---
  const tareasDeElla=(tareasDiarias||[]).filter(t=>!t.eliminada&&enMes(t.fecha)&&t.empleadaIds&&t.empleadaIds.some(id=>String(id)===empId));
  const tareasCumplidas=tareasDeElla.filter(t=>t.estado==="completada").length;
  const pctTareas=tareasDeElla.length>0?(tareasCumplidas/tareasDeElla.length)*100:null;

  // --- ASISTENCIA/PUNTUALIDAD ---
  // Días con actividad registrada este mes, comparando la 1ra actividad del día contra la hora esperada de entrada
  const horaEsperada=empleada?.horaEntradaEsperada||"09:00";
  const [hE,mE]=horaEsperada.split(":").map(Number);
  const toleranciaMin=config.toleranciaPuntualidadMin!=null?config.toleranciaPuntualidadMin:10;
  const actividadPorDia={};
  eventosMes.forEach(ev=>{const d=fechaLocal(ev.timestamp);(actividadPorDia[d]=actividadPorDia[d]||[]).push(ev.timestamp);});
  (tareasDeElla||[]).filter(t=>t.completadaEn).forEach(t=>{const d=fechaLocal(t.completadaEn);(actividadPorDia[d]=actividadPorDia[d]||[]).push(t.completadaEn);});
  const diasConActividad=Object.keys(actividadPorDia);
  const diasATiempo=diasConActividad.filter(d=>{
    const primera=actividadPorDia[d].sort()[0];
    const t=new Date(primera);
    const limite=new Date(t);limite.setHours(hE,mE+toleranciaMin,0,0);
    return t<=limite;
  });
  const pctAsistencia=diasConActividad.length>0?(diasATiempo.length/diasConActividad.length)*100:null;

  // --- Arma la tabla final: por cada indicador, meta/real/% cumplimiento/peso/puntaje ---
  const valores={protocolo:pctProtocolo,ticket:ticketProm,quejas:quejasMes,tiempoOrdenes:pctTiempoOrdenes,registroTiempo:pctRegistroTiempo,reprocesos:reprocesosMes,tareas:pctTareas,asistencia:pctAsistencia,ventaPerfumes:perfumesMes};
  const filas=EVAL_INDICADORES.map(ind=>{
    const real=valores[ind.key];
    const meta=config.metas[ind.key];
    const peso=config.pesos[ind.key];
    let pctCumplimiento=null;
    if(real!=null){
      if(ind.esMaximo){
        // Para quejas/reprocesos: cumplir 100% si real <= meta; si se pasa, penaliza proporcionalmente
        pctCumplimiento=real<=meta?100:Math.max(0,100-((real-meta)*50));
      }else if(ind.key==="ticket"){
        pctCumplimiento=Math.min(100,(real/meta)*100);
      }else{
        pctCumplimiento=Math.min(100,(real/meta)*100);
      }
    }
    const puntaje=pctCumplimiento!=null?(pctCumplimiento/100)*peso:0;
    return{...ind,real,meta,peso,pctCumplimiento,puntaje,sinDatos:real==null};
  });
  const notaFinal=filas.reduce((a,f)=>a+f.puntaje,0);
  return{filas,notaFinal};
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
// 🔧 Si es una fecha "pura" (ej. "2026-08-01", como v.entrega) se arma como fecha LOCAL en vez de UTC,
// para que no se recorra un día hacia atrás en husos horarios negativos como Ecuador (UTC-5).
const fmtD=d=>{
  if(typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)){
    const[y,m,day]=d.split("-").map(Number);
    return new Date(y,m-1,day).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
  }
  return new Date(d).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
};
const semISO=d=>{const dt=new Date(d);dt.setHours(0,0,0,0);dt.setDate(dt.getDate()+3-((dt.getDay()+6)%7));const w1=new Date(dt.getFullYear(),0,4);return dt.getFullYear()+"-W"+String(1+Math.round(((dt-w1)/86400000-3+((w1.getDay()+6)%7))/7)).padStart(2,"0");};
const mesK=d=>{const dt=new Date(d);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");};
// 🔧 Normaliza nombres para comparar sin importar tildes, mayúsculas o espacios extra (usuario vs empleada)
const normNombre=s=>(s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
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
// 🚦 Clasifica a un cliente según su historial de compras: "nuevo" (1 sola compra), "habitual" (volvió en ≤21 días),
// "poco" (más de 21 días sin venir), o null si nunca ha comprado. Se usa tanto en el dashboard de admin como en
// las pantallas de las colaboradoras, para que cualquiera vea de un vistazo qué tipo de cliente es.
const VENTANA_HABITUAL_CLIENTE=21;
const clasificarCliente=(clienteId,ventas)=>{
  const vs=(ventas||[]).filter(v=>!v.anulada&&String(v.clienteId)===String(clienteId)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  if(vs.length===0)return null;
  const ultima=vs[vs.length-1].fecha;
  const diasDesdeUltima=Math.floor((new Date()-new Date(ultima))/86400000);
  if(vs.length===1)return diasDesdeUltima<=VENTANA_HABITUAL_CLIENTE?"nuevo":"poco";
  return diasDesdeUltima<=VENTANA_HABITUAL_CLIENTE?"habitual":"poco";
};
const SEMAFORO_CLIENTE_INFO={nuevo:{icon:"🆕",label:"Nuevo",color:"#7b1fa2"},habitual:{icon:"🟢",label:"Habitual",color:"#2e7d32"},poco:{icon:"🟡",label:"Poco frecuente",color:"#e65100"}};
// 🚦 Insignia pequeña para mostrar junto al nombre del cliente en cualquier pantalla
const SemaforoCliente=({clienteId,ventas})=>{
  const tipo=clasificarCliente(clienteId,ventas);
  if(!tipo)return null;
  const info=SEMAFORO_CLIENTE_INFO[tipo];
  return<span title={info.label} style={{fontSize:11}}>{info.icon}</span>;
};
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
  if(tipo==="recibido"){
    const manchaLinea=v.prendaManchaAviso?`\n${E.item} *Prenda que puede destiñir/manchar declarada:* ${v.prendaManchaObs}\n${L}`:"";
    return `${E.burbuja} *LAVA & LISTO* ${E.burbuja}\n_Lavanderia & Limpieza Especializada_\n${L}\n¡Hola *${v.clienteNombre}*! ${E.saludo}\nTu orden fue *RECIBIDA* ${E.check}\n\n${E.folio} *Folio:* ${v.folio}\n${L}\n*DETALLE DEL SERVICIO:*\n${items}\n${L}${manchaLinea}\n${E.dinero} *Total:* $${v.total.toFixed(2)}\n${pend>0?`${E.reloj} *Saldo pendiente:* $${pend.toFixed(2)}`:`${E.check} *Pagado en su totalidad*`}\n${E.fecha} *Entrega estimada:* ${fmtD(v.entrega)}\n${L}\n¡Gracias por confiar en nosotros! ${E.corazon}\n${E.pin} Ricaurte, Cuenca\n\n_No nos hacemos responsables por daños, manchas o decoloración en su ropa si la información sobre prendas que destiñen o manchan no fue proporcionada correctamente al momento de dejar la orden._`;
  }
  // 🧽 Detalle del restregado extra (si se solicitó), para que el cliente vea siempre qué se incluyó o no en su cuenta final
  const rEstado=v.clasificacion?.restregadoEstado;
  const rCosto=v.clasificacion?.restregadoCosto;
  const restregadoLinea=rEstado==="autorizado"?`\n${E.item} *Incluye restregado extra autorizado:* $${(rCosto||0).toFixed(2)}\n${L}`:rEstado==="rechazado"?`\n${E.item} *Restregado extra:* no autorizado por el cliente\n${L}`:"";
  // 🔑 Objetos personales encontrados al revisar la prenda (billetes, llaves, etc.), para que el cliente sepa que están guardados
  const objetosLinea=v.clasificacion?.objetosEncontrados?`\n${E.item} *Encontramos y guardamos:* ${v.clasificacion.objetosEncontrados}\n${L}`:"";
  // 🧾 Servicios adicionales encontrados (zapatos, sábanas, peluches, etc.) ya resueltos con el cliente
  const decididos=(v.clasificacion?.serviciosAdicionales||[]).filter(s=>s.estado==="autorizado"||s.estado==="rechazado");
  const adicionalesLinea=decididos.length>0?`\n${decididos.map(s=>s.estado==="autorizado"?`${E.item} *Incluye ${s.descripcion} autorizado:* $${s.costo.toFixed(2)}`:`${E.item} *${s.descripcion}:* no autorizado por el cliente`).join("\n")}\n${L}`:"";
  return `${E.burbuja} *LAVA & LISTO* ${E.burbuja}\n_Lavanderia & Limpieza Especializada_\n${L}\n¡Hola *${v.clienteNombre}*! ${E.fiesta}\n\nTu pedido *${v.folio}* ya esta\n${E.brillo} *LISTO PARA RETIRAR* ${E.brillo}\n${L}${restregadoLinea}${adicionalesLinea}${objetosLinea}${pend>0?`\n${E.reloj} *Saldo al retirar:* $${pend.toFixed(2)}\n${L}`:""}\n${E.hora} Te esperamos en nuestro local\n¡Gracias por tu preferencia! ${E.corazon}\n${E.pin} Ricaurte, Cuenca`;
};

// ===== Cumpleaños =====
const esCumpleHoy=nac=>{
  if(!nac)return false;
  const p=String(nac).split("-");if(p.length<3)return false;
  const hoy=new Date();
  return parseInt(p[1])===hoy.getMonth()+1&&parseInt(p[2])===hoy.getDate();
};
// 🎂 Devuelve la fecha exacta (YYYY-MM-DD) del cumpleaños más reciente si HOY cae dentro de los 7 días posteriores a esa fecha
// (incluyendo el mismo día 0). Esa fecha sirve como "clave de ciclo": mientras no cambie, es la misma ventana de descuento,
// así se puede controlar que el descuento se use una sola vez por cumpleaños, sin importar cuántos días falten para volver a usarlo.
const cicloCumpleVigente=nac=>{
  if(!nac)return null;
  const p=String(nac).split("-");if(p.length<3)return null;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  let ultimo=new Date(hoy.getFullYear(),parseInt(p[1])-1,parseInt(p[2]));
  if(ultimo>hoy)ultimo=new Date(hoy.getFullYear()-1,parseInt(p[1])-1,parseInt(p[2]));
  const dias=Math.round((hoy-ultimo)/86400000);
  if(dias<0||dias>7)return null;
  return ultimo.getFullYear()+"-"+String(ultimo.getMonth()+1).padStart(2,"0")+"-"+String(ultimo.getDate()).padStart(2,"0");
};
// 🎂 ¿Puede este cliente usar el descuento de cumpleaños ahora mismo? Sí, si está dentro de los 7 días Y no lo ha usado ya en este ciclo.
const puedeUsarDescCumple=c=>{
  const ciclo=cicloCumpleVigente(c?.nacimiento);
  if(!ciclo)return false;
  return c.descCumpleUsadoCiclo!==ciclo;
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
  return `\u{1FAE7} *LAVA & LISTO* \u{1FAE7}\n_Lavanderia & Limpieza Especializada_\n${L}\n\u{1F382} *\u00A1FELIZ CUMPLEA\u00D1OS, ${c.nombre}!* \u{1F389}\n\nQue este nuevo a\u00F1o de vida venga cargado\nde salud, bendiciones y muchos momentos\nbonitos junto a quienes m\u00E1s quieres \u{1F499}\n\nGracias por ser parte de la familia\nLava & Listo, para nosotros es un\ngusto consentirte \u{1F60A}\n${L}\n\u2728 *10% DE DESCUENTO* \u2728\nen todos nuestros servicios,\nnuestro regalo para ti \u{1F381}\n\n\u{1F4C5} V\u00E1lido 7 d\u00EDas, presentando tu c\u00E9dula\n${L}\n\u00A1Te esperamos para consentirte!\n\u{1F4CD} Ricaurte, Cuenca`;
};
const waCumpleUrl=c=>{
  const tel=telWa(c.tel);
  if(!tel)return null;
  return `https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msgWaCumple(c))}`;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr; // 🔧 ya es fecha local pura (ej. v.entrega) — no convertir, o se recorre un día
  const dt = new Date(isoStr);
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};
const semISO_local = (isoStr) => semISO(new Date(isoStr));
const mesK_local = (isoStr) => mesK(new Date(isoStr));

// 🏭 PRODUCCIÓN — Fase 2: PIN de 4 dígitos por empleada (hash SHA-256 + salt, sin backend)
const randomSalt=()=>{const arr=new Uint8Array(8);crypto.getRandomValues(arr);return Array.from(arr).map(b=>b.toString(16).padStart(2,"0")).join("");};
const hashPin=async(pin,salt)=>{
  const enc=new TextEncoder();
  const data=enc.encode(salt+":"+pin);
  const buf=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
};
// Etiquetas de cada etapa registrada en eventosProduccion (Fase 3)
const ETAPA_PROD={
  lavado_inicio:{label:"Inició lavado",icon:"🧺"},
  doblado_inicio:{label:"Inició doblado",icon:"🪄"},
  doblado_fin:{label:"Terminó doblado",icon:"✅"},
};

const expCSV=(ventas,titulo,empleadas)=>{
  const enc=["Folio","Fecha","Cliente","Servicios","Total","Pagado","Pendiente","Metodo","Estado","Notas"];
  const filas=ventas.map(v=>{
    const p=(v.abonos||[]).reduce((a,ab)=>a+ab.monto,0);
    const m=[...new Set((v.abonos||[]).map(ab=>ab.metodo))].join("/");
    return[v.folio,fmt(v.fecha),v.clienteNombre||"",v.items.map(it=>it.label).join("|"),"$"+v.total.toFixed(2),"$"+p.toFixed(2),"$"+(v.total-p).toFixed(2),m,v.estado||"recibido",v.notas||""];
  });
  // 💰 Fila de totales al final — para cuadrar cuentas: cuánto se vendió, cuánto se cobró y cuánto queda pendiente
  const totVendido=ventas.reduce((a,v)=>a+v.total,0);
  const totCobrado=ventas.reduce((a,v)=>a+(v.abonos||[]).reduce((x,ab)=>x+ab.monto,0),0);
  const totPendiente=totVendido-totCobrado;
  filas.push(["","","","","","","","","",""]);
  filas.push(["TOTALES",`${ventas.length} venta(s)`,"","","$"+totVendido.toFixed(2),"$"+totCobrado.toFixed(2),"$"+totPendiente.toFixed(2),"","",""]);
  const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=titulo+"-"+fechaHoyLocal()+".csv";a.click();
};
// 🏭 PRODUCCIÓN — reporte descargable: revisión, lavado, centrifugado, secado y doblado, con empleada/tiempos/observaciones, filtrado por rango de fechas
const expCSVProduccion=(desde,hasta,{cargas,eventosProduccion,ventas,empleadas},titulo)=>{
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"";
  const clienteDe=folio=>ventas.find(v=>v.folio===folio)?.clienteNombre||"";
  const ingresoDe=folio=>{const v=ventas.find(v=>v.folio===folio);return v?fmt(v.fecha):"";};
  const enRango=iso=>{if(!iso)return false;const d=fechaLocal(iso);return d>=desde&&d<=hasta;};
  const filasRaw=[]; // [tsISO, folio(s), cliente(s), tipo, maquina, minProgramados, duracionMin, empIni, empFin, obs]

  ventas.filter(v=>v.clasificacion&&enRango(v.clasificacion.timestamp)).forEach(v=>{
    const c=v.clasificacion;
    const obs=[c.objetosEncontrados?`Objetos: ${c.objetosEncontrados}`:"",c.manchasDetectadas?"Manchas":"",c.requiereRestregado?`Restregado extra $${(c.restregadoCosto||0).toFixed(2)}`:""].filter(Boolean).join(" · ");
    filasRaw.push([c.timestamp,v.folio,v.clienteNombre||"","Revisión","-","-","-",nombreDe(c.empleadaId),"-",obs]);
  });

  cargas.filter(c=>enRango(c.inicio)).forEach(c=>{
    const folios=c.ventaFolios&&c.ventaFolios.length?c.ventaFolios:[c.ventaFolio];
    const clientes=[...new Set(folios.map(clienteDe))].join(" | ");
    const dur=c.finReal?Math.round((new Date(c.finReal)-new Date(c.inicio))/60000):"";
    const tipoLabel=c.tipo==="lavado"?"Lavado":c.tipo==="secado"?"Secado":"Centrifugado";
    const obs=[c.esRepeticion?"🔁 Repetición":"",c.comentario||"",c.pares?`${c.pares} pares (lote)`:"",folios.length>1?`Lote de ${folios.length} órdenes`:""].filter(Boolean).join(" · ");
    filasRaw.push([c.inicio,folios.join(" | "),clientes,tipoLabel,c.maquinaId||"",c.minutosProgramados||"",dur,nombreDe(c.empleadaId),nombreDe(c.empleadaRetiroId),obs,folios[0]]);
  });

  eventosProduccion.filter(ev=>ev.etapa==="doblado_inicio"&&enRango(ev.timestamp)).forEach(ini=>{
    const fin=eventosProduccion.find(ev=>ev.etapa==="doblado_fin"&&ev.ventaFolio===ini.ventaFolio&&(ev.grupo||null)===(ini.grupo||null)&&new Date(ev.timestamp)>=new Date(ini.timestamp));
    const dur=fin?Math.round((new Date(fin.timestamp)-new Date(ini.timestamp))/60000):"";
    const etiquetaEtapa=ini.grupo==="zapatos"?"Empaquetado":"Doblado";
    filasRaw.push([ini.timestamp,ini.ventaFolio,clienteDe(ini.ventaFolio),etiquetaEtapa,"-","-",dur,nombreDe(ini.empleadaId),fin?nombreDe(fin.empleadaId):"",ini.grupo?`Grupo: ${ini.grupo}`:"",ini.ventaFolio]);
  });

  filasRaw.sort((a,b)=>new Date(a[0])-new Date(b[0]));
  const enc=["Fecha","Folio(s)","Cliente(s)","Etapa","Máquina","Min. programados","Duración real (min)","Empleada inicio","Empleada fin/retiro","Observaciones","Fecha/hora que ingresó la orden"];
  const filas=filasRaw.map(f=>[fmt(f[0]),f[1],f[2],f[3],f[4],f[5],f[6],f[7],f[8],f[9],ingresoDe(f[10]||f[1])]);
  const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(titulo||"produccion")+"-"+desde+"_a_"+hasta+".csv";a.click();
  return filasRaw.length;
};

// 🏭 Reporte "por orden": una sola fila por folio con TODA la cadena (ingreso → revisión → lavado → centrifugado → secado → doblado → entregado)
// para tener claro de un vistazo a qué hora entró cada orden y cuánto tardó en cada etapa.
const expCSVProduccionPorOrden=(desde,hasta,{cargas,eventosProduccion,ventas,empleadas},titulo)=>{
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"";
  const enRango=iso=>{if(!iso)return false;const d=fechaLocal(iso);return d>=desde&&d<=hasta;};
  const foliosEnRango=[...new Set(ventas.filter(v=>enRango(v.fecha)).map(v=>v.folio))];
  if(foliosEnRango.length===0)return 0;
  const enc=["Folio","Cliente","Fecha/hora ingreso","Revisión (hora)","Lavado inicio","Lavado fin","Centrifugado inicio","Centrifugado fin","Secado inicio","Secado fin","Doblado/Empaquetado inicio","Doblado/Empaquetado fin","Entregado (hora)","Duración total (hh:mm desde ingreso hasta entregado)"];
  const filas=foliosEnRango.map(folio=>{
    const v=ventas.find(vv=>vv.folio===folio);
    const cargasDe=tipo=>cargas.filter(c=>(c.ventaFolio===folio||(c.ventaFolios||[]).includes(folio))&&c.tipo===tipo).sort((a,b)=>new Date(a.inicio)-new Date(b.inicio));
    const lav=cargasDe("lavado");const cen=cargasDe("centrifugado");const sec=cargasDe("secado");
    const dobIni=eventosProduccion.find(ev=>ev.etapa==="doblado_inicio"&&ev.ventaFolio===folio);
    const dobFin=eventosProduccion.find(ev=>ev.etapa==="doblado_fin"&&ev.ventaFolio===folio);
    const entregadoEv=v?.estado==="entregado"?v.fecha:null; // no siempre hay timestamp exacto de entrega; se deja el de la venta si ya está entregada
    let durTxt="";
    if(v?.fecha&&entregadoEv){
      const mins=Math.round((new Date(entregadoEv)-new Date(v.fecha))/60000);
      if(mins>=0)durTxt=String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");
    }
    return[
      folio,v?.clienteNombre||"",v?fmt(v.fecha):"",
      v?.clasificacion?.timestamp?fmt(v.clasificacion.timestamp):"",
      lav[0]?fmt(lav[0].inicio):"",lav[0]?.finReal?fmt(lav[0].finReal):"",
      cen[0]?fmt(cen[0].inicio):"",cen[0]?.finReal?fmt(cen[0].finReal):"",
      sec[0]?fmt(sec[0].inicio):"",sec[0]?.finReal?fmt(sec[0].finReal):"",
      dobIni?fmt(dobIni.timestamp):"",dobFin?fmt(dobFin.timestamp):"",
      v?.estado==="entregado"?"Entregado":(v?ESTADOS.find(e=>e.id===(v.estado||"recibido"))?.label:""),
      durTxt
    ];
  });
  const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(titulo||"produccion_por_orden")+"-"+desde+"_a_"+hasta+".csv";a.click();
  return filas.length;
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

// 🎟️ Modal que aparece justo al confirmar un pago que generó boleto(s) de sorteo — imprimir y avisar por WhatsApp con un toque
function BoletosSorteoModal({data,sorteos,onClose}){
  if(!data||!data.boletos||data.boletos.length===0)return null;
  const sorteo=sorteos.find(s=>s.id===data.boletos[0].sorteoId);
  return(
    <div style={S.ov}>
      <div style={S.tbox}>
        <div style={{textAlign:"center",marginBottom:10}}>
          <div style={{fontSize:36}}>🎟️</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>¡Boleto{data.boletos.length>1?"s":""} de sorteo generado{data.boletos.length>1?"s":""}!</div>
          <div style={{fontSize:12,color:"#888"}}>{sorteo?.nombre}</div>
        </div>
        {data.boletos.map(b=>(
          <div key={b.id} style={{background:"#f8fbfd",border:"1.5px solid #e8f0f7",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
            <div style={{fontWeight:800,fontSize:26,color:"#1a3c5e",textAlign:"center"}}>#{String(b.numeroBoleto).padStart(4,"0")}</div>
            <div style={{fontSize:11,color:"#888",textAlign:"center"}}>{etiquetaMotivoBoleto(b.motivo)}</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button style={{...S.btnP,flex:1,padding:"9px"}} onClick={()=>imprimirBoletoSorteo(b,sorteo)}>🖨️ Imprimir</button>
              {waBoletoSorteoUrl(b,sorteo)
                ?<a href={waBoletoSorteoUrl(b,sorteo)} target="_blank" rel="noreferrer" style={{background:"#25d366",color:"#fff",borderRadius:8,padding:"9px 10px",fontSize:13,fontWeight:700,textDecoration:"none",flex:1,textAlign:"center"}}>💬 Avisar</a>
                :<div style={{flex:1,textAlign:"center",fontSize:11,color:"#c62828",alignSelf:"center"}}>Sin teléfono</div>}
            </div>
          </div>
        ))}
        <button style={{...S.btnC,width:"100%",marginTop:6}} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

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
      +"<style>body{font-family:sans-serif;padding:10px;max-width:340px;margin:0 auto}.copy{border:1px solid #eee;border-radius:8px;padding:16px}@media print{body{margin:0;padding:5px}}</style>"
      +"</head><body>"
      +"<div class='copy'>"+html+"</div>"
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
        <button style={{background:"#1a3c5e",color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={print2}>🖨️ Imprimir</button>
        <button style={S.btnC} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

// 🔔 Panel de notificaciones: restregados por confirmar y restregados ya autorizados con saldo pendiente de cobro
function NotificacionesPanel({ventas,setVentas,upsertVenta,addAbono,clientes,maquinas,cargas,setCargas,upsertCarga,setMaquinas,upsertMaquina,pins,empleadas,sesion,esAdmin,soloLectura,onClose}){
  const [pinForMaquina,setPinForMaquina]=useState(null); // {maquina, carga}
  const [verTodasSRI,setVerTodasSRI]=useState(false);
  // 🧾 Solo la administradora o Nicole (encargada de facturar en el SRI) ven y manejan esta sección
  // 🧾 Solo la administradora o quien tenga el rol "Recepcionista" ven y manejan esta sección (ya no depende de un nombre fijo)
  const miEmpleadaSesion=(empleadas||[]).find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||(empleadas||[]).find(e=>{const en=normNombre(e.nombre).split(" ")[0];const sn=normNombre(sesion?.nombre).split(" ")[0];return en&&sn&&en===sn;});
  const puedeFacturar=esAdmin||miEmpleadaSesion?.rolFuncional==="recepcionista";
  const pendientesFacturarSRI=ventas.filter(v=>!v.anulada&&pagada(v)&&!v.facturadoSRI);
  const marcarFacturado=v=>{
    setVentas(prev=>{
      const next=prev.map(vv=>vv.folio===v.folio?{...vv,facturadoSRI:true,facturadoSRIEn:new Date().toISOString(),facturadoSRIPor:sesion?.nombre||null}:vv);
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const desmarcarFacturado=v=>{
    setVentas(prev=>{
      const next=prev.map(vv=>vv.folio===v.folio?{...vv,facturadoSRI:false,facturadoSRIEn:null,facturadoSRIPor:null}:vv);
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const descargarReporteSRI=()=>{
    const pagadas=ventas.filter(v=>!v.anulada&&pagada(v));
    const clienteDe=v=>v.clienteId?(clientes||[]).find(c=>c.id===v.clienteId):null;
    const detalleServicios=v=>(v.items||[]).map(it=>`${it.label}${it.piezas>1?` x${it.piezas}`:""} $${(it.precio||0).toFixed(2)}`).join(" | ");
    const enc=["Folio","Fecha","Cliente","Cédula/RUC","Dirección","Email","Teléfono","Servicios contratados (detalle)","Total facturado","Facturado SRI","Fecha facturado","Facturado por"];
    const filas=pagadas.map(v=>{
      const cl=clienteDe(v);
      return[
        v.folio,fmt(v.fecha),v.clienteNombre||"",
        cl?.cedula||cl?.rfc||"",
        v.clienteDireccion||cl?.direccion||"",
        cl?.email||"",
        v.clienteTel||cl?.tel||"",
        detalleServicios(v),
        "$"+v.total.toFixed(2),
        v.facturadoSRI?"Sí":"No",
        v.facturadoSRIEn?fmt(v.facturadoSRIEn):"",
        v.facturadoSRIPor||""
      ];
    });
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="facturacion_sri-"+fechaHoyLocal()+".csv";a.click();
  };
  const tieneAlgoP=v=>v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar");
  const pendientesConfirmar=ventas.filter(v=>!v.anulada&&tieneAlgoP(v));
  // 📢 Órdenes que ya pasaron a "Listo" (automático desde Producción) y todavía no se le avisó al cliente
  const listasSinAvisar=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")==="listo"&&!v.checkMsgRetiro);
  // 📅 Órdenes cuya fecha de entrega es HOY y todavía no se han entregado — para anticipar quién viene hoy a retirar
  const entreganHoy=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&fechaLocal(v.entrega)===fechaHoyLocal());
  // 📝 Órdenes activas que tienen algo escrito en Notas (instrucciones especiales, observaciones, etc.)
  const conNotas=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&v.notas&&v.notas.trim());
  // ⏰ Máquinas cuyo tiempo ya se cumplió y nadie las retiró — para que no pasen días sin que nadie se entere
  const maquinasVencidas=(maquinas||[]).filter(m=>m.estado==="ocupada"&&m.finProgramado&&new Date(m.finProgramado)<new Date());
  const clienteDeMaquina=m=>{
    const c=(cargas||[]).find(x=>x.id===m.cargaActualId);
    if(!c)return null;
    const folio=c.ventaFolio||(c.ventaFolios||[])[0];
    return ventas.find(v=>v.folio===folio)?.clienteNombre||null;
  };
  const retirarDesdeNotif=(emp)=>{
    if(!pinForMaquina)return;
    const{maquina,carga}=pinForMaquina;
    if(carga&&setCargas){
      setCargas(prev=>{
        const next=prev.map(x=>x.id===carga.id?{...x,finReal:new Date().toISOString(),empleadaRetiroId:emp?.id||null}:x);
        const updated=next.find(x=>x.id===carga.id);
        if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
    if(setMaquinas){
      setMaquinas(prev=>{
        const next=prev.map(m=>m.id===maquina.id?{...m,estado:"libre",cargaActualId:null,finProgramado:null}:m);
        const updated=next.find(m=>m.id===maquina.id);
        if(updated&&upsertMaquina)upsertMaquina({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
    setPinForMaquina(null);
  };
  // 🎂 Cumpleaños de hoy — visible para cualquier colaboradora, quien esté disponible puede felicitar
  const cumpleHoy=(clientes||[]).filter(c=>diasParaCumple(c.nacimiento)===0);
  const enviarMsgCumple=c=>{
    const url=waCumpleUrl(c);
    if(!url){alert("Este cliente no tiene teléfono registrado.");return;}
    window.open(url,"_blank");
  };
  const enviarMsgListo=v=>{
    if(!v.clienteTel){alert("Este cliente no tiene teléfono registrado.");return;}
    const tel=telWa(v.clienteTel);
    const msg=msgWa(v,"listo");
    window.open(`https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msg)}`,"_blank");
    setVentas(prev=>{
      const next=prev.map(vv=>vv.folio===v.folio?{...vv,checkMsgRetiro:true}:vv);
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };

  const confirmarRestregado=(v,autorizado)=>{
    const costo=v.clasificacion?.restregadoCosto||0;
    if(autorizado){
      const nuevoItem={servId:null,custom:true,piezas:1,lC:"🧽 Restregado extra autorizado",pC:costo.toFixed(2)};
      setVentas(prev=>{
        const next=prev.map(vv=>vv.folio===v.folio?{...vv,items:[...(vv.items||[]),nuevoItem],total:(vv.total||0)+costo,clasificacion:{...vv.clasificacion,restregadoEstado:"autorizado",restregadoConfirmadoEn:new Date().toISOString()}}:vv);
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const notaTxt=`🧽 Restregado extra rechazado por el cliente (hubiera costado $${costo.toFixed(2)})`;
      setVentas(prev=>{
        const next=prev.map(vv=>vv.folio===v.folio?{...vv,notas:[vv.notas,notaTxt].filter(Boolean).join(" · "),clasificacion:{...vv.clasificacion,restregadoEstado:"rechazado",restregadoConfirmadoEn:new Date().toISOString()}}:vv);
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
  };
  const confirmarServicioAdicional=(v,itemId,autorizado)=>{
    const item=(v.clasificacion?.serviciosAdicionales||[]).find(s=>s.id===itemId);
    if(!item)return;
    if(autorizado){
      const nuevoItem={servId:null,custom:true,piezas:1,lC:`🧾 ${item.descripcion} (encontrado, autorizado)`,pC:item.costo.toFixed(2)};
      setVentas(prev=>{
        const next=prev.map(vv=>{
          if(vv.folio!==v.folio)return vv;
          const sa=(vv.clasificacion?.serviciosAdicionales||[]).map(s=>s.id===itemId?{...s,estado:"autorizado",confirmadoEn:new Date().toISOString()}:s);
          return{...vv,items:[...(vv.items||[]),nuevoItem],total:(vv.total||0)+item.costo,clasificacion:{...vv.clasificacion,serviciosAdicionales:sa}};
        });
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const notaTxt=`🧾 ${item.descripcion} encontrado y rechazado por el cliente (hubiera costado $${item.costo.toFixed(2)})`;
      setVentas(prev=>{
        const next=prev.map(vv=>{
          if(vv.folio!==v.folio)return vv;
          const sa=(vv.clasificacion?.serviciosAdicionales||[]).map(s=>s.id===itemId?{...s,estado:"rechazado",confirmadoEn:new Date().toISOString()}:s);
          return{...vv,notas:[vv.notas,notaTxt].filter(Boolean).join(" · "),clasificacion:{...vv.clasificacion,serviciosAdicionales:sa}};
        });
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
  };

  return(
    <div style={{...S.ov,justifyContent:"flex-end",alignItems:"stretch",padding:0}}>
      <div style={{background:"#fff",width:"100%",maxWidth:420,height:"100%",overflowY:"auto",padding:18,boxShadow:"-8px 0 30px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#1a3c5e"}}>🔔 Notificaciones</div>
          <button onClick={onClose} style={{background:"#f0f4f8",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13}}>✕ Cerrar</button>
        </div>

        {pendientesConfirmar.length===0&&listasSinAvisar.length===0&&entreganHoy.length===0&&conNotas.length===0&&cumpleHoy.length===0&&maquinasVencidas.length===0&&!puedeFacturar&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:44,marginBottom:8}}>🔔</div><div>Sin notificaciones pendientes</div></div>
        )}

        {puedeFacturar&&(
          <div style={{marginBottom:20,background:"#eaf3fb",borderRadius:10,padding:12,border:"1.5px solid #90caf9"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:800,color:"#1565c0"}}>🧾 Facturación SRI</div>
              <button onClick={descargarReporteSRI} style={{background:"#1565c0",border:"none",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",borderRadius:8,padding:"6px 10px"}}>⬇️ Descargar reporte completo</button>
            </div>
            <div style={{fontSize:12,color:"#1565c0",marginBottom:8}}>{pendientesFacturarSRI.length} orden(es) pagada(s) sin marcar como facturada todavía.</div>
            <button onClick={()=>setVerTodasSRI(!verTodasSRI)} style={{background:"none",border:"none",color:"#1565c0",fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"underline",padding:0}}>{verTodasSRI?"Ver solo pendientes":`Ver todas las pagadas (${ventas.filter(v=>!v.anulada&&pagada(v)).length})`}</button>

            {(verTodasSRI?ventas.filter(v=>!v.anulada&&pagada(v)):pendientesFacturarSRI).map(v=>(
              <div key={v.folio} style={{...S.vcard,borderLeft:`4px solid ${v.facturadoSRI?"#2e7d32":"#1565c0"}`,marginTop:10}}>
                <div style={{fontWeight:700,fontSize:14}}>{v.clienteNombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.folio} · ${v.total.toFixed(2)}{v.facturadoSRIPor?` · ${v.facturadoSRIPor}`:""}</div>
                <label style={{display:"flex",alignItems:"center",gap:8,marginTop:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={!!v.facturadoSRI} onChange={()=>v.facturadoSRI?desmarcarFacturado(v):marcarFacturado(v)}/>
                  <span style={{fontSize:13,fontWeight:600,color:v.facturadoSRI?"#2e7d32":"#1a3c5e"}}>{v.facturadoSRI?"✅ Ya facturada":"Ya se facturó en el SRI"}</span>
                </label>
              </div>
            ))}
          </div>
        )}

        {maquinasVencidas.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#c62828",marginBottom:8}}>⏰ Máquinas vencidas sin retirar ({maquinasVencidas.length})</div>
            {maquinasVencidas.map(m=>{
              const carga=(cargas||[]).find(x=>x.id===m.cargaActualId);
              const cliente=clienteDeMaquina(m);
              return(
                <div key={m.id} style={{...S.vcard,borderLeft:"4px solid #c62828"}}>
                  <div style={{fontWeight:700,fontSize:14}}>{m.tipo==="lavadora"?"🧺":"🔥"} {m.nombre}</div>
                  {cliente&&<div style={{fontSize:11,color:"#888"}}>{cliente}</div>}
                  <div style={{fontSize:12,color:"#c62828",fontWeight:700,marginTop:4}}>Tiempo cumplido — falta retirar</div>
                  {soloLectura?(
                    <div style={{fontSize:11,color:"#888",marginTop:6}}>Se puede retirar desde cualquiera de las 2 pantallas.</div>
                  ):(
                    <button style={{...S.btnP,marginTop:8,width:"100%",background:"linear-gradient(135deg,#c62828,#e57373)"}} onClick={()=>setPinForMaquina({maquina:m,carga})}>📤 Retirar ahora</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {cumpleHoy.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#b45309",marginBottom:8}}>🎂 Cumpleaños hoy ({cumpleHoy.length})</div>
            {cumpleHoy.map(c=>(
              <div key={c.id} style={{...S.vcard,borderLeft:"4px solid #f59e0b",background:"linear-gradient(135deg,#fff8e1,#ffecb3)"}}>
                <div style={{fontWeight:700,fontSize:14,color:"#92600a"}}>🎉 ¡Hoy cumple {c.nombre}!</div>
                <div style={{fontSize:11,color:"#92600a"}}>Envíale su felicitación con el 10% de descuento</div>
                {c.tel?(
                  <button style={{...S.btnP,marginTop:8,width:"100%",background:"linear-gradient(135deg,#f59e0b,#fbc02d)"}} onClick={()=>enviarMsgCumple(c)}>💬 Felicitar por WhatsApp</button>
                ):(
                  <div style={{fontSize:11,color:"#c62828",marginTop:6}}>Sin teléfono registrado</div>
                )}
              </div>
            ))}
          </div>
        )}

        {listasSinAvisar.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#1565c0",marginBottom:8}}>📢 Listas para retirar — falta avisar ({listasSinAvisar.length})</div>
            {listasSinAvisar.map(v=>(
              <div key={v.folio} style={{...S.vcard,borderLeft:"4px solid #1565c0"}}>
                <div style={{fontWeight:700,fontSize:14}}>{v.clienteNombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>
                <button style={{...S.btnP,marginTop:8,width:"100%",background:"linear-gradient(135deg,#1565c0,#42a5f5)"}} onClick={()=>enviarMsgListo(v)}>📤 Enviar mensaje de Listo</button>
              </div>
            ))}
          </div>
        )}

        {entreganHoy.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#2e7d32",marginBottom:8}}>📅 Entregan hoy ({entreganHoy.length})</div>
            {entreganHoy.map(v=>{
              const est=getEst(v);
              return(
                <div key={v.folio} style={{...S.vcard,borderLeft:"4px solid #2e7d32"}}>
                  <div style={{fontWeight:700,fontSize:14}}>{v.clienteNombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{v.folio}{v.clienteTel?` · ${v.clienteTel}`:""}</div>
                  <div style={{fontSize:12,fontWeight:700,color:est.color,marginTop:2}}>{est.icon} {est.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {conNotas.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#7b1fa2",marginBottom:8}}>📝 Órdenes con notas ({conNotas.length})</div>
            {conNotas.map(v=>(
              <div key={v.folio} style={{...S.vcard,borderLeft:"4px solid #7b1fa2"}}>
                <div style={{fontWeight:700,fontSize:14}}>{v.clienteNombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>
                <div style={{fontSize:12,color:"#1a3c5e",background:"#f3e5f5",borderRadius:8,padding:"6px 8px",marginTop:6}}>📝 {v.notas}</div>
              </div>
            ))}
          </div>
        )}

        {pendientesConfirmar.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:"#e65100",marginBottom:8}}>🧽 Esperando respuesta del cliente ({pendientesConfirmar.length})</div>
            {pendientesConfirmar.map(v=>(
              <div key={v.folio} style={{...S.vcard,borderLeft:"4px solid #e65100"}}>
                <div style={{fontWeight:700,fontSize:14}}>{v.clienteNombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>

                {v.clasificacion?.restregadoEstado==="pendiente_confirmar"&&(
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:13,color:"#1a3c5e"}}>🧽 Restregado extra: <strong>${(v.clasificacion.restregadoCosto||0).toFixed(2)}</strong></div>
                    {soloLectura?(
                      <div style={{fontSize:11,color:"#888",marginTop:4}}>Se confirma desde cualquiera de las 2 pantallas.</div>
                    ):(
                      <div style={{display:"flex",gap:6,marginTop:6}}>
                        <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>confirmarRestregado(v,true)}>✅ Autorizó</button>
                        <button style={{...S.btnS,flex:1,background:"#ffebee",color:"#c62828"}} onClick={()=>confirmarRestregado(v,false)}>❌ Rechazó</button>
                      </div>
                    )}
                  </div>
                )}

                {(v.clasificacion?.serviciosAdicionales||[]).filter(s=>s.estado==="pendiente_confirmar").map(s=>(
                  <div key={s.id} style={{marginTop:6}}>
                    <div style={{fontSize:13,color:"#1a3c5e"}}>🧾 {s.descripcion}: <strong>${s.costo.toFixed(2)}</strong></div>
                    {soloLectura?(
                      <div style={{fontSize:11,color:"#888",marginTop:4}}>Se confirma desde cualquiera de las 2 pantallas.</div>
                    ):(
                      <div style={{display:"flex",gap:6,marginTop:6}}>
                        <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>confirmarServicioAdicional(v,s.id,true)}>✅ Autorizó</button>
                        <button style={{...S.btnS,flex:1,background:"#ffebee",color:"#c62828"}} onClick={()=>confirmarServicioAdicional(v,s.id,false)}>❌ Rechazó</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {pinForMaquina&&<PinModal pins={pins} empleadas={empleadas} titulo="¿Quién retira esta carga?" onConfirm={retirarDesdeNotif} onCancelar={()=>setPinForMaquina(null)}/>}
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
  const [verificando,setVerificando]=useState(false);
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
        <button style={{...S.btnP,padding:"14px",fontSize:16,borderRadius:12,opacity:verificando?0.7:1}} onClick={go} disabled={verificando}>{verificando?"Verificando...":"Ingresar →"}</button>
      </div>
    </div>
  );
}

function AperturaObligatoria({sesion,onLogout,onAbierta,empleadas,upsertCaja}){
  const hoy=fechaHoyLocal();
  const AK="ll_apertura_"+hoy+"_"+sesion.id;
  const [fondo,setFondo]=useState("20.00");
  const abrir=()=>{
    const d={id:"ap_"+hoy+"_"+sesion.id+"_"+Date.now(),tipo:"apertura",dia:hoy,empleadaNombre:sesion.nombre,empleadaId:sesion.id,fondo:parseFloat(fondo)||20,fecha:new Date().toISOString()};
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
          <div style={{fontSize:11,color:"#4db6e4",marginTop:6}}>💡 El fondo estandar es $20.00</div>
        </div>
        <button style={{...S.btnP,padding:"14px",fontSize:16,borderRadius:12,marginBottom:10}} onClick={abrir}>🔓 Abrir caja e iniciar dia</button>
        <button style={{width:"100%",padding:"10px",background:"transparent",color:"#888",border:"1px solid #d0dce8",borderRadius:10,fontSize:13,cursor:"pointer"}} onClick={onLogout}>Cerrar sesion</button>
      </div>
    </div>
  );
}

// 🏭 PRODUCCIÓN — pantalla de selección al iniciar sesión: Facturación o Producción (áreas separadas)
function SelectorVista({sesion,onElegir,onLogout}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"36px 28px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{fontSize:40}}>🫧</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#1a3c5e",marginTop:6}}>Lava&Listo</div>
          <div style={{fontSize:13,color:"#888",marginTop:6}}>Hola <strong>{sesion.nombre}</strong>, ¿a dónde quieres entrar?</div>
        </div>
        <button onClick={()=>onElegir("facturacion")} style={{width:"100%",padding:"20px",background:"linear-gradient(135deg,#1a3c5e,#2563a8)",color:"#fff",border:"none",borderRadius:14,marginBottom:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>🧾</div>
          <div><div style={{fontWeight:800,fontSize:16}}>Facturación</div><div style={{fontSize:12,opacity:.85}}>Órdenes, cobros, ventas nuevas</div></div>
        </button>
        <button onClick={()=>onElegir("produccion")} style={{width:"100%",padding:"20px",background:"linear-gradient(135deg,#7b1fa2,#9c27b0)",color:"#fff",border:"none",borderRadius:14,marginBottom:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>🏭</div>
          <div><div style={{fontWeight:800,fontSize:16}}>Producción</div><div style={{fontSize:12,opacity:.85}}>Lavado y doblado — se identifica con PIN</div></div>
        </button>
        <button onClick={()=>onElegir("tareas")} style={{width:"100%",padding:"20px",background:"linear-gradient(135deg,#00838f,#26c6da)",color:"#fff",border:"none",borderRadius:14,marginBottom:16,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>📋</div>
          <div><div style={{fontWeight:800,fontSize:16}}>Tareas del día</div><div style={{fontSize:12,opacity:.85}}>Checklist de apertura, cierre y más</div></div>
        </button>
        <button style={{width:"100%",padding:"10px",background:"transparent",color:"#888",border:"1px solid #d0dce8",borderRadius:10,fontSize:13,cursor:"pointer"}} onClick={onLogout}>Cerrar sesión</button>
      </div>
    </div>
  );
}

// 🏭 PRODUCCIÓN — pantalla completa, independiente de Facturación. Sin tabs de caja/ventas; todo aquí se identifica por PIN.
function ProduccionScreen({sesion,onVolver,onIrFacturacion,onIrTareas,onLogout,ventas,setVentas,upsertVenta,empleadas,pins,eventosProduccion,setEventosProduccion,upsertEvento,maquinas,setMaquinas,upsertMaquina,cargas,setCargas,upsertCarga,clientes}){
  const [showNotifs,setShowNotifs]=useState(false);
  const miEmpleadaSesionPS=(empleadas||[]).find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||(empleadas||[]).find(e=>{const en=normNombre(e.nombre).split(" ")[0];const sn=normNombre(sesion?.nombre).split(" ")[0];return en&&sn&&en===sn;});
  const puedeFacturarAqui=miEmpleadaSesionPS?.rolFuncional==="recepcionista";
  const facturarSRICount=puedeFacturarAqui?ventas.filter(v=>!v.anulada&&pagada(v)&&!v.facturadoSRI).length:0;
  const totalNotifs=ventas.filter(v=>!v.anulada&&(v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar")||((v.estado||"recibido")==="listo"&&!v.checkMsgRetiro))).length+(clientes||[]).filter(c=>diasParaCumple(c.nacimiento)===0).length+(maquinas||[]).filter(m=>m.estado==="ocupada"&&m.finProgramado&&new Date(m.finProgramado)<new Date()).length+facturarSRICount+ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&fechaLocal(v.entrega)===fechaHoyLocal()).length+ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&v.notas&&v.notas.trim()).length;
  // 🔔 Suena cuando aumentan las notificaciones (ej. llega un restregado nuevo o ya lo autorizaron en otra pantalla)
  const notifsPrevRef=useRef(totalNotifs);
  useEffect(()=>{
    if(totalNotifs>notifsPrevRef.current)reproducirSonidoAlerta();
    notifsPrevRef.current=totalNotifs;
  },[totalNotifs]);
  return(
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{background:"linear-gradient(135deg,#7b1fa2,#9c27b0)",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700}}>🏭 Producción</div>
          <div style={{fontSize:11,color:"#e8d5f0"}}>Dispositivo del taller · cada acción se identifica con PIN</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowNotifs(true)} style={{position:"relative",background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",cursor:"pointer",fontWeight:600}}>
            🔔{totalNotifs>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 5px"}}>{totalNotifs}</span>}
          </button>
          <button onClick={onIrFacturacion} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>🧾 Facturación</button>
          <button onClick={onIrTareas} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>📋 Tareas</button>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>Salir</button>
        </div>
      </div>
      {ventas.filter(v=>!v.anulada&&(v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar"))).length>0&&(
        <div style={{background:"#fff3e0",borderBottom:"1.5px solid #e65100",padding:"8px 16px",fontSize:12,fontWeight:700,color:"#e65100"}}>
          🧽 {ventas.filter(v=>!v.anulada&&(v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar"))).length} orden(es) con extras esperando respuesta del cliente
        </div>
      )}
      {showNotifs&&<NotificacionesPanel ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} addAbono={null} clientes={clientes} maquinas={maquinas} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} pins={pins} empleadas={empleadas} sesion={sesion} onClose={()=>setShowNotifs(false)}/>}
      <div style={{padding:12,maxWidth:900,margin:"0 auto"}}>
        <Produccion ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} empleadas={empleadas} pins={pins||[]} eventosProduccion={eventosProduccion||[]} setEventosProduccion={setEventosProduccion} upsertEvento={upsertEvento} maquinas={maquinas||[]} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} cargas={cargas||[]} setCargas={setCargas} upsertCarga={upsertCarga}/>
      </div>
    </div>
  );
}

// 📋 TAREAS — Fase 3: checklist del día, organizado por momento del turno (apertura/media jornada/cierre) y por persona asignada, con confirmación por PIN (+ foto/nota si se requiere)
function TareasChecklist({tareasDiarias,setTareasDiarias,upsertTareaDiaria,pins,empleadas,sesion}){
  const [pinFor,setPinFor]=useState(null); // {tareaId, fotoUrl, nota}
  const [fotoFor,setFotoFor]=useState(null); // tareaId esperando foto
  const [notaFor,setNotaFor]=useState(null); // tareaId esperando nota
  const [borrador,setBorrador]=useState(null); // {tareaId, fotoUrl, nota} — va acumulando lo que la tarea requiera antes del PIN

  // 🧾 Determina el rol funcional de quien está viendo el checklist (mismo criterio de normNombre que el resto de la app)
  const miEmpleadaSesionTC=(empleadas||[]).find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||(empleadas||[]).find(e=>{const en=normNombre(e.nombre).split(" ")[0];const sn=normNombre(sesion?.nombre).split(" ")[0];return en&&sn&&en===sn;});
  const miRolTC=miEmpleadaSesionTC?.rolFuncional||"general";
  const miIdTC=miEmpleadaSesionTC?.id;

  const hoyK=fechaHoyLocal();
  // 👤 Si la tarea tiene perfiles específicos asignados, manda eso (sin importar el rol). Si no, se usa el filtro de rol de siempre.
  const todasHoy=tareasDiarias.filter(t=>{
    if(t.fecha!==hoyK||t.eliminada)return false;
    if(t.empleadaIds&&t.empleadaIds.length>0)return miIdTC!=null&&t.empleadaIds.some(id=>String(id)===String(miIdTC));
    return !t.rolRequerido||t.rolRequerido===miRolTC;
  });
  const visibles=todasHoy;
  const ordenBloque=["apertura","media_jornada","cambio_turno","cierre","semanal"];
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";

  const completadas=todasHoy.filter(t=>t.estado==="completada").length;
  const pct=todasHoy.length?Math.round((completadas/todasHoy.length)*100):0;

  const horaLimiteMin=hl=>{const[h,m]=hl.split(":").map(Number);return h*60+m;};
  const semaforo=t=>{
    if(t.estado==="completada")return{color:"#2e7d32",bg:"#e8f5e9",label:t.atrasada?"✅ Completada (atrasada)":"✅ Completada"};
    if(t.estado==="no_realizada")return{color:"#c62828",bg:"#ffebee",label:"⛔ No realizada"};
    const ahoraD=new Date();
    const ahora=ahoraD.getHours()*60+ahoraD.getMinutes();
    const lim=horaLimiteMin(t.horaLimite);
    if(ahora>lim)return{color:"#c62828",bg:"#ffebee",label:"🔴 Vencida"};
    if(lim-ahora<=15)return{color:"#e65100",bg:"#fff3e0",label:"🟡 Por vencer"};
    return{color:"#2e7d32",bg:"#e8f5e9",label:"🟢 A tiempo"};
  };

  const tocar=t=>{
    if(t.estado!=="pendiente")return;
    const base={tareaId:t.id,fotoUrl:null,nota:null};
    if(t.requiereFoto){setBorrador(base);setFotoFor(t.id);return;}
    if(t.requiereNota){setBorrador(base);setNotaFor(t.id);return;}
    setPinFor(base);
  };
  const onFoto=url=>{
    const tareaId=fotoFor;
    setFotoFor(null);
    const t=tareasDiarias.find(x=>x.id===tareaId);
    const d={tareaId,fotoUrl:url,nota:null};
    if(t?.requiereNota){setBorrador(d);setNotaFor(tareaId);return;}
    setPinFor(d);
  };
  const onNota=texto=>{
    const tareaId=notaFor;
    setNotaFor(null);
    const d={...(borrador&&borrador.tareaId===tareaId?borrador:{tareaId,fotoUrl:null}),nota:texto};
    setPinFor(d);
  };
  const onPinOk=emp=>{
    if(!pinFor)return;
    const{tareaId,fotoUrl,nota}=pinFor;
    const t=tareasDiarias.find(x=>x.id===tareaId);
    if(!t){alert("⚠️ No se pudo guardar: esta tarea ya no se encontró en el sistema. Cierra y vuelve a intentar.");setPinFor(null);return;}
    const ahora=new Date();
    const[h,m]=t.horaLimite.split(":").map(Number);
    const lim=new Date();lim.setHours(h,m,0,0);
    const atrasada=ahora>lim;
    setTareasDiarias(prev=>{
      const next=prev.map(x=>x.id===tareaId?{...x,estado:"completada",completadaPor:emp?.id||null,completadaEn:ahora.toISOString(),atrasada,fotoUrl:fotoUrl||x.fotoUrl||null,observacion:nota||x.observacion||null}:x);
      const updated=next.find(x=>x.id===tareaId);
      if(updated&&upsertTareaDiaria)upsertTareaDiaria({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    setPinFor(null);
    setBorrador(null);
  };

  const porBloque=b=>visibles.filter(t=>t.bloque===b).sort((a,b2)=>a.orden-b2.orden);

  return(<div style={{padding:"4px 4px 20px"}}>
    <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:14,padding:16,marginBottom:14,color:"#fff"}}>
      <div style={{fontSize:12,color:"#a0c4da",fontWeight:600}}>PROGRESO DE HOY</div>
      <div style={{fontSize:24,fontWeight:800,marginTop:2}}>{completadas} / {todasHoy.length} tareas</div>
      <div style={{marginTop:8,background:"rgba(255,255,255,.15)",borderRadius:8,height:10,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:pct===100?"#4caf50":"#4db6e4",borderRadius:8}}/>
      </div>
    </div>

    {todasHoy.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:48,marginBottom:8}}>📋</div><div>Aún no hay tareas generadas para hoy</div></div>}

    {ordenBloque.map(b=>{
      const lista=porBloque(b);
      if(lista.length===0)return null;
      return(<div key={b} style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:800,color:"#1a3c5e",marginBottom:6}}>{BLOQUE_LBL[b]||b}</div>
        {lista.map(t=>{
          const s=semaforo(t);
          return(
            <button key={t.id} onClick={()=>tocar(t)} disabled={t.estado!=="pendiente"} style={{display:"block",width:"100%",textAlign:"left",background:s.bg,border:`1.5px solid ${s.color}`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:t.estado==="pendiente"?"pointer":"default"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1a3c5e",flex:1}}>{t.titulo}{t.requiereFoto?" 📷":""}{t.requiereNota?" 📝":""}</div>
                <div style={{fontSize:11,fontWeight:700,color:s.color,whiteSpace:"nowrap",marginLeft:8}}>{s.label}</div>
              </div>
              {t.descripcion&&<div style={{fontSize:12,color:"#888",marginTop:2}}>{t.descripcion}</div>}
              <div style={{fontSize:11,color:"#888",marginTop:4}}>límite {t.horaLimite}{t.completadaPor?` · ${nombreDe(t.completadaPor)}`:""}</div>
              {t.observacion&&<div style={{fontSize:12,color:"#1a3c5e",background:"#f0f4f8",borderRadius:8,padding:"6px 8px",marginTop:6}}>📝 {t.observacion}</div>}
            </button>
          );
        })}
      </div>);
    })}

    {fotoFor&&<FotoTareaModal onConfirmar={onFoto} onCancelar={()=>setFotoFor(null)}/>}
    {notaFor&&<NotaTareaModal titulo={tareasDiarias.find(x=>x.id===notaFor)?.titulo||""} onConfirmar={onNota} onCancelar={()=>{setNotaFor(null);setBorrador(null);}}/>}
    {pinFor&&<PinModal pins={pins} empleadas={empleadas} titulo="¿Quién completó esta tarea?" onConfirm={onPinOk} onCancelar={()=>{setPinFor(null);setBorrador(null);}}/>}
  </div>);
}

// 📋 TAREAS — pantalla independiente (misma lógica de separación que Producción)
function TareasScreen({sesion,onVolver,onIrFacturacion,onIrProduccion,onLogout,tareasDiarias,setTareasDiarias,upsertTareaDiaria,pins,empleadas,notas,setNotas,upsertNota}){
  const [showNota,setShowNota]=useState(false);
  const guardarNota=datos=>{
    const nota={id:"nota_"+Date.now(),fecha:new Date().toISOString(),...datos,estado:"abierta",revisadaEn:null,respuestaAdmin:null};
    setNotas(prev=>[...prev,nota]);
    if(upsertNota)upsertNota(nota);
    setShowNota(false);
    alert("✅ Nota guardada — la administradora la va a revisar.");
  };
  return(
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'DM Sans',sans-serif",position:"relative"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{background:"linear-gradient(135deg,#00838f,#26c6da)",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700}}>📋 Tareas del día</div>
          <div style={{fontSize:11,color:"#d0f4f8"}}>Cada tarea se confirma con PIN</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onIrFacturacion} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>🧾 Facturación</button>
          <button onClick={onIrProduccion} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>🏭 Producción</button>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 12px",fontWeight:600,cursor:"pointer"}}>Salir</button>
        </div>
      </div>
      <div style={{padding:12,maxWidth:900,margin:"0 auto",paddingBottom:90}}>
        <TareasChecklist tareasDiarias={tareasDiarias||[]} setTareasDiarias={setTareasDiarias} upsertTareaDiaria={upsertTareaDiaria} pins={pins||[]} empleadas={empleadas} sesion={sesion}/>
      </div>
      <button onClick={()=>setShowNota(true)} style={{position:"fixed",bottom:24,right:20,background:"linear-gradient(135deg,#1a3c5e,#2563a8)",color:"#fff",border:"none",borderRadius:30,padding:"14px 20px",fontWeight:800,fontSize:14,boxShadow:"0 6px 20px rgba(0,0,0,.25)",cursor:"pointer",zIndex:50}}>📝 + Dejar nota</button>
      {showNota&&<NotaFormModal pins={pins} empleadas={empleadas} onGuardar={guardarNota} onCancelar={()=>setShowNota(false)}/>}
    </div>
  );
}

// OrdenCard es componente SEPARADO (no dentro de map ni de PantallaEmpleada)
function OrdenCard({v,setVentas,addAbono,setTicket,upsertVenta,clientes,setClientes,upsertCliente,sesion}){
  const [showAb,setShowAb]=useState(false);
  const [waListo,setWaListo]=useState(false);
  const [showEditCliente,setShowEditCliente]=useState(false);
  const est=getEst(v);const sig=sigEst(v.estado||"recibido");
  const esPag=pagada(v);const pend=saldo(v);
  const aplicarEstado=(nuevoEstado,extra={})=>setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,estado:nuevoEstado,...extra}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const cambiar=()=>{
    if(!sig)return;
    if(sig.id==="listo"){setWaListo(true);return;} // WhatsApp obligatorio antes de "listo"
    aplicarEstado(sig.id);
  };
  const reenviarWa=tipo=>{
    if(!v.clienteTel){alert("Este cliente no tiene teléfono registrado.");return;}
    const tel=telWa(v.clienteTel);
    const msg=msgWa(v,tipo);
    window.open(`https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msg)}`,"_blank");
  };
  const toggle=f=>setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,[f]:!vv[f]}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta(updated);return next;});
  const guardarEdicionCliente=datos=>{
    setVentas(prev=>{
      const next=prev.map(vv=>vv.folio===v.folio?{...vv,clienteNombre:datos.nombre,clienteTel:datos.tel,clienteDireccion:datos.direccion}:vv);
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    // ☁️ Si el cliente ya existe en la agenda, se actualizan TODOS sus datos ahí (incluida fecha de nacimiento)
    if(v.clienteId&&clientes&&setClientes){
      setClientes(prev=>{
        const next=prev.map(c=>c.id===v.clienteId?{...c,nombre:datos.nombre,tel:datos.tel,direccion:datos.direccion,cedula:datos.cedula,email:datos.email,rfc:datos.rfc,nacimiento:datos.nacimiento}:c);
        const updated=next.find(c=>c.id===v.clienteId);
        if(updated&&upsertCliente)upsertCliente({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
    setShowEditCliente(false);
  };
  return(
    <div style={{borderRadius:14,border:`2px solid ${est.color}`,background:"#fff",marginBottom:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
      <div style={{background:est.bg,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:800,fontSize:14,color:est.color}}>{est.icon} {est.label}</div>
        <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>
      </div>
      <div style={{padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{fontWeight:700,fontSize:16,color:"#1a3c5e"}}>{v.clienteNombre}</div>
          {!v.anulada&&<button style={{background:"none",border:"none",color:"#4db6e4",fontSize:12,fontWeight:700,cursor:"pointer",padding:0}} onClick={()=>setShowEditCliente(true)}>✏️ Editar</button>}
        </div>
        {v.clienteTel&&<div style={{fontSize:12,color:"#888",marginTop:2}}>📱 {v.clienteTel}</div>}
        {v.clienteDireccion&&<div style={{fontSize:12,color:"#888",marginTop:2}}>📍 {v.clienteDireccion}</div>}
        <div style={{fontSize:13,color:"#555",margin:"6px 0"}}>{v.items.map((it,i)=><span key={i}>{it.label}{it.piezas>1?` x${it.piezas}`:""}{i<v.items.length-1?" · ":""}</span>)}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
          <div>
            <div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>${v.total.toFixed(2)}</div>
            {!esPag&&<div style={{background:"#c62828",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:800,marginTop:2}}>💸 DEBE ${pend.toFixed(2)}</div>}
            {esPag&&<div style={{background:"#2e7d32",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700,marginTop:2}}>✅ PAGADO</div>}
          </div>
          <div style={{fontSize:12,color:"#888"}}>📅 {fmtD(v.entrega)}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
          <label style={{...S.chk,fontSize:13,margin:0}}>
            <input type="checkbox" checked={v.checkMsgRetiro||false} onChange={()=>toggle("checkMsgRetiro")}/>
            <span>📲 Avisé al cliente</span>
          </label>
          <button style={{width:26,height:26,padding:0,background:"#e8f5e9",color:"#2e7d32",border:"1px solid #a5d6a7",borderRadius:7,fontSize:12,cursor:"pointer",flexShrink:0}} onClick={()=>reenviarWa("recibido")} title="Reenviar mensaje de orden recibida">📥</button>
          <button style={{width:26,height:26,padding:0,background:"#e3f2fd",color:"#1565c0",border:"1px solid #90caf9",borderRadius:7,fontSize:12,cursor:"pointer",flexShrink:0}} onClick={()=>reenviarWa("listo")} title="Reenviar mensaje de listo para retirar">✅</button>
        </div>
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
          {sig&&sig.id==="entregado"&&<button style={{flex:1,padding:"10px",background:sig.bg,color:sig.color,border:`1.5px solid ${sig.color}`,borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={cambiar}>{sig.icon} {sig.label}</button>}
          {sig&&sig.id!=="entregado"&&<div style={{flex:1,padding:"10px",background:"#f0f4f8",color:"#888",border:"1.5px dashed #d0dce8",borderRadius:10,fontWeight:600,fontSize:12,textAlign:"center"}}>🏭 Se actualiza desde Producción</div>}
          {!esPag&&<button style={{flex:1,padding:"10px",background:"#e8f5e9",color:"#2e7d32",border:"1.5px solid #2e7d32",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={()=>setShowAb(true)}>💰 Cobrar</button>}
          <button style={{padding:"10px 14px",background:"#f0f4f8",color:"#1a3c5e",border:"none",borderRadius:10,fontSize:12,cursor:"pointer"}} onClick={()=>setTicket(v)}>🧾</button>
        </div>
      </div>
      {showAb&&<AbonoModal venta={v} onSave={ab=>{addAbono(v.folio,ab);setShowAb(false);}} onClose={()=>setShowAb(false)}/>}
      {waListo&&<WhatsAppObligatorio venta={v} tipo="listo" onConfirm={info=>{aplicarEstado("listo",{checkMsgRetiro:info.enviado,msgListo:info});setWaListo(false);}} onCancel={()=>setWaListo(false)}/>}
      {showEditCliente&&<EditarClienteModal v={v} clientes={clientes} onGuardar={guardarEdicionCliente} onCancelar={()=>setShowEditCliente(false)}/>}
    </div>
  );
}

// ✏️ Modal para que las empleadas editen los datos del cliente directamente en la orden (sin necesitar acceso de administrador)
function EditarClienteModal({v,clientes,onGuardar,onCancelar}){
  const clienteAgenda=v.clienteId?(clientes||[]).find(c=>c.id===v.clienteId):null;
  const [nombre,setNombre]=useState(v.clienteNombre||"");
  const [tel,setTel]=useState(v.clienteTel||clienteAgenda?.tel||"");
  const [direccion,setDireccion]=useState(v.clienteDireccion||clienteAgenda?.direccion||"");
  const [cedula,setCedula]=useState(clienteAgenda?.cedula||"");
  const [email,setEmail]=useState(clienteAgenda?.email||"");
  const [rfc,setRfc]=useState(clienteAgenda?.rfc||"");
  const [nacimiento,setNacimiento]=useState(clienteAgenda?.nacimiento||"");
  const [err,setErr]=useState("");
  const guardar=()=>{
    if(!nombre.trim()){setErr("El nombre no puede quedar vacío");return;}
    onGuardar({nombre:nombre.trim(),tel:tel.trim(),direccion:direccion.trim(),cedula:cedula.trim(),email:email.trim(),rfc:rfc.trim(),nacimiento});
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,maxHeight:"88vh",overflowY:"auto",padding:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:14,textAlign:"center"}}>✏️ Editar datos del cliente</div>
        <div style={{marginBottom:10}}><label style={S.lbl}>Nombre</label><input style={S.inp} value={nombre} onChange={e=>{setNombre(e.target.value);setErr("");}}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>Teléfono</label><input style={S.inp} value={tel} onChange={e=>setTel(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>Cédula</label><input style={S.inp} value={cedula} onChange={e=>setCedula(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>Email</label><input style={S.inp} value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>RUC/RFC</label><input style={S.inp} value={rfc} onChange={e=>setRfc(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>Dirección</label><input style={S.inp} value={direccion} onChange={e=>setDireccion(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={S.lbl}>🎂 Fecha de nacimiento</label><input type="date" style={S.inp} value={nacimiento} onChange={e=>setNacimiento(e.target.value)}/></div>
        {!v.clienteId&&<div style={{fontSize:11,color:"#e65100",marginBottom:8}}>⚠️ Este cliente no está guardado en la agenda — solo se actualizarán nombre, teléfono y dirección de esta orden.</div>}
        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginBottom:8}}>{err}</div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button style={{...S.btnP,flex:1}} onClick={guardar}>✓ Guardar</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// 🏭 PRODUCCIÓN — cronómetro en vivo (mm:ss) para saber cuánto lleva doblando
function Cronometro({desde}){
  const [, setTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(id);},[]);
  const segs=Math.max(0,Math.floor((Date.now()-new Date(desde).getTime())/1000));
  const mm=String(Math.floor(segs/60)).padStart(2,"0");
  const ss=String(segs%60).padStart(2,"0");
  return <span>{mm}:{ss}</span>;
}
// 🏭 PRODUCCIÓN — cuenta regresiva hacia un finProgramado; si ya se pasó, cuenta hacia arriba en rojo
function CuentaRegresiva({finProgramado}){
  const [, setTick]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(id);},[]);
  const diffMs=new Date(finProgramado).getTime()-Date.now();
  const vencido=diffMs<=0;
  const segs=Math.floor(Math.abs(diffMs)/1000);
  const mm=String(Math.floor(segs/60)).padStart(2,"0");
  const ss=String(segs%60).padStart(2,"0");
  return <span style={{color:vencido?"#c62828":"#1a3c5e",fontWeight:800}}>{vencido?"⏰ +":""}{mm}:{ss}</span>;
}
// 🏭 PRODUCCIÓN — tarjeta visual de una máquina para el tablero (libre/ocupada/mantenimiento + cuenta regresiva)
function TarjetaMaquina({m,cargas,ventas,onClick}){
  const est=ESTADO_MAQ[m.estado]||ESTADO_MAQ.libre;
  const carga=m.cargaActualId?cargas.find(c=>c.id===m.cargaActualId):null;
  const venta=carga?ventas.find(v=>v.folio===carga.ventaFolio):null;
  return(
    <div onClick={onClick} style={{background:est.bg,border:`2px solid ${m.categoria==="zapatos"?"#8d6e63":est.color}`,borderRadius:10,padding:"8px 6px",textAlign:"center",position:"relative",cursor:onClick?"pointer":"default"}}>
      {m.categoria==="zapatos"&&<div style={{position:"absolute",top:-6,right:-6,fontSize:14,background:"#fff",borderRadius:"50%",border:"1.5px solid #8d6e63"}}>👟</div>}
      <div style={{fontSize:18}}>{m.tipo==="lavadora"?"🧺":"🔥"}</div>
      <div style={{fontSize:11,fontWeight:700,color:"#1a3c5e",lineHeight:1.1}}>{m.nombre}</div>
      <div style={{fontSize:9,color:est.color,fontWeight:700}}>{est.label}</div>
      {m.estado==="ocupada"&&m.finProgramado&&<div style={{fontSize:11,marginTop:2,fontFamily:"monospace"}}><CuentaRegresiva finProgramado={m.finProgramado}/></div>}
      {m.estado==="ocupada"&&venta&&<div style={{fontSize:8,color:"#666",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{venta.clienteNombre}</div>}
      {onClick&&<div style={{fontSize:8,color:"#8d6e63",marginTop:2,fontWeight:700}}>👆 Ver detalle</div>}
    </div>
  );
}
// 🏭 PRODUCCIÓN — selector de máquina libre + minutos programados, antes de pedir el PIN
// 🏭 PRODUCCIÓN — Fase 4: revisión/clasificación de prendas, obligatoria antes de iniciar el lavado
// 📋 TAREAS — Fase 3: modal para tomar/adjuntar la foto requerida antes de completar una tarea
// 📝 NOTAS — tipos y etiquetas
const TIPO_NOTA={
  pendiente:{label:"📌 Pendiente",color:"#1565c0",bg:"#e3f2fd"},
  novedad:{label:"ℹ️ Novedad",color:"#7b1fa2",bg:"#f3e5f5"},
  falta_insumo:{label:"📦 Falta insumo",color:"#e65100",bg:"#fff3e0"},
  reclamo_cliente:{label:"😠 Reclamo cliente",color:"#c62828",bg:"#ffebee"},
  daño_maquina:{label:"🔧 Daño máquina",color:"#5d4037",bg:"#efebe9"},
};
const ESTADO_NOTA={
  abierta:{label:"🔴 Abierta",color:"#c62828"},
  revisada:{label:"🟡 Revisada",color:"#e65100"},
  resuelta:{label:"✅ Resuelta",color:"#2e7d32"},
};

// 📝 NOTAS — formulario rápido: tipo, área, texto, foto opcional, orden relacionada (opcional) y PIN
function NotaFormModal({pins,empleadas,onGuardar,onCancelar}){
  const [tipo,setTipo]=useState("pendiente");
  const [area,setArea]=useState("atras");
  const [texto,setTexto]=useState("");
  const [ordenId,setOrdenId]=useState("");
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [subiendo,setSubiendo]=useState(false);
  const [err,setErr]=useState("");
  const [pinAbierto,setPinAbierto]=useState(false);
  const elegirFoto=e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    setFile(f);setPreview(URL.createObjectURL(f));
  };
  const continuar=()=>{
    if(!texto.trim()){setErr("Escribe el texto de la nota");return;}
    setPinAbierto(true);
  };
  const onPinOk=async emp=>{
    setPinAbierto(false);
    setSubiendo(true);
    let fotoUrl=null;
    try{
      if(file)fotoUrl=await subirFoto(file,"notas");
      onGuardar({tipo,area,texto:texto.trim(),ordenId:ordenId.trim()||null,fotoUrl,autoraId:emp?.id||null});
    }catch(e){
      setErr("No se pudo subir la foto: "+(e.message||"intenta de nuevo"));
      setSubiendo(false);
    }
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:400,maxHeight:"88vh",overflowY:"auto",padding:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:14,textAlign:"center"}}>📝 Dejar nota</div>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Tipo</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {Object.entries(TIPO_NOTA).map(([k,v])=>(
              <button key={k} onClick={()=>setTipo(k)} style={{padding:"8px 6px",borderRadius:10,border:tipo===k?`2px solid ${v.color}`:"1.5px solid #e8f0f7",background:tipo===k?v.bg:"#f8fbfd",fontSize:12,fontWeight:700,color:v.color,cursor:"pointer"}}>{v.label}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Área</label>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setArea("atras")} style={{flex:1,padding:"8px",borderRadius:10,border:area==="atras"?"2px solid #1a3c5e":"1.5px solid #e8f0f7",background:area==="atras"?"#eaf3fb":"#f8fbfd",fontWeight:700,fontSize:12,color:"#1a3c5e",cursor:"pointer"}}>🧺 Atrás</button>
            <button onClick={()=>setArea("adelante")} style={{flex:1,padding:"8px",borderRadius:10,border:area==="adelante"?"2px solid #1a3c5e":"1.5px solid #e8f0f7",background:area==="adelante"?"#eaf3fb":"#f8fbfd",fontWeight:700,fontSize:12,color:"#1a3c5e",cursor:"pointer"}}>🛎️ Adelante</button>
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Texto</label>
          <textarea style={{...S.inp,minHeight:70,resize:"vertical"}} placeholder="Escribe aquí..." value={texto} onChange={e=>{setTexto(e.target.value);setErr("");}}/>
        </div>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Folio de orden relacionada (opcional)</label>
          <input style={S.inp} placeholder="ej. LL-MS9EDXD7" value={ordenId} onChange={e=>setOrdenId(e.target.value)}/>
        </div>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Foto (opcional)</label>
          {preview&&<img src={preview} alt="preview" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:10,marginBottom:8}}/>}
          <label style={{...S.btnS,display:"block",cursor:"pointer",textAlign:"center"}}>
            📷 {preview?"Cambiar foto":"Adjuntar foto"}
            <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={elegirFoto}/>
          </label>
        </div>

        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginBottom:8}}>{err}</div>}

        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button style={{...S.btnP,flex:1,opacity:subiendo?0.6:1}} disabled={subiendo} onClick={continuar}>{subiendo?"Guardando...":"✓ Continuar"}</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar} disabled={subiendo}>Cancelar</button>
        </div>
      </div>
      {pinAbierto&&<PinModal pins={pins} empleadas={empleadas} titulo="¿Quién deja esta nota?" onConfirm={onPinOk} onCancelar={()=>setPinAbierto(false)}/>}
    </div>
  );
}

function FotoTareaModal({onConfirmar,onCancelar}){
  const [preview,setPreview]=useState(null);
  const [file,setFile]=useState(null);
  const [subiendo,setSubiendo]=useState(false);
  const [err,setErr]=useState("");
  const elegir=e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErr("");
  };
  const confirmar=async()=>{
    if(!file){setErr("Toma o elige una foto primero");return;}
    setSubiendo(true);
    try{
      const url=await subirFoto(file,"tareas");
      onConfirmar(url);
    }catch(e){
      setErr("No se pudo subir la foto: "+(e.message||"intenta de nuevo"));
      setSubiendo(false);
    }
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,padding:20,textAlign:"center"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4}}>📷 Esta tarea requiere foto</div>
        <div style={{fontSize:12,color:"#888",marginBottom:14}}>Adjunta la evidencia antes de marcarla completada</div>
        {preview?(
          <img src={preview} alt="preview" style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:12,marginBottom:12}}/>
        ):(
          <div style={{width:"100%",height:140,background:"#f8fbfd",border:"1.5px dashed #d0dce8",borderRadius:12,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",color:"#888",fontSize:13}}>Sin foto todavía</div>
        )}
        <label style={{...S.btnS,display:"block",cursor:"pointer",marginBottom:10}}>
          📷 {preview?"Tomar otra foto":"Tomar / elegir foto"}
          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={elegir}/>
        </label>
        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginBottom:8}}>{err}</div>}
        <div style={{display:"flex",gap:8}}>
          <button style={{...S.btnP,flex:1,opacity:file&&!subiendo?1:0.5}} disabled={!file||subiendo} onClick={confirmar}>{subiendo?"Subiendo...":"✓ Continuar"}</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar} disabled={subiendo}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// 📋 TAREAS — modal para dejar la nota obligatoria de una tarea que la requiere, antes de confirmar con PIN
function NotaTareaModal({titulo,onConfirmar,onCancelar}){
  const [texto,setTexto]=useState("");
  const [err,setErr]=useState("");
  const confirmar=()=>{
    if(!texto.trim()){setErr("Escribe la nota antes de continuar");return;}
    onConfirmar(texto.trim());
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,padding:20,textAlign:"center"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4}}>📝 Esta tarea requiere una nota</div>
        <div style={{fontSize:12,color:"#888",marginBottom:4}}>{titulo}</div>
        <div style={{fontSize:12,color:"#888",marginBottom:14}}>Escribe el detalle antes de marcarla completada</div>
        <textarea style={{...S.inp,minHeight:90,resize:"vertical",textAlign:"left"}} placeholder="Ej. Se compró detergente, faltó suavizante..." value={texto} onChange={e=>{setTexto(e.target.value);setErr("");}}/>
        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginTop:8}}>{err}</div>}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button style={{...S.btnP,flex:1}} onClick={confirmar}>✓ Continuar</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function ClasificacionModal({onConfirmar,onCancelar}){
  const [bolsillosRevisados,setBolsillosRevisados]=useState(false);
  const [objetosEncontrados,setObjetosEncontrados]=useState("");
  const [manchasDetectadas,setManchasDetectadas]=useState(false);
  const [requiereRestregado,setRequiereRestregado]=useState(false);
  const [restregadoCosto,setRestregadoCosto]=useState("");
  const [serviciosAdicionales,setServiciosAdicionales]=useState([]); // [{id,descripcion,costo}]
  const [nuevoServ,setNuevoServ]=useState(null); // {descripcion,costo} en edición
  const [err,setErr]=useState("");

  const PRESETS_SERV=[
    {emoji:"👟",label:"Zapatos"},{emoji:"🛏️",label:"Sábanas"},{emoji:"🧸",label:"Peluches"},
    {emoji:"🛌",label:"Almohadas"},{emoji:"🎒",label:"Mochilas"},{emoji:"➕",label:"Otro"},
  ];
  const agregarServicio=()=>{
    if(!nuevoServ?.descripcion?.trim()||!nuevoServ?.costo){return;}
    setServiciosAdicionales([...serviciosAdicionales,{id:"sa_"+Date.now(),descripcion:nuevoServ.descripcion.trim(),costo:parseFloat(nuevoServ.costo)||0}]);
    setNuevoServ(null);
  };
  const quitarServicio=id=>setServiciosAdicionales(serviciosAdicionales.filter(s=>s.id!==id));

  const confirmar=()=>{
    if(!bolsillosRevisados){setErr("Confirma que ya revisaste los bolsillos");return;}
    if(requiereRestregado&&!restregadoCosto){setErr("Escribe el costo del restregado extra");return;}
    onConfirmar({
      bolsillosRevisados,
      objetosEncontrados:objetosEncontrados.trim()||null,
      manchasDetectadas,
      requiereRestregado,
      restregadoCosto:requiereRestregado?parseFloat(restregadoCosto)||0:null,
      serviciosAdicionales,
    });
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:400,maxHeight:"88vh",overflowY:"auto",padding:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4,textAlign:"center"}}>🔍 Revisión de prendas</div>
        <div style={{fontSize:12,color:"#888",textAlign:"center",marginBottom:16}}>Antes de empezar a lavar</div>

        <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:bolsillosRevisados?"#e8f5e9":"#f8fbfd",borderRadius:10,marginBottom:10,cursor:"pointer",border:"1.5px solid "+(bolsillosRevisados?"#2e7d32":"#e8f0f7")}}>
          <input type="checkbox" checked={bolsillosRevisados} onChange={e=>{setBolsillosRevisados(e.target.checked);setErr("");}} style={{width:18,height:18}}/>
          <span style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>👖 Revisé los bolsillos</span>
        </label>

        <div style={{marginBottom:10}}>
          <label style={S.lbl}>Objetos encontrados (opcional)</label>
          <input style={S.inp} placeholder="ej. billete, llaves, lápiz..." value={objetosEncontrados} onChange={e=>setObjetosEncontrados(e.target.value)}/>
        </div>

        <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:manchasDetectadas?"#fff3e0":"#f8fbfd",borderRadius:10,marginBottom:10,cursor:"pointer",border:"1.5px solid "+(manchasDetectadas?"#e65100":"#e8f0f7")}}>
          <input type="checkbox" checked={manchasDetectadas} onChange={e=>setManchasDetectadas(e.target.checked)} style={{width:18,height:18}}/>
          <span style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>🟤 Tiene manchas visibles</span>
        </label>

        <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:requiereRestregado?"#fff3e0":"#f8fbfd",borderRadius:10,marginBottom:6,cursor:"pointer",border:"1.5px solid "+(requiereRestregado?"#e65100":"#e8f0f7")}}>
          <input type="checkbox" checked={requiereRestregado} onChange={e=>{setRequiereRestregado(e.target.checked);setErr("");}} style={{width:18,height:18}}/>
          <span style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>🧽 Requiere restregado extra (costo adicional)</span>
        </label>
        {requiereRestregado&&(
          <div style={{marginBottom:10}}>
            <label style={S.lbl}>Costo del restregado extra</label>
            <input type="number" style={S.inp} placeholder="ej. 2.00" value={restregadoCosto} onChange={e=>{setRestregadoCosto(e.target.value);setErr("");}}/>
            <div style={{fontSize:11,color:"#888",marginTop:4}}>Después de confirmar, podrás avisarle al cliente por WhatsApp con este costo.</div>
          </div>
        )}

        <div style={{marginTop:6,marginBottom:6}}>
          <label style={S.lbl}>🧾 Servicios adicionales encontrados (opcional)</label>
          <div style={{fontSize:11,color:"#888",marginBottom:6}}>Ej. zapatos, sábanas, peluches, almohadas, mochilas que no venían en la orden original</div>
          {serviciosAdicionales.map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fbfd",border:"1.5px solid #e8f0f7",borderRadius:8,padding:"6px 10px",marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:600,color:"#1a3c5e"}}>{s.descripcion} — ${s.costo.toFixed(2)}</span>
              <button onClick={()=>quitarServicio(s.id)} style={{background:"none",border:"none",color:"#c62828",fontWeight:800,cursor:"pointer",fontSize:14}}>✕</button>
            </div>
          ))}
          {nuevoServ?(
            <div style={{background:"#eaf3fb",border:"1.5px solid #90caf9",borderRadius:8,padding:8,marginBottom:6}}>
              <input style={{...S.inp,marginBottom:6}} placeholder="Descripción (ej. Zapatos)" value={nuevoServ.descripcion||""} onChange={e=>setNuevoServ({...nuevoServ,descripcion:e.target.value})}/>
              <input type="number" style={{...S.inp,marginBottom:6}} placeholder="Costo" value={nuevoServ.costo||""} onChange={e=>setNuevoServ({...nuevoServ,costo:e.target.value})}/>
              <div style={{display:"flex",gap:6}}>
                <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={agregarServicio}>✓ Agregar</button>
                <button style={{...S.btnS,flex:1}} onClick={()=>setNuevoServ(null)}>Cancelar</button>
              </div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {PRESETS_SERV.map(p=>(
                <button key={p.label} onClick={()=>setNuevoServ({descripcion:p.label==="Otro"?"":p.label,costo:""})} style={{padding:"8px 4px",borderRadius:8,border:"1.5px solid #e8f0f7",background:"#f8fbfd",fontSize:11,fontWeight:700,color:"#1a3c5e",cursor:"pointer"}}>{p.emoji} {p.label}</button>
              ))}
            </div>
          )}
        </div>

        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginBottom:8}}>{err}</div>}

        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button style={{...S.btnP,flex:1}} onClick={confirmar}>Continuar</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function MachinePicker({maquinas,tipoMaquina,tiempoSugerido,repetir,grupo,centrifugado,onConfirmar,onCancelar}){
  const [maquinaId,setMaquinaId]=useState(null);
  const [minutos,setMinutos]=useState(String(tiempoSugerido||45));
  const [comentario,setComentario]=useState("");
  const [errC,setErrC]=useState("");
  // 👟 El centrifugado siempre usa lavadora normal (incluso para zapatos). Si el grupo es "zapatos" y no es centrifugado, prioriza 1LZ/1SZ.
  const categoriaPreferida=(grupo==="zapatos"&&!centrifugado)?"zapatos":"general";
  const todasDelTipo=maquinas.filter(m=>m.tipo===tipoMaquina&&m.estado==="libre");
  const preferidas=todasDelTipo.filter(m=>(m.categoria||"general")===categoriaPreferida);
  const usarPreferidas=preferidas.length>0;
  const libres=usarPreferidas?preferidas:todasDelTipo.filter(m=>(m.categoria||"general")==="general");
  const confirmar=()=>{
    if(!maquinaId)return;
    if(repetir&&!comentario.trim()){setErrC("Escribe el motivo, es obligatorio para volver a lavar/secar");return;}
    onConfirmar(maquinaId,parseInt(minutos)||45,comentario.trim());
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,maxHeight:"85vh",overflowY:"auto",padding:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4,textAlign:"center"}}>{repetir?"🔁 ":""}{centrifugado?"🌀 Elige la lavadora (centrifugado)":tipoMaquina==="lavadora"?"🧺 Elige la lavadora":"🔥 Elige la secadora"}</div>
        {repetir&&<div style={{fontSize:12,color:"#e65100",fontWeight:600,textAlign:"center",marginBottom:10}}>Se va a repetir {tipoMaquina==="lavadora"?"el lavado":"el secado"}</div>}
        {categoriaPreferida==="zapatos"&&usarPreferidas&&<div style={{fontSize:12,color:"#8d6e63",fontWeight:600,textAlign:"center",marginBottom:10}}>👟 Mostrando solo la máquina especial de zapatos</div>}
        {categoriaPreferida==="zapatos"&&!usarPreferidas&&todasDelTipo.length>0&&<div style={{fontSize:12,color:"#e65100",fontWeight:600,textAlign:"center",marginBottom:10}}>⚠️ La máquina de zapatos está ocupada — mostrando lavadoras/secadoras normales</div>}
        {libres.length===0&&<div style={{textAlign:"center",color:"#c62828",fontWeight:600,fontSize:13,padding:"14px 0"}}>No hay {tipoMaquina==="lavadora"?"lavadoras":"secadoras"} libres ahora mismo.</div>}
        {libres.map(m=>(
          <button key={m.id} onClick={()=>setMaquinaId(m.id)} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",borderRadius:10,marginBottom:8,border:maquinaId===m.id?"2px solid #1a3c5e":"1.5px solid #e8f0f7",background:maquinaId===m.id?"#eaf3fb":"#f8fbfd",fontWeight:700,color:"#1a3c5e",cursor:"pointer"}}>
            {m.categoria==="zapatos"?"👟":m.tipo==="lavadora"?"🧺":"🔥"} {m.nombre}{m.capacidadKg?` · ${m.capacidadKg} Kg`:""}
          </button>
        ))}
        {maquinaId&&(
          <div style={{marginTop:12}}>
            <label style={S.lbl}>Minutos programados</label>
            <input type="number" style={S.inp} value={minutos} onChange={e=>setMinutos(e.target.value)}/>
            <div style={{marginTop:10}}>
              <label style={S.lbl}>{repetir?"Motivo de repetir (obligatorio)":"Comentario (opcional)"}</label>
              <textarea style={{...S.inp,minHeight:60,resize:"vertical"}} placeholder={repetir?"ej. quedaron manchas, salió con mal olor...":"Notas para esta carga..."} value={comentario} onChange={e=>{setComentario(e.target.value);setErrC("");}}/>
              {errC&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginTop:4}}>{errC}</div>}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button style={{...S.btnP,flex:1,opacity:maquinaId?1:0.5}} disabled={!maquinaId} onClick={confirmar}>Continuar</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// 🏭 PRODUCCIÓN — Fase 5: tablero completo — máquina + tiempo por etapa, notificaciones, y confirmación final de Listo
function Produccion({ventas,setVentas,upsertVenta,empleadas,pins,eventosProduccion,setEventosProduccion,upsertEvento,maquinas,setMaquinas,upsertMaquina,cargas,setCargas,upsertCarga}){
  const [pickerFor,setPickerFor]=useState(null); // {folio, tipoMaquina}
  const [clasifFor,setClasifFor]=useState(null); // {folio} — orden esperando revisión de prendas
  const [clasifExtraFor,setClasifExtraFor]=useState(null); // {folio,siguientePicker} — revisión de bolsillos para una carga ADICIONAL (2da/3ra lavadora)
  const [selLavadoZap,setSelLavadoZap]=useState({}); // {folio:true} seleccionados para lote de lavado
  const [selCentrifugadoZap,setSelCentrifugadoZap]=useState({}); // {folio:true} seleccionados para lote de centrifugado
  const [selSecadoZap,setSelSecadoZap]=useState({}); // {folio:"pares"} seleccionados para lote de secado (máx 20 pares)
  const [selEmpaquetarZap,setSelEmpaquetarZap]=useState({}); // {folio:true} seleccionados para iniciar empaquetado
  const [minLoteLav,setMinLoteLav]=useState("45");
  const [minLoteCent,setMinLoteCent]=useState("15");
  const [minLoteSec,setMinLoteSec]=useState("45");
  const [pinFor,setPinFor]=useState(null); // {folio, accion, label, extra}
  const [notifOn,setNotifOn]=useState(typeof Notification!=="undefined"&&Notification.permission==="granted");
  const [panelLavadoraZap,setPanelLavadoraZap]=useState(false); // panel al tocar la máquina 1LZ: pendientes/lavados/centrifugando
  const [panelSecadoraZap,setPanelSecadoraZap]=useState(false); // panel al tocar la máquina 1SZ: esperando secar/secando
  const [panelEmpaquetadoZap,setPanelEmpaquetadoZap]=useState(false); // panel al tocar el ícono de empaquetado: quién está empaquetando ahora
  const [tabProd,setTabProd]=useState("maquinas"); // "maquinas" | "ropa" | "zapatos" — separa la pantalla de producción en secciones
  const [buscarClienteProd,setBuscarClienteProd]=useState(""); // 🔍 buscador rápido por nombre en Ropa/Zapatos
  const [detalleEstadoZap,setDetalleEstadoZap]=useState(null); // qué categoría del resumen de zapatos está expandida (ej. "enLavado")

  const activos=ventas.filter(v=>!v.anulada&&["recibido","proceso"].includes(v.estado||"recibido")).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const eventosDe=folio=>eventosProduccion.filter(ev=>ev.ventaFolio===folio);
  const buscarEvento=(folio,etapa)=>eventosDe(folio).filter(ev=>ev.etapa===etapa).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";
  // 🔧 "zapatos" y "sin grupo" cuentan como la misma orden — evita cargas huérfanas si una orden de puros zapatos empezó antes de dividirse en grupos
  const gruposEquivalentes=g=>g==="zapatos"?[null,"zapatos"]:[g||null];
  const cargaDe=(folio,tipo,grupo)=>cargas.filter(c=>(c.ventaFolio===folio||(c.ventaFolios||[]).includes(folio))&&c.tipo===tipo&&gruposEquivalentes(grupo).includes(c.grupo||null)).sort((a,b)=>new Date(b.inicio)-new Date(a.inicio))[0];
  const esZapatoLbl=lbl=>/ZAPATO|PARES?\b|TENIS|CALZADO|BOTAS?\b|SANDALIA|ZAPATILLA|MOCAS[IÍ]N|SNEAKER|TAC[OÓ]N/i.test(lbl||"");
  // 🗂️ Para las pestañas Ropa/Zapatos: a qué sección(es) pertenece cada orden
  const perteneceZapatos=v=>{
    if(v.prodGrupos)return v.prodGrupos.includes("zapatos");
    return (v.items||[]).some(it=>esZapatoLbl(it.label));
  };
  const perteneceRopa=v=>{
    if(v.prodGrupos)return v.prodGrupos.some(g=>g!=="zapatos");
    return (v.items||[]).some(it=>!esZapatoLbl(it.label));
  };
  // 👟 Cuenta los pares de zapatos de una orden. Si el servicio es un combo/promo con el número en el nombre
  // (ej. "MIERCOLES DE ZAPATOS (PROMO 4 PARES)"), se usa ESE número — el campo piezas no siempre refleja
  // cuántos pares trae el combo, solo cuántas veces se compró ese combo.
  const paresDeLabel=lbl=>{const m=(lbl||"").match(/(\d+)\s*PARES?\b/i);return m?parseInt(m[1]):null;};
  const paresDe=folio=>{
    const v=ventas.find(vv=>vv.folio===folio);
    if(!v)return 0;
    return (v.items||[]).filter(it=>esZapatoLbl(it.label)).reduce((a,it)=>{
      const desdeLabel=paresDeLabel(it.label);
      const cantidad=desdeLabel!=null?desdeLabel*(it.piezas||1):(it.piezas||1);
      return a+cantidad;
    },0);
  };
  // 👟 Flujos de zapatos entre las órdenes activas: el grupo "zapatos" de una orden dividida, o la orden completa si es solo zapatos
  const flujosZapatos=[];
  activos.forEach(v=>{
    const tieneZap=(v.items||[]).some(it=>esZapatoLbl(it.label));
    const tieneOtro=(v.items||[]).some(it=>!esZapatoLbl(it.label));
    if(v.prodGrupos&&v.prodGrupos.includes("zapatos"))flujosZapatos.push({folio:v.folio,grupo:"zapatos",cliente:v.clienteNombre,v});
    else if(!v.prodGrupos&&tieneZap&&!tieneOtro)flujosZapatos.push({folio:v.folio,grupo:"zapatos",cliente:v.clienteNombre,v});
  });
  // 👖 Las órdenes MIXTAS (con ropa) sí necesitan la revisión de bolsillos antes de lavar (por la parte de ropa).
  // Las de SOLO zapatos no la necesitan — recepción ya revisó los zapatos, así que entran directo a la cola.
  const colaLavadoZap=flujosZapatos.filter(f=>{
    const necesitaClasificacion=!!f.v.prodGrupos; // si está dividida (mixta), sí requiere; si es pura, no
    return(necesitaClasificacion?!!f.v.clasificacion:true)&&!cargaDe(f.folio,"lavado",f.grupo);
  });
  // 🌀 Después del lavado, pasan a esperar centrifugado (en lavadora general L1-L3)
  const colaCentrifugadoZap=flujosZapatos.filter(f=>{const cl=cargaDe(f.folio,"lavado",f.grupo);return cl?.finReal&&!cargaDe(f.folio,"centrifugado",f.grupo);});
  // 🔥 Solo entran a la cola de secado una vez que el centrifugado terminó
  const colaSecadoZap=flujosZapatos.filter(f=>{const cc=cargaDe(f.folio,"centrifugado",f.grupo);return cc?.finReal&&!cargaDe(f.folio,"secado",f.grupo);});
  // 📦 Ya se secaron — esperan a que se seleccione quién las empaqueta (sin necesitar entrar a cada orden individual)
  const colaEmpaquetarZap=flujosZapatos.filter(f=>{
    const cs=cargaDe(f.folio,"secado",f.grupo);
    if(!cs?.finReal)return false;
    const yaEmpezado=eventosDe(f.folio).some(ev=>ev.etapa==="doblado_inicio"&&gruposEquivalentes(f.grupo).includes(ev.grupo||null));
    return !yaEmpezado;
  });
  // 📦 Las que YA están siendo empaquetadas ahora mismo (se marcó inicio, todavía no fin)
  const empaquetandoZap=flujosZapatos.map(f=>{
    const evsG=eventosDe(f.folio).filter(ev=>gruposEquivalentes(f.grupo).includes(ev.grupo||null));
    const inicio=evsG.filter(ev=>ev.etapa==="doblado_inicio").sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
    const fin=evsG.filter(ev=>ev.etapa==="doblado_fin").sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
    return{...f,inicio,fin};
  }).filter(f=>f.inicio&&(!f.fin||new Date(f.fin.timestamp)<new Date(f.inicio.timestamp)));
  // ✅ Ya terminaron de empaquetarse — falta confirmar "Listo para retirar" (esto es lo que dispara el aviso al cliente)
  const listoParaConfirmarZap=flujosZapatos.filter(f=>{
    if(["listo","entregado"].includes(f.v.estado||"recibido"))return false;
    const finEmpaquetadoDeEsteGrupo=eventosDe(f.folio).some(ev=>ev.etapa==="doblado_fin"&&gruposEquivalentes(f.grupo).includes(ev.grupo||null));
    if(!finEmpaquetadoDeEsteGrupo)return false;
    // Si la orden está dividida (mixta con ropa), hay que esperar que TODOS sus grupos también hayan terminado
    if(f.v.prodGrupos)return f.v.prodGrupos.every(g=>eventosDe(f.folio).some(ev=>ev.etapa==="doblado_fin"&&gruposEquivalentes(g).includes(ev.grupo||null)));
    return true;
  });
  const paresSeleccionados=Object.values(selSecadoZap).reduce((a,p)=>a+(parseInt(p)||0),0);
  const paresSeleccionadosCentrifugado=Object.values(selCentrifugadoZap).reduce((a,p)=>a+(parseInt(p)||0),0);
  // 📊 Totales de pares en cada etapa, para tener claro cuántos van por lavar, en lavado, esperando/en centrifugado, y esperando/en secado
  // 🔧 Una carga solo cuenta como "activa" si la máquina TODAVÍA la referencia y está ocupada — evita cargas huérfanas (ej. máquina liberada a mano) que se quedan mostrando pares fantasma para siempre
  const cargaEsActivaEnMaquina=c=>maquinas.some(m=>m.cargaActualId===c.id&&m.estado==="ocupada");
  const cargasZapActivas=tipo=>cargas.filter(c=>c.grupo==="zapatos"&&c.tipo===tipo&&!c.finReal&&cargaEsActivaEnMaquina(c));
  const paresEnCarga=c=>c.pares!=null?c.pares:(c.ventaFolios&&c.ventaFolios.length?c.ventaFolios:[c.ventaFolio]).reduce((a,f)=>a+paresDe(f),0);
  const totalesZapatos={
    porLavar:colaLavadoZap.reduce((a,f)=>a+paresDe(f.folio),0),
    enLavado:cargasZapActivas("lavado").reduce((a,c)=>a+paresEnCarga(c),0),
    esperandoCentrifugado:colaCentrifugadoZap.reduce((a,f)=>a+paresDe(f.folio),0),
    enCentrifugado:cargasZapActivas("centrifugado").reduce((a,c)=>a+paresEnCarga(c),0),
    esperandoSecado:colaSecadoZap.reduce((a,f)=>a+paresDe(f.folio),0),
    enSecado:cargasZapActivas("secado").reduce((a,c)=>a+paresEnCarga(c),0),
  };
  // 👤 Detalle por cliente para cada categoría — se muestra al tocar el número (nombre del cliente + cuántos pares suyos)
  const clienteDeFolio=folio=>ventas.find(v=>v.folio===folio)?.clienteNombre||"—";
  const detalleDeCargas=tipo=>{
    const filas=[];
    cargasZapActivas(tipo).forEach(c=>{
      const folios=c.ventaFolios&&c.ventaFolios.length?c.ventaFolios:[c.ventaFolio];
      folios.forEach(folio=>filas.push({cliente:clienteDeFolio(folio),folio,pares:paresDe(folio)}));
    });
    return filas;
  };
  const detallesZapatos={
    porLavar:colaLavadoZap.map(f=>({cliente:f.cliente,folio:f.folio,pares:paresDe(f.folio)})),
    enLavado:detalleDeCargas("lavado"),
    esperandoCentrifugado:colaCentrifugadoZap.map(f=>({cliente:f.cliente,folio:f.folio,pares:paresDe(f.folio)})),
    enCentrifugado:detalleDeCargas("centrifugado"),
    esperandoSecado:colaSecadoZap.map(f=>({cliente:f.cliente,folio:f.folio,pares:paresDe(f.folio)})),
    enSecado:detalleDeCargas("secado"),
  };

  const notificar=(titulo,cuerpo)=>{try{if(typeof Notification!=="undefined"&&Notification.permission==="granted")new Notification(titulo,{body:cuerpo});}catch{}};

  const registrar=(folio,etapa,empleadaId,observaciones,grupo)=>{
    const ev={id:folio+"_"+etapa+"_"+(grupo||"x")+"_"+Date.now(),ventaFolio:folio,etapa,empleadaId:empleadaId||null,timestamp:new Date().toISOString(),observaciones:observaciones||null,grupo:grupo||null};
    setEventosProduccion(prev=>[...prev,ev]);
    if(upsertEvento)upsertEvento(ev);
  };
  const cambiarEstadoVenta=(folio,estado)=>{
    setVentas(prev=>{
      const next=prev.map(v=>v.folio===folio?{...v,estado}:v);
      const updated=next.find(v=>v.folio===folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  // 🧽 Avisa al cliente del restregado extra por WhatsApp y marca la orden como "esperando respuesta" — disponible también desde Producción
  const avisarRestregado=v=>{
    const tel=telWa(v.clienteTel);
    if(!tel){alert("Este cliente no tiene teléfono registrado.");return;}
    const costo=v.clasificacion?.restregadoCosto||0;
    const msg=`🫧 *LAVA & LISTO* 🫧\n\n¡Hola *${v.clienteNombre}*! 👋\nAl revisar tu orden *${v.folio}* encontramos que necesita un restregado extra por manchas difíciles.\n\n🧽 *Costo adicional:* $${costo.toFixed(2)}\n\n¿Nos autorizas a hacerlo? Contéstanos por este medio. ¡Gracias! 💙`;
    window.open(`https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msg)}`,"_blank");
    setVentas(prev=>{
      const next=prev.map(vv=>vv.folio===v.folio?{...vv,clasificacion:{...vv.clasificacion,restregadoEstado:"pendiente_confirmar",restregadoAvisadoEn:new Date().toISOString()}}:vv);
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    notificar("🧽 Mensaje de restregado enviado",`${v.clienteNombre} · ${v.folio} · $${costo.toFixed(2)} — falta confirmar respuesta`);
  };
  // 🧽 Registra lo que respondió el cliente: si autoriza se suma a la orden, si no queda en observaciones — disponible también desde Producción
  const confirmarRestregado=(v,autorizado)=>{
    const costo=v.clasificacion?.restregadoCosto||0;
    if(autorizado){
      const nuevoItem={servId:null,custom:true,piezas:1,lC:"🧽 Restregado extra autorizado",pC:costo.toFixed(2)};
      setVentas(prev=>{
        const next=prev.map(vv=>vv.folio===v.folio?{...vv,items:[...(vv.items||[]),nuevoItem],total:(vv.total||0)+costo,clasificacion:{...vv.clasificacion,restregadoEstado:"autorizado",restregadoConfirmadoEn:new Date().toISOString()}}:vv);
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const notaTxt=`🧽 Restregado extra rechazado por el cliente (hubiera costado $${costo.toFixed(2)})`;
      setVentas(prev=>{
        const next=prev.map(vv=>vv.folio===v.folio?{...vv,notas:[vv.notas,notaTxt].filter(Boolean).join(" · "),clasificacion:{...vv.clasificacion,restregadoEstado:"rechazado",restregadoConfirmadoEn:new Date().toISOString()}}:vv);
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
  };
  // 🧾 Avisa al cliente por WhatsApp de TODOS los servicios adicionales encontrados que aún no se han avisado, en un solo mensaje
  const avisarServiciosAdicionales=v=>{
    const tel=telWa(v.clienteTel);
    if(!tel){alert("Este cliente no tiene teléfono registrado.");return;}
    const pendientes=(v.clasificacion?.serviciosAdicionales||[]).filter(s=>!s.estado);
    if(pendientes.length===0)return;
    const lineas=pendientes.map(s=>`🔹 ${s.descripcion}: $${s.costo.toFixed(2)}`).join("\n");
    const total=pendientes.reduce((a,s)=>a+s.costo,0);
    const msg=`🫧 *LAVA & LISTO* 🫧\n\n¡Hola *${v.clienteNombre}*! 👋\nAl revisar tu orden *${v.folio}* encontramos prendas adicionales que no venían en tu pedido original:\n\n${lineas}\n\n🧾 *Total adicional:* $${total.toFixed(2)}\n\n¿Nos autorizas a incluirlas en el lavado? Contéstanos por este medio. ¡Gracias! 💙`;
    window.open(`https://api.whatsapp.com/send/?phone=${tel}&text=${encodeURIComponent(msg)}`,"_blank");
    setVentas(prev=>{
      const next=prev.map(vv=>{
        if(vv.folio!==v.folio)return vv;
        const sa=(vv.clasificacion?.serviciosAdicionales||[]).map(s=>!s.estado?{...s,estado:"pendiente_confirmar",avisadoEn:new Date().toISOString()}:s);
        return{...vv,clasificacion:{...vv.clasificacion,serviciosAdicionales:sa}};
      });
      const updated=next.find(vv=>vv.folio===v.folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    notificar("🧾 Servicios adicionales avisados",`${v.clienteNombre} · ${v.folio} · $${total.toFixed(2)} — falta confirmar respuesta`);
  };
  // 🧾 Registra lo que respondió el cliente para UN servicio adicional puntual
  const confirmarServicioAdicional=(v,itemId,autorizado)=>{
    const item=(v.clasificacion?.serviciosAdicionales||[]).find(s=>s.id===itemId);
    if(!item)return;
    if(autorizado){
      const nuevoItem={servId:null,custom:true,piezas:1,lC:`🧾 ${item.descripcion} (encontrado, autorizado)`,pC:item.costo.toFixed(2)};
      setVentas(prev=>{
        const next=prev.map(vv=>{
          if(vv.folio!==v.folio)return vv;
          const sa=(vv.clasificacion?.serviciosAdicionales||[]).map(s=>s.id===itemId?{...s,estado:"autorizado",confirmadoEn:new Date().toISOString()}:s);
          return{...vv,items:[...(vv.items||[]),nuevoItem],total:(vv.total||0)+item.costo,clasificacion:{...vv.clasificacion,serviciosAdicionales:sa}};
        });
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const notaTxt=`🧾 ${item.descripcion} encontrado y rechazado por el cliente (hubiera costado $${item.costo.toFixed(2)})`;
      setVentas(prev=>{
        const next=prev.map(vv=>{
          if(vv.folio!==v.folio)return vv;
          const sa=(vv.clasificacion?.serviciosAdicionales||[]).map(s=>s.id===itemId?{...s,estado:"rechazado",confirmadoEn:new Date().toISOString()}:s);
          return{...vv,notas:[vv.notas,notaTxt].filter(Boolean).join(" · "),clasificacion:{...vv.clasificacion,serviciosAdicionales:sa}};
        });
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
  };
  // ✂️ Divide una orden en 2 flujos de producción independientes (ej. Ropa y Zapatos) para que avancen a ritmos distintos
  const dividirGrupos=(folio,grupos)=>{
    setVentas(prev=>{
      const next=prev.map(v=>v.folio===folio?{...v,prodGrupos:grupos}:v);
      const updated=next.find(v=>v.folio===folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  // 🔍 Guarda la revisión de prendas (checklist de bolsillos/manchas/restregado) antes de permitir lavar
  const guardarClasificacion=(folio,datos,empleadaId)=>{
    const clasificacion={
      ...datos,
      serviciosAdicionales:(datos.serviciosAdicionales||[]).map(s=>({...s,estado:null,avisadoEn:null,confirmadoEn:null})),
      empleadaId:empleadaId||null,timestamp:new Date().toISOString()
    };
    // 👟 Auto-división: si la orden mezcla zapatos con ropa/edredones, se separa sola en 2 flujos (sin necesitar el botón manual)
    const ventaActual=ventas.find(v=>v.folio===folio);
    const tieneZap=(ventaActual?.items||[]).some(it=>esZapatoLbl(it.label));
    const tieneOtro=(ventaActual?.items||[]).some(it=>!esZapatoLbl(it.label));
    const autoGrupos=(tieneZap&&tieneOtro&&!ventaActual?.prodGrupos)?["ropa","zapatos"]:null;
    setVentas(prev=>{
      const next=prev.map(v=>v.folio===folio?{...v,clasificacion,...(autoGrupos?{prodGrupos:autoGrupos}:{})}:v);
      const updated=next.find(v=>v.folio===folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    const extraTxt=(datos.serviciosAdicionales||[]).length>0?` · Servicios adicionales: ${datos.serviciosAdicionales.map(s=>`${s.descripcion} $${s.costo.toFixed(2)}`).join(", ")}`:"";
    registrar(folio,"clasificacion",empleadaId,(datos.requiereRestregado?`Requiere restregado extra ($${datos.restregadoCosto?.toFixed(2)})`:datos.manchasDetectadas?"Tiene manchas":"")+extraTxt||null);
  };
  // 🔍 Revisión de bolsillos para una carga ADICIONAL (2da/3ra lavadora de la misma orden) — queda registrada aparte,
  // sin pisar la revisión principal, porque cada carga física se revisa por separado.
  const guardarClasificacionExtra=(folio,datos,empleadaId)=>{
    const revision={...datos,empleadaId:empleadaId||null,timestamp:new Date().toISOString()};
    setVentas(prev=>{
      const next=prev.map(v=>v.folio===folio?{...v,revisionesExtra:[...(v.revisionesExtra||[]),revision]}:v);
      const updated=next.find(v=>v.folio===folio);
      if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    registrar(folio,"clasificacion",empleadaId,"Revisión de carga adicional"+(datos.manchasDetectadas?" · Tiene manchas":""));
  };
  const setMaquinaEstado=(maquinaId,cambios)=>{
    setMaquinas(prev=>{
      const next=prev.map(m=>m.id===maquinaId?{...m,...cambios}:m);
      const updated=next.find(m=>m.id===maquinaId);
      if(updated&&upsertMaquina)upsertMaquina({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const iniciarCarga=(folio,tipo,maquinaId,minutos,empleadaId,comentario,esRepeticion,grupo,ciclo)=>{
    const inicio=new Date();
    const finProgramado=new Date(inicio.getTime()+minutos*60000);
    const cicloFinal=ciclo||(folio+"_"+tipo+"_ciclo_"+Date.now());
    const carga={id:folio+"_"+tipo+"_"+(grupo||"x")+"_"+Date.now(),ventaFolio:folio,ventaFolios:null,tipo,maquinaId,minutosProgramados:minutos,inicio:inicio.toISOString(),finProgramado:finProgramado.toISOString(),finReal:null,empleadaId:empleadaId||null,empleadaRetiroId:null,notificado:false,comentario:comentario||null,esRepeticion:!!esRepeticion,grupo:grupo||null,pares:null,ciclo:cicloFinal};
    setCargas(prev=>[...prev,carga]);
    if(upsertCarga)upsertCarga(carga);
    setMaquinaEstado(maquinaId,{estado:"ocupada",cargaActualId:carga.id,finProgramado:carga.finProgramado});
    registrar(folio,tipo==="lavado"?"lavado_inicio":tipo==="secado"?"secado_inicio":"centrifugado_inicio",empleadaId,esRepeticion?`🔁 Repetición — ${comentario}`:comentario,grupo);
    if(tipo==="lavado")cambiarEstadoVenta(folio,"proceso");
  };
  // 👟 Carga en LOTE: varias órdenes de zapatos acumuladas se lavan/centrifugan/secan juntas
  const iniciarCargaLote=(folios,tipo,maquinaId,minutos,empleadaId,pares)=>{
    const inicio=new Date();
    const finProgramado=new Date(inicio.getTime()+minutos*60000);
    const paresFinal=pares!=null?pares:folios.reduce((a,f)=>a+paresDe(f),0);
    const carga={id:"lote_"+tipo+"_"+Date.now(),ventaFolio:null,ventaFolios:folios,tipo,maquinaId,minutosProgramados:minutos,inicio:inicio.toISOString(),finProgramado:finProgramado.toISOString(),finReal:null,empleadaId:empleadaId||null,empleadaRetiroId:null,notificado:false,comentario:null,esRepeticion:false,grupo:"zapatos",pares:paresFinal||null};
    setCargas(prev=>[...prev,carga]);
    if(upsertCarga)upsertCarga(carga);
    setMaquinaEstado(maquinaId,{estado:"ocupada",cargaActualId:carga.id,finProgramado:carga.finProgramado});
    const etapa=tipo==="lavado"?"lavado_inicio":tipo==="centrifugado"?"centrifugado_inicio":"secado_inicio";
    folios.forEach(folio=>{
      registrar(folio,etapa,empleadaId,`👟 Lote de ${folios.length} orden(es)${paresFinal?` · ${paresFinal} pares`:""}`,"zapatos");
      if(tipo==="lavado")cambiarEstadoVenta(folio,"proceso");
    });
  };
  const retirarCarga=(carga,empleadaId)=>{
    const finReal=new Date().toISOString();
    setCargas(prev=>{
      const next=prev.map(c=>c.id===carga.id?{...c,finReal,empleadaRetiroId:empleadaId||null}:c);
      const updated=next.find(c=>c.id===carga.id);
      if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    setMaquinaEstado(carga.maquinaId,{estado:"libre",cargaActualId:null,finProgramado:null});
    const folios=carga.ventaFolios&&carga.ventaFolios.length?carga.ventaFolios:[carga.ventaFolio];
    folios.forEach(folio=>{
      registrar(folio,carga.tipo==="lavado"?"lavado_fin":carga.tipo==="secado"?"secado_fin":"centrifugado_fin",empleadaId,null,carga.grupo);
    });
  };

  // ⏰ Revisa cada 15s si alguna carga cumplió su tiempo, para notificar una sola vez (requiere esta pantalla abierta)
  useEffect(()=>{
    const id=setInterval(()=>{
      const ahora=Date.now();
      cargas.forEach(c=>{
        if(c.finReal||c.notificado)return;
        if(new Date(c.finProgramado).getTime()<=ahora){
          const v=ventas.find(vv=>vv.folio===c.ventaFolio);
          const titNotif=c.tipo==="lavado"?"🧺 Lavado terminado":c.tipo==="centrifugado"?"🌀 Centrifugado terminado":"🔥 Secado terminado";
          const sigNotif=c.tipo==="lavado"?"secadora o centrifugado":c.tipo==="centrifugado"?"secadora":"doblado";
          notificar(titNotif,`${v?.clienteNombre||c.ventaFolio} — pasa a ${sigNotif}`);
          setCargas(prev=>{
            const next=prev.map(cc=>cc.id===c.id?{...cc,notificado:true}:cc);
            const updated=next.find(cc=>cc.id===c.id);
            if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
            return next;
          });
        }
      });
    },15000);
    return()=>clearInterval(id);
    // eslint-disable-next-line
  },[cargas]);

  const onClasifConfirm=datos=>{
    if(clasifExtraFor){
      const{folio,siguientePicker}=clasifExtraFor;
      setClasifExtraFor(null);
      setPinFor({folio,accion:"clasificacion_extra",label:"¿Quién hizo la revisión de esta carga?",extra:{datos,siguientePicker}});
      return;
    }
    const folio=clasifFor.folio;
    setClasifFor(null);
    setPinFor({folio,accion:"clasificacion",label:"¿Quién hizo la revisión?",extra:{datos}});
  };
  const iniciarLoteLavado=()=>{
    const folios=Object.keys(selLavadoZap).filter(f=>selLavadoZap[f]);
    if(folios.length===0)return;
    setSelLavadoZap({});
    setPickerFor({tipoMaquina:"lavadora",grupo:"zapatos",lote:{folios,tipo:"lavado"}});
  };
  // 🧺 Ampliar un lavado de zapatos que YA está en marcha (1LZ ocupada no bloquea — se le suman más órdenes al mismo lote en curso)
  const cargaLavadoActiva1LZ=cargas.find(c=>c.maquinaId==="1LZ"&&c.tipo==="lavado"&&!c.finReal&&cargaEsActivaEnMaquina(c));
  const agregarALoteLavadoActivo=(carga,folios,empleadaId)=>{
    const nuevos=[...new Set([...(carga.ventaFolios||[]),...folios])];
    const paresActualizados=nuevos.reduce((a,f)=>a+paresDe(f),0);
    setCargas(prev=>{
      const next=prev.map(c=>c.id===carga.id?{...c,ventaFolios:nuevos,pares:paresActualizados}:c);
      const updated=next.find(c=>c.id===carga.id);
      if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    folios.forEach(folio=>{
      registrar(folio,"lavado_inicio",empleadaId,`👟 Se agregó al lote ya en marcha en ${carga.maquinaId}`,"zapatos");
      cambiarEstadoVenta(folio,"proceso");
    });
  };
  const iniciarAgregarALoteLavado=()=>{
    const folios=Object.keys(selLavadoZap).filter(f=>selLavadoZap[f]);
    if(folios.length===0||!cargaLavadoActiva1LZ)return;
    setSelLavadoZap({});
    setPinFor({folio:null,accion:"agregar_lote_lavado",label:"¿Quién agrega estos zapatos al lavado en curso?",extra:{carga:cargaLavadoActiva1LZ,folios}});
  };
  // 🌀 El centrifugado de zapatos usa lavadora GENERAL (L1-L3), no la lavadora especial de zapatos — por eso centrifugado:true en el picker
  const iniciarLoteCentrifugado=()=>{
    const folios=Object.keys(selCentrifugadoZap).filter(f=>selCentrifugadoZap[f]);
    if(folios.length===0)return;
    if(paresSeleccionadosCentrifugado>8){alert("⚠️ La lavadora para centrifugar solo admite hasta 8 pares por tanda. Quita algunos antes de continuar — el resto los centrifugas en otra carga aparte.");return;}
    setSelCentrifugadoZap({});
    setPickerFor({tipoMaquina:"lavadora",grupo:"zapatos",centrifugado:true,lote:{folios,tipo:"centrifugado",pares:paresSeleccionadosCentrifugado}});
  };
  const iniciarLoteSecado=()=>{
    const folios=Object.keys(selSecadoZap).filter(f=>selSecadoZap[f]);
    if(folios.length===0)return;
    if(paresSeleccionados>20){alert("⚠️ No puedes pasar de 20 pares en la secadora. Quita algunos antes de continuar.");return;}
    setSelSecadoZap({});
    setPickerFor({tipoMaquina:"secadora",grupo:"zapatos",lote:{folios,tipo:"secado",pares:paresSeleccionados}});
  };
  // 📦 Inicia el empaquetado de varias órdenes de zapatos a la vez — un solo PIN confirma quién empaqueta todas las seleccionadas
  const iniciarEmpaquetarSeleccionados=()=>{
    const folios=Object.keys(selEmpaquetarZap).filter(f=>selEmpaquetarZap[f]);
    if(folios.length===0)return;
    setSelEmpaquetarZap({});
    setPinFor({folio:null,accion:"iniciar_empaquetado_lote",label:"¿Quién empaqueta estos zapatos?",extra:{folios}});
  };
  const onPickerConfirm=(maquinaId,minutos,comentario)=>{
    const{folio,tipoMaquina,repetir,centrifugado,grupo,lote,ciclo}=pickerFor;
    setPickerFor(null);
    if(lote){
      const labelLote=lote.tipo==="lavado"?"¿Quién pone el lote de zapatos a lavar?":lote.tipo==="centrifugado"?"¿Quién pone el lote de zapatos a centrifugar?":"¿Quién pone el lote de zapatos a secar?";
      setPinFor({folio:null,accion:"iniciar_lote",label:labelLote,extra:{maquinaId,minutos,lote}});
      return;
    }
    const accion=centrifugado?"iniciar_centrifugado":tipoMaquina==="lavadora"?"iniciar_lavado":"iniciar_secado";
    const label=centrifugado?"¿Quién pone a centrifugar?":tipoMaquina==="lavadora"?(repetir?"¿Quién vuelve a lavar?":ciclo?"¿Quién pone esta lavadora adicional?":"¿Quién pone la carga a lavar?"):(repetir?"¿Quién vuelve a secar?":ciclo?"¿Quién pone esta secadora adicional?":"¿Quién pone la carga a secar?");
    setPinFor({folio,accion,label,extra:{maquinaId,minutos,comentario,repetir,grupo,ciclo}});
  };
  const onPinOk=emp=>{
    if(!pinFor)return;
    const{folio,accion,extra}=pinFor;
    if(accion==="clasificacion")guardarClasificacion(folio,extra.datos,emp?.id);
    else if(accion==="clasificacion_extra"){guardarClasificacionExtra(folio,extra.datos,emp?.id);setPickerFor(extra.siguientePicker);}
    else if(accion==="iniciar_lote")iniciarCargaLote(extra.lote.folios,extra.lote.tipo,extra.maquinaId,extra.minutos,emp?.id,extra.lote.pares);
    else if(accion==="agregar_lote_lavado")agregarALoteLavadoActivo(extra.carga,extra.folios,emp?.id);
    else if(accion==="iniciar_empaquetado_lote")extra.folios.forEach(folio=>registrar(folio,"doblado_inicio",emp?.id,null,"zapatos"));
    else if(accion==="iniciar_lavado")iniciarCarga(folio,"lavado",extra.maquinaId,extra.minutos,emp?.id,extra.comentario,extra.repetir,extra.grupo,extra.ciclo);
    else if(accion==="retirar_lavado")retirarCarga(extra.carga,emp?.id);
    else if(accion==="iniciar_secado")iniciarCarga(folio,"secado",extra.maquinaId,extra.minutos,emp?.id,extra.comentario,extra.repetir,extra.grupo,extra.ciclo);
    else if(accion==="retirar_secado")retirarCarga(extra.carga,emp?.id);
    else if(accion==="iniciar_centrifugado")iniciarCarga(folio,"centrifugado",extra.maquinaId,extra.minutos,emp?.id,extra.comentario,false,extra.grupo);
    else if(accion==="retirar_centrifugado")retirarCarga(extra.carga,emp?.id);
    else if(accion==="doblado_inicio")registrar(folio,"doblado_inicio",emp?.id,null,extra?.grupo);
    else if(accion==="doblado_fin"){registrar(folio,"doblado_fin",emp?.id,null,extra?.grupo);const v=ventas.find(vv=>vv.folio===folio);const esZapNotif=extra?.grupo==="zapatos";notificar(esZapNotif?"📦 Empaquetado terminado":"🪄 Doblado terminado",`${v?.clienteNombre||folio} — falta cambiar a Listo para retirar`);}
    else if(accion==="confirmar_listo")cambiarEstadoVenta(folio,"listo");
    setPinFor(null);
  };
  const activarNotificaciones=async()=>{
    try{const p=await Notification.requestPermission();setNotifOn(p==="granted");}catch{}
  };

  const sinPins=pins.filter(p=>p.activo).length===0;

  return(<div style={{padding:"4px 4px 20px"}}>
    {sinPins&&<div style={{...S.alrt,background:"#fff3e0",color:"#e65100"}}>⚠️ Todavía no hay PINs asignados. Pídele al admin que los configure en 🔒 PINs.</div>}
    {!notifOn&&<button onClick={activarNotificaciones} style={{...S.btnS,width:"100%",marginBottom:12,background:"#fff3e0",color:"#e65100"}}>🔔 Activar notificaciones en esta pantalla</button>}

    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {[["maquinas","🏭 Máquinas"],["ropa","👕 Ropa"],["zapatos","👟 Zapatos"]].map(([val,l])=>(
        <button key={val} onClick={()=>setTabProd(val)} style={{flex:1,padding:"9px 6px",borderRadius:10,border:tabProd===val?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:tabProd===val?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
      ))}
    </div>

    {tabProd==="maquinas"&&(
      <>
        <div style={{fontSize:12,color:"#888",marginBottom:10}}>Estado general de todas las máquinas — 🟢 libre / 🔵 ocupada / 🛠️ mantenimiento.</div>
        {[...new Set(maquinas.map(m=>m.zona||"Sin asignar"))].map(z=>(
          <div key={z} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:6}}>📍 {z.toUpperCase()}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8}}>
              {maquinas.filter(m=>(m.zona||"Sin asignar")===z).map(m=><TarjetaMaquina key={m.id} m={m} cargas={cargas} ventas={ventas} onClick={m.id==="1LZ"?()=>setPanelLavadoraZap(true):m.id==="1SZ"?()=>setPanelSecadoraZap(true):undefined}/>)}
            </div>
          </div>
        ))}
      </>
    )}

    {tabProd==="zapatos"&&(()=>{
      const hoyZ=fechaHoyLocal();
      const entreganHoyZap=flujosZapatos.filter(f=>fechaLocal(f.v.entrega)===hoyZ&&(f.v.estado||"recibido")!=="entregado");
      const coincideBusquedaProd=f=>!buscarClienteProd.trim()||(f.cliente||"").toLowerCase().includes(buscarClienteProd.trim().toLowerCase());
      return(
      <>
        {entreganHoyZap.length>0&&(
          <div style={{background:"#ffebee",border:"1.5px solid #e53935",borderRadius:12,padding:12,marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:800,color:"#c62828",marginBottom:6}}>🔴 Zapatos que se entregan HOY — dar prioridad ({entreganHoyZap.length})</div>
            {entreganHoyZap.map(f=>(
              <div key={f.folio} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:"1px solid #ffcdd2"}}>
                <span style={{color:"#c62828",fontWeight:600}}>{f.cliente} <span style={{color:"#aaa",fontWeight:400,fontSize:11}}>({f.folio})</span></span>
                <strong style={{color:"#c62828"}}>{paresDe(f.folio)} par{paresDe(f.folio)!==1?"es":""}</strong>
              </div>
            ))}
          </div>
        )}

        <div style={{marginBottom:12}}>
          <input style={S.inp} placeholder="🔍 Buscar cliente por nombre..." value={buscarClienteProd} onChange={e=>setBuscarClienteProd(e.target.value)}/>
        </div>
        <div style={{fontSize:12,color:"#888",marginBottom:8}}>Toca la lavadora o la secadora de zapatos para ver el detalle completo de cada máquina.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8,marginBottom:16}}>
          {maquinas.filter(m=>m.id==="1LZ"||m.id==="1SZ").map(m=><TarjetaMaquina key={m.id} m={m} cargas={cargas} ventas={ventas} onClick={m.id==="1LZ"?()=>setPanelLavadoraZap(true):()=>setPanelSecadoraZap(true)}/>)}
          <div onClick={()=>setPanelEmpaquetadoZap(true)} style={{background:empaquetandoZap.length>0?"#f3e5f5":"#f8fbfd",border:`2px solid ${empaquetandoZap.length>0?"#ab47bc":"#e0e8f0"}`,borderRadius:10,padding:"8px 6px",textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:18}}>📦</div>
            <div style={{fontSize:11,fontWeight:700,color:"#1a3c5e",lineHeight:1.1}}>Empaquetado</div>
            <div style={{fontSize:9,color:empaquetandoZap.length>0?"#7b1fa2":"#888",fontWeight:700}}>{empaquetandoZap.length>0?`${empaquetandoZap.length} en curso`:"Libre"}</div>
            <div style={{fontSize:8,color:"#8d6e63",marginTop:2,fontWeight:700}}>👆 Ver detalle</div>
          </div>
        </div>

        {colaLavadoZap.length>0&&(
          <div style={{background:"#e8eaf6",border:"1.5px solid #5c6bc0",borderRadius:12,padding:12,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#3949ab",marginBottom:2}}>⬜ Pendientes por lavar ({totalesZapatos.porLavar} pares)</div>
            {cargaLavadoActiva1LZ&&<div style={{fontSize:11,color:"#1565c0",background:"#e3f2fd",borderRadius:8,padding:"6px 8px",margin:"6px 0"}}>💡 La 1LZ ya está lavando — puedes seguir marcando más y sumarlos al mismo lote.</div>}
            {colaLavadoZap.filter(coincideBusquedaProd).map(f=>(
              <label key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",cursor:"pointer"}}>
                <input type="checkbox" checked={!!selLavadoZap[f.folio]} onChange={e=>setSelLavadoZap({...selLavadoZap,[f.folio]:e.target.checked})}/>
                <span style={{fontSize:13,color:"#1a237e",flex:1}}>{f.cliente} · {f.folio}</span>
                <span style={{fontSize:11,color:"#3949ab",fontWeight:700}}>{paresDe(f.folio)} pares</span>
              </label>
            ))}
            {cargaLavadoActiva1LZ?(
              <button style={{...S.btnP,width:"100%",marginTop:8,background:"linear-gradient(135deg,#1565c0,#42a5f5)",opacity:Object.values(selLavadoZap).some(Boolean)?1:0.5}} disabled={!Object.values(selLavadoZap).some(Boolean)} onClick={iniciarAgregarALoteLavado}>➕ Agregar seleccionados al lavado en curso</button>
            ):(
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
                <input type="number" style={{...S.inp,width:80}} value={minLoteLav} onChange={e=>setMinLoteLav(e.target.value)} placeholder="min"/>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#5c6bc0,#7986cb)",opacity:Object.values(selLavadoZap).some(Boolean)?1:0.5}} disabled={!Object.values(selLavadoZap).some(Boolean)} onClick={iniciarLoteLavado}>🧺 Iniciar lavado con lo seleccionado</button>
              </div>
            )}
          </div>
        )}

        {colaCentrifugadoZap.length>0&&(
          <div style={{background:"#ede7f6",border:"1.5px solid #7986cb",borderRadius:12,padding:12,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#5c6bc0",marginBottom:6}}>✅ Lavados — esperando centrifugado ({totalesZapatos.esperandoCentrifugado} pares)</div>
            {colaCentrifugadoZap.filter(coincideBusquedaProd).map(f=>(
              <div key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px"}}>
                <input type="checkbox" checked={selCentrifugadoZap[f.folio]!==undefined} onChange={e=>{const c={...selCentrifugadoZap};if(e.target.checked)c[f.folio]=String(paresDe(f.folio)||1);else delete c[f.folio];setSelCentrifugadoZap(c);}}/>
                <span style={{fontSize:13,color:"#3730a3",flex:1}}>{f.cliente} · {f.folio}</span>
                {selCentrifugadoZap[f.folio]!==undefined&&<input type="number" min="1" style={{...S.inp,width:60,padding:"4px 8px"}} value={selCentrifugadoZap[f.folio]} onChange={e=>setSelCentrifugadoZap({...selCentrifugadoZap,[f.folio]:e.target.value})}/>}
              </div>
            ))}
            <div style={{fontSize:12,fontWeight:700,color:paresSeleccionadosCentrifugado>8?"#c62828":"#5c6bc0",marginTop:4}}>Seleccionado: {paresSeleccionadosCentrifugado} / 8 pares (máximo por tanda)</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
              <input type="number" style={{...S.inp,width:80}} value={minLoteCent} onChange={e=>setMinLoteCent(e.target.value)} placeholder="min"/>
              <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#7986cb,#5c6bc0)",opacity:(Object.keys(selCentrifugadoZap).length>0&&paresSeleccionadosCentrifugado<=8)?1:0.5}} disabled={Object.keys(selCentrifugadoZap).length===0||paresSeleccionadosCentrifugado>8} onClick={iniciarLoteCentrifugado}>🌀 Iniciar centrifugado (elige la máquina)</button>
            </div>
          </div>
        )}

        {colaSecadoZap.length>0&&(
          <div style={{background:"#e0f7fa",border:"1.5px solid #00acc1",borderRadius:12,padding:12,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#00838f",marginBottom:6}}>✅ Centrifugados — esperando secar, máx 20 pares ({totalesZapatos.esperandoSecado} pares)</div>
            {colaSecadoZap.filter(coincideBusquedaProd).map(f=>(
              <div key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px"}}>
                <input type="checkbox" checked={selSecadoZap[f.folio]!==undefined} onChange={e=>{const c={...selSecadoZap};if(e.target.checked)c[f.folio]=String(paresDe(f.folio)||1);else delete c[f.folio];setSelSecadoZap(c);}}/>
                <span style={{fontSize:13,color:"#006064",flex:1}}>{f.cliente} · {f.folio}</span>
                {selSecadoZap[f.folio]!==undefined&&<input type="number" min="1" style={{...S.inp,width:60,padding:"4px 8px"}} value={selSecadoZap[f.folio]} onChange={e=>setSelSecadoZap({...selSecadoZap,[f.folio]:e.target.value})}/>}
              </div>
            ))}
            <div style={{fontSize:12,fontWeight:700,color:paresSeleccionados>20?"#c62828":"#00838f",marginTop:4}}>Seleccionado: {paresSeleccionados} / 20 pares</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
              <input type="number" style={{...S.inp,width:80}} value={minLoteSec} onChange={e=>setMinLoteSec(e.target.value)} placeholder="min"/>
              <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#00838f,#26c6da)",opacity:(Object.keys(selSecadoZap).length>0&&paresSeleccionados<=20)?1:0.5}} disabled={Object.keys(selSecadoZap).length===0||paresSeleccionados>20} onClick={iniciarLoteSecado}>🔥 Iniciar secado</button>
            </div>
          </div>
        )}

        {colaEmpaquetarZap.length>0&&(
          <div style={{background:"#f3e5f5",border:"1.5px solid #ab47bc",borderRadius:12,padding:12,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#7b1fa2",marginBottom:6}}>📦 Ya se secaron — esperando empaquetar ({colaEmpaquetarZap.reduce((a,f)=>a+paresDe(f.folio),0)} pares)</div>
            {colaEmpaquetarZap.filter(coincideBusquedaProd).map(f=>(
              <label key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",cursor:"pointer"}}>
                <input type="checkbox" checked={!!selEmpaquetarZap[f.folio]} onChange={e=>setSelEmpaquetarZap({...selEmpaquetarZap,[f.folio]:e.target.checked})}/>
                <span style={{fontSize:13,color:"#4a148c",flex:1}}>{f.cliente} · {f.folio}</span>
                <span style={{fontSize:11,color:"#7b1fa2",fontWeight:700}}>{paresDe(f.folio)} pares</span>
              </label>
            ))}
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"linear-gradient(135deg,#7b1fa2,#ab47bc)",opacity:Object.values(selEmpaquetarZap).some(Boolean)?1:0.5}} disabled={!Object.values(selEmpaquetarZap).some(Boolean)} onClick={iniciarEmpaquetarSeleccionados}>📦 Iniciar empaquetado con lo seleccionado</button>
          </div>
        )}

        {(colaLavadoZap.length>0||colaCentrifugadoZap.length>0||colaSecadoZap.length>0||totalesZapatos.enLavado>0||totalesZapatos.enCentrifugado>0||totalesZapatos.enSecado>0)&&(
          <div style={{background:"#fdf6f0",border:"1.5px solid #8d6e63",borderRadius:12,padding:12,marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:800,color:"#5d4037",marginBottom:2}}>👟 Producción de zapatos</div>
            <div style={{fontSize:10,color:"#8d6e63",marginBottom:8}}>Toca un número para ver a qué cliente pertenece cada par.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {[
                ["porLavar","Por lavar",totalesZapatos.porLavar,"#8d6e63"],
                ["enLavado","En lavado",totalesZapatos.enLavado,"#5c6bc0"],
                ["esperandoCentrifugado","Esp. centrifugado",totalesZapatos.esperandoCentrifugado,"#8d6e63"],
                ["enCentrifugado","En centrifugado",totalesZapatos.enCentrifugado,"#7986cb"],
                ["esperandoSecado","Esp. secado",totalesZapatos.esperandoSecado,"#8d6e63"],
                ["enSecado","En secado",totalesZapatos.enSecado,"#00838f"],
              ].map(([key,lbl,val,color])=>(
                <button key={key} onClick={()=>setDetalleEstadoZap(detalleEstadoZap===key?null:key)} style={{background:detalleEstadoZap===key?"#fff8f0":"#fff",borderRadius:8,padding:"6px 4px",textAlign:"center",border:`1.5px solid ${color}`,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                  <div style={{fontWeight:800,fontSize:16,color}}>{val}</div>
                  <div style={{fontSize:9,color:"#5d4037"}}>{lbl}</div>
                </button>
              ))}
            </div>
            {detalleEstadoZap&&(
              <div style={{marginTop:10,background:"#fff",borderRadius:8,padding:"8px 10px",border:"1px solid #e8d9cf"}}>
                {detallesZapatos[detalleEstadoZap].length===0&&<div style={{fontSize:12,color:"#aaa"}}>Nadie en esta categoría ahora mismo.</div>}
                {detallesZapatos[detalleEstadoZap].map((d,i)=>(
                  <div key={d.folio+"_"+i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:i<detallesZapatos[detalleEstadoZap].length-1?"1px solid #f0f4f8":"none"}}>
                    <span style={{color:"#3e2723"}}>{d.cliente} <span style={{color:"#aaa",fontSize:11}}>({d.folio})</span></span>
                    <strong style={{color:"#8d6e63"}}>{d.pares} par{d.pares!==1?"es":""}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>
      );
    })()}

    {tabProd==="ropa"&&(<>
    <div style={{marginBottom:10}}>
      <input style={S.inp} placeholder="🔍 Buscar cliente por nombre..." value={buscarClienteProd} onChange={e=>setBuscarClienteProd(e.target.value)}/>
    </div>
    <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:6}}>📋 ÓRDENES EN PRODUCCIÓN</div>
    {activos.filter(v=>perteneceRopa(v)&&(v.clienteNombre||"").toLowerCase().includes(buscarClienteProd.trim().toLowerCase())).length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:48,marginBottom:8}}>🏭</div><div>{buscarClienteProd.trim()?`Ningún cliente coincide con "${buscarClienteProd}"`:"No hay órdenes en producción ahora mismo"}</div></div>}
    {activos.filter(v=>perteneceRopa(v)&&(v.clienteNombre||"").toLowerCase().includes(buscarClienteProd.trim().toLowerCase())).map(v=>{
      const maquinaDe=id=>maquinas.find(m=>m.id===id);
      const buscarEventoG=(folio,etapa,grupo)=>eventosDe(folio).filter(ev=>ev.etapa===etapa&&gruposEquivalentes(grupo).includes(ev.grupo||null)).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0];
      const esZapato=lbl=>/ZAPATO|PARES?\b|TENIS|CALZADO|BOTAS?\b|SANDALIA|ZAPATILLA|MOCAS[IÍ]N|SNEAKER|TAC[OÓ]N/i.test(lbl||"");
      const tieneZapato=(v.items||[]).some(it=>esZapato(it.label));
      const tieneOtro=(v.items||[]).some(it=>!esZapato(it.label));
      const puedeDividir=!v.prodGrupos&&tieneZapato&&tieneOtro;
      const soloZapatos=!v.prodGrupos&&tieneZapato&&!tieneOtro;
      const grupos=v.prodGrupos&&v.prodGrupos.length?v.prodGrupos:[soloZapatos?"zapatos":null];

      // 🔁 Un "flujo" completo (lavado→centrifugado→secado→doblado) para un grupo (o null si la orden no está dividida)
      const perteneceCarga=c=>c.ventaFolio===v.folio||(c.ventaFolios||[]).includes(v.folio);
      const renderFlujo=(grupo,etiqueta)=>{
        const lavCargasAll=cargas.filter(c=>perteneceCarga(c)&&c.tipo==="lavado"&&gruposEquivalentes(grupo).includes(c.grupo||null));
        const cLavUltimo=lavCargasAll.sort((a,b)=>new Date(b.inicio)-new Date(a.inicio))[0];
        const cicloLav=cLavUltimo?.ciclo;
        const lavCiclo=cicloLav?lavCargasAll.filter(c=>c.ciclo===cicloLav):[];
        const lavActivas=lavCiclo.filter(c=>!c.finReal);
        const lavTerminadoCiclo=lavCiclo.length>0&&lavActivas.length===0;

        const cCen=cargas.filter(c=>perteneceCarga(c)&&c.tipo==="centrifugado"&&gruposEquivalentes(grupo).includes(c.grupo||null)&&(!cLavUltimo||new Date(c.inicio)>=new Date(cLavUltimo.inicio))).sort((a,b)=>new Date(b.inicio)-new Date(a.inicio))[0];

        const secCargasAll=cargas.filter(c=>perteneceCarga(c)&&c.tipo==="secado"&&gruposEquivalentes(grupo).includes(c.grupo||null)&&(!cLavUltimo||new Date(c.inicio)>=new Date(cLavUltimo.inicio)));
        const cSecUltimo=secCargasAll.sort((a,b)=>new Date(b.inicio)-new Date(a.inicio))[0];
        const cicloSec=cSecUltimo?.ciclo;
        const secCiclo=cicloSec?secCargasAll.filter(c=>c.ciclo===cicloSec):[];
        const secActivas=secCiclo.filter(c=>!c.finReal);
        const secTerminadoCiclo=secCiclo.length>0&&secActivas.length===0;

        const evDobInicio=buscarEventoG(v.folio,"doblado_inicio",grupo);
        const evDobFin=buscarEventoG(v.folio,"doblado_fin",grupo);
        const esZap=grupo==="zapatos";
        const lblDoblado=esZap?"empaquetado":"doblado";
        let etapaG="Recibido",colorG="#f59e0b";
        if(lavActivas.length>0){etapaG=`Lavando${lavActivas.length>1?` (${lavActivas.length} máquinas)`:""}`;colorG="#1565c0";}
        else if(cCen&&!cCen.finReal){etapaG="Centrifugando";colorG="#5c6bc0";}
        else if(lavTerminadoCiclo&&!cCen&&secCiclo.length===0){etapaG="Esperando secadora";colorG="#f59e0b";}
        else if(secActivas.length>0){etapaG=`Secando${secActivas.length>1?` (${secActivas.length} máquinas)`:""}`;colorG="#00838f";}
        else if(secTerminadoCiclo&&!evDobInicio){etapaG=esZap?"Esperando empaquetado":"Esperando doblado";colorG="#f59e0b";}
        else if(evDobInicio&&!evDobFin){etapaG=esZap?"Empaquetando":"Doblando";colorG="#7b1fa2";}
        else if(evDobFin){etapaG=esZap?"✅ Empaquetado":"✅ Doblado";colorG="#2e7d32";}

        const comentariosLav=lavCiclo.filter(c=>c.comentario);
        const comentariosSec=secCiclo.filter(c=>c.comentario);

        return(
          <div key={grupo||"solo"} style={grupo?{background:"#f8fbfd",borderRadius:10,padding:10,marginTop:10,border:"1px solid #e8f0f7"}:null}>
            {etiqueta&&<div style={{fontSize:12,fontWeight:800,color:"#1a3c5e",marginBottom:4}}>{etiqueta}</div>}
            <div style={{fontSize:12,color:colorG,fontWeight:700}}>{etapaG}</div>

            {lavCiclo.length===0&&!esZap&&(
              <button style={{...S.btnP,marginTop:8}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"lavadora",grupo})}>🧺 Iniciar lavado</button>
            )}

            {lavActivas.map(c=>(
              <div key={c.id} style={{marginTop:8,paddingTop:8,borderTop:lavActivas.indexOf(c)>0?"1px dashed #e0e8f0":"none"}}>
                <div style={{fontSize:11,color:"#888"}}>🧺 {maquinaDe(c.maquinaId)?.nombre||c.maquinaId} · {c.minutosProgramados} min · inició {nombreDe(c.empleadaId)}</div>
                <div style={{fontSize:20,textAlign:"center",margin:"4px 0",fontFamily:"monospace"}}><CuentaRegresiva finProgramado={c.finProgramado}/></div>
                <button style={{...S.btnP,background:"linear-gradient(135deg,#1565c0,#42a5f5)"}} onClick={()=>setPinFor({folio:v.folio,accion:"retirar_lavado",label:"¿Quién retira de la lavadora?",extra:{carga:c}})}>📤 Retirar de {maquinaDe(c.maquinaId)?.nombre||"lavadora"}</button>
              </div>
            ))}

            {lavCiclo.length>0&&!cCen&&secCiclo.length===0&&(
              <button style={{...S.btnS,marginTop:8,width:"100%",background:"#e3f2fd",color:"#1565c0"}} onClick={()=>setClasifExtraFor({folio:v.folio,siguientePicker:{folio:v.folio,tipoMaquina:"lavadora",grupo,ciclo:cicloLav}})}>➕ Agregar otra lavadora (carga grande) — revisar bolsillos</button>
            )}

            {lavTerminadoCiclo&&!cCen&&secCiclo.length===0&&!esZap&&(
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#00838f,#26c6da)"}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"secadora",grupo})}>🔥 Iniciar secado</button>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#5c6bc0,#7986cb)"}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"lavadora",centrifugado:true,grupo})}>🌀 Centrifugar</button>
              </div>
            )}

            {cCen&&!cCen.finReal&&(
              <>
                <div style={{fontSize:11,color:"#888",marginTop:8}}>🌀 {maquinaDe(cCen.maquinaId)?.nombre||cCen.maquinaId} · {cCen.minutosProgramados} min · inició {nombreDe(cCen.empleadaId)}</div>
                <div style={{fontSize:20,textAlign:"center",margin:"6px 0",fontFamily:"monospace"}}><CuentaRegresiva finProgramado={cCen.finProgramado}/></div>
                <button style={{...S.btnP,background:"linear-gradient(135deg,#5c6bc0,#7986cb)"}} onClick={()=>setPinFor({folio:v.folio,accion:"retirar_centrifugado",label:"¿Quién retira del centrifugado?",extra:{carga:cCen}})}>📤 Retirar de centrifugado</button>
              </>
            )}
            {cCen?.finReal&&secCiclo.length===0&&!esZap&&(
              <button style={{...S.btnP,marginTop:8,background:"linear-gradient(135deg,#00838f,#26c6da)"}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"secadora",grupo})}>🔥 Iniciar secado</button>
            )}

            {secActivas.map(c=>(
              <div key={c.id} style={{marginTop:8,paddingTop:8,borderTop:secActivas.indexOf(c)>0?"1px dashed #e0e8f0":"none"}}>
                <div style={{fontSize:11,color:"#888"}}>🔥 {maquinaDe(c.maquinaId)?.nombre||c.maquinaId} · {c.minutosProgramados} min · inició {nombreDe(c.empleadaId)}</div>
                <div style={{fontSize:20,textAlign:"center",margin:"4px 0",fontFamily:"monospace"}}><CuentaRegresiva finProgramado={c.finProgramado}/></div>
                <button style={{...S.btnP,background:"linear-gradient(135deg,#00838f,#26c6da)"}} onClick={()=>setPinFor({folio:v.folio,accion:"retirar_secado",label:"¿Quién retira de la secadora?",extra:{carga:c}})}>📤 Retirar de {maquinaDe(c.maquinaId)?.nombre||"secadora"}</button>
              </div>
            ))}

            {secCiclo.length>0&&!evDobInicio&&(
              <button style={{...S.btnS,marginTop:8,width:"100%",background:"#e0f7fa",color:"#00838f"}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"secadora",grupo,ciclo:cicloSec})}>➕ Agregar otra secadora (carga grande)</button>
            )}

            {secTerminadoCiclo&&!evDobInicio&&!esZap&&(
              <button style={{...S.btnP,marginTop:8,background:"linear-gradient(135deg,#7b1fa2,#9c27b0)"}} onClick={()=>setPinFor({folio:v.folio,accion:"doblado_inicio",label:"¿Quién inicia el doblado?",extra:{grupo}})}>🪄 Iniciar doblado</button>
            )}
            {evDobInicio&&!evDobFin&&(
              <>
                <div style={{fontSize:11,color:"#888",marginTop:8}}>{esZap?"📦 Empaquetando":"🪄 Doblando"} desde las {new Date(evDobInicio.timestamp).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} por {nombreDe(evDobInicio.empleadaId)}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#7b1fa2",textAlign:"center",margin:"8px 0",fontFamily:"monospace"}}><Cronometro desde={evDobInicio.timestamp}/></div>
                <button style={{...S.btnP,background:"linear-gradient(135deg,#2e7d32,#4caf50)"}} onClick={()=>setPinFor({folio:v.folio,accion:"doblado_fin",label:esZap?"¿Quién termina el empaquetado?":"¿Quién termina el doblado?",extra:{grupo}})}>{esZap?"✅ Terminar empaquetado":"✅ Terminar doblado"}</button>
              </>
            )}
            {evDobFin&&(
              <div style={{fontSize:12,color:"#2e7d32",fontWeight:700,marginTop:8}}>{esZap?"✅ Empaquetado":"✅ Doblado"} por {nombreDe(evDobFin.empleadaId)} en {Math.round((new Date(evDobFin.timestamp)-new Date(evDobInicio.timestamp))/60000)} min</div>
            )}
            {(comentariosLav.length>0||comentariosSec.length>0||cCen?.comentario)&&(
              <div style={{fontSize:11,color:"#e65100",background:"#fff3e0",borderRadius:8,padding:"6px 8px",marginTop:8}}>
                {comentariosLav.map(c=>c.esRepeticion&&<div key={c.id}>🔁 Se repitió el lavado — {c.comentario}</div>)}
                {comentariosSec.map(c=>c.esRepeticion&&<div key={c.id}>🔁 Se repitió el secado — {c.comentario}</div>)}
                {cCen?.comentario&&<div>🌀 Centrifugado — {cCen.comentario}</div>}
              </div>
            )}
            {lavTerminadoCiclo&&secActivas.length===0&&(
              <button style={{...S.btnS,marginTop:8,width:"100%",background:"#fff3e0",color:"#e65100",fontSize:12}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"lavadora",repetir:true,grupo})}>🔁 Lavar de nuevo</button>
            )}
            {secTerminadoCiclo&&(v.estado||"recibido")!=="listo"&&(v.estado||"recibido")!=="entregado"&&(
              <button style={{...S.btnS,marginTop:8,width:"100%",background:"#fff3e0",color:"#e65100",fontSize:12}} onClick={()=>setPickerFor({folio:v.folio,tipoMaquina:"secadora",repetir:true,grupo})}>🔁 Secar de nuevo{evDobInicio?" (algo salió húmedo)":""}</button>
            )}
          </div>
        );
      };

      const todosListos=grupos.every(g=>buscarEventoG(v.folio,"doblado_fin",g));
      let etapaResumen;
      if(todosListos)etapaResumen="🔔 Falta marcar Listo";
      else if(v.prodGrupos){
        const faltantes=grupos.filter(g=>!buscarEventoG(v.folio,"doblado_fin",g));
        etapaResumen=faltantes.length===grupos.length
          ?"Dividida en grupos"
          :"⏳ Falta "+faltantes.map(g=>g==="zapatos"?"zapatos":"ropa").join(" y ");
      }else etapaResumen="En producción";

      return(
        <div key={v.folio} style={{...S.vcard,borderLeft:`4px solid ${todosListos?"#2e7d32":"#4db6e4"}`}}>
          <div style={{fontWeight:700,fontSize:15}}>{v.clienteNombre}</div>
          <div style={{fontSize:11,color:"#888"}}>{v.folio}</div>
          <div style={{fontSize:12,color:todosListos?"#2e7d32":etapaResumen.startsWith("⏳")?"#e65100":"#4db6e4",fontWeight:700,marginTop:2}}>{etapaResumen}</div>
          <div style={{fontSize:12,color:"#666",marginTop:6}}>{(v.items||[]).map(it=>it.label).join(" · ")}</div>

          {!v.clasificacion&&!soloZapatos?(
            <button style={{...S.btnP,marginTop:10,background:"linear-gradient(135deg,#e65100,#ff9800)"}} onClick={()=>setClasifFor({folio:v.folio})}>🔍 Revisar prendas antes de lavar</button>
          ):!v.clasificacion&&soloZapatos?(
            <div style={{fontSize:11,color:"#888",background:"#f0f4f8",borderRadius:8,padding:"6px 8px",marginTop:8}}>👟 Es una orden solo de zapatos — no necesita revisión de bolsillos, ya se revisó en recepción.</div>
          ):(
            <>
              <div style={{fontSize:11,color:"#2e7d32",background:"#e8f5e9",borderRadius:8,padding:"6px 8px",marginTop:8,fontWeight:600}}>
                ✅ Revisado por {nombreDe(v.clasificacion.empleadaId)}
                {(v.revisionesExtra||[]).length>0&&<div style={{color:"#1565c0",fontWeight:600}}>🔍 +{v.revisionesExtra.length} revisión(es) de carga adicional{v.revisionesExtra.some(r=>r.manchasDetectadas||r.objetosEncontrados)?" (con hallazgos)":""}</div>}
                {v.clasificacion.objetosEncontrados&&<div>🔑 Se encontró: {v.clasificacion.objetosEncontrados}</div>}
                {v.clasificacion.manchasDetectadas&&<div>🟤 Tiene manchas</div>}
                {v.clasificacion.requiereRestregado&&(()=>{
                  const rEstado=v.clasificacion.restregadoEstado;
                  return(<div style={{marginTop:4}}>
                    <div>🧽 Restregado extra: ${v.clasificacion.restregadoCosto?.toFixed(2)}</div>
                    {!rEstado&&<a href="#" onClick={e=>{e.preventDefault();avisarRestregado(v);}} style={{color:"#1565c0",fontWeight:700}}>💬 Avisar al cliente</a>}
                    {rEstado==="pendiente_confirmar"&&(
                      <div style={{marginTop:4}}>
                        <div style={{color:"#e65100",fontWeight:700}}>⏳ Esperando respuesta del cliente</div>
                        <div style={{display:"flex",gap:6,marginTop:4}}>
                          <button style={{...S.btnS,fontSize:11,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>confirmarRestregado(v,true)}>✅ Cliente autorizó</button>
                          <button style={{...S.btnS,fontSize:11,background:"#ffebee",color:"#c62828"}} onClick={()=>confirmarRestregado(v,false)}>❌ Cliente rechazó</button>
                        </div>
                      </div>
                    )}
                    {rEstado==="autorizado"&&<div style={{color:"#2e7d32",fontWeight:700,marginTop:2}}>✅ Autorizado — se sumó ${v.clasificacion.restregadoCosto?.toFixed(2)} a la orden</div>}
                    {rEstado==="rechazado"&&<div style={{color:"#c62828",fontWeight:700,marginTop:2}}>❌ Rechazado — quedó en observaciones de la orden</div>}
                  </div>);
                })()}
                {(v.clasificacion.serviciosAdicionales||[]).length>0&&(()=>{
                  const sinAvisar=(v.clasificacion.serviciosAdicionales||[]).filter(s=>!s.estado);
                  return(<div style={{marginTop:6}}>
                    <div style={{fontWeight:700}}>🧾 Servicios adicionales encontrados:</div>
                    {v.clasificacion.serviciosAdicionales.map(s=>(
                      <div key={s.id} style={{marginTop:3,marginLeft:6}}>
                        <div>• {s.descripcion}: ${s.costo.toFixed(2)}</div>
                        {s.estado==="pendiente_confirmar"&&(
                          <div style={{marginTop:2}}>
                            <div style={{color:"#e65100",fontWeight:700}}>⏳ Esperando respuesta del cliente</div>
                            <div style={{display:"flex",gap:6,marginTop:2}}>
                              <button style={{...S.btnS,fontSize:11,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>confirmarServicioAdicional(v,s.id,true)}>✅ Autorizó</button>
                              <button style={{...S.btnS,fontSize:11,background:"#ffebee",color:"#c62828"}} onClick={()=>confirmarServicioAdicional(v,s.id,false)}>❌ Rechazó</button>
                            </div>
                          </div>
                        )}
                        {s.estado==="autorizado"&&<div style={{color:"#2e7d32",fontWeight:700}}>✅ Autorizado — se sumó a la orden</div>}
                        {s.estado==="rechazado"&&<div style={{color:"#c62828",fontWeight:700}}>❌ Rechazado — quedó en observaciones</div>}
                      </div>
                    ))}
                    {sinAvisar.length>0&&<a href="#" onClick={e=>{e.preventDefault();avisarServiciosAdicionales(v);}} style={{color:"#1565c0",fontWeight:700,display:"inline-block",marginTop:4}}>💬 Avisar al cliente ({sinAvisar.length})</a>}
                  </div>);
                })()}
              </div>

              {puedeDividir&&(
                <button style={{...S.btnS,marginTop:8,width:"100%",background:"#e8f5fd",color:"#1565c0"}} onClick={()=>dividirGrupos(v.folio,["ropa","zapatos"])}>✂️ Dividir en Ropa y Zapatos</button>
              )}

              {grupos.filter(g=>tabProd==="todos"||(tabProd==="zapatos"?g==="zapatos":g!=="zapatos")).map(g=>renderFlujo(g,v.prodGrupos?(g==="ropa"?"👕 ROPA":"👟 ZAPATOS"):null))}

              {todosListos&&(
                <button style={{...S.btnP,marginTop:10,background:"linear-gradient(135deg,#2e7d32,#66bb6a)"}} onClick={()=>setPinFor({folio:v.folio,accion:"confirmar_listo",label:"¿Quién confirma que ya está Listo para retirar?"})}>🔔 Confirmar Listo para retirar</button>
              )}
            </>
          )}
        </div>
      );
    })}
    </>)}

    {clasifFor&&<ClasificacionModal onConfirmar={onClasifConfirm} onCancelar={()=>setClasifFor(null)}/>}
    {clasifExtraFor&&<ClasificacionModal onConfirmar={onClasifConfirm} onCancelar={()=>setClasifExtraFor(null)}/>}
    {pickerFor&&<MachinePicker maquinas={maquinas} tipoMaquina={pickerFor.tipoMaquina} tiempoSugerido={pickerFor.lote?(pickerFor.lote.tipo==="lavado"?parseInt(minLoteLav)||45:pickerFor.lote.tipo==="centrifugado"?parseInt(minLoteCent)||15:parseInt(minLoteSec)||45):45} repetir={!!pickerFor.repetir} grupo={pickerFor.grupo} centrifugado={!!pickerFor.centrifugado} onConfirmar={onPickerConfirm} onCancelar={()=>setPickerFor(null)}/>}
    {pinFor&&<PinModal pins={pins} empleadas={empleadas} titulo={pinFor.label} onConfirm={onPinOk} onCancelar={()=>setPinFor(null)}/>}

    {panelLavadoraZap&&(()=>{
      const maquinaDe=id=>maquinas.find(m=>m.id===id);
      const lavandoAhora=cargasZapActivas("lavado");
      const centrifugandoAhora=cargasZapActivas("centrifugado");
      return(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:420,maxHeight:"88vh",overflowY:"auto",padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#1a3c5e"}}>👟🧺 Lavadora de zapatos (1LZ)</div>
              <button onClick={()=>setPanelLavadoraZap(false)} style={{background:"#f0f4f8",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#8d6e63",marginBottom:12}}>No tiene límite de pares — puedes lavar todos los que tengas acumulados en un mismo lote.</div>

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginBottom:6}}>🔵 Lavando ahora</div>
            {lavandoAhora.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Ninguna carga en curso.</div>}
            {lavandoAhora.map(c=>(
              <div key={c.id} style={{...S.vcard,padding:"8px 10px",marginBottom:6}}>
                <div style={{fontSize:12,color:"#5d4037"}}>{maquinaDe(c.maquinaId)?.nombre||c.maquinaId} · {paresEnCarga(c)} pares</div>
                <div style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:"#5c6bc0"}}><CuentaRegresiva finProgramado={c.finProgramado}/></div>
                <button style={{...S.btnS,width:"100%",marginTop:6,background:"#e3f2fd",color:"#1565c0"}} onClick={()=>setPinFor({folio:null,accion:"retirar_lavado",label:"¿Quién retira este lavado?",extra:{carga:c}})}>📤 Retirar — ya está listo para centrifugar</button>
              </div>
            ))}

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginTop:10,marginBottom:6}}>⬜ Pendientes por lavar ({totalesZapatos.porLavar} pares)</div>
            {cargaLavadoActiva1LZ&&<div style={{fontSize:11,color:"#1565c0",background:"#e3f2fd",borderRadius:8,padding:"6px 8px",marginBottom:8}}>💡 La 1LZ ya está lavando, pero puedes seguir marcando más y sumarlos al mismo lote — no hace falta esperar a que termine.</div>}
            {colaLavadoZap.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Nada pendiente.</div>}
            {colaLavadoZap.map(f=>(
              <label key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",cursor:"pointer"}}>
                <input type="checkbox" checked={!!selLavadoZap[f.folio]} onChange={e=>setSelLavadoZap({...selLavadoZap,[f.folio]:e.target.checked})}/>
                <span style={{fontSize:13,color:"#3e2723",flex:1}}>{f.cliente} · {f.folio}</span>
                <span style={{fontSize:11,color:"#8d6e63",fontWeight:700}}>{paresDe(f.folio)} pares</span>
              </label>
            ))}
            {colaLavadoZap.length>0&&cargaLavadoActiva1LZ&&(
              <div style={{marginTop:8,marginBottom:14}}>
                <button style={{...S.btnP,width:"100%",background:"linear-gradient(135deg,#1565c0,#42a5f5)",opacity:Object.values(selLavadoZap).some(Boolean)?1:0.5}} disabled={!Object.values(selLavadoZap).some(Boolean)} onClick={()=>{iniciarAgregarALoteLavado();setPanelLavadoraZap(false);}}>➕ Agregar seleccionados al lavado en curso</button>
              </div>
            )}
            {colaLavadoZap.length>0&&!cargaLavadoActiva1LZ&&(
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,marginBottom:14}}>
                <input type="number" style={{...S.inp,width:80}} value={minLoteLav} onChange={e=>setMinLoteLav(e.target.value)} placeholder="min"/>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#5c6bc0,#7986cb)",opacity:Object.values(selLavadoZap).some(Boolean)?1:0.5}} disabled={!Object.values(selLavadoZap).some(Boolean)} onClick={()=>{iniciarLoteLavado();setPanelLavadoraZap(false);}}>🧺 Lavar seleccionados en lote</button>
              </div>
            )}

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginBottom:6}}>🌀 Centrifugando ahora</div>
            {centrifugandoAhora.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Ninguna carga en curso.</div>}
            {centrifugandoAhora.map(c=>(
              <div key={c.id} style={{...S.vcard,padding:"8px 10px",marginBottom:6}}>
                <div style={{fontSize:12,color:"#5d4037"}}>{maquinaDe(c.maquinaId)?.nombre||c.maquinaId} · {paresEnCarga(c)} pares</div>
                <div style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:"#7986cb"}}><CuentaRegresiva finProgramado={c.finProgramado}/></div>
                <button style={{...S.btnS,width:"100%",marginTop:6,background:"#ede7f6",color:"#5c6bc0"}} onClick={()=>setPinFor({folio:null,accion:"retirar_centrifugado",label:"¿Quién retira este centrifugado?",extra:{carga:c}})}>📤 Retirar — pasa a esperar secado</button>
              </div>
            ))}

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginTop:10,marginBottom:6}}>✅ Lavados — esperando centrifugado ({totalesZapatos.esperandoCentrifugado} pares)</div>
            {colaCentrifugadoZap.length===0&&<div style={{fontSize:12,color:"#aaa"}}>Nada esperando.</div>}
            {colaCentrifugadoZap.map(f=>(
              <div key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px"}}>
                <input type="checkbox" checked={selCentrifugadoZap[f.folio]!==undefined} onChange={e=>{const c={...selCentrifugadoZap};if(e.target.checked)c[f.folio]=String(paresDe(f.folio)||1);else delete c[f.folio];setSelCentrifugadoZap(c);}}/>
                <span style={{fontSize:13,color:"#3e2723",flex:1}}>{f.cliente} · {f.folio}</span>
                {selCentrifugadoZap[f.folio]!==undefined&&<input type="number" min="1" style={{...S.inp,width:60,padding:"4px 8px"}} value={selCentrifugadoZap[f.folio]} onChange={e=>setSelCentrifugadoZap({...selCentrifugadoZap,[f.folio]:e.target.value})}/>}
              </div>
            ))}
            {colaCentrifugadoZap.length>0&&(<>
              <div style={{fontSize:12,fontWeight:700,color:paresSeleccionadosCentrifugado>8?"#c62828":"#5d4037",marginTop:4}}>Seleccionado: {paresSeleccionadosCentrifugado} / 8 pares (máximo por tanda de centrifugado)</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
                <input type="number" style={{...S.inp,width:80}} value={minLoteCent} onChange={e=>setMinLoteCent(e.target.value)} placeholder="min"/>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#7986cb,#5c6bc0)",opacity:(Object.keys(selCentrifugadoZap).length>0&&paresSeleccionadosCentrifugado<=8)?1:0.5}} disabled={Object.keys(selCentrifugadoZap).length===0||paresSeleccionadosCentrifugado>8} onClick={()=>{iniciarLoteCentrifugado();setPanelLavadoraZap(false);}}>🌀 Centrifugar seleccionados (elige la máquina)</button>
              </div>
            </>)}
          </div>
        </div>
      );
    })()}

    {panelSecadoraZap&&(()=>{
      const maquinaDe=id=>maquinas.find(m=>m.id===id);
      const secandoAhora=cargasZapActivas("secado");
      return(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:420,maxHeight:"88vh",overflowY:"auto",padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#1a3c5e"}}>👟🔥 Secadora de zapatos (1SZ)</div>
              <button onClick={()=>setPanelSecadoraZap(false)} style={{background:"#f0f4f8",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#8d6e63",marginBottom:12}}>Máximo 20 pares por tanda.</div>

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginBottom:6}}>🔵 Secando ahora</div>
            {secandoAhora.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Ninguna carga en curso.</div>}
            {secandoAhora.map(c=>(
              <div key={c.id} style={{...S.vcard,padding:"8px 10px",marginBottom:6}}>
                <div style={{fontSize:12,color:"#5d4037"}}>{maquinaDe(c.maquinaId)?.nombre||c.maquinaId} · {paresEnCarga(c)} pares</div>
                <div style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:"#00838f"}}><CuentaRegresiva finProgramado={c.finProgramado}/></div>
                <button style={{...S.btnS,width:"100%",marginTop:6,background:"#e0f7fa",color:"#00838f"}} onClick={()=>setPinFor({folio:null,accion:"retirar_secado",label:"¿Quién retira este secado?",extra:{carga:c}})}>📤 Retirar — listo para empaquetar</button>
              </div>
            ))}

            <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginTop:10,marginBottom:6}}>✅ Ya centrifugados — esperando secar ({totalesZapatos.esperandoSecado} pares)</div>
            {colaSecadoZap.length===0&&<div style={{fontSize:12,color:"#aaa"}}>Nada esperando.</div>}
            {colaSecadoZap.map(f=>(
              <div key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px"}}>
                <input type="checkbox" checked={!!selSecadoZap[f.folio]} onChange={e=>{const c={...selSecadoZap};if(e.target.checked)c[f.folio]=String(paresDe(f.folio)||1);else delete c[f.folio];setSelSecadoZap(c);}}/>
                <span style={{fontSize:13,color:"#3e2723",flex:1}}>{f.cliente} · {f.folio}</span>
                {selSecadoZap[f.folio]!==undefined&&<input type="number" min="1" style={{...S.inp,width:60,padding:"4px 8px"}} value={selSecadoZap[f.folio]} onChange={e=>setSelSecadoZap({...selSecadoZap,[f.folio]:e.target.value})}/>}
              </div>
            ))}
            {colaSecadoZap.length>0&&(<>
              <div style={{fontSize:12,fontWeight:700,color:paresSeleccionados>20?"#c62828":"#5d4037",marginTop:4}}>Seleccionado: {paresSeleccionados} / 20 pares</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
                <input type="number" style={{...S.inp,width:80}} value={minLoteSec} onChange={e=>setMinLoteSec(e.target.value)} placeholder="min"/>
                <button style={{...S.btnP,flex:1,background:"linear-gradient(135deg,#00838f,#26c6da)",opacity:(Object.keys(selSecadoZap).length>0&&paresSeleccionados<=20)?1:0.5}} disabled={Object.keys(selSecadoZap).length===0||paresSeleccionados>20} onClick={()=>{iniciarLoteSecado();setPanelSecadoraZap(false);}}>🔥 Iniciar secado con lo seleccionado</button>
              </div>
            </>)}
          </div>
        </div>
      );
    })()}

    {panelEmpaquetadoZap&&(
      <div style={S.ov}>
        <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:420,maxHeight:"88vh",overflowY:"auto",padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#1a3c5e"}}>👟📦 Empaquetado de zapatos</div>
            <button onClick={()=>setPanelEmpaquetadoZap(false)} style={{background:"#f0f4f8",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13}}>✕</button>
          </div>

          {listoParaConfirmarZap.length>0&&(
            <div style={{background:"#e8f5e9",border:"1.5px solid #2e7d32",borderRadius:10,padding:10,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:800,color:"#2e7d32",marginBottom:6}}>🔔 Empaquetadas — falta confirmar Listo para retirar ({listoParaConfirmarZap.length})</div>
              {listoParaConfirmarZap.map(f=>(
                <div key={f.folio} style={{...S.vcard,padding:"8px 10px",marginBottom:6,borderLeft:"4px solid #2e7d32"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#1b5e20"}}>{f.cliente} · {f.folio}</div>
                  <div style={{fontSize:11,color:"#888"}}>{paresDe(f.folio)} pares</div>
                  <button style={{...S.btnP,width:"100%",marginTop:6,background:"linear-gradient(135deg,#2e7d32,#66bb6a)"}} onClick={()=>setPinFor({folio:f.folio,accion:"confirmar_listo",label:"¿Quién confirma que ya está Listo para retirar?"})}>🔔 Confirmar Listo para retirar</button>
                </div>
              ))}
            </div>
          )}

          <div style={{fontSize:12,fontWeight:800,color:"#7b1fa2",marginBottom:6}}>📦 Empaquetando ahora ({empaquetandoZap.length})</div>
          {empaquetandoZap.length===0&&<div style={{fontSize:12,color:"#aaa",marginBottom:10}}>Nadie empaquetando en este momento.</div>}
          {empaquetandoZap.map(f=>(
            <div key={f.folio} style={{...S.vcard,padding:"8px 10px",marginBottom:6,borderLeft:"4px solid #ab47bc"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#4a148c"}}>{f.cliente} · {f.folio}</div>
              <div style={{fontSize:11,color:"#888"}}>{paresDe(f.folio)} pares · Desde las {new Date(f.inicio.timestamp).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})} · {nombreDe(f.inicio.empleadaId)}</div>
              <button style={{...S.btnS,width:"100%",marginTop:6,background:"#f3e5f5",color:"#7b1fa2"}} onClick={()=>setPinFor({folio:f.folio,accion:"doblado_fin",label:"¿Quién termina el empaquetado?",extra:{grupo:f.grupo}})}>✅ Terminar empaquetado</button>
            </div>
          ))}

          <div style={{fontSize:12,fontWeight:800,color:"#5d4037",marginTop:10,marginBottom:6}}>⬜ Esperando empaquetar ({colaEmpaquetarZap.reduce((a,f)=>a+paresDe(f.folio),0)} pares)</div>
          {colaEmpaquetarZap.length===0&&<div style={{fontSize:12,color:"#aaa"}}>Nada esperando.</div>}
          {colaEmpaquetarZap.map(f=>(
            <label key={f.folio} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",cursor:"pointer"}}>
              <input type="checkbox" checked={!!selEmpaquetarZap[f.folio]} onChange={e=>setSelEmpaquetarZap({...selEmpaquetarZap,[f.folio]:e.target.checked})}/>
              <span style={{fontSize:13,color:"#3e2723",flex:1}}>{f.cliente} · {f.folio}</span>
              <span style={{fontSize:11,color:"#7b1fa2",fontWeight:700}}>{paresDe(f.folio)} pares</span>
            </label>
          ))}
          {colaEmpaquetarZap.length>0&&(
            <button style={{...S.btnP,width:"100%",marginTop:8,background:"linear-gradient(135deg,#7b1fa2,#ab47bc)",opacity:Object.values(selEmpaquetarZap).some(Boolean)?1:0.5}} disabled={!Object.values(selEmpaquetarZap).some(Boolean)} onClick={()=>{iniciarEmpaquetarSeleccionados();setPanelEmpaquetadoZap(false);}}>📦 Iniciar empaquetado con lo seleccionado</button>
          )}
        </div>
      </div>
    )}
  </div>);
}

function MisIncentivos({ventas,empleadas,sesion,cfgInc,ventasPerfumeReg,setVentasPerfumeReg,upsertVentaPerfume}){
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
  // 🔧 Mi registro real de empleada (el login/usuario y el registro de empleada usan IDs distintos, por eso se resuelve por nombre)
  const miEmpleada=empleadas.find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||empleadas.find(e=>normNombre(e.nombre)&&(normNombre(sesion?.nombre).includes(normNombre(e.nombre))||normNombre(e.nombre).includes(normNombre(sesion?.nombre))))
    ||empleadas.find(e=>{
        const enom=normNombre(e.nombre).split(" ")[0];
        const snom=normNombre(sesion?.nombre).split(" ")[0];
        return enom&&snom&&enom===snom;
      });
  const miId=miEmpleada?miEmpleada.id:null; // 🔒 sin match seguro, no atribuir impulsaciones a la persona equivocada
  // 🧴 Mis ventas de perfume registradas manualmente este mes (solo cuentan las que YO registro con el botón, no automático)
  const misPerfumesMes=(ventasPerfumeReg||[]).filter(r=>String(r.empleadaId)===String(miId)&&mesK(new Date(r.fecha))===mesAct);
  const comisionPerfume=cfgInc.comisionPerfume||0;
  const miGananciaPerfumes=misPerfumesMes.length*comisionPerfume;
  const registrarVentaPerfume=()=>{
    if(!miId){alert("No se pudo identificar tu perfil de empleada — avísale a la administradora.");return;}
    const reg={id:"pf_"+Date.now(),empleadaId:miId,empleadaNombre:miEmpleada?.nombre||sesion?.nombre,fecha:new Date().toISOString()};
    setVentasPerfumeReg(prev=>[reg,...prev]);
    if(upsertVentaPerfume)upsertVentaPerfume(reg);
  };
  // Mis impulsaciones del mes (ventas donde YO impulsé una promo)
  const misVentasConImp=vMes.filter(v=>v.empleadaId===miId&&(v.impulsos||[]).length>0);
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

    <Card title="🧴 Mis ventas de aromatizador/perfume este mes">
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:20,color:"#1a3c5e"}}>{misPerfumesMes.length}</div>
          <div style={{fontSize:11,color:"#888"}}>Registradas</div>
        </div>
        <div style={{flex:1,background:"#f8fbfd",borderRadius:10,padding:"10px",textAlign:"center"}}>
          <div style={{fontWeight:800,fontSize:20,color:"#2e7d32"}}>${miGananciaPerfumes.toFixed(2)}</div>
          <div style={{fontSize:11,color:"#888"}}>Ganado por perfumes</div>
        </div>
      </div>
      <button style={{...S.btnP,width:"100%",background:"linear-gradient(135deg,#7b1fa2,#ab47bc)"}} onClick={registrarVentaPerfume}>🧴 Registrar venta de perfume</button>
      <div style={{fontSize:11,color:"#aaa",textAlign:"center",marginTop:8}}>Tócalo justo después de vender un aromatizador — ${comisionPerfume.toFixed(2)} por cada uno registrado aquí (no se cuenta solo, hay que tocarlo).</div>
    </Card>
  </div>);
}

function IncentivosAdmin({cfgInc,setIncentivosArr,upsertIncentivo,ventas,empleadas,ventasPerfumeReg}){
  const [ed,setEd]=useState({comisionImpulso:cfgInc.comisionImpulso,bonoMetaPct:cfgInc.bonoMetaPct,bonoExcedentePct:cfgInc.bonoExcedentePct,comisionPerfume:cfgInc.comisionPerfume||0.50});
  const [guardado,setGuardado]=useState(false);
  const guardar=()=>{
    const nuevo={id:"config",comisionImpulso:parseFloat(ed.comisionImpulso)||0,bonoMetaPct:parseFloat(ed.bonoMetaPct)||0,bonoExcedentePct:parseFloat(ed.bonoExcedentePct)||0,comisionPerfume:parseFloat(ed.comisionPerfume)||0};
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
      <div style={{marginTop:10}}><label style={S.lbl}>Comisión por venta de aromatizador/perfume ($) — se registra a mano en su pestaña de Bonos</label><input type="number" step="0.01" style={S.inp} value={ed.comisionPerfume} onChange={e=>setEd({...ed,comisionPerfume:e.target.value})}/></div>
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
    <Card title="🧴 Ventas de perfume registradas este mes">
      {(()=>{
        const delMes=(ventasPerfumeReg||[]).filter(r=>mesK(new Date(r.fecha))===mesAct);
        const porEmpleada={};
        delMes.forEach(r=>{const n=r.empleadaNombre||"—";porEmpleada[n]=(porEmpleada[n]||0)+1;});
        const filas=Object.entries(porEmpleada).sort((a,b)=>b[1]-a[1]);
        if(filas.length===0)return<div style={S.empty}>Nadie ha registrado ventas de perfume este mes todavía.</div>;
        return filas.map(([nombre,cant])=>(
          <div key={nombre} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0f4f8"}}>
            <span style={{fontSize:13}}>{nombre}</span>
            <strong style={{fontSize:13,color:"#7b1fa2"}}>{cant} · ${(cant*(cfgInc.comisionPerfume||0)).toFixed(2)}</strong>
          </div>
        ));
      })()}
    </Card>
  </div>);
}

// 🏭 PRODUCCIÓN — Fase 2: administración de PINs por empleada (solo admin)
// 🏭 PRODUCCIÓN — panel de descarga de reportes (día/semana/mes/rango personalizado)
// 📋 TAREAS — Fase 1: panel admin de plantillas + verificación de la generación diaria
const BLOQUE_LBL={apertura:"🌅 Apertura",media_jornada:"🕐 Media jornada",cambio_turno:"🔄 Cambio de turno",cierre:"🌙 Cierre",semanal:"📆 Semanal"};
const AREA_LBL={atras:"🧺 Atrás",adelante:"🛎️ Adelante",general:"👥 General"};
// 📝 NOTAS — bandeja del admin: filtros, resumen del día, revisar/resolver y responder
function NotasAdminPanel({notas,setNotas,upsertNota,empleadas}){
  const [fArea,setFArea]=useState("todas");
  const [fTipo,setFTipo]=useState("todos");
  const [fEstado,setFEstado]=useState("todas");
  const [respondiendo,setRespondiendo]=useState(null); // notaId
  const [respuestaTxt,setRespuestaTxt]=useState("");
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";

  const hoyK=fechaHoyLocal();
  const notasHoy=notas.filter(n=>fechaLocal(n.fecha)===hoyK);
  const abiertasHoy=notasHoy.filter(n=>n.estado==="abierta");
  const resumenPorTipo=Object.keys(TIPO_NOTA).map(t=>({tipo:t,n:abiertasHoy.filter(x=>x.tipo===t).length})).filter(x=>x.n>0);

  const filtradas=notas.filter(n=>
    (fArea==="todas"||n.area===fArea)&&
    (fTipo==="todos"||n.tipo===fTipo)&&
    (fEstado==="todas"||n.estado===fEstado)
  ).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  const cambiarEstado=(n,estado)=>{
    setNotas(prev=>{
      const next=prev.map(x=>x.id===n.id?{...x,estado,revisadaEn:estado!=="abierta"?new Date().toISOString():x.revisadaEn}:x);
      const updated=next.find(x=>x.id===n.id);
      if(updated&&upsertNota)upsertNota({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const guardarRespuesta=n=>{
    setNotas(prev=>{
      const next=prev.map(x=>x.id===n.id?{...x,respuestaAdmin:respuestaTxt.trim()||null}:x);
      const updated=next.find(x=>x.id===n.id);
      if(updated&&upsertNota)upsertNota({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    setRespondiendo(null);setRespuestaTxt("");
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📝 Bandeja de notas</h2>

    <div style={{...S.alrt,background:abiertasHoy.length>0?"#fff3e0":"#e8f5e9",color:abiertasHoy.length>0?"#e65100":"#2e7d32",marginBottom:14}}>
      {abiertasHoy.length===0?"✅ Sin notas abiertas hoy":`Hoy: ${abiertasHoy.length} nota(s) abierta(s) — ${resumenPorTipo.map(r=>`${r.n} ${TIPO_NOTA[r.tipo].label.replace(/^\S+\s/,"")}`).join(", ")}`}
    </div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      <select style={{...S.inp,width:"auto",fontSize:12}} value={fArea} onChange={e=>setFArea(e.target.value)}>
        <option value="todas">Todas las áreas</option>
        <option value="atras">🧺 Atrás</option>
        <option value="adelante">🛎️ Adelante</option>
      </select>
      <select style={{...S.inp,width:"auto",fontSize:12}} value={fTipo} onChange={e=>setFTipo(e.target.value)}>
        <option value="todos">Todos los tipos</option>
        {Object.entries(TIPO_NOTA).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
      </select>
      <select style={{...S.inp,width:"auto",fontSize:12}} value={fEstado} onChange={e=>setFEstado(e.target.value)}>
        <option value="todas">Todos los estados</option>
        {Object.entries(ESTADO_NOTA).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>

    {filtradas.length===0&&<div style={{textAlign:"center",padding:"30px 20px",color:"#aaa"}}>Sin notas con esos filtros</div>}
    {filtradas.map(n=>{
      const t=TIPO_NOTA[n.tipo]||{label:n.tipo,color:"#888",bg:"#f0f4f8"};
      const e=ESTADO_NOTA[n.estado]||{label:n.estado,color:"#888"};
      return(
        <div key={n.id} style={{...S.vcard,borderLeft:`4px solid ${t.color}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontSize:12,fontWeight:700,color:t.color,background:t.bg,borderRadius:6,padding:"2px 8px",display:"inline-block"}}>{t.label}</div>
            <div style={{fontSize:11,fontWeight:700,color:e.color}}>{e.label}</div>
          </div>
          <div style={{fontSize:14,color:"#1a3c5e",fontWeight:600,marginTop:8}}>{n.texto}</div>
          <div style={{fontSize:11,color:"#888",marginTop:4}}>{nombreDe(n.autoraId)} · {(n.area==="atras"?"🧺 Atrás":"🛎️ Adelante")} · {fmt(n.fecha)}{n.ordenId?` · Orden: ${n.ordenId}`:""}</div>
          {n.fotoUrl&&<img src={n.fotoUrl} alt="foto de la nota" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:10,marginTop:8}}/>}
          {n.respuestaAdmin&&<div style={{fontSize:12,color:"#2e7d32",background:"#e8f5e9",borderRadius:8,padding:"6px 8px",marginTop:8}}>💬 Tu respuesta: {n.respuestaAdmin}</div>}

          <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
            {n.estado==="abierta"&&<button style={{...S.btnS,fontSize:11}} onClick={()=>cambiarEstado(n,"revisada")}>👁️ Marcar revisada</button>}
            {n.estado!=="resuelta"&&<button style={{...S.btnS,fontSize:11,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>cambiarEstado(n,"resuelta")}>✅ Marcar resuelta</button>}
            <button style={{...S.btnS,fontSize:11}} onClick={()=>{setRespondiendo(n.id);setRespuestaTxt(n.respuestaAdmin||"");}}>💬 Responder</button>
          </div>

          {respondiendo===n.id&&(
            <div style={{marginTop:8}}>
              <textarea style={{...S.inp,minHeight:50,resize:"vertical"}} placeholder="Tu respuesta..." value={respuestaTxt} onChange={e=>setRespuestaTxt(e.target.value)}/>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>guardarRespuesta(n)}>Guardar</button>
                <button style={{...S.btnS,flex:1}} onClick={()=>setRespondiendo(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>);
}

const DIAS_TAREA_OPTS=[["lun","Lun"],["mar","Mar"],["mie","Mié"],["jue","Jue"],["vie","Vie"],["sab","Sáb"],["dom","Dom"]];
const TAREA_VACIA={titulo:"",descripcion:"",area:"general",bloque:"apertura",dias:[],horaLimite:"09:00",requiereFoto:false,requiereNota:false,rolRequerido:"",empleadaIds:[],fechaInicio:"",fechaFin:""};
// 🎟️ SORTEO POR BOLETOS — pantalla de administración: crear/editar sorteos, activar (solo 1 a la vez), ver contador en vivo con desglose, exportar y buscar por número
function SorteosAdmin({sorteos,setSorteos,upsertSorteo,boletosSorteo,productos}){
  const sorteosVisibles=sorteos.filter(s=>!s.eliminado);
  const vacio={nombre:"",umbralMonto:"10",fechaInicio:fechaHoyLocal(),fechaFin:fechaHoyLocal(),premio:"",ultimoNumeroBoleto:"0"};
  const [form,setForm]=useState(vacio);
  const [editId,setEditId]=useState(null);
  const [buscarNum,setBuscarNum]=useState("");
  const activo=sorteosVisibles.find(s=>s.activo);
  const tienenPerfume=(productos||[]).filter(p=>!p.eliminada&&p.categoria==="aromatizador");

  const guardar=()=>{
    if(!form.nombre.trim()||!form.premio.trim()){alert("Escribe el nombre y el premio del sorteo");return;}
    if(editId){
      setSorteos(prev=>{
        const next=prev.map(s=>s.id===editId?{...s,nombre:form.nombre.trim(),umbralMonto:parseFloat(form.umbralMonto)||0,fechaInicio:form.fechaInicio,fechaFin:form.fechaFin,premio:form.premio.trim(),ultimoNumeroBoleto:parseInt(form.ultimoNumeroBoleto)||0}:s);
        const updated=next.find(s=>s.id===editId);
        if(updated&&upsertSorteo)upsertSorteo({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const ns={id:"sorteo_"+Date.now(),nombre:form.nombre.trim(),umbralMonto:parseFloat(form.umbralMonto)||0,fechaInicio:form.fechaInicio,fechaFin:form.fechaFin,premio:form.premio.trim(),activo:false,ultimoNumeroBoleto:parseInt(form.ultimoNumeroBoleto)||0};
      setSorteos(prev=>[...prev,ns]);
      if(upsertSorteo)upsertSorteo({...ns,_updatedAt:new Date().toISOString()});
    }
    setForm(vacio);setEditId(null);
  };
  const editar=s=>{setEditId(s.id);setForm({nombre:s.nombre,umbralMonto:String(s.umbralMonto),fechaInicio:s.fechaInicio,fechaFin:s.fechaFin,premio:s.premio,ultimoNumeroBoleto:String(s.ultimoNumeroBoleto||0)});};
  const cancelar=()=>{setEditId(null);setForm(vacio);};
  const eliminar=s=>{
    const n=boletosDe(s.id).length;
    const msg=n>0
      ?`"${s.nombre}" ya tiene ${n} boleto(s) generado(s). Si lo eliminas, esos boletos quedan huérfanos (no se borran, pero ya no aparecerán agrupados aquí). ¿Eliminar de todas formas?`
      :`¿Eliminar el sorteo "${s.nombre}"? Todavía no tiene boletos generados.`;
    if(!window.confirm(msg))return;
    setSorteos(prev=>prev.filter(x=>x.id!==s.id));
    if(upsertSorteo)upsertSorteo({...s,eliminado:true,activo:false,_updatedAt:new Date().toISOString()});
    if(editId===s.id)cancelar();
  };
  // 🔒 Solo puede haber un sorteo activo a la vez: activar este desactiva cualquier otro automáticamente
  const activar=s=>{
    if(!window.confirm(`¿Activar "${s.nombre}"? Cualquier otro sorteo activo se desactivará.`))return;
    setSorteos(prev=>{
      const next=prev.map(x=>({...x,activo:x.id===s.id}));
      next.forEach(x=>{if(upsertSorteo)upsertSorteo({...x,_updatedAt:new Date().toISOString()});});
      return next;
    });
  };
  const desactivar=s=>{
    setSorteos(prev=>{
      const next=prev.map(x=>x.id===s.id?{...x,activo:false}:x);
      const updated=next.find(x=>x.id===s.id);
      if(updated&&upsertSorteo)upsertSorteo({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const boletosDe=sId=>(boletosSorteo||[]).filter(b=>b.sorteoId===sId);
  const exportarBoletos=s=>{
    const lista=boletosDe(s.id).sort((a,b)=>a.numeroBoleto-b.numeroBoleto);
    if(lista.length===0){alert("Este sorteo todavía no tiene boletos generados.");return;}
    const enc=["N° Boleto","Motivo","Cliente","Teléfono","Monto venta","Folio venta","Fecha"];
    const filas=lista.map(b=>[b.numeroBoleto,etiquetaMotivoBoleto(b.motivo),b.clienteNombre||"",b.clienteTelefono||"",b.montoVenta!=null?"$"+b.montoVenta.toFixed(2):"",b.ventaId||"",fmt(b.fecha)]);
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="boletos_"+s.nombre.replace(/[^a-z0-9]/gi,"_")+".csv";a.click();
  };
  const boletoEncontrado=activo&&buscarNum.trim()?boletosSorteo.find(b=>String(b.numeroBoleto)===buscarNum.trim()&&b.sorteoId===activo.id):null;

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🎟️ Sorteo por boletos</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Se genera 1 boleto automático cuando una venta paga alcanza el monto mínimo del sorteo activo, y 1 boleto adicional si la venta incluye un producto marcado "🧴 Aromatizador Textil" (pestaña Productos). Cada motivo es un papel distinto, con su propio número.</div>
    {tienenPerfume.length===0&&<div style={{...S.alrt,background:"#fff3e0",color:"#e65100",fontSize:12,marginBottom:14}}>⚠️ Todavía no tienes ningún producto marcado como "🧴 Aromatizador Textil" — ve a la pestaña Productos y márcalo para que active el boleto extra.</div>}

    {activo&&(()=>{
      const lista=boletosDe(activo.id);
      const porMonto=lista.filter(b=>b.motivo==="monto").length;
      const porPerfume=lista.filter(b=>b.motivo==="perfume").length;
      const porResena=lista.filter(b=>b.motivo==="resena").length;
      return(
        <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:14,padding:16,marginBottom:14,color:"#fff"}}>
          <div style={{fontSize:12,color:"#a0c4da",fontWeight:600}}>🟢 SORTEO ACTIVO</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:800,marginTop:2}}>{activo.nombre}</div>
          <div style={{fontSize:13,color:"#e3f2fd",marginTop:2}}>🎁 {activo.premio}</div>
          <div style={{fontSize:12,color:"#a0c4da",marginTop:6}}>${activo.umbralMonto.toFixed(2)} mínimo · {fmtD(activo.fechaInicio)} – {fmtD(activo.fechaFin)}</div>
          <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 40%",background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:22}}>{lista.length}</div>
              <div style={{fontSize:10,color:"#e3f2fd"}}>Total boletos</div>
            </div>
            <div style={{flex:"1 1 25%",background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:22}}>{porMonto}</div>
              <div style={{fontSize:10,color:"#e3f2fd"}}>Por monto</div>
            </div>
            <div style={{flex:"1 1 25%",background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:22}}>{porPerfume}</div>
              <div style={{fontSize:10,color:"#e3f2fd"}}>🧴 Aromatizador</div>
            </div>
            <div style={{flex:"1 1 25%",background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:22}}>{porResena}</div>
              <div style={{fontSize:10,color:"#e3f2fd"}}>🌟 Reseña</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...S.btnS,flex:1,background:"rgba(255,255,255,.2)",color:"#fff"}} onClick={()=>exportarBoletos(activo)}>📥 Exportar lista</button>
            <button style={{...S.btnS,flex:1,background:"rgba(255,80,80,.3)",color:"#ffdddd"}} onClick={()=>desactivar(activo)}>⏸️ Desactivar</button>
          </div>
        </div>
      );
    })()}

    {activo&&(
      <Card title="🔎 Buscar boleto por número (para verificar al ganador)">
        <input style={S.inp} placeholder="ej. 12" value={buscarNum} onChange={e=>setBuscarNum(e.target.value)}/>
        {boletoEncontrado?(
          <div style={{marginTop:10,background:"#e8f5e9",borderRadius:10,padding:12}}>
            <div style={{fontWeight:800,fontSize:20,color:"#2e7d32"}}>#{boletoEncontrado.numeroBoleto}</div>
            <div style={{fontSize:13,marginTop:4}}>👤 {boletoEncontrado.clienteNombre||"—"}</div>
            <div style={{fontSize:13}}>📱 {boletoEncontrado.clienteTelefono||"—"}</div>
            <div style={{fontSize:12,color:"#888"}}>Folio: {boletoEncontrado.ventaId} · {fmt(boletoEncontrado.fecha)} · {etiquetaMotivoBoleto(boletoEncontrado.motivo)}</div>
          </div>
        ):buscarNum.trim()&&<div style={{marginTop:10,color:"#c62828",fontSize:13}}>No se encontró ese número en el sorteo activo.</div>}
      </Card>
    )}

    <Card title={editId?"✏️ Editar sorteo":"➕ Nuevo sorteo"}>
      <div style={{marginBottom:8}}><label style={S.lbl}>Nombre del sorteo</label><input style={S.inp} placeholder="ej. Sorteo Alexa Sept-Oct 2026" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></div>
      <div style={{marginBottom:8}}><label style={S.lbl}>Premio</label><input style={S.inp} placeholder="ej. Alexa Echo Dot" value={form.premio} onChange={e=>setForm({...form,premio:e.target.value})}/></div>
      <div style={{marginBottom:8}}><label style={S.lbl}>Monto mínimo de compra para boleto</label><input type="number" style={S.inp} value={form.umbralMonto} onChange={e=>setForm({...form,umbralMonto:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Fecha inicio</label><input type="date" style={S.inp} value={form.fechaInicio} onChange={e=>setForm({...form,fechaInicio:e.target.value})}/></div>
        <div><label style={S.lbl}>Fecha fin</label><input type="date" style={S.inp} value={form.fechaFin} onChange={e=>setForm({...form,fechaFin:e.target.value})}/></div>
      </div>
      <div style={{marginBottom:8}}>
        <label style={S.lbl}>Número de boleto actual (el siguiente será este +1)</label>
        <input type="number" style={S.inp} value={form.ultimoNumeroBoleto} onChange={e=>setForm({...form,ultimoNumeroBoleto:e.target.value})}/>
        <div style={{fontSize:11,color:"#888",marginTop:4}}>Normalmente déjalo en 0 al crear un sorteo nuevo. Solo cámbialo si necesitas continuar una numeración existente.</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btnP,flex:1}} onClick={guardar}>{editId?"✓ Guardar cambios":"➕ Crear sorteo"}</button>
        {editId&&<button style={S.btnC} onClick={cancelar}>Cancelar</button>}
      </div>
    </Card>

    <Card title="📋 Todos los sorteos">
      {sorteosVisibles.length===0&&<div style={S.empty}>Aún no has creado ningún sorteo.</div>}
      {sorteosVisibles.map(s=>(
        <div key={s.id} style={{...S.vcard,borderLeft:`4px solid ${s.activo?"#2e7d32":"#bbb"}`}}>
          <div style={{fontWeight:700,fontSize:14}}>{s.nombre}{s.activo?" 🟢":""}</div>
          <div style={{fontSize:12,color:"#888"}}>🎁 {s.premio} · ${s.umbralMonto.toFixed(2)} mín. · {fmtD(s.fechaInicio)} – {fmtD(s.fechaFin)} · {boletosDe(s.id).length} boleto(s) · último n° {s.ultimoNumeroBoleto||0}</div>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {!s.activo&&<button style={{...S.btnS,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>activar(s)}>▶️ Activar</button>}
            <button style={S.btnS} onClick={()=>editar(s)}>✏️ Editar</button>
            <button style={S.btnS} onClick={()=>exportarBoletos(s)}>📥 Exportar</button>
            <button style={S.btnR} onClick={()=>eliminar(s)}>🗑️ Eliminar</button>
          </div>
        </div>
      ))}
    </Card>
  </div>);
}

function TareasAdminPanel({plantillasTareas,setPlantillasTareas,upsertPlantillaTarea,tareasDiarias,setTareasDiarias,upsertTareaDiaria,empleadas}){
  const hoyK=fechaHoyLocal();
  const tareasHoy=tareasDiarias.filter(t=>t.fecha===hoyK&&!t.eliminada).sort((a,b)=>a.orden-b.orden);
  const visibles=plantillasTareas.filter(p=>!p.eliminada);
  const empleadasActivas=(empleadas||[]).filter(e=>e.activa);
  const [form,setForm]=useState(TAREA_VACIA);
  const [editId,setEditId]=useState(null);
  const [repDesde,setRepDesde]=useState(fechaHoyLocal());
  const [repHasta,setRepHasta]=useState(fechaHoyLocal());
  const [notasDesde,setNotasDesde]=useState((()=>{const d=new Date();d.setDate(d.getDate()-30);return fechaLocal(d.toISOString());})());
  const [notasHasta,setNotasHasta]=useState(fechaHoyLocal());
  const nombreDe0=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";
  const descargarReporteTareas=(desde,hasta)=>{
    const lista=tareasDiarias.filter(t=>!t.eliminada&&t.fecha>=desde&&t.fecha<=hasta).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.orden-b.orden);
    if(lista.length===0){alert("No hay tareas generadas en ese rango de fechas.");return;}
    const enc=["Fecha","Tarea","Área","Bloque","Hora límite","Estado","Completada por","Completada en","Atrasada","Asignada a","Requiere foto","Nota"];
    const filas=lista.map(t=>[
      fmtD(t.fecha),t.titulo,AREA_LBL[t.area]||t.area,BLOQUE_LBL[t.bloque]||t.bloque,t.horaLimite,
      t.estado==="completada"?"✅ Completada":t.estado==="no_realizada"?"⛔ No realizada":"⬜ Pendiente",
      t.completadaPor?nombreDe0(t.completadaPor):"",
      t.completadaEn?fmt(t.completadaEn):"",
      t.atrasada?"Sí":"No",
      (t.empleadaIds&&t.empleadaIds.length>0)?t.empleadaIds.map(nombreDe0).join(" / "):(t.rolRequerido?"Rol: "+t.rolRequerido:"Todo el equipo"),
      t.requiereFoto?"Sí":"No",
      t.observacion||"",
    ]);
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="tareas-"+desde+"_a_"+hasta+".csv";a.click();
  };
  const toggleActiva=p=>{
    setPlantillasTareas(prev=>{
      const next=prev.map(pp=>pp.id===p.id?{...pp,activa:!pp.activa}:pp);
      const updated=next.find(pp=>pp.id===p.id);
      if(updated&&upsertPlantillaTarea)upsertPlantillaTarea({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const toggleDiaForm=d=>setForm(prev=>({...prev,dias:prev.dias.includes(d)?prev.dias.filter(x=>x!==d):[...prev.dias,d]}));
  const toggleEmpleadaForm=id=>setForm(prev=>({...prev,empleadaIds:prev.empleadaIds.includes(id)?prev.empleadaIds.filter(x=>x!==id):[...prev.empleadaIds,id]}));
  const guardar=()=>{
    if(!form.titulo.trim()){alert("Escribe el título de la tarea");return;}
    if(form.dias.length===0){alert("Selecciona al menos un día de la semana");return;}
    if(editId){
      const cambios={titulo:form.titulo.trim(),descripcion:form.descripcion.trim()||null,area:form.area,bloque:form.bloque,diasSemana:form.dias,horaLimite:form.horaLimite,requiereFoto:!!form.requiereFoto,requiereNota:!!form.requiereNota,rolRequerido:form.rolRequerido||null,empleadaIds:form.empleadaIds||[],fechaInicio:form.fechaInicio||null,fechaFin:form.fechaFin||null};
      setPlantillasTareas(prev=>{
        const next=prev.map(p=>p.id===editId?{...p,...cambios}:p);
        const updated=next.find(p=>p.id===editId);
        if(updated&&upsertPlantillaTarea)upsertPlantillaTarea({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const ordenMax=Math.max(0,...visibles.filter(p=>p.bloque===form.bloque).map(p=>p.orden||0));
      const np={id:"custom_"+Date.now(),titulo:form.titulo.trim(),descripcion:form.descripcion.trim()||null,area:form.area,bloque:form.bloque,diasSemana:form.dias,horaLimite:form.horaLimite,orden:ordenMax+1,activa:true,requiereFoto:!!form.requiereFoto,requiereNota:!!form.requiereNota,rolRequerido:form.rolRequerido||null,empleadaIds:form.empleadaIds||[],fechaInicio:form.fechaInicio||null,fechaFin:form.fechaFin||null};
      setPlantillasTareas(prev=>[...prev,np]);
      if(upsertPlantillaTarea)upsertPlantillaTarea({...np,_updatedAt:new Date().toISOString()});
    }
    setForm(TAREA_VACIA);setEditId(null);
  };
  const editar=p=>{
    setEditId(p.id);
    setForm({titulo:p.titulo||"",descripcion:p.descripcion||"",area:p.area||"general",bloque:p.bloque||"apertura",dias:p.diasSemana||[],horaLimite:p.horaLimite||"09:00",requiereFoto:!!p.requiereFoto,requiereNota:!!p.requiereNota,rolRequerido:p.rolRequerido||"",empleadaIds:p.empleadaIds||[],fechaInicio:p.fechaInicio||"",fechaFin:p.fechaFin||""});
  };
  const cancelar=()=>{setEditId(null);setForm(TAREA_VACIA);};
  const eliminar=p=>{
    if(!window.confirm(`¿Eliminar la tarea "${p.titulo}"? Ya no se volverá a generar, pero las de días anteriores quedan intactas.`))return;
    setPlantillasTareas(prev=>prev.filter(x=>x.id!==p.id));
    if(upsertPlantillaTarea)upsertPlantillaTarea({...p,activa:false,eliminada:true,_updatedAt:new Date().toISOString()});
    if(editId===p.id)cancelar();
  };
  // 🧹 Reinicio total: elimina TODAS las plantillas y las tareas ya generadas de hoy, para empezar de cero
  const vaciarTodo=()=>{
    if(visibles.length===0){alert("El panel ya está vacío.");return;}
    if(!window.confirm(`¿Eliminar las ${visibles.length} tarea(s) del catálogo y dejar el panel como nuevo? Las tareas de días anteriores quedan en el historial, pero no se generará ninguna más hasta que agregues las tuyas.`))return;
    setPlantillasTareas(prev=>{
      const next=prev.map(p=>p.eliminada?p:{...p,activa:false,eliminada:true});
      next.forEach(p=>{if(!plantillasTareas.find(x=>x.id===p.id)?.eliminada&&upsertPlantillaTarea)upsertPlantillaTarea({...p,_updatedAt:new Date().toISOString()});});
      return next;
    });
    if(setTareasDiarias){
      setTareasDiarias(prev=>{
        const hoyEliminadas=prev.filter(t=>t.fecha===hoyK);
        const next=prev.filter(t=>t.fecha!==hoyK);
        hoyEliminadas.forEach(t=>{if(upsertTareaDiaria)upsertTareaDiaria({...t,eliminada:true,_updatedAt:new Date().toISOString()});});
        return next;
      });
    }
    cancelar();
  };
  // 🔄 Las tareas de HOY ya generadas no se actualizan solas cuando editas una plantilla (ej. activar "requiere foto"),
  // y una tarea NUEVA creada después de que ya se generó el día tampoco aparece sola. Este botón hace ambas cosas:
  // 1) actualiza las de hoy que sigan pendientes con los ajustes más recientes de su plantilla, y
  // 2) genera las tareas de hoy que falten (de cualquier plantilla activa nueva que aún no tenga tarea creada para hoy).
  const sincronizarHoy=()=>{
    let actualizadas=0;
    setTareasDiarias(prev=>{
      let next=prev.map(t=>{
        if(t.fecha!==hoyK||t.eliminada||t.estado!=="pendiente"||!t.plantillaId)return t;
        const p=plantillasTareas.find(pp=>pp.id===t.plantillaId&&!pp.eliminada);
        if(!p)return t;
        actualizadas++;
        return{...t,titulo:p.titulo,descripcion:p.descripcion||null,area:p.area,bloque:p.bloque,horaLimite:p.horaLimite,requiereFoto:!!p.requiereFoto,requiereNota:!!p.requiereNota,rolRequerido:p.rolRequerido||null,empleadaIds:p.empleadaIds||[]};
      });
      next.filter((t,i)=>t!==prev[i]).forEach(t=>{if(upsertTareaDiaria)upsertTareaDiaria({...t,_updatedAt:new Date().toISOString()});});

      // 👇 Generar las que falten hoy: cualquier plantilla activa que aplique hoy y todavía no tenga tarea creada para hoy
      const diaSemana=DIAS_KEY[new Date().getDay()];
      const yaCreadasPlantillaIds=new Set(next.filter(t=>t.fecha===hoyK).map(t=>t.plantillaId));
      const faltantes=plantillasTareas.filter(p=>p.activa&&!p.eliminada&&(p.diasSemana||[]).includes(diaSemana)&&(!p.fechaInicio||hoyK>=p.fechaInicio)&&(!p.fechaFin||hoyK<=p.fechaFin)&&!yaCreadasPlantillaIds.has(p.id));
      const nuevas=faltantes.map(p=>({
        id:hoyK+"_"+p.id,fecha:hoyK,plantillaId:p.id,titulo:p.titulo,descripcion:p.descripcion||null,
        area:p.area,bloque:p.bloque,horaLimite:p.horaLimite,orden:p.orden,requiereFoto:!!p.requiereFoto,requiereNota:!!p.requiereNota,rolRequerido:p.rolRequerido||null,empleadaIds:p.empleadaIds||[],
        estado:"pendiente",completadaPor:null,completadaEn:null,atrasada:false,fotoUrl:null,observacion:null,
      }));
      nuevas.forEach(t=>{if(upsertTareaDiaria)upsertTareaDiaria(t);});
      next=[...next,...nuevas];

      setTimeout(()=>alert(`✅ Listo: ${actualizadas} tarea(s) actualizada(s) y ${nuevas.length} tarea(s) nueva(s) agregada(s) para hoy.`),100);
      return next;
    });
  };
  const bloques=["apertura","media_jornada","cambio_turno","cierre","semanal"];
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📋 Tareas diarias</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Crea, edita o elimina las tareas del checklist diario. Se generan solas cada día según los días de la semana que marques, y puedes asignarlas a todo el equipo, a un rol, o a perfiles específicos.</div>

    <Card title="📥 Descargar reporte de cumplimiento">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Incluye cada tarea generada en el rango: estado, quién la completó, a qué hora, si quedó atrasada y a quién estaba asignada.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
        <button style={S.btnS} onClick={()=>descargarReporteTareas(hoyK,hoyK)}>📅 Hoy</button>
        <button style={S.btnS} onClick={()=>{const d=new Date();d.setDate(d.getDate()-7);descargarReporteTareas(fechaLocal(d.toISOString()),hoyK);}}>🗓️ Semana</button>
        <button style={S.btnS} onClick={()=>{const d=new Date();d.setDate(d.getDate()-30);descargarReporteTareas(fechaLocal(d.toISOString()),hoyK);}}>📆 Mes</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={repDesde} onChange={e=>setRepDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={repHasta} onChange={e=>setRepHasta(e.target.value)}/></div>
      </div>
      <button style={{...S.btnP,width:"100%"}} onClick={()=>descargarReporteTareas(repDesde,repHasta)}>⬇️ Descargar CSV</button>
    </Card>

    <Card title="🔄 Sincronizar tareas de hoy">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Si creaste una tarea NUEVA hoy (después de que ya se generó el día), o editaste una existente (ej. activaste "requiere foto"/"requiere nota"), esos cambios no aparecen solos. Usa este botón para agregar las tareas nuevas que falten hoy y actualizar las pendientes con los ajustes más recientes.</div>
      <button style={{...S.btnP,width:"100%"}} onClick={sincronizarHoy}>🔄 Sincronizar tareas de hoy</button>
    </Card>

    <Card title="🧹 Empezar de cero">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Elimina todas las tareas del catálogo (y las ya generadas de hoy) para armar tu checklist desde cero.</div>
      <button style={{...S.btnP,width:"100%",background:"linear-gradient(135deg,#c62828,#e57373)"}} onClick={vaciarTodo}>🗑️ Vaciar todas las tareas</button>
    </Card>

    <Card title={editId?"✏️ Editar tarea":"➕ Nueva tarea"}>
      <div style={{marginBottom:8}}><label style={S.lbl}>Título *</label><input style={S.inp} placeholder="ej. Revisar el correo del negocio" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></div>
      <div style={{marginBottom:8}}><label style={S.lbl}>Descripción (opcional)</label><input style={S.inp} placeholder="Detalle adicional..." value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Área</label>
          <select style={S.inp} value={form.area} onChange={e=>setForm({...form,area:e.target.value})}>
            <option value="general">👥 General</option>
            <option value="atras">🧺 Atrás</option>
            <option value="adelante">🛎️ Adelante</option>
          </select>
        </div>
        <div><label style={S.lbl}>Bloque</label>
          <select style={S.inp} value={form.bloque} onChange={e=>setForm({...form,bloque:e.target.value})}>
            {bloques.map(b=><option key={b} value={b}>{BLOQUE_LBL[b]||b}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginBottom:8}}>
        <label style={S.lbl}>Hora límite</label><input type="time" style={S.inp} value={form.horaLimite} onChange={e=>setForm({...form,horaLimite:e.target.value})}/>
      </div>
      <label style={S.lbl}>¿Qué días se genera?</label>
      <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
        {DIAS_TAREA_OPTS.map(([k,l])=>(
          <button key={k} style={{...S.pill,fontSize:11,padding:"5px 10px",...(form.dias.includes(k)?S.pillA:{})}} onClick={()=>toggleDiaForm(k)}>{l}</button>
        ))}
      </div>

      <label style={S.lbl}>👤 Asignar a perfiles activos (opcional)</label>
      <div style={{fontSize:11,color:"#888",marginBottom:6}}>Si no marcas a nadie, la tarea le sale a todo el equipo. Si marcas a una o más personas, la tarea solo le sale a ellas — si marcas a dos, la tarea es compartida entre esas dos (no se duplica en dos tareas separadas).</div>
      <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
        {empleadasActivas.length===0&&<div style={{fontSize:12,color:"#c62828"}}>No hay perfiles activos en Equipo todavía.</div>}
        {empleadasActivas.map(e=>(
          <button key={e.id} style={{...S.pill,fontSize:11,padding:"5px 10px",...(form.empleadaIds.includes(e.id)?S.pillA:{})}} onClick={()=>toggleEmpleadaForm(e.id)}>{e.nombre}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Fecha de inicio (opcional)</label><input type="date" style={S.inp} value={form.fechaInicio} onChange={e=>setForm({...form,fechaInicio:e.target.value})}/></div>
        <div><label style={S.lbl}>Fecha de fin (opcional)</label><input type="date" style={S.inp} value={form.fechaFin} onChange={e=>setForm({...form,fechaFin:e.target.value})}/></div>
      </div>
      <div style={{fontSize:11,color:"#888",marginBottom:10}}>Déjalas vacías para que se repita indefinidamente en los días marcados. Ponlas si es una tarea temporal (ej. solo durante una campaña o un mes específico).</div>

      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:10,cursor:"pointer"}}>
        <input type="checkbox" checked={form.requiereFoto} onChange={e=>setForm({...form,requiereFoto:e.target.checked})}/>
        📷 Requiere foto para completarse
      </label>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:10,cursor:"pointer"}}>
        <input type="checkbox" checked={form.requiereNota} onChange={e=>setForm({...form,requiereNota:e.target.checked})}/>
        📝 Requiere dejar una nota para completarse
      </label>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btnP,flex:1}} onClick={guardar}>{editId?"✓ Guardar cambios":"➕ Agregar tarea"}</button>
        {editId&&<button style={S.btnC} onClick={cancelar}>Cancelar</button>}
      </div>
    </Card>

    <Card title="📝 Notas dejadas en las tareas">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Todas las notas que las colaboradoras escribieron al completar tareas que lo requerían.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={notasDesde} onChange={e=>setNotasDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={notasHasta} onChange={e=>setNotasHasta(e.target.value)}/></div>
      </div>
      {(()=>{
        const conNota=tareasDiarias.filter(t=>!t.eliminada&&t.observacion&&t.fecha>=notasDesde&&t.fecha<=notasHasta).sort((a,b)=>b.fecha.localeCompare(a.fecha));
        if(conNota.length===0)return <div style={{fontSize:13,color:"#888"}}>Sin notas en ese rango de fechas.</div>;
        return conNota.map(t=>(
          <div key={t.id} style={{...S.vcard,borderLeft:"4px solid #1a3c5e"}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1a3c5e"}}>{t.titulo}</div>
            <div style={{fontSize:11,color:"#888",marginBottom:6}}>{fmtD(t.fecha)} · {AREA_LBL[t.area]||t.area}{t.completadaPor?` · ${nombreDe0(t.completadaPor)}`:""}</div>
            <div style={{fontSize:13,color:"#1a3c5e",background:"#f0f4f8",borderRadius:8,padding:"8px 10px"}}>📝 {t.observacion}</div>
          </div>
        ));
      })()}
    </Card>

    <Card title={`✅ Tareas generadas hoy (${tareasHoy.length})`}>
      {tareasHoy.length===0&&<div style={{fontSize:13,color:"#888"}}>Todavía no se han generado tareas para hoy — se crean solas al abrir la app, según lo que hayas configurado arriba.</div>}
      {bloques.map(b=>{
        const deEsteBloque=tareasHoy.filter(t=>t.bloque===b);
        if(deEsteBloque.length===0)return null;
        return(<div key={b} style={{marginBottom:10}}>
          <div style={{fontSize:12,fontWeight:700,color:"#1a3c5e",marginBottom:4}}>{BLOQUE_LBL[b]||b}</div>
          {deEsteBloque.map(t=>(
            <div key={t.id} style={{padding:"4px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span>{t.estado==="completada"?"✅":t.estado==="no_realizada"?"⛔":"⬜"} {t.titulo} <span style={{color:"#888",fontSize:11}}>({AREA_LBL[t.area]||t.area} · {t.horaLimite})</span></span>
                {t.completadaPor&&<span style={{color:"#2e7d32",fontSize:11,fontWeight:600}}>{nombreDe(t.completadaPor)}</span>}
              </div>
              {t.observacion&&<div style={{fontSize:11,color:"#1a3c5e",background:"#f0f4f8",borderRadius:6,padding:"4px 8px",marginTop:3}}>📝 {t.observacion}</div>}
            </div>
          ))}
        </div>);
      })}
    </Card>

    {bloques.map(b=>{
      const deEsteBloque=visibles.filter(p=>p.bloque===b).sort((a,b2)=>a.orden-b2.orden);
      if(deEsteBloque.length===0)return null;
      return(
        <Card key={b} title={BLOQUE_LBL[b]||b}>
          {deEsteBloque.map(p=>(
            <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f0f4f8",gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:p.activa?"#1a3c5e":"#bbb"}}>{p.titulo}</div>
                <div style={{fontSize:11,color:"#888"}}>{AREA_LBL[p.area]||p.area} · {(p.diasSemana||[]).join(", ")} · límite {p.horaLimite}{p.requiereFoto?" · 📷 requiere foto":""}{p.requiereNota?" · 📝 requiere nota":""}{p.rolRequerido?" · 🧾 Solo "+p.rolRequerido:""}</div>
                {(p.empleadaIds&&p.empleadaIds.length>0)&&<div style={{fontSize:11,color:"#7b1fa2",fontWeight:600}}>👤 Solo: {p.empleadaIds.map(nombreDe).join(", ")}</div>}
                {(p.fechaInicio||p.fechaFin)&&<div style={{fontSize:11,color:"#e65100"}}>📅 {p.fechaInicio?fmtD(p.fechaInicio):"sin inicio"} – {p.fechaFin?fmtD(p.fechaFin):"sin fin"}</div>}
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button style={{...S.btnS,fontSize:11}} onClick={()=>editar(p)}>✏️</button>
                <button style={{...S.btnS,fontSize:11}} onClick={()=>toggleActiva(p)}>{p.activa?"✅":"⏸️"}</button>
                <button style={S.btnR} onClick={()=>eliminar(p)}>✕</button>
              </div>
            </div>
          ))}
        </Card>
      );
    })}
  </div>);
}

function ReportesProduccionPanel({cargas,eventosProduccion,ventas,empleadas}){
  const [desde,setDesde]=useState(fechaHoyLocal());
  const [hasta,setHasta]=useState(fechaHoyLocal());
  const descargar=(d,h,etiqueta)=>{
    const n=expCSVProduccion(d,h,{cargas,eventosProduccion,ventas,empleadas},"produccion_detalle_"+etiqueta);
    if(n===0)alert("No hay movimientos de producción en ese rango de fechas.");
  };
  const descargarPorOrden=(d,h,etiqueta)=>{
    const n=expCSVProduccionPorOrden(d,h,{cargas,eventosProduccion,ventas,empleadas},"produccion_por_orden_"+etiqueta);
    if(n===0)alert("No hay órdenes registradas en ese rango de fechas.");
  };
  const hoy=fechaHoyLocal();
  const hace7=(()=>{const d=new Date();d.setDate(d.getDate()-7);return fechaLocal(d.toISOString());})();
  const hace30=(()=>{const d=new Date();d.setDate(d.getDate()-30);return fechaLocal(d.toISOString());})();
  return(
    <Card title="📊 Descargar reporte de producción">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Elige el formato que necesitas: detalle evento por evento, o un resumen de una fila por orden con la hora exacta de ingreso y toda la cadena.</div>
      <div style={{fontSize:12,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>📋 Por orden (resumen — hora de ingreso + cadena completa)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6}}>
        <button style={S.btnS} onClick={()=>descargarPorOrden(hoy,hoy,"hoy")}>📅 Hoy</button>
        <button style={S.btnS} onClick={()=>descargarPorOrden(hace7,hoy,"semana")}>🗓️ Semana</button>
        <button style={S.btnS} onClick={()=>descargarPorOrden(hace30,hoy,"mes")}>📆 Mes</button>
      </div>
      <button style={{...S.btnP,width:"100%",marginBottom:14,background:"linear-gradient(135deg,#00838f,#26c6da)"}} onClick={()=>descargarPorOrden(desde,hasta,"rango")}>⬇️ Descargar resumen por orden (rango de abajo)</button>

      <div style={{fontSize:12,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>🔍 Detalle por evento (revisión, lavado, secado, doblado por separado)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <button style={S.btnS} onClick={()=>descargar(hoy,hoy,"hoy")}>📅 Hoy</button>
        <button style={S.btnS} onClick={()=>descargar(hace7,hoy,"semana")}>🗓️ Esta semana</button>
        <button style={S.btnS} onClick={()=>descargar(hace30,hoy,"mes")}>📆 Este mes</button>
      </div>
      <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:6}}>Rango personalizado (aplica a ambos reportes)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
      </div>
      <button style={{...S.btnP,width:"100%"}} onClick={()=>descargar(desde,hasta,"rango")}>⬇️ Descargar detalle por evento (CSV)</button>
    </Card>
  );
}

function PinsAdmin({empleadas,pins,setPins,upsertPin}){
  const [editId,setEditId]=useState(null);
  const [p1,setP1]=useState("");
  const [p2,setP2]=useState("");
  const [msg,setMsg]=useState({});
  const tienePin=id=>pins.some(p=>String(p.id)===String(id)&&p.activo);
  const empezar=id=>{setEditId(id);setP1("");setP2("");setMsg({});};
  const guardar=async id=>{
    if(!/^\d{4}$/.test(p1)){setMsg({...msg,[id]:"El PIN debe ser de 4 dígitos"});return;}
    if(p1!==p2){setMsg({...msg,[id]:"Los dos PIN no coinciden"});return;}
    const salt=randomSalt();
    const pinHash=await hashPin(p1,salt);
    const nuevo={id,pinHash,salt,activo:true};
    setPins(prev=>{const otros=prev.filter(p=>String(p.id)!==String(id));return[...otros,nuevo];});
    if(upsertPin)upsertPin({...nuevo,_updatedAt:new Date().toISOString()});
    setEditId(null);
    setMsg({...msg,[id]:null});
  };
  const quitar=id=>{
    if(!confirm("¿Quitar el PIN de esta empleada? Ya no podrá identificarse en el módulo de Producción hasta que le asignes uno nuevo."))return;
    setPins(prev=>{const next=prev.map(p=>String(p.id)===String(id)?{...p,activo:false}:p);return next;});
    const existente=pins.find(p=>String(p.id)===String(id));
    if(existente&&upsertPin)upsertPin({...existente,activo:false,_updatedAt:new Date().toISOString()});
  };
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🔒 PINs de Producción</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ El PIN identifica quién ejecuta cada acción en el módulo de Producción (iniciar lavado, doblado, etc.), sin importar con qué usuario esté abierta la sesión del dispositivo.</div>
    <Card title="👩 Empleadas">
      {empleadas.map(e=>(
        <div key={e.id} style={S.vcard}>
          {editId===e.id?(
            <div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>{e.nombre}</div>
              <div style={{display:"grid",gap:8}}>
                <div><label style={S.lbl}>Nuevo PIN (4 dígitos)</label><input type="password" inputMode="numeric" maxLength={4} style={S.inp} value={p1} onChange={ev=>setP1(ev.target.value.replace(/\D/g,"").slice(0,4))}/></div>
                <div><label style={S.lbl}>Confirmar PIN</label><input type="password" inputMode="numeric" maxLength={4} style={S.inp} value={p2} onChange={ev=>setP2(ev.target.value.replace(/\D/g,"").slice(0,4))}/></div>
              </div>
              {msg[e.id]&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginTop:6}}>{msg[e.id]}</div>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>guardar(e.id)}>✓ Guardar PIN</button>
                <button style={{...S.btnS,flex:1}} onClick={()=>setEditId(null)}>Cancelar</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{e.nombre}</div>
                <div style={{fontSize:12,color:tienePin(e.id)?"#2e7d32":"#c62828",fontWeight:600}}>{tienePin(e.id)?"🔒 PIN configurado":"⚠️ Sin PIN asignado"}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button style={S.btnS} onClick={()=>empezar(e.id)}>{tienePin(e.id)?"🔄 Cambiar":"➕ Asignar"}</button>
                {tienePin(e.id)&&<button style={S.btnR} onClick={()=>quitar(e.id)}>✕</button>}
              </div>
            </div>
          )}
        </div>
      ))}
    </Card>
  </div>);
}

function PantallaEmpleada({ventas,setVentas,clientes,setClientes,empleadas,servicios,sesion,addAbono,onLogout,onIrProduccion,onIrTareas,cierreListo,onCierreListo,onResetCierre,salidasCaja,setSalidasCaja,upsertVenta,upsertSalida,upsertCliente,upsertCaja,cupones,setCupones,upsertCupon,promos,cfgInc,maquinas,setMaquinas,upsertMaquina,cargas,setCargas,upsertCarga,pins,eventosProduccion,setEventosProduccion,upsertEvento,productos,setProductos,upsertProducto,setKardexProductos,upsertKardexProducto,sorteos,setSorteos,upsertSorteo,setBoletosSorteo,upsertBoletoSorteo,boletosParaImprimir,setBoletosParaImprimir,depositos,setDepositos,upsertDeposito,setConteosInventario,upsertConteoInventario,ventasPerfumeReg,setVentasPerfumeReg,upsertVentaPerfume,tareasDiarias,quejas,evalConfig,calificacionesAudio}){
  const [tab,setTab]=useState("hoy");const [busq,setBusq]=useState("");
  const [showNueva,setShowNueva]=useState(false);
  const [filtroTile,setFiltroTile]=useState(null); // 🔎 filtro rápido al tocar un contador (recibido/proceso/listo/entregado_pend)
  const [showCaja,setShowCaja]=useState(false);const [ticket,setTicket]=useState(null);const [cuponSugE,setCuponSugE]=useState(null);const [showSalidaEmp,setShowSalidaEmp]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  // 🧽 Restregados y servicios adicionales esperando respuesta del cliente — visible para todo el equipo hasta que se confirme
  const restregadosPendientes=ventas.filter(v=>!v.anulada&&(v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar")));
  const listasSinAvisarCount=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")==="listo"&&!v.checkMsgRetiro).length;
  const entreganHoyCount=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&fechaLocal(v.entrega)===fechaHoyLocal()).length;
  const conNotasCount=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&v.notas&&v.notas.trim()).length;
  const cumpleHoyCount=(clientes||[]).filter(c=>diasParaCumple(c.nacimiento)===0).length;
  const maquinasVencidasCount=(maquinas||[]).filter(m=>m.estado==="ocupada"&&m.finProgramado&&new Date(m.finProgramado)<new Date()).length;
  const miEmpleadaSesionPE=(empleadas||[]).find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||(empleadas||[]).find(e=>{const en=normNombre(e.nombre).split(" ")[0];const sn=normNombre(sesion?.nombre).split(" ")[0];return en&&sn&&en===sn;});
  const puedeFacturarAqui=miEmpleadaSesionPE?.rolFuncional==="recepcionista";
  const facturarSRICount=puedeFacturarAqui?ventas.filter(v=>!v.anulada&&pagada(v)&&!v.facturadoSRI).length:0;
  const totalNotifs=restregadosPendientes.length+listasSinAvisarCount+entreganHoyCount+conNotasCount+cumpleHoyCount+maquinasVencidasCount+facturarSRICount;
  // 🔔 Suena cuando aumentan las notificaciones (ej. llega un restregado nuevo o ya lo autorizaron en otra pantalla)
  const notifsPrevRef=useRef(totalNotifs);
  useEffect(()=>{
    if(totalNotifs>notifsPrevRef.current)reproducirSonidoAlerta();
    notifsPrevRef.current=totalNotifs;
  },[totalNotifs]);
  // 📋 Todas las órdenes pendientes del negocio (sin importar fecha ni empleada), ordenadas Recibido → En proceso → Listo → Entregado (sin cobrar)
  // 🔒 Solo desaparece cuando está Entregada Y además pagada por completo — si falta cobrar, se queda visible como pendiente
  const pendientesRaw=ventas.filter(v=>!v.anulada&&!((v.estado||"recibido")==="entregado"&&pagada(v))).sort((a,b)=>{
    const oa=ESTADOS.findIndex(e=>e.id===(a.estado||"recibido"));
    const ob=ESTADOS.findIndex(e=>e.id===(b.estado||"recibido"));
    if(oa!==ob)return oa-ob;
    return new Date(b.fecha)-new Date(a.fecha);
  });
  // 🔎 Si tocaron un contador (tile), filtra la lista de Ordenes solo a ese grupo
  const pendientes=!filtroTile?pendientesRaw:pendientesRaw.filter(v=>filtroTile==="entregado_pend"?(v.estado||"recibido")==="entregado":(v.estado||"recibido")===filtroTile);
  // 💸 Pestaña "Recibido" = solo estado "recibido"
  const porCob=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")==="recibido");
  // 🔄 Pestaña "En proceso" = solo estado "proceso"
  const porProc=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")==="proceso");
  // 📦 Pestaña "Listo para retirar" = órdenes cuyo estado ya es "listo"
  const porEnt=ventas.filter(v=>!v.anulada&&(v.estado||"recibido")==="listo");
  const porEntregadoPend=pendientesRaw.filter(v=>(v.estado||"recibido")==="entregado");
  const lista=tab==="cobrar"?porCob:tab==="proceso"?porProc:tab==="entregar"?porEnt:pendientes;
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
          <div style={{display:"flex",gap:6,overflowX:"auto",maxWidth:"70vw"}}>
            <button onClick={()=>setShowNotifs(true)} style={{position:"relative",background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 10px",cursor:"pointer",fontWeight:600,flexShrink:0}}>
              🔔{totalNotifs>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 5px"}}>{totalNotifs}</span>}
            </button>
            <button onClick={onIrProduccion} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 10px",cursor:"pointer",fontWeight:600,flexShrink:0}}>🏭 Producción</button>
            <button onClick={onIrTareas} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 10px",cursor:"pointer",fontWeight:600,flexShrink:0}}>📋 Tareas</button>
            <button onClick={()=>setShowCaja(true)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 10px",cursor:"pointer",fontWeight:600,flexShrink:0}}>💰 Caja</button>
            <button onClick={()=>setShowSalidaEmp(true)} style={{background:"rgba(220,50,50,.35)",border:"none",borderRadius:8,color:"#ffcccc",fontSize:12,padding:"6px 10px",cursor:"pointer",fontWeight:600,flexShrink:0}}>💸 Salida</button>
            {cierreListo
              ?<button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,color:"#fff",fontSize:12,padding:"6px 10px",cursor:"pointer",flexShrink:0}}>Salir</button>
              :<button onClick={()=>alert("Debes hacer el cierre de caja antes de salir.")} style={{background:"rgba(255,80,80,.3)",border:"none",borderRadius:8,color:"#ffcccc",fontSize:12,padding:"6px 10px",cursor:"not-allowed",flexShrink:0}}>🔒 Salir</button>
            }
          </div>
        </div>
      </div>
      {restregadosPendientes.length>0&&(
        <div style={{background:"#fff3e0",borderBottom:"1.5px solid #e65100",padding:"8px 14px",fontSize:12,fontWeight:700,color:"#e65100"}}>
          🧽 {restregadosPendientes.length} orden(es) con extras esperando respuesta del cliente: {restregadosPendientes.map(v=>`${v.clienteNombre} (${v.folio})`).join(" · ")}
        </div>
      )}
      <div style={{background:"#fff",display:"flex",borderBottom:"2px solid #e8f0f7",position:"sticky",top:0,zIndex:10}}>
        {[{id:"hoy",l:"📋 Ordenes",c:pendientesRaw.length},{id:"cobrar",l:"💸 Recibido",c:porCob.length},{id:"proceso",l:"🔄 En proceso",c:porProc.length},{id:"entregar",l:"📦 Listo para retirar",c:porEnt.length},{id:"clientes",l:"👥 Clientes"},...(puedeFacturarAqui?[{id:"resumen",l:"📊 Resumen"},{id:"depositosEmp",l:"🏦 Depósitos"},{id:"conteoEmp",l:"📋 Conteo inventario"}]:[]),{id:"miEvaluacion",l:"📋 Mi Evaluación"},{id:"bonos",l:"📈 Bonos"},{id:"nueva",l:"➕ Nuevo"}].map(t=>(
          <button key={t.id} style={{flex:1,padding:"12px 4px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:tab===t.id?700:500,color:tab===t.id?"#1a3c5e":"#888",borderBottom:tab===t.id?"2px solid #4db6e4":"none",marginBottom:-2,fontSize:11,position:"relative"}}
            onClick={()=>t.id==="nueva"?setShowNueva(true):setTab(t.id)}>
            {t.l}{t.c>0&&<span style={{position:"absolute",top:5,right:3,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.c}</span>}
          </button>
        ))}
      </div>
      <div style={{padding:12}}>
        {tab!=="bonos"&&tab!=="resumen"&&tab!=="clientes"&&tab!=="depositosEmp"&&tab!=="conteoEmp"&&tab!=="miEvaluacion"&&(<div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={{...S.inp,flex:1}} placeholder="🔍 Buscar cliente o folio..." value={busq} onChange={e=>setBusq(e.target.value)}/>
        </div>)}
        {tab==="hoy"&&(<>
          <div style={{display:"flex",gap:8,marginBottom:6,overflowX:"auto"}}>
            {ESTADOS.filter(est=>est.id!=="entregado").map(est=>{
              const cnt=pendientesRaw.filter(v=>(v.estado||"recibido")===est.id).length;
              const activo=filtroTile===est.id;
              return <button key={est.id} onClick={()=>setFiltroTile(activo?null:est.id)} style={{background:est.bg,borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:70,border:`1.5px solid ${est.color}`,flexShrink:0,cursor:"pointer",boxShadow:activo?`0 0 0 2px ${est.color}`:"none",fontFamily:"'DM Sans',sans-serif"}}>
                <div style={{fontSize:16}}>{est.icon}</div>
                <div style={{fontWeight:800,fontSize:18,color:est.color}}>{cnt}</div>
                <div style={{fontSize:9,color:est.color}}>{est.label}</div>
              </button>;
            })}
            {porEntregadoPend.length>0&&(()=>{const cnt=porEntregadoPend.length;const activo=filtroTile==="entregado_pend";return(
              <button onClick={()=>setFiltroTile(activo?null:"entregado_pend")} style={{background:"#fff3e0",borderRadius:10,padding:"8px 10px",textAlign:"center",minWidth:80,border:"1.5px solid #e65100",flexShrink:0,cursor:"pointer",boxShadow:activo?"0 0 0 2px #e65100":"none",fontFamily:"'DM Sans',sans-serif"}}>
                <div style={{fontSize:16}}>💸</div>
                <div style={{fontWeight:800,fontSize:18,color:"#e65100"}}>{cnt}</div>
                <div style={{fontSize:9,color:"#e65100"}}>Entregado, falta cobrar</div>
              </button>
            );})()}
          </div>
          {filtroTile&&<div style={{marginBottom:10}}><button onClick={()=>setFiltroTile(null)} style={{background:"none",border:"none",color:"#4db6e4",fontSize:12,fontWeight:700,cursor:"pointer",padding:0}}>✕ Quitar filtro · ver todas</button></div>}
        </>)}
        {tab==="bonos"
          ?<MisIncentivos ventas={ventas} empleadas={empleadas} sesion={sesion} cfgInc={cfgInc||INCENTIVOS_DEFAULT[0]} ventasPerfumeReg={ventasPerfumeReg} setVentasPerfumeReg={setVentasPerfumeReg} upsertVentaPerfume={upsertVentaPerfume}/>
          :tab==="resumen"
            ?<ResumenDia ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>
          :tab==="depositosEmp"
            ?<Depositos depositos={depositos} setDepositos={setDepositos} ventas={ventas} salidasCaja={salidasCaja} upsertDeposito={upsertDeposito}/>
          :tab==="conteoEmp"
            ?<ConteoProductos productos={productos} setConteos={setConteosInventario} upsertConteo={upsertConteoInventario} sesion={sesion}/>
          :tab==="miEvaluacion"
            ?<EvaluacionDesempeno empleadas={empleadas} ventas={ventas} eventosProduccion={eventosProduccion} tareasDiarias={tareasDiarias} quejas={quejas} cargas={cargas} evalConfig={evalConfig||EVAL_CONFIG_DEFAULT[0]} esAdmin={false} miEmpleadaId={miEmpleadaSesionPE?.id} calificacionesAudio={calificacionesAudio} ventasPerfumeReg={ventasPerfumeReg}/>
          :tab==="clientes"
            ?<Clientes clientes={clientes} setClientes={setClientes} upsertCliente={upsertCliente} ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} esAdmin={false}/>
          :filtrados.length===0
            ?<div style={{textAlign:"center",padding:"40px 20px",color:"#aaa"}}><div style={{fontSize:48,marginBottom:8}}>{tab==="entregar"?"🎉":"📋"}</div><div>{tab==="cobrar"?"Sin órdenes en Recibido":tab==="proceso"?"Nada en proceso":tab==="entregar"?"Nada listo para retirar":"Sin ordenes"}</div></div>
            :filtrados.map(v=><OrdenCard key={v.folio} v={v} setVentas={setVentas} addAbono={addAbono} setTicket={setTicket} upsertVenta={upsertVenta} clientes={clientes} setClientes={setClientes} upsertCliente={upsertCliente} sesion={sesion}/>)
        }
      </div>
      {showNueva&&(
        <div style={S.ov}>
          <div style={{background:"#fff",borderRadius:16,width:"96vw",maxWidth:1300,maxHeight:"92vh",overflowY:"auto",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e"}}>➕ Nueva Venta</div>
              <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}} onClick={()=>setShowNueva(false)}>✕</button>
            </div>
            <NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={v=>{setShowNueva(false);setTicket(v);}} servicios={servicios} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos} productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} sorteos={sorteos} setSorteos={setSorteos} upsertSorteo={upsertSorteo} setBoletosSorteo={setBoletosSorteo} upsertBoletoSorteo={upsertBoletoSorteo} onBoletosGenerados={setBoletosParaImprimir}/>
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
      {showNotifs&&<NotificacionesPanel ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} addAbono={addAbono} clientes={clientes} maquinas={maquinas} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} pins={pins} empleadas={empleadas} sesion={sesion} onClose={()=>setShowNotifs(false)}/>}
      {boletosParaImprimir&&<BoletosSorteoModal data={boletosParaImprimir} sorteos={sorteos||[]} onClose={()=>setBoletosParaImprimir(null)}/>}
    </div>
  );
}

// ─── BUSCADOR DE SERVICIOS ─────────────────────────────────────────
// 🏭 PRODUCCIÓN — Fase 2: modal de teclado numérico para identificar quién ejecuta una acción por PIN
function PinModal({pins,empleadas,onConfirm,onCancelar,titulo}){
  const [valor,setValor]=useState("");
  const [error,setError]=useState("");
  const [intentos,setIntentos]=useState(0);
  const [bloqueadoHasta,setBloqueadoHasta]=useState(null);
  const [verificando,setVerificando]=useState(false);
  const bloqueado=bloqueadoHasta&&Date.now()<bloqueadoHasta;
  const segRestantes=bloqueado?Math.ceil((bloqueadoHasta-Date.now())/1000):0;
  const tecla=n=>{if(bloqueado||verificando)return;if(valor.length>=4)return;setError("");setValor(valor+n);};
  const borrar=()=>{if(bloqueado||verificando)return;setValor(valor.slice(0,-1));};
  useEffect(()=>{
    if(valor.length===4&&!bloqueado)verificar();
    // eslint-disable-next-line
  },[valor]);
  const verificar=async()=>{
    setVerificando(true);
    let match=null;
    for(const p of pins){
      if(!p.activo)continue;
      const h=await hashPin(valor,p.salt);
      if(h===p.pinHash){match=p;break;}
    }
    if(match){
      const emp=empleadas.find(e=>String(e.id)===String(match.id));
      onConfirm(emp||null);
    }else{
      const nuevo=intentos+1;
      setIntentos(nuevo);
      setValor("");
      if(nuevo>=5){
        setBloqueadoHasta(Date.now()+60000);
        setError("⛔ Demasiados intentos. Espera 1 minuto.");
        setIntentos(0);
      }else{
        setError(`PIN incorrecto (${nuevo}/5 intentos)`);
      }
    }
    setVerificando(false);
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:340,padding:"24px 20px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.35)"}}>
        <div style={{fontSize:32,marginBottom:6}}>🔒</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4}}>{titulo||"Ingresa tu PIN"}</div>
        <div style={{display:"flex",justifyContent:"center",gap:10,margin:"16px 0"}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:16,height:16,borderRadius:"50%",background:valor.length>i?"#1a3c5e":"#e0e8f0"}}/>
          ))}
        </div>
        {bloqueado?(
          <div style={{color:"#c62828",fontWeight:700,fontSize:13,marginBottom:10}}>⛔ Bloqueado {segRestantes}s</div>
        ):error?(
          <div style={{color:"#c62828",fontWeight:700,fontSize:13,marginBottom:10}}>{error}</div>
        ):verificando?(
          <div style={{color:"#888",fontSize:13,marginBottom:10}}>Verificando...</div>
        ):<div style={{height:22,marginBottom:10}}/>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          {[1,2,3,4,5,6,7,8,9].map(n=>(
            <button key={n} onClick={()=>tecla(String(n))} disabled={bloqueado||verificando} style={{padding:"16px 0",fontSize:20,fontWeight:700,borderRadius:12,border:"1.5px solid #e8f0f7",background:"#f8fbfd",color:"#1a3c5e",cursor:bloqueado?"not-allowed":"pointer"}}>{n}</button>
          ))}
          <div/>
          <button onClick={()=>tecla("0")} disabled={bloqueado||verificando} style={{padding:"16px 0",fontSize:20,fontWeight:700,borderRadius:12,border:"1.5px solid #e8f0f7",background:"#f8fbfd",color:"#1a3c5e",cursor:bloqueado?"not-allowed":"pointer"}}>0</button>
          <button onClick={borrar} disabled={bloqueado||verificando} style={{padding:"16px 0",fontSize:16,fontWeight:700,borderRadius:12,border:"1.5px solid #e8f0f7",background:"#f8fbfd",color:"#c62828",cursor:"pointer"}}>⌫</button>
        </div>
        <button style={{...S.btnC,width:"100%"}} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

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
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <input type="number" min={1} max={selSrv?.limite||undefined} style={{...S.inp,width:56,textAlign:"center"}} value={piezas} onChange={e=>onPiezasChange(e.target.value)}/>
        {selSrv?.limite&&<div style={{fontSize:9,color:"#e65100",marginTop:2,whiteSpace:"nowrap"}}>máx {selSrv.limite}</div>}
      </div>
    </div>
  );
}

// 🛍️ PRODUCTOS — buscador de productos para agregarlos a una venta (muestra stock disponible; no deja pasar de lo que hay)
function ProductoBuscador({productoId,piezas,productos,onProdChange,onPiezasChange}){
  const selP=productos.find(p=>p.id===productoId)||productos[0];
  const [busq,setBusq]=useState("");
  const [open,setOpen]=useState(false);
  const filtrados=busq?productos.filter(p=>p.nombre.toLowerCase().includes(busq.toLowerCase())).slice(0,8):productos.slice(0,8);
  return(
    <div style={{display:"flex",gap:6,alignItems:"flex-start",position:"relative"}}>
      <div style={{flex:1,position:"relative"}}>
        <input
          style={{...S.inp}}
          placeholder="Escribir para buscar producto..."
          value={open?busq:(selP?`${selP.nombre} — $${(selP.precio||0).toFixed(2)} (stock ${selP.stock})`:"Sin productos en catálogo")}
          onFocus={()=>{setOpen(true);setBusq("");}}
          onChange={e=>{setBusq(e.target.value);setOpen(true);}}
          onBlur={()=>setTimeout(()=>setOpen(false),200)}
        />
        {open&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid #4db6e4",borderRadius:8,zIndex:50,boxShadow:"0 4px 16px rgba(0,0,0,.15)",maxHeight:220,overflowY:"auto"}}>
            {filtrados.length===0?<div style={{padding:"10px 14px",color:"#aaa",fontSize:13}}>Sin resultados</div>
              :filtrados.map(p=>(
              <div key={p.id} style={{padding:"10px 14px",cursor:p.stock>0?"pointer":"not-allowed",opacity:p.stock>0?1:0.5,borderBottom:"1px solid #f0f4f8",fontSize:13,background:p.id===productoId?"#e8f5fd":"#fff"}}
                onMouseDown={()=>{if(p.stock>0){onProdChange(p.id);setBusq("");setOpen(false);}}}>
                <div style={{fontWeight:600}}>{p.nombre}</div>
                <div style={{color:p.stock>0?"#4db6e4":"#c62828",fontWeight:700,fontSize:12}}>${(p.precio||0).toFixed(2)} · stock {p.stock}{p.stock<=0?" — agotado":""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <input type="number" min={1} max={selP?.stock||undefined} style={{...S.inp,width:56,textAlign:"center"}} value={piezas} onChange={e=>onPiezasChange(e.target.value)}/>
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
    if(p.tipo==="segundo50")return{...p,precioTxt:`-${p.pct||50}% (2da unidad)`};
    const s=servicios.find(x=>x.id===p.servId&&!x.eliminada);
    if(!s)return null; // si el servicio ya no existe, la promo no se muestra
    return{...p,precioTxt:`$${s.precio.toFixed(2)}`,detalle:p.detalle};
  };
  return (promos&&promos.length?promos:DEFAULT_PROMOS)
    .filter(p=>!p.dias||p.dias.length===0||p.dias.includes(dow))
    .sort((a,b)=>((a.dias&&a.dias.length)?0:1)-((b.dias&&b.dias.length)?0:1)) // primero las exclusivas de hoy
    .map(resolver).filter(Boolean).slice(0,PROMOS_MAX);
};

function SegundaUnidadPicker({promo,servicios,onElegir,onCancelar}){
  const filtro=(promo.filtro||"").toUpperCase().trim();
  const opciones=servicios.filter(s=>!s.eliminada&&(!filtro||s.label.toUpperCase().includes(filtro)));
  const pct=promo.pct||50;
  return(
    <div style={{...S.ov,zIndex:95}}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:380,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.35)"}}>
        <div style={{background:"linear-gradient(135deg,#1a3c5e,#2563a8)",borderRadius:"18px 18px 0 0",padding:"18px 20px",textAlign:"center"}}>
          <div style={{fontSize:36}}>{promo.emoji||"🎁"}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#fff"}}>{promo.titulo}</div>
          <div style={{fontSize:12,color:"#a0c4da"}}>¿Cuál es la segunda unidad? (-{pct}%)</div>
        </div>
        <div style={{padding:"14px 16px"}}>
          {opciones.length===0&&<div style={{textAlign:"center",color:"#888",fontSize:13,padding:"10px 0"}}>No hay servicios que coincidan con "{promo.filtro}". Revisa la palabra clave de esta promo en el panel admin.</div>}
          {opciones.map(s=>(
            <button key={s.id} onClick={()=>onElegir(s)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",textAlign:"left",background:"#f8fbfd",border:"1.5px solid #e8f0f7",borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              <div style={{fontWeight:700,fontSize:14,color:"#1a3c5e"}}>{s.label}</div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:11,color:"#c62828",textDecoration:"line-through"}}>${s.precio.toFixed(2)}</div>
                <div style={{fontWeight:800,fontSize:15,color:"#2e7d32"}}>${(s.precio*(1-pct/100)).toFixed(2)}</div>
              </div>
            </button>
          ))}
          <button style={{...S.btnC,width:"100%"}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

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

function NuevaVenta({ventas,setVentas,clientes,setClientes,empleadas,setTicket,servicios,sesion,upsertVenta,upsertCliente,cupones=[],setCupones,upsertCupon,promos,productos=[],setProductos,upsertProducto,setKardexProductos,upsertKardexProducto,sorteos=[],setSorteos,upsertSorteo,setBoletosSorteo,upsertBoletoSorteo,onBoletosGenerados}){
  const man=new Date();man.setDate(man.getDate()+1);
  const [cQ,setCQ]=useState("");const [cId,setCId]=useState(null);
  const [nC,setNC]=useState({nombre:"",tel:"",cedula:"",email:"",rfc:"",direccion:"",nacimiento:""});
  const [mC,setMC]=useState("buscar");
  const empDef=empleadas.find(e=>normNombre(e.nombre)&&normNombre(e.nombre)===normNombre(sesion?.nombre))
    ||empleadas.find(e=>normNombre(e.nombre)&&(normNombre(sesion?.nombre).includes(normNombre(e.nombre))||normNombre(e.nombre).includes(normNombre(sesion?.nombre))))
    ||empleadas.find(e=>{
        const enom=normNombre(e.nombre).split(" ")[0];
        const snom=normNombre(sesion?.nombre).split(" ")[0];
        return enom&&snom&&enom===snom;
      })
    ||null; // 🔒 si no hay coincidencia segura por nombre, NO adivinar por ID (eso causaba el bug de mostrar a la persona equivocada)
  const [empId,setEmpId]=useState(empDef?.id||empleadas[0]?.id||null);
  const [items,setItems]=useState([{servId:servicios[0]?.id,piezas:1,custom:false,esProducto:false,productoId:null,lC:"",pC:""}]);
  const [entrega,setEntrega]=useState((()=>{const off=man.getTimezoneOffset();const l=new Date(man.getTime()-off*60000);return l.toISOString().split("T")[0];})());
  const [notas,setNotas]=useState("");const [err,setErr]=useState("");
  const [tPago,setTPago]=useState("completo");const [metodo,setMetodo]=useState("Efectivo");const [abono,setAbono]=useState("");
  const [waVenta,setWaVenta]=useState(null);
  const [showPromos,setShowPromos]=useState(false); // 🎁 sale al tocar "Registrar venta"
  const [promoOfrecida,setPromoOfrecida]=useState(false); // ya se ofreció en esta venta
  const [impulsos,setImpulsos]=useState([]); // 🎯 promos impulsadas en esta venta (para métricas por colaboradora)
  const [segundaPromoActiva,setSegundaPromoActiva]=useState(null); // 🔁 promo "2da unidad al %" esperando que elijan el servicio
  const [cupInput,setCupInput]=useState("");const [cupApl,setCupApl]=useState(null);const [cupErr,setCupErr]=useState(""); // 🎟️ cupón
  const [descCumple,setDescCumple]=useState(false); // 🎂 10% cumpleaños
  const [tienePrendaMancha,setTienePrendaMancha]=useState(null); // null=sin responder, true/false — 🧽 obligatorio antes de registrar
  const [protocoloCumplido,setProtocoloCumplido]=useState(true); // 📋 para Evaluación de Desempeño — checklist de atención al cliente (saludo, confirmar datos, explicar tiempos, despedida)
  const [boletoResena,setBoletoResena]=useState(false); // 🌟 opcional — boleto extra si sigue redes y deja reseña en Google
  const [obsPrendaMancha,setObsPrendaMancha]=useState("");
  const cFilt=clientes.filter(c=>c.nombre.toLowerCase().includes(cQ.toLowerCase())||(c.tel&&c.tel.includes(cQ))).slice(0,5);
  const selC=clientes.find(c=>c.id===cId);
  // 🛍️ Productos activos disponibles para vender (catálogo, sin los eliminados)
  const productosActivos=(productos||[]).filter(p=>!p.eliminada);
  const calcT=()=>items.reduce((a,it)=>{
    if(it.custom)return a+(parseFloat(it.pC)||0)*(it.piezas||1);
    if(it.esProducto){const p=productosActivos.find(x=>x.id===it.productoId);return a+(p?(p.precio||0)*(it.piezas||1):0);}
    const s=servicios.find(s=>s.id===it.servId);return a+(s?s.precio*(it.piezas||1):0);
  },0);
  const addIt=()=>setItems([...items,{servId:servicios[0]?.id,piezas:1,custom:false,esProducto:false,productoId:null,lC:"",pC:""}]);
  const remIt=i=>setItems(items.filter((_,idx)=>idx!==i));
  const updIt=(i,f,v)=>{
    const c=[...items];
    if(f==="piezas"){
      if(c[i].esProducto){
        const p=productosActivos.find(x=>x.id===c[i].productoId);
        if(p&&v>p.stock){
          alert(`⚠️ Solo quedan ${p.stock} unidad(es) de "${p.nombre}" en stock.`);
          v=p.stock;
        }
      }else{
        const s=servicios.find(x=>x.id===c[i].servId);
        if(s?.limite&&v>s.limite){
          alert(`⚠️ "${s.label}" tiene un máximo de ${s.limite} por venta.`);
          v=s.limite;
        }
      }
    }
    c[i]={...c[i],[f]:v};
    setItems(c);
  };
  const setTipoItem=(i,tipo)=>{
    const c=[...items];
    c[i]={...c[i],custom:tipo==="custom",esProducto:tipo==="producto"};
    setItems(c);
  };
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
    if(p.tipo==="segundo50"){
      const filtro=(p.filtro||"").toUpperCase().trim();
      const hayBase=items.some(it=>!it.custom&&!it.deCupon&&(()=>{const s=servicios.find(x=>x.id===it.servId);return s&&(!filtro||s.label.toUpperCase().includes(filtro));})());
      if(!hayBase){
        alert(`Agrega primero el servicio (ej. edredón) a la venta antes de aplicar el descuento de la segunda unidad. 🛒`);
        return;
      }
      cerrarPromos();
      setSegundaPromoActiva(p);
      return;
    }
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
  const elegirSegundaUnidad=s=>{
    const p=segundaPromoActiva;if(!p)return;
    const pct=p.pct||50;
    const precioProm=s.precio*(1-pct/100);
    setItems(prev=>[...prev,{servId:s.id,piezas:1,custom:true,lC:`🎉 ${p.titulo} · ${s.label}`,pC:precioProm.toFixed(2)}]);
    setImpulsos(prev=>[...prev,{promoId:p.id,titulo:p.titulo,fecha:new Date().toISOString()}]); // 🎯 impulsación registrada
    setSegundaPromoActiva(null);
  };
  const reg=(saltarPromos=false)=>{
    // 🎁 Antes de cerrar la venta: recordar las promos del día (1 vez por venta)
    if(!saltarPromos&&!promoOfrecida&&promosDeHoy(promos,servicios).length>0){
      setPromoOfrecida(true);setShowPromos(true);return;
    }
    if(!cId&&mC==="buscar"){setErr("Selecciona o crea un cliente");return;}
    if(mC==="nuevo"&&!nC.nombre.trim()){setErr("Escribe el nombre del cliente");return;}
    // 🧽 Obligatorio antes de continuar: ¿hay alguna prenda que pueda manchar/destiñir el resto de la carga?
    if(tienePrendaMancha===null){setErr("Falta indicar si hay alguna prenda que pueda manchar o destiñir el resto de la carga (Sí/No)");return;}
    if(tienePrendaMancha&&!obsPrendaMancha.trim()){setErr("Describe cuál es la prenda que puede manchar antes de continuar");return;}
    const bruto=calcT();
    const cumpleOk=(mC==="buscar"&&clientes.find(c=>c.id===cId&&puedeUsarDescCumple(c)))||(mC==="nuevo"&&!!cicloCumpleVigente(nC.nacimiento));
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
    // 🎂 Si se aplicó el descuento de cumpleaños, se marca en el cliente para que no lo pueda volver a usar en este mismo ciclo (7 días)
    if(descC>0){
      const cicloUsado=cicloCumpleVigente(mC==="nuevo"?nC.nacimiento:selC?.nacimiento);
      if(cicloUsado){
        setClientes(prev=>{
          const next=prev.map(c=>c.id===cid?{...c,descCumpleUsadoCiclo:cicloUsado}:c);
          const updated=next.find(c=>c.id===cid);
          if(updated&&upsertCliente)upsertCliente({...updated,_updatedAt:new Date().toISOString()});
          return next;
        });
      }
    }
    let abs=[];
    if(tPago==="completo")abs=[{monto:total,metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    else if(tPago==="abono")abs=[{monto:parseFloat(abono),metodo,fecha:new Date().toISOString(),cobradoPorId:sesion?.id,cobradoPorNombre:sesion?.nombre}];
    // 🛍️ Si TODOS los renglones de la venta son productos, no pasa por Producción: se factura y sale directo (queda "entregado" de una vez)
    const todosProductos=items.length>0&&items.every(it=>it.esProducto);
    const v={folio:folio(),fecha:new Date().toISOString(),entrega,clienteId:cid,clienteNombre:cNom,clienteTel:cTel,clienteDireccion:cDir,empleadaId:empId,
      impulsos, // 🎯 quién impulsó qué promos (empleadaId ya viaja en la venta)
      items:[...items.map(it=>{
        if(it.custom)return{...it,label:it.lC||"Servicio personalizado",precio:parseFloat(it.pC)||0};
        if(it.esProducto){const p=productosActivos.find(x=>x.id===it.productoId);return{...it,label:p?.nombre||"Producto",precio:p?.precio||0};}
        const s=servicios.find(s=>s.id===it.servId);return{...it,label:s?.label,precio:s?.precio};
      }),...(descC>0?[{custom:true,piezas:1,label:"🎂 DESCUENTO CUMPLEAÑOS (-10%)",precio:-descC}]:[])],
      pago:metodo,total,abonos:abs,pagada:tPago==="completo",notas,checkMsgRetiro:false,checkMsgEntrega:false,facturadoSRI:false,estado:todosProductos?"entregado":"recibido",
      cuponId:cupApl?.id||null,
      prendaManchaAviso:!!tienePrendaMancha,prendaManchaObs:tienePrendaMancha?obsPrendaMancha.trim():null,
      boletoResenaSolicitado:!!boletoResena,protocoloCumplido:!!protocoloCumplido};
    setVentas([v,...ventas]);if(upsertVenta)upsertVenta(v);
    // 🛍️ Descuenta del stock cada producto vendido en esta venta, y deja el movimiento en el Kardex
    const prodsVendidos=items.filter(it=>it.esProducto&&it.productoId);
    if(prodsVendidos.length>0&&setProductos){
      setProductos(prev=>{
        const next=prev.map(p=>{
          const vend=prodsVendidos.find(it=>it.productoId===p.id);
          if(!vend)return p;
          return{...p,stock:Math.max(0,(p.stock||0)-(vend.piezas||1))};
        });
        prodsVendidos.forEach(it=>{
          const updated=next.find(p=>p.id===it.productoId);
          if(updated&&upsertProducto)upsertProducto({...updated,_updatedAt:new Date().toISOString()});
          if(updated&&setKardexProductos)registrarKardex({itemId:it.productoId,itemNombre:updated.nombre,tipo:"venta",cantidad:-(it.piezas||1),folio:v.folio,saldoResultante:updated.stock,registradoPor:sesion?.nombre},{setKardex:setKardexProductos,upsertKardex:upsertKardexProducto});
        });
        return next;
      });
    }
    if(cupApl){ // 🎟️ quemar el cupón: un solo uso, sincronizado en la nube
      const usado={...cupApl,estado:"usado",usadoEn:v.folio,usadoFecha:new Date().toISOString()};
      if(setCupones)setCupones(prev=>prev.map(c=>c.id===cupApl.id?usado:c));
      if(upsertCupon)upsertCupon(usado);
    }
    // 🎟️ Si la venta quedó pagada por completo, revisa si corresponde generar boleto(s) de sorteo
    if(v.pagada&&setBoletosSorteo&&setSorteos){
      const generados=generarBoletosParaVenta(v,{sorteos,setSorteos,upsertSorteo,setBoletosSorteo,upsertBoletoSorteo,productos:productosActivos});
      if(generados.length>0){
        setVentas(prev=>{
          const next=prev.map(vv=>vv.folio===v.folio?{...vv,boletoSorteoGenerado:true}:vv);
          const updated=next.find(vv=>vv.folio===v.folio);
          if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
          return next;
        });
        if(onBoletosGenerados)onBoletosGenerados({boletos:generados});
      }
    }
    setWaVenta(v); // WhatsApp obligatorio antes de mostrar el ticket
    setCQ("");setCId(null);setNC({nombre:"",tel:"",cedula:"",email:"",rfc:"",direccion:"",nacimiento:""});setDescCumple(false);setImpulsos([]);setCupApl(null);setCupInput("");setCupErr("");
    setTienePrendaMancha(null);setObsPrendaMancha("");setBoletoResena(false);setProtocoloCumplido(true);
    setItems([{servId:servicios[0]?.id,piezas:1,custom:false,esProducto:false,productoId:null,lC:"",pC:""}]);
    setNotas("");setErr("");setAbono("");setTPago("completo");
  };
  const confirmarWaRecibido=info=>{
    const v2={...waVenta,msgRecibido:info};
    setVentas(prev=>{const next=prev.map(vv=>vv.folio===waVenta.folio?{...vv,msgRecibido:info}:vv);return next;});
    if(upsertVenta)upsertVenta(v2);
    setWaVenta(null);setTicket(v2);
    setPromoOfrecida(false); // 🎁 la siguiente venta volverá a recordar las promos al guardar
  };
  const clienteCumple=(mC==="buscar"&&selC&&puedeUsarDescCumple(selC))||(mC==="nuevo"&&!!cicloCumpleVigente(nC.nacimiento));
  const cuponClienteVig=(mC==="buscar"&&selC)?(cupones||[]).find(c=>String(c.clienteId)===String(selC.id)&&cuponVigente(c)&&(!cupApl||c.id!==cupApl.id)):null;
  const promosHoy=promosDeHoy(promos,servicios);
  const nombreCumple=mC==="buscar"?selC?.nombre:nC.nombre||"el cliente";
  const totalBruto=calcT();
  const descMonto=clienteCumple&&descCumple?+(totalBruto*DESC_CUMPLE).toFixed(2):0;
  const total=+(totalBruto-descMonto).toFixed(2);
  const detItems=items.map(it=>{
    const s=(it.custom||it.esProducto)?null:servicios.find(s=>s.id===it.servId);
    const p=it.esProducto?productosActivos.find(x=>x.id===it.productoId):null;
    const precio=it.custom?(parseFloat(it.pC)||0):it.esProducto?(p?.precio||0):(s?.precio||0);
    return{label:it.custom?(it.lC||"Personalizado"):it.esProducto?(p?.nombre||"Producto"):(s?.label||""),sub:+(precio*(it.piezas||1)).toFixed(2)};
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
            {cQ&&cFilt.length>0&&!cId&&<div style={S.drop}>{cFilt.map(c=><div key={c.id} style={S.dropI} onClick={()=>{setCId(c.id);setCQ(c.nombre);}}><strong>{c.nombre}</strong> <SemaforoCliente clienteId={c.id} ventas={ventas}/> <span style={{color:"#888",fontSize:12}}>{c.tel}</span></div>)}</div>}
            {cId&&selC&&<div style={S.ctag}>✓ {selC.nombre} <SemaforoCliente clienteId={selC.id} ventas={ventas}/>{selC.tel?` · ${selC.tel}`:""}<button style={{background:"none",border:"none",color:"#2e7d32",cursor:"pointer",fontWeight:700}} onClick={()=>{setCId(null);setCQ("");}}>✕</button></div>}
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
                <div style={{fontWeight:800,color:"#b45309",fontSize:14}}>🎂 {nombreCumple} tiene su descuento de cumpleaños disponible</div>
                <div style={{fontSize:12,color:"#92600a"}}>Válido hasta 7 días después de su cumpleaños, una sola vez — aplícale su 10% de descuento 🎉</div>
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
            <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center",flexWrap:"wrap"}}>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(!it.custom&&!it.esProducto?S.pillA:{})}} onClick={()=>setTipoItem(i,"servicio")}>Del menu</button>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.esProducto?S.pillA:{})}} onClick={()=>setTipoItem(i,"producto")}>🛍️ Producto</button>
              <button style={{...S.pill,fontSize:11,padding:"4px 10px",...(it.custom?S.pillA:{})}} onClick={()=>setTipoItem(i,"custom")}>Personalizado</button>
              {items.length>1&&<button style={{...S.btnR,marginLeft:"auto"}} onClick={()=>remIt(i)}>✕</button>}
            </div>
            {it.custom?(
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center"}}>
                <input style={S.inp} placeholder="Nombre del servicio" value={it.lC} onChange={e=>updIt(i,"lC",e.target.value)}/>
                <input type="number" style={{...S.inp,width:80}} placeholder="$Precio" value={it.pC} onChange={e=>updIt(i,"pC",e.target.value)}/>
                <input type="number" min={1} style={{...S.inp,width:56,textAlign:"center"}} value={it.piezas} onChange={e=>updIt(i,"piezas",parseInt(e.target.value)||1)}/>
              </div>
            ):it.esProducto?(
              productosActivos.length===0
                ?<div style={{fontSize:12,color:"#c62828"}}>Aún no hay productos en el catálogo. Ve a 🛍️ Productos en el panel admin para agregar el primero.</div>
                :<ProductoBuscador productoId={it.productoId} piezas={it.piezas} productos={productosActivos} onProdChange={v=>updIt(i,"productoId",v)} onPiezasChange={v=>updIt(i,"piezas",parseInt(v)||1)}/>
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
      <Card title="📋 Protocolo de atención">
        <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:protocoloCumplido?"#e8f5e9":"#ffebee",borderRadius:10,cursor:"pointer",border:"1.5px solid "+(protocoloCumplido?"#2e7d32":"#e53935")}}>
          <input type="checkbox" checked={protocoloCumplido} onChange={e=>setProtocoloCumplido(e.target.checked)} style={{width:18,height:18}}/>
          <span style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>✅ Cumplí el protocolo completo (saludo, confirmar datos del cliente, explicar tiempos, despedida)</span>
        </label>
      </Card>
      <Card title="🧽 Prendas que pueden manchar">
        <div style={{fontSize:13,color:"#1a3c5e",marginBottom:10}}>¿El cliente trae alguna prenda que pueda <strong>destiñir o manchar</strong> el resto de la carga? (ej. ropa nueva de color fuerte, prendas oscuras sin lavar antes, etc.)</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button style={{...S.pill,flex:1,textAlign:"center",...(tienePrendaMancha===false?S.pillA:{})}} onClick={()=>{setTienePrendaMancha(false);setObsPrendaMancha("");setErr("");}}>No</button>
          <button style={{...S.pill,flex:1,textAlign:"center",...(tienePrendaMancha===true?{...S.pillA,background:"#e65100",border:"1.5px solid #e65100"}:{})}} onClick={()=>{setTienePrendaMancha(true);setErr("");}}>Sí</button>
        </div>
        {tienePrendaMancha===true&&(
          <div>
            <label style={S.lbl}>¿Cuál prenda? (obligatorio)</label>
            <textarea style={{...S.inp,minHeight:56,resize:"vertical"}} placeholder="ej. Camiseta roja nueva, chompa negra..." value={obsPrendaMancha} onChange={e=>{setObsPrendaMancha(e.target.value);setErr("");}}/>
          </div>
        )}
        {tienePrendaMancha===null&&<div style={{fontSize:11,color:"#e65100",fontWeight:600}}>⚠️ Debes responder Sí o No antes de registrar la venta.</div>}
      </Card>
      {sorteoActivoHoy(sorteos)&&(
        <Card title="🌟 Boleto extra por seguirnos y dejar reseña">
          <div style={{fontSize:13,color:"#1a3c5e",marginBottom:10}}>¿El cliente acepta seguirnos en redes (Instagram/Facebook) y dejarnos una reseña en Google? Si acepta, se le suma <strong>1 boleto extra</strong> al sorteo activo.</div>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:boletoResena?"#fff8e1":"#f8fbfd",borderRadius:10,cursor:"pointer",border:"1.5px solid "+(boletoResena?"#f59e0b":"#e8f0f7")}}>
            <input type="checkbox" checked={boletoResena} onChange={e=>setBoletoResena(e.target.checked)} style={{width:18,height:18}}/>
            <span style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>🌟 Sí, el cliente sigue nuestras redes y dejó su reseña — dale su boleto extra</span>
          </label>
          <div style={{fontSize:11,color:"#888",marginTop:6}}>Opcional — no es necesario para poder registrar la venta.</div>
        </Card>
      )}
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
        <div style={{marginTop:8}}><label style={S.lbl}>Empleada (quien abrió sesión)</label>
          {empDef?(
            <div style={{...S.inp,display:"flex",alignItems:"center",gap:8,background:"#f0f4f8",color:"#1a3c5e",fontWeight:700,cursor:"not-allowed"}}>
              🔒 {empDef.nombre}
            </div>
          ):(
            <>
              <div style={{fontSize:12,color:"#c62828",fontWeight:700,marginBottom:4}}>⚠️ No se pudo identificar automáticamente tu usuario. Selecciona tu nombre manualmente:</div>
              <select style={S.inp} value={empId||""} onChange={e=>setEmpId(parseInt(e.target.value))}>
                <option value="" disabled>Selecciona quién atiende...</option>
                {empleadas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </>
          )}
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
            <div style={{background:"#fff",borderRadius:8,padding:"9px 11px",fontSize:13,marginBottom:7,color:"#00695C",fontWeight:600}}>🎂 <strong>{nombreCumple}</strong> está dentro de sus 7 días de cumpleaños (y no lo ha usado todavía) — ¡ofrécele el 10% de descuento!</div>
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
      {segundaPromoActiva&&<SegundaUnidadPicker promo={segundaPromoActiva} servicios={servicios} onElegir={elegirSegundaUnidad} onCancelar={()=>setSegundaPromoActiva(null)}/>}
      {waVenta&&<WhatsAppObligatorio venta={waVenta} tipo="recibido" onConfirm={confirmarWaRecibido}/>}
    </div>
  );
}

// ↩️ NOTA DE CRÉDITO — devuelve al stock los productos de una venta (por defecto/anulación parcial), dejando registro en el Kardex
function NotaCreditoModal({venta,productos,onConfirmar,onCancelar}){
  const itemsProducto=(venta.items||[]).map((it,idx)=>({...it,idx})).filter(it=>it.esProducto&&it.productoId);
  const [sel,setSel]=useState({}); // {idx:cantidadADevolver}
  const [motivo,setMotivo]=useState("");
  const [err,setErr]=useState("");
  const toggle=(idx,piezasMax)=>setSel(prev=>{const c={...prev};if(c[idx]!==undefined)delete c[idx];else c[idx]=piezasMax;return c;});
  const confirmar=()=>{
    if(Object.keys(sel).length===0){setErr("Selecciona al menos un producto para devolver");return;}
    if(!motivo.trim()){setErr("Escribe el motivo de la nota de crédito");return;}
    const devoluciones=itemsProducto.filter(it=>sel[it.idx]!==undefined).map(it=>({productoId:it.productoId,nombre:it.label,cantidad:parseInt(sel[it.idx])||1}));
    onConfirmar(devoluciones,motivo.trim());
  };
  return(
    <div style={S.ov}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:400,maxHeight:"85vh",overflowY:"auto",padding:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a3c5e",marginBottom:4,textAlign:"center"}}>↩️ Nota de crédito</div>
        <div style={{fontSize:12,color:"#888",textAlign:"center",marginBottom:14}}>Selecciona qué productos de esta venta se devuelven al inventario</div>
        {itemsProducto.length===0&&<div style={{textAlign:"center",color:"#aaa",fontSize:13,padding:"10px 0"}}>Esta venta no tiene productos de catálogo con control de stock.</div>}
        {itemsProducto.map(it=>{
          const p=(productos||[]).find(x=>x.id===it.productoId);
          return(
            <label key={it.idx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:sel[it.idx]!==undefined?"#e8f5e9":"#f8fbfd",border:"1.5px solid "+(sel[it.idx]!==undefined?"#2e7d32":"#e8f0f7"),borderRadius:10,marginBottom:8,cursor:"pointer"}}>
              <input type="checkbox" checked={sel[it.idx]!==undefined} onChange={()=>toggle(it.idx,it.piezas||1)}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:"#1a3c5e"}}>{it.label}</div>
                <div style={{fontSize:11,color:"#888"}}>Vendidas: {it.piezas||1} · Stock actual: {p?.stock??"—"}</div>
              </div>
              {sel[it.idx]!==undefined&&<input type="number" min="1" max={it.piezas||1} style={{...S.inp,width:56,padding:"4px 6px"}} value={sel[it.idx]} onChange={e=>setSel({...sel,[it.idx]:Math.min(parseInt(e.target.value)||1,it.piezas||1)})}/>}
            </label>
          );
        })}
        <div style={{marginTop:6}}>
          <label style={S.lbl}>Motivo (obligatorio)</label>
          <textarea style={{...S.inp,minHeight:56,resize:"vertical"}} placeholder="ej. Cliente devolvió el producto sin abrir..." value={motivo} onChange={e=>{setMotivo(e.target.value);setErr("");}}/>
        </div>
        {err&&<div style={{color:"#c62828",fontSize:12,fontWeight:600,marginTop:8}}>{err}</div>}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button style={{...S.btnP,flex:1}} onClick={confirmar}>✓ Confirmar devolución</button>
          <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function VentaCardItem({v,empleadas,setTicket,addAbono,setVentas,esAdmin,upsertVenta,sesion,productos,setProductos,upsertProducto,setKardexProductos,upsertKardexProducto,setQuejas,upsertQueja}){
  const [showAb,setShowAb]=useState(false);
  const [waListo,setWaListo]=useState(false);
  const [showNotaCredito,setShowNotaCredito]=useState(false);
  const tieneProductos=(v.items||[]).some(it=>it.esProducto&&it.productoId);
  const confirmarNotaCredito=(devoluciones,motivo)=>{
    if(setProductos){
      setProductos(prev=>{
        const next=prev.map(p=>{
          const dev=devoluciones.find(d=>d.productoId===p.id);
          if(!dev)return p;
          return{...p,stock:(p.stock||0)+dev.cantidad};
        });
        devoluciones.forEach(dev=>{
          const updated=next.find(p=>p.id===dev.productoId);
          if(updated&&upsertProducto)upsertProducto({...updated,_updatedAt:new Date().toISOString()});
          if(updated)registrarKardex({itemId:dev.productoId,itemNombre:updated.nombre,tipo:"nota_credito",cantidad:dev.cantidad,folio:v.folio,motivo,saldoResultante:updated.stock,registradoPor:sesion?.nombre},{setKardex:setKardexProductos,upsertKardex:upsertKardexProducto});
        });
        return next;
      });
    }
    if(setVentas){
      setVentas(prev=>{
        const next=prev.map(vv=>vv.folio===v.folio?{...vv,notasCredito:[...(vv.notasCredito||[]),{fecha:new Date().toISOString(),motivo,devoluciones,registradoPor:sesion?.nombre||null}]}:vv);
        const updated=next.find(vv=>vv.folio===v.folio);
        if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }
    setShowNotaCredito(false);
  };
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
        {v.anulada&&<div style={{background:"#ffebee",borderRadius:6,padding:"6px 10px",marginTop:6,fontSize:12,color:"#c62828"}}>❌ ANULADA por <strong>{v.anuladaPor||"—"}</strong> — Motivo: {v.motivoAnulacion}{v.anuladaEn?` · ${fmt(v.anuladaEn)}`:""}</div>}
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
          {!v.anulada&&esAdmin&&setVentas&&<button style={{...S.btnT,background:"#ffebee",color:"#c62828"}} onClick={()=>{const m=window.prompt("Motivo de anulacion:");if(m===null||!m.trim())return;setVentas(prev=>{const next=prev.map(vv=>vv.folio===v.folio?{...vv,anulada:true,motivoAnulacion:m,anuladaPor:sesion?.nombre||"Administrador",anuladaEn:new Date().toISOString()}:vv);const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});return next;});}}>❌ Anular</button>}
          {!v.anulada&&esAdmin&&tieneProductos&&setProductos&&<button style={{...S.btnT,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>setShowNotaCredito(true)}>↩️ Nota de crédito</button>}
          {!v.anulada&&esAdmin&&setQuejas&&<button style={{...S.btnT,background:"#fff3e0",color:"#e65100"}} onClick={()=>{
            const emp=empleadas.find(e=>e.id===v.empleadaId);
            const motivo=window.prompt(`¿Motivo de la queja sobre esta orden?${emp?` (atendida por ${emp.nombre})`:""}`,"");
            if(motivo===null||!motivo.trim())return;
            const q={id:"queja_"+Date.now(),empleadaId:v.empleadaId||null,ventaFolio:v.folio,clienteNombre:v.clienteNombre||"",motivo:motivo.trim(),fecha:new Date().toISOString(),registradoPor:sesion?.nombre||null};
            setQuejas(prev=>[q,...prev]);
            if(upsertQueja)upsertQueja({...q,_updatedAt:new Date().toISOString()});
            alert("Queja registrada.");
          }}>📢 Registrar queja</button>}
        </div>
        {(v.notasCredito||[]).length>0&&(
          <div style={{marginTop:8,background:"#e8f5e9",borderRadius:8,padding:"8px 10px"}}>
            {v.notasCredito.map((nc,i)=>(
              <div key={i} style={{fontSize:11,color:"#2e7d32",marginBottom:2}}>↩️ {fmt(nc.fecha)} · {nc.devoluciones.map(d=>`${d.nombre} x${d.cantidad}`).join(", ")} · {nc.motivo}</div>
            ))}
          </div>
        )}
      </div>
      {showAb&&<AbonoModal venta={v} onSave={ab=>{addAbono(v.folio,ab);setShowAb(false);}} onClose={()=>setShowAb(false)}/>}
      {waListo&&<WhatsAppObligatorio venta={v} tipo="listo" onConfirm={info=>{aplicarEstado("listo",{checkMsgRetiro:info.enviado,msgListo:info});setWaListo(false);}} onCancel={()=>setWaListo(false)}/>}
      {showNotaCredito&&<NotaCreditoModal venta={v} productos={productos} onConfirmar={confirmarNotaCredito} onCancelar={()=>setShowNotaCredito(false)}/>}
    </>
  );
}

function Historial({ventas,setVentas,empleadas,setTicket,addAbono,esAdmin,upsertVenta,sesion,productos,setProductos,upsertProducto,setKardexProductos,upsertKardexProducto,setQuejas,upsertQueja}){
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
      {filtered.length===0?<div style={S.empty}>Sin resultados</div>:filtered.map(v=><VentaCardItem key={v.folio} v={v} empleadas={empleadas} setTicket={setTicket} addAbono={addAbono} setVentas={setVentas} esAdmin={esAdmin} upsertVenta={upsertVenta} sesion={sesion} productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} setQuejas={setQuejas} upsertQueja={upsertQueja}/>)}
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
        {[{id:"resumen",l:"📈 Resumen"},{id:"empleadas",l:"👩 Vendedoras"},{id:"depositos",l:"💵 Depositos"},{id:"salidas",l:"💸 Salidas"},{id:"cuadre",l:"🧮 Cuadre"},{id:"ventas",l:"📋 Ventas"},{id:"excel",l:"📥 Excel"}].map(t=>(
          <button key={t.id} style={{...S.pill,...(sub===t.id?S.pillA:{}),fontSize:12}} onClick={()=>setSub(t.id)}>{t.l}</button>
        ))}
      </div>
      <div style={{marginBottom:12}}><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={mesS} onChange={e=>setMesS(e.target.value)}/></div>
      {sub==="empleadas"&&(()=>{
        const nombreDeE=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"Sin asignar";
        const vRngOrdenado=[...vRng].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
        const porEmp={};
        vRng.forEach(v=>{const n=nombreDeE(v.empleadaId);if(!porEmp[n])porEmp[n]={cnt:0,tot:0};porEmp[n].cnt++;porEmp[n].tot+=v.total;});
        const rankingRango=Object.entries(porEmp).sort((a,b)=>b[1].tot-a[1].tot);
        const descargarPorEmpleada=()=>{
          if(vRngOrdenado.length===0){alert("No hay ventas en ese rango de fechas.");return;}
          const enc=["Empleada","Folio","Cliente","Servicios","Fecha","Hora","Total"];
          const filas=vRngOrdenado.map(v=>{
            const dt=new Date(v.fecha);
            return[nombreDeE(v.empleadaId),v.folio,v.clienteNombre||"",(v.items||[]).map(it=>it.label+(it.piezas>1?` x${it.piezas}`:"")).join(" | "),fmtD(v.fecha),dt.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),"$"+v.total.toFixed(2)];
          });
          filas.push(["","","","","","",""]);
          rankingRango.forEach(([n,d])=>filas.push([n,d.cnt+" venta(s)","","","","","$"+d.tot.toFixed(2)]));
          filas.push(["TOTAL",vRngOrdenado.length+" venta(s)","","","","","$"+sum(vRng).toFixed(2)]);
          const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
          const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
          const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="ventas_por_vendedora-"+desde+"_a_"+hasta+".csv";a.click();
        };
        return(<div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
            <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
          </div>
          <div style={{fontSize:12,color:"#888",marginBottom:10}}>{vRng.length} ventas · Total: ${sum(vRng).toFixed(2)}</div>
          <button style={{...S.btnP,marginBottom:14}} onClick={descargarPorEmpleada}>📥 Descargar CSV (quién vendió, servicio, fecha, hora y monto)</button>
          <Card title="🏆 Total facturado por vendedora (en el rango)">
            {rankingRango.length===0?<div style={S.empty}>Sin ventas en ese rango</div>:rankingRango.map(([n,d])=>(
              <div key={n} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
                <span style={{fontWeight:600}}>{n}</span>
                <span><strong>${d.tot.toFixed(2)}</strong> <span style={{color:"#888",fontSize:12}}>({d.cnt} venta{d.cnt!==1?"s":""})</span></span>
              </div>
            ))}
          </Card>
          <Card title={`🧾 Detalle venta por venta (${vRngOrdenado.length})`}>
            {vRngOrdenado.length===0&&<div style={S.empty}>Sin ventas en ese rango</div>}
            {vRngOrdenado.slice(0,200).map(v=>{
              const dt=new Date(v.fecha);
              return(
                <div key={v.folio} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#1a3c5e"}}>{nombreDeE(v.empleadaId)}</div>
                    <div style={{fontSize:11,color:"#888"}}>{v.clienteNombre||"—"} · {v.folio} · {fmtD(v.fecha)} {dt.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</div>
                    <div style={{fontSize:12,color:"#4db6e4",marginTop:2}}>{(v.items||[]).map(it=>it.label+(it.piezas>1?` x${it.piezas}`:"")).join(" · ")}</div>
                  </div>
                  <strong style={{color:"#1a3c5e",flexShrink:0,marginLeft:8}}>${v.total.toFixed(2)}</strong>
                </div>
              );
            })}
          </Card>
        </div>);
      })()}
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
        <div style={{fontSize:12,color:"#888",marginBottom:10}}>Cada descarga trae el detalle venta por venta y, al final del archivo, una fila de <strong>TOTALES</strong> con lo vendido, lo cobrado y lo pendiente por cobrar — para cuadrar cuentas de fin de mes y saber cuánto retirar a la cuenta de utilidades. Usa el selector de "Mes" de arriba para elegir el mes exacto (1 al 30/31).</div>
        {[{l:"Hoy",a:vHoy,t:"hoy"},{l:"Semana",a:vSem,t:"semana"},{l:"Mes",a:vMes,t:"mes"},{l:"Todo",a:ventas.filter(v=>!v.anulada),t:"completo"}].map(r=>(
          <button key={r.t} style={{...S.btnP,marginBottom:8}} onClick={()=>expCSV(r.a,`reporte-${r.t}`,empleadas)}>{r.l} ({r.a.length} ventas · ${sum(r.a).toFixed(2)})</button>
        ))}
      </Card>)}
    </div>
  );
}

// 🛍️ PRODUCTOS — catálogo de artículos que se venden directamente (sin pasar por Producción). Stock editable a mano o descontado solo al vender.
function ProductosAdmin({productos,setProductos,upsertProducto,kardexProductos,setKardexProductos,upsertKardexProducto,sesion}){
  const [nv,setNv]=useState({nombre:"",precio:"",stock:"",min:"1",categoria:""});
  const [verKardexDe,setVerKardexDe]=useState(null); // id del producto cuyo kardex está expandido
  const activos=productos.filter(p=>!p.eliminada);
  const kardexDe=id=>(kardexProductos||[]).filter(k=>k.itemId===id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const add=()=>{
    if(!nv.nombre.trim()||!nv.precio){alert("Escribe el nombre y el precio del producto");return;}
    const stockInicial=parseFloat(nv.stock)||0;
    const np={id:"prod_"+Date.now(),nombre:nv.nombre.trim(),precio:parseFloat(nv.precio)||0,stock:stockInicial,min:parseFloat(nv.min)||1,categoria:nv.categoria||null,activa:true};
    setProductos(prev=>[...prev,np]);
    if(upsertProducto)upsertProducto({...np,_updatedAt:new Date().toISOString()});
    if(stockInicial>0)registrarKardex({itemId:np.id,itemNombre:np.nombre,tipo:"ingreso_inicial",cantidad:stockInicial,saldoResultante:stockInicial,registradoPor:sesion?.nombre},{setKardex:setKardexProductos,upsertKardex:upsertKardexProducto});
    setNv({nombre:"",precio:"",stock:"",min:"1",categoria:""});
  };
  // ✏️ Ajuste manual de stock (+/−), con motivo obligatorio y registro en el kardex
  const ajustarStock=(p,delta)=>{
    const motivo=window.prompt(`¿Motivo del ajuste ${delta>0?"(+"+delta+")":"("+delta+")"} para "${p.nombre}"?`,"");
    if(motivo===null)return; // canceló
    const nuevoStock=Math.max(0,(p.stock||0)+delta);
    setProductos(prev=>{
      const next=prev.map(x=>x.id===p.id?{...x,stock:nuevoStock}:x);
      const updated=next.find(x=>x.id===p.id);
      if(updated&&upsertProducto)upsertProducto({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    registrarKardex({itemId:p.id,itemNombre:p.nombre,tipo:"ajuste_manual",cantidad:delta,motivo:motivo.trim()||null,saldoResultante:nuevoStock,registradoPor:sesion?.nombre},{setKardex:setKardexProductos,upsertKardex:upsertKardexProducto});
  };
  const upd=(id,f,v)=>setProductos(prev=>{
    const next=prev.map(p=>p.id===id?{...p,[f]:v}:p);
    const updated=next.find(p=>p.id===id);
    if(updated&&upsertProducto)upsertProducto({...updated,_updatedAt:new Date().toISOString()});
    return next;
  });
  const del=id=>{
    if(!window.confirm("¿Eliminar este producto? Ya no se podrá agregar a nuevas ventas."))return;
    setProductos(prev=>{
      const next=prev.map(p=>p.id===id?{...p,eliminada:true}:p);
      const borrado=next.find(p=>p.id===id);
      if(borrado&&upsertProducto)upsertProducto({...borrado,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const bajo=activos.filter(p=>p.stock<=p.min);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🛍️ Productos</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Estos productos se pueden agregar a una venta como "🛍️ Producto". El stock se descuenta solo al momento de vender, y no pasan por el módulo de Producción — se facturan y salen directo. Marca "🧴 Aromatizador Textil" en los que quieras que generen boleto extra en el sorteo activo. Toca "📒 Kardex" para ver el historial completo de movimientos de cada uno.</div>
    {bajo.length>0&&<div style={S.alrt}>⚠️ Stock bajo: {bajo.map(p=>p.nombre).join(", ")}</div>}
    <Card title="📋 Catálogo">
      {activos.length===0&&<div style={S.empty}>Aún no has agregado productos.</div>}
      {activos.map(p=>(<div key={p.id} style={S.vcard}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:700}}>{p.nombre}{p.categoria==="aromatizador"?" 🧴":""}</div><div style={{fontSize:12,color:"#4db6e4",fontWeight:700}}>${(p.precio||0).toFixed(2)}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{...S.badge,background:p.stock<=p.min?"#ffebee":"#e8f5e9",color:p.stock<=p.min?"#c62828":"#2e7d32",fontSize:14,fontWeight:700}}>{p.stock} u.</div>
            <button style={S.btnR} onClick={()=>del(p.id)}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
          <button style={S.btnS} onClick={()=>ajustarStock(p,-1)}>−</button>
          <div style={{...S.inp,width:70,textAlign:"center",padding:"4px 6px",background:"#f0f4f8"}}>{p.stock}</div>
          <button style={S.btnS} onClick={()=>ajustarStock(p,1)}>+</button>
          <label style={{fontSize:11,color:"#888"}}>Precio:</label>
          <input type="number" style={{...S.inp,width:80,padding:"4px 6px"}} value={p.precio} onChange={e=>upd(p.id,"precio",parseFloat(e.target.value)||0)}/>
          <label style={{fontSize:11,color:"#888"}}>Mín:</label>
          <input type="number" style={{...S.inp,width:60,padding:"4px 6px"}} value={p.min} onChange={e=>upd(p.id,"min",parseFloat(e.target.value)||0)}/>
          <select style={{...S.inp,width:"auto",padding:"4px 8px",fontSize:12}} value={p.categoria||""} onChange={e=>upd(p.id,"categoria",e.target.value||null)}>
            <option value="">Sin categoría</option>
            <option value="aromatizador">🧴 Aromatizador Textil (boleto extra)</option>
          </select>
          <button style={{...S.btnS,marginLeft:"auto"}} onClick={()=>setVerKardexDe(verKardexDe===p.id?null:p.id)}>📒 {verKardexDe===p.id?"Ocultar kardex":"Kardex"}</button>
        </div>
        {verKardexDe===p.id&&(
          <div style={{marginTop:10,background:"#f8fbfd",borderRadius:8,padding:"8px 10px",border:"1px solid #e8f0f7"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>📒 Kardex — {p.nombre}</div>
            {kardexDe(p.id).length===0&&<div style={{fontSize:12,color:"#aaa"}}>Sin movimientos registrados todavía.</div>}
            {kardexDe(p.id).map(k=>{
              const t=TIPO_KARDEX_LBL[k.tipo]||{label:k.tipo,icon:"•",color:"#888"};
              return(
                <div key={k.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f0f4f8"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:t.color}}>{t.icon} {t.label}{k.folio?` · ${k.folio}`:""}</div>
                    <div style={{fontSize:10,color:"#888"}}>{fmt(k.fecha)}{k.registradoPor?` · ${k.registradoPor}`:""}{k.motivo?` · ${k.motivo}`:""}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <div style={{fontSize:13,fontWeight:800,color:k.cantidad>=0?"#2e7d32":"#c62828"}}>{k.cantidad>=0?"+":""}{k.cantidad}</div>
                    <div style={{fontSize:9,color:"#aaa"}}>saldo: {k.saldoResultante}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>))}
    </Card>
    <Card title="➕ Agregar producto">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="Nombre del producto" value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Precio de venta" value={nv.precio} onChange={e=>setNv({...nv,precio:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Stock inicial" value={nv.stock} onChange={e=>setNv({...nv,stock:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Mínimo (alerta)" value={nv.min} onChange={e=>setNv({...nv,min:e.target.value})}/>
        <select style={{...S.inp,gridColumn:"1/-1"}} value={nv.categoria} onChange={e=>setNv({...nv,categoria:e.target.value})}>
          <option value="">Sin categoría</option>
          <option value="aromatizador">🧴 Aromatizador Textil (genera boleto extra en el sorteo)</option>
        </select>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>Agregar producto</button>
    </Card>
  </div>);
}

function Inventario({inventario,setInventario,upsertInventario,kardexInsumos,setKardexInsumos,upsertKardexInsumo,sesion}){
  const [nv,setNv]=useState({nombre:"",codigo:"",stock:0,min:1,unidad:"pzas"});
  const [verKardexDe,setVerKardexDe]=useState(null);
  const [showEntrada,setShowEntrada]=useState(null); // insumo para registrar entrada por factura
  const activos=inventario.filter(i=>!i.eliminada);
  const kardexDe=id=>(kardexInsumos||[]).filter(k=>k.itemId===id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const upd=(id,f,v)=>setInventario(prev=>{const next=prev.map(i=>i.id===id?{...i,[f]:v}:i);const updated=next.find(i=>i.id===id);if(updated&&upsertInventario)upsertInventario({...updated,_updatedAt:new Date().toISOString()});return next;});
  const del=id=>{if(!window.confirm("¿Eliminar este insumo?"))return;setInventario(prev=>{const next=prev.map(i=>i.id===id?{...i,eliminada:true}:i);const borrado=next.find(i=>i.id===id);if(borrado&&upsertInventario)upsertInventario({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const add=()=>{
    if(!nv.nombre.trim())return;
    const stockInicial=parseFloat(nv.stock)||0;
    const ni={id:Date.now(),nombre:nv.nombre.trim(),codigo:nv.codigo.trim()||null,stock:stockInicial,min:parseFloat(nv.min)||1,unidad:nv.unidad};
    setInventario(prev=>[...prev,ni]);
    if(upsertInventario)upsertInventario({...ni,_updatedAt:new Date().toISOString()});
    if(stockInicial>0)registrarKardex({itemId:ni.id,itemNombre:ni.nombre,tipo:"ingreso_inicial",cantidad:stockInicial,saldoResultante:stockInicial,registradoPor:sesion?.nombre},{setKardex:setKardexInsumos,upsertKardex:upsertKardexInsumo});
    setNv({nombre:"",codigo:"",stock:0,min:1,unidad:"pzas"});
  };
  // ✏️ Ajuste manual (consumo diario, mermas, etc.) — pide motivo y deja registro en el kardex
  const ajustarStock=(it,delta)=>{
    const motivo=window.prompt(`¿Motivo del ${delta>0?"ingreso":"consumo"} de ${Math.abs(delta)} ${it.unidad} de "${it.nombre}"?`,delta<0?"Uso diario":"");
    if(motivo===null)return;
    const nuevoStock=Math.max(0,(it.stock||0)+delta);
    setInventario(prev=>{
      const next=prev.map(x=>x.id===it.id?{...x,stock:nuevoStock}:x);
      const updated=next.find(x=>x.id===it.id);
      if(updated&&upsertInventario)upsertInventario({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    registrarKardex({itemId:it.id,itemNombre:it.nombre,tipo:delta<0?"consumo":"ajuste_manual",cantidad:delta,motivo:motivo.trim()||null,saldoResultante:nuevoStock,registradoPor:sesion?.nombre},{setKardex:setKardexInsumos,upsertKardex:upsertKardexInsumo});
  };
  // 🧾 Registrar entrada por factura: suma cantidad al stock y deja el número de factura como referencia en el kardex
  const registrarEntradaFactura=(it,cantidad,factura)=>{
    const nuevoStock=(it.stock||0)+cantidad;
    setInventario(prev=>{
      const next=prev.map(x=>x.id===it.id?{...x,stock:nuevoStock}:x);
      const updated=next.find(x=>x.id===it.id);
      if(updated&&upsertInventario)upsertInventario({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    registrarKardex({itemId:it.id,itemNombre:it.nombre,tipo:"entrada_factura",cantidad,folio:factura||null,saldoResultante:nuevoStock,registradoPor:sesion?.nombre},{setKardex:setKardexInsumos,upsertKardex:upsertKardexInsumo});
    setShowEntrada(null);
  };
  const bajo=activos.filter(i=>i.stock<=i.min);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📦 Inventario</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Cada insumo tiene su propio Kardex: entradas por factura, consumo diario y ajustes manuales, todos con fecha/hora y referencia.</div>
    {bajo.length>0&&<div style={S.alrt}>⚠️ Stock bajo: {bajo.map(i=>i.nombre).join(", ")}</div>}
    <Card title="📋 Insumos">
      {activos.map(it=>(<div key={it.id} style={S.vcard}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:600}}>{it.nombre}{it.codigo?<span style={{color:"#888",fontWeight:400,fontSize:11}}> · Cód: {it.codigo}</span>:""}</div><div style={{fontSize:12,color:"#888"}}>Min: {it.min} {it.unidad}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{...S.badge,background:it.stock<=it.min?"#ffebee":"#e8f5e9",color:it.stock<=it.min?"#c62828":"#2e7d32",fontSize:14,fontWeight:700}}>{it.stock} {it.unidad}</div>
            <button style={S.btnR} onClick={()=>del(it.id)}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
          <button style={S.btnS} onClick={()=>ajustarStock(it,-1)}>−</button>
          <div style={{...S.inp,width:70,textAlign:"center",padding:"4px 6px",background:"#f0f4f8"}}>{it.stock}</div>
          <button style={S.btnS} onClick={()=>ajustarStock(it,1)}>+</button>
          <button style={{...S.btnS,background:"#e8f5e9",color:"#2e7d32"}} onClick={()=>setShowEntrada(it.id)}>🧾 Entrada por factura</button>
          <button style={{...S.btnS,marginLeft:"auto"}} onClick={()=>setVerKardexDe(verKardexDe===it.id?null:it.id)}>📒 {verKardexDe===it.id?"Ocultar kardex":"Kardex"}</button>
        </div>
        {showEntrada===it.id&&<EntradaFacturaInline insumo={it} onConfirmar={(cantidad,factura)=>registrarEntradaFactura(it,cantidad,factura)} onCancelar={()=>setShowEntrada(null)}/>}
        {verKardexDe===it.id&&(
          <div style={{marginTop:10,background:"#f8fbfd",borderRadius:8,padding:"8px 10px",border:"1px solid #e8f0f7"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>📒 Kardex — {it.nombre}</div>
            {kardexDe(it.id).length===0&&<div style={{fontSize:12,color:"#aaa"}}>Sin movimientos registrados todavía.</div>}
            {kardexDe(it.id).map(k=>{
              const t=TIPO_KARDEX_LBL[k.tipo]||{label:k.tipo,icon:"•",color:"#888"};
              return(
                <div key={k.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f0f4f8"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:t.color}}>{t.icon} {t.label}{k.folio?` · Fact. ${k.folio}`:""}</div>
                    <div style={{fontSize:10,color:"#888"}}>{fmt(k.fecha)}{k.registradoPor?` · ${k.registradoPor}`:""}{k.motivo?` · ${k.motivo}`:""}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <div style={{fontSize:13,fontWeight:800,color:k.cantidad>=0?"#2e7d32":"#c62828"}}>{k.cantidad>=0?"+":""}{k.cantidad}</div>
                    <div style={{fontSize:9,color:"#aaa"}}>saldo: {k.saldoResultante}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>))}
    </Card>
    <Card title="➕ Agregar">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input style={{...S.inp,gridColumn:"1/-1"}} placeholder="Nombre" value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/>
        <input style={S.inp} placeholder="Código (opcional)" value={nv.codigo} onChange={e=>setNv({...nv,codigo:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Stock" value={nv.stock} onChange={e=>setNv({...nv,stock:e.target.value})}/>
        <input type="number" style={S.inp} placeholder="Minimo" value={nv.min} onChange={e=>setNv({...nv,min:e.target.value})}/>
        <input style={S.inp} placeholder="Unidad" value={nv.unidad} onChange={e=>setNv({...nv,unidad:e.target.value})}/>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>Agregar</button>
    </Card>
  </div>);
}

// 🧾 Formulario en línea para registrar la entrada de un insumo por número de factura
function EntradaFacturaInline({insumo,onConfirmar,onCancelar}){
  const [cantidad,setCantidad]=useState("");
  const [factura,setFactura]=useState("");
  const [err,setErr]=useState("");
  const confirmar=()=>{
    const c=parseFloat(cantidad);
    if(!c||c<=0){setErr("Escribe una cantidad válida");return;}
    if(!factura.trim()){setErr("Escribe el número de factura");return;}
    onConfirmar(c,factura.trim());
  };
  return(
    <div style={{marginTop:8,background:"#e8f5e9",borderRadius:8,padding:10,border:"1px solid #a5d6a7"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#2e7d32",marginBottom:6}}>🧾 Entrada por factura — {insumo.nombre}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <input type="number" style={S.inp} placeholder={`Cantidad (${insumo.unidad})`} value={cantidad} onChange={e=>{setCantidad(e.target.value);setErr("");}}/>
        <input style={S.inp} placeholder="N° de factura" value={factura} onChange={e=>{setFactura(e.target.value);setErr("");}}/>
      </div>
      {err&&<div style={{color:"#c62828",fontSize:11,fontWeight:600,marginBottom:6}}>{err}</div>}
      <div style={{display:"flex",gap:6}}>
        <button style={{...S.btnS,flex:1,background:"#2e7d32",color:"#fff"}} onClick={confirmar}>✓ Registrar entrada</button>
        <button style={{...S.btnS,flex:1}} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Equipo({empleadas,setEmpleadas,ventas,esAdmin,upsertEmpleada}){
  const [nv,setNv]=useState({nombre:"",metaVentas:20,montoBonus:20,bonoGrupal:false,rolFuncional:"general"});
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const mes=mesK(new Date());
  const add=()=>{if(!nv.nombre.trim())return;const ne={id:Date.now(),nombre:nv.nombre,activa:true,metaVentas:parseInt(nv.metaVentas)||20,montoBonus:parseFloat(nv.montoBonus)||0,bonoGrupal:!!nv.bonoGrupal,rolFuncional:nv.rolFuncional||"general"};setEmpleadas(prev=>[...prev,ne]);if(upsertEmpleada)upsertEmpleada({...ne,_updatedAt:new Date().toISOString()});setNv({nombre:"",metaVentas:20,montoBonus:20,bonoGrupal:false,rolFuncional:"general"});};
  const tog=id=>setEmpleadas(prev=>{const next=prev.map(e=>e.id===id?{...e,activa:!e.activa}:e);const updated=next.find(e=>e.id===id);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});
  const save2=()=>{setEmpleadas(prev=>{const next=prev.map(e=>e.id===editId?{...e,...ed,metaVentas:parseInt(ed.metaVentas)||20,montoBonus:parseFloat(ed.montoBonus)||0,bonoGrupal:!!ed.bonoGrupal,rolFuncional:ed.rolFuncional||"general"}:e);const updated=next.find(e=>e.id===editId);if(updated&&upsertEmpleada)upsertEmpleada({...updated,_updatedAt:new Date().toISOString()});return next;});setEditId(null);};
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
                <div style={{marginTop:8}}>
                  <label style={S.lbl}>Rol funcional</label>
                  <select style={S.inp} value={ed.rolFuncional||"general"} onChange={ev=>setEd({...ed,rolFuncional:ev.target.value})}>
                    <option value="general">General</option>
                    <option value="recepcionista">🧾 Recepcionista (facturación SRI, etc.)</option>
                  </select>
                </div>
                <div style={{marginTop:8}}>
                  <label style={S.lbl}>Hora esperada de entrada al turno (para Evaluación de Desempeño)</label>
                  <input type="time" style={S.inp} value={ed.horaEntradaEsperada||"09:00"} onChange={ev=>setEd({...ed,horaEntradaEsperada:ev.target.value})}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}><button style={{...S.btnP,flex:1}} onClick={save2}>✓ Guardar</button><button style={S.btnC} onClick={()=>setEditId(null)}>Cancelar</button></div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{e.nombre}{e.rolFuncional==="recepcionista"?" 🧾":""}</div><div style={{fontSize:12,color:"#888"}}>{e.vm} ventas este mes</div>{esAdmin&&<div style={{fontSize:11,color:"#4db6e4"}}>Meta: {meta} · Bono: ${e.montoBonus||0}{e.bonoGrupal?" · 🎯 En bono grupal":""}{e.rolFuncional==="recepcionista"?" · 🧾 Recepcionista":""}</div>}</div>
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
        <div style={{gridColumn:"1/-1"}}>
          <label style={S.lbl}>Rol funcional</label>
          <select style={S.inp} value={nv.rolFuncional} onChange={e=>setNv({...nv,rolFuncional:e.target.value})}>
            <option value="general">General</option>
            <option value="recepcionista">🧾 Recepcionista (facturación SRI, etc.)</option>
          </select>
        </div>
      </div>
      <button style={{...S.btnP,marginTop:10}} onClick={add}>Agregar empleada</button>
    </Card>}
  </div>);
}

// 🏭 PRODUCCIÓN — Fase 1: CRUD de máquinas + datos semilla
const ESTADO_MAQ = {
  libre:{label:"Libre",color:"#2e7d32",bg:"#e8f5e9",icon:"🟢"},
  ocupada:{label:"Ocupada",color:"#1565c0",bg:"#e3f2fd",icon:"🔵"},
  mantenimiento:{label:"Mantenimiento",color:"#e65100",bg:"#fff3e0",icon:"🛠️"},
};
function MaquinasAdmin({maquinas,setMaquinas,upsertMaquina,cargas,setCargas,upsertCarga}){
  const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});
  const [nv,setNv]=useState({nombre:"",tipo:"lavadora",categoria:"general",zona:"Cuarto principal",capacidadKg:""});
  const [showAdd,setShowAdd]=useState(false);
  const faltantes=MAQUINAS_DEFAULT.filter(def=>!maquinas.some(m=>m.id===def.id));
  const restaurarFaltantes=()=>{
    setMaquinas(prev=>[...prev,...faltantes]);
    faltantes.forEach(m=>{if(upsertMaquina)upsertMaquina({...m,_updatedAt:new Date().toISOString()});});
    alert(`✅ Se restauraron ${faltantes.length} máquina(s): ${faltantes.map(m=>m.nombre).join(", ")}`);
  };
  const guardarCambio=(id,cambios)=>{
    setMaquinas(prev=>{
      const next=prev.map(m=>m.id===id?{...m,...cambios}:m);
      const updated=next.find(m=>m.id===id);
      if(updated&&upsertMaquina)upsertMaquina({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const guardarEdicion=()=>{
    guardarCambio(editId,{nombre:ed.nombre.trim()||editId,tipo:ed.tipo,categoria:ed.categoria||"general",zona:ed.zona.trim()||"Sin asignar",capacidadKg:ed.capacidadKg?parseFloat(ed.capacidadKg):null});
    setEditId(null);
  };
  const toggleMantenimiento=m=>{
    guardarCambio(m.id,{estado:m.estado==="mantenimiento"?"libre":"mantenimiento"});
  };
  // 🔓 Botón de emergencia: libera una máquina trabada (ej. carga huérfana) y cierra su carga asociada si seguía abierta
  const liberarMaquina=m=>{
    if(!confirm(`¿Liberar "${m.nombre}" a la fuerza? Úsalo solo si quedó trabada por un error — esto la marca libre y cierra cualquier carga abierta que tuviera.`))return;
    if(m.cargaActualId&&cargas){
      const c=cargas.find(x=>x.id===m.cargaActualId);
      if(c&&!c.finReal&&setCargas){
        setCargas(prev=>{
          const next=prev.map(x=>x.id===c.id?{...x,finReal:new Date().toISOString(),empleadaRetiroId:null}:x);
          const updated=next.find(x=>x.id===c.id);
          if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
          return next;
        });
      }
    }
    guardarCambio(m.id,{estado:"libre",cargaActualId:null,finProgramado:null});
  };
  // 🔓 Libera de un jalón TODAS las máquinas que ya pasaron su tiempo programado (vencidas) — para cuando se acumulan varias trabadas
  const maquinasVencidas=maquinas.filter(m=>m.estado==="ocupada"&&m.finProgramado&&new Date(m.finProgramado)<new Date());
  const liberarTodasVencidas=()=>{
    if(!confirm(`¿Liberar las ${maquinasVencidas.length} máquinas vencidas? Esto las marca libres y cierra cualquier carga abierta que tuvieran.`))return;
    maquinasVencidas.forEach(m=>{
      if(m.cargaActualId&&cargas){
        const c=cargas.find(x=>x.id===m.cargaActualId);
        if(c&&!c.finReal&&setCargas){
          setCargas(prev=>{
            const next=prev.map(x=>x.id===c.id?{...x,finReal:new Date().toISOString(),empleadaRetiroId:null}:x);
            const updated=next.find(x=>x.id===c.id);
            if(updated&&upsertCarga)upsertCarga({...updated,_updatedAt:new Date().toISOString()});
            return next;
          });
        }
      }
      guardarCambio(m.id,{estado:"libre",cargaActualId:null,finProgramado:null});
    });
  };
  const agregar=()=>{
    if(!nv.nombre.trim())return;
    const id=nv.tipo==="lavadora"?"L"+(maquinas.filter(m=>m.tipo==="lavadora").length+1)+"_"+Date.now().toString(36).slice(-3):"S"+(maquinas.filter(m=>m.tipo==="secadora").length+1)+"_"+Date.now().toString(36).slice(-3);
    const nm={id,nombre:nv.nombre.trim(),tipo:nv.tipo,categoria:nv.categoria||"general",zona:nv.zona.trim()||"Sin asignar",capacidadKg:nv.capacidadKg?parseFloat(nv.capacidadKg):null,estado:"libre",cargaActualId:null,finProgramado:null};
    setMaquinas(prev=>[...prev,nm]);
    if(upsertMaquina)upsertMaquina({...nm,_updatedAt:new Date().toISOString()});
    setNv({nombre:"",tipo:"lavadora",categoria:"general",zona:"Cuarto principal",capacidadKg:""});
    setShowAdd(false);
  };
  const eliminar=id=>{
    if(!confirm("¿Eliminar esta máquina? Si tiene historial de cargas asociadas, ese historial se conserva igual."))return;
    setMaquinas(prev=>prev.filter(m=>m.id!==id));
  };
  const zonas=[...new Set(maquinas.map(m=>m.zona||"Sin asignar"))];
  const zonasSugeridas=[...new Set([...maquinas.map(m=>m.zona||"Sin asignar"),"Cuarto principal","Afuera"])];
  const Tarjeta=m=>{
    const est=ESTADO_MAQ[m.estado]||ESTADO_MAQ.libre;
    return(<div key={m.id} style={{...S.vcard,borderLeft:`4px solid ${est.color}`}}>
      {editId===m.id?(
        <div>
          <div style={{display:"grid",gap:8,marginBottom:8}}>
            <div><label style={S.lbl}>Nombre</label><input style={S.inp} value={ed.nombre||""} onChange={ev=>setEd({...ed,nombre:ev.target.value})}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={S.lbl}>Tipo</label>
                <select style={S.inp} value={ed.tipo} onChange={ev=>setEd({...ed,tipo:ev.target.value})}>
                  <option value="lavadora">Lavadora</option>
                  <option value="secadora">Secadora</option>
                </select>
              </div>
              <div><label style={S.lbl}>Capacidad (Kg, opcional)</label><input type="number" style={S.inp} placeholder="ej. 15" value={ed.capacidadKg||""} onChange={ev=>setEd({...ed,capacidadKg:ev.target.value})}/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={S.lbl}>Categoría</label>
                <select style={S.inp} value={ed.categoria||"general"} onChange={ev=>setEd({...ed,categoria:ev.target.value})}>
                  <option value="general">General</option>
                  <option value="zapatos">👟 Solo zapatos</option>
                </select>
              </div>
              <div><label style={S.lbl}>Cuarto / zona</label><input style={S.inp} list="zonas-list" placeholder="ej. Cuarto principal" value={ed.zona||""} onChange={ev=>setEd({...ed,zona:ev.target.value})}/></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{...S.btnS,flex:1,background:"#e8f5e9",color:"#2e7d32"}} onClick={guardarEdicion}>✓ Guardar</button>
            <button style={{...S.btnS,flex:1}} onClick={()=>setEditId(null)}>Cancelar</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{m.categoria==="zapatos"?"👟":m.tipo==="lavadora"?"🧺":"🔥"} {m.nombre}</div>
            <div style={{fontSize:12,color:est.color,fontWeight:700}}>{est.icon} {est.label}{m.capacidadKg?` · ${m.capacidadKg} Kg`:""}{m.categoria==="zapatos"?" · Solo zapatos":""}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button style={S.btnS} onClick={()=>toggleMantenimiento(m)} title={m.estado==="mantenimiento"?"Marcar como libre":"Poner en mantenimiento"}>{m.estado==="mantenimiento"?"✅":"🛠️"}</button>
            {m.estado==="ocupada"&&<button style={{...S.btnS,background:"#ffebee",color:"#c62828"}} onClick={()=>liberarMaquina(m)} title="Liberar a la fuerza (si quedó trabada)">🔓</button>}
            <button style={S.btnS} onClick={()=>{setEditId(m.id);setEd({nombre:m.nombre,tipo:m.tipo,categoria:m.categoria||"general",zona:m.zona||"Sin asignar",capacidadKg:m.capacidadKg||""});}}>✏️</button>
            <button style={S.btnR} onClick={()=>eliminar(m.id)}>✕</button>
          </div>
        </div>
      )}
    </div>);
  };
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🏭 Máquinas</h2>
    <datalist id="zonas-list">{zonasSugeridas.map(z=><option key={z} value={z}/>)}</datalist>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Aquí administras todas las máquinas, agrupadas por cuarto/zona física. Las marcadas "Solo zapatos" (👟) están separadas para que no se mezclen con cargas normales.</div>
    {faltantes.length>0&&(
      <div style={{...S.alrt,background:"#fff3e0",color:"#e65100",marginBottom:14}}>
        ⚠️ Faltan {faltantes.length} máquina(s) del catálogo original: {faltantes.map(m=>m.nombre).join(", ")}.
        <button style={{...S.btnP,marginTop:8}} onClick={restaurarFaltantes}>🔄 Restaurar máquina(s) faltante(s)</button>
      </div>
    )}
    {maquinasVencidas.length>0&&(
      <div style={{...S.alrt,background:"#ffebee",color:"#c62828",marginBottom:14}}>
        ⏰ {maquinasVencidas.length} máquina(s) llevan tiempo vencido sin retirar: {maquinasVencidas.map(m=>m.nombre).join(", ")}.
        <div style={{fontSize:11,color:"#c62828",marginTop:4}}>Probablemente ya se retiró la ropa físicamente pero no se tocó "Retirar" en el sistema.</div>
        <button style={{...S.btnP,marginTop:8,background:"linear-gradient(135deg,#c62828,#e57373)"}} onClick={liberarTodasVencidas}>🔓 Liberar todas las vencidas ({maquinasVencidas.length})</button>
      </div>
    )}
    {zonas.map(z=>(
      <Card key={z} title={`📍 ${z}`}>
        {maquinas.filter(m=>(m.zona||"Sin asignar")===z).map(Tarjeta)}
      </Card>
    ))}
    {showAdd?(
      <Card title="➕ Nueva máquina">
        <div style={{display:"grid",gap:8}}>
          <div><label style={S.lbl}>Nombre</label><input style={S.inp} placeholder="ej. Lavadora 4" value={nv.nombre} onChange={e=>setNv({...nv,nombre:e.target.value})}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={S.lbl}>Tipo</label>
              <select style={S.inp} value={nv.tipo} onChange={e=>setNv({...nv,tipo:e.target.value})}>
                <option value="lavadora">Lavadora</option>
                <option value="secadora">Secadora</option>
              </select>
            </div>
            <div><label style={S.lbl}>Capacidad (Kg, opcional)</label><input type="number" style={S.inp} placeholder="ej. 15" value={nv.capacidadKg} onChange={e=>setNv({...nv,capacidadKg:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={S.lbl}>Categoría</label>
              <select style={S.inp} value={nv.categoria} onChange={e=>setNv({...nv,categoria:e.target.value})}>
                <option value="general">General</option>
                <option value="zapatos">👟 Solo zapatos</option>
              </select>
            </div>
            <div><label style={S.lbl}>Cuarto / zona</label><input style={S.inp} list="zonas-list" placeholder="ej. Afuera" value={nv.zona} onChange={e=>setNv({...nv,zona:e.target.value})}/></div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button style={{...S.btnP,flex:1}} onClick={agregar}>Agregar máquina</button>
          <button style={{...S.btnS,flex:1}} onClick={()=>setShowAdd(false)}>Cancelar</button>
        </div>
      </Card>
    ):(
      <button style={{...S.btnP,marginTop:4}} onClick={()=>setShowAdd(true)}>➕ Agregar máquina</button>
    )}
  </div>);
}

const CATS=["Insumos/Suministros","Servicios","Arriendo","Sueldos","Mantenimiento","Publicidad","Equipos","Pago de deuda","Otros"];
function Gastos({gastos,setGastos,sesion,upsertGasto,salidasCaja,activosFijos,setActivosFijos,upsertActivoFijo,inventario,setInventario,upsertInventario,kardexInsumos,setKardexInsumos,upsertKardexInsumo}){
  const [nv,setNv]=useState({descripcion:"",categoria:"Insumos/Suministros",proveedor:"",numeroFactura:"",monto:"",fecha:fechaHoyLocal(),metodoPago:"Efectivo",notas:""});
  const [modoMonto,setModoMonto]=useState("subtotal"); // "subtotal" (calculamos el IVA) | "total" (ya viene con IVA incluido)
  const [subtotalFactura,setSubtotalFactura]=useState(""); // subtotal que SÍ lleva IVA (15%)
  const [subtotal0,setSubtotal0]=useState(""); // subtotal 0% — no lleva IVA, solo se suma al total tal cual
  const IVA_PCT=0.15; // 🇪🇨 tasa de IVA vigente en Ecuador
  const ivaCalculado=modoMonto==="subtotal"?parseFloat(((parseFloat(subtotalFactura)||0)*IVA_PCT).toFixed(2)):0;
  const totalConIva=modoMonto==="subtotal"?parseFloat(((parseFloat(subtotalFactura)||0)+(parseFloat(subtotal0)||0)+ivaCalculado).toFixed(2)):(parseFloat(nv.monto)||0);
  const [tipoFactura,setTipoFactura]=useState("gasto"); // "gasto" | "insumos" | "activo" — guía qué campos mostrar
  const [esActivoFijo,setEsActivoFijo]=useState(false);
  const [catActivoFijo,setCatActivoFijo]=useState("General");
  const [itemsCompra,setItemsCompra]=useState([]); // [{codigo,nombre,insumoId,cantidad,precioUnitario}] — detalle de insumos comprados en esta factura
  const [buscarCod,setBuscarCod]=useState("");
  const [cantCod,setCantCod]=useState("1");
  const [precioCod,setPrecioCod]=useState(""); // precio unitario pagado por este insumo en ESTA factura (para análisis de costos)
  const [fMes,setFMes]=useState(mesK(new Date()));const [fCat,setFCat]=useState("Todas");const [err,setErr]=useState("");
  const [incluirSalidas,setIncluirSalidas]=useState(true); // 💸 combinar salidas de caja en este reporte
  // 🔎 Busca el insumo por código o por nombre (coincidencia parcial)
  const insumoEncontrado=(inventario||[]).find(i=>!i.eliminada&&buscarCod.trim()&&((i.codigo||"").toLowerCase()===buscarCod.trim().toLowerCase()||(i.codigo||"").toLowerCase().includes(buscarCod.trim().toLowerCase())||i.nombre.toLowerCase().includes(buscarCod.trim().toLowerCase())));
  const agregarItemCompra=()=>{
    if(!buscarCod.trim()){alert("Escribe el código o nombre del insumo");return;}
    const cant=parseFloat(cantCod)||1;
    const precio=parseFloat(precioCod)||0;
    if(insumoEncontrado){
      setItemsCompra(prev=>[...prev,{codigo:insumoEncontrado.codigo,nombre:insumoEncontrado.nombre,insumoId:insumoEncontrado.id,cantidad:cant,precioUnitario:precio,esNuevo:false}]);
    }else{
      // 🆕 No existe todavía — se creará como insumo nuevo al registrar el gasto, con un código automático
      const codigoNuevo=generarCodigoInsumo([...(inventario||[]),...itemsCompra.filter(it=>it.esNuevo).map(it=>({codigo:it.codigo}))]);
      setItemsCompra(prev=>[...prev,{codigo:codigoNuevo,nombre:buscarCod.trim(),insumoId:null,cantidad:cant,precioUnitario:precio,esNuevo:true}]);
    }
    setBuscarCod("");setCantCod("1");setPrecioCod("");
  };
  const quitarItemCompra=idx=>setItemsCompra(prev=>prev.filter((_,i)=>i!==idx));
  const add=()=>{
    if(!nv.descripcion.trim()){setErr("Completa la descripción");return;}
    if(modoMonto==="subtotal"&&!subtotalFactura){setErr("Escribe el subtotal de la factura (sin IVA)");return;}
    if(modoMonto==="total"&&!nv.monto){setErr("Escribe el monto total de la factura");return;}
    const montoFinal=modoMonto==="subtotal"?totalConIva:parseFloat(nv.monto);
    const ng={...nv,id:Date.now(),monto:montoFinal,subtotal:modoMonto==="subtotal"?parseFloat(subtotalFactura):null,subtotal0:modoMonto==="subtotal"?(parseFloat(subtotal0)||0):null,iva:modoMonto==="subtotal"?ivaCalculado:null,registradoPor:sesion.nombre};
    setGastos(prev=>[ng,...prev]);
    if(upsertGasto)upsertGasto({...ng,_updatedAt:new Date().toISOString()});
    // 📦 Si el tipo de factura es "Activo Fijo", se registra también en Activos Fijos automáticamente
    if(tipoFactura==="activo"&&setActivosFijos){
      const af={id:"af_"+ng.id,nombre:ng.descripcion,categoria:catActivoFijo,fechaAdquisicion:ng.fecha,valorCompra:ng.monto,proveedor:ng.proveedor||null,estado:"activo",notas:"Registrado automáticamente desde Gastos",gastoIdOrigen:ng.id};
      setActivosFijos(prev=>[af,...prev]);
      if(upsertActivoFijo)upsertActivoFijo({...af,_updatedAt:new Date().toISOString()});
    }
    // 📦 Cada insumo detallado por código suma su cantidad al inventario (o se crea si es nuevo), con el N° de factura como referencia en el kardex
    if(itemsCompra.length>0&&setInventario){
      setInventario(prev=>{
        let next=[...prev];
        itemsCompra.forEach(linea=>{
          if(linea.esNuevo){
            const ni={id:Date.now()+Math.floor(Math.random()*1000),nombre:linea.nombre,codigo:linea.codigo,stock:linea.cantidad,min:1,unidad:"pzas"};
            next=[...next,ni];
            if(upsertInventario)upsertInventario({...ni,_updatedAt:new Date().toISOString()});
            registrarKardex({itemId:ni.id,itemNombre:ni.nombre,tipo:"entrada_factura",cantidad:linea.cantidad,folio:ng.numeroFactura||null,motivo:"Compra (insumo nuevo): "+ng.descripcion,saldoResultante:ni.stock,registradoPor:sesion?.nombre,precioUnitario:linea.precioUnitario||null,proveedor:ng.proveedor||null},{setKardex:setKardexInsumos,upsertKardex:upsertKardexInsumo});
          }else{
            next=next.map(i=>i.id===linea.insumoId?{...i,stock:(i.stock||0)+linea.cantidad}:i);
            const updated=next.find(i=>i.id===linea.insumoId);
            if(updated&&upsertInventario)upsertInventario({...updated,_updatedAt:new Date().toISOString()});
            if(updated)registrarKardex({itemId:linea.insumoId,itemNombre:updated.nombre,tipo:"entrada_factura",cantidad:linea.cantidad,folio:ng.numeroFactura||null,motivo:"Compra: "+ng.descripcion,saldoResultante:updated.stock,registradoPor:sesion?.nombre,precioUnitario:linea.precioUnitario||null,proveedor:ng.proveedor||null},{setKardex:setKardexInsumos,upsertKardex:upsertKardexInsumo});
          }
        });
        return next;
      });
    }
    setNv({descripcion:"",categoria:"Insumos/Suministros",proveedor:"",numeroFactura:"",monto:"",fecha:fechaHoyLocal(),metodoPago:"Efectivo",notas:""});
    setSubtotalFactura("");
    setSubtotal0("");
    setEsActivoFijo(false);
    setTipoFactura("gasto");
    setCatActivoFijo("General");
    setItemsCompra([]);
    setErr("");
  };
  const del=id=>{if(!window.confirm("Eliminar?"))return;setGastos(prev=>{const next=prev.map(g=>g.id===id?{...g,eliminada:true}:g);const borrado=next.find(g=>g.id===id);if(borrado&&upsertGasto)upsertGasto({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const fil=gastos.filter(g=>!g.eliminada&&(!fMes||fechaLocal(g.fecha).startsWith(fMes))&&(fCat==="Todas"||g.categoria===fCat));
  // 💸 Salidas de caja del mismo rango — se muestran como una "categoría" más dentro de este reporte, si se incluye
  const salidasFil=incluirSalidas&&(fCat==="Todas"||fCat==="Salidas de caja")?(salidasCaja||[]).filter(s=>!s.eliminada&&(!fMes||s.fecha.startsWith(fMes))):[];
  const totGastos=fil.reduce((a,g)=>a+g.monto,0);
  const totSalidas=salidasFil.reduce((a,s)=>a+s.monto,0);
  const tot=totGastos+totSalidas;
  const descargarGastosCSV=()=>{
    if(fil.length===0&&salidasFil.length===0){alert("No hay gastos para descargar con los filtros actuales.");return;}
    const enc=["Fecha","Descripción","Categoría","Proveedor","N° Factura","Monto","Método de pago","Registrado por","Notas"];
    const filas=fil.map(g=>[fmtD(g.fecha),g.descripcion||"",g.categoria||"",g.proveedor||"",g.numeroFactura||"","$"+g.monto.toFixed(2),g.metodoPago||"",g.registradoPor||"",g.notas||""]);
    salidasFil.forEach(s=>filas.push([fmtD(s.fecha),s.motivo||"","Salidas de caja","","","$"+s.monto.toFixed(2),"Efectivo",s.quien||"","Salida de caja del día · "+(s.hora||"")]));
    filas.push(["","","","","","","","",""]);
    if(salidasFil.length>0){
      filas.push(["","","","","Subtotal gastos:","$"+totGastos.toFixed(2),"","",""]);
      filas.push(["","","","","Subtotal salidas de caja:","$"+totSalidas.toFixed(2),"","",""]);
    }
    filas.push(["","","","","TOTAL:","$"+tot.toFixed(2),"","",""]);
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="gastos-"+(fCat!=="Todas"?fCat.replace(/[^a-z0-9]/gi,"_")+"-":"")+(fMes||"todos")+".csv";a.click();
  };
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🛒 Gastos & Facturas</h2>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #e53935"}}><div style={{fontSize:22}}>💸</div><div><div style={{fontWeight:800,fontSize:18,color:"#e53935"}}>${tot.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Total {incluirSalidas?"(gastos + salidas)":"gastos"}</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #ff9800"}}><div style={{fontSize:22}}>🧾</div><div><div style={{fontWeight:800,fontSize:18,color:"#ff9800"}}>{fil.length+salidasFil.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Movimientos</div></div></div>
    </div>
    <Card title="🔍 Filtros">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={fMes} onChange={e=>setFMes(e.target.value)}/></div>
        <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={fCat} onChange={e=>setFCat(e.target.value)}><option>Todas</option>{CATS.map(c=><option key={c}>{c}</option>)}<option>Salidas de caja</option></select></div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:13,cursor:"pointer"}}>
        <input type="checkbox" checked={incluirSalidas} onChange={e=>setIncluirSalidas(e.target.checked)}/>
        💸 Incluir salidas de caja en este reporte
      </label>
      {incluirSalidas&&salidasFil.length>0&&<div style={{fontSize:12,color:"#888",marginTop:6}}>Gastos: ${totGastos.toFixed(2)} + Salidas de caja: ${totSalidas.toFixed(2)} = <strong>${tot.toFixed(2)}</strong></div>}
      <button style={{...S.btnP,marginTop:10}} onClick={descargarGastosCSV}>📥 Descargar CSV ({fil.length+salidasFil.length} movimiento{(fil.length+salidasFil.length)!==1?"s":""})</button>
    </Card>
    <Card title="🧾 Registrar factura de compra">
      {err&&<div style={S.err}>{err}</div>}
      <label style={S.lbl}>¿Qué tipo de factura es?</label>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[["gasto","📋 Gasto general"],["insumos","📦 Compra de insumos"],["activo","🏭 Activo fijo"]].map(([val,l])=>(
          <button key={val} onClick={()=>setTipoFactura(val)} style={{flex:1,padding:"9px 4px",borderRadius:10,border:tipoFactura===val?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:tipoFactura===val?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>{tipoFactura==="activo"?"Nombre del activo (ej. Lavadora industrial 25lb) *":"Descripcion *"}</label><input style={S.inp} placeholder={tipoFactura==="activo"?"ej. Lavadora industrial 25lb":"Ej: Detergente..."} value={nv.descripcion} onChange={e=>setNv({...nv,descripcion:e.target.value})}/></div>
        {tipoFactura==="activo"?(
          <div><label style={S.lbl}>Categoría del activo</label><select style={S.inp} value={catActivoFijo} onChange={e=>setCatActivoFijo(e.target.value)}>{["Maquinaria","Muebles y enseres","Equipo de oficina","Vehículos","Herramientas","General"].map(c=><option key={c}>{c}</option>)}</select></div>
        ):(
          <div><label style={S.lbl}>Categoria</label><select style={S.inp} value={nv.categoria} onChange={e=>setNv({...nv,categoria:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        )}
        <div><label style={S.lbl}>Proveedor</label><input style={S.inp} value={nv.proveedor} onChange={e=>setNv({...nv,proveedor:e.target.value})}/></div>
        <div><label style={S.lbl}>N° Factura</label><input style={S.inp} value={nv.numeroFactura} onChange={e=>setNv({...nv,numeroFactura:e.target.value})}/></div>
        <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={nv.fecha} onChange={e=>setNv({...nv,fecha:e.target.value})}/></div>
        <div><label style={S.lbl}>Metodo</label><select style={S.inp} value={nv.metodoPago} onChange={e=>setNv({...nv,metodoPago:e.target.value})}>{PAGOS.map(p=><option key={p}>{p}</option>)}</select></div>
      </div>

      <div style={{marginTop:12,background:"#f8fbfd",borderRadius:10,padding:12,border:"1px solid #e8f0f7"}}>
        <label style={S.lbl}>¿Cómo tienes el monto de la factura?</label>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <button onClick={()=>setModoMonto("subtotal")} style={{flex:1,padding:"8px 4px",borderRadius:8,border:modoMonto==="subtotal"?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:modoMonto==="subtotal"?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:11,cursor:"pointer"}}>🧮 Tengo el subtotal (calcula el IVA)</button>
          <button onClick={()=>setModoMonto("total")} style={{flex:1,padding:"8px 4px",borderRadius:8,border:modoMonto==="total"?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:modoMonto==="total"?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:11,cursor:"pointer"}}>💰 Ya tengo el total con IVA</button>
        </div>
        {modoMonto==="subtotal"?(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <label style={S.lbl}>Subtotal 15% (con IVA) *</label>
                <input type="number" style={S.inp} placeholder="ej. 90.49" value={subtotalFactura} onChange={e=>setSubtotalFactura(e.target.value)}/>
              </div>
              <div>
                <label style={S.lbl}>Subtotal 0% (sin IVA)</label>
                <input type="number" style={S.inp} placeholder="ej. 3.59" value={subtotal0} onChange={e=>setSubtotal0(e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:8,padding:"8px 10px",background:"#fff",borderRadius:8,border:"1px solid #e0e8f0"}}>
              <span style={{color:"#888"}}>IVA (15%): <strong style={{color:"#1a3c5e"}}>${ivaCalculado.toFixed(2)}</strong></span>
              <span style={{color:"#888"}}>Total: <strong style={{color:"#2e7d32",fontSize:15}}>${totalConIva.toFixed(2)}</strong></span>
            </div>
            <div style={{fontSize:10,color:"#aaa",marginTop:4}}>El IVA solo se calcula sobre el "Subtotal 15%". Si la factura trae productos exentos (0%, como golosinas o fundas), ponlos aparte en "Subtotal 0%" para que el total cuadre exacto.</div>
          </>
        ):(
          <div><label style={S.lbl}>Monto total (con IVA incluido) *</label><input type="number" style={S.inp} placeholder="$0.00" value={nv.monto} onChange={e=>setNv({...nv,monto:e.target.value})}/></div>
        )}
      </div>

      {tipoFactura==="insumos"&&(
        <div style={{marginTop:14,background:"#f8fbfd",borderRadius:10,padding:12,border:"1px solid #e8f0f7"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1a3c5e",marginBottom:6}}>📦 Detalla cada insumo por código</div>
          <div style={{fontSize:11,color:"#888",marginBottom:8}}>Se suman solos al stock de Inventario, y con el precio unitario y proveedor quedan guardados para comparar costos en el tiempo.</div>
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <input style={{...S.inp,flex:2}} placeholder="Código o nombre del insumo" value={buscarCod} onChange={e=>setBuscarCod(e.target.value)}/>
            <input type="number" style={{...S.inp,width:60}} placeholder="Cant." value={cantCod} onChange={e=>setCantCod(e.target.value)}/>
            <input type="number" style={{...S.inp,width:75}} placeholder="P. unit." value={precioCod} onChange={e=>setPrecioCod(e.target.value)}/>
            <button style={{...S.btnS,background:"#2e7d32",color:"#fff"}} onClick={agregarItemCompra}>➕</button>
          </div>
          {buscarCod.trim()&&(insumoEncontrado?(()=>{
            const historial=(kardexInsumos||[]).filter(k=>k.itemId===insumoEncontrado.id&&k.tipo==="entrada_factura"&&k.precioUnitario!=null).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
            const ultimo=historial[0];
            return(<div style={{fontSize:11,color:"#2e7d32",marginBottom:6}}>
              ✅ {insumoEncontrado.nombre}{insumoEncontrado.codigo?` (Cód: ${insumoEncontrado.codigo})`:""} · Stock actual: {insumoEncontrado.stock}
              {ultimo&&<div style={{color:"#1565c0"}}>💡 Última compra: ${ultimo.precioUnitario.toFixed(2)} c/u {ultimo.proveedor?`en ${ultimo.proveedor}`:""} ({fmtD(ultimo.fecha)})
                {precioCod&&parseFloat(precioCod)!==ultimo.precioUnitario&&(parseFloat(precioCod)>ultimo.precioUnitario?<span style={{color:"#c62828",fontWeight:700}}> · Subió ${(parseFloat(precioCod)-ultimo.precioUnitario).toFixed(2)}</span>:<span style={{color:"#2e7d32",fontWeight:700}}> · Bajó ${(ultimo.precioUnitario-parseFloat(precioCod)).toFixed(2)}</span>)}
              </div>}
            </div>);
          })():<div style={{fontSize:11,color:"#1565c0",marginBottom:6}}>🆕 No existe todavía — al agregarlo se creará como insumo nuevo con código automático</div>)}
          {itemsCompra.length>0&&itemsCompra.map((it,idx)=>(
            <div key={idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",background:it.esNuevo?"#e3f2fd":"#e8f5e9",borderRadius:6,marginBottom:4}}>
              <span style={{fontSize:12,color:it.esNuevo?"#1565c0":"#2e7d32"}}>{it.esNuevo?"🆕 ":""}{it.nombre} ({it.codigo}) · +{it.cantidad}{it.precioUnitario>0?` · $${it.precioUnitario.toFixed(2)} c/u`:""}</span>
              <button style={{...S.btnR,padding:"2px 8px"}} onClick={()=>quitarItemCompra(idx)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {tipoFactura==="activo"&&(
        <div style={{marginTop:14,background:"#f3e8fd",borderRadius:10,padding:12,border:"1px solid #d1b3f0"}}>
          <div style={{fontSize:12,color:"#7b1fa2",fontWeight:600}}>🏭 Esta compra se va a registrar automáticamente en 📦 Activos Fijos, con el nombre, categoría, valor y proveedor de arriba.</div>
        </div>
      )}

      <button style={{...S.btnP,marginTop:14,width:"100%"}} onClick={add}>💾 Registrar factura</button>
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
    {incluirSalidas&&salidasFil.length>0&&(
      <Card title={`💸 Salidas de caja incluidas (${salidasFil.length})`}>
        {salidasFil.map(s=>(
          <div key={s.id} style={{...S.vcard,borderLeft:"4px solid #c62828"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:700}}>{s.motivo}</div><div style={{fontSize:11,color:"#888"}}>Salida de caja · {fmtD(s.fecha)} {s.hora?`· ${s.hora}`:""}</div>{s.quien&&<div style={{fontSize:11}}>👤 {s.quien}</div>}</div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#c62828"}}>${s.monto.toFixed(2)}</div></div>
            </div>
          </div>
        ))}
      </Card>
    )}
  </div>);
}

// 📦 ACTIVOS FIJOS — registro de máquinas, muebles y equipos del negocio
function ActivosFijosAdmin({activosFijos,setActivosFijos,upsertActivoFijo,sesion}){
  const CATEGORIAS_AF=["Maquinaria","Muebles y enseres","Equipo de oficina","Vehículos","Herramientas","General"];
  const vacio={nombre:"",categoria:"General",fechaAdquisicion:fechaHoyLocal(),valorCompra:"",proveedor:"",notas:""};
  const [form,setForm]=useState(vacio);
  const [editId,setEditId]=useState(null);
  const activos=(activosFijos||[]).filter(a=>a.estado!=="dado_de_baja");
  const bajaDados=(activosFijos||[]).filter(a=>a.estado==="dado_de_baja");
  const guardar=()=>{
    if(!form.nombre.trim()||!form.valorCompra){alert("Escribe el nombre y el valor de compra");return;}
    if(editId){
      setActivosFijos(prev=>{
        const next=prev.map(a=>a.id===editId?{...a,nombre:form.nombre.trim(),categoria:form.categoria,fechaAdquisicion:form.fechaAdquisicion,valorCompra:parseFloat(form.valorCompra)||0,proveedor:form.proveedor.trim()||null,notas:form.notas.trim()||null}:a);
        const updated=next.find(a=>a.id===editId);
        if(updated&&upsertActivoFijo)upsertActivoFijo({...updated,_updatedAt:new Date().toISOString()});
        return next;
      });
    }else{
      const na={id:"af_"+Date.now(),nombre:form.nombre.trim(),categoria:form.categoria,fechaAdquisicion:form.fechaAdquisicion,valorCompra:parseFloat(form.valorCompra)||0,proveedor:form.proveedor.trim()||null,notas:form.notas.trim()||null,estado:"activo",gastoIdOrigen:null,registradoPor:sesion?.nombre||null};
      setActivosFijos(prev=>[na,...prev]);
      if(upsertActivoFijo)upsertActivoFijo({...na,_updatedAt:new Date().toISOString()});
    }
    setForm(vacio);setEditId(null);
  };
  const editar=a=>{setEditId(a.id);setForm({nombre:a.nombre,categoria:a.categoria||"General",fechaAdquisicion:a.fechaAdquisicion||fechaHoyLocal(),valorCompra:String(a.valorCompra||0),proveedor:a.proveedor||"",notas:a.notas||""});};
  const cancelar=()=>{setEditId(null);setForm(vacio);};
  const darDeBaja=a=>{
    const motivo=window.prompt(`¿Motivo para dar de baja "${a.nombre}"? (ej. dañado, vendido, obsoleto)`,"");
    if(motivo===null)return;
    setActivosFijos(prev=>{
      const next=prev.map(x=>x.id===a.id?{...x,estado:"dado_de_baja",motivoBaja:motivo.trim()||null,fechaBaja:new Date().toISOString()}:x);
      const updated=next.find(x=>x.id===a.id);
      if(updated&&upsertActivoFijo)upsertActivoFijo({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
  };
  const totalInvertido=activos.reduce((a,x)=>a+(x.valorCompra||0),0);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📦 Activos Fijos</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Registro de máquinas, muebles y equipos del negocio. Si marcas un gasto como "activo fijo" en la pestaña Gastos, aparece aquí automáticamente.</div>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #7b1fa2"}}><div style={{fontSize:22}}>📦</div><div><div style={{fontWeight:800,fontSize:18,color:"#7b1fa2"}}>{activos.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Activos registrados</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #2e7d32"}}><div style={{fontSize:22}}>💰</div><div><div style={{fontWeight:800,fontSize:18,color:"#2e7d32"}}>${totalInvertido.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Total invertido</div></div></div>
    </div>
    <Card title={editId?"✏️ Editar activo":"➕ Nuevo activo fijo"}>
      <div style={{marginBottom:8}}><label style={S.lbl}>Nombre</label><input style={S.inp} placeholder="ej. Lavadora industrial 25lb" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Categoría</label><select style={S.inp} value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}>{CATEGORIAS_AF.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label style={S.lbl}>Valor de compra</label><input type="number" style={S.inp} placeholder="$0.00" value={form.valorCompra} onChange={e=>setForm({...form,valorCompra:e.target.value})}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Fecha de adquisición</label><input type="date" style={S.inp} value={form.fechaAdquisicion} onChange={e=>setForm({...form,fechaAdquisicion:e.target.value})}/></div>
        <div><label style={S.lbl}>Proveedor</label><input style={S.inp} value={form.proveedor} onChange={e=>setForm({...form,proveedor:e.target.value})}/></div>
      </div>
      <div style={{marginBottom:10}}><label style={S.lbl}>Notas</label><input style={S.inp} placeholder="Detalle adicional..." value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})}/></div>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btnP,flex:1}} onClick={guardar}>{editId?"✓ Guardar cambios":"➕ Agregar activo"}</button>
        {editId&&<button style={S.btnC} onClick={cancelar}>Cancelar</button>}
      </div>
    </Card>
    <Card title={`📋 Activos vigentes (${activos.length})`}>
      {activos.length===0&&<div style={S.empty}>Aún no has registrado activos fijos.</div>}
      {activos.map(a=>(
        <div key={a.id} style={S.vcard}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:700}}>{a.nombre}</div>
              <div style={{fontSize:11,color:"#888"}}>{a.categoria} · Adquirido {fmtD(a.fechaAdquisicion)}{a.proveedor?` · ${a.proveedor}`:""}</div>
              {a.notas&&<div style={{fontSize:11,color:"#888"}}>{a.notas}</div>}
              {a.gastoIdOrigen&&<div style={{fontSize:10,color:"#7b1fa2"}}>🔗 Vinculado a un gasto registrado</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,color:"#2e7d32"}}>${(a.valorCompra||0).toFixed(2)}</div>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button style={S.btnS} onClick={()=>editar(a)}>✏️</button>
                <button style={{...S.btnR}} onClick={()=>darDeBaja(a)}>Dar de baja</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </Card>
    {bajaDados.length>0&&(
      <Card title={`🗑️ Dados de baja (${bajaDados.length})`}>
        {bajaDados.map(a=>(
          <div key={a.id} style={{...S.vcard,opacity:0.6}}>
            <div style={{fontWeight:700}}>{a.nombre}</div>
            <div style={{fontSize:11,color:"#888"}}>${(a.valorCompra||0).toFixed(2)} · Baja: {fmtD(a.fechaBaja)}{a.motivoBaja?` · ${a.motivoBaja}`:""}</div>
          </div>
        ))}
      </Card>
    )}
  </div>);
}

// 💳 DEUDAS — pasivos del negocio (préstamos, crédito de proveedores, etc.), con pagos que se vinculan a Gastos
function DeudasAdmin({deudas,setDeudas,upsertDeuda,setGastos,upsertGasto,sesion}){
  const vacio={nombre:"",acreedor:"",montoTotal:"",fechaAdquisicion:fechaHoyLocal(),descripcion:""};
  const [form,setForm]=useState(vacio);
  const [pagoFor,setPagoFor]=useState(null); // id de la deuda a la que se le está registrando un pago
  const [montoPago,setMontoPago]=useState("");
  const [metodoPago,setMetodoPago]=useState("Efectivo");
  const saldoDe=d=>parseFloat(((d.montoTotal||0)-(d.pagos||[]).reduce((a,p)=>a+p.monto,0)).toFixed(2));
  const activas=(deudas||[]).filter(d=>saldoDe(d)>0.01);
  const pagadas=(deudas||[]).filter(d=>saldoDe(d)<=0.01);
  const crear=()=>{
    if(!form.nombre.trim()||!form.montoTotal){alert("Escribe el nombre/acreedor y el monto total de la deuda");return;}
    const nd={id:"deuda_"+Date.now(),nombre:form.nombre.trim(),acreedor:form.acreedor.trim()||null,montoTotal:parseFloat(form.montoTotal)||0,fechaAdquisicion:form.fechaAdquisicion,descripcion:form.descripcion.trim()||null,pagos:[],registradoPor:sesion?.nombre||null};
    setDeudas(prev=>[nd,...prev]);
    if(upsertDeuda)upsertDeuda({...nd,_updatedAt:new Date().toISOString()});
    setForm(vacio);
  };
  const registrarPago=d=>{
    const monto=parseFloat(montoPago);
    const saldo=saldoDe(d);
    if(!monto||monto<=0){alert("Escribe un monto válido");return;}
    if(monto>saldo+0.01){alert(`El pago no puede ser mayor al saldo pendiente ($${saldo.toFixed(2)})`);return;}
    const pago={id:"pago_"+Date.now(),fecha:new Date().toISOString(),monto,metodo:metodoPago,registradoPor:sesion?.nombre||null};
    // 💳 El pago se suma a la deuda...
    setDeudas(prev=>{
      const next=prev.map(x=>x.id===d.id?{...x,pagos:[...(x.pagos||[]),pago]}:x);
      const updated=next.find(x=>x.id===d.id);
      if(updated&&upsertDeuda)upsertDeuda({...updated,_updatedAt:new Date().toISOString()});
      return next;
    });
    // ...y AL MISMO TIEMPO queda como un gasto categorizado "Pago de deuda", para que se refleje en el flujo de caja
    if(setGastos){
      const gasto={id:Date.now()+1,descripcion:`Pago de deuda: ${d.nombre}`,categoria:"Pago de deuda",proveedor:d.acreedor||"",numeroFactura:"",monto,fecha:fechaHoyLocal(),metodoPago,notas:`Abono a deuda · Saldo restante: $${(saldo-monto).toFixed(2)}`,registradoPor:sesion?.nombre||null,deudaIdOrigen:d.id};
      setGastos(prev=>[gasto,...prev]);
      if(upsertGasto)upsertGasto({...gasto,_updatedAt:new Date().toISOString()});
    }
    setPagoFor(null);setMontoPago("");
  };
  const totalDeuda=activas.reduce((a,d)=>a+saldoDe(d),0);
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>💳 Deudas</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Cada pago que registres aquí también queda como un gasto (categoría "Pago de deuda"), para que se refleje en tu flujo de caja y reportes.</div>
    <div style={S.kgrid}>
      <div style={{...S.kpi,borderLeft:"4px solid #c62828"}}><div style={{fontSize:22}}>💳</div><div><div style={{fontWeight:800,fontSize:18,color:"#c62828"}}>${totalDeuda.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Deuda pendiente</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #888"}}><div style={{fontSize:22}}>📋</div><div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>{activas.length}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Deuda(s) activa(s)</div></div></div>
    </div>
    <Card title="➕ Nueva deuda">
      <div style={{marginBottom:8}}><label style={S.lbl}>Nombre / concepto</label><input style={S.inp} placeholder="ej. Préstamo para lavadora nueva" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Acreedor (a quién se le debe)</label><input style={S.inp} value={form.acreedor} onChange={e=>setForm({...form,acreedor:e.target.value})}/></div>
        <div><label style={S.lbl}>Monto total de la deuda</label><input type="number" style={S.inp} placeholder="$0.00" value={form.montoTotal} onChange={e=>setForm({...form,montoTotal:e.target.value})}/></div>
      </div>
      <div style={{marginBottom:8}}><label style={S.lbl}>Fecha en que se adquirió</label><input type="date" style={S.inp} value={form.fechaAdquisicion} onChange={e=>setForm({...form,fechaAdquisicion:e.target.value})}/></div>
      <div style={{marginBottom:10}}><label style={S.lbl}>Descripción (opcional)</label><textarea style={{...S.inp,minHeight:56,resize:"vertical"}} value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></div>
      <button style={{...S.btnP,width:"100%"}} onClick={crear}>➕ Registrar deuda</button>
    </Card>
    <Card title={`📋 Deudas activas (${activas.length})`}>
      {activas.length===0&&<div style={S.empty}>Sin deudas activas.</div>}
      {activas.map(d=>{
        const saldo=saldoDe(d);
        const pctPagado=d.montoTotal>0?Math.min(100,((d.montoTotal-saldo)/d.montoTotal)*100):0;
        return(
          <div key={d.id} style={S.vcard}>
            <div style={{fontWeight:700}}>{d.nombre}</div>
            <div style={{fontSize:11,color:"#888"}}>{d.acreedor?`Acreedor: ${d.acreedor} · `:""}Desde {fmtD(d.fechaAdquisicion)}</div>
            {d.descripcion&&<div style={{fontSize:11,color:"#888"}}>{d.descripcion}</div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:8}}>
              <span>Total: <strong>${(d.montoTotal||0).toFixed(2)}</strong></span>
              <span style={{color:"#c62828",fontWeight:700}}>Saldo: ${saldo.toFixed(2)}</span>
            </div>
            <div style={{background:"#e8f0f7",borderRadius:6,height:8,marginTop:6}}><div style={{background:"#2e7d32",width:`${pctPagado}%`,height:"100%",borderRadius:6}}/></div>
            {(d.pagos||[]).length>0&&<div style={{fontSize:11,color:"#2e7d32",marginTop:6}}>{d.pagos.length} pago(s) realizado(s) · ${(d.montoTotal-saldo).toFixed(2)} abonado</div>}
            {pagoFor===d.id?(
              <div style={{marginTop:10,background:"#f8fbfd",borderRadius:8,padding:10,border:"1px solid #e8f0f7"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                  <input type="number" style={S.inp} placeholder={`Máx $${saldo.toFixed(2)}`} value={montoPago} onChange={e=>setMontoPago(e.target.value)}/>
                  <select style={S.inp} value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}>{PAGOS.map(p=><option key={p}>{p}</option>)}</select>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={{...S.btnS,flex:1,background:"#2e7d32",color:"#fff"}} onClick={()=>registrarPago(d)}>✓ Registrar pago</button>
                  <button style={{...S.btnS,flex:1}} onClick={()=>{setPagoFor(null);setMontoPago("");}}>Cancelar</button>
                </div>
              </div>
            ):(
              <button style={{...S.btnP,width:"100%",marginTop:10,background:"linear-gradient(135deg,#2e7d32,#4caf50)"}} onClick={()=>setPagoFor(d.id)}>💰 Registrar pago</button>
            )}
          </div>
        );
      })}
    </Card>
    {pagadas.length>0&&(
      <Card title={`✅ Deudas pagadas (${pagadas.length})`}>
        {pagadas.map(d=>(
          <div key={d.id} style={{...S.vcard,opacity:0.7,borderLeft:"4px solid #2e7d32"}}>
            <div style={{fontWeight:700}}>{d.nombre}</div>
            <div style={{fontSize:11,color:"#2e7d32"}}>✅ Pagada por completo — ${(d.montoTotal||0).toFixed(2)}</div>
          </div>
        ))}
      </Card>
    )}
  </div>);
}

// 📒 KARDEX — pantalla dedicada para revisar TODOS los movimientos de productos e insumos, en formato de tabla con filtros
// (Fecha inicio/fin + búsqueda por artículo), igual que un kardex de sistema de inventario tradicional.
// 📋 CONTEO FÍSICO DE INVENTARIO — la colaboradora cuenta cada producto a mano y el sistema compara contra el stock esperado al final
function ConteoProductos({productos,setConteos,upsertConteo,sesion}){
  const activos=(productos||[]).filter(p=>!p.eliminada);
  const [conteo,setConteo]=useState({}); // {productoId: "cantidad contada"}
  const [resultado,setResultado]=useState(null); // conteo ya finalizado, para mostrar el resumen
  const faltantes=activos.filter(p=>conteo[p.id]===undefined||conteo[p.id]==="");

  const finalizar=()=>{
    if(faltantes.length>0){
      if(!window.confirm(`Te faltan ${faltantes.length} producto(s) por contar (${faltantes.map(p=>p.nombre).join(", ")}). ¿Terminar de todas formas? Los que falten se marcan como "no contado".`))return;
    }
    const items=activos.map(p=>{
      const contadoStr=conteo[p.id];
      const contado=contadoStr===undefined||contadoStr===""?null:parseInt(contadoStr)||0;
      const esperado=p.stock||0;
      return{productoId:p.id,nombre:p.nombre,esperado,contado,diferencia:contado===null?null:contado-esperado};
    });
    const conDiferencia=items.filter(it=>it.diferencia!==null&&it.diferencia!==0);
    const registro={id:"cti_"+Date.now(),fecha:new Date().toISOString(),realizadoPor:sesion?.nombre||null,items,totalCoincide:conDiferencia.length===0&&items.every(it=>it.contado!==null),totalDiferencias:conDiferencia.length};
    setConteos(prev=>[registro,...prev]);
    if(upsertConteo)upsertConteo(registro);
    setResultado(registro);
  };

  const nuevoConteo=()=>{setConteo({});setResultado(null);};

  const descargarCSV=reg=>{
    const enc=["Producto","Esperado (sistema)","Contado (físico)","Diferencia","¿Coincide?"];
    const filas=reg.items.map(it=>[it.nombre,it.esperado,it.contado===null?"No contado":it.contado,it.contado===null?"—":it.diferencia,it.contado===null?"—":it.diferencia===0?"✅ Sí":"⚠️ No"]);
    filas.push(["","","","",""]);
    filas.push(["Realizado por:",reg.realizadoPor||"","Fecha:",fmt(reg.fecha),""]);
    filas.push(["Coincidencias totales:",reg.totalCoincide?"✅ Todo coincidió":`⚠️ ${reg.totalDiferencias} con diferencia`,"","",""]);
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="conteo_inventario-"+fechaLocal(reg.fecha)+".csv";a.click();
  };

  if(resultado){
    const conDif=resultado.items.filter(it=>it.diferencia!==null&&it.diferencia!==0);
    const noContados=resultado.items.filter(it=>it.contado===null);
    return(<div style={S.panel}>
      <h2 style={S.ptitle}>📋 Resultado del conteo</h2>
      <div style={{...S.alrt,background:resultado.totalCoincide?"#e8f5e9":"#fff3e0",color:resultado.totalCoincide?"#2e7d32":"#e65100",fontSize:14,fontWeight:700,textAlign:"center",padding:16}}>
        {resultado.totalCoincide?"✅ ¡Todo coincidió con el sistema!":`⚠️ ${conDif.length} producto(s) con diferencia${noContados.length>0?` · ${noContados.length} sin contar`:""}`}
      </div>
      <Card title="📊 Detalle completo">
        {resultado.items.map(it=>(
          <div key={it.productoId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{it.nombre}</div><div style={{fontSize:11,color:"#888"}}>Sistema: {it.esperado} · Contado: {it.contado===null?"—":it.contado}</div></div>
            <div style={{fontWeight:800,fontSize:13,color:it.contado===null?"#aaa":it.diferencia===0?"#2e7d32":"#c62828"}}>{it.contado===null?"Sin contar":it.diferencia===0?"✅ Coincide":(it.diferencia>0?"+":"")+it.diferencia}</div>
          </div>
        ))}
      </Card>
      <button style={{...S.btnP,width:"100%",marginBottom:8}} onClick={()=>descargarCSV(resultado)}>📥 Descargar Excel de este conteo</button>
      <button style={{...S.btnS,width:"100%"}} onClick={nuevoConteo}>🔄 Hacer otro conteo</button>
    </div>);
  }

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📋 Conteo físico de inventario</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Cuenta a mano cuántas unidades hay realmente de cada producto y escríbelo aquí. Al final, el sistema te dice si coincide con lo que dice el stock — hazlo 2 veces por semana.</div>
    <Card title={`📦 Productos (${activos.length - faltantes.length}/${activos.length} contados)`}>
      {activos.length===0&&<div style={S.empty}>No hay productos en el catálogo todavía.</div>}
      {activos.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{p.nombre}</div></div>
          <input type="number" min="0" style={{...S.inp,width:80,padding:"6px 8px",textAlign:"center"}} placeholder="Cant." value={conteo[p.id]??""} onChange={e=>setConteo({...conteo,[p.id]:e.target.value})}/>
        </div>
      ))}
    </Card>
    <button style={{...S.btnP,width:"100%"}} onClick={finalizar}>✅ Finalizar conteo y comparar</button>
  </div>);
}

// 📋 Historial de conteos para el admin
function ConteosAdmin({conteos}){
  const [verId,setVerId]=useState(null);
  const lista=[...(conteos||[])].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📋 Conteos de inventario realizados</h2>
    {lista.length===0&&<div style={S.empty}>Todavía no se ha hecho ningún conteo.</div>}
    {lista.map(reg=>{
      const conDif=reg.items.filter(it=>it.diferencia!==null&&it.diferencia!==0);
      return(
        <Card key={reg.id} title={fmt(reg.fecha)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#888"}}>Realizado por: {reg.realizadoPor||"—"}</div>
              <div style={{fontSize:13,fontWeight:700,color:reg.totalCoincide?"#2e7d32":"#e65100"}}>{reg.totalCoincide?"✅ Todo coincidió":`⚠️ ${conDif.length} con diferencia`}</div>
            </div>
            <button style={S.btnS} onClick={()=>setVerId(verId===reg.id?null:reg.id)}>{verId===reg.id?"Ocultar":"Ver detalle"}</button>
          </div>
          {verId===reg.id&&(
            <div style={{marginTop:10}}>
              {reg.items.map(it=>(
                <div key={it.productoId} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f0f4f8",fontSize:12}}>
                  <span>{it.nombre} <span style={{color:"#888"}}>(sist: {it.esperado} / cont: {it.contado===null?"—":it.contado})</span></span>
                  <strong style={{color:it.contado===null?"#aaa":it.diferencia===0?"#2e7d32":"#c62828"}}>{it.contado===null?"—":it.diferencia===0?"✅":(it.diferencia>0?"+":"")+it.diferencia}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    })}
  </div>);
}

// 📋 EVALUACIÓN DE DESEMPEÑO — pantalla principal: selector de mes/colaboradora, tabla de indicadores, nota final, semáforo, imprimir PDF
function EvaluacionDesempeno({empleadas,ventas,eventosProduccion,tareasDiarias,quejas,cargas,evalConfig,esAdmin,miEmpleadaId,calificacionesAudio,ventasPerfumeReg}){
  const activas=(empleadas||[]).filter(e=>e.activa);
  const [mesSel,setMesSel]=useState(mesK(new Date()));
  const [empSel,setEmpSel]=useState(esAdmin?(activas[0]?.id||null):miEmpleadaId);
  const empleadaActual=activas.find(e=>String(e.id)===String(empSel))||empleadas.find(e=>String(e.id)===String(empSel));

  const {filas,notaFinal}=empleadaActual?calcularKPIsEmpleada(empleadaActual.id,mesSel,{ventas,eventosProduccion,tareasDiarias,quejas,cargas,empleada:empleadaActual,config:evalConfig,calificacionesAudio,ventasPerfumeReg}):{filas:[],notaFinal:0};
  const semaforo=notaFinal>=90?{color:"#2e7d32",bg:"#e8f5e9",label:"🟢 Verde — desempeño sobresaliente"}:notaFinal>=75?{color:"#e65100",bg:"#fff3e0",label:"🟡 Amarillo — cumple, con oportunidades de mejora"}:{color:"#c62828",bg:"#ffebee",label:"🔴 Rojo — requiere plan de mejora"};

  const imprimirPDF=()=>{
    const w=window.open("","_blank","width=800,height=1000");
    if(!w)return;
    const filasHtml=filas.map(f=>{
      const realTxt=f.sinDatos?"Sin datos":f.unidad==="$"?"$"+f.real.toFixed(2):f.unidad==="#"?f.real:f.real.toFixed(0)+"%";
      const metaTxt=f.unidad==="$"?"$"+f.meta.toFixed(2):f.unidad==="#"?"máx "+f.meta:f.meta+"%";
      return"<tr><td style='padding:8px;border:1px solid #ddd'>"+f.label+"</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>"+metaTxt+"</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>"+realTxt+"</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>"+(f.sinDatos?"—":f.pctCumplimiento.toFixed(0)+"%")+"</td><td style='padding:8px;border:1px solid #ddd;text-align:center'>"+f.peso+"%</td><td style='padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold'>"+f.puntaje.toFixed(1)+"</td></tr>";
    }).join("");
    const html="<html><head><meta charset='UTF-8'><title>Evaluación de Desempeño</title><style>body{font-family:sans-serif;padding:30px;color:#1a3c5e}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th{background:#1a3c5e;color:#fff;padding:8px;text-align:left}</style></head><body>"
      +"<div style='text-align:center;margin-bottom:20px'><div style='font-size:22px;font-weight:800'>🫧 Lava&Listo</div><div style='font-size:12px;color:#888'>Ricaurte, Cuenca</div></div>"
      +"<h2 style='text-align:center;border-bottom:2px solid #1a3c5e;padding-bottom:10px'>Evaluación de Desempeño</h2>"
      +"<div style='display:flex;justify-content:space-between;margin:16px 0;font-size:14px'><div><strong>Colaboradora:</strong> "+(empleadaActual?.nombre||"")+"</div><div><strong>Mes evaluado:</strong> "+mesSel+"</div></div>"
      +"<table><tr><th>Indicador</th><th>Meta</th><th>Resultado real</th><th>% Cumplimiento</th><th>Peso</th><th>Puntaje</th></tr>"+filasHtml+"</table>"
      +"<div style='margin-top:24px;padding:16px;background:"+semaforo.bg+";border-radius:10px;text-align:center'><div style='font-size:14px;color:#555'>NOTA FINAL</div><div style='font-size:32px;font-weight:800;color:"+semaforo.color+"'>"+notaFinal.toFixed(1)+"%</div><div style='font-size:13px;color:"+semaforo.color+";font-weight:600'>"+semaforo.label+"</div></div>"
      +"<div style='margin-top:60px;display:flex;justify-content:space-between'><div style='border-top:1px solid #333;width:200px;text-align:center;padding-top:6px;font-size:12px'>Firma colaboradora</div><div style='border-top:1px solid #333;width:200px;text-align:center;padding-top:6px;font-size:12px'>Firma administradora</div></div>"
      +"<scr"+"ipt>window.print();</"+"script></body></html>";
    w.document.write(html);
    w.document.close();
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📋 Evaluación de Desempeño</h2>
    <Card title="🔍 Selección">
      <div style={{display:"grid",gridTemplateColumns:esAdmin?"1fr 1fr":"1fr",gap:8}}>
        <div><label style={S.lbl}>Mes</label><input type="month" style={S.inp} value={mesSel} onChange={e=>setMesSel(e.target.value)}/></div>
        {esAdmin&&<div><label style={S.lbl}>Colaboradora</label><select style={S.inp} value={empSel||""} onChange={e=>setEmpSel(e.target.value)}>{activas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>}
      </div>
    </Card>

    {!empleadaActual&&<div style={S.empty}>No se pudo identificar a la colaboradora.</div>}

    {empleadaActual&&(<>
      <div style={{background:semaforo.bg,borderRadius:14,padding:18,marginBottom:16,textAlign:"center",border:`2px solid ${semaforo.color}`}}>
        <div style={{fontSize:12,color:"#888",fontWeight:600}}>{empleadaActual.nombre} · {mesSel}</div>
        <div style={{fontSize:38,fontWeight:800,color:semaforo.color,margin:"6px 0"}}>{notaFinal.toFixed(1)}%</div>
        <div style={{fontSize:13,fontWeight:700,color:semaforo.color}}>{semaforo.label}</div>
      </div>

      <Card title="📊 Detalle por indicador">
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:520}}>
            <thead>
              <tr style={{background:"#f0f4f8",textAlign:"left"}}>
                <th style={{padding:"6px 8px"}}>Indicador</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Meta</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Real</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>% Cumpl.</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Peso</th>
                <th style={{padding:"6px 8px",textAlign:"center"}}>Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f=>(
                <tr key={f.key} style={{borderBottom:"1px solid #f0f4f8"}}>
                  <td style={{padding:"6px 8px",color:"#1a3c5e",fontWeight:600}}>{f.label}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",color:"#888"}}>{f.unidad==="$"?"$"+f.meta.toFixed(2):f.unidad==="#"?"máx "+f.meta:f.meta+"%"}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontWeight:700,color:f.sinDatos?"#aaa":"#1a3c5e"}}>{f.sinDatos?"Sin datos":f.unidad==="$"?"$"+f.real.toFixed(2):f.unidad==="#"?f.real:f.real.toFixed(0)+"%"}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontWeight:700,color:f.sinDatos?"#aaa":f.pctCumplimiento>=90?"#2e7d32":f.pctCumplimiento>=75?"#e65100":"#c62828"}}>{f.sinDatos?"—":f.pctCumplimiento.toFixed(0)+"%"}</td>
                  <td style={{padding:"6px 8px",textAlign:"center",color:"#888"}}>{f.peso}%</td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontWeight:800,color:"#1a3c5e"}}>{f.puntaje.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filas.some(f=>f.sinDatos)&&<div style={{fontSize:11,color:"#888",marginTop:10}}>💡 "Sin datos" significa que no hubo actividad registrada de ese indicador en el mes — no resta puntos, pero tampoco suma.</div>}
      </Card>

      <button style={{...S.btnP,width:"100%"}} onClick={imprimirPDF}>🖨️ Imprimir / Exportar PDF</button>
    </>)}
  </div>);
}

// ⚙️ Configuración de pesos/metas de la Evaluación de Desempeño (solo admin)
// 🎧 CALIFICACIÓN MANUAL — aquí se registran las 2 escuchas semanales de audio por colaboradora (~8 al mes),
// y también se pueden agregar quejas que no vinieron de una venta específica.
function CalificacionManualAdmin({empleadas,calificacionesAudio,setCalificacionesAudio,upsertCalificacionAudio,quejas,setQuejas,upsertQueja,sesion}){
  const activas=(empleadas||[]).filter(e=>e.activa);
  const [empSel,setEmpSel]=useState(activas[0]?.id||null);
  const [fechaAudio,setFechaAudio]=useState(fechaHoyLocal());
  const [calAudio,setCalAudio]=useState("90");
  const [notaAudio,setNotaAudio]=useState("");
  const [fechaQueja,setFechaQueja]=useState(fechaHoyLocal());
  const [motivoQueja,setMotivoQueja]=useState("");

  const mesAct=mesK(new Date());
  const audiosDelMes=(calificacionesAudio||[]).filter(c=>String(c.empleadaId)===String(empSel)&&mesK(new Date(c.fecha))===mesAct);
  const promedioMes=audiosDelMes.length>0?audiosDelMes.reduce((a,c)=>a+c.calificacion,0)/audiosDelMes.length:null;

  const agregarAudio=()=>{
    if(!empSel){alert("Selecciona una colaboradora");return;}
    const cal=parseFloat(calAudio);
    if(isNaN(cal)||cal<0||cal>100){alert("La calificación debe ser un número entre 0 y 100");return;}
    const reg={id:"audio_"+Date.now(),empleadaId:empSel,fecha:fechaAudio,calificacion:cal,nota:notaAudio.trim()||null,registradoPor:sesion?.nombre||null};
    setCalificacionesAudio(prev=>[reg,...prev]);
    if(upsertCalificacionAudio)upsertCalificacionAudio({...reg,_updatedAt:new Date().toISOString()});
    setCalAudio("90");setNotaAudio("");
  };
  const borrarAudio=id=>{
    if(!window.confirm("¿Eliminar esta calificación?"))return;
    setCalificacionesAudio(prev=>{
      const next=prev.filter(c=>c.id!==id);
      return next;
    });
  };
  const agregarQuejaManual=()=>{
    if(!empSel){alert("Selecciona una colaboradora");return;}
    if(!motivoQueja.trim()){alert("Escribe el motivo de la queja");return;}
    const q={id:"queja_"+Date.now(),empleadaId:empSel,ventaFolio:null,clienteNombre:"",motivo:motivoQueja.trim(),fecha:fechaQueja,registradoPor:sesion?.nombre||null};
    setQuejas(prev=>[q,...prev]);
    if(upsertQueja)upsertQueja({...q,_updatedAt:new Date().toISOString()});
    setMotivoQueja("");
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🎧 Calificación manual</h2>
    <Card title="🔍 Colaboradora">
      <select style={S.inp} value={empSel||""} onChange={e=>setEmpSel(e.target.value)}>{activas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
    </Card>

    <Card title="🎧 Calificar un audio de atención">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Escucha 2 audios al azar por semana (~8 al mes) y califica cada uno con un % — el sistema promedia todos los del mes para el indicador de protocolo.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={fechaAudio} onChange={e=>setFechaAudio(e.target.value)}/></div>
        <div><label style={S.lbl}>Calificación (%)</label><input type="number" min="0" max="100" style={S.inp} value={calAudio} onChange={e=>setCalAudio(e.target.value)}/></div>
      </div>
      <label style={S.lbl}>Nota (opcional)</label>
      <input style={S.inp} placeholder="ej. Buen saludo, se le olvidó confirmar el teléfono..." value={notaAudio} onChange={e=>setNotaAudio(e.target.value)}/>
      <button style={{...S.btnP,width:"100%",marginTop:10}} onClick={agregarAudio}>➕ Guardar calificación</button>
      {promedioMes!=null&&<div style={{fontSize:13,fontWeight:700,color:"#1a3c5e",marginTop:10,textAlign:"center"}}>Promedio de este mes: {promedioMes.toFixed(0)}% ({audiosDelMes.length} audio{audiosDelMes.length!==1?"s":""} calificado{audiosDelMes.length!==1?"s":""})</div>}
      {audiosDelMes.length>0&&(
        <div style={{marginTop:10}}>
          {audiosDelMes.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div><span style={{fontSize:12,color:"#1a3c5e",fontWeight:600}}>{fmtD(c.fecha)}</span>{c.nota&&<span style={{fontSize:11,color:"#888"}}> · {c.nota}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <strong style={{color:c.calificacion>=90?"#2e7d32":c.calificacion>=75?"#e65100":"#c62828"}}>{c.calificacion}%</strong>
                <button style={S.btnR} onClick={()=>borrarAudio(c.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>

    <Card title="📢 Agregar queja (sin orden asociada)">
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>Si la queja no vino de una venta específica, regístrala aquí. Si sí es sobre una orden puntual, mejor usa el botón "📢 Registrar queja" desde el Historial de esa venta.</div>
      <div style={{marginBottom:8}}><label style={S.lbl}>Fecha</label><input type="date" style={S.inp} value={fechaQueja} onChange={e=>setFechaQueja(e.target.value)}/></div>
      <label style={S.lbl}>Motivo</label>
      <textarea style={{...S.inp,minHeight:56,resize:"vertical"}} value={motivoQueja} onChange={e=>setMotivoQueja(e.target.value)}/>
      <button style={{...S.btnP,width:"100%",marginTop:10,background:"linear-gradient(135deg,#e65100,#ff9800)"}} onClick={agregarQuejaManual}>📢 Registrar queja</button>
    </Card>
  </div>);
}

function EvaluacionConfigAdmin({evalConfig,setEvalConfigArr,upsertEvalConfig}){
  const [ed,setEd]=useState({pesos:{...evalConfig.pesos},metas:{...evalConfig.metas},tiemposEstandar:{...evalConfig.tiemposEstandar},tiemposEstandarZapatos:{...(evalConfig.tiemposEstandarZapatos||{lavado:78,centrifugado:15,secado:90})},toleranciaPuntualidadMin:evalConfig.toleranciaPuntualidadMin});
  const [guardado,setGuardado]=useState(false);
  const sumaPesos=Object.values(ed.pesos).reduce((a,v)=>a+(parseFloat(v)||0),0);
  const guardar=()=>{
    if(Math.round(sumaPesos)!==100){alert(`Los pesos deben sumar exactamente 100%. Ahora mismo suman ${sumaPesos}%.`);return;}
    const nuevo={id:"config",pesos:Object.fromEntries(Object.entries(ed.pesos).map(([k,v])=>[k,parseFloat(v)||0])),metas:Object.fromEntries(Object.entries(ed.metas).map(([k,v])=>[k,parseFloat(v)||0])),tiemposEstandar:Object.fromEntries(Object.entries(ed.tiemposEstandar).map(([k,v])=>[k,parseFloat(v)||0])),tiemposEstandarZapatos:Object.fromEntries(Object.entries(ed.tiemposEstandarZapatos).map(([k,v])=>[k,parseFloat(v)||0])),toleranciaPuntualidadMin:parseFloat(ed.toleranciaPuntualidadMin)||10};
    setEvalConfigArr([nuevo]);
    if(upsertEvalConfig)upsertEvalConfig({...nuevo,_updatedAt:new Date().toISOString()});
    setGuardado(true);setTimeout(()=>setGuardado(false),2000);
  };
  return(<div style={S.panel}>
    <h2 style={S.ptitle}>⚙️ Configurar Evaluación de Desempeño</h2>
    {guardado&&<div style={{...S.alrt,background:"#e8f5e9",color:"#2e7d32"}}>✅ Guardado</div>}
    <Card title="⚖️ Pesos por indicador (deben sumar 100%)">
      <div style={{fontSize:13,fontWeight:800,marginBottom:8,color:sumaPesos===100?"#2e7d32":"#c62828"}}>Suma actual: {sumaPesos}% {sumaPesos===100?"✅":"⚠️"}</div>
      {EVAL_INDICADORES.map(ind=>(
        <div key={ind.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{flex:1,fontSize:13}}>{ind.label}</span>
          <input type="number" style={{...S.inp,width:70}} value={ed.pesos[ind.key]} onChange={e=>setEd({...ed,pesos:{...ed.pesos,[ind.key]:e.target.value}})}/>
          <span style={{fontSize:12,color:"#888"}}>%</span>
        </div>
      ))}
    </Card>
    <Card title="🎯 Metas por indicador">
      {EVAL_INDICADORES.map(ind=>(
        <div key={ind.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{flex:1,fontSize:13}}>{ind.label}</span>
          <input type="number" step="0.01" style={{...S.inp,width:80}} value={ed.metas[ind.key]} onChange={e=>setEd({...ed,metas:{...ed.metas,[ind.key]:e.target.value}})}/>
          <span style={{fontSize:12,color:"#888"}}>{ind.unidad}</span>
        </div>
      ))}
    </Card>
    <Card title="⏱️ Tiempo estándar por etapa — ROPA (minutos)">
      {[["lavado","Lavado"],["centrifugado","Centrifugado"],["secado","Secado"],["doblado","Doblado/Empaquetado"]].map(([k,l])=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{flex:1,fontSize:13}}>{l}</span>
          <input type="number" style={{...S.inp,width:70}} value={ed.tiemposEstandar[k]} onChange={e=>setEd({...ed,tiemposEstandar:{...ed.tiemposEstandar,[k]:e.target.value}})}/>
          <span style={{fontSize:12,color:"#888"}}>min</span>
        </div>
      ))}
    </Card>
    <Card title="⏱️ Tiempo estándar por etapa — ZAPATOS (minutos)">
      <div style={{fontSize:11,color:"#888",marginBottom:8}}>Lavado 1.3h y secado 1.5h para 20 pares — la duración real crece si hay más pares o se usan más máquinas, este es solo el estándar de referencia.</div>
      {[["lavado","Lavado"],["centrifugado","Centrifugado (6-7 pares)"],["secado","Secado (hasta 20 pares)"]].map(([k,l])=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{flex:1,fontSize:13}}>{l}</span>
          <input type="number" style={{...S.inp,width:70}} value={ed.tiemposEstandarZapatos[k]} onChange={e=>setEd({...ed,tiemposEstandarZapatos:{...ed.tiemposEstandarZapatos,[k]:e.target.value}})}/>
          <span style={{fontSize:12,color:"#888"}}>min</span>
        </div>
      ))}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
        <span style={{flex:1,fontSize:13}}>Tolerancia de puntualidad</span>
        <input type="number" style={{...S.inp,width:70}} value={ed.toleranciaPuntualidadMin} onChange={e=>setEd({...ed,toleranciaPuntualidadMin:e.target.value})}/>
        <span style={{fontSize:12,color:"#888"}}>min</span>
      </div>
    </Card>
    <button style={{...S.btnP,width:"100%"}} onClick={guardar}>💾 Guardar configuración</button>
  </div>);
}

// 🏭 REPORTE DE USO DE MÁQUINAS — desde qué hora hasta qué hora estuvo ocupada cada máquina, comparado contra el
// tiempo estándar real (ropa: lavado ~67min, secado ~70min · zapatos: lavado 1.3h, centrifugado 15min, secado hasta 1.5h)
function ReporteMaquinas({cargas,maquinas,ventas,evalConfig}){
  const hoy=fechaHoyLocal();
  const [desde,setDesde]=useState(hoy);
  const [hasta,setHasta]=useState(hoy);
  const [filtroMaquina,setFiltroMaquina]=useState("todas");
  const nombreMaquina=id=>maquinas.find(m=>m.id===id)?.nombre||id;
  const clienteDe=folio=>ventas.find(v=>v.folio===folio)?.clienteNombre||"—";

  const cargasFiltradas=(cargas||[]).filter(c=>{
    const f=fechaLocal(c.inicio);
    if(f<desde||f>hasta)return false;
    if(filtroMaquina!=="todas"&&c.maquinaId!==filtroMaquina)return false;
    return true;
  }).sort((a,b)=>new Date(b.inicio)-new Date(a.inicio));

  const estandarDe=c=>{
    const tabla=c.grupo==="zapatos"?(evalConfig.tiemposEstandarZapatos||{}):evalConfig.tiemposEstandar;
    return tabla[c.tipo]||c.minutosProgramados||45;
  };

  const totalHorasOcupada=cargasFiltradas.filter(c=>c.finReal).reduce((a,c)=>a+(new Date(c.finReal)-new Date(c.inicio))/3600000,0);
  const promDuracion=cargasFiltradas.filter(c=>c.finReal).length>0?cargasFiltradas.filter(c=>c.finReal).reduce((a,c)=>a+(new Date(c.finReal)-new Date(c.inicio))/60000,0)/cargasFiltradas.filter(c=>c.finReal).length:0;

  const exportarCSV=()=>{
    if(cargasFiltradas.length===0){alert("No hay cargas en ese rango.");return;}
    const enc=["Máquina","Tipo","Grupo","Cliente(s)","Desde","Hasta","Duración real (min)","Estándar (min)","Diferencia (min)","¿Dentro del estándar?"];
    const filas=cargasFiltradas.map(c=>{
      const folios=c.ventaFolios&&c.ventaFolios.length?c.ventaFolios:[c.ventaFolio];
      const duracionReal=c.finReal?Math.round((new Date(c.finReal)-new Date(c.inicio))/60000):null;
      const estandar=estandarDe(c);
      return[nombreMaquina(c.maquinaId),c.tipo,c.grupo||"ropa",folios.map(clienteDe).join(" | "),fmt(c.inicio),c.finReal?fmt(c.finReal):"En curso",duracionReal??"—",estandar,duracionReal!=null?duracionReal-estandar:"—",duracionReal!=null?(duracionReal<=estandar*1.15?"Sí":"No"):"—"];
    });
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="uso_maquinas-"+desde+"_a_"+hasta+".csv";a.click();
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>🏭 Reporte de uso de máquinas</h2>
    <Card title="🔍 Filtros">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
      </div>
      <label style={S.lbl}>Máquina</label>
      <select style={S.inp} value={filtroMaquina} onChange={e=>setFiltroMaquina(e.target.value)}>
        <option value="todas">Todas las máquinas</option>
        {maquinas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <button style={{...S.btnP,width:"100%",marginTop:10}} onClick={exportarCSV}>📥 Descargar CSV ({cargasFiltradas.length})</button>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <div style={{...S.kpi,borderLeft:"4px solid #1a3c5e"}}><div style={{fontSize:20}}>⏱️</div><div><div style={{fontWeight:800,fontSize:16,color:"#1a3c5e"}}>{totalHorasOcupada.toFixed(1)}h</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Total horas ocupadas</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #4db6e4"}}><div style={{fontSize:20}}>📊</div><div><div style={{fontWeight:800,fontSize:16,color:"#1a3c5e"}}>{promDuracion.toFixed(0)} min</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Duración promedio</div></div></div>
    </div>

    <Card title={`📋 Cargas registradas (${cargasFiltradas.length})`}>
      {cargasFiltradas.length===0&&<div style={S.empty}>Sin cargas en este rango.</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:640}}>
          <thead>
            <tr style={{background:"#f0f4f8",textAlign:"left"}}>
              <th style={{padding:"6px 8px"}}>Máquina</th>
              <th style={{padding:"6px 8px"}}>Tipo</th>
              <th style={{padding:"6px 8px"}}>Cliente(s)</th>
              <th style={{padding:"6px 8px",whiteSpace:"nowrap"}}>Desde</th>
              <th style={{padding:"6px 8px",whiteSpace:"nowrap"}}>Hasta</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Duración</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Estándar</th>
              <th style={{padding:"6px 8px",textAlign:"center"}}>¿OK?</th>
            </tr>
          </thead>
          <tbody>
            {cargasFiltradas.map(c=>{
              const folios=c.ventaFolios&&c.ventaFolios.length?c.ventaFolios:[c.ventaFolio];
              const duracionReal=c.finReal?Math.round((new Date(c.finReal)-new Date(c.inicio))/60000):null;
              const estandar=estandarDe(c);
              const ok=duracionReal!=null?duracionReal<=estandar*1.15:null;
              return(
                <tr key={c.id} style={{borderBottom:"1px solid #f0f4f8"}}>
                  <td style={{padding:"6px 8px",fontWeight:700,color:"#1a3c5e"}}>{nombreMaquina(c.maquinaId)}{c.grupo==="zapatos"?" 👟":""}</td>
                  <td style={{padding:"6px 8px",color:"#888"}}>{c.tipo}</td>
                  <td style={{padding:"6px 8px",color:"#888",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{folios.map(clienteDe).join(", ")}</td>
                  <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{fmt(c.inicio)}</td>
                  <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{c.finReal?fmt(c.finReal):<span style={{color:"#1565c0",fontWeight:700}}>En curso</span>}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700}}>{duracionReal!=null?duracionReal+" min":"—"}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:"#888"}}>{estandar} min</td>
                  <td style={{padding:"6px 8px",textAlign:"center"}}>{ok===null?"—":ok?"✅":"⚠️"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  </div>);
}

// ⏱️ TIEMPOS DE ROPA POR LIBRAS — analiza cada orden de ropa: quién la atendió, cuánto tardó en total, y en cada
// espera entre etapas, si fue porque las máquinas estaban ocupadas (normal) o porque nadie actuó a tiempo aunque
// había máquina libre (demora operativa). Excluye zapatos — eso se ve en la pestaña Zapatos, no aquí.
function TiemposRopaAdmin({ventas,eventosProduccion,cargas,maquinas,empleadas}){
  const hoy=fechaHoyLocal();
  const [desde,setDesde]=useState((()=>{const d=new Date();d.setDate(d.getDate()-30);return fechaLocal(d.toISOString());})());
  const [hasta,setHasta]=useState(hoy);
  const [verDetalleFolio,setVerDetalleFolio]=useState(null);
  const esZapatoLbl=lbl=>/ZAPATO|PARES?\b|TENIS|CALZADO|BOTAS?\b|SANDALIA|ZAPATILLA|MOCAS[IÍ]N|SNEAKER|TAC[OÓ]N/i.test(lbl||"");
  const esLavadoSecoLbl=lbl=>/SECO/i.test(lbl||"");
  const nombreDe=id=>empleadas.find(e=>String(e.id)===String(id))?.nombre||"—";
  const eventosDeFolio=(folio,etapa,grupo)=>(eventosProduccion||[]).filter(ev=>ev.ventaFolio===folio&&ev.etapa===etapa&&(grupo?(ev.grupo||null)===grupo:!ev.grupo)).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  const cargaDeFolio=(folio,tipo,grupo)=>(cargas||[]).filter(c=>(c.ventaFolio===folio||(c.ventaFolios||[]).includes(folio))&&c.tipo===tipo&&(grupo?c.grupo===grupo:!c.grupo)).sort((a,b)=>new Date(a.inicio)-new Date(b.inicio))[0];

  // 📋 Ordenes de ropa/edredones/otros servicios (excluye zapatos Y lavado en seco) dentro del rango, con revisión hecha
  const ordenesRopa=(ventas||[]).filter(v=>{
    if(v.anulada)return false;
    const f=fechaLocal(v.fecha);
    if(f<desde||f>hasta)return false;
    const itemsNoZapato=(v.items||[]).filter(it=>!esZapatoLbl(it.label));
    const tieneRopa=v.prodGrupos?v.prodGrupos.includes("ropa"):itemsNoZapato.length>0;
    const soloLavadoSeco=itemsNoZapato.length>0&&itemsNoZapato.every(it=>esLavadoSecoLbl(it.label));
    return tieneRopa&&!soloLavadoSeco&&v.clasificacion;
  });

  const analisis=ordenesRopa.map(v=>{
    const grupo=v.prodGrupos?"ropa":null;
    const libras=librasDeVenta(v,esZapatoLbl);
    const servicioPrincipal=(v.items||[]).find(it=>!esZapatoLbl(it.label)&&!esLavadoSecoLbl(it.label))?.label||(v.items||[])[0]?.label||"—";
    const clasifTs=v.clasificacion.timestamp;
    const cLav=cargaDeFolio(v.folio,"lavado",grupo);
    const cCen=cargaDeFolio(v.folio,"centrifugado",grupo);
    const cSec=cargaDeFolio(v.folio,"secado",grupo);
    const evDobIni=eventosDeFolio(v.folio,"doblado_inicio",grupo)[0];
    const evDobFin=eventosDeFolio(v.folio,"doblado_fin",grupo)[0];

    const etapas=[];
    if(cLav){
      const esperaLav=minutosLaboralesEntre(clasifTs,cLav.inicio);
      etapas.push({nombre:"Espera para lavar",min:esperaLav,tipoEspera:esperaLav>5?(habiaMaquinaLibreEn(clasifTs,"lavadora",cargas,maquinas)?"demora":"maquina"):"ok"});
      etapas.push({nombre:"Lavado",min:cLav.finReal?minutosLaboralesEntre(cLav.inicio,cLav.finReal):null,tipoEspera:"proceso",empleadaId:cLav.empleadaId});
    }
    const finLav=cLav?.finReal;
    const inicioSiguiente=cCen?.inicio||cSec?.inicio;
    if(finLav&&inicioSiguiente){
      const esperaSig=minutosLaboralesEntre(finLav,inicioSiguiente);
      const tipoMaq=cCen?"lavadora":"secadora";
      etapas.push({nombre:cCen?"Espera para centrifugar":"Espera para secar",min:esperaSig,tipoEspera:esperaSig>5?(habiaMaquinaLibreEn(finLav,tipoMaq,cargas,maquinas)?"demora":"maquina"):"ok"});
    }
    if(cCen)etapas.push({nombre:"Centrifugado",min:cCen.finReal?minutosLaboralesEntre(cCen.inicio,cCen.finReal):null,tipoEspera:"proceso",empleadaId:cCen.empleadaId});
    const finCen=cCen?.finReal;
    if(finCen&&cSec){
      const esperaSec=minutosLaboralesEntre(finCen,cSec.inicio);
      etapas.push({nombre:"Espera para secar",min:esperaSec,tipoEspera:esperaSec>5?(habiaMaquinaLibreEn(finCen,"secadora",cargas,maquinas)?"demora":"maquina"):"ok"});
    }
    if(cSec)etapas.push({nombre:"Secado",min:cSec.finReal?minutosLaboralesEntre(cSec.inicio,cSec.finReal):null,tipoEspera:"proceso",empleadaId:cSec.empleadaId});
    if(cSec?.finReal&&evDobIni){
      const esperaDob=minutosLaboralesEntre(cSec.finReal,evDobIni.timestamp);
      etapas.push({nombre:"Espera para doblar",min:esperaDob,tipoEspera:esperaDob>5?"demora":"ok"}); // doblar no usa máquina, así que si tarda, es operativo
    }
    if(evDobIni&&evDobFin)etapas.push({nombre:"Doblado",min:minutosLaboralesEntre(evDobIni.timestamp,evDobFin.timestamp),tipoEspera:"proceso",empleadaId:evDobFin.empleadaId});

    const tiempoTotalMin=evDobFin?minutosLaboralesEntre(v.fecha,evDobFin.timestamp):null;
    return{folio:v.folio,cliente:v.clienteNombre,libras,servicioPrincipal,atendidaPor:v.clasificacion.empleadaId,tiempoTotalMin,etapas,completa:!!evDobFin};
  });

  // 📊 Agrupar por rango de libras
  const RANGOS=[[0,15,"0-15 lb"],[16,25,"16-25 lb"],[26,40,"26-40 lb"],[41,999,"41+ lb"]];
  const porRango=RANGOS.map(([min,max,label])=>{
    const deEsteRango=analisis.filter(a=>a.completa&&a.libras>=min&&a.libras<=max);
    const promedio=deEsteRango.length>0?deEsteRango.reduce((a,x)=>a+x.tiempoTotalMin,0)/deEsteRango.length:null;
    return{label,cantidad:deEsteRango.length,promedioMin:promedio};
  });

  // 📊 Agrupar por SERVICIO (ej. "COLCHA GRANDE", "3 PARES (PACK AHORRO)") — cuánto tarda cada uno en promedio
  const porServicio={};
  analisis.filter(a=>a.completa).forEach(a=>{
    if(!porServicio[a.servicioPrincipal])porServicio[a.servicioPrincipal]={total:0,cantidad:0};
    porServicio[a.servicioPrincipal].total+=a.tiempoTotalMin;
    porServicio[a.servicioPrincipal].cantidad+=1;
  });
  const listaPorServicio=Object.entries(porServicio).map(([nombre,d])=>({nombre,cantidad:d.cantidad,promedioMin:d.total/d.cantidad})).sort((a,b)=>b.cantidad-a.cantidad);

  // 📊 Totales de minutos perdidos por espera de máquina vs demora operativa (solo órdenes completas)
  let minPorMaquina=0,minPorDemora=0;
  analisis.forEach(a=>a.etapas.forEach(e=>{if(e.tipoEspera==="maquina")minPorMaquina+=e.min;else if(e.tipoEspera==="demora")minPorDemora+=e.min;}));

  const exportarCSV=()=>{
    if(analisis.length===0){alert("No hay órdenes en ese rango.");return;}
    const enc=["Folio","Cliente","Servicio","Libras","Atendida por","Tiempo total (min)","Minutos por espera de máquina","Minutos por demora operativa"];
    const filas=analisis.map(a=>{
      const porMaq=a.etapas.filter(e=>e.tipoEspera==="maquina").reduce((s,e)=>s+e.min,0);
      const porDem=a.etapas.filter(e=>e.tipoEspera==="demora").reduce((s,e)=>s+e.min,0);
      return[a.folio,a.cliente,a.servicioPrincipal,a.libras||"—",nombreDe(a.atendidaPor),a.tiempoTotalMin!=null?a.tiempoTotalMin.toFixed(0):"En proceso",porMaq.toFixed(0),porDem.toFixed(0)];
    });
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="tiempos_por_servicio-"+desde+"_a_"+hasta+".csv";a.click();
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>⏱️ Tiempos por Servicio (Ropa, edredones y otros)</h2>
    <div style={{...S.alrt,background:"#e8f5fd",color:"#1565c0",fontSize:12,marginBottom:14}}>☁️ Incluye ropa, edredones y demás servicios — excluye zapatos (pestaña aparte) y lavado en seco (proceso distinto, subcontratado). Los tiempos <strong>ya descuentan las horas fuera de atención (después de las 8pm hasta que abre al día siguiente)</strong>, así una orden que queda de un día para otro no sale con tiempos inflados. Cada espera se etiqueta como <strong>⏳ Máquina ocupada</strong> (había fila, es normal) o <strong>🐢 Demora operativa</strong> (había máquina libre pero nadie actuó a tiempo).</div>
    <Card title="🔍 Filtros">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
      </div>
      <button style={{...S.btnP,width:"100%",marginTop:10}} onClick={exportarCSV}>📥 Descargar CSV ({analisis.length})</button>
    </Card>

    <Card title="🧾 Promedio de tiempo total por servicio">
      {listaPorServicio.length===0&&<div style={S.empty}>Sin órdenes completas en ese rango todavía.</div>}
      {listaPorServicio.map(s=>(
        <div key={s.nombre} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
          <span style={{fontSize:13,fontWeight:600,color:"#1a3c5e",flex:1,marginRight:8}}>{s.nombre}</span>
          <span style={{fontSize:13,color:"#888",whiteSpace:"nowrap"}}>{s.cantidad} orden{s.cantidad!==1?"es":""} · promedio {(s.promedioMin/60).toFixed(1)}h</span>
        </div>
      ))}
    </Card>
    <Card title="📊 Promedio de tiempo total por rango de libras">
      {porRango.map(r=>(
        <div key={r.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
          <span style={{fontSize:13,fontWeight:600,color:"#1a3c5e"}}>{r.label}</span>
          <span style={{fontSize:13,color:"#888"}}>{r.cantidad} orden{r.cantidad!==1?"es":""}{r.promedioMin!=null?` · promedio ${(r.promedioMin/60).toFixed(1)}h`:""}</span>
        </div>
      ))}
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <div style={{...S.kpi,borderLeft:"4px solid #1565c0"}}><div style={{fontSize:20}}>⏳</div><div><div style={{fontWeight:800,fontSize:16,color:"#1565c0"}}>{(minPorMaquina/60).toFixed(1)}h</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Espera por máquina ocupada</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #c62828"}}><div style={{fontSize:20}}>🐢</div><div><div style={{fontWeight:800,fontSize:16,color:"#c62828"}}>{(minPorDemora/60).toFixed(1)}h</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Demora operativa</div></div></div>
    </div>

    <Card title={`📋 Detalle por orden (${analisis.length})`}>
      {analisis.length===0&&<div style={S.empty}>No hay órdenes de ropa con revisión hecha en ese rango.</div>}
      {analisis.map(a=>(
        <div key={a.folio} style={S.vcard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>{a.cliente} <span style={{color:"#aaa",fontWeight:400,fontSize:11}}>({a.folio})</span></div>
              <div style={{fontSize:11,color:"#888"}}>{a.servicioPrincipal}{a.libras?` · ${a.libras} lb`:""} · Atendida por {nombreDe(a.atendidaPor)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,color:"#1a3c5e"}}>{a.tiempoTotalMin!=null?(a.tiempoTotalMin/60).toFixed(1)+"h":"En proceso"}</div>
              <button style={{...S.btnS,marginTop:4}} onClick={()=>setVerDetalleFolio(verDetalleFolio===a.folio?null:a.folio)}>{verDetalleFolio===a.folio?"Ocultar":"Ver etapas"}</button>
            </div>
          </div>
          {verDetalleFolio===a.folio&&(
            <div style={{marginTop:10,background:"#f8fbfd",borderRadius:8,padding:"8px 10px"}}>
              {a.etapas.map((e,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:i<a.etapas.length-1?"1px solid #f0f4f8":"none"}}>
                  <span style={{color:e.tipoEspera==="maquina"?"#1565c0":e.tipoEspera==="demora"?"#c62828":"#1a3c5e"}}>
                    {e.tipoEspera==="maquina"?"⏳ ":e.tipoEspera==="demora"?"🐢 ":""}{e.nombre}{e.empleadaId?` (${nombreDe(e.empleadaId)})`:""}
                  </span>
                  <strong>{e.min!=null?e.min.toFixed(0)+" min":"—"}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  </div>);
}

function KardexView({productos,kardexProductos,inventario,kardexInsumos}){
  const [tipo,setTipo]=useState("productos"); // "productos" | "insumos"
  const hoy=fechaHoyLocal();
  const [desde,setDesde]=useState((()=>{const d=new Date();d.setDate(d.getDate()-30);return fechaLocal(d.toISOString());})());
  const [hasta,setHasta]=useState(hoy);
  const [buscar,setBuscar]=useState("");

  const items=tipo==="productos"?(productos||[]):(inventario||[]);
  const kardex=tipo==="productos"?(kardexProductos||[]):(kardexInsumos||[]);
  const nombreDe=id=>items.find(i=>String(i.id)===String(id))?.nombre||"—";

  const filtrado=kardex.filter(k=>{
    const f=fechaLocal(k.fecha);
    if(desde&&f<desde)return false;
    if(hasta&&f>hasta)return false;
    if(buscar.trim()){
      const q=buscar.trim().toLowerCase();
      const nombre=(k.itemNombre||nombreDe(k.itemId)||"").toLowerCase();
      if(!nombre.includes(q))return false;
    }
    return true;
  }).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  const totalEntradas=filtrado.filter(k=>k.cantidad>0).reduce((a,k)=>a+k.cantidad,0);
  const totalSalidas=filtrado.filter(k=>k.cantidad<0).reduce((a,k)=>a+Math.abs(k.cantidad),0);

  const exportar=()=>{
    if(filtrado.length===0){alert("No hay movimientos para descargar con estos filtros.");return;}
    const enc=["Fecha Ingreso","Artículo","Movimiento","Causa/Referencia","Entero (cantidad)","Precio unitario","Proveedor","Saldo resultante","Registrado por"];
    const filas=filtrado.map(k=>{
      const t=TIPO_KARDEX_LBL[k.tipo]||{label:k.tipo};
      return[fmt(k.fecha),k.itemNombre||nombreDe(k.itemId),t.label,[k.folio,k.motivo].filter(Boolean).join(" · "),k.cantidad,k.precioUnitario!=null?"$"+k.precioUnitario.toFixed(2):"",k.proveedor||"",k.saldoResultante,k.registradoPor||""];
    });
    filas.push(["","","","","Total entradas:",totalEntradas,"","",""]);
    filas.push(["","","","","Total salidas:",-totalSalidas,"","",""]);
    const csv=[enc,...filas].map(f=>f.map(c=>'"'+String(c).replace(/"/g,'\\"')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="kardex_"+tipo+"-"+desde+"_a_"+hasta+".csv";a.click();
  };

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📒 Kardex</h2>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {[["productos","🛍️ Productos"],["insumos","📦 Insumos"]].map(([val,l])=>(
        <button key={val} onClick={()=>setTipo(val)} style={{flex:1,padding:"9px 6px",borderRadius:10,border:tipo===val?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:tipo===val?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
      ))}
    </div>
    <Card title="🔍 Filtros">
      <div style={{marginBottom:8}}>
        <label style={S.lbl}>Búsqueda de artículo</label>
        <input style={S.inp} placeholder="Nombre del producto o insumo..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
        <div style={{fontSize:10,color:"#888",marginTop:4}}>💡 Escribe el nombre de un insumo y amplía el rango de fechas para ver cómo ha subido o bajado su precio, y qué proveedor te lo vendió cada vez.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={S.lbl}>Fecha inicio</label><input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Fecha fin</label><input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></div>
      </div>
      <button style={{...S.btnP,width:"100%",marginTop:10}} onClick={exportar}>📥 Exportar ({filtrado.length})</button>
    </Card>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      <div style={{...S.kpi,borderLeft:"4px solid #2e7d32"}}><div style={{fontSize:20}}>⬆️</div><div><div style={{fontWeight:800,fontSize:16,color:"#2e7d32"}}>+{totalEntradas}</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Entradas</div></div></div>
      <div style={{...S.kpi,borderLeft:"4px solid #c62828"}}><div style={{fontSize:20}}>⬇️</div><div><div style={{fontWeight:800,fontSize:16,color:"#c62828"}}>-{totalSalidas}</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Salidas</div></div></div>
    </div>

    <Card title={`📋 Movimientos (${filtrado.length})`}>
      {filtrado.length===0&&<div style={S.empty}>Sin movimientos en este rango.</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:560}}>
          <thead>
            <tr style={{background:"#f0f4f8",textAlign:"left"}}>
              <th style={{padding:"6px 8px",whiteSpace:"nowrap"}}>Fecha Ingreso</th>
              <th style={{padding:"6px 8px"}}>Artículo</th>
              <th style={{padding:"6px 8px"}}>Movimiento</th>
              <th style={{padding:"6px 8px"}}>Causa</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Entero</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>P. unitario</th>
              <th style={{padding:"6px 8px"}}>Proveedor</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filtrado.map(k=>{
              const t=TIPO_KARDEX_LBL[k.tipo]||{label:k.tipo,icon:"•",color:"#888"};
              return(
                <tr key={k.id} style={{borderBottom:"1px solid #f0f4f8"}}>
                  <td style={{padding:"6px 8px",color:"#888",whiteSpace:"nowrap"}}>{fmt(k.fecha)}</td>
                  <td style={{padding:"6px 8px",fontWeight:600,color:"#1a3c5e"}}>{k.itemNombre||nombreDe(k.itemId)}</td>
                  <td style={{padding:"6px 8px",color:t.color,fontWeight:600,whiteSpace:"nowrap"}}>{t.icon} {t.label}</td>
                  <td style={{padding:"6px 8px",color:"#888"}}>{[k.folio,k.motivo].filter(Boolean).join(" · ")||"—"}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",fontWeight:800,color:k.cantidad>=0?"#2e7d32":"#c62828"}}>{k.cantidad>=0?"+":""}{k.cantidad}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:"#1a3c5e",fontWeight:600}}>{k.precioUnitario!=null?"$"+k.precioUnitario.toFixed(2):"—"}</td>
                  <td style={{padding:"6px 8px",color:"#888"}}>{k.proveedor||"—"}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",color:"#1a3c5e"}}>{k.saldoResultante}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  </div>);
}

// 📊 ANÁLISIS DE CLIENTES — segmenta por frecuencia de regreso y muestra cuántos clientes nuevos llegan por día/semana/mes
function AnalisisClientes({clientes,ventas}){
  const VENTANA_HABITUAL=21; // días — "hasta 3 semanas" para considerarse habitual
  const [periodo,setPeriodo]=useState("semana"); // "dia" | "semana" | "mes" — granularidad del gráfico de nuevos clientes

  // 📋 Para cada cliente: fecha de su primera y última compra (según el historial real de ventas, no la ficha)
  const clientesConDatos=(clientes||[]).map(c=>{
    const ventasCliente=(ventas||[]).filter(v=>!v.anulada&&String(v.clienteId)===String(c.id)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
    const primera=ventasCliente[0]?.fecha||null;
    const ultima=ventasCliente[ventasCliente.length-1]?.fecha||null;
    const diasDesdeUltima=ultima?Math.floor((new Date()-new Date(ultima))/86400000):null;
    return{...c,totalVentas:ventasCliente.length,primera,ultima,diasDesdeUltima};
  }).filter(c=>c.primera); // solo clientes que sí tienen al menos 1 compra registrada

  // 🟢 Habitual: ya volvió al menos una vez, y su última visita fue hace 21 días o menos
  const habituales=clientesConDatos.filter(c=>c.totalVentas>=2&&c.diasDesdeUltima<=VENTANA_HABITUAL);
  // 🆕 Nuevo: todavía solo tiene 1 compra, y fue reciente (dentro de la ventana) — aún no se sabe si va a repetir
  const nuevosSinRepetir=clientesConDatos.filter(c=>c.totalVentas===1&&c.diasDesdeUltima<=VENTANA_HABITUAL);
  // 🟡 Poco frecuente: pasaron más de 21 días desde su última compra — en riesgo de perderse
  const pocoFrecuentes=clientesConDatos.filter(c=>c.diasDesdeUltima>VENTANA_HABITUAL);

  // 🎯 TASA DE RETENCIÓN — de los clientes cuya "ventana de prueba" de 21 días YA pasó (o sea, ya tuvieron tiempo de volver),
  // ¿cuántos volvieron (retenidos) vs cuántos no volvieron nunca (perdidos)? Esto SÍ mide qué tan bien retienes clientes.
  const clientesConVentanaCumplida=clientesConDatos.filter(c=>Math.floor((new Date()-new Date(c.primera))/86400000)>VENTANA_HABITUAL);
  const retenidos=clientesConVentanaCumplida.filter(c=>c.totalVentas>=2);
  const perdidos=clientesConVentanaCumplida.filter(c=>c.totalVentas===1);
  const tasaRetencion=clientesConVentanaCumplida.length>0?(retenidos.length/clientesConVentanaCumplida.length)*100:null;

  // 📊 COMPARATIVA MENSUAL — últimos 6 meses: ventas totales, clientes nuevos, clientes atendidos, ticket promedio
  const mesesComparativa=[];
  for(let i=5;i>=0;i--){
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
    const clave=mesK(d);
    const ventasMes=(ventas||[]).filter(v=>!v.anulada&&mesK(new Date(v.fecha))===clave);
    const clientesUnicos=new Set(ventasMes.map(v=>v.clienteId)).size;
    const nuevosDelMes=clientesConDatos.filter(c=>mesK(new Date(c.primera))===clave).length;
    const totalVentasMes=ventasMes.reduce((a,v)=>a+v.total,0);
    mesesComparativa.push({
      clave,
      label:d.toLocaleDateString("es-EC",{month:"short",year:"2-digit"}),
      totalVentas:totalVentasMes,
      nClientesAtendidos:clientesUnicos,
      nNuevos:nuevosDelMes,
      ticketProm:clientesUnicos>0?totalVentasMes/ventasMes.length:0,
      nVentas:ventasMes.length,
    });
  }
  const mesActualComp=mesesComparativa[mesesComparativa.length-1];
  const mesAnteriorComp=mesesComparativa[mesesComparativa.length-2];
  const variacionVentas=mesAnteriorComp&&mesAnteriorComp.totalVentas>0?((mesActualComp.totalVentas-mesAnteriorComp.totalVentas)/mesAnteriorComp.totalVentas)*100:null;
  const variacionNuevos=mesAnteriorComp&&mesAnteriorComp.nNuevos>0?((mesActualComp.nNuevos-mesAnteriorComp.nNuevos)/mesAnteriorComp.nNuevos)*100:null;

  // 🤖 "Análisis inteligente" — texto interpretativo generado con reglas de negocio (sin costo de IA externa)
  const insights=[];
  if(tasaRetencion!==null){
    if(tasaRetencion>=50)insights.push({tipo:"bien",texto:`Tu tasa de retención es del ${tasaRetencion.toFixed(0)}% — más de la mitad de tus clientes nuevos vuelven a comprar dentro de 21 días. Eso es saludable para un negocio de lavandería.`});
    else if(tasaRetencion>=30)insights.push({tipo:"regular",texto:`Tu tasa de retención es del ${tasaRetencion.toFixed(0)}% — hay margen de mejora. Considera contactar a los clientes "poco frecuentes" por WhatsApp para invitarlos a volver.`});
    else insights.push({tipo:"mal",texto:`Tu tasa de retención es del ${tasaRetencion.toFixed(0)}%, bastante baja — la mayoría de clientes nuevos no está regresando dentro de 3 semanas. Vale la pena revisar la calidad del servicio o crear una promo de "segunda visita".`});
  }else{
    insights.push({tipo:"info",texto:"Todavía no hay suficiente historial (clientes con más de 21 días desde su primera compra) para calcular una tasa de retención confiable."});
  }
  if(variacionVentas!==null){
    if(variacionVentas>5)insights.push({tipo:"bien",texto:`Las ventas de ${mesActualComp.label} subieron ${variacionVentas.toFixed(0)}% comparado con ${mesAnteriorComp.label}. 📈`});
    else if(variacionVentas<-5)insights.push({tipo:"mal",texto:`Las ventas de ${mesActualComp.label} bajaron ${Math.abs(variacionVentas).toFixed(0)}% comparado con ${mesAnteriorComp.label}. 📉`});
    else insights.push({tipo:"regular",texto:`Las ventas de ${mesActualComp.label} están estables comparadas con ${mesAnteriorComp.label} (${variacionVentas>=0?"+":""}${variacionVentas.toFixed(0)}%).`});
  }
  if(variacionNuevos!==null&&Math.abs(variacionNuevos)>10){
    insights.push({tipo:variacionNuevos>0?"bien":"regular",texto:`La llegada de clientes nuevos ${variacionNuevos>0?"aumentó":"bajó"} ${Math.abs(variacionNuevos).toFixed(0)}% este mes comparado con el anterior.`});
  }
  if(pocoFrecuentes.length>habituales.length&&habituales.length+pocoFrecuentes.length>3){
    insights.push({tipo:"regular",texto:`Tienes ${pocoFrecuentes.length} clientes "poco frecuentes" contra ${habituales.length} habituales — son más los que se están alejando que los que vuelven seguido. Podría valer la pena una campaña de reactivación.`});
  }

  // 📈 Nuevos clientes por período (agrupando por la fecha de su PRIMERA compra)
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const claveBucket=fecha=>{
    const d=new Date(fecha);
    if(periodo==="dia")return fechaLocal(fecha);
    if(periodo==="mes")return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
    // semana: lunes de esa semana como clave
    const dia=d.getDay()||7;const lunes=new Date(d);lunes.setDate(d.getDate()-dia+1);
    return fechaLocal(lunes.toISOString());
  };
  const nBuckets=periodo==="dia"?14:periodo==="semana"?12:6;
  const buckets=[];
  for(let i=nBuckets-1;i>=0;i--){
    const d=new Date(hoy);
    if(periodo==="dia")d.setDate(d.getDate()-i);
    else if(periodo==="semana")d.setDate(d.getDate()-i*7);
    else d.setMonth(d.getMonth()-i);
    buckets.push({clave:claveBucket(d.toISOString()),fechaRef:new Date(d)});
  }
  const conteoPorBucket=buckets.map(b=>({
    ...b,
    cantidad:clientesConDatos.filter(c=>claveBucket(c.primera)===b.clave).length,
  }));
  const maxConteo=Math.max(1,...conteoPorBucket.map(b=>b.cantidad));
  const lblBucket=b=>{
    if(periodo==="dia")return b.fechaRef.toLocaleDateString("es-EC",{day:"2-digit",month:"2-digit"});
    if(periodo==="mes")return b.fechaRef.toLocaleDateString("es-EC",{month:"short",year:"2-digit"});
    return b.fechaRef.toLocaleDateString("es-EC",{day:"2-digit",month:"2-digit"});
  };
  const [verSegmento,setVerSegmento]=useState(null); // "habituales" | "nuevos" | "poco" | null
  const [fechaVerDesde,setFechaVerDesde]=useState(fechaHoyLocal());
  const [fechaVerHasta,setFechaVerHasta]=useState(fechaHoyLocal());
  // 📅 Para el rango elegido: qué clientes vinieron, y qué tipo eran EN ESE MOMENTO (según su historial hasta esa fecha)
  const clientesEnRango=(()=>{
    const ventasRango=(ventas||[]).filter(v=>!v.anulada&&fechaLocal(v.fecha)>=fechaVerDesde&&fechaLocal(v.fecha)<=fechaVerHasta);
    const idsUnicos=[...new Set(ventasRango.map(v=>v.clienteId))];
    return idsUnicos.map(cid=>{
      const cliente=(clientes||[]).find(c=>String(c.id)===String(cid));
      if(!cliente)return null;
      const todasOrdenadas=(ventas||[]).filter(v=>!v.anulada&&String(v.clienteId)===String(cid)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
      const idxPrimeraEnRango=todasOrdenadas.findIndex(v=>fechaLocal(v.fecha)>=fechaVerDesde&&fechaLocal(v.fecha)<=fechaVerHasta);
      const anteriores=todasOrdenadas.slice(0,idxPrimeraEnRango);
      let tipo;
      if(anteriores.length===0)tipo="nuevo";
      else{
        const gap=Math.floor((new Date(todasOrdenadas[idxPrimeraEnRango].fecha)-new Date(anteriores[anteriores.length-1].fecha))/86400000);
        tipo=gap<=VENTANA_HABITUAL?"habitual":"poco";
      }
      return{cliente,tipo,cantidadVentasEnRango:ventasRango.filter(v=>String(v.clienteId)===String(cid)).length};
    }).filter(Boolean);
  })();

  return(<div style={S.panel}>
    <h2 style={S.ptitle}>📊 Análisis de Clientes</h2>

    <Card title="🤖 Análisis inteligente">
      {insights.map((ins,i)=>(
        <div key={i} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:i<insights.length-1?"1px solid #f0f4f8":"none"}}>
          <span style={{fontSize:16}}>{ins.tipo==="bien"?"✅":ins.tipo==="mal"?"⚠️":ins.tipo==="regular"?"🟡":"ℹ️"}</span>
          <span style={{fontSize:13,color:"#1a3c5e",lineHeight:1.4}}>{ins.texto}</span>
        </div>
      ))}
    </Card>

    {tasaRetencion!==null&&(
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <div style={{...S.kpi,borderLeft:`4px solid ${tasaRetencion>=50?"#2e7d32":tasaRetencion>=30?"#f59e0b":"#c62828"}`}}><div style={{fontSize:20}}>🎯</div><div><div style={{fontWeight:800,fontSize:18,color:tasaRetencion>=50?"#2e7d32":tasaRetencion>=30?"#e65100":"#c62828"}}>{tasaRetencion.toFixed(0)}%</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Tasa de retención</div></div></div>
        <div style={{...S.kpi,borderLeft:"4px solid #1a3c5e"}}><div style={{fontSize:20}}>👥</div><div><div style={{fontWeight:800,fontSize:18,color:"#1a3c5e"}}>{retenidos.length}/{clientesConVentanaCumplida.length}</div><div style={{fontSize:11,fontWeight:600,color:"#1a3c5e"}}>Volvieron a comprar</div></div></div>
      </div>
    )}

    <Card title="📊 Comparativa de los últimos 6 meses">
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:480}}>
          <thead>
            <tr style={{background:"#f0f4f8",textAlign:"left"}}>
              <th style={{padding:"6px 8px"}}>Mes</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Ventas $</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}># Ventas</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Clientes nuevos</th>
              <th style={{padding:"6px 8px",textAlign:"right"}}>Ticket prom.</th>
            </tr>
          </thead>
          <tbody>
            {mesesComparativa.map((m,i)=>(
              <tr key={m.clave} style={{borderBottom:"1px solid #f0f4f8",background:i===mesesComparativa.length-1?"#eaf3fb":"transparent"}}>
                <td style={{padding:"6px 8px",fontWeight:i===mesesComparativa.length-1?800:400,color:"#1a3c5e"}}>{m.label}{i===mesesComparativa.length-1?" (actual)":""}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:"#2e7d32"}}>${m.totalVentas.toFixed(2)}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:"#888"}}>{m.nVentas}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:"#7b1fa2",fontWeight:600}}>{m.nNuevos}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:"#888"}}>${m.ticketProm.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {variacionVentas!==null&&<div style={{fontSize:11,color:"#888",marginTop:10,textAlign:"center"}}>Variación vs mes anterior: <strong style={{color:variacionVentas>=0?"#2e7d32":"#c62828"}}>{variacionVentas>=0?"+":""}{variacionVentas.toFixed(1)}%</strong></div>}
    </Card>

    <div style={{fontSize:13,fontWeight:700,color:"#1a3c5e",marginBottom:8}}>📈 Clientes nuevos por período</div>
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      {[["dia","Por día"],["semana","Por semana"],["mes","Por mes"]].map(([val,l])=>(
        <button key={val} onClick={()=>setPeriodo(val)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:periodo===val?"2px solid #1a3c5e":"1.5px solid #e0e8f0",background:periodo===val?"#eaf3fb":"#fff",color:"#1a3c5e",fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
      ))}
    </div>
    <Card title={`Nuevos clientes — últimos ${nBuckets} ${periodo==="dia"?"días":periodo==="semana"?"semanas":"meses"}`}>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:140,padding:"0 4px"}}>
        {conteoPorBucket.map((b,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
            <div style={{fontSize:10,fontWeight:800,color:"#1a3c5e",marginBottom:2}}>{b.cantidad>0?b.cantidad:""}</div>
            <div style={{width:"100%",background:b.cantidad>0?"linear-gradient(180deg,#4db6e4,#1a3c5e)":"#f0f4f8",borderRadius:"4px 4px 0 0",height:`${Math.max(3,(b.cantidad/maxConteo)*100)}%`}}/>
            <div style={{fontSize:8,color:"#888",marginTop:4,whiteSpace:"nowrap",transform:"rotate(0deg)"}}>{lblBucket(b)}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#888",marginTop:10,textAlign:"center"}}>Total en el período: <strong style={{color:"#1a3c5e"}}>{conteoPorBucket.reduce((a,b)=>a+b.cantidad,0)}</strong> clientes nuevos</div>
    </Card>

    <div style={{fontSize:13,fontWeight:700,color:"#1a3c5e",margin:"16px 0 8px"}}>📅 Quiénes vinieron en una fecha específica</div>
    <Card title="Elige el rango a revisar">
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        <button style={{...S.btnS,flex:1}} onClick={()=>{setFechaVerDesde(fechaHoyLocal());setFechaVerHasta(fechaHoyLocal());}}>Hoy</button>
        <button style={{...S.btnS,flex:1}} onClick={()=>{const d=new Date();const dia=d.getDay()||7;const lunes=new Date(d);lunes.setDate(d.getDate()-dia+1);setFechaVerDesde(fechaLocal(lunes.toISOString()));setFechaVerHasta(fechaHoyLocal());}}>Esta semana</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><label style={S.lbl}>Desde</label><input type="date" style={S.inp} value={fechaVerDesde} onChange={e=>setFechaVerDesde(e.target.value)}/></div>
        <div><label style={S.lbl}>Hasta</label><input type="date" style={S.inp} value={fechaVerHasta} onChange={e=>setFechaVerHasta(e.target.value)}/></div>
      </div>
    </Card>
    <Card title={`👥 Clientes que vinieron (${clientesEnRango.length})`}>
      {clientesEnRango.length===0&&<div style={S.empty}>Nadie vino en ese rango de fechas.</div>}
      {["nuevo","habitual","poco"].map(tipo=>{
        const deEsteTipo=clientesEnRango.filter(c=>c.tipo===tipo);
        if(deEsteTipo.length===0)return null;
        const info=SEMAFORO_CLIENTE_INFO[tipo];
        return(
          <div key={tipo} style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:800,color:info.color,marginBottom:4}}>{info.icon} {info.label} ({deEsteTipo.length})</div>
            {deEsteTipo.map(c=>(
              <div key={c.cliente.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f0f4f8"}}>
                <span style={{fontSize:13,color:"#1a3c5e"}}>{c.cliente.nombre}</span>
                <span style={{fontSize:11,color:"#888"}}>{c.cantidadVentasEnRango} compra{c.cantidadVentasEnRango!==1?"s":""} en el rango</span>
              </div>
            ))}
          </div>
        );
      })}
    </Card>

    <div style={{fontSize:13,fontWeight:700,color:"#1a3c5e",margin:"16px 0 8px"}}>👥 Segmentación por frecuencia (ventana de {VENTANA_HABITUAL} días)</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
      {[
        ["nuevos","🆕",nuevosSinRepetir.length,"Nuevos",'"#7b1fa2"'],
        ["habituales","🟢",habituales.length,"Habituales",'"#2e7d32"'],
        ["poco","🟡",pocoFrecuentes.length,"Poco frecuentes",'"#e65100"'],
      ].map(([key,icon,val,lbl,color])=>(
        <button key={key} onClick={()=>setVerSegmento(verSegmento===key?null:key)} style={{background:verSegmento===key?"#eaf3fb":"#fff",border:`1.5px solid ${key==="nuevos"?"#7b1fa2":key==="habituales"?"#2e7d32":"#e65100"}`,borderRadius:10,padding:"10px 4px",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:18}}>{icon}</div>
          <div style={{fontWeight:800,fontSize:18,color:key==="nuevos"?"#7b1fa2":key==="habituales"?"#2e7d32":"#e65100"}}>{val}</div>
          <div style={{fontSize:9,color:"#5d4037"}}>{lbl}</div>
        </button>
      ))}
    </div>

    {verSegmento&&(
      <Card title={
        verSegmento==="nuevos"?`🆕 Nuevos sin repetir todavía (${nuevosSinRepetir.length})`:
        verSegmento==="habituales"?`🟢 Habituales — vuelven dentro de ${VENTANA_HABITUAL} días (${habituales.length})`:
        `🟡 Poco frecuentes — más de ${VENTANA_HABITUAL} días sin venir (${pocoFrecuentes.length})`
      }>
        {(verSegmento==="nuevos"?nuevosSinRepetir:verSegmento==="habituales"?habituales:pocoFrecuentes).length===0&&<div style={S.empty}>Nadie en este grupo por ahora.</div>}
        {(verSegmento==="nuevos"?nuevosSinRepetir:verSegmento==="habituales"?habituales:pocoFrecuentes)
          .sort((a,b)=>a.diasDesdeUltima-b.diasDesdeUltima)
          .map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f0f4f8"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#1a3c5e"}}>{c.nombre}</div>
                <div style={{fontSize:11,color:"#888"}}>{c.totalVentas} compra{c.totalVentas!==1?"s":""} · última hace {c.diasDesdeUltima} día{c.diasDesdeUltima!==1?"s":""}</div>
              </div>
              {c.tel&&<a href={`https://wa.me/${telWa(c.tel)}`} target="_blank" rel="noreferrer" style={{...S.btnS,alignSelf:"center",background:"#25D366",color:"#fff",fontSize:11}}>💬</a>}
            </div>
          ))}
      </Card>
    )}
  </div>);
}

function Configuracion({servicios,setServicios,exportarDatos,importarDatos,upsertVenta,upsertServicio}){
  const [nv,setNv]=useState({label:"",precio:""});const [editId,setEditId]=useState(null);const [ed,setEd]=useState({});const [busq,setBusq]=useState("");
  const activos=servicios.filter(s=>!s.eliminada);
  const add=()=>{if(!nv.label.trim()||!nv.precio)return;const ns={id:"c-"+Date.now(),label:nv.label.toUpperCase(),precio:parseFloat(nv.precio)};setServicios(prev=>[...prev,ns]);if(upsertServicio)upsertServicio({...ns,_updatedAt:new Date().toISOString()});setNv({label:"",precio:""});};
  const del=id=>{if(!window.confirm("¿Eliminar este servicio?"))return;setServicios(prev=>{const next=prev.map(s=>s.id===id?{...s,eliminada:true}:s);const borrado=next.find(s=>s.id===id);if(borrado&&upsertServicio)upsertServicio({...borrado,_updatedAt:new Date().toISOString()});return next;});};
  const sav=()=>{setServicios(prev=>{const next=prev.map(s=>s.id===editId?{...s,label:ed.label.toUpperCase(),precio:parseFloat(ed.precio),limite:ed.limite?parseInt(ed.limite):null}:s);const updated=next.find(s=>s.id===editId);if(updated&&upsertServicio)upsertServicio({...updated,_updatedAt:new Date().toISOString()});return next;});setEditId(null);};
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
          <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:6,alignItems:"center"}}>
            <input style={S.inp} value={ed.label||""} onChange={e=>setEd({...ed,label:e.target.value})}/>
            <input type="number" style={{...S.inp,width:80}} value={ed.precio||""} onChange={e=>setEd({...ed,precio:e.target.value})}/>
            <input type="number" min="1" style={{...S.inp,width:70}} placeholder="Máx." value={ed.limite||""} onChange={e=>setEd({...ed,limite:e.target.value})}/>
            <button style={{...S.btnS,background:"#e8f5e9",color:"#2e7d32"}} onClick={sav}>✓</button>
          </div>
        ):(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{s.label}</div><div style={{fontSize:12,color:"#4db6e4",fontWeight:700}}>${s.precio.toFixed(2)}{s.limite?<span style={{color:"#e65100",fontWeight:600}}> · máx {s.limite}/venta</span>:""}</div></div>
            <div style={{display:"flex",gap:6}}>
              <button style={S.btnS} onClick={()=>{setEditId(s.id);setEd({label:s.label,precio:s.precio,limite:s.limite||""});}}>✏️</button>
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
  const [aEmp,setAEmp]=useState(empleadas[0]?.id||null);const [fondo,setFondo]=useState("20.00");
  // empId ya no se usa — el cierre filtra por sesion.id automaticamente
  const [bills,setBills]=useState(()=>Object.fromEntries(BILLETES.map(b=>[b,""])));
  const [coins,setCoins]=useState(()=>Object.fromEntries(MONEDAS.map(m=>[m,""])));
  const [tPic,setTPic]=useState("");const [tJep,setTJep]=useState("");const [tTar,setTTar]=useState("");
  const [paso,setPaso]=useState(0); // paso 0 = revisión obligatoria de estados
  const [correccionUsada,setCorreccionUsada]=useState(false); // 🔒 solo se permite volver a corregir una vez
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
  const fd=ap?.fondo!=null?ap.fondo:20; // usa el fondo real de apertura
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
    const d={id:"ap_"+hoyA+"_"+(sesion?.id||"x")+"_"+Date.now(),tipo:"apertura",dia:hoyA,empleadaNombre:empleadas.find(e=>String(e.id)===String(aEmp))?.nombre||"",empleadaId:aEmp,fondo:parseFloat(fondo)||20,fecha:new Date().toISOString()};
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
        <button style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#2e7d32,#388e3c)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:8}} onClick={()=>{setCg(null);setPaso(0);setRevisado(false);setCorreccionUsada(false);setModo("cierre");if(onResetCierre)onResetCierre();}}>🔄 Realizar otro cierre</button>
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
        <div style={{fontSize:11,color:"#1565c0",marginTop:4}}>💡 Cuenta el efectivo físico en caja tal como está — el sistema te dirá al final si cuadra.</div>
      </div>}
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
        {[{n:0,l:"📋 Revisión"},{n:1,l:"💵 Billetes"},{n:2,l:"🪙 Monedas"},{n:3,l:"🏦 Digital"},{n:4,l:"✅ Confirmar"}].map(p=>{
          const puedeSaltar=paso>p.n&&(paso<4||!correccionUsada); // 🔒 una vez llegado a Confirmar, solo se puede regresar una vez
          return(
            <div key={p.n} style={{...S.badge,background:paso>=p.n?"#1a3c5e":"#e8f0f7",color:paso>=p.n?"#fff":"#888",padding:"6px 10px",fontSize:11,whiteSpace:"nowrap",cursor:puedeSaltar?"pointer":"default"}} onClick={()=>{if(puedeSaltar){if(paso===4)setCorreccionUsada(true);setPaso(p.n);}}}>{p.n}. {p.l}</div>
          );
        })}
      </div>
      {correccionUsada&&paso<4&&<div style={{...S.alrt,background:"#fff3e0",color:"#e65100",fontSize:12}}>⚠️ Ya usaste tu única corrección — ajusta bien esta vez, después no podrás volver a editar.</div>}
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
        <div style={{display:"flex",gap:8}}>
          {!correccionUsada
            ?<button style={{...S.btnC,flex:1}} onClick={()=>{setCorreccionUsada(true);setPaso(3);}}>← Corregir (única vez)</button>
            :<button style={{...S.btnC,flex:1,opacity:0.5,cursor:"not-allowed"}} onClick={()=>alert("Ya usaste tu única corrección — no se puede volver a editar. Si algo está mal, avísale a la administradora después de confirmar.")}>🔒 Ya no puedes corregir</button>
          }
          <button style={{...S.btnP,flex:2,background:"linear-gradient(135deg,#2e7d32,#388e3c)"}} onClick={confirmar}>✅ Confirmar e imprimir</button>
        </div>
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
            {sug.cli.tel&&<a href="#" style={{background:"#25d366",color:"#fff",borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:700,textDecoration:"none",flex:1,textAlign:"center"}} onClick={e=>{e.preventDefault();const c=generar();window.open(`https://api.whatsapp.com/send/?phone=${telWa(c.clienteTel)}&text=${encodeURIComponent(msgWaCupon(c))}`,"_blank");}}>💬 Enviar WhatsApp</a>}
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
const PROMO_VACIA={tipo:"custom",emoji:"🎁",titulo:"",detalle:"",precio:"",antes:"",monto:"",minCompra:"",claves:"",dias:[],filtro:"",pct:"50"};
function PromosAdmin({promos,setPromos,upsertPromo,servicios}){
  const [form,setForm]=useState(PROMO_VACIA);
  const [editId,setEditId]=useState(null);
  const lista=(promos&&promos.length?promos:DEFAULT_PROMOS);
  const guardar=()=>{
    if(!form.titulo.trim()){alert("Escribe el título de la promo");return;}
    if(form.tipo==="custom"&&!form.precio){alert("Escribe el precio de la promo");return;}
    if(form.tipo==="descuento"&&!form.monto){alert("Escribe el monto del descuento");return;}
    if(form.tipo==="segundo50"&&!form.filtro.trim()){alert("Escribe la palabra clave del servicio (ej. EDREDON)");return;}
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
      filtro:form.tipo==="segundo50"?form.filtro.trim():null,
      pct:form.tipo==="segundo50"?(parseFloat(form.pct)||50):null,
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
      claves:(p.claves||[]).join(", "),dias:p.dias||[],
      filtro:p.filtro||"",pct:p.pct!=null?String(p.pct):"50"
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
        <button style={{...S.pill,flex:1,...(form.tipo==="segundo50"?S.pillA:{})}} onClick={()=>setForm({...form,tipo:"segundo50"})}>🔁 2da unidad a %</button>
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
      ):form.tipo==="descuento"?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={S.lbl}>Monto del descuento</label><input type="number" style={S.inp} placeholder="1.00" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></div>
          <div><label style={S.lbl}>Compra mínima (opcional)</label><input type="number" style={S.inp} placeholder={`Por defecto $${CUPON_MIN_COMPRA_DESC.toFixed(2)}`} value={form.minCompra} onChange={e=>setForm({...form,minCompra:e.target.value})}/></div>
        </div>
      ):(
        <div style={{marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
            <div><label style={S.lbl}>Palabra clave del servicio</label><input style={S.inp} placeholder="ej. EDREDON" value={form.filtro} onChange={e=>setForm({...form,filtro:e.target.value})}/></div>
            <div><label style={S.lbl}>% de descuento (2da unidad)</label><input type="number" style={S.inp} placeholder="50" value={form.pct} onChange={e=>setForm({...form,pct:e.target.value})}/></div>
          </div>
          <div style={{fontSize:11,color:"#888"}}>Aplica al 2do servicio de cualquier precio cuyo nombre contenga esa palabra (ej. "EDREDON" agrupa las 3 opciones de edredón sin importar el tamaño). La empleada elige cuál es la 2da unidad al momento de la venta, y solo se habilita si ya agregó la primera unidad a la venta.</div>
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
                {p.tipo==="descuento"?`Descuento -$${(p.monto||0).toFixed(2)}${p.minCompra?` · mín. $${p.minCompra.toFixed(2)}`:""}`:p.tipo==="segundo50"?`2da unidad "${p.filtro}" a -${p.pct||50}%`:`$${(p.precio||0).toFixed(2)}${p.antes?` (antes $${p.antes.toFixed(2)})`:""}`}
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
        const url=c.clienteTel?`https://api.whatsapp.com/send/?phone=${telWa(c.clienteTel)}&text=${encodeURIComponent(msgWaCupon(c))}`:null;
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
function Clientes({clientes,setClientes,upsertCliente,ventas,setVentas,upsertVenta,esAdmin=true}){
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
      {esAdmin&&<div style={{...S.kpi,borderLeft:"4px solid #4caf50"}}><div style={{fontSize:22}}>💚</div><div><div style={{fontWeight:800,fontSize:18,color:"#2e7d32"}}>${totalCartera.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Ventas históricas</div>{totalPend>0&&<div style={{fontSize:11,color:"#e65100"}}>⏳ ${totalPend.toFixed(2)} por cobrar</div>}</div></div>}
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
        {[{id:"recientes",l:"🕐 Recientes"},...(esAdmin?[{id:"gastado",l:"💵 Más gastan"}]:[]),{id:"compras",l:"🧾 Más compran"},{id:"nombre",l:"🔤 A-Z"}].map(o=>(
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
                  <div style={{fontWeight:700,fontSize:15}}>{c.nombre} <SemaforoCliente clienteId={c.id} ventas={ventas}/></div>
                  <div style={{fontSize:12,color:"#888"}}>
                    {c.tel?`📱 ${c.tel}`:"📱 sin teléfono"}{c.cedula?` · 🪪 ${c.cedula}`:""}
                  </div>
                  {c.email&&<div style={{fontSize:11,color:"#888"}}>✉️ {c.email}</div>}
                  {c.nacimiento&&<div style={{fontSize:11,color:esCumpleHoy(c.nacimiento)?"#b45309":"#888",fontWeight:esCumpleHoy(c.nacimiento)?700:400}}>🎂 {c.nacimiento.slice(8,10)}/{c.nacimiento.slice(5,7)}{esCumpleHoy(c.nacimiento)?" · ¡HOY cumple años! 🎉":""}</div>}
                  {c.direccion&&<div style={{fontSize:11,color:"#888"}}>📍 {c.direccion}</div>}
                  <div style={{fontSize:11,color:"#4db6e4",marginTop:3}}>
                    {c.compras} compra{c.compras!==1?"s":""}{esAdmin?` · $${c.gastado.toFixed(2)}`:""}{c.ultima?` · última: ${fmtD(c.ultima)}`:""}
                  </div>
                  {c.pendiente>0&&<div style={{...S.badge,background:"#fff3e0",color:"#e65100",marginTop:4}}>⏳ Debe ${c.pendiente.toFixed(2)}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  <button style={S.btnS} onClick={()=>abrirEdicion(c)}>✏️ Editar</button>
                  <button style={S.btnS} onClick={()=>setHistId(histId===c.id?null:c.id)}>{histId===c.id?"▲ Ocultar":"📋 Historial"}</button>
                  {esAdmin&&<button style={S.btnR} onClick={()=>eliminar(c)}>🗑️</button>}
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
                  {esAdmin&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#1a3c5e",paddingTop:8}}>
                    <span>Total histórico</span><span>${c.gastado.toFixed(2)}</span>
                  </div>}
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
  // 🧺 Ingreso REAL del mes: el lavado en seco solo deja el 20% de ganancia (el resto se le paga a quien hace el servicio),
  // así que no se puede contar el precio completo como ingreso propio — se usa calcGanancia() por cada venta.
  const ingresoRealMes=vMes.reduce((a,v)=>a+calcGanancia(v.items||[]),0);
  const descuentoLavadoSeco=parseFloat((ventaMes-ingresoRealMes).toFixed(2));
  const utilidad=ingresoRealMes-gastosMes;
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
      <div style={{...S.kpi,borderLeft:`4px solid ${utilidad>=0?"#4caf50":"#e53935"}`}}><div style={{fontSize:22}}>{utilidad>=0?"📈":"📉"}</div><div><div style={{fontWeight:800,fontSize:18,color:utilidad>=0?"#2e7d32":"#c62828"}}>${utilidad.toFixed(2)}</div><div style={{fontSize:12,fontWeight:600,color:"#1a3c5e"}}>Utilidad estimada</div>{descuentoLavadoSeco>0.01&&<div style={{fontSize:10,color:"#e65100"}}>🧺 -${descuentoLavadoSeco.toFixed(2)} no es tuyo (lavado en seco, 80%)</div>}</div></div>
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
  // 🔒 Se leen de localStorage al montar: así, si la página se refresca, NO se pide abrir caja de nuevo
  // (solo se vuelve a pedir si de verdad se hizo un cierre de caja, o si es un turno/día nuevo).
  const [cajaOk,setCajaOk]=useState(()=>{try{return !!localStorage.getItem(AK);}catch{return false;}});
  const [cierreOk,setCierreOk]=useState(()=>{try{return !!localStorage.getItem(CK);}catch{return false;}});
  const [esperandoApertura,setEsperandoApertura]=useState(false);
  const VK="ll_vista_"+sesion.id+"_"+sesId; // 🔑 recuerda qué pantalla eligió (Facturación/Producción/Tareas) en esta sesión
  const [vista,setVistaRaw]=useState(()=>{try{return localStorage.getItem(VK)||null;}catch{return null;}}); // 🏭 null | "facturacion" | "produccion" | "tareas" — elegido en SelectorVista
  const setVista=v=>{try{if(v)localStorage.setItem(VK,v);else localStorage.removeItem(VK);}catch{}setVistaRaw(v);};
  const [tab,setTab]=useState("ventas");
  const { data: ventas, setData: setVentas, upsert: upsertVenta } = useCollection("ventas", KEYS.ventas, []);
const { data: clientes, setData: setClientes, upsert: upsertCliente } = useCollection("clientes", KEYS.clientes, []);
const { data: empleadas, setData: setEmpleadas, upsert: upsertEmpleada } = useCollection("empleadas", KEYS.empleadas, EMPLEADAS_DEFAULT);
const { data: inventario, setData: setInventario, upsert: upsertInventario } = useCollection("inventario", KEYS.inventario, INSUMOS_DEFAULT);
const { data: productos, setData: setProductos, upsert: upsertProducto } = useCollection("productos", "ll_productos", PRODUCTOS_DEFAULT);
// 📒 KARDEX de productos e insumos
const { data: kardexProductos, setData: setKardexProductos, upsert: upsertKardexProducto } = useCollection("kardexProductos", "ll_kardex_productos", KARDEX_PRODUCTOS_DEFAULT);
const { data: kardexInsumos, setData: setKardexInsumos, upsert: upsertKardexInsumo } = useCollection("kardexInsumos", "ll_kardex_insumos", KARDEX_INSUMOS_DEFAULT);
// 📦 ACTIVOS FIJOS y 💳 DEUDAS
const { data: activosFijos, setData: setActivosFijos, upsert: upsertActivoFijo } = useCollection("activosFijos", "ll_activos_fijos", []);
// 📋 Conteos físicos de inventario (Nohelia, 2 veces por semana)
const { data: conteosInventario, setData: setConteosInventario, upsert: upsertConteoInventario } = useCollection("conteosInventario", "ll_conteos_inventario", []);
// 📋 EVALUACIÓN DE DESEMPEÑO — quejas registradas y configuración de pesos/metas
const { data: quejas, setData: setQuejas, upsert: upsertQueja } = useCollection("quejas", "ll_quejas", []);
// 🎧 Calificaciones manuales de audios de atención (2 por semana, ~8 al mes)
const { data: calificacionesAudio, setData: setCalificacionesAudio, upsert: upsertCalificacionAudio } = useCollection("calificacionesAudio", "ll_calificaciones_audio", []);
const { data: evalConfigArr, setData: setEvalConfigArr, upsert: upsertEvalConfig } = useCollection("evalConfig", "ll_eval_config", EVAL_CONFIG_DEFAULT);
const evalConfig=evalConfigArr[0]||EVAL_CONFIG_DEFAULT[0];
const { data: deudas, setData: setDeudas, upsert: upsertDeuda } = useCollection("deudas", "ll_deudas", []);
// 🧴 Registro manual de ventas de perfume/aromatizador para incentivos (solo cuenta si se registra a mano)
const { data: ventasPerfumeReg, setData: setVentasPerfumeReg, upsert: upsertVentaPerfume } = useCollection("ventasPerfumeReg", "ll_ventas_perfume_reg", []);
// 🎟️ SORTEO POR BOLETOS
const { data: sorteos, setData: setSorteos, upsert: upsertSorteo } = useCollection("sorteos", "ll_sorteos", SORTEOS_DEFAULT);
const { data: boletosSorteo, setData: setBoletosSorteo, upsert: upsertBoletoSorteo } = useCollection("boletosSorteo", "ll_boletos_sorteo", BOLETOS_SORTEO_DEFAULT);
const [boletosParaImprimir,setBoletosParaImprimir]=useState(null); // {boletos:[...]} — se muestra justo al confirmar un pago que generó boleto(s)
const { data: servicios, setData: setServicios, upsert: upsertServicio } = useCollection("servicios", KEYS.servicios, SERVICIOS_DEFAULT);
const { data: gastos, setData: setGastos, upsert: upsertGasto } = useCollection("gastos", "ll_gastos", []);
const { data: depositos, setData: setDepositos, upsert: upsertDeposito } = useCollection("depositos", "ll_depositos", []);
const { data: salidasCaja, setData: setSalidasCaja, upsert: upsertSalida } = useCollection("salidasCaja", "ll_salidas_caja", []);
const { data: cajas, upsert: upsertCaja, nube } = useCollection("cajas", "ll_cajas", []);
const { data: cupones, setData: setCupones, upsert: upsertCupon } = useCollection("cupones", "ll_cupones", []);
const { data: promos, setData: setPromos, upsert: upsertPromo } = useCollection("promos", "ll_promos", []);
const { data: incentivosArr, setData: setIncentivosArr, upsert: upsertIncentivo } = useCollection("configIncentivos", "ll_config_incentivos", INCENTIVOS_DEFAULT);
const cfgInc = incentivosArr[0] || INCENTIVOS_DEFAULT[0];
// 🏭 PRODUCCIÓN — Fase 1: colección de máquinas
const { data: maquinas, setData: setMaquinas, upsert: upsertMaquina } = useCollection("maquinas", "ll_maquinas", MAQUINAS_DEFAULT);
// 🔧 Auto-reparación: si falta alguna máquina semilla en Firestore (ej. solo se guardó 1 de las 7), la completa sin duplicar ni tocar las que ya existen.
useEffect(()=>{
  if(!Array.isArray(maquinas))return;
  const faltantes=MAQUINAS_DEFAULT.filter(def=>!maquinas.some(m=>m.id===def.id));
  if(faltantes.length===0)return;
  setMaquinas(prev=>[...prev,...faltantes]);
  faltantes.forEach(m=>{if(upsertMaquina)upsertMaquina({...m,_updatedAt:new Date().toISOString()});});
  // eslint-disable-next-line
},[maquinas.length]);
// 🏭 PRODUCCIÓN — Fase 2 y 3: PINs por empleada + registro de eventos (lavado/doblado)
const { data: pins, setData: setPins, upsert: upsertPin } = useCollection("pins", "ll_pins", []);
const { data: eventosProduccion, setData: setEventosProduccion, upsert: upsertEvento } = useCollection("eventosProduccion", "ll_eventos_produccion", []);
// 🏭 PRODUCCIÓN — Fase 5: cargas de lavado/secado (máquina + tiempo programado)
const { data: cargas, setData: setCargas, upsert: upsertCarga } = useCollection("cargas", "ll_cargas", []);
// 📋 TAREAS — Fase 1: plantillas de tareas + generación diaria
const { data: plantillasTareas, setData: setPlantillasTareas, upsert: upsertPlantillaTarea } = useCollection("plantillasTareas", "ll_plantillas_tareas", PLANTILLAS_TAREAS_DEFAULT);
// 🔧 Auto-reparación: si faltan plantillas semilla nuevas en Firestore (ej. se agregaron tareas nuevas después de que ya existía la colección), las completa sin duplicar ni tocar las que ya existen.
useEffect(()=>{
  if(!Array.isArray(plantillasTareas))return;
  const faltantes=PLANTILLAS_TAREAS_DEFAULT.filter(def=>!plantillasTareas.some(p=>p.id===def.id));
  if(faltantes.length===0)return;
  setPlantillasTareas(prev=>[...prev,...faltantes]);
  faltantes.forEach(p=>{if(upsertPlantillaTarea)upsertPlantillaTarea({...p,_updatedAt:new Date().toISOString()});});
  // eslint-disable-next-line
},[plantillasTareas.length]);
const { data: tareasDiarias, setData: setTareasDiarias, upsert: upsertTareaDiaria } = useCollection("tareasDiarias", "ll_tareas_diarias", []);
// 📝 NOTAS — canal para que las empleadas dejen pendientes/novedades que revisa la admin
const { data: notas, setData: setNotas, upsert: upsertNota } = useCollection("notas", "ll_notas", []);
// 🧾 Migración de una sola vez: Nicol marcaba "facturado" escribiéndolo en el campo Notas — lo recuperamos hacia el nuevo checklist de facturación SRI
const migracionSRIRef=useRef(false);
useEffect(()=>{
  if(migracionSRIRef.current)return;
  if(!Array.isArray(ventas)||ventas.length===0)return;
  const aMigrar=ventas.filter(v=>!v.anulada&&!v.facturadoSRI&&v.notas&&/factur/i.test(v.notas));
  if(aMigrar.length>0){
    setVentas(prev=>{
      const next=prev.map(v=>(!v.anulada&&!v.facturadoSRI&&v.notas&&/factur/i.test(v.notas))?{...v,facturadoSRI:true,facturadoSRIEn:v.fecha,facturadoSRIPor:"Recuperado de Notas"}:v);
      aMigrar.forEach(v=>{const updated=next.find(vv=>vv.folio===v.folio);if(updated&&upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});});
      return next;
    });
  }
  migracionSRIRef.current=true;
},[ventas]);
// 📋 Generación lazy: si hoy todavía no tiene tareas generadas, las crea una sola vez desde las plantillas activas del día
const tareasGeneradasRef=useRef(false);
useEffect(()=>{
  if(tareasGeneradasRef.current)return;
  if(!Array.isArray(plantillasTareas)||plantillasTareas.length===0)return;
  if(!Array.isArray(tareasDiarias))return;
  const hoyK=fechaHoyLocal();
  // 🔒 Cierre automático: las pendientes de días ANTERIORES a hoy pasan a "no_realizada" (queda registro, nunca se borran)
  const vencidas=tareasDiarias.filter(t=>t.fecha<hoyK&&t.estado==="pendiente");
  if(vencidas.length>0){
    setTareasDiarias(prev=>{
      const next=prev.map(t=>(t.fecha<hoyK&&t.estado==="pendiente")?{...t,estado:"no_realizada"}:t);
      vencidas.forEach(v=>{const updated=next.find(t=>t.id===v.id);if(updated&&upsertTareaDiaria)upsertTareaDiaria({...updated,_updatedAt:new Date().toISOString()});});
      return next;
    });
  }
  const yaGenerado=tareasDiarias.some(t=>t.fecha===hoyK);
  if(yaGenerado){tareasGeneradasRef.current=true;return;}
  const diaSemana=DIAS_KEY[new Date().getDay()];
  const activas=plantillasTareas.filter(p=>p.activa&&(p.diasSemana||[]).includes(diaSemana)&&(!p.fechaInicio||hoyK>=p.fechaInicio)&&(!p.fechaFin||hoyK<=p.fechaFin));
  if(activas.length>0){
    const nuevas=activas.map(p=>({
      id:hoyK+"_"+p.id,fecha:hoyK,plantillaId:p.id,titulo:p.titulo,descripcion:p.descripcion||null,
      area:p.area,bloque:p.bloque,horaLimite:p.horaLimite,orden:p.orden,requiereFoto:!!p.requiereFoto,requiereNota:!!p.requiereNota,rolRequerido:p.rolRequerido||null,empleadaIds:p.empleadaIds||[],
      estado:"pendiente",completadaPor:null,completadaEn:null,atrasada:false,fotoUrl:null,observacion:null,
    }));
    setTareasDiarias(prev=>[...prev,...nuevas]);
    nuevas.forEach(t=>{if(upsertTareaDiaria)upsertTareaDiaria(t);});
  }
  tareasGeneradasRef.current=true;
},[plantillasTareas,tareasDiarias]);
const [showSalida,setShowSalida]=useState(false);
const [showNotifsAdmin,setShowNotifsAdmin]=useState(false);
  const [ticketV,setTicketV]=useState(null);
  const [cuponSug,setCuponSug]=useState(null); // 🎟️ cupón sugerido tras imprimir la venta
  // Servicios visibles (excluye los eliminados, que quedan marcados en la nube)
  const serviciosActivos=servicios.filter(s=>!s.eliminada);

  const esAdmin=sesion.rol==="Administrador";
  const addAbono=(f,ab)=>{
    const ventaAntes=ventas.find(v=>v.folio===f);
    const yaEstabaPagada=ventaAntes?pagada(ventaAntes):false;
    setVentas(prev=>{
      let next=prev.map(v=>{if(v.folio!==f)return v;const abono={...ab,cobradoPorId:sesion.id,cobradoPorNombre:sesion.nombre};const abs=[...(v.abonos||[]),abono];return{...v,abonos:abs,pagada:saldo({...v,abonos:abs})<=0};});
      let updated=next.find(v=>v.folio===f);
      if(updated&&upsertVenta)upsertVenta(updated);
      // 🎟️ Si el abono terminó de pagar la venta, revisa si corresponde generar boleto(s) de sorteo
      if(updated&&!yaEstabaPagada&&pagada(updated)){
        const generados=generarBoletosParaVenta(updated,{sorteos,setSorteos,upsertSorteo,setBoletosSorteo,upsertBoletoSorteo,productos});
        if(generados.length>0){
          next=next.map(v=>v.folio===f?{...v,boletoSorteoGenerado:true}:v);
          updated=next.find(v=>v.folio===f);
          if(upsertVenta)upsertVenta({...updated,_updatedAt:new Date().toISOString()});
          setBoletosParaImprimir({boletos:generados});
        }
      }
      return next;
    });
  };
  const handleCierreListo=()=>{
    setCierreOk(true);
    setCajaOk(false);
    setEsperandoApertura(true);
  };
  const exportarDatos=()=>{const d={ventas,clientes,empleadas,inventario,servicios,gastos,depositos,salidasCaja,cajas,cupones,promos,maquinas,cargas,plantillasTareas,tareasDiarias,notas};const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="respaldo-"+hoy+".json";a.click();};
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
          [d.maquinas,setMaquinas,upsertMaquina],
          [d.cargas,setCargas,upsertCarga],
          [d.plantillasTareas,setPlantillasTareas,upsertPlantillaTarea],
          [d.tareasDiarias,setTareasDiarias,upsertTareaDiaria],
          [d.notas,setNotas,upsertNota],
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

  // 🏭 PRODUCCIÓN: para quienes no son admin, primero eligen si entran a Facturación o a Producción.
  // Producción NO requiere caja abierta (es un área/dispositivo aparte del taller).
  if(!esAdmin&&!vista)return <SelectorVista sesion={sesion} onElegir={setVista} onLogout={onLogout}/>;
  if(!esAdmin&&vista==="produccion")return <ProduccionScreen sesion={sesion} onVolver={()=>setVista(null)} onIrFacturacion={()=>setVista("facturacion")} onIrTareas={()=>setVista("tareas")} onLogout={onLogout} ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} empleadas={empleadas} pins={pins} eventosProduccion={eventosProduccion} setEventosProduccion={setEventosProduccion} upsertEvento={upsertEvento} maquinas={maquinas} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga} clientes={clientes}/>;
  if(!esAdmin&&vista==="tareas")return <TareasScreen sesion={sesion} onVolver={()=>setVista(null)} onIrFacturacion={()=>setVista("facturacion")} onIrProduccion={()=>setVista("produccion")} onLogout={onLogout} tareasDiarias={tareasDiarias} setTareasDiarias={setTareasDiarias} upsertTareaDiaria={upsertTareaDiaria} pins={pins} empleadas={empleadas} notas={notas} setNotas={setNotas} upsertNota={upsertNota}/>;

  // Si cerró caja y quiere seguir trabajando, DEBE abrir caja nuevamente
  // 🔒 El admin NUNCA pasa por esto: esa cuenta no se usa para facturar/cobrar, así que no tiene sentido pedirle apertura/cierre de caja.
  if(!esAdmin&&(!cajaOk||esperandoApertura))return <AperturaObligatoria
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
  if(!esAdmin)return <PantallaEmpleada ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} servicios={serviciosActivos} sesion={sesion} addAbono={addAbono} onLogout={onLogout} onIrProduccion={()=>setVista("produccion")} onIrTareas={()=>setVista("tareas")} cierreListo={cierreOk} onCierreListo={handleCierreListo} onResetCierre={()=>{setCierreOk(false);setEsperandoApertura(true);}} salidasCaja={salidasCaja} setSalidasCaja={setSalidasCaja} upsertVenta={upsertVenta} upsertSalida={upsertSalida} upsertCliente={upsertCliente} upsertCaja={upsertCaja} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos} cfgInc={cfgInc} maquinas={maquinas} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga} pins={pins} eventosProduccion={eventosProduccion} setEventosProduccion={setEventosProduccion} upsertEvento={upsertEvento} productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} sorteos={sorteos} setSorteos={setSorteos} upsertSorteo={upsertSorteo} setBoletosSorteo={setBoletosSorteo} upsertBoletoSorteo={upsertBoletoSorteo} boletosParaImprimir={boletosParaImprimir} setBoletosParaImprimir={setBoletosParaImprimir} depositos={depositos} setDepositos={setDepositos} upsertDeposito={upsertDeposito} setConteosInventario={setConteosInventario} upsertConteoInventario={upsertConteoInventario} ventasPerfumeReg={ventasPerfumeReg} setVentasPerfumeReg={setVentasPerfumeReg} upsertVentaPerfume={upsertVentaPerfume} tareasDiarias={tareasDiarias} quejas={quejas} evalConfig={evalConfig} calificacionesAudio={calificacionesAudio}/>;
  const tabs=[
    {id:"ventas",icon:"🧾",l:"Venta"},{id:"historial",icon:"📋",l:"Historial"},
    {id:"pendientes",icon:"⏳",l:"Pendientes",b:pCount},{id:"bi",icon:"🚀",l:"Dashboard"},
    {id:"clientes",icon:"👥",l:"Clientes"},{id:"clientesAnalisis",icon:"📊",l:"Análisis clientes"},{id:"promosAdmin",icon:"🎁",l:"Promos"},{id:"cupones",icon:"🎟️",l:"Cupones"},{id:"resumen",icon:"📈",l:"Resumen día"},
    {id:"reportes",icon:"📊",l:"Reportes"},{id:"depositos",icon:"🏦",l:"Depósitos"},
    {id:"conciliacion",icon:"🏛️",l:"Conciliación"},
    {id:"gastos",icon:"🛒",l:"Gastos"},{id:"inventario",icon:"📦",l:"Inventario"},{id:"productosAdmin",icon:"🛍️",l:"Productos"},{id:"kardexAdmin",icon:"📒",l:"Kardex"},{id:"conteosAdmin",icon:"📋",l:"Conteos"},{id:"activosFijosAdmin",icon:"📦",l:"Activos Fijos"},{id:"deudasAdmin",icon:"💳",l:"Deudas"},{id:"sorteoAdmin",icon:"🎟️",l:"Sorteo"},
    {id:"equipo",icon:"👩",l:"Equipo"},{id:"incentivosAdmin",icon:"🎯",l:"Incentivos"},{id:"maquinasAdmin",icon:"🏭",l:"Máquinas"},{id:"reporteMaquinasAdmin",icon:"⏱️",l:"Uso de máquinas"},{id:"tiemposRopaAdmin",icon:"👕",l:"Tiempos x Servicio"},{id:"pinsAdmin",icon:"🔒",l:"PINs"},{id:"produccionAdmin",icon:"🧺",l:"Producción"},{id:"tareasAdmin",icon:"📋",l:"Tareas"},{id:"notasAdmin",icon:"📝",l:"Notas"},{id:"evaluacionAdmin",icon:"📋",l:"Evaluación"},{id:"calificacionManualAdmin",icon:"🎧",l:"Calificación manual"},{id:"evaluacionConfigAdmin",icon:"⚙️",l:"Config. Evaluación"},
    {id:"config",icon:"⚙️",l:"Config"},{id:"usuarios",icon:"🔑",l:"Usuarios"},
  ];
  // 🗂️ Agrupa las pestañas en categorías para que el panel admin se vea más ordenado (menos scroll horizontal, todo lo relacionado junto)
  const CATEGORIAS=[
    {id:"ventas_caja",icon:"🧾",l:"Ventas",tabIds:["ventas","historial","pendientes","depositos","conciliacion","cupones","promosAdmin","reportes","resumen"]},
    {id:"personal",icon:"👥",l:"Personal",tabIds:["equipo","pinsAdmin","usuarios","tareasAdmin","notasAdmin","incentivosAdmin","evaluacionAdmin","calificacionManualAdmin","evaluacionConfigAdmin","reporteMaquinasAdmin","tiemposRopaAdmin"]},
    {id:"inventario_cat",icon:"📦",l:"Inventario",tabIds:["inventario","productosAdmin","kardexAdmin","conteosAdmin","gastos","maquinasAdmin","activosFijosAdmin","deudasAdmin"]},
    {id:"negocio",icon:"📊",l:"Negocio",tabIds:["bi","clientes","clientesAnalisis","sorteoAdmin","produccionAdmin","config"]},
  ];
  const categoriaDeTab=id=>CATEGORIAS.find(c=>c.tabIds.includes(id))?.id||CATEGORIAS[0].id;
  const [categoria,setCategoria]=useState(()=>categoriaDeTab(tab));
  const tabsDeCategoria=CATEGORIAS.find(c=>c.id===categoria)?.tabIds||[];
  const tabsVisibles=tabs.filter(t=>tabsDeCategoria.includes(t.id));
  const irACategoria=cid=>{
    setCategoria(cid);
    const primera=CATEGORIAS.find(c=>c.id===cid)?.tabIds[0];
    if(primera)setTab(primera);
  };
  return(<div style={S.app}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#4db6e4;border-radius:3px}`}</style>
    <div style={S.hdr}><div style={S.hdrI}>
      <span style={S.logo}>🫧 Lava<span style={{color:"#4db6e4"}}>&</span>Listo</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span title={nube?"Sincronizado con la nube":"Sin conexión a la nube — guardando en este dispositivo"} style={{fontSize:12,color:"#a0c4da"}}>{nube?"☁️":"📴"} 👑 {sesion.nombre}</span>
        <button onClick={()=>setShowNotifsAdmin(true)} style={{position:"relative",background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,color:"#fff",fontSize:12,padding:"4px 10px",cursor:"pointer"}}>
          🔔{(()=>{const n=ventas.filter(v=>!v.anulada&&(v.clasificacion?.restregadoEstado==="pendiente_confirmar"||(v.clasificacion?.serviciosAdicionales||[]).some(s=>s.estado==="pendiente_confirmar")||((v.estado||"recibido")==="listo"&&!v.checkMsgRetiro))).length+(clientes||[]).filter(c=>diasParaCumple(c.nacimiento)===0).length+(maquinas||[]).filter(m=>m.estado==="ocupada"&&m.finProgramado&&new Date(m.finProgramado)<new Date()).length+ventas.filter(v=>!v.anulada&&pagada(v)&&!v.facturadoSRI).length+ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&fechaLocal(v.entrega)===fechaHoyLocal()).length+ventas.filter(v=>!v.anulada&&(v.estado||"recibido")!=="entregado"&&v.notas&&v.notas.trim()).length;return n>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 5px"}}>{n}</span>;})()}
        </button>
        <button onClick={()=>setShowSalida(true)} style={{background:"rgba(220,50,50,.3)",border:"none",borderRadius:6,color:"#ffcccc",fontSize:11,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>💸 Salida</button>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,color:"#fff",fontSize:11,padding:"4px 10px",cursor:"pointer"}}>Salir</button>
      </div>
    </div></div>
    <div style={{background:"#fff",display:"flex",borderBottom:"2px solid #1a3c5e",maxWidth:700,margin:"0 auto",position:"sticky",top:0,zIndex:11,overflowX:"auto"}}>
      {CATEGORIAS.map(c=>(
        <button key={c.id} onClick={()=>irACategoria(c.id)} style={{flex:"1 0 auto",display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"10px 14px",border:"none",background:categoria===c.id?"#1a3c5e":"#f0f4f8",color:categoria===c.id?"#fff":"#1a3c5e",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,whiteSpace:"nowrap",fontSize:12}}>
          <span style={{fontSize:16}}>{c.icon}</span>
          <span>{c.l}</span>
        </button>
      ))}
    </div>
    <div style={S.tabBar}>
      {tabsVisibles.map(t=>(<button key={t.id} style={{...S.tabBtn,...(tab===t.id?S.tabAct:{})}} onClick={()=>setTab(t.id)}>
        <span style={{position:"relative"}}>{t.icon}{t.b>0&&<span style={{position:"absolute",top:-4,right:-8,background:"#e53935",color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,padding:"1px 4px"}}>{t.b}</span>}</span>
        <span>{t.l}</span>
      </button>))}
    </div>
    <div style={S.content}>
      {tab==="ventas"&&<NuevaVenta ventas={ventas} setVentas={setVentas} clientes={clientes} setClientes={setClientes} empleadas={empleadas} setTicket={setTicketV} servicios={serviciosActivos} sesion={sesion} upsertVenta={upsertVenta} upsertCliente={upsertCliente} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} promos={promos} productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} sorteos={sorteos} setSorteos={setSorteos} upsertSorteo={upsertSorteo} setBoletosSorteo={setBoletosSorteo} upsertBoletoSorteo={upsertBoletoSorteo} onBoletosGenerados={setBoletosParaImprimir}/>}
      {tab==="historial"&&<Historial ventas={ventas} setVentas={setVentas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} esAdmin={esAdmin} upsertVenta={upsertVenta} sesion={sesion} productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} setQuejas={setQuejas} upsertQueja={upsertQueja}/>}
      {tab==="pendientes"&&<Pendientes ventas={ventas} empleadas={empleadas} setTicket={setTicketV} addAbono={addAbono} setVentas={setVentas} upsertVenta={upsertVenta}/>}
      {tab==="bi"&&<DashboardBI ventas={ventas} empleadas={empleadas} gastos={gastos}/>}
      {tab==="clientes"&&<Clientes clientes={clientes} setClientes={setClientes} upsertCliente={upsertCliente} ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta}/>}
      {tab==="clientesAnalisis"&&<AnalisisClientes clientes={clientes} ventas={ventas}/>}
      {tab==="promosAdmin"&&<PromosAdmin promos={promos} setPromos={setPromos} upsertPromo={upsertPromo} servicios={servicios}/>}
      {tab==="cupones"&&<Cupones cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} clientes={clientes} ventas={ventas} sesion={sesion} promos={promos}/>}
      {tab==="resumen"&&<ResumenDia ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="reportes"&&<Reportes ventas={ventas} empleadas={empleadas} salidasCaja={salidasCaja}/>}
      {tab==="depositos"&&<Depositos depositos={depositos} setDepositos={setDepositos} ventas={ventas} salidasCaja={salidasCaja} upsertDeposito={upsertDeposito}/>}
      {tab==="conciliacion"&&<Conciliacion ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} depositos={depositos} setDepositos={setDepositos} upsertDeposito={upsertDeposito}/>}
      {tab==="gastos"&&<Gastos gastos={gastos} setGastos={setGastos} sesion={sesion} upsertGasto={upsertGasto} salidasCaja={salidasCaja} activosFijos={activosFijos} setActivosFijos={setActivosFijos} upsertActivoFijo={upsertActivoFijo} inventario={inventario} setInventario={setInventario} upsertInventario={upsertInventario} kardexInsumos={kardexInsumos} setKardexInsumos={setKardexInsumos} upsertKardexInsumo={upsertKardexInsumo}/>}
      {tab==="inventario"&&<Inventario inventario={inventario} setInventario={setInventario} upsertInventario={upsertInventario} kardexInsumos={kardexInsumos} setKardexInsumos={setKardexInsumos} upsertKardexInsumo={upsertKardexInsumo} sesion={sesion}/>}
      {tab==="productosAdmin"&&<ProductosAdmin productos={productos} setProductos={setProductos} upsertProducto={upsertProducto} kardexProductos={kardexProductos} setKardexProductos={setKardexProductos} upsertKardexProducto={upsertKardexProducto} sesion={sesion}/>}
      {tab==="kardexAdmin"&&<KardexView productos={productos} kardexProductos={kardexProductos} inventario={inventario} kardexInsumos={kardexInsumos}/>}
      {tab==="conteosAdmin"&&<ConteosAdmin conteos={conteosInventario}/>}
      {tab==="activosFijosAdmin"&&<ActivosFijosAdmin activosFijos={activosFijos} setActivosFijos={setActivosFijos} upsertActivoFijo={upsertActivoFijo} sesion={sesion}/>}
      {tab==="deudasAdmin"&&<DeudasAdmin deudas={deudas} setDeudas={setDeudas} upsertDeuda={upsertDeuda} setGastos={setGastos} upsertGasto={upsertGasto} sesion={sesion}/>}
      {tab==="sorteoAdmin"&&<SorteosAdmin sorteos={sorteos} setSorteos={setSorteos} upsertSorteo={upsertSorteo} boletosSorteo={boletosSorteo} productos={productos}/>}
      {tab==="equipo"&&<Equipo empleadas={empleadas} setEmpleadas={setEmpleadas} ventas={ventas} esAdmin={esAdmin} upsertEmpleada={upsertEmpleada}/>}
      {tab==="incentivosAdmin"&&<IncentivosAdmin cfgInc={cfgInc} setIncentivosArr={setIncentivosArr} upsertIncentivo={upsertIncentivo} ventas={ventas} empleadas={empleadas} ventasPerfumeReg={ventasPerfumeReg}/>}
      {tab==="maquinasAdmin"&&<MaquinasAdmin maquinas={maquinas} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga}/>}
      {tab==="pinsAdmin"&&<PinsAdmin empleadas={empleadas} pins={pins} setPins={setPins} upsertPin={upsertPin}/>}
      {tab==="produccionAdmin"&&(<div style={S.panel}><h2 style={S.ptitle}>🧺 Producción</h2>
        <ReportesProduccionPanel cargas={cargas||[]} eventosProduccion={eventosProduccion||[]} ventas={ventas} empleadas={empleadas}/>
        <Produccion ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} empleadas={empleadas} pins={pins||[]} eventosProduccion={eventosProduccion||[]} setEventosProduccion={setEventosProduccion} upsertEvento={upsertEvento} maquinas={maquinas||[]} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} cargas={cargas||[]} setCargas={setCargas} upsertCarga={upsertCarga}/></div>)}
      {tab==="tareasAdmin"&&<TareasAdminPanel plantillasTareas={plantillasTareas||[]} setPlantillasTareas={setPlantillasTareas} upsertPlantillaTarea={upsertPlantillaTarea} tareasDiarias={tareasDiarias||[]} setTareasDiarias={setTareasDiarias} upsertTareaDiaria={upsertTareaDiaria} empleadas={empleadas}/>}
      {tab==="notasAdmin"&&<NotasAdminPanel notas={notas||[]} setNotas={setNotas} upsertNota={upsertNota} empleadas={empleadas}/>}
      {tab==="evaluacionAdmin"&&<EvaluacionDesempeno empleadas={empleadas} ventas={ventas} eventosProduccion={eventosProduccion} tareasDiarias={tareasDiarias} quejas={quejas} cargas={cargas} evalConfig={evalConfig} esAdmin={true} calificacionesAudio={calificacionesAudio} ventasPerfumeReg={ventasPerfumeReg}/>}
      {tab==="calificacionManualAdmin"&&<CalificacionManualAdmin empleadas={empleadas} calificacionesAudio={calificacionesAudio} setCalificacionesAudio={setCalificacionesAudio} upsertCalificacionAudio={upsertCalificacionAudio} quejas={quejas} setQuejas={setQuejas} upsertQueja={upsertQueja} sesion={sesion}/>}
      {tab==="evaluacionConfigAdmin"&&<EvaluacionConfigAdmin evalConfig={evalConfig} setEvalConfigArr={setEvalConfigArr} upsertEvalConfig={upsertEvalConfig}/>}
      {tab==="reporteMaquinasAdmin"&&<ReporteMaquinas cargas={cargas} maquinas={maquinas} ventas={ventas} evalConfig={evalConfig}/>}
      {tab==="tiemposRopaAdmin"&&<TiemposRopaAdmin ventas={ventas} eventosProduccion={eventosProduccion} cargas={cargas} maquinas={maquinas} empleadas={empleadas}/>}
      {tab==="caja"&&<CierreCaja ventas={ventas} empleadas={empleadas} onLogout={onLogout} onCierreListo={handleCierreListo} onResetCierre={()=>setCierreOk(false)} sesion={sesion} salidasCaja={salidasCaja} setVentas={setVentas} upsertVenta={upsertVenta} upsertCaja={upsertCaja}/>}
      {tab==="config"&&<Configuracion servicios={servicios} setServicios={setServicios} exportarDatos={exportarDatos} importarDatos={importarDatos} upsertVenta={upsertVenta} upsertServicio={upsertServicio}/>}
      {tab==="usuarios"&&<GestionUsuarios/>}
    </div>
    {ticketV&&<TicketModal venta={ticketV} empleadas={empleadas} onClose={()=>{setCuponSug(ticketV);setTicketV(null);}}/>}
    {cuponSug&&<CuponSugerido venta={cuponSug} clientes={clientes} ventas={ventas} cupones={cupones} setCupones={setCupones} upsertCupon={upsertCupon} sesion={sesion} promos={promos} onClose={()=>setCuponSug(null)}/>}
    {showSalida&&<SalidaCaja sesion={sesion} salidasCaja={salidasCaja} setSalidasCaja={setSalidasCaja} onClose={()=>setShowSalida(false)} upsertSalida={upsertSalida}/>}
    {showNotifsAdmin&&<NotificacionesPanel ventas={ventas} setVentas={setVentas} upsertVenta={upsertVenta} addAbono={addAbono} clientes={clientes} maquinas={maquinas} cargas={cargas} setCargas={setCargas} upsertCarga={upsertCarga} setMaquinas={setMaquinas} upsertMaquina={upsertMaquina} pins={pins} empleadas={empleadas} sesion={sesion} esAdmin={true} onClose={()=>setShowNotifsAdmin(false)}/>}
    {boletosParaImprimir&&<BoletosSorteoModal data={boletosParaImprimir} sorteos={sorteos} onClose={()=>setBoletosParaImprimir(null)}/>}
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
    const mesVenta=mesK(v.fecha);
    (v.abonos||[]).forEach((ab,idx)=>{
      const d=fechaLocal(ab.fecha);
      if(!d||!d.startsWith(mesVer))return;
      const item={folio:v.folio,idx,fecha:d,fechaISO:ab.fecha,cliente:v.clienteNombre||"",monto:ab.monto,conciliado:!!ab.conciliado,quien:ab.cobradoPorNombre||"",mesVenta,esMesAnterior:mesVenta!==mesVer};
      if(ab.metodo==="Transferencia Pichincha")movs.pichincha.push(item);
      else if(ab.metodo==="Transferencia JEP")movs.jep.push(item);
      else if(ab.metodo==="Tarjeta")movs.tarjeta.push(item);
    });
  });
  // Depósitos de efectivo registrados en el mes
  const depsMes=depositos.filter(d=>!d.eliminada&&d.fecha&&d.fecha.startsWith(mesVer));
  // ⏳ Ventas HECHAS en este mes: cuánto quedaba pendiente EXACTAMENTE al último día de ese mes
  // (no el saldo de hoy — se recalcula con la fecha real de cada abono, así que sigue siendo correcto
  // aunque el cliente ya haya pagado después, en un mes posterior).
  const [añoFinMes,mesFinMesNum]=mesVer.split("-").map(Number);
  const finDeMesStr=new Date(añoFinMes,mesFinMesNum,0).toISOString().split("T")[0]; // último día calendario de mesVer
  const saldoAlFinDeMes=v=>{
    const pagadoAlFinMes=(v.abonos||[]).filter(ab=>fechaLocal(ab.fecha)<=finDeMesStr).reduce((a,ab)=>a+ab.monto,0);
    return parseFloat((v.total-pagadoAlFinMes).toFixed(2));
  };
  const pendientesMes=ventas.filter(v=>!v.anulada&&mesK(v.fecha)===mesVer&&saldoAlFinDeMes(v)>0.01).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const totalPendienteMes=parseFloat(pendientesMes.reduce((a,v)=>a+saldoAlFinDeMes(v),0).toFixed(2));
  // Cuánto de ese pendiente-al-fin-de-mes ya se cobró después (en meses posteriores) — útil para ver el avance
  const pendienteMesYaCobradoDespues=parseFloat(pendientesMes.reduce((a,v)=>a+(saldoAlFinDeMes(v)-saldo(v)),0).toFixed(2));

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
                  {m.esMesAnterior&&<div style={{display:"inline-block",marginTop:3,fontSize:10,fontWeight:700,color:"#e65100",background:"#fff3e0",borderRadius:6,padding:"2px 6px"}}>🔙 Venta de {m.mesVenta}</div>}
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
          +"<td style='padding:4px'>"+(tipo==="dep"?(m.banco+" · "+m.comprobante):m.cliente+(m.esMesAnterior?" <span style='color:#e65100;font-weight:bold'>(🔙 venta de "+m.mesVenta+")</span>":""))+"</td>"
          +"<td style='padding:4px;text-align:right;font-weight:bold'>$"+m.monto.toFixed(2)+"</td></tr>").join("")
        +"<tr><td colspan='3' style='padding:4px;font-weight:bold'>Total: $"+r.tot.toFixed(2)+" · Conciliado: $"+r.con.toFixed(2)+"</td><td style='padding:4px;text-align:right;font-weight:bold;color:"+(r.pend>0?"#c62828":"#2e7d32")+"'>"+(r.pend>0?"Pendiente $"+r.pend.toFixed(2):"✔ OK")+"</td></tr>"
        +"</table>";
    };
    const w=window.open("","_blank","width=750,height=700");
    if(!w)return;
    const pendHtml=pendientesMes.length===0?"":"<h3 style='color:#e65100;margin-top:16px'>⏳ Pendiente al último día de "+mesVer+" ("+fmtD(finDeMesStr)+")</h3>"
      +"<table cellpadding='4' cellspacing='0' style='border-collapse:collapse;width:100%;font-size:11px'>"
      +"<tr><th style='background:#fff3e0;text-align:left;padding:4px'>Folio</th><th style='background:#fff3e0;text-align:left;padding:4px'>Cliente</th><th style='background:#fff3e0;text-align:left;padding:4px'>Fecha venta</th><th style='background:#fff3e0;text-align:right;padding:4px'>Total</th><th style='background:#fff3e0;text-align:right;padding:4px'>Pendiente al cierre</th><th style='background:#fff3e0;text-align:right;padding:4px'>Pendiente hoy</th></tr>"
      +pendientesMes.map(v=>"<tr style='border-bottom:1px solid #eee'><td style='padding:4px'>"+v.folio+"</td><td style='padding:4px'>"+(v.clienteNombre||"")+"</td><td style='padding:4px'>"+fmtD(v.fecha)+"</td><td style='padding:4px;text-align:right'>$"+v.total.toFixed(2)+"</td><td style='padding:4px;text-align:right;font-weight:bold;color:#e65100'>$"+saldoAlFinDeMes(v).toFixed(2)+"</td><td style='padding:4px;text-align:right'>$"+saldo(v).toFixed(2)+"</td></tr>").join("")
      +"<tr><td colspan='4' style='padding:4px;font-weight:bold'>Total pendiente al cierre de "+mesVer+"</td><td style='padding:4px;text-align:right;font-weight:bold;color:#e65100'>$"+totalPendienteMes.toFixed(2)+"</td><td></td></tr>"
      +"</table>";
    const banner=todoConciliado
      ?"<div style='border:2px solid #2e7d32;background:#e8f5e9;border-radius:10px;padding:12px;text-align:center;font-size:18px;font-weight:800;color:#1b5e20;margin-top:14px'>✅ MES TOTALMENTE CONCILIADO</div>"
      :"<div style='border:2px solid #c62828;background:#ffebee;border-radius:10px;padding:12px;text-align:center;font-size:16px;font-weight:800;color:#c62828;margin-top:14px'>⏳ PENDIENTE POR CONCILIAR: $"+totalPend.toFixed(2)+" ("+nTotalPend+" movimientos)</div>";
    const html="<html><head><title>Conciliación bancaria</title><style>body{font-family:sans-serif;padding:20px}h2{color:#1a3c5e;text-align:center}</style></head><body>"
      +"<h2>🫧 Lava&amp;Listo — Conciliación bancaria "+mesVer+"</h2>"
      +secHtml("💵 Depósitos de efectivo registrados",depsMes,"dep")
      +secHtml("🏦 Transferencias Pichincha recibidas",movs.pichincha,"ab")
      +secHtml("🏦 Transferencias JEP recibidas",movs.jep,"ab")
      +secHtml("💳 Cobros con tarjeta",movs.tarjeta,"ab")
      +pendHtml
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

      <div style={{background:"#fff",borderRadius:12,marginBottom:14,overflow:"hidden",boxShadow:"0 1px 6px rgba(26,60,94,.08)"}}>
        <div style={{background:"#fff3e0",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <div style={{fontWeight:800,fontSize:14,color:"#e65100"}}>⏳ Pendiente al último día de {mesVer}</div>
          <div style={{fontSize:12,fontWeight:700,color:"#e65100"}}>Total: ${totalPendienteMes.toFixed(2)}</div>
        </div>
        <div style={{padding:"6px 14px 10px"}}>
          <div style={{fontSize:11,color:"#888",padding:"6px 0"}}>Esto es lo que quedaba pendiente exactamente al cierre de {mesVer} ({fmtD(finDeMesStr)}) — se calcula con la fecha real de cada abono, así que es el mismo número aunque el cliente ya haya pagado después.</div>
          {pendienteMesYaCobradoDespues>0.01&&<div style={{fontSize:11,color:"#2e7d32",background:"#e8f5e9",borderRadius:6,padding:"6px 8px",marginBottom:6}}>✅ De ese total, ${pendienteMesYaCobradoDespues.toFixed(2)} ya se cobraron después (en meses posteriores) — hoy el pendiente real de estas ventas es ${(totalPendienteMes-pendienteMesYaCobradoDespues).toFixed(2)}.</div>}
          {pendientesMes.length===0
            ?<div style={{...S.empty,padding:"12px 0"}}>No quedó nada pendiente al cierre de {mesVer} ✅</div>
            :pendientesMes.map(v=>{
              const pendAlFin=saldoAlFinDeMes(v);
              const pendHoy=saldo(v);
              const yaSeCobro=pendAlFin-pendHoy>0.01;
              return(
                <div key={v.folio} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f4f8"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#1a3c5e"}}>{v.clienteNombre||"—"} <span style={{color:"#aaa",fontWeight:400,fontSize:11}}>({v.folio})</span></div>
                    <div style={{fontSize:11,color:"#888"}}>Vendido {fmtD(v.fecha)} · Total ${v.total.toFixed(2)}</div>
                    {yaSeCobro&&<div style={{fontSize:11,color:"#2e7d32",fontWeight:600}}>✅ Ya se cobró después — hoy debe ${pendHoy.toFixed(2)}</div>}
                  </div>
                  <div style={{fontWeight:800,fontSize:14,color:"#e65100"}}>${pendAlFin.toFixed(2)}</div>
                </div>
              );
            })
          }
        </div>
      </div>

      <div style={{fontSize:12,color:"#888"}}>💡 Consejo: abre el estado de cuenta del banco en el celular o impreso, y ve marcando aquí cada valor que encuentres. Lo que quede sin ✓ al final es lo que hay que investigar (depósito no realizado, transferencia mal registrada, etc.).</div>
    </div>
  );
}
