import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupType } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          _count: { select: { expenses: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const groups = memberships.map((m) => m.group);

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, type = "OTHER", customType, description, currency = "₹", memberEmails = [], membersCanEdit = true, simplifyDebts = true } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const currentUserId = session.user.id;

    // Find users by emails
    const existingUsers = await db.user.findMany({
      where: {
        email: { in: memberEmails.map((e: string) => e.trim().toLowerCase()) },
      },
      select: { id: true, email: true },
    });

    const additionalUserIds = existingUsers
      .map((u) => u.id)
      .filter((id) => id !== currentUserId);

    const group = await db.group.create({
      data: {
        name: name.trim(),
        type: (type as GroupType) || "OTHER",
        customType: type === "OTHER" && customType ? customType.trim() : null,
        description: description?.trim() || null,
        currency: currency || "₹",
        inviteCode: Math.random().toString(36).substring(2, 10),
        simplifyDebts: simplifyDebts !== false,
        membersCanEdit: membersCanEdit === true || membersCanEdit === undefined ? true : false,
        members: {
          create: [
            { userId: currentUserId, role: "ADMIN" },
            ...additionalUserIds.map((userId) => ({
              userId,
              role: "MEMBER" as const,
            })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
