import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { formatINR, percent } from "../lib/format";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import AnimatedNumber from "../components/AnimatedNumber";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { GROUP_COLORS } from "../lib/constants";
import {
  computeDisplayMetrics,
  computeChanges,
} from "../lib/financeMetrics";

const RANGE_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
  { value: "all", label: "All Time" },
];

export default function Reports() {
  const navigate = useNavigate();
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [cashflow, setCashflow] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [categoryBreakdownPrev, setCategoryBreakdownPrev] = useState([]);
  const [trends, setTrends] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const prevRange = getPreviousRange(range);
        const [
          sumRes,
          prevSumRes,
          cashRes,
          catRes,
          catPrevRes,
          trendRes,
          profileRes,
        ] = await Promise.all([
          api.get(`/analytics/summary?range=${range}`),
          api.get(`/analytics/summary?range=${prevRange}&offset=1`),
          api.get(
            `/analytics/cashflow?range=${range === "all" ? "12m" : range}`,
          ),
          api.get(`/analytics/category-breakdown?range=${range}`),
          api.get(`/analytics/category-breakdown?range=${prevRange}&offset=1`),
          api.get(`/analytics/trends?range=${range === "all" ? "12m" : range}`),
          api
            .get("/users/me/profile")
            .catch(() => ({ data: { profile: null } })),
        ]);
        if (!mounted) return;

        // Ensure all numbers are clean
        const cleanSummary = {
          income: Number(sumRes.data?.income || 0),
          expense: Number(sumRes.data?.expense || 0),
          savings: Number(sumRes.data?.savings || 0),
          cashflow: Number(sumRes.data?.cashflow || 0),
        };

        const cleanPrevSummary = {
          income: Number(prevSumRes.data?.income || 0),
          expense: Number(prevSumRes.data?.expense || 0),
          savings: Number(prevSumRes.data?.savings || 0),
        };

        // Clean cashflow - ensure all values are numbers
        const cleanCash = (cashRes.data.items || []).map((item) => ({
          period: item.period,
          income: Number(item.income || 0),
          expense: Number(item.expense || 0),
          savings: Number(item.savings || 0),
        }));

        // Clean trends - ensure totals are numbers
        const cleanTrends = (trendRes.data.items || []).map((trend) => ({
          period: trend.period,
          group: trend.group,
          total: Number(trend.total || 0),
        }));

        // Clean category breakdown
        const cleanBreakdown = (catRes.data.items || []).map((cat) => ({
          ...cat,
          total: Number(cat.total || 0),
        }));

        setSummary(cleanSummary);
        setPrevSummary(cleanPrevSummary);
        setCashflow(cleanCash);
        setCategoryBreakdown(cleanBreakdown);
        setCategoryBreakdownPrev(
          (catPrevRes.data.items || []).map((cat) => ({
            ...cat,
            total: Number(cat.total || 0),
          })),
        );
        setTrends(cleanTrends);
        setProfile(profileRes.data?.profile || null);
      } catch (err) {
        console.error("Failed to load reports:", err);
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
    return current || "month";
  }

  const changes = useMemo(
    () =>
      computeChanges(
        summary,
        prevSummary,
        categoryBreakdown,
        categoryBreakdownPrev,
      ),
    [summary, prevSummary, categoryBreakdown, categoryBreakdownPrev],
  );

  const cashflowChange = useMemo(() => {
    if (!summary || !prevSummary) return 0;
    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };
    const calcChange = (curr, prev) => {
      const c = safeNum(curr);
      const p = safeNum(prev);
      return p > 0 ? ((c - p) / p) * 100 : 0;
    };
    return calcChange(summary.cashflow, prevSummary.cashflow || 0);
  }, [summary, prevSummary]);

  const displayMetrics = useMemo(
    () => computeDisplayMetrics(categoryBreakdown),
    [categoryBreakdown],
  );

  // Prepare category stacked bar data (monthly)
  const categoryStackedData = useMemo(() => {
    const monthlyMap = {};

    // Initialize all months in range
    cashflow.forEach((item) => {
      monthlyMap[item.period] = {
        period: item.period,
        Needs: 0,
        Wants: 0,
        Savings: 0,
      };
    });

    // Group trends by period and category - ensure numbers
    trends.forEach((trend) => {
      if (
        monthlyMap[trend.period] &&
        ["Needs", "Wants", "Savings"].includes(trend.group)
      ) {
        const total = Number(trend.total || 0);
        monthlyMap[trend.period][trend.group] =
          Number(monthlyMap[trend.period][trend.group] || 0) + total;
      }
    });

    return Object.values(monthlyMap).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
  }, [cashflow, trends]);

  // Prepare Needs vs Wants trend data
  const needsWantsTrend = useMemo(() => {
    const trendMap = {};

    trends.forEach((trend) => {
      if (!trendMap[trend.period]) {
        trendMap[trend.period] = { period: trend.period, Needs: 0, Wants: 0 };
      }
      if (trend.group === "Needs" || trend.group === "Wants") {
        const total = Number(trend.total || 0);
        trendMap[trend.period][trend.group] =
          Number(trendMap[trend.period][trend.group] || 0) + total;
      }
    });

    return Object.values(trendMap).sort((a, b) => a.period.localeCompare(b.period));
  }, [trends]);

  // Calculate category table data with trends - ensure all numbers
  const categoryTableData = useMemo(() => {
    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };

    const total = categoryBreakdown.reduce(
      (sum, cat) => sum + safeNum(cat.total),
      0,
    );

    return categoryBreakdown
      .map((cat) => {
        const catTotal = safeNum(cat.total);
        const pct = total > 0 ? (catTotal / total) * 100 : 0;

        return {
          ...cat,
          total: catTotal,
          percentage: pct,
          trend: 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [categoryBreakdown]);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    // Navigate to transactions filtered by category
    navigate(`/transactions?category=${category.categoryId || category._id}`);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatINR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Page title="Reports" subtitle="Financial analytics and insights">
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            {RANGE_OPTIONS.map((_, i) => (
              <div key={i} className="h-10 w-24 pw-skeleton rounded-full" />
            ))}
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="pw-card p-6 h-32 pw-skeleton" />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Reports" subtitle="Financial analytics and insights">
      {/* Top: Time Range Selector */}
      <div className="flex justify-end mb-6">
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                range === opt.value
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Income, Expense, Savings, Cashflow */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="text-sm font-medium text-gray-600 mb-2">Income</div>
            <div className="text-3xl font-bold text-green-600 mb-2">
              <AnimatedNumber value={summary?.income || 0} />
            </div>
            <div
              className={`flex items-center gap-1 text-sm ${changes.income >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {changes.income >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span>{Math.abs(changes.income).toFixed(1)}%</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="text-sm font-medium text-gray-600 mb-2">
              Expense (Needs + Wants)
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">
              <AnimatedNumber value={displayMetrics.expenseConsumption || 0} />
            </div>
            <div
              className={`flex items-center gap-1 text-sm ${changes.expense <= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {changes.expense <= 0 ? (
                <TrendingDown size={16} />
              ) : (
                <TrendingUp size={16} />
              )}
              <span>{Math.abs(changes.expense).toFixed(1)}%</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="text-sm font-medium text-gray-600 mb-2">
              Savings (Contributions)
            </div>
            <div className="text-3xl font-bold text-teal-600 mb-2">
              <AnimatedNumber value={displayMetrics.savingsContribution || 0} />
            </div>
            <div
              className={`flex items-center gap-1 text-sm ${changes.savings >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {changes.savings >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span>{Math.abs(changes.savings).toFixed(1)}%</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="text-sm font-medium text-gray-600 mb-2">
              Cashflow
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              <AnimatedNumber value={summary?.cashflow || 0} />
            </div>
            <div
              className={`flex items-center gap-1 text-sm ${cashflowChange >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {cashflowChange >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span>{Math.abs(cashflowChange).toFixed(1)}%</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 2: Category Stacked Bar + Needs vs Wants Trend */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Category Breakdown (Monthly)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryStackedData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
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
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="Needs"
                    stackId="a"
                    fill={GROUP_COLORS.Needs}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                  <Bar
                    dataKey="Wants"
                    stackId="a"
                    fill={GROUP_COLORS.Wants}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                  <Bar
                    dataKey="Savings"
                    stackId="a"
                    fill={GROUP_COLORS.Savings}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Needs vs Wants Trend
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={needsWantsTrend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
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
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Needs"
                    stroke={GROUP_COLORS.Needs}
                    strokeWidth={3}
                    dot={{ fill: GROUP_COLORS.Needs, r: 4 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                  <Line
                    type="monotone"
                    dataKey="Wants"
                    stroke={GROUP_COLORS.Wants}
                    strokeWidth={3}
                    dot={{ fill: GROUP_COLORS.Wants, r: 4 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 3: Category Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="p-6 hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Category Analysis
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Percentage
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Trend
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700"></th>
                </tr>
              </thead>
              <tbody>
                {categoryTableData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No data available
                    </td>
                  </tr>
                ) : (
                  categoryTableData.map((cat, idx) => {
                    const isSelected =
                      selectedCategory?.categoryId === cat.categoryId;
                    return (
                      <motion.tr
                        key={cat.categoryId || idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + idx * 0.05 }}
                        onClick={() => handleCategoryClick(cat)}
                        className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  GROUP_COLORS[cat.group] || "#6b7280",
                              }}
                            />
                            <div>
                              <div className="font-medium text-gray-900">
                                {cat.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {cat.group}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-semibold text-gray-900 pw-number">
                            {formatINR(cat.total)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-sm font-medium text-gray-600">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {cat.trend > 0 ? (
                              <ArrowUp className="w-4 h-4 text-green-600" />
                            ) : cat.trend < 0 ? (
                              <ArrowDown className="w-4 h-4 text-red-600" />
                            ) : (
                              <span className="w-4 h-4 text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </Page>
  );
}
