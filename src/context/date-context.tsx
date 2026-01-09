'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { format } from 'date-fns';

interface DateContextType {
  date: Date;
  setDate: (date: Date) => void;
  formattedDate: string;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState<Date>(new Date());
  const formattedDate = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);

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
