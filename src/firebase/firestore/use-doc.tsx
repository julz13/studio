'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  doc,
  getDoc,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type Options = {
  listen?: boolean;
};

export function useDoc<T>(
  path: string | DocumentReference,
  options: Options = { listen: true },
) {
  const db = useFirestore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }

    const ref = typeof path === 'string' ? doc(db, path) : path;

    async function getDocument() {
      try {
        const docSnap = await getDoc(ref);
        setData(docSnap.exists() ? (docSnap.data() as T) : null);
      } catch (e: any) {
        console.error(e);
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setLoading(false);
      }
    }

    let unsubscribe: () => void;

    if (options.listen) {
      unsubscribe = onSnapshot(
        ref,
        (doc) => {
          setData(doc.exists() ? (doc.data() as T) : null);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          const permissionError = new FirestorePermissionError({
            path: ref.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
          setLoading(false);
        },
      );
    } else {
      getDocument();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [path, db, options.listen]);

  return { data, loading };
}
