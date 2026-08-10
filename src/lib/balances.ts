export interface ItemSplitInput {
  userId: string;
  shareAmount: number;
}

export interface ExpenseItemInput {
  id: string;
  name: string;
  amount: number;
  payerId: string;
  splits: ItemSplitInput[];
}

export interface ExpenseInput {
  id: string;
  title: string;
  category?: string | null;
  expenseDate: Date | string;
  createdById: string;
  items: ExpenseItemInput[];
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface PairwiseDebt {
  fromUser: UserSummary;
  toUser: UserSummary;
  amount: number;
}

export interface UserBalance {
  user: UserSummary;
  paidTotal: number;
  shareTotal: number;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface ItemBreakdownLog {
  itemId: string;
  itemName: string;
  itemAmount: number;
  payer: UserSummary;
  expenseTitle: string;
  expenseDate: Date | string;
  splits: {
    user: UserSummary;
    shareAmount: number;
    owesPayerAmount: number;
  }[];
}

/**
 * Calculates net balances per user and pairwise debts for a set of expenses.
 */
export function calculateGroupBalances(
  members: UserSummary[],
  expenses: ExpenseInput[]
) {
  const memberMap = new Map<string, UserSummary>();
  members.forEach((m) => memberMap.set(m.id, m));

  // Map of userId -> paidTotal, shareTotal
  const paidTotals = new Map<string, number>();
  const shareTotals = new Map<string, number>();

  members.forEach((m) => {
    paidTotals.set(m.id, 0);
    shareTotals.set(m.id, 0);
  });

  // Pairwise debt matrix: owesMatrix[fromUserId][toUserId] = amount
  const owesMatrix: Record<string, Record<string, number>> = {};
  members.forEach((m1) => {
    owesMatrix[m1.id] = {};
    members.forEach((m2) => {
      owesMatrix[m1.id][m2.id] = 0;
    });
  });

  const itemLogs: ItemBreakdownLog[] = [];

  for (const expense of expenses) {
    for (const item of expense.items) {
      const payerId = item.payerId;
      const itemAmount = Number(item.amount);

      if (paidTotals.has(payerId)) {
        paidTotals.set(payerId, (paidTotals.get(payerId) || 0) + itemAmount);
      }

      const logSplits: ItemBreakdownLog["splits"] = [];

      for (const split of item.splits) {
        const userId = split.userId;
        const share = Number(split.shareAmount || 0);

        if (shareTotals.has(userId)) {
          shareTotals.set(userId, (shareTotals.get(userId) || 0) + share);
        }

        if (userId !== payerId && owesMatrix[userId] && owesMatrix[userId][payerId] !== undefined) {
          owesMatrix[userId][payerId] += share;
        }

        const userObj = memberMap.get(userId) || { id: userId, name: "Unknown", email: "" };
        logSplits.push({
          user: userObj,
          shareAmount: share,
          owesPayerAmount: userId === payerId ? 0 : share,
        });
      }

      const payerObj = memberMap.get(payerId) || { id: payerId, name: "Unknown", email: "" };
      itemLogs.push({
        itemId: item.id,
        itemName: item.name,
        itemAmount,
        payer: payerObj,
        expenseTitle: expense.title,
        expenseDate: expense.expenseDate,
        splits: logSplits,
      });
    }
  }

  // Calculate Net User Balances
  const userBalances: UserBalance[] = members.map((m) => {
    const paid = paidTotals.get(m.id) || 0;
    const share = shareTotals.get(m.id) || 0;
    return {
      user: m,
      paidTotal: Math.round(paid * 100) / 100,
      shareTotal: Math.round(share * 100) / 100,
      netBalance: Math.round((paid - share) * 100) / 100,
    };
  });

  // Calculate Net Pairwise Debts (Direct owe between pairs)
  const pairwiseDebts: PairwiseDebt[] = [];
  const processedPairs = new Set<string>();

  for (const m1 of members) {
    for (const m2 of members) {
      if (m1.id === m2.id) continue;
      const pairKey = [m1.id, m2.id].sort().join(":");
      if (processedPairs.has(pairKey)) continue;

      processedPairs.add(pairKey);

      const m1OwesM2 = owesMatrix[m1.id]?.[m2.id] || 0;
      const m2OwesM1 = owesMatrix[m2.id]?.[m1.id] || 0;

      const netOwed = m1OwesM2 - m2OwesM1;
      if (Math.abs(netOwed) > 0.01) {
        if (netOwed > 0) {
          pairwiseDebts.push({
            fromUser: m1,
            toUser: m2,
            amount: Math.round(netOwed * 100) / 100,
          });
        } else {
          pairwiseDebts.push({
            fromUser: m2,
            toUser: m1,
            amount: Math.round(-netOwed * 100) / 100,
          });
        }
      }
    }
  }

  // Simplified Debts algorithm (Minimizing transaction count)
  const simplifiedDebts: PairwiseDebt[] = calculateSimplifiedDebts(members, userBalances);

  return {
    userBalances,
    pairwiseDebts,
    simplifiedDebts,
    itemLogs,
  };
}

/**
 * Greedily reduces debt transactions across a group of people.
 */
export function calculateSimplifiedDebts(
  members: UserSummary[],
  userBalances: UserBalance[]
): PairwiseDebt[] {
  const memberMap = new Map<string, UserSummary>();
  members.forEach((m) => memberMap.set(m.id, m));

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const bal of userBalances) {
    if (bal.netBalance < -0.01) {
      debtors.push({ id: bal.user.id, amount: -bal.netBalance });
    } else if (bal.netBalance > 0.01) {
      creditors.push({ id: bal.user.id, amount: bal.netBalance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const results: PairwiseDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      const fromObj = memberMap.get(debtor.id);
      const toObj = memberMap.get(creditor.id);
      if (fromObj && toObj) {
        results.push({
          fromUser: fromObj,
          toUser: toObj,
          amount: Math.round(settledAmount * 100) / 100,
        });
      }
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  return results;
}
