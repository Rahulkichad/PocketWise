/**
 * Seed constants and plan generator for Rahul Test User.
 */

export const TEST_USER = {
  name: "Rahul Test User",
  email: "rahul.test@example.com",
  password: "Test@123",
  age: 28,
  monthlyIncome: 85000,
  riskProfile: "Moderate",
  allocations: { needsPct: 50, wantsPct: 20, savingsPct: 30 },
};

export const MONTHS_HISTORY = 36;

export function buildThreeYearPlan({
  userId,
  needsMap,
  wantsMap,
  savingsMap,
  anchorDate = new Date(),
}) {
  const transactions = [];
  const budgets = [];
  const trainingRows = [];
  const monthlyAggregates = [];

  let currentIncome = TEST_USER.monthlyIncome;
  const yearlyIncrement = 0.10; // 10% increment

  for (let i = 0; i < MONTHS_HISTORY; i++) {
    const monthsAgo = MONTHS_HISTORY - 1 - i;
    const date = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth() - monthsAgo,
      1
    );
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Helper for transaction dates to ensure they don't exceed current day if it's the current month
    const getSafeDate = (day) => {
      const isCurrentMonth = monthsAgo === 0;
      if (isCurrentMonth) {
        const today = anchorDate.getDate();
        // If the intended day is in the future, cap it to today
        return new Date(year, month - 1, Math.min(day, today));
      }
      return new Date(year, month - 1, day);
    };

    // Yearly increment
    if (i > 0 && i % 12 === 0) {
      currentIncome = Math.round(currentIncome * (1 + yearlyIncrement));
    }

    let monthlyNeeds = 0;
    let monthlyWants = 0;
    let monthlySavings = 0;
    let monthlyIncome = 0;

    // --- Income ---
    const salary = currentIncome;
    transactions.push({
      userId,
      type: "income",
      amount: salary,
      date: getSafeDate(2), // Shifted to 2nd to avoid timezone start-of-month issues
      description: "Monthly Salary",
      category: "Income",
    });
    monthlyIncome += salary;

    // Occasional bonus (randomly twice a year)
    if (Math.random() < 0.15) {
      const bonus = Math.round(salary * 0.3);
      transactions.push({
        userId,
        type: "income",
        amount: bonus,
        date: getSafeDate(15),
        description: "Performance Bonus",
        category: "Income",
      });
      monthlyIncome += bonus;
    }

    // --- Expenses (Target: 50/20/30) ---
    // Variability +/- 10%
    const variability = 0.9 + Math.random() * 0.2;
    const targetNeeds = salary * (TEST_USER.allocations.needsPct / 100) * variability;
    const targetWants = salary * (TEST_USER.allocations.wantsPct / 100) * variability;
    const targetSavings = salary * (TEST_USER.allocations.savingsPct / 100); // Savings usually more stable if target-driven

    // 1) Needs
    const needsItems = [
      { name: "Rent", pct: 0.5, desc: "Monthly Rent", day: 3 },
      { name: "Groceries", pct: 0.2, desc: "Groceries", day: 7 },
      { name: "Utilities", pct: 0.1, desc: "Electricity & Water", day: 8 },
      { name: "Transportation", pct: 0.1, desc: "Fuel & Commute", day: 12 },
      { name: "Healthcare", pct: 0.1, desc: "Medication & Checkup", day: 15 },
    ];

    needsItems.forEach((item) => {
      const amount = Math.round(targetNeeds * item.pct);
      transactions.push({
        userId,
        type: "expense",
        amount,
        date: getSafeDate(item.day),
        description: item.desc,
        category: "Needs",
        subCategoryId: needsMap[item.name],
      });
      monthlyNeeds += amount;
    });

    // 2) Wants
    const wantsItems = [
      { name: "Dining Out", pct: 0.4, desc: "Weekend Dinner", day: 6 },
      { name: "Shopping", pct: 0.3, desc: "Clothing & Tech", day: 14 },
      { name: "Entertainment", pct: 0.3, desc: "Movies & Subs", day: 18 },
    ];

    wantsItems.forEach((item) => {
      const amount = Math.round(targetWants * item.pct);
      transactions.push({
        userId,
        type: "expense",
        amount,
        date: getSafeDate(item.day),
        description: item.desc,
        category: "Wants",
        subCategoryId: wantsMap[item.name],
      });
      monthlyWants += amount;
    });

    // Special case: Higher expense month
    if (i % 10 === 0) {
      const travelAmount = Math.round(salary * 0.4);
      transactions.push({
        userId,
        type: "expense",
        amount: travelAmount,
        date: getSafeDate(20),
        description: "Vacation Trip",
        category: "Wants",
        subCategoryId: wantsMap["Travel"],
      });
      monthlyWants += travelAmount;
    }

    // 3) Savings
    const savingsItems = [
      { name: "Emergency Fund", pct: 0.3, desc: "EF Contribution", day: 5 },
      { name: "Investments", pct: 0.5, desc: "SIP Mutual Funds", day: 5 },
      { name: "Retirement", pct: 0.2, desc: "Retirement Fund", day: 5 },
    ];

    savingsItems.forEach((item) => {
      const amount = Math.round(targetSavings * item.pct);
      transactions.push({
        userId,
        type: "expense",
        amount,
        date: getSafeDate(item.day),
        description: item.desc,
        category: "Savings",
        subCategoryId: savingsMap[item.name],
      });
      monthlySavings += amount;
    });

    // --- Budgets ---
    // Total category budgets
    budgets.push(
      { userId, category: "Needs", limit: Math.round(salary * 0.55), month, year },
      { userId, category: "Wants", limit: Math.round(salary * 0.25), month, year },
      { userId, category: "Savings", limit: Math.round(salary * 0.35), month, year }
    );

    // Granular Budgets (requested)
    needsItems.forEach(item => {
      budgets.push({
        userId,
        category: "Needs",
        subCategoryId: needsMap[item.name],
        limit: Math.round(salary * 0.55 * item.pct),
        month,
        year
      });
    });

    wantsItems.forEach(item => {
      budgets.push({
        userId,
        category: "Wants",
        subCategoryId: wantsMap[item.name],
        limit: Math.round(salary * 0.25 * item.pct),
        month,
        year
      });
    });

    savingsItems.forEach(item => {
      budgets.push({
        userId,
        category: "Savings",
        subCategoryId: savingsMap[item.name],
        limit: Math.round(salary * 0.35 * item.pct),
        month,
        year
      });
    });

    monthlyAggregates.push({
      month,
      year,
      income: monthlyIncome,
      needs: monthlyNeeds,
      wants: monthlyWants,
      savings: monthlySavings,
    });

    // --- ML Training Row ---
    // Features: age, monthlyIncome, savingsRate, expenseRatio, goalCount, timeHorizon, taxUsageRatio, riskProfile
    // Labels: equityBiasObserved, debtBiasObserved, taxBiasObserved
    const savingsRate = monthlySavings / monthlyIncome;
    const expenseRatio = (monthlyNeeds + monthlyWants) / monthlyIncome;
    
    // Simple logic for labels
    const equityBias = savingsRate > 0.2 ? 1 : 0;
    const debtBias = monthlyNeeds / monthlyIncome > 0.6 ? 1 : 0;
    const taxBias = monthlySavings > 15000 ? 1 : 0;

    trainingRows.push({
      age: TEST_USER.age,
      monthlyIncome: Math.round(monthlyIncome),
      savingsRate: parseFloat(savingsRate.toFixed(2)),
      expenseRatio: parseFloat(expenseRatio.toFixed(2)),
      goalCount: 3,
      timeHorizon: 10,
      taxUsageRatio: 0.15,
      riskProfile: TEST_USER.riskProfile,
      equityBiasObserved: equityBias,
      debtBiasObserved: debtBias,
      taxBiasObserved: taxBias,
    });
  }

  return { transactions, budgets, trainingRows, monthlyAggregates };
}
