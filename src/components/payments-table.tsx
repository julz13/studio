"use client";

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Banknote } from 'lucide-react';
import type { DailyRecord, Payment } from '@/lib/types';
import { AddPaymentForm } from './add-payment-form';
import { AddWithdrawalForm } from './add-withdrawal-form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription
} from './ui/sheet';
import { CategoryIcon } from './category-icon';

interface PaymentsTableProps {
  payments: Payment[];
  setRecord: Dispatch<SetStateAction<DailyRecord>>;
  currencyFormatter: Intl.NumberFormat;
}

export function PaymentsTable({ payments, setRecord, currencyFormatter }: PaymentsTableProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isWithdrawSheetOpen, setIsWithdrawSheetOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle className="font-headline">Payments</CardTitle>
          <CardDescription>
            Your expenses for the selected day.
          </CardDescription>
        </div>
        <div className="ml-auto flex items-center gap-2">
           <Sheet open={isWithdrawSheetOpen} onOpenChange={setIsWithdrawSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Banknote className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Withdraw
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="font-headline">Add Withdrawal</SheetTitle>
                <SheetDescription>
                  Enter the amount you withdrew from your bank account to cash.
                </SheetDescription>
              </SheetHeader>
              <AddWithdrawalForm setRecord={setRecord} setSheetOpen={setIsWithdrawSheetOpen} />
            </SheetContent>
          </Sheet>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Add Payment
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="font-headline">Add New Payment</SheetTitle>
                <SheetDescription>
                  Enter the details of your transaction below. Click save when you're done.
                </SheetDescription>
              </SheetHeader>
              <AddPaymentForm setRecord={setRecord} setSheetOpen={setIsSheetOpen} />
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Details</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead className="hidden sm:table-cell">Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                          <CategoryIcon category={payment.category} className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                          <div className="font-medium">{payment.item}</div>
                          <div className="hidden text-sm text-muted-foreground md:inline">
                            {payment.time} {payment.notes && ` - ${payment.notes}`}
                          </div>
                      </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={payment.category === 'Withdrawal' ? 'secondary' : 'outline'}>{payment.category}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{payment.paymentMode}</TableCell>
                <TableCell className="text-right">
                  {currencyFormatter.format(payment.amount)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    