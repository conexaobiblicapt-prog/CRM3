// ═══════════════════════════════════════════════════════════════
// Firebase — CRM Dra. Ilza Ezequiel
// Preencha com os dados do seu projeto Firebase
// Console: https://console.firebase.google.com
// ═══════════════════════════════════════════════════════════════
import { initializeApp }        from "firebase/app";
import { getFirestore,
         collection, addDoc, getDocs, deleteDoc,
         doc, setDoc, updateDoc, getDoc,
         serverTimestamp, onSnapshot,
         query, orderBy, where, limit }   from "firebase/firestore";
import { getDatabase, ref, push,
         onValue, set, update,
         remove, off,
         serverTimestamp as dbTs }        from "firebase/database";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         signOut, onAuthStateChanged }    from "firebase/auth";
import { getStorage, ref as sRef,
         uploadBytesResumable,
         getDownloadURL }                 from "firebase/storage";

// ▼▼▼  COLE AQUI OS DADOS DO SEU PROJETO FIREBASE  ▼▼▼
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY            || "SUA_API_KEY",
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN        || "SEU_PROJETO.firebaseapp.com",
  databaseURL:       import.meta.env.VITE_FB_DATABASE_URL       || "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId:         import.meta.env.VITE_FB_PROJECT_ID         || "SEU_PROJETO",
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET     || "SEU_PROJETO.appspot.com",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || "SEU_SENDER_ID",
  appId:             import.meta.env.VITE_FB_APP_ID             || "SEU_APP_ID",
};

const configured = !firebaseConfig.apiKey.startsWith("SUA_");

export const app     = configured ? initializeApp(firebaseConfig) : null;
export const db      = configured ? getFirestore(app)  : null;
export const rtdb    = configured ? getDatabase(app)   : null;
export const auth    = configured ? getAuth(app)       : null;
export const storage = configured ? getStorage(app)    : null;

export { configured };

// Firestore helpers
export { collection, addDoc, getDocs, deleteDoc, doc,
         setDoc, updateDoc, getDoc,
         serverTimestamp, onSnapshot, query, orderBy, where, limit };

// Realtime DB helpers
export { ref, push, onValue, set, update, remove, off, dbTs };

// Auth helpers
export { signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, onAuthStateChanged };

// Storage helpers
export { sRef, uploadBytesResumable, getDownloadURL };

console.log("[Firebase CRM]", configured ? "✅ ATIVO" : "⚠️ Demo — configure .env");
