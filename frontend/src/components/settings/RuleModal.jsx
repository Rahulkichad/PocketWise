import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function RuleModal({ isOpen, onClose, onSave, rule = null }) {
  const [form, setForm] = useState({
    if: {
      merchantContains: "",
      descriptionContains: "",
      amountMin: "",
      amountMax: "",
    },
    then: {
      setCategoryId: "",
      addTags: [],
      markReviewed: false,
      setRecurring: false,
    },
    isActive: true,
  });

  useEffect(() => {
    if (isOpen && rule) {
      setForm(rule);
    } else if (isOpen) {
      setForm({
        if: {
          merchantContains: "",
          descriptionContains: "",
          amountMin: "",
          amountMax: "",
        },
        then: {
          setCategoryId: "",
          addTags: [],
          markReviewed: false,
          setRecurring: false,
        },
        isActive: true,
      });
    }
  }, [isOpen, rule]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
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
              {rule ? "Edit Rule" : "Create Rule"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                If (Conditions)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Merchant Contains
                  </label>
                  <input
                    type="text"
                    value={form.if.merchantContains}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        if: { ...form.if, merchantContains: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Amazon, Swiggy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description Contains
                  </label>
                  <input
                    type="text"
                    value={form.if.descriptionContains}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        if: { ...form.if, descriptionContains: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., UPI, Salary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Min
                    </label>
                    <input
                      type="number"
                      value={form.if.amountMin}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          if: { ...form.if, amountMin: e.target.value },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Max
                    </label>
                    <input
                      type="number"
                      value={form.if.amountMax}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          if: { ...form.if, amountMax: e.target.value },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Then (Actions)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Set Category
                  </label>
                  <input
                    type="text"
                    value={form.then.setCategoryId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        then: { ...form.then, setCategoryId: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Category ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={form.then.addTags.join(", ")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        then: {
                          ...form.then,
                          addTags: e.target.value
                            .split(",")
                            .map((t) => t.trim()),
                        },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., recurring, subscription"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.then.markReviewed}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          then: {
                            ...form.then,
                            markReviewed: e.target.checked,
                          },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Mark as Reviewed
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.then.setRecurring}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          then: {
                            ...form.then,
                            setRecurring: e.target.checked,
                          },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Mark as Recurring
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
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
                {rule ? "Update Rule" : "Create Rule"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
