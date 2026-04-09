import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle } from "lucide-react";

let toastId = 0;
const toasts = [];
const listeners = new Set();

export function showToast(message, type = "error") {
  const id = toastId++;
  toasts.push({ id, message, type });
  listeners.forEach((fn) => fn([...toasts]));

  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index >= 0) {
      toasts.splice(index, 1);
      listeners.forEach((fn) => fn([...toasts]));
    }
  }, 5000);
}

export default function ToastContainer() {
  const [items, setItems] = React.useState([]);

  useEffect(() => {
    const update = (newItems) => setItems(newItems);
    listeners.add(update);
    return () => listeners.delete(update);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`p-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] ${
              toast.type === "error"
                ? "bg-red-50 border border-red-200"
                : "bg-green-50 border border-green-200"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            )}
            <span
              className={`flex-1 text-sm font-medium ${
                toast.type === "error" ? "text-red-700" : "text-green-700"
              }`}
            >
              {toast.message}
            </span>
            <button
              onClick={() => {
                const index = toasts.findIndex((t) => t.id === toast.id);
                if (index >= 0) {
                  toasts.splice(index, 1);
                  listeners.forEach((fn) => fn([...toasts]));
                }
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
