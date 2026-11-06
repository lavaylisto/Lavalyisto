import { useState, useEffect, useRef, useCallback } from "react";
import { db, firebaseListo, authReady } from "../firebase";
import {
  collection, onSnapshot, setDoc, doc, query, where,
} from "firebase/firestore";
import LZString from "lz-string";

// Hook local-first con SINCRONIZACIÓN INCREMENTAL (segura).
// - Al abrir la app usa la copia guardada en este equipo (localStorage) al instante.
// - A Firebase solo le pide los documentos que CAMBIARON desde la última sincronización (campo _updatedAt).
// - 🔧 La marca de sincronización SOLO avanza si la copia local se guardó bien. Antes avanzaba aunque
//   el equipo no tuviera espacio para guardar, y después nunca volvía a pedir lo que faltaba
//   (por eso un equipo se quedaba mostrando órdenes viejas).
// - 🔧 Una descarga completa por día y por equipo (la primera vez que se abre en el día), para
//   reparar cualquier hueco. Así ningún equipo queda desfasado más de un día.
// - 🔧 La marca nunca queda en el futuro (por equipos con la hora mal configurada).
// - Los borrados se marcan con _deleted:true para que los otros equipos se enteren.

const MARGEN_MS = 60 * 60 * 1000; // 1 hora de margen por relojes desfasados entre equipos

const claveDe = (it) =>
  it == null ? null : String(it._docId ?? it.folio ?? it.id ?? "");

// 🗜️ La copia local se guarda COMPRIMIDA (ocupa ~5-10 veces menos). El navegador solo permite ~10 MB
// por sitio y la app ya los había llenado (ventas + eventos de producción + cargas), por eso un equipo
// dejaba de guardar y se quedaba con datos viejos. Lee también copias viejas sin comprimir.
const PREFIJO_LZ = "LZ1:";
const leerLocal = (key, def) => {
  try {
    const v = localStorage.getItem(key);
    if (!v) return def;
    if (v.startsWith(PREFIJO_LZ)) {
      const txt = LZString.decompressFromUTF16(v.slice(PREFIJO_LZ.length));
      return txt ? JSON.parse(txt) : def;
    }
    return JSON.parse(v);
  } catch { return def; }
};

// Devuelve true solo si de verdad se guardó (sin espacio → false)
const guardarLocal = (key, val) => {
  try {
    localStorage.setItem(key, PREFIJO_LZ + LZString.compressToUTF16(JSON.stringify(val)));
    return true;
  } catch {
    try { localStorage.removeItem(key); } catch {} // libera el espacio de la copia vieja en vez de dejarla desfasada
    return false;
  }
};

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const visibles = (arr) => (arr || []).filter((x) => !x || !x._deleted);

// 🚨 Aviso visible cuando este equipo no puede guardar su copia local (falta de espacio)
const avisarSinEspacio = () => {
  try {
    if (document.getElementById("ll-aviso-espacio")) return;
    const div = document.createElement("div");
    div.id = "ll-aviso-espacio";
    div.style.cssText = "position:fixed;top:0;left:0;right:0;background:#c62828;color:#fff;padding:10px 14px;font-family:sans-serif;font-size:13px;z-index:999999;text-align:center;";
    div.textContent = "⚠️ Este equipo no tiene espacio para guardar su copia local. La app sigue sincronizando con la nube, pero cierra otras pestañas o libera espacio en el navegador.";
    document.body.appendChild(div);
  } catch {}
};

export function useCollection(colName, localKey, defaultVal = []) {
  // v3: marca nueva — todos los equipos hacen una descarga completa la primera vez con esta versión
  const syncKey = localKey + "__sync3";
  const fullKey = localKey + "__full3"; // día de la última descarga completa en este equipo
  const [data, setDataState] = useState(() => visibles(leerLocal(localKey, defaultVal)));
  const [nube, setNube] = useState(false);
  const actual = useRef(data); // copia sincronizada de "data", para calcular la lista sin esperar a React
  // 💾 Guardado diferido: comprimir listas grandes tarda, así que se guarda 1,5 s después del último cambio
  // (no en cada clic). La marca de sincronización pendiente se escribe solo si ese guardado salió bien.
  const timerGuardar = useRef(null);
  const marcaPendiente = useRef(null); // { ts, completa }
  const guardarAhora = () => {
    timerGuardar.current = null;
    const ok = guardarLocal(localKey, actual.current);
    if (!ok) {
      avisarSinEspacio();
      marcaPendiente.current = null;
      try { localStorage.removeItem(syncKey); localStorage.removeItem(fullKey); } catch {}
      return;
    }
    const m = marcaPendiente.current;
    marcaPendiente.current = null;
    if (m) {
      try {
        localStorage.setItem(syncKey, m.ts);
        if (m.completa) localStorage.setItem(fullKey, hoyLocal());
      } catch {}
    }
  };
  const programarGuardado = () => {
    if (timerGuardar.current) clearTimeout(timerGuardar.current);
    timerGuardar.current = setTimeout(guardarAhora, 1500);
  };

  // setData que mantiene la referencia al día (lo usa App para cambios locales)
  const setData = useCallback((v) => {
    setDataState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      actual.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!firebaseListo || !db) return;
    let unsub = () => {};
    let cancelado = false;

    authReady.then(() => {
      if (cancelado) return;
      let ultimo = null;
      let ultimaCompleta = null;
      try { ultimo = localStorage.getItem(syncKey); ultimaCompleta = localStorage.getItem(fullKey); } catch {}
      const tieneCopia = Array.isArray(actual.current) && actual.current.length > 0;

      let q;
      let completa = false;
      let filtrada = false; // consulta con filtro _updatedAt (un "removed" ahí no es un borrado)
      if (ultimo && tieneCopia && ultimaCompleta === hoyLocal()) {
        const desde = new Date(new Date(ultimo).getTime() - MARGEN_MS).toISOString();
        q = query(collection(db, colName), where("_updatedAt", ">", desde));
        filtrada = true;
      } else {
        q = query(collection(db, colName)); // descarga completa (sin marca, o primera vez del día)
        completa = true;
      }

      unsub = onSnapshot(q, (snap) => {
        setNube(true);
        const delServidor = !snap.metadata.fromCache;
        const ahora = new Date().toISOString();
        let maxTs = ultimo || "";
        let lista = null;

        if (completa) {
          const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
          if (delServidor) snap.docs.forEach((d, i) => { const u = docs[i]._updatedAt; if (!d.metadata.hasPendingWrites && u && u > maxTs) maxTs = u; });
          // Se conserva lo creado en este equipo que todavía no llegó a la nube (sin _docId)
          const enServidor = new Set(docs.map(claveDe));
          const soloLocales = (actual.current || []).filter((it) => it && !it._docId && !enServidor.has(claveDe(it)));
          lista = [...visibles(docs), ...soloLocales];
        } else {
          const cambios = [];
          snap.docChanges().forEach((ch) => {
            if (ch.type === "removed" && filtrada) return; // salió del filtro, no es un borrado
            const d = { ...ch.doc.data(), _docId: ch.doc.id };
            if (ch.type === "removed") d._deleted = true; // borrado real en una consulta completa
            if (delServidor && !ch.doc.metadata.hasPendingWrites && d._updatedAt && d._updatedAt > maxTs) maxTs = d._updatedAt;
            cambios.push(d);
          });
          if (cambios.length) {
            const mapa = new Map();
            const sinClave = [];
            (actual.current || []).forEach((it) => { const k = claveDe(it); k ? mapa.set(k, it) : sinClave.push(it); });
            cambios.forEach((c) => {
              const k = claveDe(c);
              if (c._deleted) mapa.delete(k);
              else mapa.set(k, { ...(mapa.get(k) || {}), ...c });
            });
            lista = [...mapa.values(), ...sinClave];
          }
        }

        if (lista) {
          actual.current = lista;
          setDataState(lista);
        }

        // ☁️ La marca solo avanza con datos del servidor, y se escribe cuando la copia local quedó guardada
        if (delServidor) {
          if (!maxTs) maxTs = ultimo || ahora;
          if (maxTs > ahora) maxTs = ahora; // nunca en el futuro
          ultimo = maxTs;
          const prev = marcaPendiente.current;
          marcaPendiente.current = { ts: maxTs, completa: completa || !!(prev && prev.completa) };
          completa = false;
          programarGuardado();
        }
      }, (err) => {
        console.error(`Firestore [${colName}]:`, err.message);
        setNube(false);
      });
    });

    return () => { cancelado = true; unsub(); };
  }, [colName, localKey]);

  // Respaldar en localStorage cada cambio local (aunque no haya nube), con guardado diferido
  useEffect(() => {
    actual.current = data;
    programarGuardado();
  }, [data, localKey]);

  // Al cerrar o recargar la página, guardar lo pendiente de inmediato
  useEffect(() => {
    const alSalir = () => { if (timerGuardar.current) { clearTimeout(timerGuardar.current); guardarAhora(); } };
    window.addEventListener("pagehide", alSalir);
    return () => { window.removeEventListener("pagehide", alSalir); alSalir(); };
  }, [localKey]);

  const upsert = async (item) => {
    if (!firebaseListo || !db) return;
    try {
      await authReady;
      const payload = { ...item, _updatedAt: new Date().toISOString() };
      const id = item._docId || item.folio || item.id?.toString();
      if (id) await setDoc(doc(db, colName, String(id)), payload, { merge: true });
    } catch (e) { console.error(`Error guardando en ${colName}:`, e.message); }
  };

  // Borrado "suave": marca el documento para que todos los equipos lo quiten
  const remove = async (docId) => {
    setData((prev) => (prev || []).filter((it) => claveDe(it) !== String(docId)));
    if (!firebaseListo || !db) return;
    try {
      await authReady;
      await setDoc(doc(db, colName, String(docId)),
        { _deleted: true, _updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.error(`Error eliminando en ${colName}:`, e.message); }
  };

  return { data, setData, loading: false, nube, upsert, remove };
}
