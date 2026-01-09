'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockDailyRecord } from '@/lib/data';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { SummaryCards } from '@/components/summary-cards';
import { PaymentsTable } from '@/components/payments-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download, Copy, Share2, Edit, Save, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { unparse } from 'papaparse';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { useAuth } from '@/firebase';

export default function Dashboard() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const recordId = date ? format(date, 'yyyy-MM-dd') : '';
  const docPath = user && recordId ? `/users/${user.uid}/records/${recordId}` : undefined;
  
  const recordRef = useMemoFirebase(() => {
    return docPath ? doc(firestore, docPath) : undefined;
  }, [firestore, docPath]);

  const { data: record, loading: recordLoading } = useDoc<DailyRecord>(recordRef, { listen: true });

  const [localRecord, setLocalRecord] = useState<DailyRecord | null | undefined>(record);

  const { toast } = useToast();
  const [isEditingBalances, setIsEditingBalances] = useState(false);
  const [openingAccount, setOpeningAccount] = useState(0);
  const [openingCash, setOpeningCash] = useState(0);

  const googleSheetUrl = "https://docs.google.com/spreadsheets/d/1DbFKdTARUxfqRHURdFaz-cnPavHCvONGm_cwTuWllNk/edit?gid=592434066#gid=592434066";

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

  const updateRecord = useCallback(async (updatedRecord: DailyRecord) => {
    if (!recordRef) return;
    try {
      await setDoc(recordRef, updatedRecord, { merge: true });
    } catch (error) {
      console.error("Error updating record: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save changes to the database.",
      });
    }
  }, [recordRef, toast]);


  useEffect(() => {
    const manageRecord = async () => {
      if (!user || !date) return;
      if (recordLoading) return;

      const currentRecordId = format(date, 'yyyy-MM-dd');

      if (record === undefined) {
         setLocalRecord(undefined); // Loading state
      } else if (record === null) {
        // Doc doesn't exist, create it
        const newRecord = {
          ...mockDailyRecord,
          date: currentRecordId,
        };
        setLocalRecord(newRecord);
        if (recordRef) {
           await setDoc(recordRef, newRecord);
        }
      } else {
        // Doc exists
        setLocalRecord(record);
      }
    };
    manageRecord();
  }, [user, date, record, recordLoading, recordRef]);


  useEffect(() => {
    if (localRecord) {
      setOpeningAccount(localRecord.balances.opening.account);
      setOpeningCash(localRecord.balances.opening.cash);
    }
  }, [localRecord]);


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

  const handleSetRecord = (setter: (prev: DailyRecord) => DailyRecord) => {
    if (!localRecord) return;
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

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(googleSheetUrl);
    toast({
      title: "Copied to Clipboard",
      description: "Google Sheet URL has been copied.",
    });
  }

  const isLoading = userLoading || recordLoading || localRecord === undefined;
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your financial data...</p>
            </div>
        </main>
      </div>
    )
  }

  if (!localRecord) {
     return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
            <div className="text-center">
                <p className="text-muted-foreground">Could not load record for this day.</p>
                <p className="text-sm text-muted-foreground">Try selecting a different date.</p>
            </div>
        </main>
      </div>
     )
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight">Daily Dashboard</h1>
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
            <Button onClick={handleExport} disabled={!localRecord || localRecord.payments.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <SummaryCards totals={localRecord.totals} currencyFormatter={currencyFormatter} />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PaymentsTable
              payments={localRecord.payments}
              setRecord={handleSetRecord}
              currencyFormatter={currencyFormatter}
            />
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
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Google Sheet</CardTitle>
                <CardDescription>View and manage your data in Google Sheets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <Input readOnly value={googleSheetUrl} />
                    <Button variant="outline" size="icon" onClick={handleCopyToClipboard}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                <Button asChild className="w-full">
                    <Link href={googleSheetUrl} target="_blank">
                        <Share2 className="mr-2 h-4 w-4" />
                        Open Google Sheet
                    </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
