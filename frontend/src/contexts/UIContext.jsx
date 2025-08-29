import { createContext, useContext, useReducer } from "react";
import { useEffect } from "react";
const initialState = {
  modals: {
    createServer: false,
    joinServer: false,
    createChannel: false,
    userSettings: false,
    serverSettings: false,
    userProfile: false,
  },
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: true,
  theme: "dark",
  compactMode: false,
  notifications: [],
  alerts: [],
  isLoadingUI: false,
  activeDropdown: null,
  searchQuery: "",
  isSearching: false,
  toasts: [],
  uiError: null,
};

function uiReducer(state, action) {
  switch (action.type) {
    case "OPEN_MODAL": {
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: true,
        },
      };
    }
    case "CLOSEMODAL": {
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: false,
        },
      };
    }
    case "CLOSE_ALL_MODALS": {
      const closedModals = {};
      Object.keys(state.modals).forEach((key) => {
        closedModals[key] = false;
      });
      return {
        ...state,
        modals: closedModals,
      };
    }
    case "TOGGLE_LEFT_SIDEBAR": {
      return {
        ...state,
        leftSidebarCollapsed: !state.leftSidebarCollapsed,
      };
    }
    case "TOGGLE_RIGHT_SIDEBAR": {
      return {
        ...state,
        rightSidebarCollapsed: !state.rightSidebarCollapsed,
      };
    }
    case "SET_THEME": {
      const theme = action.payload;
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme);
      }
      return {
        ...state,
        theme,
      };
    }
    case "TOGGLE_COMPACTMODE": {
      return {
        ...state,
        compactMode: !state.compactMode,
      };
    }
    case "ADD_NOTIFICATION": {
      const notification = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload,
      };
      return {
        ...state,
        notifications: [notification, ...state.notifications],
      };
    }

    case "REMOVE_NOTIFICATION": {
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload
        ),
      };
    }

    case "CLEAR_NOTIFICATIONS": {
      return {
        ...state,
        notifications: [],
      };
    }

    case "ADD_ALERT": {
      const alert = {
        id: Date.now(),
        autoClose: true,
        duration: 5000,
        ...action.payload,
      };
      return {
        ...state,
        alerts: [...state.alerts, alert],
      };
    }

    case "REMOVE_ALERT": {
      return {
        ...state,
        alerts: state.alerts.filter((a) => a.id !== action.payload),
      };
    }

    case "ADD_TOAST": {
      const toast = {
        id: Date.now(),
        duration: 3000,
        ...action.payload,
      };
      return {
        ...state,
        toasts: [...state.toasts, toast],
      };
    }

    case "REMOVE_TOAST": {
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    }

    case "SET_ACTIVE_DROPDOWN": {
      return {
        ...state,
        activeDropdown: action.payload,
      };
    }

    case "CLOSE_DROPDOWN": {
      return {
        ...state,
        activeDropdown: null,
      };
    }

    case "SET_SEARCH_QUERY": {
      return {
        ...state,
        searchQuery: action.payload,
      };
    }

    case "SET_SEARCHING": {
      return {
        ...state,
        isSearching: action.payload,
      };
    }

    case "SET_UI_LOADING": {
      return {
        ...state,
        isLoadingUI: action.payload,
      };
    }

    case "SET_UI_ERROR": {
      return {
        ...state,
        uiError: action.payload,
      };
    }

    case "RESET_UI": {
      return {
        ...initialState,
        theme: state.theme, // Preserve theme on reset
      };
    }

    default:
      return state;
  }
}

const UIContext = createContext();

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const openModal = (modalName) => {
    dispatch({ type: "OPEN_MODAL", payload: modalName });
  };
  const closeModal = (modalName) => {
    dispatch({ type: "CLOSE_MODAL", payload: modalName });
  };

  const closeAllModals = () => {
    dispatch({ type: "CLOSE_ALL_MODALS" });
  };

  // Theme helpers
  const setTheme = (theme) => {
    dispatch({ type: "SET_THEME", payload: theme });
    // Save to localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("pingo-theme", theme);
    }
  };

  const toggleCompactMode = () => {
    dispatch({ type: "TOGGLE_COMPACT_MODE" });
  };

  // Sidebar helpers
  const toggleLeftSidebar = () => {
    dispatch({ type: "TOGGLE_LEFT_SIDEBAR" });
  };

  const toggleRightSidebar = () => {
    dispatch({ type: "TOGGLE_RIGHT_SIDEBAR" });
  };

  // Notification helpers
  const addNotification = (notification) => {
    dispatch({ type: "ADD_NOTIFICATION", payload: notification });
  };

  const removeNotification = (id) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
  };
  const addAlert = (alert) => {
    const id = dispatch({ type: "ADD_ALERT", payload: alert });

    // Auto-remove alert if autoClose is true
    if (alert.autoClose !== false) {
      setTimeout(() => {
        dispatch({ type: "REMOVE_ALERT", payload: id });
      }, alert.duration || 5000);
    }
  };

  const addToast = (toast) => {
    const toastWithId = {
      id: Date.now(),
      duration: 3000,
      ...toast,
    };
    dispatch({ type: "ADD_TOAST", payload: toastWithId });

    // Auto-remove toast
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", payload: toastWithId.id });
    }, toastWithId.duration);
  };

  // Dropdown helpers
  const setActiveDropdown = (dropdown) => {
    dispatch({ type: "SET_ACTIVE_DROPDOWN", payload: dropdown });
  };

  const closeDropdown = () => {
    dispatch({ type: "CLOSE_DROPDOWN" });
  };

  // Search helpers
  const setSearchQuery = (query) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: query });
  };

  const setSearching = (isSearching) => {
    dispatch({ type: "SET_SEARCHING", payload: isSearching });
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const savedTheme = localStorage.getItem("pingo-theme");
      if (savedTheme && savedTheme !== state.theme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  return (
    <UIContext.Provider
      value={{
        ...state,
        dispatch,
        // Modal helpers
        openModal,
        closeModal,
        closeAllModals,
        // Theme helpers
        setTheme,
        toggleCompactMode,
        // Sidebar helpers
        toggleLeftSidebar,
        toggleRightSidebar,
        // Notification helpers
        addNotification,
        removeNotification,
        addAlert,
        addToast,
        // Dropdown helpers
        setActiveDropdown,
        closeDropdown,
        // Search helpers
        setSearchQuery,
        setSearching,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI can only be used within a UIProvider");
  }
  return context;
}
