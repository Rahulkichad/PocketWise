import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import TransactionRow from "../components/TransactionRow";
import AddTransactionModal from "../components/AddTransactionModal";
import SplitTransactionModal from "../components/SplitTransactionModal";
import RecurringModal from "../components/RecurringModal";
import { formatINR } from "../lib/format";
import {
  Plus,
  Search,
  Calendar,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { GROUP_COLORS } from "../lib/constants";
import { showToast } from "../components/Toast";

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [confirmDeleteRecurringId, setConfirmDeleteRecurringId] =
    useState(null);

  // Filters
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [dateFilter, setDateFilter] = useState(
    searchParams.get("date") || "all",
  );
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get("category") || "all",
  );
  const [typeFilter, setTypeFilter] = useState(
    searchParams.get("type") || "all",
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [search, dateFilter, categoryFilter, typeFilter]);

  const loadData = async () => {
    try {
      const [txRes, catRes, accRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/categories").catch(() => ({ data: { items: [] } })),
        api.get("/accounts").catch(() => ({ data: [] })),
      ]);
      setTransactions(txRes.data || []);
      setCategories(catRes.data?.items || []);
      setAccounts(accRes.data || []);
      // Load recurring definitions
      const recRes = await api
        .get("/recurring")
        .catch(() => ({ data: { items: [] } }));
      setRecurring(recRes.data?.items || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (dateFilter !== "all") {
        const now = new Date();
        let from, to;
        switch (dateFilter) {
          case "today":
            from = new Date(now.setHours(0, 0, 0, 0));
            to = new Date(now.setHours(23, 59, 59, 999));
            break;
          case "week":
            from = new Date(now.setDate(now.getDate() - 7));
            to = new Date();
            break;
          case "month":
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            to = new Date();
            break;
          case "year":
            from = new Date(now.getFullYear(), 0, 1);
            to = new Date();
            break;
        }
        if (from) params.append("from", from.toISOString());
        if (to) params.append("to", to.toISOString());
      }
      if (categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);

      const { data } = await api.get("/transactions", { params });
      setTransactions(data || []);

      // Update URL
      const newParams = new URLSearchParams();
      if (search) newParams.set("q", search);
      if (dateFilter !== "all") newParams.set("date", dateFilter);
      if (categoryFilter !== "all") newParams.set("category", categoryFilter);
      if (typeFilter !== "all") newParams.set("type", typeFilter);
      setSearchParams(newParams);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (payload) => {
    try {
      // Ensure amount is a number
      if (payload.amount && typeof payload.amount !== "number") {
        payload.amount = Number(payload.amount);
      }

      if (!payload.amount || isNaN(payload.amount) || payload.amount <= 0) {
        alert("Please enter a valid amount");
        return;
      }

      await api.post("/transactions", payload);
      await loadTransactions();
    } catch (err) {
      console.error("Failed to add transaction:", err);
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to add transaction";
      alert(errorMsg);
      throw err;
    }
  };

  const handleUpdate = async (id, payload) => {
    try {
      await api.put(`/transactions/${id}`, payload);
      await loadTransactions();
    } catch (err) {
      console.error("Failed to update transaction:", err);
      throw err;
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      await loadTransactions();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  const handleCreateRecurring = async (payload) => {
    try {
      await api.post("/recurring", payload);
      setIsRecurringModalOpen(false);
      const recRes = await api
        .get("/recurring")
        .catch(() => ({ data: { items: [] } }));
      setRecurring(recRes.data?.items || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create recurring";
      alert(msg);
    }
  };

  const handleUpdateRecurring = async (id, payload) => {
    try {
      await api.put(`/recurring/${id}`, payload);
      setIsRecurringModalOpen(false);
      setEditingRecurring(null);
      const recRes = await api
        .get("/recurring")
        .catch(() => ({ data: { items: [] } }));
      setRecurring(recRes.data?.items || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update recurring";
      alert(msg);
    }
  };

  const handleDeleteRecurring = async (id) => {
    try {
      await api.delete(`/recurring/${id}`);
      setConfirmDeleteRecurringId(null);
      if (editingRecurring && editingRecurring._id === id) {
        setEditingRecurring(null);
      }
      const recRes = await api
        .get("/recurring")
        .catch(() => ({ data: { items: [] } }));
      setRecurring(recRes.data?.items || []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete recurring";
      alert(msg);
    }
  };

  const runDueRecurring = async () => {
    try {
      const { data } = await api.post("/recurring/run-due");
      if (data?.createdCount > 0) {
        await loadTransactions();
        showToast(
          data?.message || "Recurring transactions created.",
          "success",
        );
      } else {
        showToast(
          data?.message || "No due right now. Will auto-run on scheduled date.",
          "success",
        );
      }
      const recRes = await api
        .get("/recurring")
        .catch(() => ({ data: { items: [] } }));
      setRecurring(recRes.data?.items || []);
    } catch (err) {
      showToast("Failed to run due recurring", "error");
    }
  };

  const handleReview = async (id) => {
    try {
      await api.post(`/transactions/${id}/reviewed`);
      await loadTransactions();
    } catch (err) {
      console.error("Failed to review transaction:", err);
    }
  };

  const handleSplit = async (id, payload) => {
    try {
      await api.put(`/transactions/${id}`, payload);
      await loadTransactions();
      setIsSplitModalOpen(false);
    } catch (err) {
      console.error("Failed to split transaction:", err);
      throw err;
    }
  };

  // Group transactions by type for sidebar - use new schema
  const groupedTransactions = useMemo(() => {
    const groups = {
      Needs: [],
      Wants: [],
      Savings: [],
      Income: [],
      Transfer: [],
    };

    transactions.forEach((tx) => {
      // Use new schema: category is a string enum
      const group =
        tx.category ||
        (tx.type === "income"
          ? "Income"
          : tx.type === "transfer"
            ? "Transfer"
            : "Needs");
      if (groups[group]) {
        groups[group].push(tx);
      }
    });

    return groups;
  }, [transactions]);

  // Calculate totals for sidebar - ensure amounts are numbers
  const sidebarTotals = useMemo(() => {
    const safeNum = (val) => {
      if (typeof val === "object" && val?.$numberDecimal)
        return Number(val.$numberDecimal);
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };

    const totals = {};
    Object.keys(groupedTransactions).forEach((group) => {
      totals[group] = groupedTransactions[group].reduce((sum, tx) => {
        const amount = safeNum(tx.amount);
        if (tx.type === "expense") return sum - amount;
        if (tx.type === "income") return sum + amount;
        return sum;
      }, 0);
    });
    return totals;
  }, [groupedTransactions]);

  // Filter transactions based on selected type and category - use new schema
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    // Filter by category (new schema uses category string)
    if (categoryFilter !== "all") {
      if (
        ["needs", "wants", "savings"].includes(categoryFilter.toLowerCase())
      ) {
        // Filter by category group
        const group =
          categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1);
        filtered = filtered.filter((tx) => tx.category === group);
      } else {
        // Filter by category name (if using category dropdown)
        filtered = filtered.filter((tx) => {
          const cat = categories.find((c) => c._id === categoryFilter);
          return cat && tx.category === cat.group;
        });
      }
    }

    return filtered;
  }, [transactions, typeFilter, categoryFilter, categories]);

  const handleSidebarClick = (group) => {
    if (group === "Income") {
      setTypeFilter("income");
      setCategoryFilter("all");
    } else if (group === "Transfer") {
      setTypeFilter("transfer");
      setCategoryFilter("all");
    } else {
      setTypeFilter("expense");
      setCategoryFilter(group); // Use group name directly
    }
  };

  return (
    <Page title="Transactions" subtitle="Manage your financial transactions">
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <Card className="p-4 sticky top-4">
            <div className="space-y-1">
              {["Needs", "Wants", "Savings"].map((group) => (
                <button
                  key={group}
                  onClick={() => handleSidebarClick(group)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                    typeFilter === "expense" &&
                    categoryFilter === group.toLowerCase()
                      ? "bg-blue-50 border-2 border-blue-500"
                      : "hover:bg-gray-50 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: GROUP_COLORS[group] }}
                    />
                    <span className="font-medium text-gray-700">{group}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {formatINR(Math.abs(sidebarTotals[group] || 0))}
                  </span>
                </button>
              ))}

              <button
                onClick={() => handleSidebarClick("Income")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                  typeFilter === "income"
                    ? "bg-green-50 border-2 border-green-500"
                    : "hover:bg-gray-50 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowUp className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-gray-700">Income</span>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  {formatINR(sidebarTotals.Income || 0)}
                </span>
              </button>

              <button
                onClick={() => handleSidebarClick("Transfer")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                  typeFilter === "transfer"
                    ? "bg-purple-50 border-2 border-purple-500"
                    : "hover:bg-gray-50 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-gray-700">Transfers</span>
                </div>
                <span className="text-sm font-semibold text-purple-600">
                  {formatINR(Math.abs(sidebarTotals.Transfer || 0))}
                </span>
              </button>
            </div>
          </Card>
          {/* Recurring Section */}
          <Card className="p-4 sticky top-[120px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Recurring</h3>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingRecurring(null);
                  setConfirmDeleteRecurringId(null);
                  setIsRecurringModalOpen(true);
                }}
                className="text-sm"
              >
                Add
              </Button>
            </div>
            {recurring.length === 0 ? (
              <div className="text-sm text-gray-500">No recurring items</div>
            ) : (
              <div className="space-y-2">
                {recurring.map((r) => (
                  <div
                    key={r._id}
                    className="p-2 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {r.cadence}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                      <span>
                        {r.type === "income" ? "Income" : `${r.category}`}
                      </span>
                      <span>
                        Next:{" "}
                        {r.nextDueDate
                          ? new Date(r.nextDueDate).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => {
                          setEditingRecurring(r);
                          setIsRecurringModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {confirmDeleteRecurringId === r._id ? (
                        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-xs text-red-700">
                            Delete “{r.name}”?
                          </span>
                          <button
                            onClick={() => handleDeleteRecurring(r._id)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteRecurringId(null)}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          className="text-xs text-red-600"
                          onClick={() => setConfirmDeleteRecurringId(r._id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Button
                variant="ghost"
                onClick={runDueRecurring}
                className="text-sm w-full"
              >
                Run Due Now
              </Button>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar - Sticky */}
          <Card className="p-4 mb-4 sticky top-0 z-10 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchParams({
                      ...Object.fromEntries(searchParams),
                      q: e.target.value,
                    });
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date Filter */}
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Transaction Button */}
              <Button
                variant="primary"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                Add Transaction
              </Button>
            </div>
          </Card>

          {/* Transaction List */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {filteredTransactions.length}{" "}
                  {filteredTransactions.length === 1
                    ? "Transaction"
                    : "Transactions"}
                </h3>
                {typeFilter !== "all" && (
                  <button
                    onClick={() => {
                      setTypeFilter("all");
                      setCategoryFilter("all");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : filteredTransactions.length === 0 ? (
                <EmptyState
                  title="No transactions found"
                  description="Try adjusting your filters or add a new transaction."
                />
              ) : (
                <div>
                  {filteredTransactions.map((tx, idx) => (
                    <motion.div
                      key={tx.id || tx._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      <TransactionRow
                        transaction={tx}
                        categories={categories}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onReview={handleReview}
                        onSplit={(tx) => {
                          setSelectedTransaction(tx);
                          setIsSplitModalOpen(true);
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAdd}
        categories={categories}
        accounts={accounts}
      />

      <SplitTransactionModal
        isOpen={isSplitModalOpen}
        onClose={() => {
          setIsSplitModalOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        categories={categories}
        onSave={handleSplit}
      />

      <RecurringModal
        isOpen={isRecurringModalOpen}
        onClose={() => {
          setIsRecurringModalOpen(false);
          setEditingRecurring(null);
        }}
        onSave={(payload, id) =>
          id
            ? handleUpdateRecurring(id, payload)
            : handleCreateRecurring(payload)
        }
        categories={categories}
        recurring={editingRecurring}
      />
    </Page>
  );
}
