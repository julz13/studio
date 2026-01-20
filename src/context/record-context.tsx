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
import { format, subDays } from 'date-fns';
import { useDoc, useFirestore, useCollection } from '@/firebase';
import {
  doc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  collection,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// This function is the single source of truth for all calculations.
const recalculateTotals = (
  recordToCalc: DailyRecord | null | undefined
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
  importRecords: (importedRecords: { [date: string]: DailyRecord }) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { date, formattedDate } = useDate();
  const firestore = useFirestore();

  // Memoize the document reference for the currently selected date.
  const docRef = useMemo(() => {
    if (!user || !formattedDate) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, firestore, formattedDate]);

  // Fetch record for the currently selected date
  const { data: currentRecordData, loading: recordLoading } =
    useDoc<DailyRecord>(docRef);

  // Fetch yesterday's record specifically for the "Total Spent Yesterday" card
  const yesterdayDocRef = useMemo(() => {
    if (!user || !date) return undefined;
    const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');
    return doc(firestore, 'users', user.uid, 'records', yesterdayStr);
  }, [user, firestore, date]);
  const { data: yesterdayRecordData, loading: yesterdayRecordLoading } =
    useDoc<DailyRecord>(yesterdayDocRef);

  // Fetch the most recent record before the current date to ensure balance continuity
  const { data: lastRecords, loading: lastRecordLoading } =
    useCollection<DailyRecord>(
      user && formattedDate ? `users/${user.uid}/records` : '',
      {
        query: [
          where('date', '<', formattedDate),
          orderBy('date', 'desc'),
          limit(1),
        ],
        listen: true, // Listen for changes to the last record
      }
    );
  const lastAvailableRecordData = useMemo(
    () => (lastRecords && lastRecords.length > 0 ? lastRecords[0] : null),
    [lastRecords]
  );

  // The record that the UI will use, after calculations.
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [yesterdayRecord, setYesterdayRecord] = useState<DailyRecord | null>(
    null
  );
  const [isInitializing, setIsInitializing] = useState(true);

  // This effect is the core logic engine.
  useEffect(() => {
    // Combine all loading states
    if (
      recordLoading ||
      userLoading ||
      yesterdayRecordLoading ||
      lastRecordLoading
    ) {
      setIsInitializing(true);
      return;
    }
    if (!user || !formattedDate) {
      setRecord(null);
      setYesterdayRecord(null);
      setIsInitializing(false);
      return;
    }

    // Set state for yesterday's record for the UI card
    const calculatedYesterday = recalculateTotals(yesterdayRecordData);
    setYesterdayRecord(calculatedYesterday);

    const processRecord = () => {
      // If a record for today exists in Firestore, use it.
      if (currentRecordData) {
        setRecord(recalculateTotals(currentRecordData));
      } else {
        // If no record exists for today, create a new one.
        // Use the closing balance from the most recent available record.
        const lastAvailableRecord = recalculateTotals(lastAvailableRecordData);
        const openingBalances = lastAvailableRecord?.balances.closing || {
          account: 0,
          cash: 0,
        };

        const newRecord: DailyRecord = {
          date: formattedDate,
          balances: {
            opening: openingBalances,
            closing: {
              account: openingBalances.account,
              cash: openingBalances.cash,
            },
          },
          payments: [],
          totals: { totalSpent: 0, cashSpent: 0, accountSpent: 0 },
          metadata: { currency: 'INR' },
        };

        setRecord(newRecord);

        // Also save this new record to Firestore so it exists for the next time.
        if (docRef) {
          setDoc(docRef, newRecord).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'create',
              requestResourceData: newRecord,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        }
      }
      setIsInitializing(false);
    };

    processRecord();
  }, [
    currentRecordData,
    yesterdayRecordData,
    lastAvailableRecordData,
    recordLoading,
    userLoading,
    yesterdayRecordLoading,
    lastRecordLoading,
    user,
    formattedDate,
    firestore,
    docRef,
  ]);

  const saveRecord = useCallback(
    (newRecordData: DailyRecord) => {
      if (!docRef) return;
      const calculatedRecord = recalculateTotals(newRecordData);
      if (calculatedRecord) {
        // Optimistically update local state for instant UI feedback
        setRecord(calculatedRecord);
        // Persist to Firestore
        setDoc(docRef, calculatedRecord, { merge: true }).catch(
          async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: calculatedRecord,
            });
            errorEmitter.emit('permission-error', permissionError);
            // Optionally, revert optimistic update on error
          }
        );
      }
    },
    [docRef]
  );

  const importRecords = useCallback(
    async (importedRecords: { [date: string]: DailyRecord }) => {
      if (!user || !firestore) return;

      const batch = writeBatch(firestore);
      Object.entries(importedRecords).forEach(([dateKey, recordData]) => {
        const recordDocRef = doc(
          firestore,
          `users/${user.uid}/records/${dateKey}`
        );
        batch.set(recordDocRef, recordData, { merge: true });
      });

      try {
        await batch.commit();
      } catch (e) {
        const permissionError = new FirestorePermissionError({
          path: `users/${user.uid}/records`,
          operation: 'write', // Batch write is a 'write' operation
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    },
    [user, firestore]
  );

  const isLoading = userLoading || isInitializing;

  const value = useMemo(
    () => ({
      record,
      yesterdayRecord: yesterdayRecord,
      loading: isLoading,
      saveRecord,
      importRecords,
    }),
    [record, yesterdayRecord, isLoading, saveRecord, importRecords]
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
