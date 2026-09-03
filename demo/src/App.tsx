import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { readSession } from "./auth";
import { AdminLayout } from "./layout/AdminLayout";
import { InquiryListPage } from "./pages/InquiryListPage";
import { InquiryDetailPage } from "./pages/InquiryDetailPage";
import { CustomerDetailPage, CustomerListPage } from "./pages/CustomerPages";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/KnowledgeLogsPages";
import { OpsDashboardPage } from "./pages/OpsDashboardPage";
import { AiConfigPage } from "./pages/AiConfigPage";
import { AiAssistantPage } from "./pages/AiAssistantPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";

function RequireAuth() {
  const location = useLocation();
  const user = readSession();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<OpsDashboardPage />} />
          <Route path="/ai-assistant" element={<AiAssistantPage />} />
          <Route path="/inquiries" element={<InquiryListPage />} />
          <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/ai-config" element={<AiConfigPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
