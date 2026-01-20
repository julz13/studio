'use client';
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';

import { firebaseConfig } from './config';

let firestoreInstance: Firestore | null = null;
let persistenceEnabled = false;

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  const firebaseApp = !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp();
  const auth = getAuth(firebaseApp);
  
  if (!firestoreInstance) {
    const db = getFirestore(firebaseApp);
    if (!persistenceEnabled) {
      try {
        // This will fail on subsequent hot reloads in dev, but that's okay.
        enableIndexedDbPersistence(db).then(() => {
          persistenceEnabled = true;
        }).catch((err) => {
          if (err.code === 'failed-precondition') {
            // This error is expected and can be ignored if multiple tabs are open.
            // It means persistence is already enabled.
          } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence is not available in this browser.');
          }
        });
      } catch (e) {
        console.error("Failed to enable persistence", e);
      }
    }
    firestoreInstance = db;
  }

  return { firebaseApp, auth, firestore: firestoreInstance };
}

export * from './provider';
export * from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';