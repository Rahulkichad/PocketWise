import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { formatINR } from "../lib/format";

export default function SplitTransactionModal({
  isOpen,
  onClose,
  transaction,
  categories = [],
  onSave,
}) {
  const [splits, setSplits] = useState([
    { categoryId: "", amount: "", note: "" },
  ]);

  const totalAmount = transaction?.amount || 0;
  const splitTotal = splits.reduce(
    (sum, s) => sum + (parseFloat(s.amount) || 0),
    0,
  );
  const remaining = totalAmount - splitTotal;

  const handleAddSplit = () => {
    setSplits([...splits, { categoryId: "", amount: "", note: "" }]);
  };

  const handleRemoveSplit = (index) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index][field] = value;
    setSplits(newSplits);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Math.abs(remaining) > 0.01) {
      alert(
        `Split amounts must equal transaction amount. Remaining: ${formatINR(remaining)}`,
      );
      return;
    }

    const payload = splits.map((s) => ({
      categoryId: s.categoryId,
      amount: parseFloat(s.amount),
      note: s.note,
    }));

    const txId = transaction?.id || transaction?._id;
    await onSave(txId, { isSplit: true, splits: payload });
    onClose();
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
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Split Transaction
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {transaction?.merchant ||
                  transaction?.description ||
                  "Transaction"}{" "}
                - {formatINR(totalAmount)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {splits.map((split, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Split {index + 1}
                  </span>
                  {splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={split.categoryId}
                      onChange={(e) =>
                        handleSplitChange(index, "categoryId", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select category</option>
                      {categories
                        .filter((c) =>
                          ["Needs", "Wants", "Savings"].includes(c.group),
                        )
                        .map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) =>
                        handleSplitChange(index, "amount", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={split.note}
                    onChange={(e) =>
                      handleSplitChange(index, "note", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional note"
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Total Split</div>
                <div className="text-lg font-bold text-gray-900">
                  {formatINR(splitTotal)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Remaining</div>
                <div
                  className={`text-lg font-bold ${remaining < 0 ? "text-red-600" : remaining > 0 ? "text-green-600" : "text-gray-900"}`}
                >
                  {formatINR(remaining)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddSplit}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Split
            </button>

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
                disabled={Math.abs(remaining) > 0.01}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Split
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
