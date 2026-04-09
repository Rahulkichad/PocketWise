import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import api from "../api/client";
import Button from "./ui/Button";

export default function ChatWidget() {
  const [open, setOpen] = React.useState(() => {
    try {
      return localStorage.getItem("pw_chat_open") === "1";
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = React.useState(() => {
    try {
      const raw = localStorage.getItem("pw_chat_messages");
      return raw
        ? JSON.parse(raw)
        : [
            {
              role: "system",
              content:
                "Ask finance/data questions about your budgets, transactions, goals, investments, and taxes.",
            },
          ];
    } catch {
      return [
        {
          role: "system",
          content:
            "Ask finance/data questions about your budgets, transactions, goals, investments, and taxes.",
        },
      ];
    }
  });
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [llmOnline, setLlmOnline] = React.useState(null);
  const [llmModel, setLlmModel] = React.useState("");
  const [unread, setUnread] = React.useState(0);
  const containerRef = React.useRef(null);
  const suggestions = [
    "What's my estimated investable amount this month?",
    "Show my cash flow for recent months",
    "Which categories are overspent?",
    "List my goals and their progress",
    "How much budget is remaining this month?",
  ];

  React.useEffect(() => {
    localStorage.setItem("pw_chat_messages", JSON.stringify(messages));
  }, [messages]);

  React.useEffect(() => {
    try {
      localStorage.setItem("pw_chat_open", open ? "1" : "0");
    } catch {}
    if (open) setUnread(0);
  }, [open]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

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
    if (!preset) setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", { message: text });
      const reply = data?.reply || "Sorry, I could not answer.";
      const fmt = data?.format;
      const payload = data?.data;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply, format: fmt, payload },
      ]);
      if (!open) setUnread((u) => u + 1);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Server error. Please try again." },
      ]);
      if (!open) setUnread((u) => u + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700"
            title="Open Chat"
            aria-label="Open Chat"
          >
            <MessageSquare size={20} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] sm:w-[420px] rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm text-gray-600">
                {llmModel ? `Model: ${llmModel}` : "Model: —"}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${llmOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                >
                  {llmOnline ? "LLM Online" : "LLM Offline"}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="flex flex-wrap gap-2">
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
            </div>

            <div
              ref={containerRef}
              className="px-4 h-[52vh] overflow-y-auto space-y-3"
            >
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
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${bubbleBase}`}
                    >
                      {!isUser && msg.format === "summary" && msg.payload ? (
                        <div>
                          <div className="font-semibold mb-1">
                            Monthly Summary
                          </div>
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
                      ) : !isUser &&
                        msg.format === "investable" &&
                        msg.payload ? (
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
                      ) : !isUser &&
                        msg.format === "cashflow" &&
                        msg.payload ? (
                        <div>
                          <div className="font-semibold mb-1">
                            Recent Cashflow
                          </div>
                          <div className="text-sm font-bold mb-2">
                            ₹
                            {Math.round(
                              msg.payload.last?.savings || 0,
                            ).toLocaleString("en-IN")}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {(msg.payload.series || [])
                              .slice(-4)
                              .map((p, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between gap-2"
                                >
                                  <span className="text-gray-500">
                                    {p.period}
                                  </span>
                                  <span className="font-semibold">
                                    ₹
                                    {Math.round(p.savings).toLocaleString(
                                      "en-IN",
                                    )}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : !isUser &&
                        msg.format === "overspent" &&
                        msg.payload ? (
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
                            <div className="text-xs">
                              No categories overspent.
                            </div>
                          )}
                        </div>
                      ) : !isUser && msg.format === "goals" && msg.payload ? (
                        <div>
                          <div className="font-semibold mb-1">Goals Status</div>
                          <div className="space-y-2 text-xs">
                            {(msg.payload.items || [])
                              .slice(0, 5)
                              .map((g, i) => (
                                <div
                                  key={i}
                                  className="p-2 bg-white rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold">
                                      {g.name}
                                    </div>
                                    <div
                                      className={`text-xs ${g.status === "On Track" ? "text-green-600" : "text-gray-600"}`}
                                    >
                                      {g.status || "—"}
                                    </div>
                                  </div>
                                  <div className="text-gray-500 mt-1">
                                    {g.progressPct}% • Plan ₹
                                    {Math.round(g.plan).toLocaleString("en-IN")}{" "}
                                    • Actual ₹
                                    {Math.round(g.actual).toLocaleString(
                                      "en-IN",
                                    )}
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
                            {(msg.payload.items || [])
                              .slice(0, 10)
                              .map((t, i) => (
                                <div
                                  key={i}
                                  className="p-2 bg-white rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <div
                                      className={`font-semibold ${t.type === "income" ? "text-green-700" : "text-red-700"}`}
                                    >
                                      ₹
                                      {Math.round(t.amount).toLocaleString(
                                        "en-IN",
                                      )}
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
                        <div>{msg.content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask about budgets, goals, cashflow, investments…"
                  rows={2}
                  aria-label="Chat message"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              <div className="mt-2 flex justify-between">
                <button
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    setMessages([
                      {
                        role: "system",
                        content:
                          "Ask finance/data questions about your budgets, transactions, goals, investments, and taxes.",
                      },
                    ])
                  }
                >
                  Clear
                </button>
                <div className="text-xs text-gray-400">
                  Finance/data questions only
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
