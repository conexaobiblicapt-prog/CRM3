// ═══════════════════════════════════════════════════════════════
// Firebase — CRM Dra. Ilza Ezequiel
// Projeto: crm-dra-ilza  |  Região: us-central1
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

// ─── Configuração real do projeto Firebase ───────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY            || "AIzaSyAGIzv6jlXIRwlDkhr9FXgmzYYSvs1HEW4",
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN        || "crm-dra-ilza.firebaseapp.com",
  databaseURL:       import.meta.env.VITE_FB_DATABASE_URL       || "https://crm-dra-ilza-default-rtdb.firebaseio.com",
  projectId:         import.meta.env.VITE_FB_PROJECT_ID         || "crm-dra-ilza",
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET     || "crm-dra-ilza.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || "391937930253",
  appId:             import.meta.env.VITE_FB_APP_ID             || "1:391937930253:web:e32204dc8c810e69ef5144",
};

// Firebase agora sempre configurado (credenciais reais acima)
const configured = true;

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const rtdb    = getDatabase(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

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

console.log("[Firebase CRM] ✅ Conectado ao projeto: crm-dra-ilza");
