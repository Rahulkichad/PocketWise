import React, { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../ui/Card";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import AccountModal from "./AccountModal";
import { Plus, Wallet, CreditCard, Building2, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACCOUNT_ICONS = {
  bank: Building2,
  card: CreditCard,
  wallet: Wallet,
  cash: Banknote,
  loan: CreditCard,
  investment: Wallet,
  other: Wallet,
};

export default function AccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await api.get("/accounts");
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Delete account "${account.name}"?`)) return;
    try {
      const id = account._id || account.id;
      await api.delete(`/accounts/${id}`);
      await loadAccounts();
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert(err?.response?.data?.message || "Failed to delete account");
    }
  };

  const handleSave = async (accountData) => {
    try {
      if (editingAccount) {
        const id = editingAccount._id || editingAccount.id;
        await api.put(`/accounts/${id}`, accountData);
      } else {
        await api.post("/accounts", accountData);
      }
      setIsModalOpen(false);
      setEditingAccount(null);
      await loadAccounts();
    } catch (err) {
      console.error("Failed to save account:", err);
      alert(err?.response?.data?.message || "Failed to save account");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 h-24 pw-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accounts</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your bank accounts, cards, and wallets
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          New Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            title="No accounts yet"
            description="Add your accounts to track transactions"
            action={
              <Button variant="primary" onClick={handleCreate}>
                <Plus size={18} className="mr-2" />
                Add Account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {accounts.map((account) => {
              const Icon = ACCOUNT_ICONS[account.type] || Wallet;
              return (
                <motion.div
                  key={account._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="p-6 hover:shadow-xl transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {account.name}
                          </h3>
                          <p className="text-xs text-gray-500 capitalize">
                            {account.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(account)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {account.institution && (
                      <p className="text-sm text-gray-600">
                        {account.institution}
                      </p>
                    )}
                    {account.last4 && (
                      <p className="text-xs text-gray-500 mt-1">
                        ****{account.last4}
                      </p>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={handleSave}
        account={editingAccount}
      />
    </div>
  );
}
