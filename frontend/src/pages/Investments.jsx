import React, { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import { formatINR } from "../lib/format";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import InvestmentCard from "../components/InvestmentCard";
import AnimatedNumber from "../components/AnimatedNumber";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Target,
  TrendingUp,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { groupTotals, safeNum } from "../lib/financeMetrics";
import { allocateInvestments, scaleAllocation, applyAdjustmentBias } from "../lib/investmentAllocation";

/** Period presets for analytics (backend: analyticsService getAnalyticsBounds) */
function buildAnalyticsQuery(periodMode, periodYear, periodMonth) {
  if (periodMode === "recent") return { range: "month", offset: 0 };
  if (periodMode === "month") {
    return { range: "month", calendarYear: periodYear, calendarMonth: periodMonth };
  }
  if (periodMode === "year") return { range: "calyear", calendarYear: periodYear };
  if (periodMode === "all") return { range: "all" };
  return { range: "month", offset: 0 };
}

const MONTH_NAMES = [
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

export default function Investments() {
  const [reco, setReco] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [displayMetrics, setDisplayMetrics] = useState({ expenseConsumption: 0, savingsContribution: 0 });
  const [dataLabel, setDataLabel] = useState("");
  const [missingIncome, setMissingIncome] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [aiBiasActive, setAiBiasActive] = useState(false);
  const [showAllocationWhy, setShowAllocationWhy] = useState(false);
  const [showInstrumentWhys, setShowInstrumentWhys] = useState({});
  const [showSipWhy, setShowSipWhy] = useState({});
  const [showScenarioWhy, setShowScenarioWhy] = useState({});
  const [showScenarios, setShowScenarios] = useState({});
  const [goalSipDeltaPending, setGoalSipDeltaPending] = useState({});

  const [periodMode, setPeriodMode] = useState("recent");
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [analysisMonths, setAnalysisMonths] = useState(1);
  const [periodTotals, setPeriodTotals] = useState(null);
  const [periodControlsOpen, setPeriodControlsOpen] = useState(false);

  const analyticsParams = useMemo(
    () => buildAnalyticsQuery(periodMode, periodYear, periodMonth),
    [periodMode, periodYear, periodMonth],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const q = analyticsParams;
        const [p, brkRes, sumRes, budRes] = await Promise.all([
          api.get("/users/me/profile").catch(() => ({ data: { profile: null } })),
          api.get("/analytics/category-breakdown", { params: q }),
          api.get("/analytics/summary", { params: q }).catch(() => ({ data: null })),
          api.get("/budgets").catch(() => ({ data: { items: [] } })),
        ]);
        if (!mounted) return;
        setProfile(p.data.profile);
        const profileIncome = Number(p?.data?.profile?.monthlyIncome || 0);
        const a = Number(p?.data?.profile?.age || 0);
        const rsk = p?.data?.profile?.riskProfile || "Moderate";
        const items = brkRes?.data?.items || [];
        setBreakdown(items);

        const mCount = Math.max(1, safeNum(sumRes?.data?.monthsInPeriod ?? 1));
        setAnalysisMonths(mCount);
        setPeriodTotals({
          income: safeNum(sumRes?.data?.income),
          expense: safeNum(sumRes?.data?.expense),
          savings: safeNum(sumRes?.data?.savings),
        });
        const currTotals = groupTotals(items);
        const incomeTotal = safeNum(sumRes?.data?.income);
        const avgMonthlyIncome = incomeTotal / mCount;
        const monthlyIncomeForAlloc = Math.max(profileIncome, avgMonthlyIncome);
        const localReco = allocateInvestments({
          monthlyIncome: monthlyIncomeForAlloc,
          age: a,
          riskProfile: rsk,
        });
        const emergencyBufferMonthly =
          Array.isArray(budRes?.data?.items)
            ? (budRes.data.items.find(
                (b) =>
                  (b.category === "Savings" || b.group === "Savings") &&
                  (b.subCategoryName === "Emergency Fund" || b.name === "Emergency Fund"),
              )?.limit || 0)
            : 0;
        const hasIncome = incomeTotal > 0;
        const hasBreakdown =
          safeNum(currTotals.Needs) + safeNum(currTotals.Wants) + safeNum(currTotals.Savings) > 0;

        let baselineTotals = null;
        let baselineIncome = 0;
        if (periodMode === "recent") {
          setHasHistory(false);
          for (let off = 1; off <= 12; off++) {
            try {
              const [prevSum, prevBrk] = await Promise.all([
                api.get("/analytics/summary", { params: { range: "month", offset: off } }).catch(() => ({
                  data: null,
                })),
                api
                  .get("/analytics/category-breakdown", { params: { range: "month", offset: off } })
                  .catch(() => ({ data: { items: [] } })),
              ]);
              const prevItems = prevBrk?.data?.items || [];
              const prevTotals = groupTotals(prevItems);
              const prevIncome = safeNum(prevSum?.data?.income);
              const prevComplete =
                prevIncome > 0 &&
                safeNum(prevTotals.Needs) + safeNum(prevTotals.Wants) + safeNum(prevTotals.Savings) > 0;
              if (prevComplete) {
                setHasHistory(true);
                if (!baselineTotals) {
                  baselineTotals = prevTotals;
                  baselineIncome = prevIncome;
                }
                break;
              }
            } catch {}
          }
        } else {
          setHasHistory(false);
        }

        const incomeUsed = hasIncome ? avgMonthlyIncome : Math.max(profileIncome, avgMonthlyIncome);
        setMissingIncome(!hasIncome && incomeUsed <= 0);

        const needsAvg = safeNum(currTotals.Needs) / mCount;
        const wantsAvg = safeNum(currTotals.Wants) / mCount;
        const savingsAvg = safeNum(currTotals.Savings) / mCount;

        const pa = p?.data?.profile?.allocations;
        const splitFromReco = localReco?.recommendedSplit;
        const needsRate =
          baselineTotals && baselineIncome > 0
            ? safeNum(baselineTotals.Needs) / baselineIncome
            : pa
              ? safeNum(pa.needsPct) / 100
              : safeNum(splitFromReco?.needsPct ?? 0) / 100;
        const wantsRate =
          baselineTotals && baselineIncome > 0
            ? safeNum(baselineTotals.Wants) / baselineIncome
            : pa
              ? safeNum(pa.wantsPct) / 100
              : safeNum(splitFromReco?.wantsPct ?? 0) / 100;
        const savingsRate =
          baselineTotals && baselineIncome > 0
            ? safeNum(baselineTotals.Savings) / baselineIncome
            : pa
              ? safeNum(pa.savingsPct) / 100
              : safeNum(splitFromReco?.savingsPct ?? 0) / 100;

        const needsUsed =
          hasBreakdown && safeNum(currTotals.Needs) > 0 ? needsAvg : incomeUsed * needsRate;
        const wantsUsed =
          hasBreakdown && safeNum(currTotals.Wants) > 0 ? wantsAvg : incomeUsed * wantsRate;
        const savingsUsed =
          hasBreakdown && safeNum(currTotals.Savings) > 0 ? savingsAvg : incomeUsed * savingsRate;

        const plannedSavings = safeNum(incomeUsed) * safeNum(savingsRate);
        const actualSavings = hasBreakdown ? savingsAvg : 0;
        const baseSavings = actualSavings > 0 ? actualSavings : plannedSavings;
        const leftoverFromPlannedExpenses = 0;
        const rawInvestable =
          baseSavings + leftoverFromPlannedExpenses - Number(emergencyBufferMonthly || 0);
        const derivedInvestable = Math.max(
          0,
          Math.min(safeNum(incomeUsed), safeNum(rawInvestable)),
        );

        if (periodMode === "month") {
          setDataLabel(
            `${MONTH_NAMES[periodMonth - 1]} ${periodYear} — full calendar month`,
          );
        } else if (periodMode === "year") {
          setDataLabel(`Calendar year ${periodYear} — averages per month where noted`);
        } else if (periodMode === "all") {
          setDataLabel("All time — averages per month where noted");
        } else if (hasIncome && hasBreakdown) {
          setDataLabel("Actual (based on your transaction history)");
        } else if (hasHistory && incomeUsed > 0) {
          setDataLabel("Estimated (based on profile + past behavior)");
        } else if (incomeUsed > 0) {
          setDataLabel("Initial estimate (no history yet)");
        } else {
          setDataLabel("Initial estimate (no history yet)");
        }

        setDisplayMetrics({
          expenseConsumption: safeNum(needsUsed) + safeNum(wantsUsed),
          savingsContribution: safeNum(savingsUsed),
        });

        const scaledReco =
          localReco &&
          Number(localReco.investableMonthly || 0) > 0 &&
          derivedInvestable > 0
            ? scaleAllocation(localReco, derivedInvestable)
            : localReco;
        const context = {
          profile: p.data.profile || null,
          summary: sumRes?.data || null,
          budgets: budRes?.data?.items || [],
          breakdown: items,
        };
        const finalReco = await applyAdjustmentBias(scaledReco, context);
        setReco(finalReco);
        try {
          const before = Array.isArray(scaledReco?.instruments) ? scaledReco.instruments : [];
          const after = Array.isArray(finalReco?.instruments) ? finalReco.instruments : [];
          const byType = (arr, t) => arr.find((i) => String(i.type) === String(t));
          const types = ["SIP", "PPF", "NPS", "ELSS"];
          let changed = false;
          for (const t of types) {
            const bAmt = Number(byType(before, t)?.monthlyAmount || 0);
            const aAmt = Number(byType(after, t)?.monthlyAmount || 0);
            if (Math.abs(aAmt - bAmt) > 0.01) {
              changed = true;
              break;
            }
          }
          setAiBiasActive(changed);
        } catch {
          setAiBiasActive(false);
        }
      } catch (err) {
        console.error("Failed to load investments:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [analyticsParams]);


  const split = useMemo(() => {
    const s =
      reco?.recommendedSplit ||
      (profile?.allocations
        ? {
            needsPct: profile.allocations.needsPct,
            wantsPct: profile.allocations.wantsPct,
            savingsPct: profile.allocations.savingsPct,
          }
        : null);
    if (!s) return null;
    return {
      needsPct: Number(s.needsPct || 0),
      wantsPct: Number(s.wantsPct || 0),
      savingsPct: Number(s.savingsPct || 0),
    };
  }, [reco, profile]);

  const [horizon, setHorizon] = useState("5Y");
  const [customYears, setCustomYears] = useState("");
  const formatShortINR = (n) => {
    const v = Number(n || 0);
    const abs = Math.abs(v);
    if (abs >= 10000000) {
      const x = (v / 10000000).toFixed(1).replace(/\.0$/, "");
      return `₹${x} CR`;
    }
    if (abs >= 100000) {
      const x = (v / 100000).toFixed(1).replace(/\.0$/, "");
      return `₹${x} L`;
    }
    if (abs >= 1000) {
      const x = (v / 1000).toFixed(1).replace(/\.0$/, "");
      return `₹${x} K`;
    }
    return formatINR(v);
  };

  // Calculate wealth growth projection - ensure all numbers
  const wealthProjection = useMemo(() => {
    if (!reco) return [];
    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };
    const totalMonthlyFromInstruments = Array.isArray(reco.instruments)
      ? reco.instruments.reduce(
          (sum, inst) => sum + safeNum(inst.monthlyAmount),
          0,
        )
      : 0;
    const totalMonthly =
      totalMonthlyFromInstruments > 0
        ? totalMonthlyFromInstruments
        : safeNum(reco?.investableMonthly);
    const avgReturn = 0.1;
    const months = 1200;
    const series = [];
    let cumulative = 0;
    for (let i = 1; i <= months; i++) {
      cumulative = (cumulative + totalMonthly) * (1 + avgReturn / 12);
      series.push({
        month: i,
        value: safeNum(cumulative),
        contribution: safeNum(totalMonthly * i),
      });
    }
    return series;
  }, [reco]);
  const horizonMonths = useMemo(() => {
    const custom = customYears !== "" ? Number(customYears) : null;
    if (custom != null && !Number.isNaN(custom) && custom > 0) {
      return Math.min(Math.max(1, Math.floor(custom)) * 12, 1200);
    }
    switch (horizon) {
      case "1Y":
        return 12;
      case "3Y":
        return 36;
      case "5Y":
        return 60;
      case "10Y":
        return 120;
      default:
        return null;
    }
  }, [horizon, customYears]);
  const wealthProjectionView = useMemo(() => {
    const len = wealthProjection.length;
    const limit = horizonMonths == null ? len : Math.min(horizonMonths, len);
    const slice = wealthProjection.slice(0, limit);
    return slice.map((row, i) => ({
      ...row,
      relMonth: i + 1,
      relYear: Math.ceil((i + 1) / 12),
    }));
  }, [wealthProjection, horizonMonths]);
  const xTickFormatter = useMemo(() => {
    return (v) => {
      if (horizonMonths != null && horizonMonths <= 36) return `M${v}`;
      return `Year ${Math.ceil(Number(v) / 12)}`;
    };
  }, [horizonMonths]);

  const allocationsData = useMemo(() => {
    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };
    const items = Array.isArray(reco?.instruments) ? reco.instruments : [];
    const data = items.map((inst) => ({
      name: inst.type,
      value: safeNum(inst.monthlyAmount),
    }));
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const investable = safeNum(reco?.investableMonthly);
    const remainder = Math.max(0, investable - total);
    if (remainder > 0) data.push({ name: "Unallocated", value: remainder });
    return { data, total, investable, remainder };
  }, [reco]);

  const [showMcAssumptions, setShowMcAssumptions] = useState(false);
  const [showMcExplain, setShowMcExplain] = useState(false);
  const [mcShowP10, setMcShowP10] = useState(true);
  const [mcShowP50, setMcShowP50] = useState(true);
  const [mcShowP90, setMcShowP90] = useState(true);
  const [mcScenario, setMcScenario] = useState("expected"); // conservative | expected | optimistic
  const VOL_MAP = useMemo(() => ({ Low: 0.06, "Low-Medium": 0.08, Medium: 0.12, Moderate: 0.12, High: 0.18 }), []);
  const randn = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  const clampRet = (r) => Math.max(-0.15, Math.min(0.15, r));
  const percentile = (arr, p) => {
    if (!arr || arr.length === 0) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const idx = Math.floor((p / 100) * (s.length - 1));
    return s[idx];
  };

  const mcPortfolio = useMemo(() => {
    if (!reco || !Array.isArray(reco.instruments)) return null;
    const totalMonthly = reco.instruments.reduce((sum, i) => sum + Number(i.monthlyAmount || 0), 0);
    if (totalMonthly <= 0) return null;
    const weights = {};
    for (const i of reco.instruments) weights[i.type] = Number(i.monthlyAmount || 0) / totalMonthly;
    const means = {};
    const stds = {};
    for (const i of reco.instruments) {
      const mu = Number(i.expectedReturn || 0) / 100 / 12;
      const vol = VOL_MAP[String(i.risk)] || 0.12;
      const sigma = vol / Math.sqrt(12);
      means[i.type] = mu;
      stds[i.type] = sigma;
    }
    const runs = 700;
    const months = 1200;
    const finals = [];
    for (let r = 0; r < runs; r++) {
      let value = 0;
      for (let m = 0; m < months; m++) {
        let rp = 0;
        for (const i of reco.instruments) {
          const draw = clampRet(means[i.type] + stds[i.type] * randn());
          rp += (weights[i.type] || 0) * draw;
        }
        value = (value + totalMonthly) * (1 + rp);
      }
      finals.push(value);
    }
    const p10 = percentile(finals, 10);
    const p50 = percentile(finals, 50);
    const p90 = percentile(finals, 90);
    return { p10, p50, p90 };
  }, [reco, VOL_MAP]);

  const mcPortfolioSeries = useMemo(() => {
    if (!reco || !Array.isArray(reco.instruments)) return [];
    const totalMonthly = reco.instruments.reduce((sum, i) => sum + Number(i.monthlyAmount || 0), 0);
    if (totalMonthly <= 0) return [];
    const weights = {};
    for (const i of reco.instruments) weights[i.type] = Number(i.monthlyAmount || 0) / totalMonthly;
    const means = {};
    const stds = {};
    for (const i of reco.instruments) {
      const mu = Number(i.expectedReturn || 0) / 100 / 12;
      const vol = VOL_MAP[String(i.risk)] || 0.12;
      const sigma = vol / Math.sqrt(12);
      means[i.type] = mu;
      stds[i.type] = sigma;
    }
    const runs = 700;
    const months = 1200;
    const mat = new Array(runs);
    for (let r = 0; r < runs; r++) {
      let value = 0;
      const series = new Array(months);
      for (let m = 0; m < months; m++) {
        let rp = 0;
        for (const i of reco.instruments) {
          const draw = clampRet(means[i.type] + stds[i.type] * randn());
          rp += (weights[i.type] || 0) * draw;
        }
        value = (value + totalMonthly) * (1 + rp);
        series[m] = value;
      }
      mat[r] = series;
    }
    const out = [];
    for (let m = 0; m < months; m++) {
      const vals = mat.map((row) => row[m]);
      const p10 = percentile(vals, 10) || 0;
      const p50 = percentile(vals, 50) || 0;
      const p90 = percentile(vals, 90) || 0;
      out.push({ month: m + 1, p10, p50, band: Math.max(0, p90 - p10) });
    }
    return out;
  }, [reco, VOL_MAP]);
  const mcSeriesWithP90 = useMemo(() => {
    return (mcPortfolioSeries || []).map((row) => ({
      ...row,
      p90: Number(row.p10 || 0) + Number(row.band || 0),
    }));
  }, [mcPortfolioSeries]);
  const mcSeriesView = useMemo(() => {
    const len = mcSeriesWithP90.length;
    const limit = horizonMonths == null ? len : Math.min(horizonMonths, len);
    const slice = mcSeriesWithP90.slice(0, limit);
    return slice.map((row, i) => ({
      ...row,
      relMonth: i + 1,
      relYear: Math.ceil((i + 1) / 12),
    }));
  }, [mcSeriesWithP90, horizonMonths]);
  const McBandTooltip = ({ active, label }) => {
    if (!active) return null;
    const row = mcSeriesView.find((r) => String(r.relMonth) === String(label));
    if (!row) return null;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-xs">
        <div className="font-semibold text-gray-900 mb-1">
          Month {row.relMonth} (Year {row.relYear})
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-600">P10</span>
            <span className="font-medium text-gray-900">{formatShortINR(row.p10 || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-600">P50</span>
            <span className="font-medium text-gray-900">{formatShortINR(row.p50 || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">P90</span>
            <span className="font-medium text-gray-900">{formatShortINR(row.p90 || 0)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Calculate tax saved - ensure all numbers
  const taxSaved = useMemo(() => {
    if (!reco || !profile) return 0;

    const safeNum = (val) => {
      const num = typeof val === "number" ? val : Number(val || 0);
      return isNaN(num) ? 0 : num;
    };

    const annualIncome = safeNum(profile.monthlyIncome) * 12;
    const invested80C = (reco.instruments || [])
      .filter((inst) => ["PPF", "ELSS"].includes(inst.type))
      .reduce((sum, inst) => sum + safeNum(inst.monthlyAmount) * 12, 0);

    const invested80D = (reco.instruments || [])
      .filter((inst) => inst.type === "NPS")
      .reduce((sum, inst) => sum + safeNum(inst.monthlyAmount) * 12, 0);

    const cap80C = 150000;
    const cap80D = safeNum(profile.age) >= 60 ? 50000 : 25000;
    const eligible80C = Math.min(invested80C, cap80C);
    const eligible80D = Math.min(invested80D, cap80D);

    // Tax slab calculation
    let slab = 0.05;
    if (annualIncome > 1000000) slab = 0.3;
    else if (annualIncome > 500000) slab = 0.2;

    return safeNum((eligible80C + eligible80D) * slab);
  }, [reco, profile]);

  // Goal linked investments
  const [goals, setGoals] = useState([]);
  const [goalTargetOverrides, setGoalTargetOverrides] = useState({});
  const [goalSipDeltaOverrides, setGoalSipDeltaOverrides] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/goals");
        setGoals(data.items || []);
      } catch {}
    })();
  }, []);

  const goalLinkedInvestments = useMemo(() => {
    if (goals.length === 0) return [];
    return goals.map((g) => {
      const instrument =
        (reco?.instruments || []).find(
          (inst) => inst.type === g.investmentType,
        ) || (reco?.instruments || [])[0];
      const projectedMonthly = Number(instrument?.monthlyAmount || 0);
      const progress = Number(g.progress || 0);
      const target = Number(g.targetAmount || 0);
      const remaining = Math.max(0, target - progress);
      const monthsToGoal =
        projectedMonthly > 0 ? Math.ceil(remaining / projectedMonthly) : null;
      const estDate =
        monthsToGoal != null
          ? new Date(new Date().setMonth(new Date().getMonth() + monthsToGoal))
          : null;
      const overrideDateStr = goalTargetOverrides[String(g._id)] || g.targetDate;
      const overrideDate = overrideDateStr ? new Date(overrideDateStr) : null;
      const now = new Date();
      let remainingMonths = null;
      if (overrideDate && !isNaN(overrideDate.getTime())) {
        const base =
          (overrideDate.getFullYear() - now.getFullYear()) * 12 +
          (overrideDate.getMonth() - now.getMonth());
        remainingMonths = base + (overrideDate.getDate() > now.getDate() ? 1 : 0);
      }
      const requiredMonthlySIP =
        remainingMonths != null && remainingMonths > 0
          ? Math.ceil(remaining / remainingMonths)
          : null;
      const delta =
        requiredMonthlySIP != null && projectedMonthly > 0
          ? requiredMonthlySIP - projectedMonthly
          : null;
      const expectedReturn = Number(instrument?.expectedReturn || 0);
      const fBase = 1 + expectedReturn / 1200;
      const fConservative = 1 + (expectedReturn - 2) / 1200;
      const fOptimistic = 1 + (expectedReturn + 2) / 1200;
      const scenarioBaseReturnMonths =
        projectedMonthly > 0 ? Math.ceil(remaining / (projectedMonthly * fBase)) : null;
      const scenarioConservativeMonths =
        projectedMonthly > 0 ? Math.ceil(remaining / (projectedMonthly * fConservative)) : null;
      const scenarioOptimisticMonths =
        projectedMonthly > 0 ? Math.ceil(remaining / (projectedMonthly * fOptimistic)) : null;
      const sipDelta = Number(goalSipDeltaOverrides[String(g._id)] || 0);
      const scenarioSipMonths =
        projectedMonthly + sipDelta > 0
          ? Math.ceil(remaining / (projectedMonthly + sipDelta))
          : null;
      return {
        goal: g,
        instrument,
        suggestedVehicle: g.investmentType || instrument?.type,
        projectedMonthly,
        monthsToGoal,
        estimatedCompletionDate: estDate,
        requiredMonthlySIP,
        remainingMonths,
        delta,
        selectedTargetDate: overrideDateStr || null,
        remaining,
        scenarioBaseReturnMonths,
        scenarioConservativeMonths,
        scenarioOptimisticMonths,
        scenarioSipMonths,
        sipDelta,
      };
    });
  }, [goals, reco, goalTargetOverrides, goalSipDeltaOverrides]);

  const mcGoalMap = useMemo(() => {
    const out = {};
    if (!Array.isArray(goals) || !reco) return out;
    for (const item of goalLinkedInvestments) {
      const g = item.goal;
      const remaining = Number(item.remaining || 0);
      const pm = Number(item.projectedMonthly || 0);
      if (remaining <= 0 || pm <= 0) continue;
      const inst = item.instrument || {};
      const mu = Number(inst.expectedReturn || 0) / 100 / 12;
      const vol = VOL_MAP[String(inst.risk)] || 0.12;
      const sigma = vol / Math.sqrt(12);
      const runs = 700;
      const horizon = Number(item.remainingMonths || 0) > 0 ? Number(item.remainingMonths || 0) : 120;
      const maxMonths = Math.min(360, Math.max(horizon, 120));
      const completedMonths = [];
      let hitByTarget = 0;
      for (let r = 0; r < runs; r++) {
        let val = Number(g.progress || 0);
        let hit = null;
        for (let m = 1; m <= maxMonths; m++) {
          const ret = clampRet(mu + sigma * randn());
          val = (val + pm) * (1 + ret);
          if (val >= Number(g.targetAmount || 0)) {
            hit = m;
            break;
          }
        }
        if (hit != null) {
          completedMonths.push(hit);
          if (horizon > 0 && hit <= horizon) hitByTarget += 1;
        }
      }
      const p10 = percentile(completedMonths, 10);
      const p50 = percentile(completedMonths, 50);
      const p90 = percentile(completedMonths, 90);
      const prob = runs > 0 ? hitByTarget / runs : 0;
      out[String(g._id)] = { p10, p50, p90, prob };
    }
    return out;
  }, [goalLinkedInvestments, goals, VOL_MAP, reco]);

  const handleInstrumentClick = (instrument) => {
    setSelectedInstrument(instrument);
    // Generate projection for this specific instrument
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">Month {label} (Year {Math.ceil(Number(label) / 12)})</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatShortINR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Page title="Investments" subtitle="Wealth dashboard">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="pw-card p-4 h-44 pw-skeleton" />
            ))}
          </div>
          <div className="pw-card p-4 h-80 pw-skeleton" />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Investments" subtitle="Wealth dashboard">
      <div className="mb-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Portfolio & Wealth Investments
          </h2>
          <p className="text-sm text-muted mt-1">
            Your long-term wealth and tax planning strategy
          </p>
        </div>

        <Card hover={false} className="overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-primary/[0.06] to-transparent px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="pw-label">Analysis period</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {periodMode === "recent" && "This month (MTD)"}
                    {periodMode === "month" &&
                      `${MONTH_NAMES[periodMonth - 1]} ${periodYear}`}
                    {periodMode === "year" && `Calendar year ${periodYear}`}
                    {periodMode === "all" && "All time"}
                  </p>
                  <p className="mt-1 text-xs text-muted leading-relaxed max-w-xl">
                    {periodMode === "recent" && "Same as dashboard — month to date."}
                    {periodMode === "month" &&
                      "Complete calendar month — closed-period review."}
                    {periodMode === "year" && `Jan–Dec ${periodYear} · totals and per-month averages.`}
                    {periodMode === "all" &&
                      "From your first transaction onward · long-run averages for investable amounts."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPeriodControlsOpen((v) => !v)}
                className="pw-btn pw-btn-ghost self-start sm:self-center shrink-0 gap-2 text-sm"
                aria-expanded={periodControlsOpen}
              >
                {periodControlsOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide calendar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Custom range
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap rounded-xl border border-slate-200/80 bg-slate-50/90 p-1 shadow-inner gap-0.5">
                {([
                  ["recent", "This month"],
                  ["year", "Full year"],
                  ["all", "All time"],
                ]).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (mode === "year") setPeriodYear(new Date().getFullYear());
                      setPeriodMode(mode);
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      periodMode === mode
                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/80"
                        : "text-slate-600 hover:text-ink hover:bg-white/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 1);
                  setPeriodYear(d.getFullYear());
                  setPeriodMonth(d.getMonth() + 1);
                  setPeriodMode("month");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous month
              </button>
            </div>

            <div
              className={`overflow-hidden transition-all duration-200 ease-out ${
                periodControlsOpen
                  ? "max-h-[420px] opacity-100"
                  : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <div className="pb-1 pt-4 sm:pt-5">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-xs font-medium text-slate-500 mb-3">Pick a month or year</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs text-muted uppercase tracking-wide">
                          Month & year
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={periodMonth}
                            onChange={(e) => {
                              setPeriodMonth(Number(e.target.value));
                              setPeriodMode("month");
                            }}
                            className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {MONTH_NAMES.map((name, i) => (
                              <option key={name} value={i + 1}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={periodYear}
                            onChange={(e) => {
                              setPeriodYear(Number(e.target.value));
                              setPeriodMode("month");
                            }}
                            className="min-w-[100px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map(
                              (y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <p className="text-[11px] text-muted">Full calendar month view.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted uppercase tracking-wide">
                          Calendar year
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            value={periodYear}
                            onChange={(e) => {
                              setPeriodYear(Number(e.target.value));
                              setPeriodMode("year");
                            }}
                            className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map(
                              (y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => setPeriodMode("year")}
                            className={`pw-btn text-sm ${
                              periodMode === "year" ? "pw-btn-primary" : "pw-btn-ghost"
                            }`}
                          >
                            View year
                          </button>
                        </div>
                        <p className="text-[11px] text-muted">January–December totals.</p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {periodTotals && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-4 sm:px-5">
              <div className="rounded-lg bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-100/80">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Income
                </p>
                <p className="pw-number mt-1 text-sm font-semibold text-ink">
                  {formatINR(periodTotals.income)}
                </p>
              </div>
              <div className="rounded-lg bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-100/80">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Expense
                </p>
                <p className="pw-number mt-1 text-sm font-semibold text-ink">
                  {formatINR(periodTotals.expense)}
                </p>
              </div>
              <div className="rounded-lg bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-100/80">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Net savings
                </p>
                <p className="pw-number mt-1 text-sm font-semibold text-emerald-700">
                  {formatINR(periodTotals.savings)}
                </p>
              </div>
              <div className="col-span-2 rounded-lg bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-100/80 sm:col-span-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Span
                </p>
                <p className="pw-number mt-1 text-sm font-semibold text-ink">
                  {analysisMonths === 1
                    ? "1 month"
                    : `${analysisMonths} months`}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {/* LEFT: Recommended Portfolio */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-900">
              Recommended Portfolio
            </h2>
            <div className="text-right">
              <div className="text-xs text-gray-500">Monthly Investable</div>
              <div className="text-sm font-semibold text-gray-900">
                {formatINR(reco?.investableMonthly || 0)}
              </div>
              <div className={`mt-1 text-[11px] ${missingIncome ? "text-red-600" : "text-gray-500"}`}>
                {dataLabel}
              </div>
              {split && (
                <div className="mt-1 flex items-center gap-2 justify-end">
                  <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                    Savings {split.savingsPct}%
                  </span>
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                    Needs {split.needsPct}%
                  </span>
                  <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                    Wants {split.wantsPct}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="text-xs text-gray-500">
                {analysisMonths > 1 || periodMode === "year" || periodMode === "all"
                  ? "Avg. monthly savings (this period)"
                  : "Monthly Savings Contribution"}
              </div>
              <div className="text-lg font-bold text-emerald-700">
                {formatINR(displayMetrics.savingsContribution)}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">
                {analysisMonths > 1 || periodMode === "year" || periodMode === "all"
                  ? "Avg. monthly spending (needs + wants)"
                  : "Monthly Consumption Expense"}
              </div>
              <div className="text-lg font-bold text-red-700">
                {formatINR(displayMetrics.expenseConsumption)}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Portfolio Allocation</h3>
                <p className="text-xs text-muted mt-0.5">
                  How your investable amount maps to each instrument
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted">Allocated</p>
                <p className="pw-number text-sm font-semibold text-ink">
                  {formatINR(allocationsData.total)}
                  <span className="font-normal text-muted"> / </span>
                  {formatINR(allocationsData.investable)}
                </p>
              </div>
            </div>
            {(() => {
              const allocationPct =
                allocationsData.investable > 0
                  ? Math.min(
                      100,
                      Math.round((allocationsData.total / allocationsData.investable) * 100),
                    )
                  : 100;
              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
                    <span>Allocation progress</span>
                    <span className="pw-number font-medium text-ink">{allocationPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        allocationPct >= 100 ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${allocationPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-52 min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationsData.data}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {allocationsData.data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            [
                              "#2563eb",
                              "#22c55e",
                              "#f59e0b",
                              "#8b5cf6",
                              "#ef4444",
                              "#10b981",
                              "#6366f1",
                              "#14b8a6",
                            ][index % 8]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatINR(v)} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div
                className={`flex flex-col justify-center rounded-xl border p-4 transition-colors ${
                  allocationsData.remainder > 0
                    ? "border-amber-200/80 bg-amber-50/50"
                    : "border-emerald-200/70 bg-emerald-50/40"
                }`}
              >
                {allocationsData.remainder > 0 ? (
                  <>
                    <div className="text-xs font-medium text-amber-800/90 mb-1">
                      Unallocated
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-amber-700">
                      {formatINR(allocationsData.remainder)}
                    </div>
                    <p className="text-xs text-amber-800/80 mt-2 leading-snug">
                      Allocate the remainder across instruments to match your plan.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-800/90 mb-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      Fully allocated
                    </div>
                    <p className="text-sm font-semibold text-emerald-900">
                      100% of your investable amount is assigned
                    </p>
                    <p className="text-xs text-emerald-800/75 mt-2 leading-snug">
                      No idle balance — your split matches the recommended portfolio for this
                      period.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setShowAllocationWhy((v) => !v)}
              >
                {showAllocationWhy ? "Hide explanation" : "Why this?"}
              </button>
              {showAllocationWhy && (
                <div className="mt-2 text-xs text-gray-700 space-y-1">
                  <div>
                    {profile?.monthlyIncome
                      ? `Your monthly income of ${formatINR(profile.monthlyIncome)} maps to Needs ${split?.needsPct ?? 0}% • Wants ${split?.wantsPct ?? 0}% • Savings ${split?.savingsPct ?? 0}% per our income-based rules.`
                      : "Split follows income-based rules for Needs, Wants, and Savings."}
                  </div>
                  <div>
                    {profile?.age != null
                      ? `Age ${profile.age} adjusts equity tilt via simple heuristics (more growth when younger, more stability after mid‑career).`
                      : "Age-based heuristics adjust growth vs stability."}
                  </div>
                  <div>
                    {profile?.riskProfile
                      ? `Risk profile "${profile.riskProfile}" sets the base mix across SIP, PPF, NPS, and ELSS.`
                      : "Risk profile sets the base mix across instruments."}
                  </div>
                  <div>
                    {(() => {
                      const CAP_80C = 150000 / 12.0;
                      const CAP_80CCD1B = 50000 / 12.0;
                      const ppfAmt = Number((reco?.instruments || []).find((i) => i.type === "PPF")?.monthlyAmount || 0);
                      const elssAmt = Number((reco?.instruments || []).find((i) => i.type === "ELSS")?.monthlyAmount || 0);
                      const npsAmt = Number((reco?.instruments || []).find((i) => i.type === "NPS")?.monthlyAmount || 0);
                      const cap80cReached = Math.abs(ppfAmt + elssAmt - CAP_80C) < 0.01;
                      const npsCapped = npsAmt >= CAP_80CCD1B - 0.01;
                      const parts = [];
                      parts.push("Tax‑saving instruments honor statutory caps (80C for PPF+ELSS, NPS 80CCD(1B)).");
                      if (cap80cReached) parts.push("PPF+ELSS meets the 80C monthly cap.");
                      if (npsCapped) parts.push("NPS meets the 80CCD(1B) monthly cap.");
                      return parts.join(" ");
                    })()}
                  </div>
                  <div>
                    {aiBiasActive
                      ? "AI personalization is active with bounded adjustments; rules and caps remain primary."
                      : "AI personalization is inactive or neutral; allocations follow rules and caps."}
                  </div>
                </div>
              )}
            </div>
          </Card>

          
        </div>

        {/* RIGHT: Wealth Growth Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">
                Wealth Growth Projection
              </h2>
            <div className="flex items-center gap-1">
              {["1Y", "3Y", "5Y", "10Y"].map((opt) => (
                <button
                  key={opt}
                  aria-label={`Show ${opt} horizon`}
                  className={`px-2 py-1 text-xs rounded ${horizon === opt ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
                  onClick={() => setHorizon(opt)}
                >
                  {opt}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={100}
                value={customYears}
                inputMode="numeric"
                step={1}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setCustomYears("");
                    return;
                  }
                  const n = Math.floor(Number(v));
                  if (Number.isNaN(n)) return;
                  const clamped = Math.max(1, Math.min(100, n));
                  setCustomYears(String(clamped));
                }}
                placeholder="Years (1–100)"
                className="ml-2 px-2 py-1 text-xs border border-gray-300 rounded w-24"
                aria-label="Custom years"
              />
              <button
                className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                onClick={() => setCustomYears("")}
                aria-label="Clear custom years"
              >
                Clear
              </button>
            </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={wealthProjectionView}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gWealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient
                      id="gContribution"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#22c55e"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="relMonth"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{
                      value: horizonMonths != null && horizonMonths <= 36 ? "Months" : "Years",
                      position: "insideBottom",
                      offset: -5,
                    }}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    tickFormatter={(v) => formatShortINR(v)}
                    width={90}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    domain={[
                      (dataMin) => Math.max(0, Number(dataMin || 0) * 0.95),
                      (dataMax) => Number(dataMax || 0) * 1.05,
                    ]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="contribution"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gContribution)"
                    name="Total Contribution"
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gWealth)"
                    name="Projected Value"
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-600 mb-1">
                    Projected Value ({horizonMonths ? Math.round(horizonMonths / 12) : Math.round(wealthProjectionView.length / 12)} years)
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatShortINR(wealthProjectionView[wealthProjectionView.length - 1]?.value || 0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600 mb-1">
                    Total Contribution
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatShortINR(wealthProjectionView[wealthProjectionView.length - 1]?.contribution || 0)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          

          {/* Goal cards moved to Section 2 below */}
        </motion.div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900">Goals Coverage</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Investable</div>
              <div className="text-lg font-bold text-gray-900">
                {formatINR(reco?.investableMonthly || 0)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Goals Monthly Plan</div>
              <div className="text-lg font-bold text-gray-900">
                {formatINR(
                  (goals || []).reduce(
                    (sum, g) => sum + Number(g.monthlyContribution || 0),
                    0,
                  ),
                )}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Tax Saved This Year</h3>
              <p className="text-sm text-gray-500">Estimated savings from 80C & 80D</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-4xl font-bold text-green-600 mb-2">
              <AnimatedNumber value={taxSaved} />
            </div>
            <div className="text-sm text-gray-600">Based on your recommended investments</div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500 mb-1">Section 80C</div>
                <div className="font-semibold text-gray-900">₹1,50,000</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Section 80D</div>
                <div className="font-semibold text-gray-900">
                  ₹{profile?.age >= 60 ? "50,000" : "25,000"}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {reco?.instruments && reco.instruments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {reco.instruments.map((instrument, idx) => (
            <motion.div
              key={instrument.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <InvestmentCard
                instrument={instrument}
                onClick={() => handleInstrumentClick(instrument)}
                showWhy={Boolean(showInstrumentWhys[String(instrument.type)])}
                onToggleWhy={() =>
                  setShowInstrumentWhys((prev) => ({
                    ...prev,
                    [String(instrument.type)]: !prev[String(instrument.type)],
                  }))
                }
                whyContent={
                  <>
                    <div>
                      {(() => {
                        const t = String(instrument.type);
                        const role =
                          t === "SIP"
                            ? "growth"
                            : t === "ELSS"
                              ? "growth and tax‑saving (80C)"
                              : t === "PPF"
                                ? "stability and tax‑saving (80C)"
                                : t === "NPS"
                                  ? "stability and tax‑saving (80CCD(1B))"
                                  : "portfolio balance";
                        return `Role: ${role}. Expected return ~${instrument.expectedReturn}% • Risk: ${instrument.risk}.`;
                      })()}
                    </div>
                    <div>
                      Allocation reflects your risk profile and age heuristics. Tax caps may reduce PPF+ELSS or NPS when thresholds are met.
                    </div>
                  </>
                }
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-center text-gray-500 mb-8">
          Complete your profile to get personalized recommendations
        </Card>
      )
      }
      <Card className="p-4 hover:shadow-xl transition-shadow duration-300 mb-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Risk & Uncertainty (Monte Carlo)</h3>
          <div className="text-xs text-gray-500">
            Probabilistic estimates{" "}
            <button
              className="ml-2 text-blue-600 hover:underline"
              onClick={() => setShowMcAssumptions((v) => !v)}
            >
              {showMcAssumptions ? "Hide assumptions" : "Assumptions"}
            </button>
            <button
              className="ml-2 text-blue-600 hover:underline"
              onClick={() => setShowMcExplain((v) => !v)}
            >
              {showMcExplain ? "Hide explanation" : "How should I read this?"}
            </button>
          </div>
        </div>
        {showMcAssumptions && (
          <div className="mb-3 text-xs text-gray-700 space-y-1">
            <div>Monthly returns simulated per instrument using a normal distribution.</div>
            <div>Mean equals expectedReturn ÷ 12; volatility is fixed by risk level.</div>
            <div>Returns are clamped between −15% and +15% monthly; 700 runs.</div>
            <div>Outputs are probabilistic and do not affect your allocations or plans.</div>
          </div>
        )}
        {showMcExplain && (
          <div className="mb-3 text-xs text-gray-700 space-y-1">
            <div>Monte Carlo simulates many possible market paths to estimate ranges of outcomes.</div>
            <div>Results are ranges, not guarantees. They show plausible variability over time.</div>
            <div>P10 is downside (red), P50 is median (blue), P90 is upside (green).</div>
            <div>These visuals do not change your plan; they are for awareness only.</div>
            <div>Monte Carlo simulation is run once; you are exploring simulated outcomes.</div>
            <div>Changing views does not change predictions; UI slices visible months only.</div>
          </div>
        )}
        <div className="p-3 bg-gray-50 rounded mb-2">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <input
                id="toggle-p10"
                type="checkbox"
                checked={mcShowP10}
                onChange={(e) => setMcShowP10(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="toggle-p10" className="cursor-pointer flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                Show P10
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="toggle-p50"
                type="checkbox"
                checked={mcShowP50}
                onChange={(e) => setMcShowP50(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="toggle-p50" className="cursor-pointer flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                Show P50
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="toggle-p90"
                type="checkbox"
                checked={mcShowP90}
                onChange={(e) => setMcShowP90(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="toggle-p90" className="cursor-pointer flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                Show P90
              </label>
            </div>
            <div className="flex items-center gap-1">
              {["1Y", "3Y", "5Y", "10Y"].map((opt) => (
                <button
                  key={opt}
                  aria-label={`Show ${opt} horizon`}
                  className={`px-2 py-1 rounded ${horizon === opt ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
                  onClick={() => setHorizon(opt)}
                >
                  <span className="text-xs">{opt}</span>
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={100}
                value={customYears}
                inputMode="numeric"
                step={1}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setCustomYears("");
                    return;
                  }
                  const n = Math.floor(Number(v));
                  if (Number.isNaN(n)) return;
                  const clamped = Math.max(1, Math.min(100, n));
                  setCustomYears(String(clamped));
                }}
                placeholder="Years (1–100)"
                className="ml-2 px-2 py-1 text-xs border border-gray-300 rounded w-24"
                aria-label="Custom years"
              />
              <button
                className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                onClick={() => setCustomYears("")}
                aria-label="Clear custom years"
              >
                Clear
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-600">Market Conditions</span>
              <input
                aria-label="Market Conditions"
                type="range"
                min={0}
                max={2}
                step={1}
                value={mcScenario === "conservative" ? 0 : mcScenario === "expected" ? 1 : 2}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMcScenario(v === 0 ? "conservative" : v === 1 ? "expected" : "optimistic");
                }}
              />
              <div className="flex items-center gap-2 text-gray-500">
                <span className={mcScenario === "conservative" ? "font-semibold text-red-600" : ""}>Conservative</span>
                <span>|</span>
                <span className={mcScenario === "expected" ? "font-semibold text-blue-600" : ""}>Expected</span>
                <span>|</span>
                <span className={mcScenario === "optimistic" ? "font-semibold text-green-600" : ""}>Optimistic</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={mcSeriesView} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="relMonth" tick={{ fontSize: 12 }} tickLine={false} tickFormatter={xTickFormatter} />
              <YAxis
                tickFormatter={(v) => formatShortINR(v)}
                width={80}
                tick={{ fontSize: 12 }}
                domain={[
                  (dataMin) => Math.max(0, Number(dataMin || 0) * 0.95),
                  (dataMax) => Number(dataMax || 0) * 1.05,
                ]}
              />
              <Tooltip content={<McBandTooltip />} />
              <Tooltip content={<McBandTooltip />} />
              {mcShowP10 && (
                <Line
                  type="monotone"
                  dataKey="p10"
                  stroke="#ef4444"
                  strokeWidth={mcScenario === "conservative" ? 4 : 3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  z={900}
                />
              )}
              {mcShowP90 && (
                <Line
                  type="monotone"
                  dataKey="p90"
                  stroke="#22c55e"
                  strokeWidth={mcScenario === "optimistic" ? 3 : 1.5}
                  dot={false}
                  connectNulls
                  z={900}
                />
              )}
              {mcShowP50 && (
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#1d4ed8"
                  strokeWidth={3}
                  strokeOpacity={1}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  strokeDasharray="0"
                  z={1000}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4">
          <div className="font-medium text-gray-800 mb-2">Goal Probabilities</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {goalLinkedInvestments.map((item) => {
              const id = String(item.goal._id);
              const sim = mcGoalMap[id];
              const unavailable = item.remaining <= 0 || item.projectedMonthly <= 0 || !sim || sim.prob == null;
              const pct = Math.round((sim?.prob || 0) * 100);
              const color =
                pct > 70 ? "#16a34a" : pct >= 40 ? "#f59e0b" : "#ef4444";
              return (
                <div
                  key={id}
                  className="p-3 bg-white rounded border border-gray-200 group"
                  title="Based on 1,000 simulated market paths"
                >
                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    {item.goal.name}
                  </div>
                  {unavailable ? (
                    <div className="text-xs text-gray-500">Simulation unavailable</div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="relative w-20 h-20">
                        <PieChart width={80} height={80}>
                          <Pie
                            data={[
                              { name: "prob", value: pct, color },
                              { name: "rest", value: Math.max(0, 100 - pct), color: "#e5e7eb" },
                            ]}
                            dataKey="value"
                            cx={40}
                            cy={40}
                            innerRadius={28}
                            outerRadius={38}
                            startAngle={90}
                            endAngle={450}
                            isAnimationActive={true}
                          >
                            <Cell fill={color} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                        </PieChart>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                          {pct}%
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-600">Chance of reaching goal by target date</div>
                        <div
                          className={`text-sm font-semibold ${
                            pct > 70 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-600"
                          }`}
                        >
                          {pct}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mt-10 mb-4 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-2xl font-bold text-gray-900">
          Goal-Driven Investments
        </h2>
        <p className="text-sm text-gray-500">
          Investments aligned to your life goals
        </p>
      </div>
      <Card className="mt-1 p-4 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Target className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Goal Linked Investments
            </h3>
            <p className="text-sm text-gray-500">
              Investments aligned to your goals
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {goalLinkedInvestments.length > 0 ? (
            goalLinkedInvestments.map((item, idx) => {
              const goal = item.goal;
              const targetDate = new Date(goal.targetDate);
              const daysUntil = Math.ceil(
                (targetDate - new Date()) / (1000 * 60 * 60 * 24),
              );
              const progress = goal.progress || 0;
              const progressPct =
                goal.targetAmount > 0
                  ? (progress / goal.targetAmount) * 100
                  : 0;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                >
                  <Card className="p-4 hover:shadow-xl transition-shadow duration-300">
                    <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {goal.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Target: {formatINR(goal.targetAmount)}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      {item.suggestedVehicle}
                    </span>
                    </div>
                    <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{progressPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-2 bg-purple-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, progressPct)}%`,
                        }}
                        transition={{
                          duration: 0.8,
                          delay: 0.1 + idx * 0.05,
                        }}
                      />
                    </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {daysUntil > 0 ? `${daysUntil} days left` : "Overdue"}
                    </span>
                    <span>
                      Plan: {formatINR(item.goal.monthlyContribution || 0)}
                    </span>
                    <span
                      className={`${(item.goal.monthlyActual || 0) >= (item.goal.monthlyContribution || 0) ? "text-green-600" : ""}`}
                    >
                      Actual: {formatINR(item.goal.monthlyActual || 0)}
                    </span>
                    <span>
                      Projected: {formatINR(item.projectedMonthly || 0)}
                    </span>
                    <span>
                      {item.monthsToGoal == null
                        ? "Projection unavailable"
                        : item.monthsToGoal === 0
                          ? "Completed"
                          : `Est. ${item.monthsToGoal} months`}
                    </span>
                    {item.estimatedCompletionDate && item.monthsToGoal > 0 && (
                      <span>
                        Est. Completion:{" "}
                        {new Date(item.estimatedCompletionDate).toLocaleDateString()}
                      </span>
                    )}
                    <span>
                      Target By:
                      <input
                        type="date"
                        className="ml-1 px-2 py-1 border border-gray-300 rounded"
                        value={
                          item.selectedTargetDate
                            ? String(item.selectedTargetDate).slice(0, 10)
                            : (item.goal.targetDate || "").slice(0, 10)
                        }
                        onChange={(e) =>
                          setGoalTargetOverrides((prev) => ({
                            ...prev,
                            [String(item.goal._id)]: e.target.value,
                          }))
                        }
                      />
                    </span>
                    {item.remainingMonths != null && item.remainingMonths <= 0 ? (
                      <span className="text-red-600">Target date invalid</span>
                    ) : item.remaining > 0 && item.requiredMonthlySIP == null ? (
                      <span className="text-gray-600">SIP unavailable</span>
                    ) : item.remaining <= 0 ? (
                      <span className="text-green-600">Completed</span>
                    ) : (
                      <>
                        <span>
                          Required SIP: {formatINR(item.requiredMonthlySIP || 0)}
                        </span>
                        <span>Delta: {formatINR(item.delta || 0)}</span>
                        {profile &&
                          reco &&
                          item.requiredMonthlySIP != null &&
                          (item.requiredMonthlySIP > (reco?.investableMonthly || 0) ||
                            item.requiredMonthlySIP >
                              Number(profile?.monthlyIncome || 0) * 0.5) && (
                            <span className="text-yellow-600">Warning: High required SIP</span>
                          )}
                        <button
                          className="ml-2 text-xs text-blue-600 hover:underline"
                          onClick={() =>
                            setShowSipWhy((prev) => ({
                              ...prev,
                              [String(item.goal._id)]: !prev[String(item.goal._id)],
                            }))
                          }
                        >
                          {showSipWhy[String(item.goal._id)] ? "Hide explanation" : "Why this?"}
                        </button>
                      </>
                    )}
                    </div>
                    {showSipWhy[String(item.goal._id)] && (
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-700 space-y-1">
                      <div>Remaining amount: {formatINR(item.remaining || 0)} = Target − Progress.</div>
                      <div>
                        Remaining months:{" "}
                        {item.remainingMonths != null && item.remainingMonths > 0
                          ? `${item.remainingMonths}`
                          : "Unavailable"}
                        .
                      </div>
                      <div>Formula: requiredMonthlySIP = ceil(remainingAmount ÷ remainingMonths).</div>
                      <div>
                        Warnings appear when required SIP exceeds your investable or is a large share of income. Advisory only.
                      </div>
                    </div>
                  )}
                    <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-700">Scenarios (Hypothetical)</div>
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() =>
                            setShowScenarios((prev) => ({
                              ...prev,
                              [String(item.goal._id)]: !prev[String(item.goal._id)],
                            }))
                          }
                        >
                          {showScenarios[String(item.goal._id)] ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showScenarios[String(item.goal._id)] && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-800">Conservative −2%</div>
                        <div className="mt-1">
                          {item.remaining <= 0
                            ? "Completed"
                            : item.projectedMonthly <= 0 || item.scenarioConservativeMonths == null
                              ? "Unavailable"
                              : `Est. ${item.scenarioConservativeMonths} months`}
                        </div>
                        {item.monthsToGoal != null &&
                          item.monthsToGoal > 0 &&
                          item.scenarioConservativeMonths != null && (
                            <div
                              className={`mt-1 font-medium ${
                                item.scenarioConservativeMonths > item.monthsToGoal
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {item.scenarioConservativeMonths > item.monthsToGoal
                                ? `+${item.scenarioConservativeMonths - item.monthsToGoal} months`
                                : `-${item.monthsToGoal - item.scenarioConservativeMonths} months`}
                            </div>
                          )}
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-800">Base (Expected)</div>
                        <div className="mt-1">
                          {item.remaining <= 0
                            ? "Completed"
                            : item.projectedMonthly <= 0 || item.scenarioBaseReturnMonths == null
                              ? "Unavailable"
                              : `Est. ${item.scenarioBaseReturnMonths} months`}
                        </div>
                        {item.monthsToGoal != null &&
                          item.monthsToGoal > 0 &&
                          item.scenarioBaseReturnMonths != null && (
                            <div
                              className={`mt-1 font-medium ${
                                item.scenarioBaseReturnMonths > item.monthsToGoal
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {item.scenarioBaseReturnMonths > item.monthsToGoal
                                ? `+${item.scenarioBaseReturnMonths - item.monthsToGoal} months`
                                : `-${item.monthsToGoal - item.scenarioBaseReturnMonths} months`}
                            </div>
                          )}
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-800">Optimistic +2%</div>
                        <div className="mt-1">
                          {item.remaining <= 0
                            ? "Completed"
                            : item.projectedMonthly <= 0 || item.scenarioOptimisticMonths == null
                              ? "Unavailable"
                              : `Est. ${item.scenarioOptimisticMonths} months`}
                        </div>
                        {item.monthsToGoal != null &&
                          item.monthsToGoal > 0 &&
                          item.scenarioOptimisticMonths != null && (
                            <div
                              className={`mt-1 font-medium ${
                                item.scenarioOptimisticMonths > item.monthsToGoal
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {item.scenarioOptimisticMonths > item.monthsToGoal
                                ? `+${item.scenarioOptimisticMonths - item.monthsToGoal} months`
                                : `-${item.monthsToGoal - item.scenarioOptimisticMonths} months`}
                            </div>
                          )}
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-800">What‑If SIP Δ</div>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            className="px-2 py-1 border border-gray-300 rounded w-28"
                            step="100"
                            value={Number(
                              (goalSipDeltaPending[String(item.goal._id)] ??
                                goalSipDeltaOverrides[String(item.goal._id)] ??
                                0),
                            )}
                            onChange={(e) =>
                              setGoalSipDeltaPending((prev) => ({
                                ...prev,
                                [String(item.goal._id)]: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="text-gray-600">INR/month</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700"
                            onClick={() =>
                              setGoalSipDeltaOverrides((prev) => ({
                                ...prev,
                                [String(item.goal._id)]: Number(
                                  goalSipDeltaPending[String(item.goal._id)] || 0,
                                ),
                              }))
                            }
                            disabled={
                              Number(goalSipDeltaPending[String(item.goal._id)] ?? 0) ===
                              Number(goalSipDeltaOverrides[String(item.goal._id)] ?? 0)
                            }
                          >
                            Simulate
                          </button>
                          <button
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700"
                            onClick={() => {
                              setGoalSipDeltaOverrides((prev) => ({
                                ...prev,
                                [String(item.goal._id)]: 0,
                              }));
                              setGoalSipDeltaPending((prev) => ({
                                ...prev,
                                [String(item.goal._id)]: 0,
                              }));
                            }}
                          >
                            Reset
                          </button>
                        </div>
                        <div className="mt-3">
                          {item.remaining <= 0
                            ? "Completed"
                            : item.scenarioSipMonths == null
                              ? "Unavailable"
                              : `Est. ${item.scenarioSipMonths} months`}
                        </div>
                          <div className="mt-1 text-xs text-gray-700">
                            Simulated monthly: {formatINR(item.projectedMonthly + (item.sipDelta || 0))}
                          </div>
                        {item.monthsToGoal != null &&
                          item.monthsToGoal > 0 &&
                          item.scenarioSipMonths != null && (
                            <div
                              className={`mt-1 font-medium ${
                                item.scenarioSipMonths > item.monthsToGoal
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {item.scenarioSipMonths > item.monthsToGoal
                                ? `+${item.scenarioSipMonths - item.monthsToGoal} months`
                                : `-${item.monthsToGoal - item.scenarioSipMonths} months`}
                            </div>
                          )}
                      </div>
                      </div>
                      )}
                      <div className="mt-2">
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() =>
                          setShowScenarioWhy((prev) => ({
                            ...prev,
                            [String(item.goal._id)]: !prev[String(item.goal._id)],
                          }))
                        }
                      >
                        {showScenarioWhy[String(item.goal._id)] ? "Hide explanation" : "Why this?"}
                      </button>
                      {showScenarioWhy[String(item.goal._id)] && (
                        <div className="mt-2 text-xs text-gray-700 space-y-1">
                          <div>Return sensitivity adjusts expected returns by ±2% to show timing impact.</div>
                          <div>This changes the effective monthly pace used for estimating months‑to‑goal.</div>
                          <div>SIP Δ applies a hypothetical increase/decrease to monthly contribution.</div>
                          <div>All scenarios are hypothetical and non‑binding; recommendations remain unchanged.</div>
                        </div>
                      )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <div>No goals linked yet</div>
              <div className="text-xs mt-1">Add goals in your profile</div>
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}
