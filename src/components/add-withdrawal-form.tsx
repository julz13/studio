"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Dispatch, SetStateAction } from "react";
import type { DailyRecord, Payment } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive."),
  notes: z.string().optional(),
});

type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

interface AddWithdrawalFormProps {
  setRecord: Dispatch<SetStateAction<DailyRecord>>;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
}

export function AddWithdrawalForm({ setRecord, setSheetOpen }: AddWithdrawalFormProps) {
  const { toast } = useToast();
  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: 0,
      notes: "",
    },
  });

  function onSubmit(data: WithdrawalFormValues) {
    const newWithdrawal: Payment = {
      ...data,
      id: new Date().toISOString(),
      time: format(new Date(), "HH:mm"),
      item: "Cash Withdrawal",
      category: "Withdrawal",
      paymentMode: "N/A",
    };

    setRecord((prevRecord) => {
      const updatedPayments = [...prevRecord.payments, newWithdrawal].sort((a, b) => a.time.localeCompare(b.time));
      
      const cashSpent = updatedPayments.filter(p => p.paymentMode === 'Cash').reduce((sum, p) => sum + p.amount, 0);
      const accountSpent = updatedPayments.filter(p => p.paymentMode !== 'Cash' && p.category !== 'Withdrawal').reduce((sum, p) => sum + p.amount, 0);
      const totalSpent = cashSpent + accountSpent;

      const totalWithdrawals = updatedPayments
        .filter(p => p.category === 'Withdrawal')
        .reduce((sum, p) => sum + p.amount, 0);

      const closingAccount = prevRecord.balances.opening.account - accountSpent - totalWithdrawals;
      const closingCash = prevRecord.balances.opening.cash + totalWithdrawals - cashSpent;

      return {
        ...prevRecord,
        payments: updatedPayments,
        totals: {
          totalSpent,
          cashSpent,
          accountSpent,
        },
        balances: {
          ...prevRecord.balances,
          closing: {
            account: closingAccount,
            cash: closingCash,
          },
        },
      };
    });

    toast({
      title: "Withdrawal Added",
      description: `A withdrawal of ${data.amount} has been successfully recorded.`,
    });
    
    setSheetOpen(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g. ATM withdrawal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">Save Withdrawal</Button>
      </form>
    </Form>
  );
}

    