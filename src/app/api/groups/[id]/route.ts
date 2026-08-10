import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateGroupBalances } from "@/lib/balances";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const userId = session.user.id;

  // Verify membership
  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Group not found or access denied" }, { status: 404 });
  }

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      expenses: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              payer: {
                select: { id: true, name: true, email: true, image: true },
              },
              splits: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  if (!group.inviteCode) {
    const newCode = Math.random().toString(36).substring(2, 10);
    await db.group.update({
      where: { id: group.id },
      data: { inviteCode: newCode },
    });
    (group as any).inviteCode = newCode;
  }

  // Format data for balances engine
  const memberSummaries = group.members.map((m) => m.user);

  const formattedExpenses = group.expenses.map((exp) => ({
    id: exp.id,
    title: exp.title,
    category: exp.category,
    expenseDate: exp.expenseDate,
    createdById: exp.createdById,
    items: exp.items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      payerId: item.payerId,
      splits: item.splits.map((s) => ({
        userId: s.userId,
        shareAmount: s.shareAmount ? Number(s.shareAmount) : 0,
      })),
    })),
  }));

  const balanceData = calculateGroupBalances(memberSummaries, formattedExpenses);

  return NextResponse.json({
    group,
    balances: balanceData,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const userId = session.user.id;

  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only group admins can delete the group" },
      { status: 403 }
    );
  }

  await db.group.delete({ where: { id: groupId } });

  return NextResponse.json({ success: true });
}
