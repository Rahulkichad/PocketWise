import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import api from "../api/client";

export default function BudgetModal({
  isOpen,
  onClose,
  onSave,
  budget = null,
  categories = [],
}) {
  const [form, setForm] = useState({
    group: "Needs",
    subCategoryId: "",
    amount: "",
  });
  const [subCategories, setSubCategories] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (budget) {
        setForm({
          group: budget.group || budget.category || "Needs",
          subCategoryId: budget.subCategoryId || "",
          amount: budget.amount || budget.limit || "",
        });
        loadSubCategories(budget.group || budget.category || "Needs");
      } else {
        setForm({
          group: "Needs",
          subCategoryId: "",
          amount: "",
        });
        loadSubCategories("Needs");
      }
    }
  }, [isOpen, budget]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.group || !form.amount) {
      alert("Please fill in all required fields");
      return;
    }

    const payload = {
      group: form.group,
      subCategoryId: form.subCategoryId || "",
      amount: Number(form.amount),
    };

    await onSave(payload);
    onClose();
  };

  const loadSubCategories = async (group) => {
    try {
      setLoadingSubs(true);
      const { data } = await api.get("/subcategories", {
        params: { category: group },
      });
      setSubCategories(data.items || []);
    } catch {
      setSubCategories([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full"
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {budget ? "Edit Budget" : "Create Budget"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group
              </label>
              <select
                value={form.group}
                onChange={(e) => {
                  setForm({
                    ...form,
                    group: e.target.value,
                    subCategoryId: "",
                  });
                  loadSubCategories(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Needs">Needs</option>
                <option value="Wants">Wants</option>
                <option value="Savings">Savings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory (optional)
              </label>
              <select
                value={form.subCategoryId}
                onChange={(e) =>
                  setForm({ ...form, subCategoryId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{loadingSubs ? "Loading…" : "None"}</option>
                {subCategories.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to set a category-level budget
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Budget (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Set your monthly spending limit for this category
              </p>
            </div>

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
                {budget ? "Update Budget" : "Create Budget"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
