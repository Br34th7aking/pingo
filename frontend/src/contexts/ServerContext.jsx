import { createContext, useContext, useReducer } from "react";

const initialState = {
  servers: [],
  activeServerId: null,
  channels: {},
  members: {},
  permissions: {},
  isLoadingServers: false,
  isLoadingChannels: false,
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
  // Helper functions
  const setActiveServer = (serverId) => {
    dispatch({ type: "SET_ACTIVE_SERVER", payload: serverId });
  };

  const addServer = (server) => {
    dispatch({ type: "ADD_SERVER", payload: server });
  };

  const leaveServer = (serverId) => {
    dispatch({ type: "REMOVE_SERVER", payload: serverId });
  };

  const loadMockData = () => {
    // Mock servers for testing
    const mockServers = [
      {
        id: "server-1",
        name: "Pingo Community",
        icon: "🏠",
        description: "Main community server",
        memberCount: 142,
      },
      {
        id: "server-2",
        name: "Dev Team",
        icon: "💻",
        description: "Development discussions",
        memberCount: 12,
      },
      {
        id: "server-3",
        name: "Gaming",
        icon: "🎮",
        description: "Gaming community",
        memberCount: 89,
      },
    ];

    // Mock channels for each server
    const mockChannels = {
      "server-1": [
        {
          id: "channel-general",
          name: "general",
          type: "text",
          description: "General discussion",
        },
        {
          id: "channel-announcements",
          name: "announcements",
          type: "text",
          description: "Important updates",
        },
        {
          id: "channel-random",
          name: "random",
          type: "text",
          description: "Random chat",
        },
      ],
      "server-2": [
        {
          id: "channel-dev-general",
          name: "general",
          type: "text",
          description: "Dev discussions",
        },
        {
          id: "channel-code-review",
          name: "code-review",
          type: "text",
          description: "Code reviews",
        },
        {
          id: "channel-deployment",
          name: "deployment",
          type: "text",
          description: "Deployment logs",
        },
      ],
      "server-3": [
        {
          id: "channel-gaming-general",
          name: "general",
          type: "text",
          description: "Gaming chat",
        },
        {
          id: "channel-lfg",
          name: "looking-for-group",
          type: "text",
          description: "Find gaming partners",
        },
      ],
    };

    // Mock permissions (basic for now)
    const mockPermissions = {
      "server-1": ["READ_MESSAGES", "SEND_MESSAGES", "USE_VOICE"],
      "server-2": [
        "READ_MESSAGES",
        "SEND_MESSAGES",
        "MANAGE_CHANNELS",
        "USE_VOICE",
      ],
      "server-3": ["READ_MESSAGES", "SEND_MESSAGES", "USE_VOICE"],
    };

    dispatch({ type: "SET_SERVERS", payload: mockServers });

    // Set channels and permissions for each server
    Object.entries(mockChannels).forEach(([serverId, channels]) => {
      dispatch({ type: "SET_CHANNELS", payload: { serverId, channels } });
    });

    Object.entries(mockPermissions).forEach(([serverId, permissions]) => {
      dispatch({ type: "SET_PERMISSIONS", payload: { serverId, permissions } });
    });
  };

  const clearServers = () => {
    dispatch({ type: "CLEAR_SERVERS" });
  };

  // Get active server data
  const activeServer = state.activeServerId
    ? state.servers.find((s) => s.id === state.activeServerId)
    : null;

  const activeServerChannels = state.activeServerId
    ? state.channels[state.activeServerId] || []
    : [];

  const activeServerPermissions = state.activeServerId
    ? state.permissions[state.activeServerId] || []
    : [];

  return (
    <ServerContext.Provider
      value={{
        ...state,
        dispatch,
        setActiveServer,
        addServer,
        leaveServer,
        loadMockData,
        clearServers,
        // Computed values
        activeServer,
        activeServerChannels,
        activeServerPermissions,
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
