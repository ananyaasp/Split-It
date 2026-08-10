import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileClient } from "@/components/profile/profile-client";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      lastNameChange: true,
      _count: {
        select: {
          groupMembers: true,
          expensesCreated: true,
        },
      },
    },
  });

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    lastNameChange: user.lastNameChange ? user.lastNameChange.toISOString() : null,
    groupCount: user._count.groupMembers,
    expenseCount: user._count.expensesCreated,
  };

  return <ProfileClient user={serializedUser} />;
}
