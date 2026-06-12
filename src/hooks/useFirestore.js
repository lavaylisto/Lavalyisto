import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection, onSnapshot, setDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";

export function useCollection(colName, localKey, defaultVal = []) {
  const [data, setData] = useState(() => {
    try {
      const v = localStorage.getItem(localKey);
      return v ? JSON.parse(v) : defaultVal;
    } catch { return defaultVal; }
  });

  useEffect(() => {
    const q = query(collection(db, colName), orderBy("_updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map((d) => ({ ...d.data(), _docId: d.id }));
        setData(docs);
        try { localStorage.setItem(localKey, JSON.stringify(docs)); } catch {}
      }
    });
    return unsub;
  }, [colName, localKey]);

  const upsert = async (item) => {
    const ts = new Date().toISOString();
    const payload = { ...item, _updatedAt: ts };
    const id = item._docId || item.folio || item.id?.toString();
    if (id) {
      await setDoc(doc(db, colName, String(id)), payload, { merge: true });
    }
  };

  const remove = async (docId) => {
    await deleteDoc(doc(db, colName, String(docId)));
  };

  return { data, setData, loading: false, upsert, remove };
}
