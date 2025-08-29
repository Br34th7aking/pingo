import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, isAuthenticated, login } = useAuth();

  const handleTestLogin = () => {
    login(
      { id: 1, email: "test@example.com", username: "TestUser" },
      "fake-jwt-token"
    );
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold text-primary">Pingo</h1>
          <p className="py-6">Your Discord-like chat experience</p>

          {/* Test the context */}
          {isAuthenticated ? (
            <div>
              <p className="mb-4">Welcome, {user.username}!</p>
              <Link to="/chat" className="btn btn-primary">
                Enter Chat
              </Link>
            </div>
          ) : (
            <div>
              <button
                onClick={handleTestLogin}
                className="btn btn-primary mr-4"
              >
                Test Login
              </button>
              <Link to="/chat" className="btn btn-outline">
                Enter as Guest
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
