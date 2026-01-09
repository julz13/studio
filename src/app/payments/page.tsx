'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockDailyRecord } from '@/lib/data';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { PaymentsTable } from '@/components/payments-table';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download, Edit, Save } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { unparse } from 'papaparse';
import { useToast } from '@/hooks/use-toast';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function PaymentsPage() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const recordId = date ? format(date, 'yyyy-MM-dd') : '';
  
  const recordRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !recordId) return undefined;
    return doc(firestore, `/users/${user.uid}/records/${recordId}`);
  }, [firestore, user?.uid, recordId]);

  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef, { listen: true });

  const [localRecord, setLocalRecord] = useState<DailyRecord>(() => ({
    ...mockDailyRecord,
    date: recordId
  }));

  const { toast } = useToast();

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

   useEffect(() => {
    if (!user && !userLoading) {
      signInAnonymously(auth);
    }
  }, [user, userLoading, auth]);

  const updateRecord = useCallback((updatedRecord: DailyRecord) => {
    if (!recordRef) return;
    setDoc(recordRef, updatedRecord, { merge: true }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: recordRef.path,
            operation: 'write',
            requestResourceData: updatedRecord
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [recordRef]);


  useEffect(() => {
    const currentRecordId = date ? format(date, 'yyyy-MM-dd') : '';
    
    if (record) { // record is a valid DailyRecord from firestore
      setLocalRecord(record);
    } else if (record === null) { // record is null, meaning doc doesn't exist
      // If the doc doesn't exist, create a new local one and save it.
      const newRecord = {
        ...mockDailyRecord,
        date: currentRecordId,
        // Carry over opening balances from the previous day's closing if available
      };
      setLocalRecord(newRecord);
      if(recordRef) {
        updateRecord(newRecord);
      }
    } else if (!recordLoading && !record) {
      // Not loading and no record yet, create a default local one
      setLocalRecord({
        ...mockDailyRecord,
        date: currentRecordId,
      });
    }
  }, [date, record, recordRef, updateRecord, recordLoading]);

  const handleSetRecord = (setter: (prev: DailyRecord) => DailyRecord) => {
    const newRecord = setter(localRecord);
    setLocalRecord(newRecord);
    updateRecord(newRecord);
  };


  const handleExport = () => {
    if (!localRecord) return;
    const csvData = localRecord.payments.map(p => ({
      Date: localRecord.date,
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
      link.setAttribute('download', `FinanceFlow_export_${localRecord.date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header setRecord={handleSetRecord} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Manage your expenses for {date ? format(date, 'PPP') : 'the day'}.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline" className="w-[240px] justify-start text-left font-normal">
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
            <Button onClick={handleExport} disabled={!localRecord || localRecord.payments.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <PaymentsTable
            payments={localRecord.payments}
            setRecord={handleSetRecord}
            currencyFormatter={currencyFormatter}
        />
      </main>
    </div>
  );
}
