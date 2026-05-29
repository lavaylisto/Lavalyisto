import { useState, useEffect } from "react";

// ─── STORAGE ───────────────────────────────────────────────────────
const KEYS = {import { useState, useEffect } from "react";

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
