'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';

interface DateContextType {
  date: Date;
  setDate: (date: Date) => void;
  formattedDate: string;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState<Date | null>(null);

  // Set the initial date on the client-side to avoid hydration mismatch
  useEffect(() => {
    setDate(new Date());
  }, []);

  const formattedDate = useMemo(() => (date ? format(date, 'yyyy-MM-dd') : ''), [date]);

  // Render a loading state or null until the date is set on the client
  if (!date) {
    return null;
  }

  return (
    <DateContext.Provider value={{ date, setDate, formattedDate }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
}
