import { useState, useEffect } from "react";
import { db, firebaseListo } from "../firebase";
import {
  collection, onSnapshot, setDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";

// Hook local-first: siempre lee/escribe localStorage al instante,
// y si Firebase está configurado, sincroniza en la nube en segundo plano.
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
    const q = query(collection(db, colName), orderBy("_updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNube(true);
      if (!snap.empty) {
        const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
        setData(docs);
        try { localStorage.setItem(localKey, JSON.stringify(docs)); } catch {}
      }
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
