import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import RuleModal from "./RuleModal";
import { Plus, Zap, ToggleLeft, ToggleRight } from "lucide-react";
import { motion } from "framer-motion";

export default function RulesTab() {
  const [rules, setRules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const handleCreate = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleToggle = (rule) => {
    setRules(
      rules.map((r) =>
        r._id === rule._id ? { ...r, isActive: !r.isActive } : r,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automation Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create rules to automatically categorize and tag transactions
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            title="No rules yet"
            description="Create automation rules to automatically categorize transactions"
            action={
              <Button variant="primary" onClick={handleCreate}>
                <Plus size={18} className="mr-2" />
                Create Rule
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <motion.div
              key={rule._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Rule</h3>
                      <p className="text-xs text-gray-500">
                        {rule.if?.merchantContains ||
                          rule.if?.descriptionContains ||
                          "Custom rule"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(rule)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {rule.isActive ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <strong>If:</strong>{" "}
                    {rule.if?.merchantContains ||
                      rule.if?.descriptionContains ||
                      "Condition"}
                  </div>
                  <div>
                    <strong>Then:</strong> Set category, add tags, etc.
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <RuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        onSave={(rule) => {
          if (editingRule) {
            setRules(rules.map((r) => (r._id === editingRule._id ? rule : r)));
          } else {
            setRules([...rules, { ...rule, _id: Date.now() }]);
          }
          setIsModalOpen(false);
        }}
        rule={editingRule}
      />
    </div>
  );
}
