'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useAuth } from '../provider';
import { usePathname, useRouter } from 'next/navigation';

const AUTH_PAGES = ['/login', '/register'];

export function useUser() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (AUTH_PAGES.includes(pathname)) {
          router.replace('/');
        }
      } else {
        setUser(null);
        if (!AUTH_PAGES.includes(pathname)) {
          router.replace('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, pathname]);

  return { user, loading };
}
