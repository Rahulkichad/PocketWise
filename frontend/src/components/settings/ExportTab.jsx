import React, { useState } from "react";
import api from "../../api/client";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { Download, FileText, Calendar, Database } from "lucide-react";
import { motion } from "framer-motion";

export default function ExportTab() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format, range = "all") => {
    setExporting(true);
    try {
      const { data } = await api.get("/transactions", {
        params: { limit: 10000, ...(range !== "all" && { range }) },
      });

      if (format === "csv") {
        exportToCSV(data);
      } else if (format === "json") {
        exportToJSON(data);
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = (transactions) => {
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Description",
      "Category",
      "Account",
    ];
    const rows = transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.type,
      tx.amount,
      tx.description || tx.merchant || "",
      tx.category || "",
      tx.accountId?.name || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    downloadFile(csv, "transactions.csv", "text/csv");
  };

  const exportToJSON = (transactions) => {
    const json = JSON.stringify(transactions, null, 2);
    downloadFile(json, "transactions.json", "application/json");
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Export Data</h2>
        <p className="text-sm text-gray-500 mt-1">
          Download your financial data in various formats
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">CSV Export</h3>
                <p className="text-sm text-gray-500">
                  Spreadsheet compatible format
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">JSON Export</h3>
                <p className="text-sm text-gray-500">Machine-readable format</p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {exporting ? "Exporting..." : "Export JSON"}
            </Button>
          </Card>
        </motion.div>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Export Options</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700">Date Range</span>
            </div>
            <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm">
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
}
