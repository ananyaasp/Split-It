import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupListClient } from "@/components/groups/group-list-client";

export default async function GroupsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return <GroupListClient initialMemberships={memberships} />;
}
