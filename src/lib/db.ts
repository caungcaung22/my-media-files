/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, addDoc, onSnapshot, 
  query, deleteDoc, getDocs, updateDoc, where, writeBatch,
  DocumentData, QuerySnapshot, runTransaction
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';

export const appId = 'interior-finance-v3-stable';

let app: any = null;
let db: any = null;
let auth: any = null;
let firebaseEnabled = false;

// Attempt to load from window injected configuration
try {
  const metaConfigElement = document.getElementById('__firebase_config');
  let configObj: any = null;
  
  if (metaConfigElement && metaConfigElement.textContent) {
    configObj = JSON.parse(metaConfigElement.textContent);
  } else if ((window as any).__firebase_config) {
    const rawConfig = (window as any).__firebase_config;
    configObj = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
  }

  if (configObj && configObj.apiKey && configObj.projectId) {
    app = initializeApp(configObj);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseEnabled = true;
    console.log("Firebase Client Engine Initialized successfully.");
    
    // Validate connection offline guard
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error?.message?.includes('the client is offline')) {
          console.warn("Firebase reported client is offline fallback mode active.");
        }
      }
    };
    testConnection();
  } else {
    console.warn("No persistent Firebase configuration injected. Falling back to local offline storage mode.");
  }
} catch (e) {
  console.error("Error setting up Firebase client connection:", e);
}

export { db, auth, firebaseEnabled };

// --- Storage Fallback Logic For LocalPersistence ---
const getLocal = (key: string): any[] => {
  try {
    const val = localStorage.getItem(`intfin_${key}`);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
};

const saveLocal = (key: string, data: any[]) => {
  try {
    localStorage.setItem(`intfin_${key}`, JSON.stringify(data));
    // Trigger window event to notify other components/listeners
    window.dispatchEvent(new CustomEvent(`intfin_update_${key}`, { detail: data }));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
};

// Listeners collection for simulated subscription queries in offline mode
const listeners: { [key: string]: Array<(data: any[]) => void> } = {};

export const subscribeCollection = (collectionName: string, callback: (data: any[]) => void) => {
  if (firebaseEnabled && db) {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', collectionName));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error(`Subscription error for ${collectionName}:`, err);
    });
  } else {
    // Local persistence listener
    const initialData = getLocal(collectionName);
    callback(initialData);

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      callback(customEvent.detail);
    };

    window.addEventListener(`intfin_update_${collectionName}`, handler);
    return () => {
      window.removeEventListener(`intfin_update_${collectionName}`, handler);
    };
  }
};

export const subscribeDoc = (collectionName: string, docId: string, callback: (data: any) => void) => {
  if (firebaseEnabled && db) {
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId), (d) => {
      callback(d.exists() ? d.data() : null);
    });
  } else {
    const updateHandler = () => {
      const items = getLocal(collectionName);
      const found = items.find(it => it.id === docId);
      callback(found || null);
    };
    window.addEventListener(`intfin_update_${collectionName}`, updateHandler);
    updateHandler();
    return () => window.removeEventListener(`intfin_update_${collectionName}`, updateHandler);
  }
};

// --- CRUD Wrapper Helpers ---

export const saveDocument = async (collectionName: string, id: string | null, data: any) => {
  if (firebaseEnabled && db) {
    if (id) {
       await setDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id), data, { merge: true });
       return id;
    } else {
       const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), data);
       return docRef.id;
    }
  } else {
    // Offline LocalStorage model
    const items = getLocal(collectionName);
    const finalId = id || Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    
    if (id) {
       const idx = items.findIndex(it => it.id === id);
       if (idx !== -1) {
          items[idx] = { ...items[idx], ...data, id: finalId, updatedAt: now };
       } else {
          items.push({ ...data, id: finalId, timestamp: now });
       }
    } else {
       items.push({ ...data, id: finalId, timestamp: now });
    }
    saveLocal(collectionName, items);
    return finalId;
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  if (firebaseEnabled && db) {
    const basePath = ['artifacts', appId, 'public', 'data', collectionName, id];
    await deleteDoc(doc(db, ...basePath));
  } else {
    const items = getLocal(collectionName);
    const filtered = items.filter(it => it.id !== id);
    saveLocal(collectionName, filtered);
  }
};

// Atomically wipe multiple items or execute batch writes
export const bulkDeleteDocuments = async (collectionName: string, ids: string[]) => {
  if (firebaseEnabled && db) {
    let batch = writeBatch(db);
    let count = 0;
    for (const id of ids) {
       batch.delete(doc(db, 'artifacts', appId, 'public', 'data', collectionName, id));
       count++;
       if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
       }
    }
    if (count > 0) await batch.commit();
  } else {
    const items = getLocal(collectionName);
    const filtered = items.filter(it => !ids.includes(it.id));
    saveLocal(collectionName, filtered);
  }
};

export const bulkSaveDocuments = async (collectionName: string, itemsToSave: any[]) => {
  if (firebaseEnabled && db) {
    let batch = writeBatch(db);
    let count = 0;
    for (const item of itemsToSave) {
       const uId = item.id || doc(collection(db, 'artifacts', appId, 'public', 'data', collectionName)).id;
       const payload = { ...item };
       delete payload.id;
       batch.set(doc(db, 'artifacts', appId, 'public', 'data', collectionName, uId), payload, { merge: true });
       count++;
       if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
       }
    }
    if (count > 0) await batch.commit();
  } else {
    const items = getLocal(collectionName);
    const now = new Date().toISOString();
    itemsToSave.forEach(it => {
       const uId = it.id || Math.random().toString(36).substring(2, 11);
       const idx = items.findIndex(old => old.id === uId);
       if (idx !== -1) {
          items[idx] = { ...items[idx], ...it, id: uId, updatedAt: now };
       } else {
          items.push({ ...it, id: uId, timestamp: now });
       }
    });
    saveLocal(collectionName, items);
  }
};
