import Transaction from "../models/Transaction.js";
import Goal from "../models/Goal.js";
import Insurance from "../models/Insurance.js";
import mongoose from "mongoose";

export async function runValidation(userId) {
  const results = [];
  let markdown = "# Seed validation report\n\n";
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += "## Summary\n\n";
  markdown += "| Module | Result | Notes |\n";
  markdown += "|--------|--------|-------|\n";

  // 1. Investments / Allocation
  const txs = await Transaction.find({ userId }).lean();
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const hasNaN = txs.some(t => isNaN(t.amount));

  const invPass = totalIncome > 0 && !hasNaN;
  results.push({ module: "Investments / allocation data", pass: invPass, notes: `income=${totalIncome}, expense=${totalExpense}` });
  markdown += `| Investments / allocation data | ${invPass ? "Pass" : "Fail"} | income=${totalIncome.toFixed(2)}, expense=${totalExpense.toFixed(2)} |\n`;

  // 2. Goals
  const goals = await Goal.find({ userId }).lean();
  const goalPass = goals.length >= 3;
  results.push({ module: "Goals (progress from txns)", pass: goalPass, notes: `${goals.length} goals found` });
  markdown += `| Goals (progress from txns) | ${goalPass ? "Pass" : "Fail"} | ${goals.length} goals |\n`;

  // 3. Protection
  const insurance = await Insurance.find({ userId }).lean();
  const insPass = insurance.length >= 3;
  results.push({ module: "Protection (EF + insurance)", pass: insPass, notes: `insurance rows=${insurance.length}` });
  markdown += `| Protection (EF + insurance) | ${insPass ? "Pass" : "Fail"} | insurance rows=${insurance.length} |\n`;

  // 4. Month Continuity
  const months = new Set(txs.map(t => `${t.date.getFullYear()}-${t.date.getMonth()}`));
  const monthPass = months.size >= 36;
  results.push({ module: "Month continuity", pass: monthPass, notes: `${months.size} distinct months` });
  markdown += `| Month continuity | ${monthPass ? "Pass" : "Fail"} | ${months.size} distinct months |\n`;

  markdown += "\n## Issues\n\n";
  const issues = results.filter(r => !r.pass);
  if (issues.length === 0) {
    markdown += "None detected.\n";
  } else {
    issues.forEach(i => {
      markdown += `- ${i.module}: ${i.notes}\n`;
    });
  }

  return { results, markdown };
}
