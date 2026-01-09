import type { DailyRecord } from '@/lib/types';

export const mockDailyRecord: DailyRecord = {
  date: new Date().toISOString().split('T')[0], // Default to today
  balances: {
    opening: {
      account: 0,
      cash: 0
    },
    closing: {
      account: 0,
      cash: 0
    }
  },
  payments: [],
  totals: {
    totalSpent: 0,
    cashSpent: 0,
    accountSpent: 0
  },
  metadata: {
    currency: "INR"
  }
};
