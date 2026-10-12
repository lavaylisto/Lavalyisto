import { initializeApp } from "firebase/app";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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

// 🧹 Borra (una sola vez por equipo) la caché vieja de Firestore en IndexedDB, que se dañaba y provocaba
// "FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state". Ya no se usa: la app guarda su propia copia en localStorage.
try {
  if (typeof window !== "undefined" && window.indexedDB && !localStorage.getItem("ll_cache_fs_limpia_v1")) {
    const marcar = () => { try { localStorage.setItem("ll_cache_fs_limpia_v1", "1"); } catch {} };
    if (indexedDB.databases) {
      indexedDB.databases().then((dbs) => {
        (dbs || []).filter((d) => d && d.name && /firestore/i.test(d.name)).forEach((d) => { try { indexedDB.deleteDatabase(d.name); } catch {} });
        marcar();
      }).catch(marcar);
    } else {
      marcar();
    }
  }
} catch {}

let _db = null;
let _storage = null; // 📷 Fotos de tareas (inventarios, evidencias) — mismo proyecto de Firebase, servicio Storage
let _authReady = Promise.resolve(); // 🔒 se resuelve cuando ya se autenticó (anónimamente) contra Firebase
if (firebaseListo) {
  try {
    const app = initializeApp(firebaseConfig);
    // 🔧 Caché en MEMORIA (antes: persistentLocalCache en IndexedDB). La caché en IndexedDB se dañaba con varias
    // pestañas abiertas o con poco espacio en el equipo, y Firestore dejaba de guardar. Sin internet, los cambios
    // quedan en cola mientras la pestaña siga abierta, y la app conserva su copia local en localStorage.
    _db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
    _storage = getStorage(app);
    // 🔒 SEGURIDAD: nos autenticamos de forma anónima automáticamente (sin pedirle nada a nadie).
    // Esto permite exigir en las reglas de Firestore "solo si el usuario está autenticado",
    // bloqueando así cualquier acceso directo a la base de datos desde fuera de esta app.
    const auth = getAuth(app);
    _authReady = new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) { resolve(user); return; }
        signInAnonymously(auth).catch((e) => console.error("No se pudo autenticar:", e.message));
      });
    });
  } catch (e) {
    console.error("Firebase no pudo inicializarse:", e);
  }
} else {
  console.warn("⚠️ Firebase sin credenciales — la app funciona solo con datos locales (localStorage).");
}

export const db = _db;
export const storage = _storage;
export const authReady = _authReady;
