export interface Payment {
  id: string;
  item: string;
  category: "Food" | "Transport" | "Shopping" | "Entertainment" | "Utilities" | "Other";
  paymentMode: "Cash" | "UPI" | "Card";
  amount: number;
  time: string;
  notes?: string;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  balances: {
    opening: {
      account: number;
      cash: number;
    };
    closing: {
      account: number;
      cash: number;
    };
  };
  payments: Payment[];
  totals: {
    totalSpent: number;
    cashSpent: number;
    accountSpent: number;
  };
  metadata: {
    currency: "INR" | "USD" | "EUR";
  };
}
