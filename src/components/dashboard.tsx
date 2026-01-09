'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockDailyRecord } from '@/lib/data';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { SummaryCards } from '@/components/summary-cards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Edit, Save } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ExpensesChart } from './expenses-chart';

export default function Dashboard() {
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

  const [localRecord, setLocalRecord] = useState<DailyRecord | null>(null);

  const { toast } = useToast();
  const [isEditingBalances, setIsEditingBalances] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);

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
    if (recordLoading || !date || !user?.uid) {
      // While loading or if prerequisites aren't met, do nothing.
      return;
    }

    if (record) {
      // If a record is found in Firestore, use it.
      setLocalRecord(record);
    } else if (record === null) {
      // If useDoc confirms the record does not exist (record is null)
      const yesterdayId = format(subDays(date, 1), 'yyyy-MM-dd');
      const yesterdayRef = doc(firestore, `/users/${user.uid}/records/${yesterdayId}`);
      
      getDoc(yesterdayRef).then(docSnap => {
        // Start with a fresh mock record for the current date.
        const newRecord = { ...mockDailyRecord, date: recordId };
        
        // If yesterday's record exists, carry over the closing balance.
        if (docSnap.exists()) {
          const yesterdayRecord = docSnap.data() as DailyRecord;
          newRecord.balances.opening.account = yesterdayRecord.balances.closing.account;
          newRecord.balances.opening.cash = yesterdayRecord.balances.closing.cash;
        }
        
        // Set the local state immediately to unblock the UI.
        setLocalRecord(newRecord);
        // Save the newly created record to Firestore.
        updateRecord(newRecord);
      });
    }
  }, [date, record, recordLoading, user?.uid, firestore, recordId, updateRecord]);


  useEffect(() => {
    if (localRecord) {
      setOpeningAccount(localRecord.balances.opening.account);
      setOpeningCash(localRecord.balances.opening.cash);
    }
  }, [localRecord]);
  
  const handleSetRecord = useCallback((setter: (prev: DailyRecord) => DailyRecord) => {
    setLocalRecord(prev => {
        if (!prev) return null;
        const newRecord = setter(prev);
        updateRecord(newRecord);
        return newRecord;
    });
  }, [updateRecord]);


  const recalculateTotals = useCallback((updatedRecord: DailyRecord): DailyRecord => {
    const cashSpent = updatedRecord.payments.filter(p => p.paymentMode === 'Cash').reduce((sum, p) => sum + p.amount, 0);
    const accountSpent = updatedRecord.payments.filter(p => p.paymentMode !== 'Cash' && p.category !== 'Withdrawal').reduce((sum, p) => sum + p.amount, 0);
    const totalSpent = cashSpent + accountSpent;
    
    const totalWithdrawals = updatedRecord.payments
      .filter(p => p.category === 'Withdrawal')
      .reduce((sum, p) => sum + p.amount, 0);

    const closingAccount = updatedRecord.balances.opening.account - accountSpent - totalWithdrawals;
    const closingCash = updatedRecord.balances.opening.cash + totalWithdrawals - cashSpent;

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
  }, []);
  
  const handleSaveBalances = () => {
    if (!localRecord) return;
    
    const updatedRecordWithNewOpening = {
      ...localRecord,
      balances: {
        ...localRecord.balances,
        opening: {
          account: openingAccount,
          cash: openingCash,
        },
      },
    };
    const fullyRecalculatedRecord = recalculateTotals(updatedRecordWithNewOpening);
    
    setLocalRecord(fullyRecalculatedRecord);
    updateRecord(fullyRecalculatedRecord);

    setIsEditingBalances(false);
    toast({
      title: "Balances Updated",
      description: "Your opening balances have been saved.",
    });
  };

  if (!localRecord) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-background">
             <Header />
             <main className="flex flex-1 items-center justify-center">
                <p>Loading your financial records...</p>
             </main>
        </div>
    )
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header setRecord={handleSetRecord} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Your financial summary for {date ? format(date, 'PPP') : 'the day'}.</p>
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
          </div>
        </div>
        <SummaryCards totals={localRecord.totals} currencyFormatter={currencyFormatter} />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExpensesChart payments={localRecord.payments} />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle className="font-headline">Balances</CardTitle>
                  <CardDescription>Opening and closing balances for the day.</CardDescription>
                </div>
                <div className="ml-auto">
                {isEditingBalances ? (
                    <Button variant="ghost" size="icon" onClick={handleSaveBalances}>
                        <Save className="h-4 w-4" />
                        <span className="sr-only">Save</span>
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" onClick={() => setIsEditingBalances(true)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                    </Button>
                )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">Opening</p>
                    <p className="text-sm font-medium text-right">Closing</p>
                    {isEditingBalances ? (
                      <Input 
                        type="number" 
                        value={openingAccount} 
                        onChange={(e) => setOpeningAccount(Number(e.target.value))}
                        className="text-2xl font-semibold p-0 border-0 focus-visible:ring-0"
                      />
                    ) : (
                      <p className="text-2xl font-semibold">{currencyFormatter.format(localRecord.balances.opening.account)}</p>
                    )}
                    <p className="text-2xl font-semibold text-right">{currencyFormatter.format(localRecord.balances.closing.account)}</p>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="text-sm text-muted-foreground text-right">Account</p>
                </div>
                 <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">Opening</p>
                    <p className="text-sm font-medium text-right">Closing</p>
                     {isEditingBalances ? (
                      <Input 
                        type="number" 
                        value={openingCash}
                        onChange={(e) => setOpeningCash(Number(e.target.value))}
                        className="text-2xl font-semibold p-0 border-0 focus-visible:ring-0"
                      />
                    ) : (
                      <p className="text-2xl font-semibold">{currencyFormatter.format(localRecord.balances.opening.cash)}</p>
                    )}
                    <p className="text-2xl font-semibold text-right">{currencyFormatter.format(localRecord.balances.closing.cash)}</p>
                    <p className="text-sm text-muted-foreground">Cash</p>
                    <p className="text-sm text-muted-foreground text-right">Cash</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

    