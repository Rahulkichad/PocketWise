import React, { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user]);

  const retrain = async () => {
    setMsg("");
    try {
      const { data } = await api.post("/admin/retrain");
      setMsg(data.message || "Retraining triggered");
    } catch (e) {
      setMsg("Failed to trigger retraining");
    }
  };

  if (user?.role !== "admin") {
    return <div className="p-6">You do not have access to this page.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Panel</h1>
        <button
          onClick={retrain}
          className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
        >
          Retrain Model (mock)
        </button>
      </div>
      {msg && (
        <div className="bg-green-50 text-green-700 p-2 rounded">{msg}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-2 rounded">{error}</div>
      )}

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Users</h2>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Monthly Income</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b last:border-0">
                    <td className="py-2">{u.name}</td>
                    <td>{u.email}</td>
                    <td className="capitalize">{u.role}</td>
                    <td>
                      ₹ {u.profile?.monthlyIncome?.toLocaleString("en-IN") || 0}
                    </td>
                    <td>{u.profile?.riskProfile || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
