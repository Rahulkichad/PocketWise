import React, { useState } from "react";
import { formatINR } from "../lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

export default function TransactionReviewCard({
  transaction,
  onApprove,
  onReject,
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    setSwipeOffset(Math.max(-100, Math.min(100, deltaX)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (swipeOffset < -50) {
      // Swipe left - reject
      onReject?.(transaction.id || transaction._id);
    } else if (swipeOffset > 50) {
      // Swipe right - approve
      onApprove?.(transaction.id || transaction._id);
    }
    setSwipeOffset(0);
  };

  const date = new Date(transaction.date);
  const isExpense = transaction.type === "expense";
  const amountColor = isExpense ? "text-red-600" : "text-green-600";
  const categoryName = transaction.category || ""; // Use new schema

  // Ensure amount is a number
  const amount =
    typeof transaction.amount === "number"
      ? transaction.amount
      : transaction.amount?.$numberDecimal
        ? Number(transaction.amount.$numberDecimal)
        : Number(transaction.amount || 0);

  return (
    <motion.div
      className="relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-grab active:cursor-grabbing group"
      style={{ x: swipeOffset }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Swipe actions background */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div
          className="flex-1 bg-green-500 flex items-center justify-start pl-4 opacity-0 transition-opacity"
          style={{ opacity: swipeOffset > 30 ? 0.9 : 0 }}
        >
          <Check className="w-6 h-6 text-white" />
        </div>
        <div
          className="flex-1 bg-red-500 flex items-center justify-end pr-4 opacity-0 transition-opacity"
          style={{ opacity: swipeOffset < -30 ? 0.9 : 0 }}
        >
          <X className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Card content */}
      <div className="relative bg-white p-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">
            {transaction.description ||
              transaction.merchant ||
              transaction.note ||
              "Transaction"}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {date.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
            {categoryName && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                {categoryName}
              </span>
            )}
          </div>
        </div>
        <div className={`text-lg font-bold ${amountColor} ml-4`}>
          {isExpense ? "-" : "+"}
          {formatINR(amount)}
        </div>
      </div>

      {/* Action buttons (desktop) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApprove?.(transaction.id || transaction._id);
          }}
          className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-md"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReject?.(transaction.id || transaction._id);
          }}
          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
