import React, { useState } from "react";
import Card from "./ui/Card";
import { formatINR } from "../lib/format";
import { ArrowUp, ArrowDown, AlertTriangle, Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { GROUP_COLORS } from "../lib/constants";

export default function BudgetCard({
  budget,
  spent,
  previousSpent,
  onEdit,
  onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const budgetAmount = budget.amount || 0;
  const spentAmount = spent || 0;
  const remaining = budgetAmount - spentAmount;
  const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
  const isOverspent = remaining < 0;
  const isWarning = percentage >= 80 && percentage < 100;
  const isCritical = percentage >= 100;

  // Calculate trend
  const trend =
    previousSpent > 0
      ? ((spentAmount - previousSpent) / previousSpent) * 100
      : 0;
  const isTrendUp = trend > 0;
  const isTrendDown = trend < 0;

  // Get color based on status
  const getBarColor = () => {
    if (isCritical) return "#ef4444"; // Red for overspent
    if (isWarning) return "#f59e0b"; // Yellow for warning
    return GROUP_COLORS[budget.group] || "#3b82f6"; // Category color
  };

  const getStatusColor = () => {
    if (isCritical) return "text-red-600";
    if (isWarning) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 hover:shadow-xl transition-all duration-300 group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: GROUP_COLORS[budget.group] || "#6b7280",
                }}
              />
              <h3 className="text-lg font-bold text-gray-900">
                {budget.categoryName || budget.name}
              </h3>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                {budget.subCategoryId ? "Subcategory" : "Category"}
              </span>
              {isCritical && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Overspent
                </span>
              )}
              {isWarning && !isCritical && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                  Warning
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {budget.group}
              {budget.createdAt && (
                <span className="ml-2">
                  •{" "}
                  {new Date(budget.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
          <div
            className={`flex items-center gap-2 ${onEdit || onDelete ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
          >
            <button
              onClick={() => onEdit?.(budget)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
              disabled={!onEdit}
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => {
                if (onDelete) setConfirmDelete(true);
              }}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
              disabled={!onDelete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="text-sm text-red-700">
              Delete budget “{budget.categoryName || budget.name}”?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete?.(budget);
                  setConfirmDelete(false);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Spent</span>
            <span className={`font-semibold ${getStatusColor()}`}>
              {formatINR(spentAmount)} / {formatINR(budgetAmount)}
            </span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: getBarColor() }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, percentage)}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
            {isOverspent && (
              <motion.div
                className="absolute h-full bg-red-500 rounded-full"
                style={{
                  width: `${(Math.abs(remaining) / budgetAmount) * 100}%`,
                  right: 0,
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${(Math.abs(remaining) / budgetAmount) * 100}%`,
                }}
                transition={{ duration: 0.5, delay: 0.8 }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-700">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Budget */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Budget</div>
            <div className="text-lg font-bold text-gray-900">
              {formatINR(budgetAmount)}
            </div>
          </div>

          {/* Spent */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              Spent
              {previousSpent > 0 && (
                <span
                  className={`flex items-center ${isTrendUp ? "text-red-600" : isTrendDown ? "text-green-600" : "text-gray-400"}`}
                >
                  {isTrendUp ? (
                    <ArrowUp size={10} />
                  ) : isTrendDown ? (
                    <ArrowDown size={10} />
                  ) : null}
                </span>
              )}
            </div>
            <div
              className={`text-lg font-bold ${isCritical ? "text-red-600" : "text-gray-900"}`}
            >
              {formatINR(spentAmount)}
            </div>
            {previousSpent > 0 && Math.abs(trend) > 1 && (
              <div
                className={`text-xs ${isTrendUp ? "text-red-600" : "text-green-600"}`}
              >
                {isTrendUp ? "+" : ""}
                {trend.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Remaining */}
          <div
            className={`p-3 rounded-lg ${isOverspent ? "bg-red-50" : remaining < budgetAmount * 0.2 ? "bg-yellow-50" : "bg-green-50"}`}
          >
            <div className="text-xs text-gray-500 mb-1">Remaining</div>
            <div
              className={`text-lg font-bold ${isOverspent ? "text-red-600" : remaining < budgetAmount * 0.2 ? "text-yellow-600" : "text-green-600"}`}
            >
              {formatINR(Math.max(0, remaining))}
            </div>
            {isOverspent && (
              <div className="text-xs text-red-600">
                Over by {formatINR(Math.abs(remaining))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
