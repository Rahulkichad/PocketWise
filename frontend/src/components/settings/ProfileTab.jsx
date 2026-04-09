import React, { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { User, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfileTab() {
  const [form, setForm] = useState({
    monthlyIncome: "",
    yearlyIncrementPercent: "",
    age: "",
    riskProfile: "Moderate",
    allocations: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totalAlloc =
    Number(form.allocations.needsPct || 0) +
    Number(form.allocations.wantsPct || 0) +
    Number(form.allocations.savingsPct || 0);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await api.get("/users/me/profile");
      const p = data.profile || {};
      setForm({
        monthlyIncome: p.monthlyIncome || "",
        yearlyIncrementPercent: p.yearlyIncrementPercent ?? "",
        age: p.age || "",
        riskProfile: p.riskProfile || "Moderate",
        allocations: {
          needsPct: p.allocations?.needsPct ?? 50,
          wantsPct: p.allocations?.wantsPct ?? 30,
          savingsPct: p.allocations?.savingsPct ?? 20,
        },
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (Math.round(Number(totalAlloc.toFixed(2))) !== 100) {
        setMessage("Allocations must sum to 100%");
        return;
      }
      await api.put("/users/me/profile", {
        monthlyIncome: Number(form.monthlyIncome || 0),
        yearlyIncrementPercent: Number(form.yearlyIncrementPercent || 0),
        age: Number(form.age || 0),
        riskProfile: form.riskProfile,
        allocations: {
          needsPct: Number(form.allocations.needsPct || 0),
          wantsPct: Number(form.allocations.wantsPct || 0),
          savingsPct: Number(form.allocations.savingsPct || 0),
        },
      });
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setMessage("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Update your personal information and preferences
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div
                className={`p-3 rounded-lg ${
                  message.includes("success")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={form.monthlyIncome}
                  onChange={(e) =>
                    setForm({ ...form, monthlyIncome: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yearly Increment (%)
                </label>
                <input
                  type="number"
                  value={form.yearlyIncrementPercent}
                  onChange={(e) =>
                    setForm({ ...form, yearlyIncrementPercent: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Profile
                </label>
                <select
                  value={form.riskProfile}
                  onChange={(e) =>
                    setForm({ ...form, riskProfile: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Custom Allocation Rule
                  </div>
                  <div className="text-xs text-gray-500">
                    Set Needs/Wants/Savings percentages (must total 100%)
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          needsPct: 50,
                          wantsPct: 30,
                          savingsPct: 20,
                        },
                      }))
                    }
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    50·30·20
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          needsPct: 70,
                          wantsPct: 20,
                          savingsPct: 10,
                        },
                      }))
                    }
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    70·20·10
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          needsPct: 60,
                          wantsPct: 20,
                          savingsPct: 20,
                        },
                      }))
                    }
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    60·20·20
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Needs (%)
                  </label>
                  <input
                    type="number"
                    value={form.allocations.needsPct}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          ...f.allocations,
                          needsPct: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wants (%)
                  </label>
                  <input
                    type="number"
                    value={form.allocations.wantsPct}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          ...f.allocations,
                          wantsPct: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Savings (%)
                  </label>
                  <input
                    type="number"
                    value={form.allocations.savingsPct}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allocations: {
                          ...f.allocations,
                          savingsPct: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <div
                className={`text-xs ${Math.round(Number(totalAlloc.toFixed(2))) === 100 ? "text-emerald-600" : "text-red-600"}`}
              >
                Total: {Number(totalAlloc.toFixed(2))}%{" "}
                {Math.round(Number(totalAlloc.toFixed(2))) !== 100
                  ? "(must be 100%)"
                  : ""}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save size={18} />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
