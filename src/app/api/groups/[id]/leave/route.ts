import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateGroupBalances } from "@/lib/balances";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const currentUserId = session.user.id;

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.targetUserId || currentUserId;

    // Verify current user membership
    const currentMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUserId } },
    });

    if (!currentMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If removing someone else, current user must be ADMIN
    if (targetUserId !== currentUserId && currentMembership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only group admins can remove members" },
        { status: 403 }
      );
    }

    // Get group with all expenses to calculate balances
    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        expenses: {
          include: {
            items: {
              include: {
                splits: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Calculate balances
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

    const balancesData = calculateGroupBalances(memberSummaries, formattedExpenses);
    const targetUserBalance = balancesData.userBalances.find(
      (ub) => ub.user.id === targetUserId
    );

    const netBalance = targetUserBalance ? targetUserBalance.netBalance : 0;

    // Check if net balance is 0
    if (Math.abs(netBalance) > 0.01) {
      const currency = group.currency || "₹";
      const formattedAmt = `${currency}${Math.abs(netBalance)}`;
      const roleText = targetUserId === currentUserId ? "You cannot leave" : "Cannot remove member";
      const reasonText =
        netBalance > 0
          ? `${roleText} because they are owed ${formattedAmt}. Please settle balances first.`
          : `${roleText} because they owe ${formattedAmt}. Please settle balances first.`;

      return NextResponse.json({ error: reasonText }, { status: 400 });
    }

    // Prevent removing the sole ADMIN unless they are the last member
    const targetMembership = group.members.find((m) => m.userId === targetUserId);
    if (targetMembership?.role === "ADMIN") {
      const adminCount = group.members.filter((m) => m.role === "ADMIN").length;
      if (adminCount === 1 && group.members.length > 1) {
        return NextResponse.json(
          {
            error:
              "You are the sole admin of this group. Make another member an admin before leaving.",
          },
          { status: 400 }
        );
      }
    }

    // Remove member
    await db.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error leaving/removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
