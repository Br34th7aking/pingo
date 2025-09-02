import { Routes, Route, Navigate } from "react-router";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ServerProvider } from "./contexts/ServerContext";
import { UIProvider } from "./contexts/UIContext";

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <ServerProvider>
          <ChatProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />

              {/* Default Route - Redirect based on auth status */}
              <Route path="/" element={<AuthRedirect />} />

              {/* Catch-all Route - 404 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ChatProvider>
        </ServerProvider>
      </AuthProvider>
    </UIProvider>
  );
}

// Helper component to handle default route redirection
function AuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <Navigate to="/chat" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}
