import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import api from "../api/client";
import { formatINR } from "../lib/format";
import { showToast } from "./Toast";

export default function LinkInvestmentModal({ isOpen, onClose, goal, onSave }) {
  const [reco, setReco] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [form, setForm] = useState({
    investmentType: goal?.investmentType || "",
    monthlyContribution: goal?.monthlyContribution || "",
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        investmentType: goal?.investmentType || "",
        monthlyContribution: goal?.monthlyContribution || "",
      });
      loadReco();
    }
  }, [isOpen, goal?._id]);

  const loadReco = async () => {
    try {
      const { data } = await api.post("/finance/recommend", {});
      setReco(data);
      const list = Array.isArray(data?.instruments) ? data.instruments : [];
      setInstruments(list);

      // Auto-set investment type and amount based on goal hint if available
      const hint = (data?.goalHints || []).find((h) => h.name === goal?.name);
      if (hint) {
        setForm({
          investmentType: hint.suggestedVehicle,
          monthlyContribution: hint.recommendedAmount || hint.monthlyRequired || "",
        });
      } else if (!form.investmentType && list.length) {
        setForm((f) => ({ ...f, investmentType: list[0].type }));
      }
    } catch {
      setInstruments([
        { type: "SIP", monthlyAmount: 2000 },
        { type: "PPF", monthlyAmount: 1500 },
        { type: "NPS", monthlyAmount: 1000 },
        { type: "ELSS", monthlyAmount: 2500 },
      ]);
    }
  };

  const getRecommendedValue = () => {
    // If we have a goal and it has a calculated requirement, that should be the primary recommendation
    if (goal) {
      const targetDate = new Date(goal.targetDate);
      const now = new Date();
      const daysUntil = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
      const monthsUntil = Math.ceil(daysUntil / 30);
      const remaining = Math.max(0, (Number(goal.targetAmount) || 0) - (Number(goal.progress) || 0));
      const goalRequired = monthsUntil > 0 ? remaining / monthsUntil : remaining;

      if (goalRequired > 0) return Math.ceil(goalRequired);
    }

    if (!reco) return null;
    // ... fallback to general reco if no goal or requirement
    return instruments.find((i) => i.type === form.investmentType)?.monthlyAmount;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.investmentType) {
      showToast("Select investment type", "warning");
      return;
    }
    const payload = {
      investmentType: form.investmentType,
      monthlyContribution: Number(form.monthlyContribution || 0),
    };
    await onSave(payload);
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
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full"
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Link Investment
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
                Investment Type
              </label>
              <select
                value={form.investmentType}
                onChange={(e) =>
                  setForm({ ...form, investmentType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {instruments.map((ins, idx) => (
                  <option key={idx} value={ins.type}>
                    {ins.type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Contribution (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.monthlyContribution}
                onChange={(e) =>
                  setForm({ ...form, monthlyContribution: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended:{" "}
                {getRecommendedValue() ? formatINR(getRecommendedValue()) : "—"}
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
                Save Link
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
