import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import api from "../api/client";

export default function GoalCreationModal({
  isOpen,
  onClose,
  onSave,
  goal = null,
}) {
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    targetDate: new Date().toISOString().slice(0, 10),
    startDate: new Date().toISOString().slice(0, 10),
    category: "Savings",
    subCategoryId: "",
  });
  const [subCategories, setSubCategories] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const isInProgress =
    !!goal && ((goal.progress || 0) > 0 || (goal.monthlyActual || 0) > 0);

  useEffect(() => {
    if (isOpen) {
      if (goal) {
        setForm({
          name: goal.name || "",
          targetAmount: goal.targetAmount || "",
          targetDate: goal.targetDate
            ? new Date(goal.targetDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          startDate: goal.startDate
            ? new Date(goal.startDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          category: "Savings",
          subCategoryId: goal.linkedSubCategoryId || "",
        });
      } else {
        setForm({
          name: "",
          targetAmount: "",
          targetDate: new Date().toISOString().slice(0, 10),
          startDate: new Date().toISOString().slice(0, 10),
          category: "Savings",
          subCategoryId: "",
        });
      }
      loadSubCategories("Savings");
    }
  }, [isOpen, goal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.name ||
      !form.targetAmount ||
      !form.targetDate ||
      !form.subCategoryId
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const payload = {
      name: form.name,
      targetAmount: Number(form.targetAmount),
      targetDate: new Date(form.targetDate),
      startDate: new Date(form.startDate),
      category: "Savings",
      subCategoryId: form.subCategoryId,
    };

    await onSave(payload);
    onClose();
  };

  const loadSubCategories = async (category) => {
    try {
      setLoadingSubs(true);
      const { data } = await api.get("/subcategories", {
        params: { category },
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
              {goal ? "Edit Goal" : "Create New Goal"}
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
                Goal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Emergency Fund, Vacation, House Down Payment"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      category: e.target.value,
                      subCategoryId: "",
                    });
                    loadSubCategories(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!goal}
                >
                  <option value="Savings">Savings</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.subCategoryId}
                  onChange={(e) =>
                    setForm({ ...form, subCategoryId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isInProgress}
                  required
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(e) =>
                    setForm({ ...form, targetAmount: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) =>
                    setForm({ ...form, targetDate: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
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
                {goal ? "Update Goal" : "Create Goal"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
