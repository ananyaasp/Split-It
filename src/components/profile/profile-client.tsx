"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    lastNameChange: string | null;
    groupCount: number;
    expenseCount: number;
  };
}

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(user.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const lastChangeTime = user.lastNameChange ? new Date(user.lastNameChange).getTime() : 0;
  const timeSinceChange = Date.now() - lastChangeTime;
  const canEditName = !user.lastNameChange || timeSinceChange >= SEVEN_DAYS_MS;

  const nextChangeDate = user.lastNameChange
    ? new Date(lastChangeTime + SEVEN_DAYS_MS).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update name");
      }

      setIsEditingName(false);
      setSuccess("Name updated successfully! (Note: Name can be changed again after 7 days)");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Profile</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Your account details and activity.</p>
      </div>

      {success && (
        <div className="rounded-xl bg-emerald-50 p-4 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Account Details</h2>
        </div>
        <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {/* Name Row */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</dt>
                {!isEditingName && (
                  <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {user.name}
                  </dd>
                )}
              </div>

              {!isEditingName && (
                <div>
                  {canEditName ? (
                    <button
                      onClick={() => {
                        setError("");
                        setIsEditingName(true);
                      }}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      ✏️ Edit Name
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md">
                      Next edit: {nextChangeDate}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Editing Form */}
            {isEditingName && (
              <form onSubmit={handleSaveName} className="mt-3 space-y-3">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Enter new name"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500">
                  ℹ️ Note: Name can only be updated once every 7 days.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Name"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setName(user.name);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Email Row */}
          <div className="flex justify-between px-6 py-4">
            <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.email}</dd>
          </div>

          {/* Member Since Row */}
          <div className="flex justify-between px-6 py-4">
            <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Member since</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {new Date(user.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Groups joined</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {user.groupCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Expenses created</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {user.expenseCount}
          </p>
        </div>
      </div>
    </div>
  );
}
