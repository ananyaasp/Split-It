import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateGroupBalances } from "@/lib/balances";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id: groupId } = await params;

  // Verify group membership
  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  if (!membership) {
    notFound();
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
    notFound();
  }

  // Auto-generate inviteCode for existing groups if null
  if (!group.inviteCode) {
    const newCode = Math.random().toString(36).substring(2, 10);
    await db.group.update({
      where: { id: group.id },
      data: { inviteCode: newCode },
    });
    group.inviteCode = newCode;
  }

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

  // Serialize Decimal objects for Client Component
  const serializedGroup = {
    ...group,
    expenses: group.expenses.map((exp) => ({
      ...exp,
      expenseDate: exp.expenseDate.toISOString(),
      items: exp.items.map((item) => ({
        ...item,
        amount: Number(item.amount),
        splits: item.splits.map((s) => ({
          ...s,
          shareAmount: s.shareAmount ? Number(s.shareAmount) : null,
          shareRatio: s.shareRatio ? Number(s.shareRatio) : null,
        })),
      })),
    })),
  };

  return (
    <GroupDetailClient
      group={serializedGroup}
      balances={balanceData}
      currentUserId={userId}
    />
  );
}
