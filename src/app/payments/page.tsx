'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { mockDailyRecord } from '@/lib/data';

const getLocalStorageKey = (date: string) => `finance-record-${date}`;

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

const loadRecordFromLocalStorage = (date: string): DailyRecord => {
    if (typeof window === 'undefined') {
        return { ...mockDailyRecord, date };
    }
    const key = getLocalStorageKey(date);
    const storedData = localStorage.getItem(key);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
         if (!parsed.balances.closing) {
          return recalculateTotals(parsed);
        }
        return parsed;
      } catch (e) {
         console.error("Failed to parse localStorage data", e);
      }
    }
    // If no record for the date, create a new one
    const newRecord = { ...mockDailyRecord, date };
    const yesterday = format(subDays(new Date(date), 1), 'yyyy-MM-dd');
    const yesterdayKey = getLocalStorageKey(yesterday);
    const yesterdayData = localStorage.getItem(yesterdayKey);
    if (yesterdayData) {
      try {
        const yesterdayRecord = JSON.parse(yesterdayData);
        const calculatedYesterday = recalculateTotals(yesterdayRecord);
        newRecord.balances.opening.account = calculatedYesterday.balances.closing.account;
        newRecord.balances.opening.cash = calculatedYesterday.balances.closing.cash;
      } catch(e) {
          console.error("Failed to parse yesterday's data", e);
      }
    }
    const calculatedRecord = recalculateTotals(newRecord);
    localStorage.setItem(key, JSON.stringify(calculatedRecord));
    return calculatedRecord;
};

const saveRecordToLocalStorage = (record: DailyRecord) => {
  if (typeof window === 'undefined') return;
  const key = getLocalStorageKey(record.date);
  localStorage.setItem(key, JSON.stringify(record));
};


export default function PaymentsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const formattedDate = useMemo(() => date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'), [date]);

  const [record, setRecord] = useState<DailyRecord>(() => loadRecordFromLocalStorage(formattedDate));

  // Effect to load data when date changes
  useEffect(() => {
    const newRecord = loadRecordFromLocalStorage(formattedDate);
    setRecord(newRecord);
  }, [formattedDate]);

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  const handleSetRecord = (setter: (prev: DailyRecord) => DailyRecord) => {
    setRecord(prev => {
        const newRecord = setter(prev);
        const calculatedRecord = recalculateTotals(newRecord);
        saveRecordToLocalStorage(calculatedRecord);
        return calculatedRecord;
    })
  };

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

  if (!record) {
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
                  disabled={(d) => d > new Date() || d < subDays(new Date(), 30)}
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
