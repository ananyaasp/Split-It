import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const currentMembership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: currentUserId } },
  });

  if (!currentMembership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, emails, userId: targetUserId } = body;

    let emailsArray: string[] = [];
    if (Array.isArray(emails)) {
      emailsArray = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    } else if (typeof email === "string" && email.trim()) {
      emailsArray = email
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }

    // Single user addition by targetUserId
    if (emailsArray.length === 0 && targetUserId) {
      const userToAdd = await db.user.findUnique({ where: { id: targetUserId } });
      if (!userToAdd) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      const existingMember = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: userToAdd.id } },
      });
      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this group" },
          { status: 400 }
        );
      }

      const newMember = await db.groupMember.create({
        data: { groupId, userId: userToAdd.id, role: "MEMBER" },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      return NextResponse.json({ member: newMember, message: "Member added successfully!" }, { status: 201 });
    }

    if (emailsArray.length === 0) {
      return NextResponse.json({ error: "Please enter at least one valid email address." }, { status: 400 });
    }

    // Remove duplicates from input list
    const uniqueInputEmails = Array.from(new Set(emailsArray));

    // Find registered users matching input emails
    const foundUsers = await db.user.findMany({
      where: { email: { in: uniqueInputEmails } },
      select: { id: true, name: true, email: true, image: true },
    });

    const foundEmailSet = new Set(foundUsers.map((u) => u.email.toLowerCase()));
    const notFoundEmails = uniqueInputEmails.filter((e) => !foundEmailSet.has(e));

    // Find users already in the group
    const existingMembers = await db.groupMember.findMany({
      where: {
        groupId,
        userId: { in: foundUsers.map((u) => u.id) },
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingMembers.map((m) => m.userId));

    const usersToAdd = foundUsers.filter((u) => !existingUserIds.has(u.id));
    const alreadyMemberUsers = foundUsers.filter((u) => existingUserIds.has(u.id));

    if (usersToAdd.length === 0) {
      if (uniqueInputEmails.length === 1) {
        if (notFoundEmails.length > 0) {
          return NextResponse.json(
            { error: `User with email "${notFoundEmails[0]}" not found. They must register first.` },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: `User "${alreadyMemberUsers[0]?.email}" is already a member of this group.` },
          { status: 400 }
        );
      }

      let errorMsg = "No new members were added.";
      if (alreadyMemberUsers.length > 0) {
        errorMsg += ` Already in group: ${alreadyMemberUsers.map((u) => u.email).join(", ")}.`;
      }
      if (notFoundEmails.length > 0) {
        errorMsg += ` Not registered: ${notFoundEmails.join(", ")}.`;
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Bulk insert new members
    await db.groupMember.createMany({
      data: usersToAdd.map((u) => ({
        groupId,
        userId: u.id,
        role: "MEMBER",
      })),
    });

    let resultMessage = `Added ${usersToAdd.length} member${usersToAdd.length > 1 ? "s" : ""}: ${usersToAdd.map((u) => u.name || u.email).join(", ")}.`;
    if (notFoundEmails.length > 0) {
      resultMessage += ` (Note: ${notFoundEmails.join(", ")} not registered yet)`;
    }
    if (alreadyMemberUsers.length > 0) {
      resultMessage += ` (${alreadyMemberUsers.length} were already members)`;
    }

    return NextResponse.json(
      {
        success: true,
        addedCount: usersToAdd.length,
        addedUsers: usersToAdd,
        notFoundEmails,
        alreadyMemberEmails: alreadyMemberUsers.map((u) => u.email),
        message: resultMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding members:", error);
    return NextResponse.json({ error: "Failed to add member(s)" }, { status: 500 });
  }
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
  const currentUserId = session.user.id;

  const { searchParams } = new URL(request.url);
  const removeUserId = searchParams.get("userId");

  if (!removeUserId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  const currentMember = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: currentUserId } },
  });

  if (!currentMember) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Users can remove themselves, or admins can remove other members
  if (currentUserId !== removeUserId && currentMember.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can remove other members" },
      { status: 403 }
    );
  }

  await db.groupMember.delete({
    where: { groupId_userId: { groupId, userId: removeUserId } },
  });

  return NextResponse.json({ success: true });
}
