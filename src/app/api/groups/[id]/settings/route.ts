import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupType } from "@/generated/prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const currentUserId = session.user.id;

  // Verify user is group ADMIN
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: currentUserId } },
  });

  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only group admins can modify group settings" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, type, customType, description, currency, simplifyDebts, membersCanEdit } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const updatedGroup = await db.group.update({
      where: { id: groupId },
      data: {
        name: name.trim(),
        type: (type as GroupType) || "OTHER",
        customType: type === "OTHER" && customType ? customType.trim() : null,
        description: description ? description.trim() : null,
        currency: currency || "₹",
        simplifyDebts: simplifyDebts === true,
        membersCanEdit: membersCanEdit === true,
      },
    });

    return NextResponse.json({ group: updatedGroup });
  } catch (error: any) {
    console.error("Error updating group settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
