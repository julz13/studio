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
import {
  useUser,
  useDoc,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { mockDailyRecord } from '@/lib/data';

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
  const { toast } = useToast();
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();

  const formattedDate = date ? format(date, 'yyyy-MM-dd') : '';

  const recordRef = useMemoFirebase(() => {
    if (!user || !formattedDate || !db) return undefined;
    return doc(db, 'users', user.uid, 'records', formattedDate);
  }, [user, formattedDate, db]);
  
  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef);

  const [isEditingBalances, setIsEditingBalances] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);

  const isLoading = userLoading || recordLoading;

  // Effect to create a new record if one doesn't exist for the selected date
  useEffect(() => {
    // Only run if there's no record, we are not loading, and the reference is valid
    if (record === null && !isLoading && recordRef) {
      const newRecordData: DailyRecord = {
        ...mockDailyRecord,
        date: formattedDate,
      };
      // Use setDoc, but don't await it in useEffect to avoid race conditions
      setDoc(recordRef, newRecordData).catch(error => {
        console.error("Error creating new record:", error);
      });
    }
  }, [record, isLoading, recordRef, formattedDate]);

  
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });
  
  useEffect(() => {
    if (record) {
      setOpeningAccount(record.balances.opening.account);
      setOpeningCash(record.balances.opening.cash);
    }
  }, [record]);
  
  const handleSetRecord = (setter: (prev: DailyRecord) => DailyRecord) => {
    if (!record || !recordRef) return;
    
    const newRecord = setter(record);
    const calculatedRecord = recalculateTotals(newRecord);
    
    setDoc(recordRef, calculatedRecord, { merge: true }).catch(error => {
      console.error("Failed to save record:", error);
      toast({
        variant: "destructive",
        title: "Error saving data",
        description: "There was a problem saving your changes.",
      });
    });
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

  if (isLoading || record === undefined) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p>Loading your financial records...</p>
        </main>
      </div>
    );
  }

  // Record is null, which means it doesn't exist yet and is being created
  if (record === null) {
      return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p>Preparing today's record...</p>
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
                  disabled={(d) => d > new Date() || d < subDays(new Date(), 30)}
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
