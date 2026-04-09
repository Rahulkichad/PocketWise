import api from "../api/client";

export function allocateInvestments({ monthlyIncome = 0, age = 0, riskProfile = "Moderate" }) {
  const income = Number(monthlyIncome) || 0;
  const a = Number(age) || 0;
  const risk = String(riskProfile || "Moderate");
  const split = income <= 30000
    ? { Needs: 0.6, Wants: 0.25, Savings: 0.15 }
    : income <= 70000
      ? { Needs: 0.5, Wants: 0.3, Savings: 0.2 }
      : { Needs: 0.4, Wants: 0.3, Savings: 0.3 };
  const investable = income * split.Savings;
  const base = {
    Conservative: { SIP: 0.40, PPF: 0.35, NPS: 0.20, ELSS: 0.05 },
    Moderate: { SIP: 0.50, PPF: 0.25, NPS: 0.15, ELSS: 0.10 },
    Aggressive: { SIP: 0.65, PPF: 0.10, NPS: 0.10, ELSS: 0.15 },
  }[risk] || { SIP: 0.50, PPF: 0.25, NPS: 0.15, ELSS: 0.10 };
  if (a < 30) {
    base.SIP += 0.05;
    base.PPF -= 0.03;
    base.NPS -= 0.01;
    base.ELSS -= 0.01;
  } else if (a > 45) {
    base.SIP -= 0.05;
    base.PPF += 0.03;
    base.NPS += 0.01;
    base.ELSS += 0.01;
  }
  const total = base.SIP + base.PPF + base.NPS + base.ELSS;
  const weights = {
    SIP: base.SIP / total,
    PPF: base.PPF / total,
    NPS: base.NPS / total,
    ELSS: base.ELSS / total,
  };
  const raw = {
    SIP: investable * weights.SIP,
    PPF: investable * weights.PPF,
    NPS: investable * weights.NPS,
    ELSS: investable * weights.ELSS,
  };
  const cap80cMonth = 150000 / 12.0;
  const cap80ccd1bMonth = 50000 / 12.0;
  let ppf = raw.PPF;
  let elss = raw.ELSS;
  let nps = raw.NPS;
  const total80c = ppf + elss;
  if (total80c > cap80cMonth) {
    const scale = cap80cMonth / total80c;
    ppf *= scale;
    elss *= scale;
  }
  if (nps > cap80ccd1bMonth) nps = cap80ccd1bMonth;
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const instruments = [
    { type: "SIP", monthlyAmount: round2(raw.SIP), expectedReturn: 12, risk: "High" },
    { type: "PPF", monthlyAmount: round2(ppf), expectedReturn: 7.1, risk: "Low" },
    { type: "NPS", monthlyAmount: round2(nps), expectedReturn: 9, risk: "Moderate" },
    { type: "ELSS", monthlyAmount: round2(elss), expectedReturn: 14, risk: "High" },
  ];
  return {
    recommendedSplit: {
      needsPct: split.Needs * 100,
      wantsPct: split.Wants * 100,
      savingsPct: split.Savings * 100,
    },
    monthlyIncome: income,
    investableMonthly: round2(investable),
    instruments,
  };
}

export function scaleAllocation(allocation, targetInvestable) {
  const baseInv = Number(allocation?.investableMonthly || 0);
  const target = Number(targetInvestable || 0);
  // Never scale down to zero: a derived investable of 0 (e.g. no savings history yet)
  // should fall back to the profile-based allocation unchanged.
  if (!allocation || baseInv <= 0 || target <= 0) return allocation;
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const scale = baseInv > 0 ? target / baseInv : 0;
  const cap80cMonth = 150000 / 12.0;
  const cap80ccd1bMonth = 50000 / 12.0;
  const scaled = Array.isArray(allocation.instruments)
    ? allocation.instruments.map((inst) => ({
        ...inst,
        monthlyAmount: round2(Number(inst.monthlyAmount || 0) * scale),
      }))
    : [];
  const ppfIdx = scaled.findIndex((i) => i.type === "PPF");
  const elssIdx = scaled.findIndex((i) => i.type === "ELSS");
  if (ppfIdx !== -1 && elssIdx !== -1) {
    const ppfAmt = Number(scaled[ppfIdx].monthlyAmount || 0);
    const elssAmt = Number(scaled[elssIdx].monthlyAmount || 0);
    const total80c = ppfAmt + elssAmt;
    if (total80c > cap80cMonth && total80c > 0) {
      const s = cap80cMonth / total80c;
      scaled[ppfIdx].monthlyAmount = round2(ppfAmt * s);
      scaled[elssIdx].monthlyAmount = round2(elssAmt * s);
    }
  }
  const npsIdx = scaled.findIndex((i) => i.type === "NPS");
  if (npsIdx !== -1) {
    const npsAmt = Number(scaled[npsIdx].monthlyAmount || 0);
    scaled[npsIdx].monthlyAmount = round2(Math.min(npsAmt, cap80ccd1bMonth));
  }
  return { ...allocation, investableMonthly: round2(target), instruments: scaled };
}

export async function applyAdjustmentBias(allocation, context) {
  try {
    if (!allocation) return allocation;
    const investable = Number(allocation.investableMonthly || 0);
    if (investable <= 0) return allocation;
    const items = Array.isArray(context?.breakdown) ? context.breakdown : [];
    const needsSpent = items
      .filter((x) => String(x.name) === "Needs")
      .reduce((sum, x) => sum + Number(x.total || 0), 0);
    const wantsSpent = items
      .filter((x) => String(x.name) === "Wants")
      .reduce((sum, x) => sum + Number(x.total || 0), 0);
    const incomeTotal = Number(context?.summary?.income || 0);
    const expenseRatio =
      incomeTotal > 0 ? Math.min(1, Math.max(0, (needsSpent + wantsSpent) / incomeTotal)) : 0;
    const savingsRate =
      Number(allocation?.recommendedSplit?.savingsPct ?? context?.profile?.allocations?.savingsPct ?? 0) /
      100;
    const features = {
      age: Number(context?.profile?.age || 0),
      monthlyIncome: Number(context?.profile?.monthlyIncome || 0),
      savingsRate: isNaN(savingsRate) ? 0 : savingsRate,
      expenseRatio,
      goalHorizon: 12,
      historicalSavingsConsistency: 0.5,
      riskProfile: String(context?.profile?.riskProfile || "Moderate"),
    };
    const { data } = await api.post("/ai/bias", { features });
    const bias = data?.bias || {};
    const minB = Number(data?.bounds?.min ?? -0.1);
    const maxB = Number(data?.bounds?.max ?? 0.1);
    const clamp = (v) => Math.max(minB, Math.min(maxB, Number(v || 0)));
    const equityBias = clamp(bias.equityBias);
    const debtBias = clamp(bias.debtBias);
    const taxBias = clamp(bias.taxBias ?? bias.taxSavingBias);
    const total = (allocation.instruments || []).reduce(
      (sum, i) => sum + Number(i.monthlyAmount || 0),
      0,
    );
    const base = total > 0 ? total : investable;
    const w = { SIP: 0, PPF: 0, NPS: 0, ELSS: 0 };
    for (const i of allocation.instruments || []) {
      const t = String(i.type);
      w[t] = Number(i.monthlyAmount || 0) / base;
    }
    if (base <= 0) {
      w.SIP = 0.5;
      w.PPF = 0.2;
      w.NPS = 0.15;
      w.ELSS = 0.15;
    }
    w.SIP += equityBias * 0.6 + taxBias * 0.2;
    w.ELSS += equityBias * 0.4 + taxBias * 0.6;
    w.PPF += debtBias * 0.6 + taxBias * 0.2;
    w.NPS += debtBias * 0.4;
    const eps = 0.0001;
    w.SIP = Math.max(eps, w.SIP);
    w.PPF = Math.max(eps, w.PPF);
    w.NPS = Math.max(eps, w.NPS);
    w.ELSS = Math.max(eps, w.ELSS);
    const sumW = w.SIP + w.PPF + w.NPS + w.ELSS;
    w.SIP /= sumW;
    w.PPF /= sumW;
    w.NPS /= sumW;
    w.ELSS /= sumW;
    const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    let SIP = investable * w.SIP;
    let PPF = investable * w.PPF;
    let NPS = investable * w.NPS;
    let ELSS = investable * w.ELSS;
    const cap80cMonth = 150000 / 12.0;
    const cap80ccd1bMonth = 50000 / 12.0;
    const total80c = PPF + ELSS;
    if (total80c > cap80cMonth && total80c > 0) {
      const s = cap80cMonth / total80c;
      PPF *= s;
      ELSS *= s;
    }
    NPS = Math.min(NPS, cap80ccd1bMonth);
    const instruments = [
      { type: "SIP", monthlyAmount: round2(SIP), expectedReturn: 12, risk: "High" },
      { type: "PPF", monthlyAmount: round2(PPF), expectedReturn: 7.1, risk: "Low" },
      { type: "NPS", monthlyAmount: round2(NPS), expectedReturn: 9, risk: "Moderate" },
      { type: "ELSS", monthlyAmount: round2(ELSS), expectedReturn: 14, risk: "High" },
    ];
    return { ...allocation, instruments };
  } catch {
    return allocation;
  }
}
