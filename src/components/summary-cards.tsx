import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CreditCard, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  totals: {
    totalSpent: number;
    cashSpent: number;
    accountSpent: number;
  };
  currencyFormatter: Intl.NumberFormat;
}

export function SummaryCards({ totals, currencyFormatter }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:gap-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spent Today</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencyFormatter.format(totals.totalSpent)}</div>
          <p className="text-xs text-muted-foreground">Summary of all payments for the day</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Account Spent</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencyFormatter.format(totals.accountSpent)}</div>
          <p className="text-xs text-muted-foreground">Total spent from UPI & Card</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Spent</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencyFormatter.format(totals.cashSpent)}</div>
          <p className="text-xs text-muted-foreground">Total spent from physical cash</p>
        </CardContent>
      </Card>
    </div>
  );
}
