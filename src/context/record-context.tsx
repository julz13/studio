'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord } from '@/lib/types';
import { useDate } from './date-context';
import { useUser } from '@/firebase/auth/use-user';
import { format, subDays } from 'date-fns';
import { mockDailyRecord } from '@/lib/data';

const recalculateTotals = (
  recordToCalc: DailyRecord | null
): DailyRecord | null => {
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


interface RecordContextType {
  record: DailyRecord | null;
  loading: boolean;
  saveRecord: (newRecord: DailyRecord) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { date, formattedDate } = useDate();
  
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const storageKey = useMemo(() => user ? `financeflow-data-${user.uid}` : null, [user]);

  const getRecordsFromStorage = useCallback(() => {
    if (!storageKey) return {};
    try {
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Could not parse records from localStorage", error);
      return {};
    }
  }, [storageKey]);
  
  const saveRecordsToStorage = useCallback((allRecords: { [date: string]: DailyRecord }) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(allRecords));
    } catch (error) {
       console.error("Could not save records to localStorage", error);
    }
  }, [storageKey]);
  

  useEffect(() => {
    if (userLoading || !storageKey || !date) {
      setLoading(true);
      return;
    }
    setLoading(true);
    
    const allRecords = getRecordsFromStorage();
    let currentRecordData = allRecords[formattedDate] || null;

    if (!currentRecordData) {
        const yesterday = subDays(date, 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        const yesterdayRecord = allRecords[yesterdayStr];
        
        let opening = { account: 0, cash: 0 };
        if (yesterdayRecord) {
            const calculatedYesterday = recalculateTotals(yesterdayRecord);
            if(calculatedYesterday) {
                opening = calculatedYesterday.balances.closing;
            }
        }
        
        const newRecord: DailyRecord = {
          ...mockDailyRecord,
          date: formattedDate,
          balances: {
            ...mockDailyRecord.balances,
            opening: opening,
          },
        };
        
        currentRecordData = recalculateTotals(newRecord);
        if (currentRecordData) {
            allRecords[formattedDate] = currentRecordData;
            saveRecordsToStorage(allRecords);
        }
    } 
    
    setRecord(recalculateTotals(currentRecordData));
    setLoading(false);

  }, [userLoading, storageKey, date, formattedDate, getRecordsFromStorage, saveRecordsToStorage]);
  
  const saveRecord = (newRecordData: DailyRecord) => {
    if (!storageKey) return;
    const allRecords = getRecordsFromStorage();
    const calculatedRecord = recalculateTotals(newRecordData);
    if(calculatedRecord){
        allRecords[formattedDate] = calculatedRecord;
        saveRecordsToStorage(allRecords);
        setRecord(calculatedRecord);
    }
  };


  return (
    <RecordContext.Provider value={{ record, loading, saveRecord }}>
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
