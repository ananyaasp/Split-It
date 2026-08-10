import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { JoinGroupClient } from "@/components/groups/join-group-client";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const { code } = await params;

  const group = await db.group.findUnique({
    where: { inviteCode: code },
    include: {
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    notFound();
  }

  // Check if already a member
  const existingMember = await db.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId,
      },
    },
  });

  if (existingMember) {
    redirect(`/groups/${group.id}`);
  }

  return (
    <JoinGroupClient
      group={{
        id: group.id,
        name: group.name,
        type: group.type,
        customType: group.customType,
        description: group.description,
        inviteCode: group.inviteCode,
        memberCount: group._count.members,
      }}
    />
  );
}
