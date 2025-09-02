import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router";

export default function LoginForm() {
  const { login, testLogin, isLoading, error, isAuthenticated, clearError } =
    useAuth();
  const [showTestLogin, setShowTestLogin] = useState(true); // Remove in production

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Clear errors when component mounts or form changes
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000); // Auto-clear after 5s
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password);

    if (!result.success) {
      // Form will show the error from context
      // Optionally reset password field
      reset({ email: data.email, password: "" });
    }
    // If successful, the ProtectedRoute will handle navigation
  };

  const handleTestLogin = () => {
    testLogin();
  };

  return (
    <div className="card w-full max-w-md shadow-xl bg-base-100">
      <div className="card-body">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Welcome</h1>
          <p className="text-base-content/70 mt-2">
            Sign in to your Pingo account
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
            <button className="btn btn-sm btn-ghost" onClick={clearError}>
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: "Please enter a valid email address",
                },
              })}
              type="email"
              placeholder="your.email@example.com"
              className={`input input-bordered w-full ${
                errors.email ? "input-error" : ""
              }`}
              disabled={isLoading || isSubmitting}
            />
            {errors.email && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.email.message}
                </span>
              </label>
            )}
          </div>

          {/* Password Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
              type="password"
              placeholder="Enter your password"
              className={`input input-bordered w-full ${
                errors.password ? "input-error" : ""
              }`}
              disabled={isLoading || isSubmitting}
            />
            {errors.password && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.password.message}
                </span>
              </label>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-control mt-6">
            <button
              type="submit"
              className={`btn btn-primary w-full ${
                isLoading || isSubmitting ? "loading" : ""
              }`}
              disabled={isLoading || isSubmitting}
            >
              {isLoading || isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </div>
        </form>

        {/* Development Test Login - Remove in production */}
        {showTestLogin && <div className="divider">Development Only</div>}

        {showTestLogin && (
          <button
            onClick={handleTestLogin}
            className="btn btn-outline btn-sm w-full"
            disabled={isLoading}
          >
            Test Login (Dev Mode)
          </button>
        )}

        {/* Register Link */}
        <div className="text-center mt-6">
          <span className="text-sm text-base-content/70">
            Don't have an account?{" "}
            <a href="/register" className="link link-primary">
              Sign up here
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
