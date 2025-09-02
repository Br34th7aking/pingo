import RegisterForm from "../components/ui/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-primary mb-2">Pingo</h1>
          <p className="text-lg text-base-content/70">Join the conversation</p>
        </div>

        {/* Register Form */}
        <RegisterForm />

        {/* Additional Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-base-content/50">
            Already have an account?{" "}
            <a href="/login" className="link link-primary">
              Sign in instead
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
