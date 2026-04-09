import React, { useState } from "react";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import api from "../api/client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "Ask finance/data questions about your budgets, transactions, goals, investments, and taxes.",
    },
  ]);
  const renderContent = (text) => {
    if (!text) return null;
    try {
      const blocks = String(text).split(/\n{2,}/g);
      return (
        <div className="space-y-2">
          {blocks.map((block, idx) => {
            const lines = block.split("\n").map((l) => l.trim());
            const bullet = lines.every((l) => l.startsWith("- "));
            if (bullet) {
              return (
                <ul key={idx} className="list-disc list-inside space-y-1">
                  {lines.map((l, i) => (
                    <li key={i}>{l.replace(/^-+\s*/, "")}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {block}
              </p>
            );
          })}
        </div>
      );
    } catch {
      return <div className="whitespace-pre-wrap">{String(text)}</div>;
    }
  };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmOnline, setLlmOnline] = useState(null);
  const [llmModel, setLlmModel] = useState("");
  const suggestions = [
    "Show my cash flow",
    "Which categories are overspent?",
    "Plan my budget",
    "What is SIP?",
    "How much budget is remaining this month?",
  ];
  const [activeFilters, setActiveFilters] = useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/chat/health");
        setLlmOnline(Boolean(data?.llm_online));
        setLlmModel(String(data?.model || ""));
      } catch {
        setLlmOnline(false);
      }
    })();
  }, []);

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    const filters = [];
    if (/food/i.test(text)) filters.push("Food");
    if (/travel/i.test(text)) filters.push("Travel");
    if (/shopping/i.test(text)) filters.push("Shopping");
    if (/needs/i.test(text)) filters.push("Needs");
    if (/wants/i.test(text)) filters.push("Wants");
    if (/savings|investment/i.test(text)) filters.push("Savings");
    const m = text.match(/last\s+(\d+)\s*months?/i);
    if (m) filters.push(`Last ${m[1]} Months`);
    if (/last month/i.test(text)) filters.push("Last Month");
    if (/this year/i.test(text)) filters.push("This Year");
    setActiveFilters(filters);
    if (!preset) setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", { message: text });
      // New strict JSON shape: { data, explanation, recommendation }
      if (data && typeof data === "object" && "data" in data && "explanation" in data && "recommendation" in data) {
        setMessages((m) => [
          ...m,
          { 
            role: "assistant", 
            json: data,
            format: "json_ai"
          },
        ]);
        return;
      }

      const reply = data?.reply || "Sorry, I could not answer.";
      const fmt = data?.format;
      const payload = data?.data;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply, format: fmt, payload },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { 
          role: "assistant", 
          content: "Server error. Please try again." 
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyAction = async (action) => {
    if (action.type === "budget_update") {
      try {
        setLoading(true);
        const { Needs, Wants, Savings } = action.data.proposedBudget;
        await api.post("/settings/profile", {
          allocations: {
            needsPct: Math.round((Needs / (Needs + Wants + Savings)) * 100),
            wantsPct: Math.round((Wants / (Needs + Wants + Savings)) * 100),
            savingsPct: Math.round((Savings / (Needs + Wants + Savings)) * 100),
          }
        });
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "✅ Budget updated successfully based on the recommendation." },
        ]);
      } catch (err) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "❌ Failed to update budget. Please try manually in Settings." },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  const ChartRenderer = ({ chart }) => {
    if (!chart || !chart.type || !Array.isArray(chart.labels) || !Array.isArray(chart.values)) return null;
    const data = chart.labels.map((l, i) => ({ label: l, value: Number(chart.values[i] || 0) }));
    if (chart.type === "line") {
      return (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} tick={{ fontSize: 12 }} tickLine={false} />
              <Tooltip formatter={(v, n, props) => [`₹${Math.round(v).toLocaleString("en-IN")}`, props.payload.label]} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (chart.type === "bar") {
      return (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} tick={{ fontSize: 12 }} tickLine={false} />
              <Tooltip formatter={(v, n, props) => [`₹${Math.round(v).toLocaleString("en-IN")}`, props.payload.label]} />
              <Legend />
              <Bar dataKey="value" fill="#22c55e" isAnimationActive={true} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (chart.type === "pie") {
      const COLORS = ["#2563eb", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4"];
      return (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(v, n) => [`₹${Math.round(v).toLocaleString("en-IN")}`, n]} />
              <Legend />
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} label>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };

  return (
    <Page title="Chat" subtitle="Finance and data assistant">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-500">
            {llmModel ? `Model: ${llmModel}` : "Model: —"}
          </div>
          <div
            className={`px-2 py-1 rounded-full text-xs font-semibold ${llmOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
          >
            {llmOnline ? "LLM Online" : "LLM Offline"}
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {activeFilters.map((f, i) => (
              <span key={i} className="px-2 py-1 rounded-full bg-white text-gray-700 border border-gray-300 text-xs">
                {f}
              </span>
            ))}
          </div>
        )}
        <div className="h-[60vh] overflow-y-auto space-y-3">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const bubbleBase = isUser
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-900";
            return (
              <div
                key={idx}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${bubbleBase} ${!isUser ? "shadow-sm border border-gray-200" : ""}`}
                >
                  {!isUser && msg.format === "json_ai" ? (
                    <div className="space-y-3">
                      {msg.json?.explanation && (
                        <div className="whitespace-pre-wrap">{msg.json.explanation}</div>
                      )}
                      {msg.json?.data && Object.keys(msg.json.data).length > 0 && (
                        <div className="bg-white p-3 rounded-xl border border-gray-200">
                          <div className="text-[10px] font-bold text-gray-600 uppercase mb-2">
                            Data
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {Object.entries(msg.json.data).map(([k, v]) => (
                              <div key={k} className="flex justify-between bg-gray-50 px-2 py-1 rounded">
                                <span className="text-gray-500">{k}</span>
                                <span className="font-semibold">
                                  {typeof v === "number" ? `₹${Math.round(v).toLocaleString("en-IN")}` : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.json?.chart && msg.json.chart.type && (
                        <div className="bg-white p-3 rounded-xl border border-gray-200">
                          <div className="text-[10px] font-bold text-gray-600 uppercase mb-2">
                            Chart
                          </div>
                          <ChartRenderer chart={msg.json.chart} />
                        </div>
                      )}
                      {msg.json?.recommendation && (
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Recommendation</div>
                          <div className="text-emerald-900 text-xs">{msg.json.recommendation}</div>
                        </div>
                      )}
                    </div>
                  ) : !isUser && msg.format === "structured_ai" ? (
                    <div className="space-y-3">
                      {renderContent(msg.content)}
                      
                      {msg.insights?.length > 0 && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                          <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Personal Insights</div>
                          <ul className="list-disc list-inside space-y-1 text-blue-900 text-xs">
                            {msg.insights.map((ins, i) => <li key={i}>{ins}</li>)}
                          </ul>
                        </div>
                      )}

                      {msg.recommendations?.length > 0 && (
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Recommendations</div>
                          <ul className="list-disc list-inside space-y-1 text-emerald-900 text-xs">
                            {msg.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                          </ul>
                        </div>
                      )}

                      {msg.action && (
                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                          <div className="text-[10px] font-bold text-orange-600 uppercase mb-1">Suggested Action</div>
                          <div className="text-orange-900 text-xs mb-2">
                            {msg.action.type === "budget_update" && (
                              <div>
                                <div className="font-semibold mb-1">New Budget Proposal:</div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div className="bg-white p-1 rounded border border-orange-200">
                                    <div className="text-[8px] text-gray-500">Needs</div>
                                    <div className="font-bold">₹{Math.round(msg.action.data.proposedBudget.Needs).toLocaleString("en-IN")}</div>
                                  </div>
                                  <div className="bg-white p-1 rounded border border-orange-200">
                                    <div className="text-[8px] text-gray-500">Wants</div>
                                    <div className="font-bold">₹{Math.round(msg.action.data.proposedBudget.Wants).toLocaleString("en-IN")}</div>
                                  </div>
                                  <div className="bg-white p-1 rounded border border-orange-200">
                                    <div className="text-[8px] text-gray-500">Savings</div>
                                    <div className="font-bold">₹{Math.round(msg.action.data.proposedBudget.Savings).toLocaleString("en-IN")}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="w-full bg-orange-600 hover:bg-orange-700 text-[10px] py-1 h-auto"
                            onClick={() => applyAction(msg.action)}
                            disabled={loading}
                          >
                            Apply this change
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : !isUser && msg.format === "summary" && msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">Monthly Summary</div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-gray-500">Income</div>
                          <div className="font-bold text-green-700">
                            ₹
                            {Math.round(msg.payload.income).toLocaleString(
                              "en-IN",
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Expenses</div>
                          <div className="font-bold text-red-700">
                            ₹
                            {Math.round(msg.payload.expense).toLocaleString(
                              "en-IN",
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Savings</div>
                          <div
                            className={`font-bold ${Number(msg.payload.savings) < 0 ? "text-red-700" : "text-emerald-700"}`}
                          >
                            ₹
                            {Math.round(msg.payload.savings).toLocaleString(
                              "en-IN",
                            )}
                          </div>
                        </div>
                      </div>
                      {Number(msg.payload.savings) < 0 && (
                        <div className="mt-2 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 inline-block">
                          Expenses exceed income this month
                        </div>
                      )}
                    </div>
                  ) : !isUser && msg.format === "investable" && msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">Investable</div>
                      <div className="text-lg font-bold mb-2">
                        ₹
                        {Math.round(msg.payload.investable).toLocaleString(
                          "en-IN",
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(msg.payload.allocations || {}).map(
                          ([k, v]) => (
                            <span
                              key={k}
                              className="px-2 py-1 rounded-full bg-white text-gray-700 border border-gray-300"
                            >
                              {k} ₹{Math.round(v).toLocaleString("en-IN")}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  ) : !isUser && msg.format === "cashflow" && msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">Recent Cashflow</div>
                      <div className="text-sm font-bold mb-2">
                        ₹
                        {Math.round(
                          msg.payload.last?.savings || 0,
                        ).toLocaleString("en-IN")}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(msg.payload.series || []).slice(-4).map((p, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span className="text-gray-500">{p.period}</span>
                            <span className="font-semibold">
                              ₹{Math.round(p.savings).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : !isUser && msg.format === "overspent" && msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">Overspent</div>
                      {msg.payload.categories?.length ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {msg.payload.categories.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded-full bg-white text-gray-700 border border-gray-300"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs">No categories overspent.</div>
                      )}
                    </div>
                  ) : !isUser && msg.format === "goals" && msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">Goals Status</div>
                      <div className="space-y-2 text-xs">
                        {(msg.payload.items || []).slice(0, 5).map((g, i) => (
                          <div
                            key={i}
                            className="p-2 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-semibold">{g.name}</div>
                              <div
                                className={`text-xs ${g.status === "On Track" ? "text-green-600" : "text-gray-600"}`}
                              >
                                {g.status || "—"}
                              </div>
                            </div>
                            <div className="text-gray-500 mt-1">
                              {g.progressPct}% • Plan ₹
                              {Math.round(g.plan).toLocaleString("en-IN")} •
                              Actual ₹
                              {Math.round(g.actual).toLocaleString("en-IN")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : !isUser &&
                    msg.format === "transactions" &&
                    msg.payload ? (
                    <div>
                      <div className="font-semibold mb-1">
                        {msg.payload.title || "Transactions"}
                      </div>
                      <div className="space-y-2 text-xs">
                        {(msg.payload.items || []).slice(0, 10).map((t, i) => (
                          <div
                            key={i}
                            className="p-2 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div
                                className={`font-semibold ${t.type === "income" ? "text-green-700" : "text-red-700"}`}
                              >
                                ₹{Math.round(t.amount).toLocaleString("en-IN")}
                              </div>
                              <div className="text-gray-500">
                                {new Date(t.date).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-gray-800 mt-1">
                              {t.type} • {t.category}
                            </div>
                            {(t.merchant || t.description) && (
                              <div className="text-gray-500 mt-1">
                                {[t.merchant, t.description]
                                  .filter(Boolean)
                                  .join(" — ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {!(msg.payload.items || []).length && (
                        <div className="text-xs text-gray-600">
                          No transactions found.
                        </div>
                      )}
                    </div>
                  ) : (
                    renderContent(msg.content)
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              className="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-100"
              disabled={loading}
              title={s}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Ask about budgets, goals, cashflow, investments…"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button
            variant="primary"
            onClick={() => send()}
            disabled={loading}
            type="button"
          >
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Note: This assistant answers finance/data questions only and may
          refuse unrelated queries.
        </div>
      </Card>
    </Page>
  );
}
