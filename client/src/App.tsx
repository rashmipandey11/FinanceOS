import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Nav } from "./components/Nav";
import { Login } from "./pages/Login";
import { InvoiceList } from "./pages/InvoiceList";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { NewInvoice } from "./pages/NewInvoice";
import { Dashboard } from "./pages/Dashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className="app-shell">
              <Nav />
              <Routes>
                <Route path="/" element={<Navigate to="/invoices" replace />} />
                <Route path="/invoices" element={<InvoiceList />} />
                <Route path="/invoices/new" element={<NewInvoice />} />
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/invoices" replace />} />
              </Routes>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
