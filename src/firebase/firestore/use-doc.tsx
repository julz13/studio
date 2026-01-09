'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type DocumentReference,
  getDoc,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type Options = {
  listen?: boolean;
};

export function useDoc<T>(
  ref: DocumentReference | undefined,
  options: Options = { listen: true },
) {
  // undefined: initial state, not yet loaded
  // null: document does not exist
  // T: document exists
  const [data, setData] = useState<T | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);

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
        setData(null);
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
          setData(null);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, options.listen]);

  return { data, loading };
}
