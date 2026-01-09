'use client';

import { useState, useEffect, useCallback } from 'react';
import { mockDailyRecord } from '@/lib/data';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { PaymentsTable } from '@/components/payments-table';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { unparse } from 'papaparse';

export default function PaymentsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [localRecord, setLocalRecord] = useState<DailyRecord | null>(null);

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  useEffect(() => {
    // Simulate fetching data
    const recordId = date ? format(date, 'yyyy-MM-dd') : '';
    const newRecord = { ...mockDailyRecord, date: recordId };
    setLocalRecord(newRecord);
  }, [date]);
  
  const handleSetRecord = useCallback((setter: (prev: DailyRecord) => DailyRecord) => {
    setLocalRecord(prev => {
        if (!prev) return null;
        const newRecord = setter(prev);
        console.log("Record updated (local state):", newRecord);
        return newRecord;
    });
  }, []);


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
