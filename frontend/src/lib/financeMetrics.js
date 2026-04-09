export function safeNum(val) {
  const num = typeof val === "number" ? val : Number(val || 0);
  return isNaN(num) ? 0 : num;
}

export function groupTotals(breakdown = []) {
  const totals = { Needs: 0, Wants: 0, Savings: 0 };
  for (const r of breakdown) {
    const key = r.group || r.name || "Needs";
    if (totals[key] == null) totals[key] = 0;
    totals[key] += safeNum(r.total);
  }
  return totals;
}

export function computeDisplayMetrics(breakdown = []) {
  const totals = groupTotals(breakdown);
  const expenseConsumption = safeNum(totals.Needs) + safeNum(totals.Wants);
  const savingsContribution = safeNum(totals.Savings);
  return { expenseConsumption, savingsContribution };
}

export function computePlannedMetrics(profile = null) {
  const income = safeNum(profile?.monthlyIncome);
  const needsPct = safeNum(profile?.allocations?.needsPct);
  const wantsPct = safeNum(profile?.allocations?.wantsPct);
  const savingsPct = safeNum(profile?.allocations?.savingsPct);
  if (income <= 0 || needsPct + wantsPct + savingsPct <= 0) {
    return { expenseConsumption: 0, savingsContribution: 0 };
  }
  const needsAmt = income * (needsPct / 100);
  const wantsAmt = income * (wantsPct / 100);
  const savingsAmt = income * (savingsPct / 100);
  return {
    expenseConsumption: safeNum(needsAmt) + safeNum(wantsAmt),
    savingsContribution: safeNum(savingsAmt),
  };
}

export function computeDisplayMetricsWithProfile(
  breakdown = [],
  profile = null,
) {
  // If profile has allocations and income, prefer planned metrics; otherwise fallback to actual breakdown
  if (profile && safeNum(profile.monthlyIncome) > 0 && profile.allocations) {
    const totalPct =
      safeNum(profile.allocations.needsPct) +
      safeNum(profile.allocations.wantsPct) +
      safeNum(profile.allocations.savingsPct);
    if (Math.round(totalPct) === 100) {
      return computePlannedMetrics(profile);
    }
  }
  return computeDisplayMetrics(breakdown);
}

export function computeChanges(
  sum,
  prevSum,
  breakdownCurr = [],
  breakdownPrev = [],
) {
  if (!sum || !prevSum)
    return { income: 0, expense: 0, savings: 0, investable: 0 };
  const calcChange = (curr, prev) => {
    const c = safeNum(curr);
    const p = safeNum(prev);
    return p > 0 ? ((c - p) / p) * 100 : 0;
  };
  const totalsCurr = groupTotals(breakdownCurr);
  const totalsPrev = groupTotals(breakdownPrev);
  const expenseConsumptionCurr =
    safeNum(totalsCurr.Needs) + safeNum(totalsCurr.Wants);
  const expenseConsumptionPrev =
    safeNum(totalsPrev.Needs) + safeNum(totalsPrev.Wants);
  const savingsContributionCurr = safeNum(totalsCurr.Savings);
  const savingsContributionPrev = safeNum(totalsPrev.Savings);
  return {
    income: calcChange(safeNum(sum.income), safeNum(prevSum.income)),
    expense: calcChange(expenseConsumptionCurr, expenseConsumptionPrev),
    savings: calcChange(savingsContributionCurr, savingsContributionPrev),
    investable: 0,
  };
}
