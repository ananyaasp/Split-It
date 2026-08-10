import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const currentUserId = session.user.id;

    // Find group by inviteCode
    const group = await db.group.findUnique({
      where: { inviteCode: inviteCode.trim() },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
    }

    // Check if already a member
    const existingMember = group.members.find((m) => m.userId === currentUserId);
    if (existingMember) {
      return NextResponse.json({ group, alreadyMember: true });
    }

    // Add user as MEMBER
    await db.groupMember.create({
      data: {
        groupId: group.id,
        userId: currentUserId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ group, joined: true });
  } catch (error: any) {
    console.error("Error joining group:", error);
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
}
