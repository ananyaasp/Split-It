"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface JoinGroupClientProps {
  group: {
    id: string;
    name: string;
    type: string;
    customType?: string | null;
    description?: string | null;
    inviteCode?: string | null;
    memberCount: number;
  };
}

const typeIcons: Record<string, string> = {
  RESTAURANT: "🍕 Restaurant",
  VACATION: "✈️ Vacation",
  GROCERY: "🛒 Grocery",
  SHOPPING: "🛍️ Shopping",
  OTHER: "📦 Other",
};

export function JoinGroupClient({ group }: JoinGroupClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoinGroup = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: group.inviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join group");
      }

      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const badgeText =
    group.type === "OTHER" && group.customType
      ? `📦 ${group.customType}`
      : typeIcons[group.type] ?? group.type;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-4">
      <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          🤝
        </div>

        <div>
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-3">
            {badgeText}
          </span>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {group.description}
            </p>
          )}
          <p className="mt-3 text-xs font-medium text-zinc-500">
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"} in this group
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleJoinGroup}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Joining Group..." : "Join Group Now"}
          </button>
          <Link
            href="/dashboard"
            className="block text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            Cancel & Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
