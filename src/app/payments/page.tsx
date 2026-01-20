'use client';

import { useState } from 'react';
import type { Payment } from '@/lib/types';
import { Header } from '@/components/header';
import { PaymentsTable } from '@/components/payments-table';
import { Button } from '@/components/ui/button';
import { Download, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { unparse } from 'papaparse';
import { useDate } from '@/context/date-context';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AddPaymentForm } from '@/components/add-payment-form';
import { useToast } from '@/hooks/use-toast';
import { useRecord } from '@/context/record-context';

export default function PaymentsPage() {
  const { date } = useDate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { toast } = useToast();
  const { record: currentRecord, loading: recordLoading, saveRecord } = useRecord();

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  });

  const handleAddPayment = (newPayment: Payment) => {
    if (!currentRecord) return;
    const updatedPayments = [...currentRecord.payments, newPayment].sort((a, b) => a.time.localeCompare(b.time));
    saveRecord({ ...currentRecord, payments: updatedPayments });
    toast({
      title: "Payment Added",
      description: `${newPayment.item} for ${currencyFormatter.format(newPayment.amount)} has been successfully recorded.`,
    });
  };
  
  const handleAddWithdrawal = (newWithdrawal: Payment) => {
    if (!currentRecord) return;
    const updatedPayments = [...currentRecord.payments, newWithdrawal].sort((a, b) => a.time.localeCompare(b.time));
    saveRecord({ ...currentRecord, payments: updatedPayments });
    toast({
      title: "Withdrawal Added",
      description: `A withdrawal of ${currencyFormatter.format(newWithdrawal.amount)} has been successfully recorded.`,
    });
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!currentRecord) return;
     const updatedPayments = currentRecord.payments.filter((p) => p.id !== paymentId);
      saveRecord({ ...currentRecord, payments: updatedPayments });
      toast({
        title: "Payment Deleted",
        description: `The payment has been removed.`,
      });
  };


  const handleExportCsv = () => {
    if (!currentRecord) return;
    const csvData = currentRecord.payments.map((p) => ({
      Date: currentRecord.date,
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
        `FinanceFlow_export_${currentRecord.date}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
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
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Add Payment
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="font-headline">
                    Add New Payment
                  </SheetTitle>
                  <SheetDescription>
                    Enter the details of your transaction below. Click save when
                    you're done.
                  </SheetDescription>
                </SheetHeader>
                <AddPaymentForm
                  onAddPayment={handleAddPayment}
                  setSheetOpen={setIsSheetOpen}
                />
              </SheetContent>
            </Sheet>
            <Button
              onClick={handleExportCsv}
              disabled={!currentRecord || currentRecord.payments.length === 0}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        
        {currentRecord ? (
          <PaymentsTable
            payments={currentRecord.payments}
            onDeletePayment={handleDeletePayment}
            onAddWithdrawal={handleAddWithdrawal}
            currencyFormatter={currencyFormatter}
          />
        ) : (
           <div className="flex items-center justify-center rounded-lg border border-dashed shadow-sm h-96">
            <div className="text-center">
              <p className="text-muted-foreground">Initializing today's record...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
