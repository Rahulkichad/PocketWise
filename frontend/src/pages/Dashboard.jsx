import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { formatINR, percent } from "../lib/format";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import MetricCard from "../components/MetricCard";
import TransactionReviewCard from "../components/TransactionReviewCard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, PiggyBank, Info } from "lucide-react";
import { motion } from "framer-motion";
import { GROUP_COLORS } from "../lib/constants";
import { computeDisplayMetrics, computeChanges } from "../lib/financeMetrics";
const RANGE_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "all", label: "All" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [sum, setSum] = useState(null);
  const [prevSum, setPrevSum] = useState(null);
  const [reco, setReco] = useState(null);
  const [cash, setCash] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [breakdownPrev, setBreakdownPrev] = useState([]);
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [toReview, setToReview] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [taxSaved, setTaxSaved] = useState(0);
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [showSavings, setShowSavings] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const chartRange =
          range === "all" ? "12m" : range === "month" ? "3m" : range;
        const [
          sumRes,
          prevSumRes,
          cashRes,
          brkRes,
          brkPrevRes,
          recoRes,
          reviewRes,
          upcomingRes,
          goalsRes,
          profileRes,
          budgetsRes,
        ] = await Promise.all([
          api.get(`/analytics/summary?range=${range}`),
          api.get(`/analytics/summary?range=${getPreviousRange(range)}`),
          api.get(`/analytics/cashflow?range=${chartRange}`),
          api.get(`/analytics/category-breakdown?range=${range}`),
          api.get(
            `/analytics/category-breakdown?range=${getPreviousRange(range)}`,
          ),
          api.post("/finance/recommend", {}),
          api.get("/transactions", {
            params: { reviewed: "false", limit: 10 },
          }),
          api
            .get("/analytics/recurring")
            .catch(() => ({ data: { items: [] } })),
          api.get("/goals").catch(() => ({ data: { items: [] } })),
          api
            .get("/users/me/profile")
            .catch(() => ({ data: { profile: null } })),
          api
            .get(
              `/budgets?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`,
            )
            .catch(() => ({ data: { items: [] } })),
        ]);
        if (!mounted) return;

        // Ensure all numbers are clean
        const cleanSum = {
          income: Number(sumRes.data?.income || 0),
          expense: Number(sumRes.data?.expense || 0),
          savings: Number(sumRes.data?.savings || 0),
          cashflow: Number(sumRes.data?.cashflow || 0),
          investable: Number(sumRes.data?.investable || 0),
        };

        const cleanPrevSum = {
          income: Number(prevSumRes.data?.income || 0),
          expense: Number(prevSumRes.data?.expense || 0),
          savings: Number(prevSumRes.data?.savings || 0),
        };

        // Clean cashflow data
        const cleanCash = (cashRes.data.items || []).map((item) => ({
          period: item.period,
          income: Number(item.income || 0),
          expense: Number(item.expense || 0),
          savings: Number(item.savings || 0),
        }));

        setPrevSum(cleanPrevSum);
        setSum(cleanSum);
        setCash(cleanCash);
        setBreakdown(brkRes.data.items || []);
        setBreakdownPrev(brkPrevRes.data.items || []);
        setReco(recoRes.data);
        setToReview(reviewRes.data || []);
        setUpcoming((upcomingRes.data?.items || []).slice(0, 5));
        setGoals(goalsRes.data?.items || []);
        setBudgets(budgetsRes.data?.items || []);

        // Tax saved estimate using recommendations + profile
        const profile = profileRes.data?.profile || {};
        let annualIncome = Number(profile?.monthlyIncome || 0) * 12;
        if (!annualIncome || isNaN(annualIncome) || annualIncome <= 0) {
          const yrMap = { month: 12, "3m": 4, "6m": 2, "12m": 1, all: 1 };
          const multiplier = yrMap[range] || 12;
          annualIncome = Number(sumRes.data?.income || 0) * multiplier;
        }
        const age = Number(profile?.age || 0);
        const instruments = Array.isArray(recoRes.data?.instruments)
          ? recoRes.data.instruments
          : [];
        const invested80C = instruments
          .filter((inst) => ["PPF", "ELSS"].includes(inst.type))
          .reduce((sum, inst) => sum + Number(inst.monthlyAmount || 0) * 12, 0);
        const invested80CCD1B = instruments
          .filter((inst) => inst.type === "NPS")
          .reduce((sum, inst) => sum + Number(inst.monthlyAmount || 0) * 12, 0);
        const invested80D = 0;
        try {
          const taxRes = await api.post("/finance/tax", {
            annualIncome,
            investedUnder80C: invested80C,
            investedUnder80D: invested80D,
            investedUnder80CCD1B: invested80CCD1B,
            age,
          });
          setTaxSaved(Number(taxRes.data?.taxSave || 0));
        } catch {
          setTaxSaved(0);
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [range]);

  function getPreviousRange(current) {
    const map = {
      month: "3m",
      "3m": "6m",
      "6m": "12m",
      "12m": "all",
      all: "all",
    };
    return map[current] || "month";
  }

  const changes = useMemo(
    () => computeChanges(sum, prevSum, breakdown, breakdownPrev),
    [sum, prevSum, breakdown, breakdownPrev],
  );

  // Generate sparkline data from cashflow - ensure all values are numbers
  const sparklines = useMemo(() => {
    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };

    const incomeData = cash.map((c) => ({ value: safeNum(c.income) }));
    const expenseData = cash.map((c) => ({ value: safeNum(c.expense) }));
    const savingsData = cash.map((c) => ({ value: safeNum(c.savings) }));
    return { income: incomeData, expense: expenseData, savings: savingsData };
  }, [cash]);

  const expenseByGroup = useMemo(() => {
    const map = { Needs: 0, Wants: 0, Savings: 0 };
    for (const r of breakdown) {
      map[r.group || "Needs"] += r.total || 0;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [breakdown]);

  const displayMetrics = useMemo(
    () => computeDisplayMetrics(breakdown),
    [breakdown],
  );

  // Budget aggregates - use category-level cap; if absent, sum subcategory budgets
  const budgetAgg = useMemo(() => {
    const cats = ["Needs", "Wants", "Savings"];
    const agg = {
      Needs: { limit: 0, spent: 0 },
      Wants: { limit: 0, spent: 0 },
      Savings: { limit: 0, spent: 0 },
    };
    for (const cat of cats) {
      const catBudget = budgets.find(
        (b) => (b.category === cat || b.group === cat) && !b.subCategoryId,
      );
      const subBudgets = budgets.filter(
        (b) => (b.category === cat || b.group === cat) && !!b.subCategoryId,
      );
      const limit = catBudget
        ? Number(catBudget.amount || catBudget.limit || 0)
        : subBudgets.reduce(
            (sum, s) => sum + Number(s.amount || s.limit || 0),
            0,
          );
      const spent = catBudget
        ? Number(catBudget.spent || 0)
        : subBudgets.reduce((sum, s) => sum + Number(s.spent || 0), 0);
      agg[cat].limit = limit;
      agg[cat].spent = spent;
    }
    const overspent = Object.values(agg).filter(
      (v) => v.spent > v.limit,
    ).length;
    return { agg, overspent };
  }, [budgets]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/transactions/${id}/reviewed`);
      setToReview((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      console.error("Failed to approve transaction:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      setToReview((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      console.error("Failed to reject transaction:", err);
    }
  };

  if (loading)
    return (
      <Page title="Dashboard" subtitle="Your financial command center">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {RANGE_OPTIONS.map((_, i) => (
                <div key={i} className="h-8 w-16 pw-skeleton rounded-full" />
              ))}
            </div>
            <div className="h-10 w-24 pw-skeleton rounded-lg" />
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pw-card p-6 h-40 pw-skeleton" />
            ))}
          </div>
          <div className="grid md:grid-cols-10 gap-6">
            <div className="md:col-span-7 pw-card p-5 h-80 pw-skeleton" />
            <div className="md:col-span-3 pw-card p-5 h-80 pw-skeleton" />
          </div>
        </div>
      </Page>
    );

  return (
    <Page title="Dashboard" subtitle="Your financial command center">
      {/* Top Bar: Time Range Pills + Quick Add */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                range === opt.value
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => navigate("/transactions")}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Quick Add
        </Button>
      </div>

      {/* Row 1: 3 Metric Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Income"
          value={
            typeof sum?.income === "number"
              ? sum.income
              : Number(sum?.income || 0)
          }
          change={changes.income}
          sparklineData={sparklines.income}
          color="#22c55e"
          icon={TrendingUp}
        />
        <MetricCard
          title="Expenses"
          value={displayMetrics.expenseConsumption}
          change={changes.expense}
          sparklineData={sparklines.expense}
          color="#ef4444"
          icon={TrendingDown}
        />
        <MetricCard
          title="Savings"
          value={displayMetrics.savingsContribution}
          change={changes.savings}
          sparklineData={sparklines.savings}
          color="#34d399"
          icon={PiggyBank}
        />
      </div>

      {/* Row 1b: Tax Saved + Tips */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
          <div className="text-sm text-gray-500 mb-1">Tax Saved (Est.)</div>
          <div className="text-2xl font-bold text-green-600">
            {formatINR(taxSaved)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Based on current recommendations
          </div>
        </Card>
        <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-600" />
            <div className="text-sm font-semibold text-gray-900">
              Tax Tips & Finance Rules
            </div>
          </div>
          <div className="text-xs text-gray-700 space-y-2">
            <div>
              Old regime allows 80C, 80CCD(1B), 80D, HRA; new regime offers lower rates with standard deduction.
            </div>
            <div>
              80C up to ₹1.5L; NPS 80CCD(1B) up to ₹50k; 80D up to ₹25k/₹50k for seniors.
            </div>
            <div>
              Budget rule of thumb: Needs 40–50%, Wants 20–30%, Savings 20–30%.
            </div>
            <div>
              Build 3–6 months emergency fund; prioritize term and health insurance.
            </div>
            <div>
              Keep EMIs ≤ 30–40% of income; refinance high-rate debt.
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Cashflow Chart (70%) + Expense Ring (30%) */}
      <div className="grid md:grid-cols-10 gap-6 mb-6">
        <Card className="md:col-span-7 p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Cashflow</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowIncome((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${showIncome ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
              >
                Income
              </button>
              <button
                onClick={() => setShowExpense((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${showExpense ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
              >
                Expense
              </button>
              <button
                onClick={() => setShowSavings((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${showSavings ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
              >
                Savings
              </button>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cash}
                margin={{ left: 8, right: 8, top: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatINR(v)}
                  width={80}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => formatINR(v)}
                  contentStyle={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    border: "none",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                {showIncome && (
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gIncome)"
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                )}
                {showExpense && (
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gExpense)"
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                )}
                {showSavings && (
                  <Area
                    type="monotone"
                    dataKey="savings"
                    stroke="#34d399"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gSavings)"
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                )}
                {range === "month" && (
                  <ReferenceLine
                    x={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                    stroke="#0ea5e9"
                    strokeDasharray="4 2"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="md:col-span-3 p-6 hover:shadow-xl transition-shadow duration-300">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Expense Split
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByGroup}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {expenseByGroup.map((e, i) => (
                    <Cell
                      key={i}
                      fill={GROUP_COLORS[e.name] || "#ddd"}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatINR(v)}
                  contentStyle={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    border: "none",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3: Budgets Status (Left) + Goals Overview (Right) */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Budgets Status</h2>
            {budgetAgg.overspent > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                {budgetAgg.overspent} Overspent
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {["Savings", "Needs", "Wants"].map((cat) => {
              const v = budgetAgg.agg[cat];
              const pct =
                v.limit > 0 ? Math.min(100, (v.spent / v.limit) * 100) : 0;
              const color = GROUP_COLORS[cat] || "#3b82f6";
              return (
                <div key={cat} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {cat}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    {formatINR(v.spent)} / {formatINR(v.limit)}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/budgets")}
              className="text-sm"
            >
              Manage Budgets
            </Button>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Goals Overview</h2>
          </div>
          <div className="space-y-3">
            {goals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🎯</div>
                <div>No goals yet</div>
              </div>
            ) : (
              goals.slice(0, 4).map((g, idx) => {
                const targetDate = new Date(g.targetDate);
                const daysUntil = Math.ceil(
                  (targetDate - new Date()) / (1000 * 60 * 60 * 24),
                );
                const progressPct =
                  g.targetAmount > 0
                    ? Math.min(
                        100,
                        (Number(g.progress || 0) /
                          Number(g.targetAmount || 1)) *
                          100,
                      )
                    : 0;
                const onTrack =
                  (g.monthlyActual || 0) >= (g.monthlyContribution || 0);
                return (
                  <motion.div
                    key={g._id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-gray-900">
                        {g.name}
                      </div>
                      <div
                        className={`text-xs ${onTrack ? "text-green-600" : "text-gray-500"}`}
                      >
                        {onTrack ? "On Track" : "Behind"}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-purple-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                      <span>
                        Plan {formatINR(g.monthlyContribution || 0)} • Actual{" "}
                        {formatINR(g.monthlyActual || 0)}
                      </span>
                      <span>
                        {daysUntil > 0 ? `${daysUntil} days left` : "Overdue"}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/goals")}
              className="text-sm"
            >
              Manage Goals
            </Button>
          </div>
        </Card>
      </div>

      

      {/* Row 5: Investment Recommendations */}
      {reco && (
        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Investment Recommendations
          </h2>
          {reco.instruments &&
          Array.isArray(reco.instruments) &&
          reco.instruments.length > 0 ? (
            <div className="space-y-4">
              {reco.instruments.map((instrument, idx) => {
                const totalInvestable = reco.investableMonthly || 1;
                const progress =
                  (instrument.monthlyAmount / totalInvestable) * 100;
                const colorMap = {
                  SIP: "#3b82f6",
                  PPF: "#22c55e",
                  NPS: "#f59e0b",
                  ELSS: "#8b5cf6",
                };
                const color = colorMap[instrument.type] || "#6b7280";

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-4 py-2 rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {instrument.type}
                        </span>
                        <span className="text-sm text-gray-600">
                          {instrument.rationale}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {formatINR(instrument.monthlyAmount)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💡</div>
              <div>
                Complete your profile to get personalized recommendations
              </div>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
