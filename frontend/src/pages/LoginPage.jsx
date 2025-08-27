import { Link } from "react-router";
export default function LoginPage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold text-primary">Pingo</h1>
          <p className="py-6">Your Discord-like chat experience</p>
          <Link to="/chat" className="btn btn-primary">
            Enter Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
