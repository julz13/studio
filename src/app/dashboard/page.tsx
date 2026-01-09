'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Edit, Save, ArrowDown, ArrowUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ExpensesChart } from '@/components/expenses-chart';
import { mockDailyRecord } from '@/lib/data';
import { useUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useDate } from '@/context/date-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';

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

export default function Dashboard() {
  const { date, formattedDate } = useDate();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const recordRef = useMemo(() => {
    if (!user) return undefined;
    return doc(firestore, 'users', user.uid, 'records', formattedDate);
  }, [user, firestore, formattedDate]);

  const { data: recordData, loading: recordLoading } =
    useDoc<DailyRecord>(recordRef);
    
  const currentRecord = useMemo(() => recalculateTotals(recordData), [recordData]);

  const [isEditingBalances, setIsEditingBalances] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);
  const [yesterdayBalance, setYesterdayBalance] = useState<{account: number, cash: number} | null>(null);


  // Effect to create a new record if one doesn't exist for the selected date
  useEffect(() => {
    if (userLoading || recordLoading || !user) {
      return; 
    }

    const initializeRecord = async () => {
      if (recordData === null) {
        // Data has loaded and it's confirmed null (doesn't exist).
        // Create a new record for the day.
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
            // Crucial fix: recalculate yesterday's data before using its closing balance
            const calculatedYesterday = recalculateTotals(yesterdayData);
            if (calculatedYesterday) {
                 opening = calculatedYesterday.balances.closing;
                 setYesterdayBalance(opening);
            }
          } else {
            setYesterdayBalance(null);
          }
        } catch (e) {
          console.error("Could not fetch yesterday's record", e);
          setYesterdayBalance(null);
        }

        const newRecord: DailyRecord = {
          ...mockDailyRecord,
          date: formattedDate,
          balances: {
            ...mockDailyRecord.balances,
            opening: opening,
          },
        };
        
        const newRecordRef = doc(firestore, 'users', user.uid, 'records', formattedDate);
        // This setDoc will trigger the useDoc hook to update with the new data
        setDoc(newRecordRef, newRecord).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: newRecordRef.path,
            operation: 'create',
            requestResourceData: newRecord,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
      } else if (recordData) {
         setYesterdayBalance(null); // Record already exists, no need to show yesterday's balance
      }
    };

    initializeRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData, recordLoading, userLoading, user, date, firestore, formattedDate]);


  // Effect to update editing fields when record loads
  useEffect(() => {
    if (currentRecord) {
      setOpeningAccount(currentRecord.balances.opening.account);
      setOpeningCash(currentRecord.balances.opening.cash);
    }
  }, [currentRecord]);

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


  const handleSaveBalances = () => {
    handleSetRecord((prev) => ({
      ...prev,
      balances: {
        ...prev.balances,
        opening: {
          account: openingAccount,
          cash: openingCash,
        },
      },
    }));

    setIsEditingBalances(false);
    toast({
      title: 'Balances Updated',
      description: 'Your opening balances have been saved.',
    });
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
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Your financial summary for{' '}
              {date ? format(date, 'PPP') : 'the day'}.
            </p>
          </div>
        </div>
        <SummaryCards
          totals={currentRecord.totals}
          currencyFormatter={currencyFormatter}
        />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExpensesChart payments={currentRecord.payments} />
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
                {yesterdayBalance && (
                  <div className="rounded-lg border border-dashed border-green-500 bg-green-50/50 p-3 text-sm text-green-800">
                    <p className="flex items-center font-medium">
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Carried over from yesterday:
                    </p>
                    <div className="mt-2 flex justify-between">
                        <span>Account: {currencyFormatter.format(yesterdayBalance.account)}</span>
                        <span>Cash: {currencyFormatter.format(yesterdayBalance.cash)}</span>
                    </div>
                  </div>
                )}
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
                      {currencyFormatter.format(
                        currentRecord.balances.opening.account
                      )}
                    </p>
                  )}
                  <p className="text-2xl font-semibold text-right">
                    {currencyFormatter.format(
                      currentRecord.balances.closing.account
                    )}
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
                      {currencyFormatter.format(currentRecord.balances.opening.cash)}
                    </p>
                  )}
                  <p className="text-2xl font-semibold text-right">
                    {currencyFormatter.format(currentRecord.balances.closing.cash)}
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
