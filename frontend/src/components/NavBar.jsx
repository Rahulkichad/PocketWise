import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Plus } from "lucide-react";

export default function NavBar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const active = (p) =>
    loc.pathname.startsWith(p)
      ? "text-primary font-semibold"
      : "text-muted hover:text-ink";

  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/70 pw-nav-gradient">
      <div className="container flex items-center justify-between px-4 py-3">
        <Link
          to={user ? "/dashboard" : "/"}
          className="text-xl font-bold text-primary"
        >
          PocketWise
        </Link>
        {user ? (
          <nav className="flex gap-4 items-center">
            <Link to="/dashboard" className={active("/dashboard")}>
              Dashboard
            </Link>
            <Link to="/transactions" className={active("/transactions")}>
              Transactions
            </Link>
            <Link to="/budgets" className={active("/budgets")}>
              Budgets
            </Link>
            <Link to="/goals" className={active("/goals")}>
              Goals
            </Link>
            <Link to="/investments" className={active("/investments")}>
              Investments
            </Link>
            <Link to="/protection" className={active("/protection")}>
              Protection
            </Link>
            <Link to="/reports" className={active("/reports")}>
              Reports
            </Link>
            <Link to="/chat" className={active("/chat")}>
              Chat
            </Link>
            <Link to="/settings" className={active("/settings")}>
              Settings
            </Link>
            {user.role === "admin" && (
              <Link to="/admin" className={active("/admin")}>
                Admin
              </Link>
            )}
            <Link to="/transactions" className="pw-btn pw-btn-primary ml-2">
              <Plus size={16} className="mr-1" />
              Add
            </Link>
            <button onClick={logout} className="pw-btn pw-btn-ghost ml-2">
              Logout
            </button>
          </nav>
        ) : (
          <nav className="flex gap-3">
            <Link to="/login" className="text-muted hover:text-ink">
              Login
            </Link>
            <Link to="/register" className="text-primary">
              Register
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
