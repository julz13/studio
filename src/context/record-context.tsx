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
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
  loading: boolean;
  saveRecord: (newRecord: DailyRecord) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { formattedDate } = useDate();
  const firestore = useFirestore();

  // Create a memoized reference to the Firestore document.
  // This ref only changes when the user or date changes.
  const recordRef = useMemoFirebase(() => {
    if (!user || !formattedDate) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, formattedDate, firestore]);

  // useDoc provides real-time, cached-first data from Firestore.
  // It handles offline state automatically.
  const { data: recordData, loading: recordLoading } = useDoc<DailyRecord>(recordRef, { listen: true });

  const isLoading = userLoading || recordLoading;

  // This effect runs ONLY when a new record needs to be created.
  useEffect(() => {
    // Wait for loading to finish and confirm no record exists.
    if (isLoading || recordData !== null) {
      return;
    }

    const createNewRecord = async () => {
      if (!user || !formattedDate || !firestore) return;

      // Get yesterday's record to calculate opening balance.
      const yesterdayStr = format(subDays(parseISO(formattedDate), 1), 'yyyy-MM-dd');
      const yesterdayRef = doc(firestore, 'users', user.uid, 'records', yesterdayStr);
      
      let openingBalances = { account: 0, cash: 0 };
      
      try {
        const yesterdayDoc = await getDoc(yesterdayRef);
        if (yesterdayDoc.exists()) {
          const yesterdayRecordRaw = yesterdayDoc.data() as DailyRecord;
          // IMPORTANT: Recalculate yesterday's totals to get the correct closing balance.
          const calculatedYesterday = recalculateTotals(yesterdayRecordRaw);
          if (calculatedYesterday) {
            openingBalances = calculatedYesterday.balances.closing;
          }
        }
      } catch (e) {
          console.error("Error fetching yesterday's record:", e)
      }


      const newRecord: DailyRecord = {
        date: formattedDate,
        balances: {
          opening: openingBalances,
          // Closing balances will be calculated by recalculateTotals
          closing: { account: openingBalances.account, cash: openingBalances.cash },
        },
        payments: [],
        totals: { totalSpent: 0, cashSpent: 0, accountSpent: 0 },
        metadata: { currency: 'INR' },
      };

      // Save the newly created record to Firestore.
      // The useDoc listener will automatically pick up this change.
      await setDoc(recordRef, newRecord);
    };

    createNewRecord();
  }, [isLoading, recordData, user, formattedDate, firestore, recordRef]);

  // The save function that components will use.
  const saveRecord = useCallback(
    (newRecordData: DailyRecord) => {
      if (!recordRef) return;
      // Always run recalculate before saving to ensure data integrity.
      const calculatedRecord = recalculateTotals(newRecordData);
      if (calculatedRecord) {
        setDoc(recordRef, calculatedRecord, { merge: true });
      }
    },
    [recordRef]
  );

  // The value exposed to the rest of the app.
  const value = useMemo(
    () => ({
      // Always provide the recalculated record to the UI.
      record: recalculateTotals(recordData as DailyRecord | null),
      loading: isLoading,
      saveRecord,
    }),
    [recordData, isLoading, saveRecord]
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
