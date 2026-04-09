import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR } from "../lib/format";
import {
  Edit2,
  Trash2,
  Check,
  X,
  Tag as TagIcon,
  Calendar,
  DollarSign,
} from "lucide-react";
import { GROUP_COLORS, GROUPS } from "../lib/constants";
import api from "../api/client";

export default function TransactionRow({
  transaction,
  categories = [],
  onUpdate,
  onDelete,
  onReview,
  onSplit,
  onTransfer,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  // Ensure amount is a number for edit form
  const txAmount =
    typeof transaction.amount === "number"
      ? transaction.amount
      : transaction.amount?.$numberDecimal
        ? Number(transaction.amount.$numberDecimal)
        : Number(transaction.amount || 0);

  const [editForm, setEditForm] = useState({
    merchant: transaction.description || transaction.merchant || "",
    amount: txAmount || "",
    date: new Date(transaction.date).toISOString().slice(0, 10),
    category:
      transaction.category || (transaction.type === "expense" ? "Needs" : ""),
    subType: transaction.subType || "",
    subCategoryId: transaction.subCategoryId || "",
    notes: transaction.notes || "",
    paymentMethod: transaction.paymentMethod || "other",
  });
  const [subCategories, setSubCategories] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    const loadSubs = async (cat) => {
      try {
        setLoadingSubs(true);
        const { data } = await api.get("/subcategories", {
          params: { category: cat },
        });
        setSubCategories(data.items || []);
      } catch {
        setSubCategories([]);
      } finally {
        setLoadingSubs(false);
      }
    };
    if (isEditing && transaction.type === "expense" && editForm.category) {
      loadSubs(editForm.category);
    }
  }, [isEditing, transaction.type, editForm.category]);

  // Use new schema: category is a string enum
  const categoryName = transaction.category || "Uncategorized";
  const group =
    transaction.category ||
    (transaction.type === "income"
      ? "Income"
      : transaction.type === "transfer"
        ? "Transfer"
        : "Needs");
  const color = GROUP_COLORS[group] || "#6b7280";

  // Ensure amount is a number
  const amount =
    typeof transaction.amount === "number"
      ? transaction.amount
      : transaction.amount?.$numberDecimal
        ? Number(transaction.amount.$numberDecimal)
        : Number(transaction.amount || 0);

  const isExpense = transaction.type === "expense";
  const isIncome = transaction.type === "income";
  const isTransfer = transaction.type === "transfer";
  const isReviewed = !!transaction.reviewedAt;
  const isPending = transaction.status === "pending";

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    setSwipeOffset(Math.max(-120, Math.min(120, deltaX)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (swipeOffset < -60) {
      setConfirmDelete(true);
    } else if (swipeOffset > 60) {
      handleReview();
    }
    setSwipeOffset(0);
  };

  const handleDelete = async () => {
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    const txId = transaction.id || transaction._id;
    await onDelete?.(txId);
    setConfirmDelete(false);
  };

  const handleReview = async () => {
    const txId = transaction.id || transaction._id;
    await onReview?.(txId);
  };

  const handleSave = async () => {
    try {
      const txId = transaction.id || transaction._id;
      const payload = {
        ...editForm,
        amount: Number(editForm.amount), // Ensure number
        description: editForm.merchant,
      };
      // Ensure category/subCategory mapping for expense edits
      if (transaction.type === "expense") {
        payload.category = editForm.category || "Needs";
        payload.subCategoryId =
          editForm.subCategoryId || transaction.subCategoryId || "";
      } else {
        payload.subCategoryId = null;
      }
      await onUpdate?.(txId, payload);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update:", err);
      alert(err?.response?.data?.message || "Failed to update transaction");
    }
  };

  const handleCancel = () => {
    setEditForm({
      merchant: transaction.description || transaction.merchant || "",
      amount: txAmount || "",
      date: new Date(transaction.date).toISOString().slice(0, 10),
      category: transaction.category || "",
      subType: transaction.subType || "",
      notes: transaction.notes || "",
      paymentMethod: transaction.paymentMethod || "other",
    });
    setIsEditing(false);
  };

  const date = new Date(transaction.date);
  const amountColor = isExpense
    ? "text-red-600"
    : isIncome
      ? "text-green-600"
      : "text-gray-600";

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-2"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Merchant/Description"
            value={editForm.merchant}
            onChange={(e) =>
              setEditForm({ ...editForm, merchant: e.target.value })
            }
            className="px-3 py-2 border rounded-lg"
          />
          <input
            type="number"
            placeholder="Amount"
            value={editForm.amount}
            onChange={(e) =>
              setEditForm({ ...editForm, amount: e.target.value })
            }
            className="px-3 py-2 border rounded-lg"
          />
          <input
            type="date"
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          />
          {transaction.type === "expense" && (
            <select
              value={editForm.category}
              onChange={(e) =>
                setEditForm({ ...editForm, category: e.target.value })
              }
              className="px-3 py-2 border rounded-lg"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
          {transaction.type === "expense" && (
            <select
              value={editForm.subCategoryId}
              onChange={(e) =>
                setEditForm({ ...editForm, subCategoryId: e.target.value })
              }
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">
                {loadingSubs ? "Loading…" : "Select subcategory"}
              </option>
              {subCategories.map((sc) => (
                <option key={sc._id} value={sc._id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}
          {isIncome && (
            <select
              value={editForm.subType}
              onChange={(e) =>
                setEditForm({ ...editForm, subType: e.target.value })
              }
              className="px-3 py-2 border rounded-lg"
            >
              <option value="Monthly">Monthly</option>
              <option value="One-time">One-time</option>
              <option value="Freelance">Freelance</option>
              <option value="Business">Business</option>
            </select>
          )}
          <textarea
            placeholder="Notes"
            value={editForm.notes}
            onChange={(e) =>
              setEditForm({ ...editForm, notes: e.target.value })
            }
            className="px-3 py-2 border rounded-lg md:col-span-2"
            rows={2}
          />
          <div className="flex gap-2 md:col-span-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ x: swipeOffset }}
      whileHover={{ x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {confirmDelete && (
        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="text-sm text-red-700">
            Delete transaction “
            {transaction.merchant || transaction.description || "Transaction"}”?
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
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
      {/* Swipe actions background */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div
          className="flex-1 bg-red-500 flex items-center justify-end pr-4 transition-opacity"
          style={{ opacity: swipeOffset < -30 ? 0.9 : 0 }}
        >
          <Trash2 className="w-5 h-5 text-white" />
        </div>
        <div
          className="flex-1 bg-green-500 flex items-center justify-start pl-4 transition-opacity"
          style={{ opacity: swipeOffset > 30 ? 0.9 : 0 }}
        >
          <Check className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Transaction row */}
      <div className="relative bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 p-4 flex items-center gap-4">
        {/* Category pill */}
        <div
          className="px-3 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {categoryName}
        </div>

        {/* Merchant/Description */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {transaction.merchant || transaction.description || "Transaction"}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {date.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            {transaction.tags && transaction.tags.length > 0 && (
              <span className="flex items-center gap-1">
                <TagIcon size={12} />
                <span>
                  {transaction.tags.length} tag
                  {transaction.tags.length !== 1 ? "s" : ""}
                </span>
              </span>
            )}
            {isIncome && transaction.subType && (
              <span className="text-gray-600">• {transaction.subType}</span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className={`text-lg font-bold ${amountColor} flex-shrink-0`}>
          {isExpense ? "-" : isIncome ? "+" : ""}
          {formatINR(amount)}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPending && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
              Pending
            </span>
          )}
          {isReviewed && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Reviewed
            </span>
          )}
        </div>

        {/* Action buttons (desktop) */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          {transaction.type === "expense" && onSplit && (
            <button
              onClick={() => onSplit(transaction)}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Split"
            >
              <TagIcon size={16} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
