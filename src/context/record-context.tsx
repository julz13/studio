'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord } from '@/lib/types';
import { useDate } from './date-context';
import { useUser } from '@/firebase/auth/use-user';
import { format, subDays } from 'date-fns';

const recalculateTotals = (recordToCalc: DailyRecord | null): DailyRecord | null => {
  if (!recordToCalc) return null;

  const cashSpent = recordToCalc.payments
    .filter((p) => p.paymentMode === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);
  const accountSpent = recordToCalc.payments
    .filter((p) => p.paymentMode !== 'Cash' && p.category !== 'Withdrawal')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalSpent = cashSpent + accountSpent;

  const totalWithdrawals = recordToCalc.payments
    .filter((p) => p.category === 'Withdrawal')
    .reduce((sum, p) => sum + p.amount, 0);

  const closingAccount =
    recordToCalc.balances.opening.account - accountSpent - totalWithdrawals;
  const closingCash =
    recordToCalc.balances.opening.cash + totalWithdrawals - cashSpent;

  return {
    ...recordToCalc,
    totals: {
      totalSpent,
      cashSpent,
      accountSpent,
    },
    balances: {
      ...recordToCalc.balances,
      closing: {
        account: closingAccount,
        cash: closingCash,
      },
    },
  };
};

const getRecordFromStorage = (key: string): DailyRecord | null => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const saveRecordToStorage = (key: string, record: DailyRecord) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(record));
};


interface RecordContextType {
  record: DailyRecord | null;
  loading: boolean;
  saveRecord: (newRecord: DailyRecord) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { formattedDate } = useDate();
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const storageKey = useMemo(() => {
    if (!user || !formattedDate) return '';
    return `financeflow-record-${user.uid}-${formattedDate}`;
  }, [user, formattedDate]);

  useEffect(() => {
    if (userLoading || !storageKey) {
        setLoading(true);
        return;
    };
    
    setLoading(true);

    const existingRecord = getRecordFromStorage(storageKey);

    if (existingRecord) {
        setRecord(existingRecord);
    } else {
        // Initialize a new record if one doesn't exist
        const yesterdayStr = format(subDays(new Date(formattedDate), 1), 'yyyy-MM-dd');
        const yesterdayKey = user ? `financeflow-record-${user.uid}-${yesterdayStr}` : '';
        const yesterdayRecordRaw = yesterdayKey ? getRecordFromStorage(yesterdayKey) : null;
        
        let openingBalances = { account: 0, cash: 0 };
        if (yesterdayRecordRaw) {
             const calculatedYesterday = recalculateTotals(yesterdayRecordRaw);
             if (calculatedYesterday) {
                openingBalances = calculatedYesterday.balances.closing;
             }
        }
        
        const newRecord: DailyRecord = {
            date: formattedDate,
            balances: {
              opening: openingBalances,
              closing: { account: 0, cash: 0 }, 
            },
            payments: [],
            totals: { totalSpent: 0, cashSpent: 0, accountSpent: 0 },
            metadata: { currency: "INR" },
        };

        const finalNewRecord = recalculateTotals(newRecord)!;
        setRecord(finalNewRecord);
        saveRecordToStorage(storageKey, finalNewRecord);
    }

    setLoading(false);

  }, [storageKey, userLoading, formattedDate, user]);

  const saveRecord = useCallback((newRecordData: DailyRecord) => {
    if (!storageKey) return;
    
    const calculatedRecord = recalculateTotals(newRecordData);
    if(calculatedRecord) {
        setRecord(calculatedRecord);
        saveRecordToStorage(storageKey, calculatedRecord);
    }
  }, [storageKey]);

  const value = useMemo(() => ({
      record,
      loading,
      saveRecord
  }), [record, loading, saveRecord]);


  return (
    <RecordContext.Provider value={value}>
      {children}
    </RecordContext.Provider>
  );
}

export function useRecord() {
  const context = useContext(RecordContext);
  if (context === undefined) {
    throw new Error('useRecord must be used within a RecordProvider');
  }
  return context;
}
