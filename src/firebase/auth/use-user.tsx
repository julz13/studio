'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { useAuth } from '../provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
      } else {
        // If no user is signed in, sign in anonymously.
        signInAnonymously(auth)
          .then((userCredential) => {
            setUser(userCredential.user);
            setLoading(false);
          })
          .catch((error) => {
            console.error("Anonymous sign-in failed:", error);
            setLoading(false);
          });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
