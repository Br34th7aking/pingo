import { Routes, Route, Navigate, Link } from "react-router";
import { useAuth } from "./contexts/AuthContext";
import { UIProvider } from "./contexts/UIContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ServerProvider } from "./contexts/ServerContext";
import { ChatProvider } from "./contexts/ChatContext";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import ServerDiscovery from "./components/server/ServerDiscovery";

// Simple redirect component based on auth status
function AuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/chat" : "/login"} replace />;
}

function App() {
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

              <Route
                path="/discover"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-base-100">
                      <div className="navbar bg-base-200 border-b border-base-content/10">
                        <div className="navbar-start">
                          <Link to="/chat" className="btn btn-ghost">
                            ← Back to Chat
                          </Link>
                        </div>
                        <div className="navbar-center">
                          <span className="text-xl font-bold">Pingo</span>
                        </div>
                        <div className="navbar-end">
                          {/* User can go to settings or profile */}
                        </div>
                      </div>
                      <ServerDiscovery />
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Settings route placeholder */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-base-100 flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-3xl font-bold mb-4">Settings</h1>
                        <p className="text-base-content/70 mb-4">
                          Settings page coming soon!
                        </p>
                        <Link to="/chat" className="btn btn-primary">
                          Back to Chat
                        </Link>
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />

              {/* Root redirect based on auth status */}
              <Route path="/" element={<AuthRedirect />} />

              {/* Catch all - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ChatProvider>
        </ServerProvider>
      </AuthProvider>
    </UIProvider>
  );
}

export default App;
