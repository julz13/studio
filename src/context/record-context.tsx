'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { DailyRecord } from '@/lib/types';
import { useDate } from './date-context';
import { useUser } from '@/firebase/auth/use-user';
import { format, subDays, parseISO } from 'date-fns';

// This function is the single source of truth for all calculations.
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
  yesterdayRecord: DailyRecord | null;
  loading: boolean;
  saveRecord: (newRecord: DailyRecord) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

// A wrapper to safely access localStorage on the client side.
const getLocalStorage = () => {
    if (typeof window !== 'undefined') {
        return window.localStorage;
    }
    return null;
}

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { formattedDate } = useDate();
  const [allRecords, setAllRecords] = useState<{ [date: string]: DailyRecord }>({});
  const [yesterdayRecord, setYesterdayRecord] = useState<DailyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Load all user records from localStorage when user changes
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const storage = getLocalStorage();
    if (storage) {
        const storedData = storage.getItem(`financeflow_records_${user.uid}`);
        if (storedData) {
            setAllRecords(JSON.parse(storedData));
        } else {
            setAllRecords({});
        }
    }
    setLoading(false);
  }, [user]);

  // Handle creating a new record for the selected date if it doesn't exist
  useEffect(() => {
    if (!user || userLoading || loading || !formattedDate) return;
    
    // Get yesterday's record to calculate opening balance and totals.
    const yesterdayStr = format(subDays(parseISO(formattedDate), 1), 'yyyy-MM-dd');
    const yesterdayRecordRaw = allRecords[yesterdayStr];
    
    if (yesterdayRecordRaw) {
        const calculatedYesterday = recalculateTotals(yesterdayRecordRaw);
        setYesterdayRecord(calculatedYesterday);
    } else {
        setYesterdayRecord(null);
    }

    if (!allRecords[formattedDate]) {
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
          closing: { account: openingBalances.account, cash: openingBalances.cash },
        },
        payments: [],
        totals: { totalSpent: 0, cashSpent: 0, accountSpent: 0 },
        metadata: { currency: 'INR' },
      };

      // Use a function for state update to get the latest state
      setAllRecords(prevRecords => {
          const updatedRecords = { ...prevRecords, [formattedDate]: newRecord };
          const storage = getLocalStorage();
          if (storage && user) {
              storage.setItem(`financeflow_records_${user.uid}`, JSON.stringify(updatedRecords));
          }
          return updatedRecords;
      });
    }
  }, [allRecords, formattedDate, user, userLoading, loading]);

  const saveRecord = useCallback(
    (newRecordData: DailyRecord) => {
      if (!user) return;
      
      const calculatedRecord = recalculateTotals(newRecordData);
      if (calculatedRecord) {
        const dateKey = calculatedRecord.date;
        
        setAllRecords(prevRecords => {
            const updatedRecords = { ...prevRecords, [dateKey]: calculatedRecord };
            const storage = getLocalStorage();
            if (storage && user) {
                storage.setItem(`financeflow_records_${user.uid}`, JSON.stringify(updatedRecords));
            }
            return updatedRecords;
        });
      }
    },
    [user]
  );
  
  const currentRecord = useMemo(() => {
      return recalculateTotals(allRecords[formattedDate] || null);
  }, [allRecords, formattedDate]);
  
  const isLoading = userLoading || loading;

  const value = useMemo(
    () => ({
      record: currentRecord,
      yesterdayRecord: yesterdayRecord,
      loading: isLoading,
      saveRecord,
    }),
    [currentRecord, yesterdayRecord, isLoading, saveRecord]
  );

  return (
    <RecordContext.Provider value={value}>{children}</RecordContext.Provider>
  );
}

export function useRecord() {
  const context = useContext(RecordContext);
  if (context === undefined) {
    throw new Error('useRecord must be used within a RecordProvider');
  }
  return context;
}
