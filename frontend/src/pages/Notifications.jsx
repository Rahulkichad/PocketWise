import React, { useEffect, useState } from "react";
import api from "../api/client";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setItems(data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    await load();
  };

  const triggerMonthly = async () => {
    const { data } = await api.post("/finance/notify-monthly");
    setMsg("Monthly recommendation notification generated");
    await load();
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button
          onClick={triggerMonthly}
          className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
        >
          Generate Monthly Update
        </button>
      </div>
      {msg && (
        <div className="bg-green-50 text-green-700 p-2 rounded my-3">{msg}</div>
      )}
      {loading ? (
        <div className="py-4">Loading...</div>
      ) : items.length === 0 ? (
        <div className="py-4 text-gray-600">No notifications</div>
      ) : (
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n._id} className="py-3 flex items-center justify-between">
              <div>
                <div className={n.read ? "text-gray-600" : "font-semibold"}>
                  {n.message}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n._id)}
                  className="text-sm text-primary-600"
                >
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
