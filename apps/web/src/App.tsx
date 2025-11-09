import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "@trace/core";
import { LoginPage } from "./modules/auth/pages/LoginPage";
import { Layout } from "./components/layout/Layout";
import { CapturePage } from "./pages/CapturePage";
import { InboxPage } from "./pages/InboxPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CalendarPage } from "./pages/CalendarPage";
import { TasksPage } from "./pages/TasksPage";
import { SettingsPage } from "./pages/SettingsPage";

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuthState();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/capture" replace />} />
        <Route path="capture" element={<CapturePage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ProtectedRoutes />
    </BrowserRouter>
  );
}

export default App;
