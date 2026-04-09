import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import api from "../api/client";

export default function RecurringModal({
  isOpen,
  onClose,
  onSave,
  categories,
  recurring,
}) {
  const [form, setForm] = useState({
    name: "",
    type: "expense",
    category: "Needs",
    subCategoryId: "",
    typicalAmount: "",
    cadence: "monthly",
    dayOfMonth: 1,
    timeOfDay: "09:00",
    paymentMethod: "other",
    description: "",
  });
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    if (recurring) {
      setForm({
        name: recurring.name || "",
        type: recurring.type || "expense",
        category:
          recurring.type === "income"
            ? "Income"
            : recurring.category || "Needs",
        subCategoryId: recurring.subCategoryId || "",
        typicalAmount: recurring.typicalAmount || "",
        cadence: recurring.cadence || "monthly",
        dayOfMonth: recurring.dayOfMonth || 1,
        timeOfDay: recurring.timeOfDay || "09:00",
        paymentMethod: recurring.paymentMethod || "other",
        description: recurring.description || "",
      });
    } else {
      setForm({
        name: "",
        type: "expense",
        category: "Needs",
        subCategoryId: "",
        typicalAmount: "",
        cadence: "monthly",
        dayOfMonth: 1,
        timeOfDay: "09:00",
        paymentMethod: "other",
        description: "",
      });
    }
  }, [isOpen, recurring]);

  useEffect(() => {
    if (!form.category || form.type !== "expense") {
      setSubs([]);
      return;
    }
    api
      .get(`/subcategories?category=${form.category}`)
      .then(({ data }) => {
        setSubs(data.items || []);
      })
      .catch(() => setSubs([]));
  }, [form.category, form.type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      category: form.type === "income" ? "Income" : form.category,
      subCategoryId:
        form.type === "expense" ? form.subCategoryId || undefined : undefined,
      typicalAmount: Number(form.typicalAmount || 0),
      cadence: form.cadence,
      dayOfMonth: Number(form.dayOfMonth || 1),
      timeOfDay: form.timeOfDay,
      paymentMethod: form.paymentMethod,
      description: form.description,
    };
    onSave?.(payload, recurring?._id);
  };

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-lg"
        >
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Add Recurring</h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Netflix, SIP"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={form.type === "income"}
                >
                  {["Needs", "Wants", "Savings"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.type === "expense" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subcategory
                </label>
                <select
                  value={form.subCategoryId}
                  onChange={(e) =>
                    setForm({ ...form, subCategoryId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {subs.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={form.typicalAmount}
                  onChange={(e) =>
                    setForm({ ...form, typicalAmount: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm({ ...form, paymentMethod: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {["cash", "upi", "card", "bank", "other"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cadence
                </label>
                <select
                  value={form.cadence}
                  onChange={(e) =>
                    setForm({ ...form, cadence: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Month
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) =>
                    setForm({ ...form, dayOfMonth: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time of Day
                </label>
                <input
                  type="time"
                  value={form.timeOfDay}
                  onChange={(e) =>
                    setForm({ ...form, timeOfDay: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional note"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
