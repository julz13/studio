'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Payment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';

interface ExpensesChartProps {
  payments: Payment[];
}

export function ExpensesChart({ payments }: ExpensesChartProps) {
  const chartData = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};
    payments.forEach(payment => {
      if (payment.category !== 'Withdrawal') {
        if (!categoryTotals[payment.category]) {
          categoryTotals[payment.category] = 0;
        }
        categoryTotals[payment.category] += payment.amount;
      }
    });
    return Object.entries(categoryTotals).map(([name, amount]) => ({ name, amount }));
  }, [payments]);

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">Daily Expense Summary</CardTitle>
            <CardDescription>A breakdown of your spending by category for the day.</CardDescription>
        </CardHeader>
        <CardContent>
             {payments.filter(p => p.category !== 'Withdrawal').length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))', 
                                    border: '1px solid hsl(var(--border))',
                                    color: 'hsl(var(--foreground))'
                                }}
                                cursor={{fill: 'hsl(var(--muted))'}}
                             />
                            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             ) : (
                <div className="text-center text-muted-foreground py-12 h-[300px] flex items-center justify-center">
                    <div>
                        <p>No expenses recorded for this day yet.</p>
                        <p className="text-sm">Your chart will appear here once you add a payment.</p>
                    </div>
                </div>
             )}
        </CardContent>
    </Card>
  );
}
