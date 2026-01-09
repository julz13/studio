'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { PaymentsTable } from '@/components/payments-table';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { unparse } from 'papaparse';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, type DocumentReference } from 'firebase/firestore';
import { mockDailyRecord } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const recalculateTotals = (updatedRecord: DailyRecord): DailyRecord => {
  const cashSpent = updatedRecord.payments
    .filter((p) => p.paymentMode === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);
  const accountSpent = updatedRecord.payments
    .filter((p) => p.paymentMode !== 'Cash' && p.category !== 'Withdrawal')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalSpent = cashSpent + accountSpent;

  const totalWithdrawals = updatedRecord.payments
    .filter((p) => p.category === 'Withdrawal')
    .reduce((sum, p) => sum + p.amount, 0);

  const closingAccount =
    updatedRecord.balances.opening.account - accountSpent - totalWithdrawals;
  const closingCash =
    updatedRecord.balances.opening.cash + totalWithdrawals - cashSpent;

  return {
    ...updatedRecord,
    totals: {
      totalSpent,
      cashSpent,
      accountSpent,
    },
    balances: {
      ...updatedRecord.balances,
      closing: {
        account: closingAccount,
        cash: closingCash,
      },
    },
  };
};

export default function PaymentsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const recordId = useMemo(() => (date ? format(date, 'yyyy-MM-dd') : ''), [date]);
  
  const recordRef = useMemoFirebase(() => {
    if (!user?.uid || !recordId || !firestore) return undefined;
    return doc(firestore, 'users', user.uid, 'records', recordId) as DocumentReference<DailyRecord>;
  }, [firestore, user?.uid, recordId]);

  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef);

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  const handleCreateRecord = useCallback(async () => {
    if (!recordRef || !firestore || !user?.uid || !recordId) return;

    try {
        const yesterdayId = format(subDays(new Date(recordId), 1), 'yyyy-MM-dd');
        const yesterdayRef = doc(firestore, 'users', user.uid, 'records', yesterdayId);
        const yesterdaySnap = await getDoc(yesterdayRef);

        let newOpening = { account: 0, cash: 0 };
        if (yesterdaySnap.exists()) {
            const yesterdayData = yesterdaySnap.data() as DailyRecord;
            newOpening = yesterdayData.balances.closing;
        }
        
        const newRecordData = {
            ...mockDailyRecord,
            date: recordId,
            balances: {
                ...mockDailyRecord.balances,
                opening: newOpening,
            },
        };
        const calculatedRecord = recalculateTotals(newRecordData);
        
        setDoc(recordRef, calculatedRecord).catch(async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: recordRef.path,
                operation: 'create',
                requestResourceData: calculatedRecord,
            }));
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not create a new daily record.",
            });
        });
    } catch (error) {
        console.error("Error creating new record:", error);
    }
  }, [recordId, recordRef, firestore, user?.uid, toast]);

  useEffect(() => {
    if (!recordLoading && record === null && !userLoading && user) {
        handleCreateRecord();
    }
  }, [recordLoading, record, user, userLoading, handleCreateRecord]);


  const handleSetRecord = useCallback( (setter: (prev: DailyRecord) => DailyRecord) => {
      if (!recordRef || !record) return;
      
      const newRecord = setter(record);
      const calculatedRecord = recalculateTotals(newRecord);

      setDoc(recordRef, calculatedRecord, { merge: true }).catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: recordRef.path,
          operation: 'update',
          requestResourceData: calculatedRecord,
        }));
      });
    },
    [record, recordRef]
  );

  const handleExport = () => {
    if (!record) return;
    const csvData = record.payments.map((p) => ({
      Date: record.date,
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
        `FinanceFlow_export_${record.date}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isLoading = userLoading || recordLoading || !record;

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p>Loading your financial records...</p>
        </main>
      </div>
    );
  }
  

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header setRecord={handleSetRecord} />
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className="w-[240px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(d) => d > new Date()}
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleExport}
              disabled={!record || record.payments.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <PaymentsTable
          payments={record.payments}
          setRecord={handleSetRecord}
          currencyFormatter={currencyFormatter}
        />
      </main>
    </div>
  );
}
