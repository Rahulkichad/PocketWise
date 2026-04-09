import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { showToast } from "./Toast";
import api from "../api/client";
import { GROUPS } from "../lib/constants";

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSave,
  categories = [],
  accounts = [],
}) {
  const [form, setForm] = useState({
    type: "expense",
    merchant: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    category: "Needs",
    subCategoryId: "",
    subType: "",
    notes: "",
    paymentMethod: "other",
  });
  const [subCategories, setSubCategories] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        type: "expense",
        merchant: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        category: "Needs",
        subCategoryId: "",
        subType: "",
        notes: "",
        paymentMethod: "other",
      });
      loadSubCategories("Needs");
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate amount
    const amountNum = Number(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    // Validate date
    if (!form.date) {
      showToast("Please select a date", "error");
      return;
    }

    // Build payload - ensure amount is always a number
    const payload = {
      type: form.type,
      amount: amountNum, // Always a number, never an object
      date: new Date(form.date).toISOString(),
      description: form.merchant || "",
      paymentMethod: form.paymentMethod || "other",
      notes: form.notes || "",
    };

    // Set category and mapping
    if (form.type === "income") {
      payload.category = "Income";
      payload.subType = form.subType || "";
    } else if (form.type === "transfer") {
      payload.category = "Transfer";
      payload.subType = form.subType || "";
    } else if (form.type === "expense") {
      payload.category = form.category || "Needs";
      payload.subCategoryId = form.subCategoryId;
      if (!payload.subCategoryId) {
        showToast("Please select a subcategory", "error");
        return;
      }
    }

    try {
      await onSave(payload);
      showToast("Transaction added successfully", "success");
      onClose();
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save transaction";
      showToast(errorMsg, "error");
    }
  };

  const handleTypeChange = (newType) => {
    setForm({
      ...form,
      type: newType,
      category:
        newType === "expense"
          ? "Needs"
          : newType === "income"
            ? "Income"
            : "Transfer",
      subCategoryId: "",
      subType: "",
    });
    if (newType === "expense") loadSubCategories("Needs");
  };

  const loadSubCategories = async (category) => {
    try {
      setLoadingSubs(true);
      const { data } = await api.get("/subcategories", {
        params: { category },
      });
      setSubCategories(data.items || []);
    } catch (e) {
      setSubCategories([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleCategoryChange = async (value) => {
    setForm({ ...form, category: value, subCategoryId: "" });
    await loadSubCategories(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Add Transaction
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Type selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <div className="flex gap-2">
                {["expense", "income", "transfer"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      form.type === type
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Merchant/Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {form.type === "income"
                  ? "Source"
                  : form.type === "transfer"
                    ? "Description"
                    : "Merchant"}
              </label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  form.type === "income"
                    ? "Salary, Freelance, etc."
                    : "Merchant name"
                }
                required
              />
            </div>

            {/* Income Type (only for income) */}
            {form.type === "income" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Income Type
                </label>
                <select
                  value={form.subType}
                  onChange={(e) =>
                    setForm({ ...form, subType: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="One-time">One-time</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Business">Business</option>
                </select>
              </div>
            )}

            {/* Transfer Type (only for transfer) */}
            {form.type === "transfer" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer Type
                </label>
                <select
                  value={form.subType}
                  onChange={(e) =>
                    setForm({ ...form, subType: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Bank to Wallet">Bank → Wallet</option>
                  <option value="Wallet to Bank">Wallet → Bank</option>
                  <option value="Bank to Bank">Bank → Bank</option>
                </select>
              </div>
            )}

            {/* Category (only for expense) */}
            {form.type === "expense" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subcategory <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.subCategoryId}
                    onChange={(e) =>
                      setForm({ ...form, subCategoryId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">
                      {loadingSubs ? "Loading…" : "Select subcategory"}
                    </option>
                    {subCategories.map((sc) => (
                      <option key={sc._id} value={sc._id}>
                        {sc.name}
                        {sc.linkedGoalId ? " (Goal-linked)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add Transaction
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
