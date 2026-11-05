import { useState, useEffect } from "react";
import { db, firebaseListo, authReady } from "../firebase";
import {
  collection, onSnapshot, setDoc, doc, query, where,
} from "firebase/firestore";

// Hook local-first con SINCRONIZACIÓN INCREMENTAL.
// - Al abrir la app usa la copia guardada en este equipo (localStorage) al instante.
// - A Firebase solo le pide los documentos que CAMBIARON desde la última sincronización
//   (campo _updatedAt), en tiempo real. Antes descargaba TODA la colección en cada apertura
//   o recarga (≈200k lecturas/día → se pasaba del límite gratis de 50k).
// - Si un equipo no tiene copia local (primera vez), descarga todo UNA sola vez.
// - Los borrados se marcan con _deleted:true (en vez de borrar el documento) para que
//   los otros equipos se enteren; la app nunca ve los marcados.

const MARGEN_MS = 10 * 60 * 1000; // 10 min de margen por relojes desfasados entre equipos

const claveDe = (it) =>
  it == null ? null : String(it._docId ?? it.folio ?? it.id ?? "");

const leerLocal = (key, def) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
};

const visibles = (arr) => (arr || []).filter((x) => !x || !x._deleted);

export function useCollection(colName, localKey, defaultVal = []) {
  const syncKey = localKey + "__sync";
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
      // Primera vez con esta versión: si el equipo ya tiene copia local, arranca desde el cambio
      // más reciente de esa copia (así NO vuelve a descargar todo).
      if (!ultimo && tieneCopia) {
        const max = copia.reduce((m, x) => (x && x._updatedAt && x._updatedAt > m ? x._updatedAt : m), "");
        if (max) ultimo = max;
      }

      let q;
      let completa = false;
      if (ultimo && tieneCopia) {
        const desde = new Date(new Date(ultimo).getTime() - MARGEN_MS).toISOString();
        q = query(collection(db, colName), where("_updatedAt", ">", desde));
      } else {
        q = query(collection(db, colName)); // primera vez en este equipo: descarga completa
        completa = true;
      }

      unsub = onSnapshot(q, (snap) => {
        setNube(true);
        let maxTs = ultimo || "";
        const cambios = [];
        snap.docChanges().forEach((ch) => {
          if (ch.type === "removed" && !completa) return; // salió del filtro, no es un borrado
          const d = { ...ch.doc.data(), _docId: ch.doc.id };
          if (ch.type === "removed") d._deleted = true;
          if (d._updatedAt && d._updatedAt > maxTs) maxTs = d._updatedAt;
          cambios.push(d);
        });

        if (completa) {
          // Descarga completa: el resultado ES la colección
          const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
          docs.forEach((d) => { if (d._updatedAt && d._updatedAt > maxTs) maxTs = d._updatedAt; });
          const lista = visibles(docs);
          setData(lista);
          try { localStorage.setItem(localKey, JSON.stringify(lista)); } catch {}
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

        if (!maxTs) maxTs = new Date().toISOString();
        ultimo = maxTs;
        try { localStorage.setItem(syncKey, maxTs); } catch {}
        completa = false; // los siguientes snapshots ya son incrementales
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
