import React from "react";
import Card from "./ui/Card";
import { formatINR } from "../lib/format";
import {
  Target,
  Calendar,
  TrendingUp,
  GripVertical,
  Edit2,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";

export default function GoalCard({
  goal,
  index,
  onEdit,
  onDelete,
  onLink,
  onLinkSuggested,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const targetDate = new Date(goal.targetDate);
  const startDate = goal.startDate ? new Date(goal.startDate) : null;
  const now = new Date();
  const daysUntil = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
  const monthsUntil = Math.ceil(daysUntil / 30);

  const progress = goal.progress || 0;
  const targetAmount = goal.targetAmount || 1;
  const progressPct = Math.min(100, (progress / targetAmount) * 100);
  const remaining = Math.max(0, targetAmount - progress);

  // Calculate monthly required
  const monthlyRequired = monthsUntil > 0 ? remaining / monthsUntil : remaining;

  // Determine status color
  const getStatusColor = () => {
    if (progressPct >= 100) return "bg-green-500";
    if (daysUntil < 0) return "bg-red-500";
    if (daysUntil < 30) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getStatusText = () => {
    if (progressPct >= 100) return "Completed";
    if (daysUntil < 0) return "Overdue";
    if (daysUntil < 30) return "Due Soon";
    return "On Track";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", index);
        onDragStart?.(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer.getData("text/html"), 10);
        if (draggedIndex !== index) {
          onDrop?.(draggedIndex, index);
        }
      }}
      className={`relative ${isDragging ? "opacity-50" : ""}`}
    >
      <Card className="p-6 hover:shadow-xl transition-all duration-300 group">
        {/* Drag Handle */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className={`p-3 rounded-lg ${getStatusColor()} bg-opacity-10`}>
              <Target
                className={`w-6 h-6 ${getStatusColor().replace("bg-", "text-")}`}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {goal.name}
              </h3>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  progressPct >= 100
                    ? "bg-green-100 text-green-700"
                    : daysUntil < 0
                      ? "bg-red-100 text-red-700"
                      : daysUntil < 30
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {getStatusText()}
              </span>
              {startDate && (
                <div className="text-xs text-gray-500 mt-1">
                  Started{" "}
                  {startDate.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onLinkSuggested?.(goal)}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Link Suggested"
            >
              <span className="text-xs">Suggested</span>
            </button>
            <button
              onClick={() => onLink?.(goal)}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Link Investment"
            >
              <span className="text-xs">Link</span>
            </button>
            <button
              onClick={() => onEdit?.(goal)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="text-sm text-red-700">
              Delete goal “{goal.name}”?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete?.(goal);
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
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {formatINR(progress)} / {formatINR(targetAmount)}
            </span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden relative">
            <motion.div
              className={`h-full ${getStatusColor()} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-700">
                {progressPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {/* Monthly Required */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Monthly Required</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatINR(monthlyRequired)}
            </div>
          </div>

          {/* Monthly Plan */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Monthly Plan</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatINR(goal.monthlyContribution || 0)}
            </div>
          </div>

          {/* Monthly Actual */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Monthly Actual</span>
            </div>
            <div
              className={`text-lg font-bold ${(goal.monthlyActual || 0) >= (goal.monthlyContribution || 0) && (goal.monthlyContribution || 0) > 0 ? "text-green-600" : "text-gray-900"}`}
            >
              {formatINR(goal.monthlyActual || 0)}
            </div>
          </div>

          {/* ETA */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">ETA</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {daysUntil < 0
                ? `${Math.abs(daysUntil)} days overdue`
                : daysUntil === 0
                  ? "Today"
                  : daysUntil === 1
                    ? "Tomorrow"
                    : daysUntil < 30
                      ? `${daysUntil} days`
                      : `${monthsUntil} months`}
            </div>
          </div>

          {/* Elapsed */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Elapsed</span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {startDate
                ? `${Math.max(0, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)))} days`
                : "—"}
            </div>
          </div>
        </div>

        {/* Linked Investments */}
        {goal.investmentType ||
        (goal.linkedInvestments && goal.linkedInvestments.length > 0) ? (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">Linked Investments</div>
            <div className="flex flex-wrap gap-2">
              {goal.investmentType && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  {goal.investmentType} •{" "}
                  {goal.monthlyContribution
                    ? `₹${goal.monthlyContribution}`
                    : ""}
                </span>
              )}
              {goal.linkedInvestments &&
                goal.linkedInvestments.length > 0 &&
                goal.linkedInvestments.map((inv, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                  >
                    {inv}
                  </span>
                ))}
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">No linked investments</div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
