import React, { useEffect, useState } from "react";
import api from "../api/client";

const defaultGoal = () => ({
  name: "",
  targetAmount: "",
  targetDate: new Date().toISOString().slice(0, 10),
});

export default function Profile() {
  const [form, setForm] = useState({
    monthlyIncome: "",
    yearlyIncrementPercent: "",
    age: "",
    riskProfile: "Moderate",
    allocations: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
    goals: [defaultGoal()],
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const totalAlloc =
    Number(form.allocations.needsPct || 0) +
    Number(form.allocations.wantsPct || 0) +
    Number(form.allocations.savingsPct || 0);

  useEffect(() => {
    api.get("/users/me/profile").then(({ data }) => {
      const p = data.profile || {};
      setForm({
        monthlyIncome: p.monthlyIncome ?? "",
        yearlyIncrementPercent: p.yearlyIncrementPercent ?? "",
        age: p.age ?? "",
        riskProfile: p.riskProfile || "Moderate",
        allocations: {
          needsPct: p.allocations?.needsPct ?? 50,
          wantsPct: p.allocations?.wantsPct ?? 30,
          savingsPct: p.allocations?.savingsPct ?? 20,
        },
        goals: (p.goals || []).map((g) => ({
          name: g.name,
          targetAmount: g.targetAmount,
          targetDate: g.targetDate?.slice(0, 10),
        })),
      });
    });
  }, []);

  const updateGoal = (idx, key, val) => {
    setForm((f) => ({
      ...f,
      goals: f.goals.map((g, i) => (i === idx ? { ...g, [key]: val } : g)),
    }));
  };

  const addGoal = () =>
    setForm((f) => ({ ...f, goals: [...f.goals, defaultGoal()] }));
  const removeGoal = (idx) =>
    setForm((f) => ({ ...f, goals: f.goals.filter((_, i) => i !== idx) }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (Math.round(Number(totalAlloc.toFixed(2))) !== 100) {
        setMsg("Allocations must sum to 100%");
        return;
      }
      const payload = {
        monthlyIncome: Number(form.monthlyIncome || 0),
        yearlyIncrementPercent: Number(form.yearlyIncrementPercent || 0),
        age: Number(form.age || 0),
        riskProfile: form.riskProfile,
        allocations: {
          needsPct: Number(form.allocations.needsPct || 0),
          wantsPct: Number(form.allocations.wantsPct || 0),
          savingsPct: Number(form.allocations.savingsPct || 0),
        },
        goals: form.goals
          .filter((g) => g.name)
          .map((g) => ({
            name: g.name,
            targetAmount: Number(g.targetAmount || 0),
            targetDate: new Date(g.targetDate),
          })),
      };
      await api.put("/users/me/profile", payload);
      setMsg("Profile updated");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Profile</h1>
      {msg && (
        <div className="bg-green-50 text-green-700 p-2 rounded mb-3">{msg}</div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Monthly Salary (₹)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={form.monthlyIncome}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlyIncome: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Yearly Increment (%)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={form.yearlyIncrementPercent}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  yearlyIncrementPercent: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Age</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Risk Profile</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.riskProfile}
              onChange={(e) =>
                setForm((f) => ({ ...f, riskProfile: e.target.value }))
              }
            >
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Custom Allocation Rule</div>
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
                    allocations: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
                  }))
                }
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                50·30·20
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    allocations: { needsPct: 70, wantsPct: 20, savingsPct: 10 },
                  }))
                }
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                70·20·10
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    allocations: { needsPct: 60, wantsPct: 20, savingsPct: 20 },
                  }))
                }
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                60·20·20
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Needs (%)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.allocations.needsPct}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allocations: { ...f.allocations, needsPct: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Wants (%)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.allocations.wantsPct}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allocations: { ...f.allocations, wantsPct: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Savings (%)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Goals</h2>
            <button
              type="button"
              onClick={addGoal}
              className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
            >
              Add Goal
            </button>
          </div>
          <div className="space-y-3">
            {form.goals.map((g, idx) => (
              <div key={idx} className="grid md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-sm mb-1">Name</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={g.name}
                    onChange={(e) => updateGoal(idx, "name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Target Amount (₹)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    value={g.targetAmount}
                    onChange={(e) =>
                      updateGoal(idx, "targetAmount", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Target Date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={g.targetDate}
                    onChange={(e) =>
                      updateGoal(idx, "targetDate", e.target.value)
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => removeGoal(idx)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          disabled={saving}
          className="bg-primary-600 text-white rounded px-4 py-2"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
