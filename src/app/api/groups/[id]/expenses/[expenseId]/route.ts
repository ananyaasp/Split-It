import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SplitType } from "@/generated/prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, expenseId } = await params;
  const currentUserId = session.user.id;

  // Verify group membership
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: currentUserId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Verify expense belongs to group
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    include: { items: { include: { splits: true } } },
  });

  if (!expense || expense.groupId !== groupId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { title, items } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Expense title is required" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }

    // Delete old items and splits, then recreate
    await db.itemSplit.deleteMany({
      where: { expenseItem: { expenseId } },
    });
    await db.expenseItem.deleteMany({
      where: { expenseId },
    });

    // Process new items
    const processedItems = items.map((item: any) => {
      const name = item.name?.trim() || "Item";
      const amount = Number(item.amount);
      const payerId = item.payerId || currentUserId;
      const splitType: SplitType = item.splitType || "EQUAL";
      const rawSplits: { userId: string; shareAmount?: number }[] = item.splits || [];

      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Invalid amount for item "${name}"`);
      }

      if (rawSplits.length === 0) {
        throw new Error(`Select at least one person to split item "${name}"`);
      }

      let formattedSplits: { userId: string; shareAmount: number; shareRatio: number }[] = [];

      if (splitType === "EQUAL") {
        const perPerson = Math.round((amount / rawSplits.length) * 100) / 100;
        formattedSplits = rawSplits.map((s) => ({
          userId: s.userId,
          shareAmount: perPerson,
          shareRatio: Math.round((1 / rawSplits.length) * 10000) / 10000,
        }));
      } else if (splitType === "FULL") {
        formattedSplits = rawSplits.map((s) => ({
          userId: s.userId,
          shareAmount: amount,
          shareRatio: 1,
        }));
      } else {
        formattedSplits = rawSplits.map((s) => {
          const share = Number(s.shareAmount || 0);
          return {
            userId: s.userId,
            shareAmount: share,
            shareRatio: amount > 0 ? Math.round((share / amount) * 10000) / 10000 : 0,
          };
        });
      }

      return { name, amount, payerId, splitType, splits: formattedSplits };
    });

    const updated = await db.expense.update({
      where: { id: expenseId },
      data: {
        title: title.trim(),
        items: {
          create: processedItems.map((item) => ({
            name: item.name,
            amount: item.amount,
            payerId: item.payerId,
            splitType: item.splitType,
            splits: {
              create: item.splits.map((s) => ({
                userId: s.userId,
                shareAmount: s.shareAmount,
                shareRatio: s.shareRatio,
              })),
            },
          })),
        },
      },
      include: {
        items: {
          include: {
            payer: { select: { id: true, name: true, email: true } },
            splits: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json({ expense: updated });
  } catch (error: any) {
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update expense" },
      { status: 400 }
    );
  }
}
