'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { SummaryCards } from '@/components/summary-cards';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Edit, Save } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ExpensesChart } from '@/components/expenses-chart';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, DocumentReference, DocumentData } from 'firebase/firestore';
import { mockDailyRecord } from '@/lib/data';
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

export default function Dashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const recordId = useMemo(() => (date ? format(date, 'yyyy-MM-dd') : ''), [date]);
  
  const recordRef = useMemoFirebase(() => {
    if (!user?.uid || !recordId) return undefined;
    return doc(firestore, 'users', user.uid, 'records', recordId) as DocumentReference<DailyRecord>;
  }, [firestore, user?.uid, recordId]);

  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef);

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
    const createNewRecord = async () => {
      if (user?.uid && recordId && record === null) { // record is explicitly null (doesn't exist)
        try {
          const yesterdayId = format(subDays(new Date(recordId), 1), 'yyyy-MM-dd');
          const yesterdayRef = doc(firestore, 'users', user.uid, 'records', yesterdayId);
          const yesterdaySnap = await getDoc(yesterdayRef);

          let newOpening = { account: 0, cash: 0 };
          if (yesterdaySnap.exists()) {
            const yesterdayData = yesterdaySnap.data() as DailyRecord;
            newOpening = yesterdayData.balances.closing;
          }
          
          const newRecord = {
            ...mockDailyRecord,
            date: recordId,
            balances: {
              ...mockDailyRecord.balances,
              opening: newOpening,
            },
          };
          const calculatedRecord = recalculateTotals(newRecord);
          
          setDoc(recordRef as DocumentReference<DocumentData>, calculatedRecord).catch(async (serverError) => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: (recordRef as DocumentReference<DocumentData>).path,
                operation: 'create',
                requestResourceData: calculatedRecord,
             }));
          });
        } catch (error) {
          console.error("Error creating new record:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not create a new daily record.",
          });
        }
      }
    };
    createNewRecord();
  }, [user?.uid, recordId, record, firestore, recordRef, toast]);
  
  useEffect(() => {
    if (record) {
      setOpeningAccount(record.balances.opening.account);
      setOpeningCash(record.balances.opening.cash);
    }
  }, [record]);

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
  
  const handleSaveBalances = () => {
    if (!record) return;
    
    const updatedRecordWithNewOpening = {
      ...record,
      balances: {
        ...record.balances,
        opening: {
          account: openingAccount,
          cash: openingCash,
        },
      },
    };
    
    handleSetRecord(() => updatedRecordWithNewOpening);

    setIsEditingBalances(false);
    toast({
      title: 'Balances Updated',
      description: 'Your opening balances have been saved.',
    });
  };

  const isLoading = userLoading || recordLoading || record === undefined;

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

  if (!record) {
     return (
        <div className="flex min-h-screen w-full flex-col bg-background">
             <Header />
             <main className="flex flex-1 items-center justify-center">
                <p>Creating today's record...</p>
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
            <h1 className="font-headline text-3xl font-semibold tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Your financial summary for{' '}
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
          </div>
        </div>
        <SummaryCards
          totals={record.totals}
          currencyFormatter={currencyFormatter}
        />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExpensesChart payments={record.payments} />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle className="font-headline">Balances</CardTitle>
                  <CardDescription>
                    Opening and closing balances for the day.
                  </CardDescription>
                </div>
                <div className="ml-auto">
                  {isEditingBalances ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSaveBalances}
                    >
                      <Save className="h-4 w-4" />
                      <span className="sr-only">Save</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditingBalances(true)}
                    >
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
                      onChange={(e) =>
                        setOpeningAccount(Number(e.target.value))
                      }
                      className="text-2xl font-semibold p-0 border-0 focus-visible:ring-0"
                    />
                  ) : (
                    <p className="text-2xl font-semibold">
                      {currencyFormatter.format(record.balances.opening.account)}
                    </p>
                  )}
                  <p className="text-2xl font-semibold text-right">
                    {currencyFormatter.format(record.balances.closing.account)}
                  </p>
                  <p className="text-sm text-muted-foreground">Account</p>
                  <p className="text-sm text-muted-foreground text-right">
                    Account
                  </p>
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
                    <p className="text-2xl font-semibold">
                      {currencyFormatter.format(record.balances.opening.cash)}
                    </p>
                  )}
                  <p className="text-2xl font-semibold text-right">
                    {currencyFormatter.format(record.balances.closing.cash)}
                  </p>
                  <p className="text-sm text-muted-foreground">Cash</p>
                  <p className="text-sm text-muted-foreground text-right">
                    Cash
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
