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
import { useDoc, useFirestore } from '@/firebase';
import {
  doc,
  setDoc,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  importRecords: (importedRecords: { [date: string]: DailyRecord }) => void;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export function RecordProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const { formattedDate } = useDate();
  const firestore = useFirestore();

  // Memoize the document reference for the currently selected date.
  const docRef = useMemo(() => {
    if (!user || !formattedDate) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, firestore, formattedDate]);

  // Use the useDoc hook to get the current record. It will be null if it doesn't exist.
  const { data: currentRecordData, loading: recordLoading } = useDoc<DailyRecord>(docRef);
  
  // The record that the UI will use, after calculations.
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [yesterdayRecord, setYesterdayRecord] = useState<DailyRecord | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // This effect is the core logic engine.
  useEffect(() => {
    if (recordLoading || userLoading) {
      setIsInitializing(true);
      return;
    }
    if (!user || !formattedDate) {
      setRecord(null);
      setIsInitializing(false);
      return;
    }

    const processRecord = async () => {
      // If a record for today exists in Firestore, use it.
      if (currentRecordData) {
        setRecord(recalculateTotals(currentRecordData));
        const yesterdayStr = format(subDays(parseISO(formattedDate), 1), 'yyyy-MM-dd');
        const yesterdayDocRef = doc(firestore, 'users', user.uid, 'records', yesterdayStr);
        const yesterdaySnap = await getDoc(yesterdayDocRef);
        if (yesterdaySnap.exists()) {
          setYesterdayRecord(recalculateTotals(yesterdaySnap.data() as DailyRecord));
        } else {
          setYesterdayRecord(null);
        }

      } else {
        // If no record exists for today, fetch yesterday's record to create a new one.
        const yesterdayStr = format(subDays(parseISO(formattedDate), 1), 'yyyy-MM-dd');
        const yesterdayDocRef = doc(firestore, 'users', user.uid, 'records', yesterdayStr);
        
        try {
            const yesterdaySnap = await getDoc(yesterdayDocRef);
            const yesterdayRecordData = yesterdaySnap.exists() ? yesterdaySnap.data() as DailyRecord : null;
            const calculatedYesterday = recalculateTotals(yesterdayRecordData);
            setYesterdayRecord(calculatedYesterday);

            const openingBalances = calculatedYesterday?.balances.closing || { account: 0, cash: 0 };
            
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

            setRecord(newRecord);

            // Also save this new record to Firestore so it exists for the next time.
            if(docRef) {
                setDoc(docRef, newRecord).catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'create',
                        requestResourceData: newRecord,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
            }
        } catch (error) {
            console.error("Error initializing today's record:", error);
        }
      }
      setIsInitializing(false);
    };

    processRecord();

  }, [currentRecordData, recordLoading, userLoading, user, formattedDate, firestore, docRef]);

  const saveRecord = useCallback((newRecordData: DailyRecord) => {
    if (!docRef) return;
    const calculatedRecord = recalculateTotals(newRecordData);
    if (calculatedRecord) {
        // Optimistically update local state for instant UI feedback
        setRecord(calculatedRecord);
        // Persist to Firestore
        setDoc(docRef, calculatedRecord, { merge: true }).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: calculatedRecord,
            });
            errorEmitter.emit('permission-error', permissionError);
            // Optionally, revert optimistic update on error
        });
    }
  }, [docRef]);
  
  const importRecords = useCallback(async (importedRecords: { [date: string]: DailyRecord }) => {
    if (!user || !firestore) return;
    
    const batch = writeBatch(firestore);
    Object.entries(importedRecords).forEach(([dateKey, recordData]) => {
      const recordDocRef = doc(firestore, `users/${user.uid}/records/${dateKey}`);
      batch.set(recordDocRef, recordData, { merge: true });
    });
    
    await batch.commit().catch(async (serverError) => {
         const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/records`,
            operation: 'write', // Batch write is a 'write' operation
        });
        errorEmitter.emit('permission-error', permissionError);
    });

  }, [user, firestore]);
  
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
