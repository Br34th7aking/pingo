import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function UserProfile({ showDropdown = true, compact = false }) {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    if (showDropdown) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // Get user initials for avatar fallback
  const getInitials = (displayName) => {
    return displayName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2 p-2">
        {/* Avatar */}
        <div className="avatar">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-content text-center flex items-center justify-center text-xs font-semibold">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.display_name}
                className="rounded-full"
              />
            ) : (
              getInitials(user.display_name)
            )}
          </div>
        </div>

        {/* Display Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-base-content truncate">
            {user.display_name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dropdown dropdown-top ${
        isDropdownOpen ? "dropdown-open" : ""
      }`}
    >
      {/* User Info Trigger */}
      <div
        tabIndex={0}
        onClick={toggleDropdown}
        className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
          showDropdown ? "hover:bg-base-300 cursor-pointer" : ""
        }`}
      >
        {/* Avatar */}
        <div className="avatar">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center text-center font-semibold">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.display_name}
                className="rounded-full"
              />
            ) : (
              getInitials(user.display_name)
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-base-content truncate">
            {user.display_name}
          </p>
          <p className="text-xs text-base-content/70 truncate">{user.email}</p>
        </div>

        {/* Dropdown Arrow */}
        {showDropdown && (
          <div className="flex-shrink-0">
            <svg
              className={`w-4 h-4 text-base-content/50 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <ul className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
          {/* User Status */}
          <li className="menu-title">
            <span className="text-xs">Status</span>
          </li>
          <li>
            <button className="justify-between">
              <span className="flex items-center">
                <span className="w-2 h-2 bg-success rounded-full mr-2"></span>
                Online
              </span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </li>

          <div className="divider my-1"></div>

          {/* Settings */}
          <li>
            <button className="justify-between">
              <span className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </span>
            </button>
          </li>

          <div className="divider my-1"></div>

          {/* Logout */}
          <li>
            <button
              onClick={handleLogout}
              className="text-error hover:bg-error hover:text-error-content"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
