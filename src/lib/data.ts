import type { DailyRecord } from '@/lib/types';

export const mockDailyRecord: DailyRecord = {
  date: new Date().toISOString().split('T')[0], // Default to today
  balances: {
    opening: {
      account: 25000,
      cash: 2000
    },
    closing: {
      account: 24330,
      cash: 1720
    }
  },
  payments: [
    {
      id: "1",
      item: "Breakfast",
      category: "Food",
      paymentMode: "Cash",
      amount: 80,
      time: "09:15",
      notes: "Tea and snacks"
    },
    {
      id: "2",
      item: "Uber Ride",
      category: "Transport",
      paymentMode: "UPI",
      amount: 220,
      time: "11:40",
      notes: "Office travel"
    },
    {
      id: "3",
      item: "Grocery",
      category: "Shopping",
      paymentMode: "Card",
      amount: 450,
      time: "18:10",
      notes: "Vegetables and milk"
    }
  ],
  totals: {
    totalSpent: 750,
    cashSpent: 80,
    accountSpent: 670
  },
  metadata: {
    currency: "INR"
  }
};
