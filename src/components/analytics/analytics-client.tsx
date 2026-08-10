"use client";

import { useEffect, useState } from "react";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface GroupData {
  id: string;
  name: string;
  type: string;
  amount: number;
  percentage: number;
}

interface MonthlyData {
  month: string;
  amount: number;
}

interface ItemDetail {
  date: string;
  expenseTitle: string;
  itemName: string;
  category: string;
  groupName: string;
  shareAmount: number;
}

interface AnalyticsData {
  totalUserSpent: number;
  foodSpent: number;
  categoryBreakdown: CategoryData[];
  groupBreakdown: GroupData[];
  monthlyTrend: MonthlyData[];
  itemDetails: ItemDetail[];
}

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleExportCSV = () => {
    if (!data || !data.itemDetails || data.itemDetails.length === 0) {
      alert("No expense records available to export.");
      return;
    }

    const headers = ["Date", "Group", "Item Name", "Category", "Your Share (₹)"];
    const rows = data.itemDetails.map((item) => [
      `"${item.date}"`,
      `"${item.groupName.replace(/"/g, '""')}"`,
      `"${item.itemName.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.shareAmount,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `split-it_global_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Failed to load spending analytics.
      </div>
    );
  }

  const maxMonthAmount = Math.max(
    ...data.monthlyTrend.map((m) => m.amount),
    100
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Spending Patterns & Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Visualize your monthly spending habits, group distributions, and export reports.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="self-start sm:self-auto rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow transition-all hover:bg-emerald-500 flex items-center gap-2"
        >
          📥 Export All Expenses (CSV)
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Total Spent (Your Share)
          </p>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
            ₹{data.totalUserSpent.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Across all groups</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Top Spending Category
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {data.categoryBreakdown.length > 0
              ? data.categoryBreakdown.slice().sort((a, b) => b.amount - a.amount)[0].category
              : "N/A"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Primary expense driver</p>
        </div>
      </div>

      {/* Monthly Spending Trend Bar Chart */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Monthly Spending Patterns
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Tracking your monthly expenses over time
        </p>

        {data.monthlyTrend.length === 0 ? (
          <p className="text-center py-12 text-sm text-zinc-400">
            No expense history available for monthly graphs yet.
          </p>
        ) : (
          <div className="mt-6 flex h-48 items-end gap-6 border-b border-zinc-200 pb-4 dark:border-zinc-800 overflow-x-auto">
            {data.monthlyTrend.map((m) => {
              const heightPercent = Math.max((m.amount / maxMonthAmount) * 100, 8);
              return (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-2 min-w-[50px] group"
                >
                  <span className="text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    ₹{m.amount}
                  </span>
                  <div
                    className="w-full max-w-[40px] rounded-t-lg bg-emerald-500 group-hover:bg-emerald-400 transition-all"
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Grid: Category Breakdown & Group Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Category Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Category Distribution
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Breakdown of where your money went
          </p>

          {data.categoryBreakdown.length === 0 ? (
            <p className="text-center py-8 text-sm text-zinc-400">
              No category breakdown data available.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {data.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {cat.category}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      ₹{cat.amount.toLocaleString()} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Group Spending Allocation
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Your spending divided across your groups
          </p>

          {!data.groupBreakdown || data.groupBreakdown.length === 0 ? (
            <p className="text-center py-8 text-sm text-zinc-400">
              No group breakdown data available.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {data.groupBreakdown.map((grp) => (
                <div key={grp.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {grp.name}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      ₹{grp.amount.toLocaleString()} ({grp.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${grp.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
