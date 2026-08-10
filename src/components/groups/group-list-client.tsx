"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const groupTypeLabels: Record<string, string> = {
  RESTAURANT: "Restaurant 🍕",
  VACATION: "Vacation ✈️",
  GROCERY: "Grocery 🛒",
  SHOPPING: "Shopping 🛍️",
  OTHER: "Other 📦",
};

interface GroupMemberUser {
  id: string;
  name: string;
  email: string;
}

interface GroupItem {
  id: string;
  name: string;
  type: string;
  customType?: string | null;
  description: string | null;
  _count: { members: number };
}

interface GroupListClientProps {
  initialMemberships: {
    group: GroupItem;
  }[];
}

export function GroupListClient({ initialMemberships }: GroupListClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("RESTAURANT");
  const [customType, setCustomType] = useState("");
  const [currency, setCurrency] = useState("₹");
  const [description, setDescription] = useState("");
  const [memberEmailsInput, setMemberEmailsInput] = useState("");
  const [membersCanEdit, setMembersCanEdit] = useState(true);
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    const memberEmails = memberEmailsInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          customType: customType.trim(),
          currency,
          description: description.trim(),
          memberEmails,
          membersCanEdit,
          simplifyDebts,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      setIsModalOpen(false);
      setName("");
      setCustomType("");
      setDescription("");
      setMemberEmailsInput("");
      router.refresh();
      router.push(`/groups/${data.group.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Groups
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Split bills with friends for restaurants, vacations, groceries, and more.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 hover:shadow-emerald-500/25 active:scale-95"
        >
          <span>+</span> New Group
        </button>
      </div>

      {initialMemberships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xl font-bold">
            👥
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            No groups yet
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create your first group to start splitting bills and tracking expenses.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-500"
          >
            Create a Group
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialMemberships.map(({ group }) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-zinc-900 group-hover:text-emerald-600 dark:text-zinc-50 dark:group-hover:text-emerald-400 transition-colors">
                    {group.name}
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {group._count.members} {group._count.members === 1 ? "member" : "members"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  {group.type === "OTHER" && group.customType
                    ? `📦 ${group.customType}`
                    : (groupTypeLabels[group.type] ?? group.type)}
                </p>
                {group.description && (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {group.description}
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                View group →
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Create New Group</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Goa Trip 2026, Weekend Dinners"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Category Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="RESTAURANT">Restaurant 🍕</option>
                  <option value="VACATION">Vacation ✈️</option>
                  <option value="GROCERY">Grocery 🛒</option>
                  <option value="SHOPPING">Shopping 🛍️</option>
                  <option value="OTHER">Other 📦</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="₹">₹ (INR - Indian Rupee)</option>
                  <option value="$">$ (USD - US Dollar)</option>
                  <option value="€">€ (EUR - Euro)</option>
                  <option value="£">£ (GBP - British Pound)</option>
                </select>
              </div>

              {type === "OTHER" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Custom Category Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Movie Night, Birthday, Gym, Tech"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Splitting food and resort bills"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Add Members by Email (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="alex@gmail.com, sam@gmail.com"
                  value={memberEmailsInput}
                  onChange={(e) => setMemberEmailsInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Members who are registered can be added immediately.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Allow members to add expenses</p>
                  <p className="text-[11px] text-zinc-500">If off, only the admin can add and edit expenses.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMembersCanEdit(!membersCanEdit)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    membersCanEdit ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      membersCanEdit ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Simplify debts automatically</p>
                  <p className="text-[11px] text-zinc-500">Minimizes the total number of transactions between members.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSimplifyDebts(!simplifyDebts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    simplifyDebts ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      simplifyDebts ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
