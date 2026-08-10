import Link from "next/link";
import { ReactNode } from "react";

import { signOutAction } from "@/app/actions/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/groups", label: "Groups", icon: "👥" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

interface AppShellProps {
  children: ReactNode;
  userName: string;
}

export function AppShell({ children, userName }: AppShellProps) {
  return (
    <div className="flex min-h-full bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <Link href="/dashboard" className="text-xl font-bold text-emerald-600">
            Split-It
          </Link>
          <p className="mt-1 text-sm text-zinc-500">Split bills, track spending</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{userName}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-2 text-sm text-zinc-500 transition-colors hover:text-red-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <Link href="/dashboard" className="text-lg font-bold text-emerald-600">
            Split-It
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-zinc-500">
              Sign out
            </button>
          </form>
        </header>

        <nav className="flex border-b border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-900">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
