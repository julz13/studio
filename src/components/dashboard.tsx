'use client';

import { useState } from 'react';
import { mockDailyRecord } from '@/lib/data';
import type { DailyRecord } from '@/lib/types';
import { Header } from '@/components/header';
import { SummaryCards } from '@/components/summary-cards';
import { PaymentsTable } from '@/components/payments-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { unparse } from 'papaparse';

export default function Dashboard() {
  const [record, setRecord] = useState<DailyRecord>(mockDailyRecord);
  const [date, setDate] = useState<Date | undefined>(new Date(record.date));

  // In a real app, you would fetch the record for the selected date
  // useEffect(() => {
  //   fetchRecordForDate(date);
  // }, [date]);

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: record.metadata.currency,
    minimumFractionDigits: 0,
  });

  const handleExport = () => {
    const csvData = record.payments.map(p => ({
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
      link.setAttribute('download', `FinanceFlow_export_${record.date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
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
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <SummaryCards totals={record.totals} currencyFormatter={currencyFormatter} />
        <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PaymentsTable
              payments={record.payments}
              setRecord={setRecord}
              currencyFormatter={currencyFormatter}
            />
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Balances</CardTitle>
                <CardDescription>Opening and closing balances for the day.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">Opening</p>
                    <p className="text-sm font-medium text-right">Closing</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(record.balances.opening.account)}</p>
                    <p className="text-2xl font-semibold text-right">{currencyFormatter.format(record.balances.closing.account)}</p>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="text-sm text-muted-foreground text-right">Account</p>
                </div>
                 <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">Opening</p>
                    <p className="text-sm font-medium text-right">Closing</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(record.balances.opening.cash)}</p>
                    <p className="text-2xl font-semibold text-right">{currencyFormatter.format(record.balances.closing.cash)}</p>
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
