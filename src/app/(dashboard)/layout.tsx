import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  const userName = user?.name || session.user.name || "User";

  return <AppShell userName={userName}>{children}</AppShell>;
}
