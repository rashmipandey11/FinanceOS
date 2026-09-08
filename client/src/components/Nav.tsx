import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="nav">
      <span className="nav-brand">FinanceOS</span>
      <div className="nav-links">
        <NavLink to="/invoices" className={({ isActive }) => (isActive ? "active" : "")}>
          Invoices
        </NavLink>
        <NavLink to="/invoices/new" className={({ isActive }) => (isActive ? "active" : "")}>
          New Invoice
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
      </div>
      {user && <span className="nav-user">{user.email}</span>}
      <button className="logout-btn" onClick={handleLogout}>
        Log out
      </button>
    </nav>
  );
}
