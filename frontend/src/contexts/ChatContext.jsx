import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost/ws";
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

const initialState = {
  messages: {},
  activeChannelId: null,
  activeConversationId: null,
  activeServerId: null,
  connectionStatus: "disconnected",
  unreadCounts: {},
  isTyping: {},
  error: null,
  isLoadingMessages: false,
  optimisticMessages: new Set(),
  reconnectAttempts: 0,
};

function chatReducer(state, action) {
  switch (action.type) {
    case "SET_ACTIVE_CHANNEL":
      return {
        ...state,
        activeChannelId: action.payload.channelId,
        activeServerId: action.payload.serverId,
        activeConversationId: null,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload.channelId]: 0,
        },
        error: null,
      };

    case "SET_ACTIVE_CONVERSATION":
      return {
        ...state,
        activeConversationId: action.payload,
        activeChannelId: null,
        activeServerId: null,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload]: 0,
        },
        error: null,
      };

    case "ADD_MESSAGE": {
      const { chatId, message } = action.payload;
      const isActiveChat =
        chatId === state.activeChannelId ||
        chatId === state.activeConversationId;

      // Get existing messages for this chat
      const chatMessages = state.messages[chatId] || [];

      // If this is a confirmed message from WebSocket and we have optimistic messages,
      // check if we need to replace an optimistic message with similar content
      if (!message.isOptimistic) {
        const optimisticIndex = chatMessages.findIndex(
          (msg) =>
            msg.isOptimistic &&
            msg.content === message.content &&
            msg.author?.id === message.author?.id &&
            // Only match recent optimistic messages (within last 30 seconds)
            new Date().getTime() - new Date(msg.created_at).getTime() < 30000
        );

        if (optimisticIndex !== -1) {
          console.log("Replacing optimistic message with confirmed message");
          // Replace the optimistic message with the confirmed one
          const updatedMessages = [...chatMessages];
          updatedMessages[optimisticIndex] = message;

          return {
            ...state,
            messages: {
              ...state.messages,
              [chatId]: updatedMessages,
            },
          };
        }
      }

      // Default behavior: add message normally
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: [...chatMessages, message],
        },
        unreadCounts: isActiveChat
          ? state.unreadCounts
          : {
              ...state.unreadCounts,
              [chatId]: (state.unreadCounts[chatId] || 0) + 1,
            },
      };
    }

    case "UPDATE_MESSAGE": {
      const { chatId, messageId, updates } = action.payload;
      const chatMessages = state.messages[chatId] || [];

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      };
    }

    case "REMOVE_OPTIMISTIC_MESSAGE": {
      const { chatId, tempId } = action.payload;
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).filter(
            (msg) => msg.id !== tempId
          ),
        },
        optimisticMessages: new Set(
          [...state.optimisticMessages].filter((id) => id !== tempId)
        ),
      };
    }

    case "CONFIRM_MESSAGE": {
      const { chatId, tempId, confirmedMessage } = action.payload;
      const chatMessages = state.messages[chatId] || [];
      const newOptimistic = new Set(state.optimisticMessages);
      newOptimistic.delete(tempId);

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map((msg) =>
            msg.id === tempId
              ? { ...confirmedMessage, isOptimistic: false }
              : msg
          ),
        },
        optimisticMessages: newOptimistic,
      };
    }

    case "SET_MESSAGES":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
        isLoadingMessages: false,
      };

    case "PREPEND_MESSAGES": {
      const { chatId, messages } = action.payload;
      const existingMessages = state.messages[chatId] || [];

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: [...messages, ...existingMessages],
        },
        isLoadingMessages: false,
      };
    }

    case "WEBSOCKET_CONNECTING":
      return {
        ...state,
        connectionStatus: "connecting",
        error: null,
      };

    case "WEBSOCKET_CONNECTED":
      return {
        ...state,
        connectionStatus: "connected",
        error: null,
        reconnectAttempts: 0,
      };

    case "WEBSOCKET_DISCONNECTED":
      return {
        ...state,
        connectionStatus: "disconnected",
        error: null,
      };

    case "WEBSOCKET_ERROR":
      return {
        ...state,
        connectionStatus: "error",
        error: action.payload,
      };

    case "SET_RECONNECT_ATTEMPTS":
      return {
        ...state,
        reconnectAttempts: action.payload,
      };

    case "SET_TYPING":
      return {
        ...state,
        isTyping: {
          ...state.isTyping,
          [action.payload.chatId]: action.payload.users,
        },
      };

    case "START_LOADING_MESSAGES":
      return {
        ...state,
        isLoadingMessages: true,
        error: null,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoadingMessages: false,
      };

    case "CLEAR_CHAT":
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  // FIXED: Get makeAuthenticatedRequest at component level, not inside callback
  const { user, token, makeAuthenticatedRequest } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);

  // WebSocket connection management
  const connectWebSocket = useCallback(
    (serverId, channelId) => {
      if (!token || !user) {
        console.warn("Cannot connect WebSocket: No authentication");
        return;
      }

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      dispatch({ type: "WEBSOCKET_CONNECTING" });

      const wsUrl = `${WS_BASE_URL}/chat/${serverId}/${channelId}/`;
      console.log("Connecting to WebSocket:", wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected, sending auth...");

          // Send authentication
          ws.send(
            JSON.stringify({
              type: "auth",
              token: token,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data, channelId);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          dispatch({ type: "WEBSOCKET_DISCONNECTED" });

          // Clear ping interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
          }

          // Attempt reconnection if not a normal closure
          if (
            event.code !== 1000 &&
            state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS
          ) {
            scheduleReconnect(serverId, channelId);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          dispatch({ type: "WEBSOCKET_ERROR", payload: "Connection error" });
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        dispatch({ type: "WEBSOCKET_ERROR", payload: error.message });
      }
    },
    [token, user, state.reconnectAttempts]
  );

  const handleWebSocketMessage = useCallback((data, expectedChannelId) => {
    console.log("WebSocket message received:", data);

    switch (data.type) {
      case "auth_success":
        dispatch({ type: "WEBSOCKET_CONNECTED" });
        console.log("WebSocket authenticated successfully");

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
        break;

      case "auth_error":
        console.error("WebSocket auth error:", data.message);
        dispatch({ type: "WEBSOCKET_ERROR", payload: data.message });
        break;

      case "chat_message":
        if (data.message) {
          console.log("Received chat message:", data.message);

          dispatch({
            type: "ADD_MESSAGE",
            payload: {
              chatId: expectedChannelId,
              message: {
                id: data.message.id,
                content: data.message.content,
                author: data.message.author,
                created_at: data.message.created_at,
                isOptimistic: false,
              },
            },
          });
        }
        break;

      case "pong":
        console.log("WebSocket pong received");
        break;

      case "error":
        console.error("WebSocket error message:", data.message);
        dispatch({ type: "SET_ERROR", payload: data.message });
        break;

      default:
        console.log("Unhandled WebSocket message type:", data.type);
    }
  }, []);

  const scheduleReconnect = useCallback(
    (serverId, channelId) => {
      const attempts = state.reconnectAttempts + 1;
      dispatch({ type: "SET_RECONNECT_ATTEMPTS", payload: attempts });

      console.log(
        `Scheduling reconnect attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS}`
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket(serverId, channelId);
      }, RECONNECT_INTERVAL * Math.pow(2, Math.min(attempts - 1, 3)));
    },
    [state.reconnectAttempts, connectWebSocket]
  );

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Normal closure");
      wsRef.current = null;
    }

    dispatch({ type: "WEBSOCKET_DISCONNECTED" });
  }, []);

  // Set active channel and connect WebSocket
  const setActiveChannel = useCallback(
    (channelId, serverId) => {
      if (!channelId || !serverId) {
        disconnectWebSocket();
        return;
      }

      dispatch({
        type: "SET_ACTIVE_CHANNEL",
        payload: { channelId, serverId },
      });

      // Load message history first
      loadMessageHistory(channelId, serverId);

      // Then connect WebSocket for real-time updates
      connectWebSocket(serverId, channelId);
    },
    [connectWebSocket, disconnectWebSocket]
  );

  const setActiveConversation = useCallback(
    (conversationId) => {
      // Disconnect from channel WebSocket first
      disconnectWebSocket();

      dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversationId });

      // TODO: Implement DM WebSocket connection
      // For now just load message history
      loadDMHistory(conversationId);
    },
    [disconnectWebSocket]
  );

  // FIXED: Load message history from REST API
  const loadMessageHistory = useCallback(
    async (channelId, serverId) => {
      if (!serverId || !channelId || !makeAuthenticatedRequest) {
        console.warn("Cannot load message history: Missing requirements", {
          serverId,
          channelId,
          hasAuth: !!makeAuthenticatedRequest,
        });
        return;
      }

      dispatch({ type: "START_LOADING_MESSAGES" });

      try {
        const API_BASE_URL =
          import.meta.env.VITE_API_URL || "http://localhost/api";
        const url = `${API_BASE_URL}/servers/${serverId}/channels/${channelId}/messages/`;

        console.log("Loading message history from:", url);

        const response = await makeAuthenticatedRequest(url);

        if (response.ok) {
          const messages = await response.json();
          console.log("Raw messages from API:", messages);

          // Transform messages to match our format - handle both array response and object with data
          const messageArray = Array.isArray(messages)
            ? messages
            : messages.data || [];
          const transformedMessages = messageArray.map((msg) => ({
            id: msg.id,
            content: msg.content,
            author: msg.author,
            created_at: msg.created_at,
            isOptimistic: false,
          }));

          console.log("Transformed messages:", transformedMessages);

          dispatch({
            type: "SET_MESSAGES",
            payload: { chatId: channelId, messages: transformedMessages },
          });
        } else {
          console.error(
            "Failed to load messages:",
            response.status,
            response.statusText
          );
          throw new Error(`Failed to load messages: ${response.status}`);
        }
      } catch (error) {
        console.error("Failed to load message history:", error);
        dispatch({ type: "SET_ERROR", payload: "Failed to load messages" });
      }
    },
    [makeAuthenticatedRequest]
  );

  // Load DM history (placeholder)
  const loadDMHistory = useCallback(async (conversationId) => {
    console.log("Loading DM history for:", conversationId);
  }, []);

  // Send message via WebSocket
  const sendMessage = useCallback(
    (content) => {
      const chatId = state.activeChannelId || state.activeConversationId;
      if (!chatId || !content.trim() || !wsRef.current) {
        console.warn("Cannot send message:", {
          chatId,
          content: content.trim(),
          wsReady: !!wsRef.current,
          connectionStatus: state.connectionStatus,
        });
        return;
      }

      const trimmedContent = content.trim();
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      console.log("Sending message:", {
        content: trimmedContent,
        chatId,
        connectionStatus: state.connectionStatus,
      });

      // Add optimistic message immediately
      const optimisticMessage = {
        id: tempId,
        content: trimmedContent,
        author: user,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      dispatch({
        type: "ADD_MESSAGE",
        payload: { chatId, message: optimisticMessage },
      });

      // Send via WebSocket
      try {
        const wsMessage = {
          type: "chat_message",
          content: trimmedContent,
        };

        console.log("Sending WebSocket message:", wsMessage);
        wsRef.current.send(JSON.stringify(wsMessage));
      } catch (error) {
        console.error("Failed to send message:", error);

        // Remove optimistic message on failure
        dispatch({
          type: "REMOVE_OPTIMISTIC_MESSAGE",
          payload: { chatId, tempId },
        });

        dispatch({ type: "SET_ERROR", payload: "Failed to send message" });
      }
    },
    [
      state.activeChannelId,
      state.activeConversationId,
      state.connectionStatus,
      user,
    ]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  const clearChat = useCallback(() => {
    disconnectWebSocket();
    dispatch({ type: "CLEAR_CHAT" });
  }, [disconnectWebSocket]);

  return (
    <ChatContext.Provider
      value={{
        ...state,
        dispatch,
        setActiveChannel,
        setActiveConversation,
        sendMessage,
        clearChat,
        connectWebSocket,
        disconnectWebSocket,
        loadMessageHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
