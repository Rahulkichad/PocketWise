import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
