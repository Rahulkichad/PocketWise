import React, { useEffect, useState } from "react";
import api from "../api/client";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import GoalCard from "../components/GoalCard";
import GoalCreationModal from "../components/GoalCreationModal";
import LinkInvestmentModal from "../components/LinkInvestmentModal";
import EmptyState from "../components/ui/EmptyState";
import { Plus, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [linkingGoal, setLinkingGoal] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const { data } = await api.get("/goals");
      setGoals(data.items || []);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleLink = (goal) => {
    setLinkingGoal(goal);
    setIsLinkOpen(true);
  };
  const handleLinkSuggested = async (goal) => {
    try {
      const { data: reco } = await api.post("/finance/recommend", {});
      const hint = (reco?.goalHints || []).find((h) => h.name === goal.name);
      const vehicle =
        hint?.suggestedVehicle || reco?.instruments?.[0]?.type || "SIP";
      const monthly =
        (reco?.instruments || []).find((i) => i.type === vehicle)
          ?.monthlyAmount || 0;
      await api.put(`/goals/${goal._id}`, {
        investmentType: vehicle,
        monthlyContribution: Number(monthly || 0),
      });
      await loadGoals();
    } catch (e) {
      alert("Failed to link suggested investment");
    }
  };

  const handleSave = async (goalData) => {
    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal._id}`, {
          name: goalData.name,
          targetAmount: goalData.targetAmount,
          targetDate: goalData.targetDate,
          startDate: goalData.startDate,
          linkedSubCategoryId: goalData.subCategoryId,
        });
      } else {
        await api.post("/goals", {
          name: goalData.name,
          targetAmount: goalData.targetAmount,
          targetDate: goalData.targetDate,
          startDate: goalData.startDate,
          linkedSubCategoryId: goalData.subCategoryId,
        });
      }
      await loadGoals();
    } catch (err) {
      console.error("Failed to save goal:", err);
      alert("Failed to save goal. Please try again.");
    }
  };

  const handleLinkSave = async (payload) => {
    try {
      await api.put(`/goals/${linkingGoal._id}`, payload);
      await loadGoals();
    } catch (err) {
      console.error("Failed to link investment:", err);
      alert("Failed to link investment. Please try again.");
    }
  };

  const handleDelete = async (goal) => {
    try {
      const id = goal._id || goal.id;
      await api.delete(`/goals/${id}`);
      await loadGoals();
    } catch (err) {
      console.error("Failed to delete goal:", err);
      alert(
        err?.response?.data?.message ||
          "Failed to delete goal. Please try again.",
      );
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index) => {
    setDragOverIndex(index);
  };

  const handleDrop = async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const newGoals = [...goals];
    const [removed] = newGoals.splice(fromIndex, 1);
    newGoals.splice(toIndex, 0, removed);

    try {
      setGoals(newGoals);
    } catch (err) {
      console.error("Failed to reorder goals:", err);
      alert("Failed to reorder goals. Please try again.");
    } finally {
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  // Fetch linked investments from recommendations
  useEffect(() => {
    const fetchLinkedInvestments = async () => {
      try {
        const { data: reco } = await api.post("/finance/recommend", {});
        if (reco?.goalHints) {
          setGoals((prevGoals) =>
            prevGoals.map((goal) => {
              const hint = reco.goalHints.find((h) => h.name === goal.name);
              return {
                ...goal,
                linkedInvestments: hint ? [hint.suggestedVehicle] : [],
              };
            }),
          );
        }
      } catch (err) {
        // Silently fail - linked investments are optional
      }
    };

    if (goals.length > 0) {
      fetchLinkedInvestments();
    }
  }, [goals.length]);

  if (loading) {
    return (
      <Page title="Goals" subtitle="Track your financial goals">
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="pw-card p-6 h-64 pw-skeleton" />
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page title="Goals" subtitle="Track your financial goals">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {goals.length} {goals.length === 1 ? "Goal" : "Goals"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Track your progress and stay on target
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          New Goal
        </Button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <EmptyState
              title="No goals yet"
              description="Create your first goal to start tracking your financial progress"
              action={
                <Button variant="primary" onClick={handleCreate}>
                  <Plus size={18} className="mr-2" />
                  Create Your First Goal
                </Button>
              }
            />
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {goals.map((goal, index) => (
              <GoalCard
                key={index}
                goal={goal}
                index={index}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDragging={draggedIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onLink={handleLink}
                onLinkSuggested={handleLinkSuggested}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <GoalsCalendar goals={goals} />

      {/* Goal Creation/Edit Modal */}
      <GoalCreationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSave}
        goal={editingGoal}
      />
      <LinkInvestmentModal
        isOpen={isLinkOpen}
        onClose={() => {
          setIsLinkOpen(false);
          setLinkingGoal(null);
        }}
        onSave={handleLinkSave}
        goal={linkingGoal}
      />
    </Page>
  );
}

function GoalsCalendar({ goals }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const days = Array.from({ length: endOfMonth.getDate() }, (_, i) => i + 1);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const events = goals.map((g) => ({
    name: g.name,
    startDate: g.startDate ? new Date(g.startDate) : null,
    targetDate: g.targetDate ? new Date(g.targetDate) : null,
  }));
  const grid = days.map((d) => {
    const date = new Date(year, month, d);
    const list = events
      .filter((e) => {
        const s =
          e.startDate &&
          e.startDate.getFullYear() === year &&
          e.startDate.getMonth() === month &&
          e.startDate.getDate() === d;
        const t =
          e.targetDate &&
          e.targetDate.getFullYear() === year &&
          e.targetDate.getMonth() === month &&
          e.targetDate.getDate() === d;
        return s || t;
      })
      .map((e) => ({
        name: e.name,
        type:
          e.startDate &&
          e.startDate.getFullYear() === year &&
          e.startDate.getMonth() === month &&
          e.startDate.getDate() === d
            ? "Start"
            : "Target",
      }));
    return { day: d, items: list };
  });
  const prev = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m);
    setYear(y);
  };
  const next = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m);
    setYear(y);
  };
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm w-24"
            min="1900"
            max="2100"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="px-3 py-2 border rounded-lg">
            Prev
          </button>
          <button onClick={next} className="px-3 py-2 border rounded-lg">
            Next
          </button>
        </div>
      </div>
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="text-xs font-medium text-gray-500">
              {w}
            </div>
          ))}
          {Array.from({ length: startOfMonth.getDay() }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {grid.map(({ day, items }) => (
            <div key={day} className="border rounded-lg p-2 min-h-[80px]">
              <div className="text-xs font-semibold text-gray-700">{day}</div>
              <div className="mt-1 space-y-1">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className={`text-xs px-2 py-1 rounded ${it.type === "Start" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                  >
                    {it.type}: {it.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
