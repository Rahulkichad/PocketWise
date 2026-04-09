import React from "react";
import Card from "./ui/Card";
import AnimatedNumber from "./AnimatedNumber";
import { formatINR } from "../lib/format";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

export default function MetricCard({
  title,
  value,
  change,
  sparklineData = [],
  color = "#3b82f6",
  icon: Icon,
}) {
  const changeVal = typeof change === "number" ? change : Number(change || 0);
  const isPositive = changeVal >= 0;
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const changeIcon = isPositive ? "↑" : "↓";

  return (
    <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
      {/* Gradient background on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
        style={{
          background: `linear-gradient(to bottom right, ${color}15, transparent)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-600 mb-1">
              {title}
            </div>
            <div className="text-3xl font-bold text-gray-900">
              <AnimatedNumber value={value} />
            </div>
          </div>
          {Icon && (
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          )}
        </div>

        {change !== undefined && change !== null && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${changeColor} mt-2`}
          >
            <span>{changeIcon}</span>
            <span>{Math.abs(changeVal).toFixed(2)}%</span>
            <span className="text-gray-500 text-xs ml-1">vs last period</span>
          </div>
        )}

        {/* Mini sparkline */}
        {sparklineData.length > 0 && (
          <div className="mt-4 h-12 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sparklineData}
                margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
              >
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    fontSize: "12px",
                  }}
                  formatter={(v) => formatINR(v)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
