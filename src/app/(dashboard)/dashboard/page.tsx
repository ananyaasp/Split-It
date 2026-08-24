import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateGroupBalances } from "@/lib/balances";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          expenses: {
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
              items: {
                include: {
                  payer: { select: { id: true, name: true, email: true } },
                  splits: {
                    include: {
                      user: { select: { id: true, name: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let totalYouOwe = 0;
  let totalYouAreOwed = 0;
  const recentExpenses: {
    id: string;
    groupId: string;
    groupName: string;
    title: string;
    category: string | null;
    amount: number;
    expenseDate: Date;
  }[] = [];

  memberships.forEach(({ group }) => {
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

    // Sum simplified debts for this user
    balanceData.simplifiedDebts.forEach((debt) => {
      if (debt.fromUser.id === userId) {
        totalYouOwe += debt.amount;
      }
      if (debt.toUser.id === userId) {
        totalYouAreOwed += debt.amount;
      }
    });

    group.expenses.forEach((exp) => {
      const expTotal = exp.items.reduce(
        (acc, item) => acc + Number(item.amount),
        0
      );
      recentExpenses.push({
        id: exp.id,
        groupId: group.id,
        groupName: group.name,
        title: exp.title,
        category: exp.category,
        amount: expTotal,
        expenseDate: exp.expenseDate,
      });
    });
  });

  recentExpenses.sort(
    (a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back, {session?.user?.name?.split(" ")[0]}!
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Here is your live financial overview across all your shared groups.
          </p>
        </div>
        <Link
          href="/groups"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
        >
          View All Groups
        </Link>
      </div>

      {/* Main Financial Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            You Owe Total
          </p>
          <p className="mt-2 text-3xl font-extrabold text-rose-600 dark:text-rose-400">
            ₹{totalYouOwe.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Pending debts</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            You Are Owed Total
          </p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ₹{totalYouAreOwed.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Owed to you by friends</p>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-4">
          Recent Activity Timeline
        </h2>

        {recentExpenses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              No recent activity
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Create a group and add expenses to start splitting bills.
            </p>
            <Link
              href="/groups"
              className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500"
            >
              Go to Groups
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentExpenses.slice(0, 5).map((exp) => (
              <Link
                key={exp.id}
                href={`/groups/${exp.groupId}`}
                className="flex items-center justify-between py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-lg px-2 transition-colors"
              >
                <div>
                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    {exp.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Group: <span className="font-medium text-emerald-600">{exp.groupName}</span> •{" "}
                    {new Date(exp.expenseDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50">
                  ₹{exp.amount.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
