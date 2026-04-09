import React, { useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { formatINR } from "../lib/format";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import { showToast } from "../components/Toast";
import {
  Shield,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
} from "lucide-react";

const LIFE_COVERAGE_MIN = 10;
const LIFE_COVERAGE_MAX = 15;
const HEALTH_FLOOR = 1_000_000;
const ACCIDENT_FLOOR = 500_000;

const TYPE_LABELS = {
  life: "Life insurance",
  health: "Health insurance",
  accident: "Accident cover",
};

function StatusPill({ children, variant }) {
  const cls =
    variant === "safe"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : variant === "moderate"
        ? "bg-amber-100 text-amber-900 ring-amber-200"
        : variant === "risk"
          ? "bg-red-100 text-red-800 ring-red-200"
          : variant === "adequate"
            ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
            : variant === "under"
              ? "bg-amber-100 text-amber-900 ring-amber-200"
              : variant === "missing"
                ? "bg-slate-100 text-slate-600 ring-slate-200"
                : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

function InsuranceCard({ item, annualIncome, onSaved, onRemoved }) {
  const [cov, setCov] = useState(
    item.coverageAmount != null ? String(item.coverageAmount) : "",
  );
  const [prem, setPrem] = useState(
    item.annualPremium != null ? String(item.annualPremium) : "",
  );
  const [provider, setProvider] = useState(item.provider || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCov(item.coverageAmount != null ? String(item.coverageAmount) : "");
    setPrem(item.annualPremium != null ? String(item.annualPremium) : "");
    setProvider(item.provider || "");
  }, [item]);

  const save = async () => {
    const coverageAmount = parseFloat(cov);
    const annualPremium = parseFloat(prem);
    if (Number.isNaN(coverageAmount) || coverageAmount < 0) {
      showToast("Enter a valid coverage amount", "warning");
      return;
    }
    if (Number.isNaN(annualPremium) || annualPremium < 0) {
      showToast("Enter a valid annual premium", "warning");
      return;
    }
    setSaving(true);
    try {
      await api.put("/protection/insurance", {
        type: item.type,
        coverageAmount,
        annualPremium,
        provider: provider.trim(),
      });
      showToast("Saved", "success");
      onSaved();
    } catch (e) {
      showToast(e.response?.data?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item.id) return;
    if (!window.confirm("Remove this coverage record?")) return;
    try {
      await api.delete(`/protection/insurance/${item.type}`);
      showToast("Removed", "success");
      onRemoved();
    } catch (e) {
      showToast(e.response?.data?.message || "Could not remove", "error");
    }
  };

  const d = item.derived || {};
  const pillVariant =
    d.status === "adequate"
      ? "adequate"
      : d.status === "underinsured"
        ? "under"
        : d.status === "missing"
          ? "missing"
          : "missing";

  return (
    <Card hover={false} className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {TYPE_LABELS[item.type]}
            </h3>
            <div className="mt-1">
              <StatusPill variant={pillVariant}>{d.label || "—"}</StatusPill>
            </div>
          </div>
        </div>
        {item.id && (
          <button
            type="button"
            onClick={remove}
            className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {item.type === "life" && (
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Rule of thumb: coverage around{" "}
          <strong>
            {LIFE_COVERAGE_MIN}×–{LIFE_COVERAGE_MAX}×
          </strong>{" "}
          annual income
          {annualIncome > 0
            ? ` (${formatINR(annualIncome)} / yr).`
            : ". Add income in profile for a target range."}
        </p>
      )}
      {item.type === "health" && (
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Baseline adequacy for this view:{" "}
          <strong>{formatINR(HEALTH_FLOOR)}</strong> sum insured or higher.
        </p>
      )}
      {item.type === "accident" && (
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Baseline adequacy for this view:{" "}
          <strong>{formatINR(ACCIDENT_FLOOR)}</strong> coverage or higher.
        </p>
      )}

      <div className="space-y-2">
        <label className="block text-xs text-muted">Coverage amount (₹)</label>
        <input
          type="number"
          min={0}
          step={1000}
          value={cov}
          onChange={(e) => setCov(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="0"
        />
        <label className="block text-xs text-muted">Annual premium (₹)</label>
        <input
          type="number"
          min={0}
          step={100}
          value={prem}
          onChange={(e) => setPrem(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="0"
        />
        <label className="block text-xs text-muted">Provider (optional)</label>
        <input
          type="text"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Insurer name"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-2 pw-btn pw-btn-primary w-full sm:w-auto"
        >
          {saving ? "Saving…" : item.id ? "Update" : "Save coverage"}
        </button>
      </div>
    </Card>
  );
}

export default function Protection() {
  const [loading, setLoading] = useState(true);
  const [ef, setEf] = useState(null);
  const [insurance, setInsurance] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [efRes, insRes] = await Promise.all([
        api.get("/protection/emergency-fund"),
        api.get("/protection/insurance"),
      ]);
      setEf(efRes.data);
      setInsurance(insRes.data);
    } catch (e) {
      console.error(e);
      showToast("Could not load protection data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pctProgress =
    ef && ef.targetEmergencyFund > 0
      ? Math.min(100, (ef.currentEmergencyFund / ef.targetEmergencyFund) * 100)
      : 0;

  const efVariant =
    ef?.status === "safe"
      ? "safe"
      : ef?.status === "moderate"
        ? "moderate"
        : ef?.status === "at_risk"
          ? "risk"
          : "missing";

  const efLabel =
    ef?.status === "safe"
      ? "Safe"
      : ef?.status === "moderate"
        ? "Moderate"
        : ef?.status === "at_risk"
          ? "At risk"
          : "Set up";

  return (
    <Page title="Protection" subtitle="Emergency fund & insurance — separate from investments">
      <div className="space-y-6 max-w-4xl">
        <p className="text-sm text-muted">
          Liquidity and risk cover are tracked here. This page does not affect
          investment allocation, goals, or budgets.
        </p>

        {loading ? (
          <div className="space-y-3">
            <div className="pw-card h-40 pw-skeleton" />
            <div className="grid md:grid-cols-3 gap-3">
              <div className="h-64 pw-skeleton rounded-2xl" />
              <div className="h-64 pw-skeleton rounded-2xl" />
              <div className="h-64 pw-skeleton rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            <Card hover={false} className="overflow-hidden p-0">
              <div className="border-b border-slate-100 bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      Emergency fund
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Short-term buffer — not for growth. Built from{" "}
                      <strong>Transactions</strong> to Savings → Emergency Fund.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {!ef?.hasNeedsData && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                    <strong className="font-medium">Setup:</strong> add Needs
                    expenses in the last {ef?.windowMonths ?? 6} months so we can
                    estimate monthly spending. Your emergency target is{" "}
                    {ef?.targetMonths ?? 6}× that average.
                  </div>
                )}
                {!ef?.hasEmergencySubcategory && (
                  <p className="text-xs text-muted">
                    System subcategory “Emergency Fund” is missing — contact
                    support.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill variant={efVariant}>{efLabel}</StatusPill>
                  {ef?.monthsCovered != null && ef.monthlyExpenses > 0 && (
                    <span className="text-xs text-muted">
                      Months covered:{" "}
                      <strong className="text-ink pw-number">
                        {ef.monthsCovered.toFixed(1)}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted">Current (from transactions)</p>
                    <p className="text-xl font-bold text-ink pw-number">
                      {formatINR(ef?.currentEmergencyFund ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Target (6× monthly Needs)</p>
                    <p className="text-xl font-bold text-ink pw-number">
                      {ef?.targetEmergencyFund > 0
                        ? formatINR(ef.targetEmergencyFund)
                        : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Progress to target</span>
                    <span className="pw-number">
                      {ef?.targetEmergencyFund > 0
                        ? `${Math.round(pctProgress)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${pctProgress}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  Avg. monthly Needs (last {ef?.windowMonths ?? 6} months):{" "}
                  <strong className="text-ink pw-number">
                    {ef?.monthlyExpenses > 0
                      ? formatINR(ef.monthlyExpenses)
                      : "—"}
                  </strong>
                  . No SIPs, projections, or Monte Carlo — this is liquidity only.
                </p>
              </div>
            </Card>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-ink">Insurance</h2>
              </div>
              <p className="text-sm text-muted mb-4">
                Manual entries only. Status is derived from simple rules — not
                investment advice.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {(insurance?.items || []).map((item) => (
                  <InsuranceCard
                    key={item.type}
                    item={item}
                    annualIncome={insurance?.annualIncome ?? 0}
                    onSaved={load}
                    onRemoved={load}
                  />
                ))}
              </div>
            </div>

            <Card hover={false} className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Info className="h-4 w-4 text-primary shrink-0" />
                  Why protection matters
                </span>
                {whyOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted" />
                )}
              </button>
              {whyOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-2 text-sm text-muted space-y-2 leading-relaxed">
                  <p>
                    • An <strong>emergency fund</strong> helps you handle shocks
                    without taking on debt — it stays liquid, not invested for
                    returns.
                  </p>
                  <p>
                    • <strong>Insurance</strong> protects income and family
                    against events you cannot plan away.
                  </p>
                  <p>
                    • These are <strong>not investments</strong> and are kept
                    separate from your portfolio, goals, and SIP logic.
                  </p>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Page>
  );
}
