import { createContext, useContext, useReducer, useCallback } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost/api";

const initialState = {
  servers: [],
  publicServers: [], // For discovery
  activeServerId: null,
  channels: {},
  members: {},
  permissions: {},
  isLoadingServers: false,
  isLoadingChannels: false,
  isLoadingPublicServers: false,
  error: null,
};

function serverReducer(state, action) {
  switch (action.type) {
    case "SET_SERVERS": {
      return {
        ...state,
        servers: action.payload,
        isLoadingServers: false,
        error: null,
      };
    }

    case "SET_PUBLIC_SERVERS": {
      return {
        ...state,
        publicServers: action.payload,
        isLoadingPublicServers: false,
        error: null,
      };
    }

    case "SET_ACTIVE_SERVER": {
      const serverId = action.payload;
      return {
        ...state,
        activeServerId: serverId,
        error: null,
      };
    }

    case "ADD_SERVER": {
      const newServer = action.payload;
      return {
        ...state,
        servers: [...state.servers, newServer],
      };
    }

    case "UPDATE_SERVER": {
      const updatedServer = action.payload;
      return {
        ...state,
        servers: state.servers.map((server) =>
          server.id === updatedServer.id
            ? { ...server, ...updatedServer }
            : server
        ),
        publicServers: state.publicServers.map((server) =>
          server.id === updatedServer.id
            ? { ...server, ...updatedServer }
            : server
        ),
      };
    }

    case "REMOVE_SERVER": {
      const serverId = action.payload;
      const newState = {
        ...state,
        servers: state.servers.filter((server) => server.id !== serverId),
        channels: { ...state.channels },
        members: { ...state.members },
        permissions: { ...state.permissions },
      };
      delete newState.channels[serverId];
      delete newState.members[serverId];
      delete newState.permissions[serverId];

      if (state.activeServerId === serverId) {
        newState.activeServerId = null;
      }
      return newState;
    }

    case "SET_CHANNELS": {
      const { serverId, channels } = action.payload;
      return {
        ...state,
        channels: {
          ...state.channels,
          [serverId]: channels,
        },
        isLoadingChannels: false,
      };
    }

    case "ADD_CHANNEL": {
      const { serverId, channel } = action.payload;
      const serverChannels = state.channels[serverId] || [];
      return {
        ...state,
        channels: {
          ...state.channels,
          [serverId]: [...serverChannels, channel],
        },
      };
    }

    case "UPDATE_CHANNEL": {
      const { serverId, channel } = action.payload;
      const serverChannels = state.channels[serverId] || [];
      return {
        ...state,
        channels: {
          ...state.channels,
          [serverId]: serverChannels.map((c) =>
            c.id === channel.id ? { ...c, ...channel } : c
          ),
        },
      };
    }

    case "REMOVE_CHANNEL": {
      const { serverId, channelId } = action.payload;
      const serverChannels = state.channels[serverId] || [];
      return {
        ...state,
        channels: {
          ...state.channels,
          [serverId]: serverChannels.filter((c) => c.id !== channelId),
        },
      };
    }

    case "SET_MEMBERS": {
      const { serverId, members } = action.payload;
      return {
        ...state,
        members: {
          ...state.members,
          [serverId]: members,
        },
      };
    }

    case "SET_PERMISSIONS": {
      const { serverId, permissions } = action.payload;
      return {
        ...state,
        permissions: {
          ...state.permissions,
          [serverId]: permissions,
        },
      };
    }

    case "START_LOADING_SERVERS":
      return {
        ...state,
        isLoadingServers: true,
        error: null,
      };

    case "START_LOADING_PUBLIC_SERVERS":
      return {
        ...state,
        isLoadingPublicServers: true,
        error: null,
      };

    case "START_LOADING_CHANNELS":
      return {
        ...state,
        isLoadingChannels: true,
        error: null,
      };

    case "SERVER_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoadingServers: false,
        isLoadingChannels: false,
        isLoadingPublicServers: false,
      };

    case "CLEAR_SERVERS":
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

const ServerContext = createContext();

export function ServerProvider({ children }) {
  const [state, dispatch] = useReducer(serverReducer, initialState);
  const { makeAuthenticatedRequest } = useAuth();

  // API Helper Functions
  const apiRequest = useCallback(
    async (endpoint, options = {}) => {
      try {
        const url = `${API_BASE_URL}${endpoint}`;
        const response = await makeAuthenticatedRequest(url, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || `HTTP ${response.status}`
          );
        }

        return await response.json();
      } catch (error) {
        console.error(`API request failed for ${endpoint}:`, error);
        throw error;
      }
    },
    [makeAuthenticatedRequest]
  );

  // Load user's servers (joined servers)
  const loadUserServers = useCallback(async () => {
    try {
      dispatch({ type: "START_LOADING_SERVERS" });

      // Get servers where user is a member (any role)
      const response = await apiRequest("/servers/");
      dispatch({ type: "SET_SERVERS", payload: response.servers || [] });
    } catch (error) {
      dispatch({ type: "SERVER_ERROR", payload: error.message });
    }
  }, [apiRequest]);

  // Load public servers for discovery
  const loadPublicServers = useCallback(
    async (searchQuery = "") => {
      try {
        dispatch({ type: "START_LOADING_PUBLIC_SERVERS" });

        const params = new URLSearchParams({ discovery: "true" });
        if (searchQuery.trim()) {
          params.append("search", searchQuery.trim());
        }

        const response = await apiRequest(`/servers/?${params}`);
        dispatch({
          type: "SET_PUBLIC_SERVERS",
          payload: response.servers || [],
        });
      } catch (error) {
        dispatch({ type: "SERVER_ERROR", payload: error.message });
      }
    },
    [apiRequest]
  );

  // Create new server
  const createServer = useCallback(
    async (serverData) => {
      try {
        const formData = new FormData();
        formData.append("name", serverData.name);
        formData.append("description", serverData.description || "");
        formData.append("visibility", serverData.visibility || "public");

        if (serverData.icon && serverData.icon instanceof File) {
          formData.append("icon", serverData.icon);
        }

        const response = await makeAuthenticatedRequest(
          `${API_BASE_URL}/servers/`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create server");
        }

        const result = await response.json();
        dispatch({ type: "ADD_SERVER", payload: result.server });
        return { success: true, server: result.server };
      } catch (error) {
        dispatch({ type: "SERVER_ERROR", payload: error.message });
        return { success: false, error: error.message };
      }
    },
    [makeAuthenticatedRequest]
  );

  // Join server
  const joinServer = useCallback(
    async (serverId, inviteCode = "") => {
      try {
        const body = inviteCode ? { invite_code: inviteCode } : {};

        const response = await apiRequest(`/servers/${serverId}/memberships/`, {
          method: "POST",
          body: JSON.stringify(body),
        });

        // Reload user servers to include the newly joined server
        await loadUserServers();
        return { success: true, message: response.message };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [apiRequest, loadUserServers]
  );

  // Leave server
  const leaveServer = useCallback(
    async (serverId, userId) => {
      try {
        const response = await apiRequest(
          `/servers/${serverId}/members/${userId}/`,
          {
            method: "DELETE",
          }
        );

        dispatch({ type: "REMOVE_SERVER", payload: serverId });
        return { success: true, message: response.message };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [apiRequest]
  );

  // Update server (owner/admin only)
  const updateServer = useCallback(
    async (serverId, serverData) => {
      try {
        const formData = new FormData();

        if (serverData.name) formData.append("name", serverData.name);
        if (serverData.description !== undefined)
          formData.append("description", serverData.description);
        if (serverData.visibility)
          formData.append("visibility", serverData.visibility);

        if (serverData.icon && serverData.icon instanceof File) {
          formData.append("icon", serverData.icon);
        }

        const response = await makeAuthenticatedRequest(
          `${API_BASE_URL}/servers/${serverId}/`,
          {
            method: "PATCH",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update server");
        }

        const result = await response.json();
        dispatch({ type: "UPDATE_SERVER", payload: result.server });
        return { success: true, server: result.server };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [makeAuthenticatedRequest]
  );

  // Delete server (owner only)
  const deleteServer = useCallback(
    async (serverId) => {
      try {
        await apiRequest(`/servers/${serverId}/`, {
          method: "DELETE",
        });

        dispatch({ type: "REMOVE_SERVER", payload: serverId });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    [apiRequest]
  );

  // Load server channels
  const loadServerChannels = useCallback(
    async (serverId) => {
      try {
        dispatch({ type: "START_LOADING_CHANNELS" });

        const response = await apiRequest(`/servers/${serverId}/channels/`);
        dispatch({
          type: "SET_CHANNELS",
          payload: { serverId, channels: response || [] },
        });
      } catch (error) {
        dispatch({ type: "SERVER_ERROR", payload: error.message });
      }
    },
    [apiRequest]
  );

  // Load server members
  const loadServerMembers = useCallback(
    async (serverId) => {
      try {
        const response = await apiRequest(`/servers/${serverId}/memberships/`);
        dispatch({
          type: "SET_MEMBERS",
          payload: { serverId, members: response.memberships || [] },
        });
      } catch (error) {
        dispatch({ type: "SERVER_ERROR", payload: error.message });
      }
    },
    [apiRequest]
  );

  // Helper functions
  const setActiveServer = useCallback(
    (serverId) => {
      dispatch({ type: "SET_ACTIVE_SERVER", payload: serverId });

      // Auto-load channels when server is selected
      if (serverId && !state.channels[serverId]) {
        loadServerChannels(serverId);
      }
    },
    [loadServerChannels, state.channels]
  );

  const clearServers = useCallback(() => {
    dispatch({ type: "CLEAR_SERVERS" });
  }, []);

  // Get active server data
  const activeServer = state.activeServerId
    ? state.servers.find((s) => s.id === state.activeServerId)
    : null;

  const activeServerChannels = state.activeServerId
    ? state.channels[state.activeServerId] || []
    : [];

  const activeServerMembers = state.activeServerId
    ? state.members[state.activeServerId] || []
    : [];

  const activeServerPermissions = state.activeServerId
    ? state.permissions[state.activeServerId] || []
    : [];

  // Check if user has specific permission in active server
  const hasServerPermission = useCallback(
    (permission) => {
      if (!activeServer) return false;

      const membership = activeServerMembers.find(
        (m) => m.user.id === state.user?.id
      );
      if (!membership) return false;

      // Owner has all permissions
      if (membership.role === "owner") return true;

      // Define role-based permissions
      const rolePermissions = {
        admin: [
          "manage_server",
          "manage_channels",
          "manage_members",
          "kick_members",
        ],
        moderator: ["kick_members", "manage_messages"],
        member: ["send_messages", "view_channels"],
      };

      return rolePermissions[membership.role]?.includes(permission) || false;
    },
    [activeServer, activeServerMembers, state.user]
  );

  return (
    <ServerContext.Provider
      value={{
        ...state,
        dispatch,

        // Server management
        loadUserServers,
        loadPublicServers,
        createServer,
        updateServer,
        deleteServer,
        joinServer,
        leaveServer,
        setActiveServer,
        clearServers,

        // Channel management
        loadServerChannels,
        loadServerMembers,

        // Computed values
        activeServer,
        activeServerChannels,
        activeServerMembers,
        activeServerPermissions,
        hasServerPermission,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer must be used within a ServerProvider");
  }
  return context;
}
