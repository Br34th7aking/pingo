import LoginForm from "../components/ui/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-primary mb-2">Pingo</h1>
          <p className="text-lg text-base-content/70">
            Your Discord-like chat experience
          </p>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Additional Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-base-content/50">
            By signing in, you agree to our{" "}
            <a href="/terms" className="link link-primary text-xs">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="link link-primary text-xs">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
