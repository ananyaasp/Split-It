"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScanReceiptModal } from "@/components/expenses/scan-receipt-modal";

interface UserSummary {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface GroupMember {
  id: string;
  role: string;
  user: UserSummary;
}

interface ItemSplit {
  id: string;
  userId: string;
  shareAmount: number | null;
  user: UserSummary;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  payerId: string;
  splitType: string;
  payer: UserSummary;
  splits: ItemSplit[];
}

interface Expense {
  id: string;
  title: string;
  category: string | null;
  expenseDate: string;
  createdBy: UserSummary;
  items: ExpenseItem[];
}

interface GroupData {
  id: string;
  name: string;
  type: string;
  customType?: string | null;
  description: string | null;
  currency?: string;
  inviteCode?: string | null;
  simplifyDebts?: boolean;
  membersCanEdit?: boolean;
  members: GroupMember[];
  expenses: Expense[];
}

interface PairwiseDebt {
  fromUser: UserSummary;
  toUser: UserSummary;
  amount: number;
}

interface UserBalance {
  user: UserSummary;
  paidTotal: number;
  shareTotal: number;
  netBalance: number;
}

interface ItemBreakdownLog {
  itemId: string;
  itemName: string;
  itemAmount: number;
  payer: UserSummary;
  expenseTitle: string;
  expenseDate: string | Date;
  splits: {
    user: UserSummary;
    shareAmount: number;
    owesPayerAmount: number;
  }[];
}

interface BalancesData {
  userBalances: UserBalance[];
  pairwiseDebts: PairwiseDebt[];
  simplifiedDebts: PairwiseDebt[];
  itemLogs: ItemBreakdownLog[];
}

interface GroupDetailClientProps {
  group: GroupData;
  balances: BalancesData;
  currentUserId: string;
}

const typeIcons: Record<string, string> = {
  RESTAURANT: "🍕 Restaurant",
  VACATION: "✈️ Vacation",
  GROCERY: "🛒 Grocery",
  SHOPPING: "🛍️ Shopping",
  OTHER: "📦 Other",
};

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500";
const INPUT_SM_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500";
const SELECT_SM_CLASS =
  "rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

interface LineItemForm {
  name: string;
  amount: string;
  payerId: string;
  splitType: string;
  selectedUsers: string[];
  customShares: Record<string, string>;
}

export function GroupDetailClient({
  group: initialGroup,
  balances: initialBalances,
  currentUserId,
}: GroupDetailClientProps) {
  const router = useRouter();

  // Live data state (for real-time polling)
  const [group, setGroup] = useState(initialGroup);
  const [balances, setBalances] = useState(initialBalances);

  const curr = group.currency || "₹";

  const [activeTab, setActiveTab] = useState<
    "activity" | "balances" | "analytics" | "members" | "settings"
  >("activity");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [useSimplified, setUseSimplified] = useState(group.simplifyDebts !== false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Nudge state
  const [nudgeStatus, setNudgeStatus] = useState<Record<string, string>>({});

  const handleSendNudge = async (debt: PairwiseDebt, index: number) => {
    const key = `${debt.fromUser.id}_${debt.toUser.id}_${index}`;
    setNudgeStatus((prev) => ({ ...prev, [key]: "Sending..." }));

    try {
      const res = await fetch(`/api/groups/${group.id}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtorId: debt.fromUser.id,
          debtorEmail: debt.fromUser.email,
          debtorName: debt.fromUser.name,
          amount: debt.amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send nudge");
      }

      setNudgeStatus((prev) => ({ ...prev, [key]: "✓ Nudge Sent!" }));
      setTimeout(() => {
        setNudgeStatus((prev) => ({ ...prev, [key]: "" }));
      }, 3000);
    } catch (err: any) {
      alert(err.message);
      setNudgeStatus((prev) => ({ ...prev, [key]: "" }));
    }
  };

  // Member leave/remove state
  const [memberActionError, setMemberActionError] = useState("");
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  // Expense form state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Grocery");
  const [scannedMerchantName, setScannedMerchantName] = useState<string | null>(null);
  const [samePayerForAll, setSamePayerForAll] = useState(true);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    {
      name: "",
      amount: "",
      payerId: currentUserId,
      splitType: "EQUAL",
      selectedUsers: initialGroup.members.map((m) => m.user.id),
      customShares: {},
    },
  ]);
  const [expenseError, setExpenseError] = useState("");
  const [expenseLoading, setExpenseLoading] = useState(false);

  // Add Member state
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);

  // Settings form state
  const [settingsName, setSettingsName] = useState(group.name);
  const [settingsType, setSettingsType] = useState(group.type);
  const [settingsCustomType, setSettingsCustomType] = useState(group.customType || "");
  const [settingsCurrency, setSettingsCurrency] = useState(group.currency || "₹");
  const [settingsDescription, setSettingsDescription] = useState(group.description || "");
  const [settingsSimplifyDebts, setSettingsSimplifyDebts] = useState(group.simplifyDebts !== false);
  const [settingsMembersCanEdit, setSettingsMembersCanEdit] = useState(group.membersCanEdit !== false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Real-time Polling
  const fetchGroupData = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${initialGroup.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.group && data.balances) {
        const serializedGroup = {
          ...data.group,
          expenses: data.group.expenses.map((exp: any) => ({
            ...exp,
            expenseDate:
              typeof exp.expenseDate === "string"
                ? exp.expenseDate
                : new Date(exp.expenseDate).toISOString(),
            items: exp.items.map((item: any) => ({
              ...item,
              amount: Number(item.amount),
              splits: item.splits.map((s: any) => ({
                ...s,
                shareAmount: s.shareAmount ? Number(s.shareAmount) : null,
                shareRatio: s.shareRatio ? Number(s.shareRatio) : null,
              })),
            })),
          })),
        };
        setGroup(serializedGroup);
        setBalances(data.balances);
      }
    } catch {
      // ignore
    }
  }, [initialGroup.id]);

  useEffect(() => {
    const interval = setInterval(fetchGroupData, 5000);
    return () => clearInterval(interval);
  }, [fetchGroupData]);

  useEffect(() => {
    const onFocus = () => fetchGroupData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchGroupData]);

  // Permissions
  const currentMemberRecord = group.members.find((m) => m.user.id === currentUserId);
  const isAdmin = currentMemberRecord?.role === "ADMIN";
  const canAddExpenses = isAdmin || group.membersCanEdit !== false;

  // Debt Simplification
  const rawDebtCount = balances.pairwiseDebts.length;
  const simplifiedDebtCount = balances.simplifiedDebts.length;
  const simplificationHelps = simplifiedDebtCount < rawDebtCount && rawDebtCount > 1;
  const displayedDebts = useSimplified ? balances.simplifiedDebts : balances.pairwiseDebts;

  // Copy Invite Link
  const handleCopyInvite = () => {
    if (!group.inviteCode) return;
    const url = `${window.location.origin}/join/${group.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Line Item Handlers
  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseTitle("");
    setExpenseCategory(group.type && group.type !== "OTHER" ? group.type : "Grocery");
    setScannedMerchantName(null);
    setLineItems([
      {
        name: "",
        amount: "",
        payerId: currentUserId,
        splitType: "EQUAL",
        selectedUsers: group.members.map((m) => m.user.id),
        customShares: {},
      },
    ]);
    setExpenseError("");
  };

  const openAddExpense = () => {
    resetExpenseForm();
    setIsExpenseModalOpen(true);
  };

  // Handle items extracted from AI receipt scan
  const handleScannedItems = (
    items: { name: string; amount: number }[],
    tax = 0,
    merchant?: string | null
  ) => {
    const allMemberIds = group.members.map((m) => m.user.id);
    const newLineItems: LineItemForm[] = items.map((item) => ({
      name: item.name,
      amount: String(item.amount),
      payerId: currentUserId,
      splitType: "EQUAL" as const,
      selectedUsers: [...allMemberIds],
      customShares: {} as Record<string, string>,
    }));

    if (tax > 0) {
      // Default: Proportional Pro-Rata Tax Split
      const taxAmount = Math.round(tax * 100) / 100;
      const initialCustomShares: Record<string, string> = {};
      const perMemberShare = (taxAmount / allMemberIds.length).toFixed(2);
      
      allMemberIds.forEach((id) => {
        initialCustomShares[id] = perMemberShare;
      });

      newLineItems.push({
        name: "Tax / Service Charge",
        amount: String(taxAmount),
        payerId: currentUserId,
        splitType: "CUSTOM" as const,
        selectedUsers: [...allMemberIds],
        customShares: initialCustomShares,
      });
    }

    const shortTitle = merchant
      ? merchant
      : items.length === 1
      ? items[0].name
      : `${items[0].name} + ${items.length - 1} items`;

    setExpenseTitle(shortTitle);
    setExpenseCategory("Grocery");
    setScannedMerchantName(merchant || null);
    setLineItems(newLineItems);
    setEditingExpenseId(null);
    setExpenseError("");
    setIsExpenseModalOpen(true);
  };

  // Automatically calculate proportional tax shares based on non-tax line item subtotals
  const autoCalculateTaxShares = useCallback(
    (items: LineItemForm[]): LineItemForm[] => {
      // Find tax item index
      const taxIdx = items.findIndex(
        (item) =>
          item.splitType === "CUSTOM" &&
          (item.name.toLowerCase().includes("tax") ||
            item.name.toLowerCase().includes("service charge") ||
            item.name.toLowerCase().includes("gst"))
      );

      if (taxIdx === -1) return items;

      const taxAmt = parseFloat(items[taxIdx].amount || "0");
      if (isNaN(taxAmt) || taxAmt <= 0) return items;

      // Calculate each user's subtotal from non-tax items
      const userSubtotals: Record<string, number> = {};
      let totalFoodSubtotal = 0;

      items.forEach((item, idx) => {
        if (idx === taxIdx) return;
        const itemAmt = parseFloat(item.amount || "0");
        if (isNaN(itemAmt) || itemAmt <= 0 || item.selectedUsers.length === 0) return;

        if (item.splitType === "CUSTOM") {
          item.selectedUsers.forEach((uId) => {
            const share = parseFloat(item.customShares[uId] || "0");
            if (!isNaN(share) && share > 0) {
              userSubtotals[uId] = (userSubtotals[uId] || 0) + share;
              totalFoodSubtotal += share;
            }
          });
        } else {
          const perPerson = itemAmt / item.selectedUsers.length;
          item.selectedUsers.forEach((uId) => {
            userSubtotals[uId] = (userSubtotals[uId] || 0) + perPerson;
            totalFoodSubtotal += perPerson;
          });
        }
      });

      if (totalFoodSubtotal <= 0) return items;

      // Build updated items list with new proportional tax shares
      const updated = items.map((it) => ({
        ...it,
        customShares: { ...it.customShares },
      }));
      const newCustomShares: Record<string, string> = {};
      const activeUsers: string[] = [];

      group.members.forEach((m) => {
        const userSub = userSubtotals[m.user.id] || 0;
        if (userSub > 0) {
          activeUsers.push(m.user.id);
          const propTax = (userSub / totalFoodSubtotal) * taxAmt;
          newCustomShares[m.user.id] = (Math.round(propTax * 100) / 100).toFixed(2);
        }
      });

      updated[taxIdx] = {
        ...updated[taxIdx],
        selectedUsers: activeUsers.length > 0 ? activeUsers : group.members.map((m) => m.user.id),
        customShares: newCustomShares,
      };

      return updated;
    },
    [group.members]
  );

  const openEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseCategory(expense.category || "Grocery");
    setLineItems(
      expense.items.map((item) => ({
        name: item.name,
        amount: String(Number(item.amount)),
        payerId: item.payerId,
        splitType: item.splitType,
        selectedUsers: item.splits.map((s) => s.userId),
        customShares: item.splits.reduce(
          (acc, s) => ({ ...acc, [s.userId]: String(Number(s.shareAmount || 0)) }),
          {} as Record<string, string>
        ),
      }))
    );
    setExpenseError("");
    setIsExpenseModalOpen(true);
  };

  const handleAddLineItem = () => {
    const newItems = [
      ...lineItems,
      {
        name: "",
        amount: "",
        payerId: currentUserId,
        splitType: "EQUAL",
        selectedUsers: group.members.map((m) => m.user.id),
        customShares: {},
      },
    ];
    setLineItems(autoCalculateTaxShares(newItems));
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(autoCalculateTaxShares(newItems));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    setLineItems(autoCalculateTaxShares(updated));
  };

  const toggleUserForLineItem = (itemIndex: number, userId: string) => {
    const updated = [...lineItems];
    const current = updated[itemIndex].selectedUsers;
    if (current.includes(userId)) {
      if (current.length === 1) return;
      updated[itemIndex].selectedUsers = current.filter((id) => id !== userId);
    } else {
      updated[itemIndex].selectedUsers = [...current, userId];
    }
    setLineItems(autoCalculateTaxShares(updated));
  };

  // Submit Expense
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError("");
    setExpenseLoading(true);

    try {
      const formattedItems = lineItems.map((item) => {
        const amountNum = parseFloat(item.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error(`Please enter a valid amount for "${item.name || "Item"}"`);
        }

        const splits = item.selectedUsers.map((uId) => ({
          userId: uId,
          shareAmount:
            item.splitType === "CUSTOM"
              ? parseFloat(item.customShares[uId] || "0")
              : 0,
        }));

        return {
          name: item.name || "Item",
          amount: amountNum,
          payerId: item.payerId,
          splitType: item.splitType,
          splits,
        };
      });

      const isEditing = !!editingExpenseId;
      const url = isEditing
        ? `/api/groups/${group.id}/expenses?expenseId=${editingExpenseId}`
        : `/api/groups/${group.id}/expenses`;
      const method = isEditing ? "PUT" : "POST";
      
      let autoTitle = "Expense";
      if (scannedMerchantName) {
        autoTitle = scannedMerchantName;
      } else if (formattedItems.length === 1) {
        autoTitle = formattedItems[0].name;
      } else if (formattedItems.length === 2) {
        autoTitle = `${formattedItems[0].name} & ${formattedItems[1].name}`;
      } else if (formattedItems.length > 2) {
        const nonTaxItems = formattedItems.filter(
          (i: any) =>
            !i.name.toLowerCase().includes("tax") &&
            !i.name.toLowerCase().includes("service charge")
        );
        if (nonTaxItems.length >= 2) {
          autoTitle = `${nonTaxItems[0].name}, ${nonTaxItems[1].name} +${formattedItems.length - 2} items`;
        } else {
          autoTitle = `${formattedItems[0].name} +${formattedItems.length - 1} items`;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: autoTitle || "Expense",
          category: expenseCategory,
          items: formattedItems,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned error (${res.status}). Please try again.`);
      }

      if (!res.ok) throw new Error(data.error || "Failed to save expense");

      setIsExpenseModalOpen(false);
      resetExpenseForm();
      await fetchGroupData();
    } catch (err: any) {
      setExpenseError(err.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setMemberLoading(true);
    setMemberError("");
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member(s)");
      
      setIsAddMemberOpen(false);
      setMemberEmail("");
      await fetchGroupData();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setMemberLoading(false);
    }
  };

  // Leave / Remove Member
  const handleLeaveOrRemoveMember = async (targetUserId?: string) => {
    const isSelf = !targetUserId || targetUserId === currentUserId;
    const targetName = isSelf
      ? "you"
      : group.members.find((m) => m.user.id === targetUserId)?.user.name || "member";

    const promptText = isSelf
      ? "Are you sure you want to leave this group?"
      : `Are you sure you want to remove ${targetName} from the group?`;

    if (!confirm(promptText)) return;

    setMemberActionLoading(true);
    setMemberActionError("");

    try {
      const res = await fetch(`/api/groups/${group.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process request");
      }

      if (isSelf) {
        router.push("/groups");
        router.refresh();
      } else {
        await fetchGroupData();
      }
    } catch (err: any) {
      setMemberActionError(err.message);
    } finally {
      setMemberActionLoading(false);
    }
  };

  // Export Group Expenses & Tallies to CSV
  const handleExportGroupCSV = () => {
    const headers = ["Date", "Group", "Item Name", "Category", "Item Amount (₹)", "Payer", "Split Share Details"];
    const rows: string[][] = [];

    group.expenses.forEach((expense) => {
      expense.items.forEach((item) => {
        const payerName = group.members.find((m) => m.user.id === item.payerId)?.user.name || "Unknown";
        const splitInfo = item.splits
          .map((s) => {
            const uName = group.members.find((m) => m.user.id === s.userId)?.user.name || "Member";
            return `${uName}: ${curr}${s.shareAmount}`;
          })
          .join("; ");

        const groupCat = group.type === "OTHER" && group.customType ? group.customType : (group.type ? group.type.charAt(0).toUpperCase() + group.type.slice(1).toLowerCase() : "Other");

        rows.push([
          `"${new Date(expense.expenseDate).toISOString().slice(0, 10)}"`,
          `"${group.name.replace(/"/g, '""')}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${groupCat}"`,
          String(item.amount),
          `"${payerName.replace(/"/g, '""')}"`,
          `"${splitInfo.replace(/"/g, '""')}"`,
        ]);
      });
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${group.name.replace(/[^a-z0-9]/gi, "_")}_statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Group Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsLoading(true);

    try {
      const res = await fetch(`/api/groups/${group.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName,
          type: settingsType,
          customType: settingsCustomType,
          currency: settingsCurrency,
          description: settingsDescription,
          simplifyDebts: settingsSimplifyDebts,
          membersCanEdit: settingsMembersCanEdit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSettingsSuccess("Group settings saved successfully!");
      await fetchGroupData();
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Delete Group
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/groups/${group.id}/expenses?expenseId=${expenseId}`, {
        method: "DELETE",
      });
      if (res.ok) await fetchGroupData();
    } catch (err) {
      console.error(err);
    }
  };

  // Settle Up
  const handleSettleUp = async (debt: PairwiseDebt) => {
    if (!confirm(`Record settlement: ${debt.fromUser.name} paid ${curr}${debt.amount} to ${debt.toUser.name}?`))
      return;
    try {
      const res = await fetch(`/api/groups/${group.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Settlement: ${debt.fromUser.name} → ${debt.toUser.name}`,
          category: "SETTLEMENT",
          items: [
            {
              name: "Settlement Payment",
              amount: debt.amount,
              payerId: debt.fromUser.id,
              splitType: "FULL",
              splits: [{ userId: debt.toUser.id }],
            },
          ],
        }),
      });
      if (res.ok) await fetchGroupData();
    } catch (err) {
      console.error(err);
    }
  };

  const totalGroupSpent = group.expenses.reduce(
    (acc, exp) => acc + exp.items.reduce((s, item) => s + Number(item.amount), 0),
    0
  );

  // Filtered Expenses by Search Query
  const filteredExpenses = group.expenses.filter((exp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = exp.title.toLowerCase().includes(q);
    const itemMatch = exp.items.some((i) => i.name.toLowerCase().includes(q));
    const payerMatch = exp.items.some((i) => i.payer.name.toLowerCase().includes(q));
    return titleMatch || itemMatch || payerMatch;
  });

  const categoryBadgeText =
    group.type === "OTHER" && group.customType
      ? `📦 ${group.customType}`
      : typeIcons[group.type] ?? group.type;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Group Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                {group.name}
              </h1>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {categoryBadgeText}
              </span>
            </div>
            {group.description && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {group.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs font-medium text-zinc-500">
              <span>{group.members.length} Members</span>
              <span>•</span>
              <span>
                Total Spent: {curr}
                {totalGroupSpent.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {group.inviteCode && (
              <button
                onClick={handleCopyInvite}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
              >
                {copiedLink ? "✓ Link Copied!" : "🔗 Invite Link"}
              </button>
            )}
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors"
            >
              + Add Member
            </button>
            <button
              onClick={handleExportGroupCSV}
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors flex items-center gap-1.5"
            >
              📥 Export CSV
            </button>
            {canAddExpenses && (
              <>
                <button
                  onClick={() => setIsScanModalOpen(true)}
                  className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors flex items-center gap-1.5"
                >
                  ⚡ Scan Bill
                </button>
                <button
                  onClick={openAddExpense}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  + Add Expense
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {[
            {
              key: "activity" as const,
              label: `Expenses (${group.expenses.length})`,
            },
            { key: "balances" as const, label: "Balances & Debts" },
            { key: "analytics" as const, label: "Analytics" },
            {
              key: "members" as const,
              label: `Members (${group.members.length})`,
            },
            ...(isAdmin
              ? [{ key: "settings" as const, label: "Settings ⚙️" }]
              : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== TAB 1: Activity (Expenses) ========== */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Search Bar */}
          {group.expenses.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search expenses or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {filteredExpenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {searchQuery ? "No matching expenses found" : "No expenses logged yet"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {searchQuery
                  ? "Try searching for a different item name or payer."
                  : 'Click "+ Add Expense" to start tracking items and splits.'}
              </p>
              {canAddExpenses && !searchQuery && (
                <button
                  onClick={openAddExpense}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500"
                >
                  + Add Expense
                </button>
              )}
            </div>
          ) : (
            filteredExpenses.map((expense) => {
              const expTotal = expense.items.reduce(
                (sum, item) => sum + Number(item.amount),
                0
              );
              const isSettlement = expense.category === "SETTLEMENT";

              return (
                <div
                  key={expense.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                          {expense.title}
                        </h3>
                        {isSettlement && (
                          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            Settlement
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Added by {expense.createdBy.name} on{" "}
                        {new Date(expense.expenseDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Total</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {curr}
                          {expTotal.toLocaleString()}
                        </p>
                      </div>
                      {canAddExpenses && !isSettlement && (
                        <button
                          onClick={() => openEditExpense(expense)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                          title="Edit expense"
                        >
                          ✏️
                        </button>
                      )}
                      {(expense.createdBy.id === currentUserId || isAdmin) && (
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          title="Delete expense"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {isSettlement ? (
                    <div className="p-4 flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-950/10">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        <span>🤝 {expense.items[0]?.payer.name || expense.createdBy.name} paid {curr}{expTotal.toLocaleString()} to {expense.items[0]?.splits[0]?.user.name || "member"}</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ✓ Debt Settled
                      </span>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 p-4 dark:divide-zinc-800">
                      {expense.items.map((item) => (
                        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {item.name}
                              </span>
                              <span className="ml-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                                Paid by {item.payer.name}
                              </span>
                            </div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-50">
                              {curr}
                              {Number(item.amount).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {item.splits.map((split) => {
                              const isPayer = split.userId === item.payerId;
                              const share = Number(split.shareAmount || 0);
                              return (
                                <span
                                  key={split.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
                                >
                                  <span className="font-medium">{split.user.name}:</span>
                                  <span>
                                    {curr}
                                    {share.toLocaleString()}
                                  </span>
                                  {!isPayer && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                      (owes {item.payer.name.split(" ")[0]} {curr}
                                      {share})
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========== TAB 2: Balances ========== */}
      {activeTab === "balances" && (
        <div className="space-y-6">
          {simplificationHelps && !useSimplified && (
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  💡 Debt simplification can reduce {rawDebtCount} transactions to{" "}
                  {simplifiedDebtCount}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Fewer payments needed to settle up within the group.
                </p>
              </div>
              <button
                onClick={() => setUseSimplified(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Enable
              </button>
            </div>
          )}

          {useSimplified && (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Debt Simplification
                </h3>
                <p className="text-xs text-zinc-500">
                  Minimizing total transactions between members.
                </p>
              </div>
              <button
                onClick={() => setUseSimplified(false)}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-600 transition-colors"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 transition-transform" />
              </button>
            </div>
          )}

          {/* Owed Summary */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Who Owes Who
            </h3>
            {displayedDebts.length === 0 ? (
              <p className="text-center py-6 text-sm text-zinc-500">
                🎉 All settled up! No outstanding debts.
              </p>
            ) : (
              <div className="space-y-3">
                {displayedDebts.map((debt, i) => {
                  const isYouDebtor = debt.fromUser.id === currentUserId;
                  const isYouCreditor = debt.toUser.id === currentUserId;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold text-sm">
                          💸
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            <span className={isYouDebtor ? "text-red-600 font-bold" : ""}>
                              {isYouDebtor ? "You" : debt.fromUser.name}
                            </span>{" "}
                            owes{" "}
                            <span
                              className={isYouCreditor ? "text-emerald-600 font-bold" : ""}
                            >
                              {isYouCreditor ? "You" : debt.toUser.name}
                            </span>
                          </p>
                          <p className="text-xs text-zinc-500">Net pending balance</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                          {curr}
                          {debt.amount.toLocaleString()}
                        </span>
                        {isYouCreditor && (
                          <button
                            onClick={() => handleSendNudge(debt, i)}
                            disabled={!!nudgeStatus[`${debt.fromUser.id}_${debt.toUser.id}_${i}`]}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 disabled:opacity-60 transition-colors"
                          >
                            {nudgeStatus[`${debt.fromUser.id}_${debt.toUser.id}_${i}`] || "Send Nudge 🔔"}
                          </button>
                        )}
                        <button
                          onClick={() => handleSettleUp(debt)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Settle Up
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Member Net Balances */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-4">
              Member Net Balances
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {balances.userBalances.map((ub) => {
                const isPositive = ub.netBalance > 0;
                const isZero = Math.abs(ub.netBalance) <= 0.01;
                return (
                  <div
                    key={ub.user.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                        {ub.user.name} {ub.user.id === currentUserId ? "(You)" : ""}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Paid {curr}
                        {ub.paidTotal} • Share {curr}
                        {ub.shareTotal}
                      </p>
                    </div>
                    <span
                      className={`font-bold text-sm ${
                        isZero
                          ? "text-zinc-400"
                          : isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isZero
                        ? "Settled"
                        : isPositive
                        ? `+${curr}${ub.netBalance}`
                        : `-${curr}${Math.abs(ub.netBalance)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB 3: Analytics ========== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Member Spending & Share Breakdown
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Comparison of cash paid out-of-pocket vs. actual consumed shares for all members.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportGroupCSV}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition-colors flex items-center gap-1"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            {group.members.length === 0 ? (
              <p className="text-sm text-zinc-500">No members available.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Total Paid (Out-of-Pocket)</th>
                      <th className="py-3 px-4">Share Consumed (Ate/Used)</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {group.members.map((m) => {
                      const userId = m.user.id;
                      let totalPaid = 0;
                      let shareConsumed = 0;

                      group.expenses.forEach((exp) => {
                        if (exp.category === "SETTLEMENT") return;
                        exp.items.forEach((item) => {
                          if (item.payerId === userId) {
                            totalPaid += Number(item.amount);
                          }
                          item.splits.forEach((split) => {
                            if (split.userId === userId) {
                              shareConsumed += Number(split.shareAmount || 0);
                            }
                          });
                        });
                      });

                      const netBalance = Math.round((totalPaid - shareConsumed) * 100) / 100;
                      const isGetsBack = netBalance > 0.01;
                      const isOwes = netBalance < -0.01;

                      return (
                        <tr key={userId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                            {m.user.name} {userId === currentUserId && <span className="text-xs text-zinc-400 font-normal">(You)</span>}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-emerald-600 dark:text-emerald-400">
                            {curr}{totalPaid.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                            {curr}{shareConsumed.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isGetsBack ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                +{curr}{Math.abs(netBalance).toLocaleString()} (Gets back)
                              </span>
                            ) : isOwes ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                                -{curr}{Math.abs(netBalance).toLocaleString()} (Owes)
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Visual Charts: Group Category Distribution & Member Consumption Breakdown */}
            {group.expenses.length > 0 && (() => {
              const catTotals: Record<string, number> = {};
              const memberConsumedMap: Record<string, { name: string; share: number }> = {};
              let grandTotal = 0;

              group.members.forEach((m) => {
                memberConsumedMap[m.user.id] = { name: m.user.name, share: 0 };
              });

              group.expenses.forEach((exp) => {
                if (exp.category === "SETTLEMENT") return;
                exp.items.forEach((item) => {
                  const amt = Number(item.amount);
                  const cat = group.type === "OTHER" && group.customType ? group.customType : (group.type ? group.type.charAt(0).toUpperCase() + group.type.slice(1).toLowerCase() : "Other");
                  catTotals[cat] = (catTotals[cat] || 0) + amt;
                  grandTotal += amt;

                  item.splits.forEach((s) => {
                    if (memberConsumedMap[s.userId]) {
                      memberConsumedMap[s.userId].share += Number(s.shareAmount || 0);
                    }
                  });
                });
              });

              const categoryList = Object.entries(catTotals).map(([cat, amt]) => ({
                category: cat,
                amount: Math.round(amt * 100) / 100,
                percentage: grandTotal > 0 ? Math.round((amt / grandTotal) * 100) : 0,
              }));

              const memberList = Object.values(memberConsumedMap).map((m) => ({
                name: m.name,
                share: Math.round(m.share * 100) / 100,
                percentage: grandTotal > 0 ? Math.round((m.share / grandTotal) * 100) : 0,
              }));

              return (
                <div className="mt-8 grid gap-6 md:grid-cols-2 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Category Breakdown Graph */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        Category Distribution
                      </h4>
                      <p className="text-xs text-zinc-500">Group spending by expense category</p>
                    </div>
                    {categoryList.length === 0 ? (
                      <p className="text-xs text-zinc-400">No category data.</p>
                    ) : (
                      <div className="space-y-3">
                        {categoryList.map((c) => (
                          <div key={c.category} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-zinc-700 dark:text-zinc-300">{c.category}</span>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                {curr}{c.amount.toLocaleString()} ({c.percentage}%)
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${c.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Member Consumed Share Graph */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        Member Consumption Share
                      </h4>
                      <p className="text-xs text-zinc-500">% of total bills consumed by each member</p>
                    </div>
                    {memberList.length === 0 ? (
                      <p className="text-xs text-zinc-400">No member data.</p>
                    ) : (
                      <div className="space-y-3">
                        {memberList.map((m) => (
                          <div key={m.name} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-zinc-700 dark:text-zinc-300">{m.name}</span>
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                {curr}{m.share.toLocaleString()} ({m.percentage}%)
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${m.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========== TAB 4: Members ========== */}
      {activeTab === "members" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          {memberActionError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
              {memberActionError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Group Members
            </h3>
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500"
            >
              + Add Member
            </button>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {group.members.map((m) => {
              const isSelf = m.user.id === currentUserId;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs dark:bg-emerald-950 dark:text-emerald-300">
                      {m.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {m.user.name} {isSelf ? "(You)" : ""}
                      </p>
                      <p className="text-xs text-zinc-500">{m.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {m.role}
                    </span>

                    {/* Leave or Remove Button */}
                    {isSelf ? (
                      <button
                        onClick={() => handleLeaveOrRemoveMember()}
                        disabled={memberActionLoading}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-400"
                      >
                        Leave Group
                      </button>
                    ) : (
                      isAdmin && (
                        <button
                          onClick={() => handleLeaveOrRemoveMember(m.user.id)}
                          disabled={memberActionLoading}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                        >
                          Remove
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== TAB 5: Group Settings (Admin Only) ========== */}
      {activeTab === "settings" && isAdmin && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Group Settings
            </h3>
            <p className="text-xs text-zinc-500">
              Manage group metadata, currency, and member permissions.
            </p>
          </div>

          {settingsSuccess && (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              ✓ {settingsSuccess}
            </div>
          )}

          {settingsError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
              {settingsError}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                Group Name *
              </label>
              <input
                type="text"
                required
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                  Category
                </label>
                <select
                  value={settingsType}
                  onChange={(e) => setSettingsType(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="RESTAURANT">Restaurant 🍕</option>
                  <option value="VACATION">Vacation ✈️</option>
                  <option value="GROCERY">Grocery 🛒</option>
                  <option value="SHOPPING">Shopping 🛍️</option>
                  <option value="OTHER">Other 📦</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                  Currency Symbol
                </label>
                <select
                  value={settingsCurrency}
                  onChange={(e) => setSettingsCurrency(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="₹">₹ (INR)</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                </select>
              </div>
            </div>

            {settingsType === "OTHER" && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                  Custom Category Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Movie Night, Birthday"
                  value={settingsCustomType}
                  onChange={(e) => setSettingsCustomType(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                Description
              </label>
              <input
                type="text"
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Allow members to add expenses
                </p>
                <p className="text-[11px] text-zinc-500">
                  If off, only group admins can add or edit expenses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsMembersCanEdit(!settingsMembersCanEdit)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settingsMembersCanEdit
                    ? "bg-emerald-600"
                    : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settingsMembersCanEdit ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Simplify debts automatically
                </p>
                <p className="text-[11px] text-zinc-500">
                  Minimizes the total number of transactions between members.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsSimplifyDebts(!settingsSimplifyDebts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settingsSimplifyDebts
                    ? "bg-emerald-600"
                    : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settingsSimplifyDebts ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={settingsLoading}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
              >
                {settingsLoading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========== ADD/EDIT EXPENSE MODAL ========== */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {editingExpenseId ? "Edit Expense" : "Add Expense"}
              </h2>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {expenseError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {expenseError}
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="mt-4 space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                    Items & Split Details
                  </h3>
                  <div className="flex items-center gap-3">
                    {!editingExpenseId && (
                      <button
                        type="button"
                        onClick={() => setIsScanModalOpen(true)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center gap-1"
                      >
                        📷 Scan Receipt
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Global Payer Selector for all line items */}
                {lineItems.length > 1 && (
                  <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          💳 Did 1 Person Pay the Entire Bill?
                        </label>
                        <p className="text-[11px] text-zinc-500">
                          Turn off if different members paid for different items
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSamePayerForAll(!samePayerForAll)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          samePayerForAll ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            samePayerForAll ? "translate-x-4.5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {samePayerForAll && (
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                        <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                          Payer for all items:
                        </span>
                        <select
                          value={lineItems[0]?.payerId || currentUserId}
                          onChange={(e) => {
                            const newPayerId = e.target.value;
                            const updated = lineItems.map((item) => ({ ...item, payerId: newPayerId }));
                            setLineItems(updated);
                          }}
                          className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                        >
                          {group.members.map((m) => (
                            <option key={m.user.id} value={m.user.id}>
                              {m.user.name} {m.user.id === currentUserId ? "(You)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Item #{idx + 1}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className={`grid gap-3 ${!samePayerForAll || lineItems.length === 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Item Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Pasta"
                          value={item.name}
                          onChange={(e) => updateLineItem(idx, "name", e.target.value)}
                          className={INPUT_SM_CLASS}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Amount ({curr})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="300"
                          value={item.amount}
                          onChange={(e) => updateLineItem(idx, "amount", e.target.value)}
                          className={INPUT_SM_CLASS}
                        />
                      </div>
                      {(!samePayerForAll || lineItems.length === 1) && (
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                            Who Paid?
                          </label>
                          <select
                            value={item.payerId}
                            onChange={(e) => updateLineItem(idx, "payerId", e.target.value)}
                            className={INPUT_SM_CLASS}
                          >
                            {group.members.map((m) => (
                              <option key={m.user.id} value={m.user.id}>
                                {m.user.name} {m.user.id === currentUserId ? "(You)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Split Type:
                        </label>
                        <select
                          value={item.splitType}
                          onChange={(e) => updateLineItem(idx, "splitType", e.target.value)}
                          className={SELECT_SM_CLASS}
                        >
                          <option value="EQUAL">Split Equally</option>
                          <option value="CUSTOM">Custom / Proportional</option>
                          <option value="FULL">100% to One Person</option>
                        </select>
                      </div>

                      {item.splitType === "CUSTOM" ? (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500 font-medium">Custom Amount per Member ({curr})</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.members.map((m) => (
                              <div key={m.user.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2">
                                <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate">
                                  {m.user.name}
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.customShares[m.user.id] || ""}
                                  onChange={(e) => {
                                    const updated = [...lineItems];
                                    updated[idx].customShares = {
                                      ...updated[idx].customShares,
                                      [m.user.id]: e.target.value,
                                    };
                                    setLineItems(updated);
                                  }}
                                  className="w-20 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100 text-right"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {group.members.map((m) => {
                            const isSelected = item.selectedUsers.includes(m.user.id);
                            return (
                              <button
                                type="button"
                                key={m.user.id}
                                onClick={() => toggleUserForLineItem(idx, m.user.id)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                  isSelected
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                                    : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                                }`}
                              >
                                {isSelected ? "✓ " : ""}
                                {m.user.name.split(" ")[0]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseLoading}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {expenseLoading
                    ? "Saving..."
                    : editingExpenseId
                    ? "Update Expense"
                    : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== ADD MEMBER MODAL ========== */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Add Member
              </h2>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            {memberError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
                {memberError}
              </div>
            )}
            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                  User Email(s) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="alex@example.com, sam@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tip: Separate multiple emails with commas to add multiple members at once.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={memberLoading}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {memberLoading ? "Adding..." : "Add Member(s)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========== SCAN RECEIPT MODAL ========== */}
      <ScanReceiptModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onItemsExtracted={handleScannedItems}
        currency={curr}
      />
    </div>
  );
}
