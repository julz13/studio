'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord } from '@/lib/types';
import { useDate } from './date-context';
import { useUser } from '@/firebase/auth/use-user';
import { format, subDays } from 'date-fns';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

  const recordRef = useMemoFirebase(() => {
    if (!user || !formattedDate) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, formattedDate, firestore]);

  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef);

  const [isInitializing, setIsInitializing] = useState(false);
  const loading = userLoading || recordLoading || isInitializing;

  useEffect(() => {
    if (recordLoading || userLoading || !firestore || !user || !formattedDate) {
      return;
    }

    if (record === null) {
      setIsInitializing(true);
      const initializeRecord = async () => {
        try {
          const yesterdayStr = format(subDays(new Date(formattedDate), 1), 'yyyy-MM-dd');
          const yesterdayRef = doc(firestore, 'users', user.uid, 'records', yesterdayStr);
          const yesterdaySnap = await getDoc(yesterdayRef);

          let openingBalances = { account: 0, cash: 0 };
          if (yesterdaySnap.exists()) {
            const yesterdayRecord = yesterdaySnap.data() as DailyRecord;
            const calculatedYesterday = recalculateTotals(yesterdayRecord);
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
          
          const finalNewRecord = recalculateTotals(newRecord);
          if (finalNewRecord && recordRef) {
             setDoc(recordRef, finalNewRecord)
             .catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: recordRef.path,
                    operation: 'create',
                    requestResourceData: finalNewRecord,
                 });
                 errorEmitter.emit('permission-error', permissionError);
            });
          }
        } catch (error) {
          console.error("Failed to initialize record:", error);
        } finally {
          setIsInitializing(false);
        }
      };
      initializeRecord();
    }
  }, [record, recordLoading, userLoading, user, firestore, formattedDate, recordRef]);
  
  const saveRecord = useCallback((newRecordData: DailyRecord) => {
    if (!recordRef) return;
    
    const calculatedRecord = recalculateTotals(newRecordData);
    if(calculatedRecord) {
        setDoc(recordRef, calculatedRecord)
        .catch((serverError) => {
             const permissionError = new FirestorePermissionError({
                path: recordRef.path,
                operation: 'update',
                requestResourceData: calculatedRecord,
             });
             errorEmitter.emit('permission-error', permissionError);
        });
    }
  }, [recordRef]);

  const value = useMemo(() => ({
      record: recalculateTotals(record || null),
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
