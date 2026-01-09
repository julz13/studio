'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  collection,
  query,
  getDocs,
  type Query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type Options = {
  listen?: boolean;
  query?: QueryConstraint[];
};

export function useCollection<T>(
  path: string,
  options: Options = { listen: true },
) {
  const db = useFirestore();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData([]);
      return;
    }

    const collectionRef = collection(db, path);
    const q = options.query
      ? query(collectionRef, ...options.query)
      : collectionRef;

    async function getDocuments() {
      try {
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as T,
        );
        setData(data);
      } catch (e: any) {
        console.error(e);
         const permissionError = new FirestorePermissionError({
          path: q.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
      } finally {
        setLoading(false);
      }
    }

    let unsubscribe: () => void;

    if (options.listen) {
      unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const data = querySnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as T,
          );
          setData(data);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          const permissionError = new FirestorePermissionError({
            path: q.path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setLoading(false);
        },
      );
    } else {
      getDocuments();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [path, db, options.listen, options.query]);

  return { data, loading };
}
