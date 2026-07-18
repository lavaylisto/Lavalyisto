import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// ============================================================
// OPCIÓN A (recomendada): variables de entorno
//   - Local: archivo .env en la raíz del proyecto (ver .env.example)
//   - Vercel: Settings → Environment Variables (mismos nombres VITE_...)
// OPCIÓN B: pegar la configuración directamente aquí abajo
//   (reemplaza los null por los valores de tu consola Firebase)
// ============================================================
const CONFIG_MANUAL = {
  apiKey: null,            // "AIza..."
  authDomain: null,        // "tu-proyecto.firebaseapp.com"
  projectId: null,         // "tu-proyecto"
  storageBucket: null,     // "tu-proyecto.appspot.com"
  messagingSenderId: null, // "123456789"
  appId: null,             // "1:123:web:abc"
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || CONFIG_MANUAL.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || CONFIG_MANUAL.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || CONFIG_MANUAL.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || CONFIG_MANUAL.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || CONFIG_MANUAL.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || CONFIG_MANUAL.appId,
};

export const firebaseListo = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let _db = null;
if (firebaseListo) {
  try {
    const app = initializeApp(firebaseConfig);
    // Caché offline persistente: la app funciona sin internet y sincroniza al volver la conexión
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.error("Firebase no pudo inicializarse:", e);
  }
} else {
  console.warn("⚠️ Firebase sin credenciales — la app funciona solo con datos locales (localStorage).");
}

export const db = _db;
