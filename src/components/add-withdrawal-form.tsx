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
import type { Payment } from "@/lib/types";
import { format } from "date-fns";

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive."),
  notes: z.string().optional(),
});

type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

interface AddWithdrawalFormProps {
  onAddWithdrawal: (withdrawal: Payment) => void;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
}

export function AddWithdrawalForm({ onAddWithdrawal, setSheetOpen }: AddWithdrawalFormProps) {
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

    onAddWithdrawal(newWithdrawal);
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
