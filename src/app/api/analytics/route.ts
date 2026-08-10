import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch all item splits for the user
  const splits = await db.itemSplit.findMany({
    where: { userId },
    include: {
      expenseItem: {
        include: {
          expense: {
            select: {
              id: true,
              title: true,
              category: true,
              expenseDate: true,
              group: { select: { id: true, name: true, type: true, customType: true } },
            },
          },
        },
      },
    },
  });

  function formatCategoryFromGroup(type?: string | null, customType?: string | null): string {
    if (!type) return "Other";
    if (type === "GROCERY") return "Grocery";
    if (type === "RESTAURANT") return "Food";
    if (type === "VACATION") return "Travel";
    if (type === "SHOPPING") return "Shopping";
    if (type === "OTHER") {
      return customType && customType.trim() ? customType.trim() : "Other";
    }
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }

  // Aggregate stats
  const categoryTotals: Record<string, number> = {};
  const monthlyTotals: Record<string, number> = {};
  const groupTotals: Record<string, { id: string; name: string; type: string; amount: number }> = {};
  let totalUserSpent = 0;
  let foodSpent = 0;

  const itemDetails: any[] = [];

  splits.forEach((split) => {
    const share = Number(split.shareAmount || 0);
    const item = split.expenseItem;

    // Exclude payback settlements from spending analytics
    if (item.expense.category === "SETTLEMENT") return;

    const group = item.expense.group;
    const category = formatCategoryFromGroup(group?.type, (group as any)?.customType);
    const dateObj = new Date(item.expense.expenseDate);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

    totalUserSpent += share;
    categoryTotals[category] = (categoryTotals[category] || 0) + share;
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + share;

    if (group?.id) {
      if (!groupTotals[group.id]) {
        groupTotals[group.id] = { id: group.id, name: group.name, type: group.type, amount: 0 };
      }
      groupTotals[group.id].amount += share;
    }

    if (category.toLowerCase() === "food" || category.toLowerCase() === "restaurant") {
      foodSpent += share;
    }

    itemDetails.push({
      date: dateObj.toISOString().slice(0, 10),
      expenseTitle: item.expense.title,
      itemName: item.name,
      category,
      groupName: group?.name || "General",
      shareAmount: Math.round(share * 100) / 100,
    });
  });

  const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
    percentage: totalUserSpent > 0 ? Math.round((amount / totalUserSpent) * 100) : 0,
  }));

  const groupBreakdown = Object.values(groupTotals).map((g) => ({
    ...g,
    amount: Math.round(g.amount * 100) / 100,
    percentage: totalUserSpent > 0 ? Math.round((g.amount / totalUserSpent) * 100) : 0,
  }));

  const monthlyTrend = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

  return NextResponse.json({
    totalUserSpent: Math.round(totalUserSpent * 100) / 100,
    foodSpent: Math.round(foodSpent * 100) / 100,
    categoryBreakdown,
    groupBreakdown,
    monthlyTrend,
    itemDetails,
  });
}
