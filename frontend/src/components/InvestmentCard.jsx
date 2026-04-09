import React from "react";
import Card from "./ui/Card";
import { formatINR } from "../lib/format";
import { TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const INSTRUMENT_CONFIG = {
  SIP: {
    color: "#3b82f6",
    expectedReturn: 12, // 12% annual
    risk: "High",
    riskColor: "red",
    icon: TrendingUp,
  },
  PPF: {
    color: "#22c55e",
    expectedReturn: 7.1, // 7.1% annual
    risk: "Low",
    riskColor: "green",
    icon: Shield,
  },
  NPS: {
    color: "#f59e0b",
    expectedReturn: 9, // 9% annual
    risk: "Moderate",
    riskColor: "yellow",
    icon: TrendingUp,
  },
  ELSS: {
    color: "#8b5cf6",
    expectedReturn: 14, // 14% annual
    risk: "High",
    riskColor: "red",
    icon: AlertTriangle,
  },
};

export default function InvestmentCard({ instrument, onClick, showWhy, onToggleWhy, whyContent }) {
  const config = INSTRUMENT_CONFIG[instrument.type] || INSTRUMENT_CONFIG.SIP;
  const Icon = config.icon;
  const monthlyAmount = instrument.monthlyAmount || 0;
  const annualAmount = monthlyAmount * 12;
  const expectedReturn = (annualAmount * config.expectedReturn) / 100;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card
        className="p-6 hover:shadow-xl transition-all duration-300 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {instrument.type}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {instrument.rationale || "Investment instrument"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Monthly Amount */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Monthly Investment</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatINR(monthlyAmount)}
            </div>
          </div>

          {/* Expected Return */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-xs text-gray-500">
                Expected Annual Return
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatINR(expectedReturn)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Rate</div>
              <div
                className="text-sm font-semibold"
                style={{ color: config.color }}
              >
                {config.expectedReturn}%
              </div>
            </div>
          </div>

          {/* Risk Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                config.riskColor === "red"
                  ? "bg-red-100 text-red-700"
                  : config.riskColor === "yellow"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {config.risk} Risk
            </span>
            <span className="text-xs text-gray-500">
              Annual: {formatINR(annualAmount)}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWhy?.();
              }}
            >
              {showWhy ? "Hide explanation" : "Why this?"}
            </button>
            {showWhy && (
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {whyContent}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
