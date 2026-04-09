import React, { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../ui/Card";
import Button from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import SubCategoryModal from "./SubCategoryModal";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GROUP_COLORS } from "../../lib/constants";
import { showToast } from "../Toast";

export default function CategoriesTab() {
  const [subcategories, setSubcategories] = useState({
    Needs: [],
    Wants: [],
    Savings: [],
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState(null);
  const [currentGroup, setCurrentGroup] = useState("Needs");

  useEffect(() => {
    loadSubcategories();
  }, []);

  const loadSubcategories = async () => {
    try {
      const groups = ["Needs", "Wants", "Savings"];
      const res = await Promise.all(
        groups.map((g) =>
          api.get("/subcategories", { params: { category: g } }),
        ),
      );
      const obj = {};
      groups.forEach((g, i) => {
        obj[g] = res[i].data?.items || [];
      });
      setSubcategories(obj);
    } catch (err) {
      console.error("Failed to load subcategories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCurrentGroup("Needs");
    setEditingSubCategory(null);
    setIsModalOpen(true);
  };

  const handleEdit = (sc) => {
    setEditingSubCategory(sc);
    setCurrentGroup(sc.category);
    setIsModalOpen(true);
  };

  const handleDeactivate = async (sc) => {
    if (!window.confirm(`Deactivate subcategory "${sc.name}"?`)) return;
    try {
      await api.put(`/subcategories/${sc._id}`, { isActive: false });
      await loadSubcategories();
    } catch (e) {
      alert("Failed to deactivate");
    }
  };

  const handleSave = async (form) => {
    try {
      if (editingSubCategory) {
        await api.put(`/subcategories/${editingSubCategory._id}`, {
          name: form.name,
        });
        showToast("Subcategory updated", "success");
      } else {
        await api.post("/subcategories", {
          name: form.name,
          category: form.category || currentGroup,
        });
        showToast("Subcategory created", "success");
      }
      await loadSubcategories();
      setIsModalOpen(false);
      setEditingSubCategory(null);
    } catch (err) {
      console.error("Failed to save subcategory:", err);
      const msg = err?.response?.data?.message || "Failed to save subcategory";
      showToast(msg, "error");
    }
  };

  const grouped = subcategories;

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
          <h2 className="text-2xl font-bold text-gray-900">Subcategories</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage subcategories under each system category
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Add Subcategory
        </Button>
      </div>

      {Object.values(grouped).every((v) => v.length === 0) ? (
        <Card className="p-12">
          <EmptyState
            title="No subcategories yet"
            description="Add your own subcategories under Needs, Wants, or Savings"
            action={
              <Button variant="primary" onClick={handleCreate}>
                <Plus size={18} className="mr-2" />
                Add Subcategory
              </Button>
            }
          />
        </Card>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <Card key={group} className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {group}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((sc) => (
                  <motion.div
                    key={sc._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor: `${GROUP_COLORS[group] || "#6b7280"}15`,
                          }}
                        >
                          <Tag
                            className="w-5 h-5"
                            style={{ color: GROUP_COLORS[group] || "#6b7280" }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">
                            {sc.name}
                          </div>
                          {sc.isSystem && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              System
                            </div>
                          )}
                        </div>
                      </div>
                      {!sc.isSystem && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(sc)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeactivate(sc)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        ))
      )}

      <SubCategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubCategory(null);
        }}
        onSave={handleSave}
        subCategory={editingSubCategory}
      />
    </div>
  );
}
