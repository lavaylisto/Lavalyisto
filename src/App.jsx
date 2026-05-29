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
  { id: "005", label: "5 PARES (PACK FAMILIAR RECOMENDADO)", precio: 12.
const PAGOS = ["Efectivo", "Transferencia", "Tarjeta"];

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
