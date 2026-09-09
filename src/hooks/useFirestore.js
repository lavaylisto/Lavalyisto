import { useState, useEffect } from "react";
import { db, firebaseListo } from "../firebase";
import {
  collection, onSnapshot, setDoc, deleteDoc, doc, query,
} from "firebase/firestore";
// Hook local-first: siempre lee/escribe localStorage al instante,
// y si Firebase está configurado, sincroniza en la nube EN TIEMPO REAL —
// un cambio en la tablet aparece solo en la computadora (y viceversa), sin refrescar.
export function useCollection(colName, localKey, defaultVal = []) {
  const [data, setData] = useState(() => {
    try {
      const v = localStorage.getItem(localKey);
      return v ? JSON.parse(v) : defaultVal;
    } catch { return defaultVal; }
  });
  const [nube, setNube] = useState(false); // true cuando llegó el primer snapshot
  useEffect(() => {
    if (!firebaseListo || !db) return;
    // 🔧 FIX 1: se quitó el orderBy("_updatedAt") — Firestore EXCLUYE de los resultados cualquier
    // documento que no tenga ese campo (ej. datos viejos, o editados a mano en la consola de Firebase).
    // Sin orderBy en la consulta, ningún documento se pierde. Si se necesita orden, se ordena en el
    // propio código de App.tsx (ya se hace en varios reportes con .sort()).
    const q = query(collection(db, colName));
    const unsub = onSnapshot(q, (snap) => {
      setNube(true);
      // 🔧 FIX 2: antes, si la colección quedaba vacía (ej. se borraron todos los documentos),
      // el "if (!snap.empty)" hacía que la pantalla se quedara con los datos VIEJOS para siempre,
      // hasta refrescar la página. Ahora se actualiza siempre, incluso a una lista vacía.
      const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
      setData(docs);
      try { localStorage.setItem(localKey, JSON.stringify(docs)); } catch {}
    }, (err) => {
      console.error(`Firestore [${colName}]:`, err.message);
    });
    return unsub;
  }, [colName, localKey]);
  // Respaldar en localStorage cada cambio local (aunque no haya nube)
  useEffect(() => {
    try { localStorage.setItem(localKey, JSON.stringify(data)); } catch {}
  }, [data, localKey]);
  const upsert = async (item) => {
    if (!firebaseListo || !db) return;
    try {
      const ts = new Date().toISOString();
      const payload = { ...item, _updatedAt: ts };
      const id = item._docId || item.folio || item.id?.toString();
      if (id) {
        await setDoc(doc(db, colName, String(id)), payload, { merge: true });
      }
    } catch (e) { console.error(`Error guardando en ${colName}:`, e.message); }
  };
  const remove = async (docId) => {
    if (!firebaseListo || !db) return;
    try { await deleteDoc(doc(db, colName, String(docId))); }
    catch (e) { console.error(`Error eliminando en ${colName}:`, e.message); }
  };
  return { data, setData, loading: false, nube, upsert, remove };
}
