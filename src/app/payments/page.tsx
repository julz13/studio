'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DailyRecord, Payment } from '@/lib/types';
import { Header } from '@/components/header';
import { PaymentsTable } from '@/components/payments-table';
import { Button } from '@/components/ui/button';
import { Download, PlusCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { unparse } from 'papaparse';
import { mockDailyRecord } from '@/lib/data';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useDate } from '@/context/date-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { AddPaymentForm } from '@/components/add-payment-form';

const recalculateTotals = (
  recordToCalc: DailyRecord | null | undefined
): DailyRecord | null | undefined => {
  if (!recordToCalc) return recordToCalc;

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

export default function PaymentsPage() {
  const { date, formattedDate } = useDate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const recordRef = useMemo(() => {
    if (!user) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, firestore, formattedDate]);

  const { data: recordData, loading: recordLoading } =
    useDoc<DailyRecord>(recordRef);

  const currentRecord = useMemo(() => recalculateTotals(recordData), [recordData]);

  // Effect to set initial record or create a new one
  useEffect(() => {
    if (userLoading || !user) {
      return;
    }

    const initializeRecord = async () => {
      if (recordData === null) { // Only create if loading is done and data is confirmed null
        const yesterday = subDays(date, 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        const yesterdayRef = doc(
          firestore,
          'users',
          user.uid,
          'records',
          yesterdayStr
        );

        let opening = { account: 0, cash: 0 };
        try {
          const yesterdaySnap = await getDoc(yesterdayRef);
          if (yesterdaySnap.exists()) {
            const yesterdayData = yesterdaySnap.data() as DailyRecord;
            const calculatedYesterday = recalculateTotals(yesterdayData);
             if (calculatedYesterday) {
                 opening = calculatedYesterday.balances.closing;
            }
          }
        } catch (e) {
          console.error("Could not fetch yesterday's record", e);
        }

        const newRecord: DailyRecord = {
          ...mockDailyRecord,
          date: formattedDate,
          balances: {
            ...mockDailyRecord.balances,
            opening: opening,
          },
        };

        const newRecordRef = doc(
          firestore,
          'users',
          user.uid,
          'records',
          formattedDate
        );
        setDoc(newRecordRef, newRecord).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: newRecordRef.path,
            operation: 'create',
            requestResourceData: newRecord,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
      }
    };

    if (!recordLoading) {
      initializeRecord();
    }
  }, [userLoading, user, date, firestore, formattedDate, recordLoading, recordData]);

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  const handleSetRecord = (setter: (prev: DailyRecord) => DailyRecord) => {
    if (!user || !currentRecord) return;
    
    const newRecord = setter(currentRecord);
    const calculatedRecord = recalculateTotals(newRecord) as DailyRecord;

    const recordRef = doc(
      firestore,
      'users',
      user.uid,
      'records',
      calculatedRecord.date
    );
    setDoc(recordRef, calculatedRecord, { merge: true }).catch(
      (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: recordRef.path,
          operation: 'update',
          requestResourceData: calculatedRecord,
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    );
  };

  const handleExport = () => {
    if (!currentRecord) return;
    const csvData = currentRecord.payments.map((p) => ({
      Date: currentRecord.date,
      Time: p.time,
      Item: p.item,
      Category: p.category,
      Amount: p.amount,
      'Payment Mode': p.paymentMode,
      Notes: p.notes,
    }));

    const csv = unparse(csvData);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `FinanceFlow_export_${currentRecord.date}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (userLoading || recordLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p>Loading your financial records...</p>
        </main>
      </div>
    );
  }

  if (!currentRecord) {
     return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p>Initializing today's record...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight">
              Payments
            </h1>
            <p className="text-muted-foreground">
              Manage your expenses for{' '}
              {date ? format(date, 'PPP') : 'the day'}.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Add Payment
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="font-headline">
                    Add New Payment
                  </SheetTitle>
                  <SheetDescription>
                    Enter the details of your transaction below. Click save when
                    you're done.
                  </SheetDescription>
                </SheetHeader>
                <AddPaymentForm
                  setRecord={handleSetRecord}
                  setSheetOpen={setIsSheetOpen}
                />
              </SheetContent>
            </Sheet>
            <Button
              onClick={handleExport}
              disabled={!currentRecord || currentRecord.payments.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <PaymentsTable
          payments={currentRecord.payments}
          setRecord={handleSetRecord}
          currencyFormatter={currencyFormatter}
        />
      </main>
    </div>
  );
}
