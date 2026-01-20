'use client';

import { useState, useEffect } from 'react';
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
import { Edit, Save } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ExpensesChart } from '@/components/expenses-chart';
import { useDate } from '@/context/date-context';
import { useRecord } from '@/context/record-context';

export default function Dashboard() {
  const { date } = useDate();
  const { toast } = useToast();
  const { record: currentRecord, yesterdayRecord, loading: recordLoading, saveRecord } = useRecord();

  const [isEditingBalances, setIsEditingBalances] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);

  // Effect to update local editing state when the record from the context changes
  useEffect(() => {
    if (currentRecord) {
      setOpeningAccount(currentRecord.balances.opening.account);
      setOpeningCash(currentRecord.balances.opening.cash);
    } else {
      setOpeningAccount(0);
      setOpeningCash(0);
    }
  }, [currentRecord]);
  
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  const handleSaveBalances = () => {
    if (!currentRecord) return;
    
    // Create a new record object with updated opening balances
    const newRecord: DailyRecord = {
      ...currentRecord,
      balances: {
        ...currentRecord.balances,
        opening: {
          account: openingAccount,
          cash: openingCash,
        },
      },
    };
    
    // The saveRecord function from the context will handle recalculations and saving to localStorage
    saveRecord(newRecord);
    setIsEditingBalances(false);
    toast({
      title: 'Balances Updated',
      description: 'Your opening balances have been saved.',
    });
  };
  
  if (recordLoading) {
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
          yesterdayTotalSpent={yesterdayRecord?.totals.totalSpent}
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
