import { createContext, useContext, useReducer, useEffect } from "react";

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with true for initial token check
  token: null,
  refreshToken: null,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case "LOGIN_START":
    case "REGISTER_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case "LOGIN_SUCCESS":
    case "REGISTER_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case "LOGIN_ERROR":
    case "REGISTER_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
      };

    case "LOGOUT":
      return {
        ...initialState,
        isLoading: false, // Don't show loading after logout
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "TOKEN_REFRESH_SUCCESS":
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken || state.refreshToken, // Keep existing if not provided
        user: action.payload.user || state.user, // Keep existing user if not provided
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    case "INITIALIZE_AUTH":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: action.payload.isAuthenticated,
        isLoading: false,
      };

    default:
      return state;
  }
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem("pingo_token");
        const userData = localStorage.getItem("pingo_user");
        const refreshToken = localStorage.getItem("pingo_refresh_token");

        if (token && userData) {
          const user = JSON.parse(userData);
          dispatch({
            type: "INITIALIZE_AUTH",
            payload: { user, token, refreshToken, isAuthenticated: true },
          });

          // Validate token with backend (optional - can be implemented later)
          // validateToken(token);
        } else {
          dispatch({
            type: "INITIALIZE_AUTH",
            payload: {
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
            },
          });
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        // Clear potentially corrupted data
        clearAuthData();
        dispatch({
          type: "INITIALIZE_AUTH",
          payload: {
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
          },
        });
      }
    };

    initializeAuth();
  }, []);

  // Helper function to store auth data
  const storeAuthData = (user, token, refreshToken = null) => {
    console.log("User", user, token, refreshToken);
    localStorage.setItem("pingo_token", token);
    localStorage.setItem("pingo_user", JSON.stringify(user));
    if (refreshToken) {
      localStorage.setItem("pingo_refresh_token", refreshToken);
    }
    console.log("Stored auth data:", { user, token, refreshToken }); // Debug
  };

  // Helper function to clear auth data
  const clearAuthData = () => {
    localStorage.removeItem("pingo_token");
    localStorage.removeItem("pingo_user");
    localStorage.removeItem("pingo_refresh_token");
  };

  const login = async (email, password) => {
    dispatch({ type: "LOGIN_START" });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/login/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      console.log("Login response:", data); // Debug: Check what backend actually returns

      if (!response.ok) {
        throw new Error(data.message || data.detail || "Login failed");
      }

      // Check different possible token field names from Django
      const token = data.token || data.access_token || data.access || data.key;
      const refreshToken = data.refresh_token || data.refresh;
      const user = data.user;

      if (!token) {
        console.error("No token found in response:", data);
        throw new Error("No authentication token received");
      }

      // Store in localStorage (including refresh token)
      storeAuthData(user, token, refreshToken);

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user, token, refreshToken },
      });

      return { success: true, data: { user, token, refreshToken } };
    } catch (error) {
      console.error("Login error:", error);
      dispatch({
        type: "LOGIN_ERROR",
        payload: error.message || "Login failed",
      });
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    dispatch({ type: "REGISTER_START" });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/register/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        }
      );

      const data = await response.json();

      console.log("Registration response:", data); // Debug: Check what backend actually returns

      if (!response.ok) {
        throw new Error(data.message || data.detail || "Registration failed");
      }

      // Check different possible token field names from Django
      const token = data.token || data.access_token || data.access || data.key;
      const refreshToken = data.refresh_token || data.refresh;
      const user = data.user;

      if (!token) {
        console.error("No token found in response:", data);
        throw new Error("No authentication token received");
      }

      // Store in localStorage (including refresh token)
      storeAuthData(user, token, refreshToken);

      dispatch({
        type: "REGISTER_SUCCESS",
        payload: { user, token, refreshToken },
      });

      return { success: true, data: { user, token, refreshToken } };
    } catch (error) {
      console.error("Registration error:", error);
      dispatch({
        type: "REGISTER_ERROR",
        payload: error.message || "Registration failed",
      });
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    clearAuthData();
    dispatch({ type: "LOGOUT" });
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  // Token refresh function (can be called manually or automatically)
  const refreshToken = async () => {
    if (!state.refreshToken) {
      console.log("No refresh token available");
      return { success: false };
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/token/refresh/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.refreshToken}`, // Use refresh token
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh: state.refreshToken, // Some Django setups expect this in body
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      // Handle different response formats
      const newToken = data.access || data.token || data.access_token;
      const newRefreshToken =
        data.refresh || data.refresh_token || state.refreshToken;

      if (!newToken) {
        throw new Error("No new token received from refresh");
      }

      // Update stored tokens
      storeAuthData(state.user, newToken, newRefreshToken);

      dispatch({
        type: "TOKEN_REFRESH_SUCCESS",
        payload: {
          user: data.user,
          token: newToken,
          refreshToken: newRefreshToken,
        },
      });

      return { success: true, token: newToken };
    } catch (error) {
      console.error("Token refresh failed:", error);
      // If refresh fails, logout user
      logout();
      return { success: false, error: error.message };
    }
  };

  // Automatic token refresh for API calls
  const makeAuthenticatedRequest = async (url, options = {}) => {
    if (!state.token) {
      throw new Error("No authentication token available");
    }

    // Build headers conditionally - don't set Content-Type for FormData
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${state.token}`,
    };

    // Only set Content-Type for non-FormData requests
    if (!options.body || !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    // First attempt with current token
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If token expired (401), try to refresh and retry
    if (response.status === 401 && state.refreshToken) {
      console.log("Token expired, attempting refresh...");

      const refreshResult = await refreshToken();

      if (refreshResult.success) {
        // Build headers for retry - same logic
        const retryHeaders = {
          ...options.headers,
          Authorization: `Bearer ${refreshResult.token}`,
        };

        if (!options.body || !(options.body instanceof FormData)) {
          retryHeaders["Content-Type"] = "application/json";
        }

        // Retry the original request with new token
        return fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      } else {
        throw new Error("Authentication failed");
      }
    }

    return response;
  };

  // Helper function to check if token is expired (based on JWT exp claim)
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      console.error("Error parsing token:", error);
      return true;
    }
  };

  // Test login function (for development)
  const testLogin = () => {
    const testUser = {
      id: 1,
      email: "test@example.com",
      display_name: "Test User",
      avatar: null,
      bio: "",
      phone: "",
    };
    const testToken = "fake-jwt-token-" + Date.now();
    const testRefreshToken = "fake-refresh-token-" + Date.now();

    storeAuthData(testUser, testToken, testRefreshToken);
    dispatch({
      type: "LOGIN_SUCCESS",
      payload: {
        user: testUser,
        token: testToken,
        refreshToken: testRefreshToken,
      },
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        dispatch,
        login,
        register,
        logout,
        clearError,
        refreshToken,
        makeAuthenticatedRequest,
        isTokenExpired,
        testLogin, // Remove this in production
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
