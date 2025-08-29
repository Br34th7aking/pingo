import { createContext, useContext, useReducer } from "react";

const initialState = {
  messages: {},
  activeChannelId: null,
  activeConversationId: null,

  connectionStatus: "disconnected",
  unreadCounts: {},
  isTyping: {},
  error: null,
  isLoadingMessages: false,
};

function chatReducer(state, action) {
  switch (action.type) {
    case "SET_ACTIVE_CHANNEL":
      return {
        ...state,
        activeChannelId: action.payload,
        activeConversationId: null,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload]: 0,
        },
      };
    case "SET_ACTIVE_CONVERSATION":
      return {
        ...state,
        activeConversationId: action.payload,
        activeChannelId: null,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload]: 0,
        },
      };

    case "ADD_MESSAGE": {
      const { chatId, message } = action.payload;
      const isActiveChat =
        chatId === state.activeChannelId || state.activeConversationId;
      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), message],
        },
        unreadCounts: isActiveChat
          ? state.unreadCounts
          : {
              ...state.unreadCounts,
              [chatId]: (state.unreadCounts[chatId] || 0) + 1,
            },
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

  const setActiveChannel = (channelId) => {
    dispatch({ type: "SET_ACTIVE_CHANNEL", payload: channelId });
  };

  const setActiveConversation = (conversationId) => {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversationId });
  };

  const addMessage = (chatId, message) => {
    dispatch({
      type: "ADD_MESSAGE",
      payload: {
        chatId,
        message: {
          ...message,
          timestamp: new Date().toISOString(),
        },
      },
    });
  };
  const sendMessage = (content) => {
    const chatId = state.activeChannelId || state.activeConversationId;
    if (!chatId || !content.trim()) return;
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      author: "You", // This will come from AuthContext in real implementation
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    };

    addMessage(chatId, optimisticMessage);

    // TODO: Send to WebSocket server
    console.log(`Sending message to ${chatId}:`, content);
  };

  const clearChat = () => {
    dispatch({ type: "CLEAR_CHAT" });
  };
  return (
    <ChatContext.Provider
      value={{
        ...state,
        dispatch,
        setActiveChannel,
        setActiveConversation,
        addMessage,
        sendMessage,
        clearChat,
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
