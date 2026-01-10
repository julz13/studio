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
import { MoreHorizontal, Banknote, Trash2 } from 'lucide-react';
import type { DailyRecord, Payment } from '@/lib/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PaymentsTableProps {
  payments: Payment[];
  onUpdatePayments: (payments: Payment[]) => void;
  currencyFormatter: Intl.NumberFormat;
}

export function PaymentsTable({ payments, onUpdatePayments, currencyFormatter }: PaymentsTableProps) {
  const [isWithdrawSheetOpen, setIsWithdrawSheetOpen] = useState(false);

  const handleDelete = (paymentId: string) => {
    const updatedPayments = payments.filter((p) => p.id !== paymentId);
    onUpdatePayments(updatedPayments);
  }

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
              <AddWithdrawalForm 
                currentRecord={{ payments } as DailyRecord} 
                onAddWithdrawal={onUpdatePayments} 
                setSheetOpen={setIsWithdrawSheetOpen} 
              />
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Details</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
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
                            <div className="text-sm text-muted-foreground">
                              {payment.time}
                            </div>
                        </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={payment.category === 'Withdrawal' ? 'secondary' : 'outline'}>{payment.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{payment.notes}</TableCell>
                  <TableCell className="hidden sm:table-cell">{payment.paymentMode}</TableCell>
                  <TableCell className="text-right">
                    {currencyFormatter.format(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                       <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the payment for "{payment.item}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(payment.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p>No payments recorded for this day yet.</p>
            <p className="text-sm">Click "Add Payment" to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
