import { useState, useEffect } from "react";
import { db, firebaseListo, authReady } from "../firebase";
import {
  collection, onSnapshot, setDoc, doc, query, where,
} from "firebase/firestore";

// Hook local-first con SINCRONIZACIÓN INCREMENTAL.
// - Al abrir la app usa la copia guardada en este equipo (localStorage) al instante.
// - A Firebase solo le pide los documentos que CAMBIARON desde la última sincronización
//   confirmada por el servidor (campo _updatedAt), en tiempo real.
// - Si un equipo no tiene marca de sincronización, descarga todo UNA sola vez.
// - Los borrados se marcan con _deleted:true para que los otros equipos se enteren.

const MARGEN_MS = 10 * 60 * 1000; // 10 min de margen por relojes desfasados entre equipos

const claveDe = (it) =>
  it == null ? null : String(it._docId ?? it.folio ?? it.id ?? "");

const leerLocal = (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
};

const visibles = (arr) => (arr || []).filter((x) => !x || !x._deleted);

export function useCollection(colName, localKey, defaultVal = []) {
  // v2: la marca de sincronización SOLO se guarda con datos confirmados por el servidor
  const syncKey = localKey + "__sync2";
  const [data, setData] = useState(() => visibles(leerLocal(localKey, defaultVal)));
  const [nube, setNube] = useState(false);

  useEffect(() => {
    if (!firebaseListo || !db) return;
    let unsub = () => {};
    let cancelado = false;

    authReady.then(() => {
      if (cancelado) return;
      let ultimo = null;
      try { ultimo = localStorage.getItem(syncKey); } catch {}
      const copia = (() => { try { return JSON.parse(localStorage.getItem(localKey)); } catch { return null; } })();
      const tieneCopia = Array.isArray(copia) && copia.length > 0;

      let q;
      let completa = false;
      if (ultimo && tieneCopia) {
        const desde = new Date(new Date(ultimo).getTime() - MARGEN_MS).toISOString();
        q = query(collection(db, colName), where("_updatedAt", ">", desde));
      } else {
        q = query(collection(db, colName)); // sin marca confirmada: descarga completa una vez
        completa = true;
      }

      unsub = onSnapshot(q, (snap) => {
        setNube(true);
        const delServidor = !snap.metadata.fromCache;
        let maxTs = ultimo || "";
        const cambios = [];
        snap.docChanges().forEach((ch) => {
          if (ch.type === "removed" && !completa) return; // salió del filtro, no es un borrado
          const d = { ...ch.doc.data(), _docId: ch.doc.id };
          if (ch.type === "removed") d._deleted = true;
          if (delServidor && !ch.doc.metadata.hasPendingWrites && d._updatedAt && d._updatedAt > maxTs) maxTs = d._updatedAt;
          cambios.push(d);
        });

        if (completa) {
          const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
          if (delServidor) docs.forEach((d) => { if (d._updatedAt && d._updatedAt > maxTs) maxTs = d._updatedAt; });
          setData((prev) => {
            // Se conserva lo creado en este equipo que todavía no llegó a la nube (sin _docId)
            const enServidor = new Set(docs.map(claveDe));
            const soloLocales = (prev || []).filter((it) => it && !it._docId && !enServidor.has(claveDe(it)));
            const lista = [...visibles(docs), ...soloLocales];
            try { localStorage.setItem(localKey, JSON.stringify(lista)); } catch {}
            return lista;
          });
        } else if (cambios.length) {
          setData((prev) => {
            const mapa = new Map();
            const sinClave = [];
            (prev || []).forEach((it) => { const k = claveDe(it); k ? mapa.set(k, it) : sinClave.push(it); });
            cambios.forEach((c) => {
              const k = claveDe(c);
              if (c._deleted) mapa.delete(k);
              else mapa.set(k, { ...(mapa.get(k) || {}), ...c });
            });
            const lista = [...mapa.values(), ...sinClave];
            try { localStorage.setItem(localKey, JSON.stringify(lista)); } catch {}
            return lista;
          });
        }

        // ☁️ La marca solo avanza con datos que vinieron del servidor
        if (delServidor) {
          if (!maxTs) maxTs = ultimo || new Date().toISOString();
          ultimo = maxTs;
          try { localStorage.setItem(syncKey, maxTs); } catch {}
          completa = false;
        }
      }, (err) => {
        console.error(`Firestore [${colName}]:`, err.message);
      });
    });

    return () => { cancelado = true; unsub(); };
  }, [colName, localKey]);

  // Respaldar en localStorage cada cambio local (aunque no haya nube)
  useEffect(() => {
    try { localStorage.setItem(localKey, JSON.stringify(data)); } catch {}
  }, [data, localKey]);

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
