import React, { useState, useEffect } from "react";
import Page from "../components/ui/Page";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  FolderTree,
  Zap,
  Wallet,
  Download,
  User,
  Plus,
  Edit2,
  Trash2,
  Settings as SettingsIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CategoriesTab from "../components/settings/CategoriesTab";
import RulesTab from "../components/settings/RulesTab";
import AccountsTab from "../components/settings/AccountsTab";
import ExportTab from "../components/settings/ExportTab";
import ProfileTab from "../components/settings/ProfileTab";

const TABS = [
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "rules", label: "Rules", icon: Zap },
  { id: "accounts", label: "Accounts", icon: Wallet },
  { id: "export", label: "Export", icon: Download },
  { id: "profile", label: "Profile", icon: User },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("categories");

  return (
    <Page
      title="Settings"
      subtitle="Control center for your financial preferences"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <Card className="p-2">
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "categories" && <CategoriesTab />}
              {activeTab === "rules" && <RulesTab />}
              {activeTab === "accounts" && <AccountsTab />}
              {activeTab === "export" && <ExportTab />}
              {activeTab === "profile" && <ProfileTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}
