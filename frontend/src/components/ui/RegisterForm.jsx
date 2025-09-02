import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router";

export default function RegisterForm() {
  const {
    register: registerUser,
    isLoading,
    error,
    isAuthenticated,
    clearError,
  } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm({
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  // Watch password for confirmation validation
  const password = watch("password");

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
    // Prepare data to match Django serializer structure
    const userData = {
      email: data.email,
      password: data.password,
      password_confirm: data.confirmPassword, // Django expects password_confirm
      display_name: data.display_name,
      phone: "", // Optional field, can be empty
      bio: "", // Optional field, can be empty
    };

    const result = await registerUser(userData);

    if (!result.success) {
      // Form will show the error from context
      // Reset password fields
      reset({
        display_name: data.display_name,
        email: data.email,
        password: "",
        confirmPassword: "",
        acceptTerms: data.acceptTerms,
      });
    }
    // If successful, the ProtectedRoute will handle navigation
  };

  return (
    <div className="card w-full max-w-md shadow-xl bg-base-100">
      <div className="card-body">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Join Pingo</h1>
          <p className="text-base-content/70 mt-2">
            Create your account to get started
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
          {/* Display Name Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Display Name</span>
            </label>
            <input
              {...register("display_name", {
                required: "Display name is required",
                minLength: {
                  value: 2,
                  message: "Display name must be at least 2 characters",
                },
                maxLength: {
                  value: 50,
                  message: "Display name must be less than 50 characters",
                },
              })}
              type="text"
              placeholder="How you'll appear to others"
              className={`input input-bordered w-full ${
                errors.display_name ? "input-error" : ""
              }`}
              disabled={isLoading || isSubmitting}
            />
            {errors.display_name && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.display_name.message}
                </span>
              </label>
            )}
          </div>

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
                  value: 8,
                  message: "Password must be at least 8 characters",
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message:
                    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
                },
              })}
              type="password"
              placeholder="Create a strong password"
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

          {/* Confirm Password Field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Confirm Password</span>
            </label>
            <input
              {...register("confirmPassword", {
                required: "Please confirm your password",
                validate: (value) =>
                  value === password || "Passwords do not match",
              })}
              type="password"
              placeholder="Confirm your password"
              className={`input input-bordered w-full ${
                errors.confirmPassword ? "input-error" : ""
              }`}
              disabled={isLoading || isSubmitting}
            />
            {errors.confirmPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.confirmPassword.message}
                </span>
              </label>
            )}
          </div>

          {/* Terms and Privacy */}
          <div className="form-control">
            <label className="label cursor-pointer">
              <input
                {...register("acceptTerms", {
                  validate: (value) =>
                    value === true ||
                    "You must accept the terms and privacy policy",
                })}
                type="checkbox"
                className="checkbox checkbox-primary"
                disabled={isLoading || isSubmitting}
              />
              <span className="label-text text-sm ml-3">
                I agree to the{" "}
                <a href="/terms" className="link link-primary">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="link link-primary">
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.acceptTerms && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.acceptTerms.message}
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
              {isLoading || isSubmitting
                ? "Creating Account..."
                : "Create Account"}
            </button>
          </div>
        </form>

        {/* Login Link */}
        <div className="text-center mt-6">
          <span className="text-sm text-base-content/70">
            Already have an account?{" "}
            <a href="/login" className="link link-primary">
              Sign in here
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
