import React, { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import { formatINR } from "../lib/format";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import BudgetCard from "../components/BudgetCard";
import BudgetModal from "../components/BudgetModal";
import EmptyState from "../components/ui/EmptyState";
import {
  Plus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../state/AuthContext.jsx";
import { showToast } from "../components/Toast";

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [copiedIds, setCopiedIds] = useState([]);
  const [confirmClearMonth, setConfirmClearMonth] = useState(false);

  useEffect(() => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    loadData();
    const key = `budgets:copied:${selectedYear}-${selectedMonth}`;
    const ids = JSON.parse(localStorage.getItem(key) || "[]");
    setCopiedIds(ids);
  }, [user, selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data } = await api
        .get(`/budgets?month=${selectedMonth}&year=${selectedYear}`)
        .catch(() => ({ data: { items: [] } }));
      const apiBudgets = data.items || [];
      const uiBudgets = apiBudgets.map((b) => ({
        id: b._id,
        name: b.subCategoryName || b.category,
        group: b.category,
        amount: b.limit,
        subCategoryId: b.subCategoryId || "",
        category: b.category,
        spent: b.spent || 0,
        previousSpent: 0,
        createdAt: b.createdAt,
      }));
      setBudgets(uiBudgets);
    } catch (err) {
      console.error("Failed to load budgets:", err);
    } finally {
      setLoading(false);
    }
  };

  const toCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
    setPickerYear(now.getFullYear());
    setShowPicker(false);
  };
  const prevMonth = () => {
    const m = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const y = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    setSelectedMonth(m);
    setSelectedYear(y);
    setPickerYear(y);
    setShowPicker(false);
  };
  const nextMonth = () => {
    const m = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const y = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    setSelectedMonth(m);
    setSelectedYear(y);
    setPickerYear(y);
    setShowPicker(false);
  };

  const handleCreate = () => {
    setEditingBudget(null);
    setIsModalOpen(true);
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setIsModalOpen(true);
  };

  const handleSave = (budgetData) => {
    const month = selectedMonth;
    const year = selectedYear;
    const payload = {
      category: budgetData.group,
      limit: Number(budgetData.amount || 0),
      month,
      year,
      subCategoryId: budgetData.subCategoryId || undefined,
    };
    api
      .post("/budgets", payload)
      .then(() => {
        showToast("Budget saved", "success");
        loadData();
      })
      .catch(() => showToast("Failed to save budget", "error"));
  };

  const handleDelete = (budget) => {
    const month = selectedMonth;
    const year = selectedYear;
    api
      .post("/budgets", {
        category: budget.group || budget.category,
        subCategoryId: budget.subCategoryId || undefined,
        limit: 0,
        month,
        year,
      })
      .then(() => {
        showToast("Budget deleted", "success");
        loadData();
      })
      .catch(() => showToast("Failed to delete budget", "error"));
  };

  const rolloverFromPrevious = async () => {
    try {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const { data } = await api.get(
        `/budgets?month=${prevMonth}&year=${prevYear}`,
      );
      const prevBudgets = data.items || [];
      if (prevBudgets.length === 0) {
        showToast("No budgets found for previous month", "warning");
        return;
      }
      const results = await Promise.all(
        prevBudgets.map((b) =>
          api.post("/budgets", {
            category: b.category,
            subCategoryId: b.subCategoryId || undefined,
            limit: b.limit,
            month: selectedMonth,
            year: selectedYear,
          }),
        ),
      );
      const created = results.map((r) => r.data?._id).filter(Boolean);
      const key = `budgets:copied:${selectedYear}-${selectedMonth}`;
      localStorage.setItem(key, JSON.stringify(created));
      setCopiedIds(created);
      await loadData();
      showToast("Budgets copied from previous month", "success");
    } catch (e) {
      showToast("Failed to copy budgets", "error");
    }
  };

  const clearCopiedBudgets = async () => {
    try {
      if (copiedIds.length === 0) return;
      await Promise.all(
        copiedIds.map((id) => {
          const b = budgets.find((bb) => bb.id === id);
          if (!b) return Promise.resolve();
          return api.post("/budgets", {
            category: b.group || b.category,
            subCategoryId: b.subCategoryId || undefined,
            limit: 0,
            month: selectedMonth,
            year: selectedYear,
          });
        }),
      );
      const key = `budgets:copied:${selectedYear}-${selectedMonth}`;
      localStorage.removeItem(key);
      setCopiedIds([]);
      showToast("Copied budgets cleared", "success");
      await loadData();
    } catch {
      showToast("Failed to clear copied budgets", "error");
    }
  };

  const clearMonthBudgets = async () => {
    try {
      if (budgets.length === 0) {
        setConfirmClearMonth(false);
        return;
      }
      await Promise.all(
        budgets.map((b) =>
          api.post("/budgets", {
            category: b.group || b.category,
            subCategoryId: b.subCategoryId || undefined,
            limit: 0,
            month: selectedMonth,
            year: selectedYear,
          }),
        ),
      );
      // Clear copied markers
      const key = `budgets:copied:${selectedYear}-${selectedMonth}`;
      localStorage.removeItem(key);
      setCopiedIds([]);
      setConfirmClearMonth(false);
      showToast("All budgets for this month deleted", "success");
      await loadData();
    } catch {
      showToast("Failed to clear month budgets", "error");
    }
  };

  // Match budgets with spent amounts
  const budgetsWithSpent = useMemo(() => {
    return budgets.filter((b) => (b.amount || 0) > 0).map((b) => ({ ...b }));
  }, [budgets]);

  // Aggregate by the three main categories:
  // Use category-level budget as the cap; if absent, use sum of subcategory budgets.
  const categoryAggregates = useMemo(() => {
    const cats = ["Needs", "Wants", "Savings"];
    const result = {};
    for (const cat of cats) {
      const catBudget = budgetsWithSpent.find(
        (b) => (b.category === cat || b.group === cat) && !b.subCategoryId,
      );
      const subBudgets = budgetsWithSpent.filter(
        (b) => (b.category === cat || b.group === cat) && !!b.subCategoryId,
      );
      const cap = catBudget
        ? Number(catBudget.amount || 0)
        : subBudgets.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const spent = catBudget
        ? Number(catBudget.spent || 0)
        : subBudgets.reduce((sum, s) => sum + Number(s.spent || 0), 0);
      const remaining = Math.max(0, cap - spent);
      result[cat] = {
        cap,
        spent,
        remaining,
        hasCatBudget: !!catBudget,
        subCount: subBudgets.length,
      };
    }
    return result;
  }, [budgetsWithSpent]);

  // Calculate totals using aggregated caps (no double counting with sub budgets)
  const totals = useMemo(() => {
    const cats = Object.values(categoryAggregates);
    return cats.reduce(
      (acc, v) => ({
        budget: acc.budget + (v.cap || 0),
        spent: acc.spent + (v.spent || 0),
        remaining: acc.remaining + (v.remaining || 0),
      }),
      { budget: 0, spent: 0, remaining: 0 },
    );
  }, [categoryAggregates]);

  // Count overspent budgets
  const overspentCount = useMemo(() => {
    return Object.values(categoryAggregates).filter(
      (v) => (v.spent || 0) > (v.cap || 0),
    ).length;
  }, [categoryAggregates]);

  if (loading) {
    return (
      <Page
        title="Budgets"
        subtitle="Set monthly category budgets and track allowance left"
      >
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="pw-card p-6 h-64 pw-skeleton" />
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Budgets"
      subtitle="Set monthly category budgets and track allowance left"
    >
      {/* Header with Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {budgetsWithSpent.length}{" "}
            {budgetsWithSpent.length === 1 ? "Budget" : "Budgets"}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 flex items-center gap-2"
              title="Pick month"
            >
              <CalendarIcon size={16} />
              <span className="text-sm font-medium">
                {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString(
                  undefined,
                  { month: "long", year: "numeric" },
                )}
              </span>
            </button>
            <button
              onClick={nextMonth}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={toCurrentMonth}
              className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm"
            >
              This Month
            </button>
            <button
              onClick={rolloverFromPrevious}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm"
            >
              Copy Last Month
            </button>
          </div>
          {showPicker && (
            <div className="mt-2 inline-block bg-white border border-gray-200 rounded-xl shadow-lg">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <button
                  onClick={() => setPickerYear(pickerYear - 1)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <button
                  onClick={() => setPickerYear(pickerYear + 1)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 w-64">
                {[
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((label, idx) => {
                  const m = idx + 1;
                  const isSelected =
                    m === selectedMonth && pickerYear === selectedYear;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setSelectedMonth(m);
                        setSelectedYear(pickerYear);
                        setShowPicker(false);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm ${isSelected ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-50"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleCreate}
            className="flex items-center gap-2"
          >
            <Plus size={18} />
            New Budget
          </Button>
          <Button
            variant="ghost"
            onClick={clearCopiedBudgets}
            disabled={copiedIds.length === 0}
            className="flex items-center gap-2"
          >
            <Trash2 size={18} />
            Clear Copied
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmClearMonth(true)}
            className="flex items-center gap-2 text-red-700 border border-red-200 hover:bg-red-50"
          >
            <Trash2 size={18} />
            Clear Month
          </Button>
        </div>
      </div>

      {confirmClearMonth && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="text-sm text-red-700">
            Delete entire month’s budgets for{" "}
            {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString(
              undefined,
              { month: "long", year: "numeric" },
            )}
            ? This will delete all budgets for the selected month.
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearMonthBudgets}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Delete Month
            </button>
            <button
              onClick={() => setConfirmClearMonth(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {budgetsWithSpent.length > 0 && (
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-500 mb-1">Total Budget</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatINR(totals.budget)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500 mb-1">Total Spent</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatINR(totals.spent)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500 mb-1">Remaining</div>
            <div
              className={`text-2xl font-bold ${totals.remaining < totals.budget * 0.2 ? "text-yellow-600" : "text-green-600"}`}
            >
              {formatINR(totals.remaining)}
            </div>
          </Card>
          <Card
            className={`p-4 ${overspentCount > 0 ? "bg-red-50 border-red-200" : ""}`}
          >
            <div className="text-sm text-gray-500 mb-1">Overspent</div>
            <div
              className={`text-2xl font-bold ${overspentCount > 0 ? "text-red-600" : "text-gray-900"}`}
            >
              {overspentCount}
            </div>
            {overspentCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                <AlertTriangle size={12} />
                Categories over budget
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Budgets Grid */}
      {budgetsWithSpent.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            title="No budgets set"
            description="Create budgets to monitor monthly spending and remaining allowance"
            action={
              <div className="flex gap-3">
                {selectedMonth === new Date().getMonth() + 1 &&
                  selectedYear === new Date().getFullYear() && (
                    <Button variant="primary" onClick={handleCreate}>
                      <Plus size={18} className="mr-2" />
                      Create Budget
                    </Button>
                  )}
                <Button
                  variant="ghost"
                  onClick={rolloverFromPrevious}
                >
                  Copy Last Month
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        (() => {
          const cats = ["Savings", "Needs", "Wants"];
          const grouped = cats.reduce((acc, cat) => {
            const items = budgetsWithSpent.filter(
              (b) => b.category === cat || b.group === cat,
            );
            const main = items.find((b) => !b.subCategoryId);
            const subs = items.filter((b) => !!b.subCategoryId);
            acc[cat] = main ? [main, ...subs] : subs;
            return acc;
          }, {});
          return (
            <div className="space-y-8">
              {cats.map((cat) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{cat}</h3>
                  </div>
                  {grouped[cat].length === 0 ? (
                    <Card className="p-6">
                      <div className="text-sm text-gray-500">
                        No {cat} budgets
                      </div>
                    </Card>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <AnimatePresence mode="popLayout">
                        {grouped[cat].map((budget, index) => (
                          <BudgetCard
                            key={
                              budget.id ||
                              `${budget.category}-${budget.subCategoryId || ""}-${index}`
                            }
                            budget={budget}
                            spent={budget.spent}
                            previousSpent={budget.previousSpent}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Budget Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBudget(null);
        }}
        onSave={handleSave}
        budget={editingBudget}
      />
    </Page>
  );
}
