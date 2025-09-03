import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useServer } from "../contexts/ServerContext";
import { useUI } from "../contexts/UIContext";
import { useState, useEffect, useRef } from "react";
import UserProfile from "../components/ui/UserProfile";
import ServerCreationModal from "../components/server/ServerCreationModal";
import ServerSettingsModal from "../components/server/ServerSettingsModal";

export default function ChatPage() {
  const { user } = useAuth();
  const {
    messages,
    activeChannelId,
    activeServerId: chatActiveServerId,
    connectionStatus,
    unreadCounts,
    isLoadingMessages,
    error: chatError,
    setActiveChannel,
    sendMessage,
  } = useChat();

  const {
    servers,
    activeServerId,
    activeServer,
    activeServerChannels,
    isLoadingServers,
    setActiveServer,
    loadUserServers,
    loadServerChannels,
  } = useServer();

  const { theme, compactMode, setTheme, toggleCompactMode, addToast } = useUI();

  const [messageInput, setMessageInput] = useState("");
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  // Load user's servers when component mounts
  useEffect(() => {
    loadUserServers();
  }, [loadUserServers]);

  // Auto-select first server if none selected
  useEffect(() => {
    if (servers.length > 0 && !activeServerId) {
      setActiveServer(servers[0].id);
    }
  }, [servers, activeServerId, setActiveServer]);

  // Load channels when active server changes
  useEffect(() => {
    if (activeServerId) {
      loadServerChannels(activeServerId);
    }
  }, [activeServerId, loadServerChannels]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages[activeChannelId]]);

  // Auto-select first channel when server changes
  useEffect(() => {
    if (activeServerId && activeServerChannels.length > 0) {
      // Check if current channel belongs to current server
      const currentChannelBelongsToServer = activeServerChannels.some(
        (channel) => channel.id === activeChannelId
      );

      if (!activeChannelId || !currentChannelBelongsToServer) {
        const firstChannel = activeServerChannels[0];
        handleChannelClick(firstChannel.id);
      }
    }
  }, [activeServerId, activeServerChannels, activeChannelId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && activeChannelId) {
      sendMessage(messageInput);
      setMessageInput("");

      // Focus back to input
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    }
  };

  const handleServerClick = (serverId) => {
    setActiveServer(serverId);
    // Don't clear active channel here - let the channel auto-selection handle it
  };

  const handleChannelClick = (channelId) => {
    if (activeServerId) {
      setActiveChannel(channelId, activeServerId);
    } else {
      addToast({
        type: "error",
        message: "Please select a server first",
        duration: 3000,
      });
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    addToast({
      type: "info",
      message: `Switched to ${newTheme} theme`,
      duration: 2000,
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const getCurrentUserRole = () => {
    if (!activeServer || !user) return null;
    if (activeServer.owner.id === user.id) return "owner";
    return "member";
  };

  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case "connecting":
        return { icon: "🔄", color: "badge-warning", text: "Connecting..." };
      case "connected":
        return { icon: "🟢", color: "badge-success", text: "Connected" };
      case "disconnected":
        return { icon: "🔴", color: "badge-ghost", text: "Disconnected" };
      case "error":
        return { icon: "⚠️", color: "badge-error", text: "Connection Error" };
      default:
        return { icon: "🔴", color: "badge-ghost", text: "Offline" };
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    }
  };

  const activeMessages = activeChannelId ? messages[activeChannelId] || [] : [];
  const activeChannel = Array.isArray(activeServerChannels)
    ? activeServerChannels.find((c) => c.id === activeChannelId)
    : null;

  const statusInfo = getConnectionStatusInfo();

  return (
    <div className="flex h-screen bg-base-100">
      {/* Server List (Left sidebar) */}
      <div className="w-16 bg-base-300 flex flex-col items-center py-2 space-y-2 overflow-y-auto">
        {/* Loading State */}
        {isLoadingServers && (
          <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center">
            <span className="loading loading-spinner loading-sm"></span>
          </div>
        )}

        {/* Server List */}
        {!isLoadingServers &&
          servers.map((server) => (
            <div key={server.id} className="relative">
              <button
                onClick={() => handleServerClick(server.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center hover:rounded-2xl transition-all duration-200 group relative ${
                  activeServerId === server.id
                    ? "bg-primary text-primary-content rounded-2xl"
                    : "bg-base-200 hover:bg-base-100"
                }`}
                title={server.name}
              >
                {server.icon ? (
                  <img
                    src={server.icon}
                    alt={`${server.name} icon`}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold">
                    {server.name.charAt(0).toUpperCase()}
                  </span>
                )}

                {/* Server tooltip */}
                <div className="absolute left-16 top-0 bg-base-content text-base-100 text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {server.name}
                </div>
              </button>
            </div>
          ))}

        {/* Add Server Button */}
        <button
          onClick={() => setShowCreateServerModal(true)}
          className="w-12 h-12 rounded-full bg-base-200 hover:bg-base-100 hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-2xl group relative"
          title="Create Server"
        >
          +
          <div className="absolute left-16 top-0 bg-base-content text-base-100 text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            Create Server
          </div>
        </button>

        {/* Discover Servers Button */}
        <Link
          to="/discover"
          className="w-12 h-12 rounded-full bg-base-200 hover:bg-base-100 hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-lg group relative"
          title="Discover Servers"
        >
          🔍
          <div className="absolute left-16 top-0 bg-base-content text-base-100 text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            Discover Servers
          </div>
        </Link>
      </div>

      {/* Channels Sidebar */}
      <div className="w-64 bg-base-200 flex flex-col">
        {/* Server Header */}
        <div className="p-4 border-b border-base-content/10">
          {activeServer ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold truncate">
                  {activeServer.name}
                </h2>
                <button
                  onClick={() => setShowServerSettingsModal(true)}
                  className="btn btn-ghost btn-xs"
                  title="Server Settings"
                >
                  ⚙️
                </button>
              </div>

              <div className="flex items-center justify-between text-sm text-base-content/70 mb-2">
                <span>{activeServer.member_count} members</span>
                <span
                  className={`badge badge-xs ${
                    activeServer.visibility === "private"
                      ? "badge-secondary"
                      : "badge-primary"
                  }`}
                >
                  {activeServer.visibility === "private" ? "🔒" : "🌍"}
                </span>
              </div>

              {activeServer.description && (
                <p className="text-xs text-base-content/60 mb-2 line-clamp-2">
                  {activeServer.description}
                </p>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-lg font-semibold">Select Server</h2>
              <p className="text-sm text-base-content/70">
                Choose a server to start chatting
              </p>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between text-xs mt-2">
            <span>Status:</span>
            <div className="flex items-center gap-1">
              <span className={`badge badge-xs ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.text}
              </span>
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs">Theme:</span>
            <div className="flex gap-1">
              <button
                onClick={() => handleThemeChange("light")}
                className={`btn btn-xs ${
                  theme === "light" ? "btn-primary" : "btn-ghost"
                }`}
              >
                ☀️
              </button>
              <button
                onClick={() => handleThemeChange("dark")}
                className={`btn btn-xs ${
                  theme === "dark" ? "btn-primary" : "btn-ghost"
                }`}
              >
                🌙
              </button>
            </div>
          </div>
        </div>

        {/* Channels */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeServerId ? (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-base-content/70">
                  TEXT CHANNELS
                </h3>
                {getCurrentUserRole() !== "member" && (
                  <button
                    onClick={() =>
                      addToast({
                        type: "info",
                        message: "Channel creation coming soon!",
                        duration: 2000,
                      })
                    }
                    className="btn btn-ghost btn-xs"
                    title="Create Channel"
                  >
                    +
                  </button>
                )}
              </div>

              {(activeServerChannels || []).length === 0 ? (
                <div className="text-center text-base-content/50 py-4">
                  <p className="text-sm">No channels available</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {(activeServerChannels || []).map((channel) => (
                    <li key={channel.id}>
                      <button
                        onClick={() => handleChannelClick(channel.id)}
                        className={`w-full text-left p-2 rounded hover:bg-base-content/10 flex justify-between items-center group ${
                          activeChannelId === channel.id
                            ? "bg-primary/20 text-primary"
                            : ""
                        }`}
                      >
                        <span className="flex items-center min-w-0">
                          <span className="mr-2 flex-shrink-0">#</span>
                          <span className="truncate">{channel.name}</span>
                        </span>
                        {unreadCounts[channel.id] > 0 && (
                          <span className="badge badge-primary badge-sm">
                            {unreadCounts[channel.id]}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-center text-base-content/50 py-8">
              <p className="text-sm">Select a server to view channels</p>
            </div>
          )}

          {/* Compact Mode Toggle */}
          <div className="mt-4 pt-4 border-t border-base-content/10">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={compactMode}
                onChange={toggleCompactMode}
              />
              <span className="text-xs">Compact mode</span>
            </label>
          </div>
        </div>

        {/* User Profile */}
        <UserProfile />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-base-content/10 bg-base-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                {activeChannel
                  ? `# ${activeChannel.name}`
                  : activeServerId
                  ? "Select a channel"
                  : "Select a server"}
              </h1>
              {activeChannel?.description && (
                <p className="text-sm text-base-content/70">
                  {activeChannel.description}
                </p>
              )}
              {!activeServerId && (
                <p className="text-sm text-base-content/70">
                  Join or create a server to start chatting
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link to="/discover" className="btn btn-ghost btn-sm">
                Discover
              </Link>
              <Link to="/settings" className="btn btn-ghost btn-sm">
                Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Error Display */}
          {chatError && (
            <div className="mx-4 mt-4">
              <div className="alert alert-error">
                <span>{chatError}</span>
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeChannelId ? (
              <>
                {/* Loading State */}
                {isLoadingMessages && (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="text-sm text-base-content/70">
                        Loading messages...
                      </span>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {!isLoadingMessages && (
                  <>
                    {activeMessages.length === 0 ? (
                      <div className="text-center text-base-content/50 py-8">
                        <h3 className="text-lg mb-2">
                          Welcome to #{activeChannel?.name}!
                        </h3>
                        <p>
                          {activeChannel?.description ||
                            "Start the conversation!"}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`space-y-${compactMode ? "2" : "4"} pb-4`}
                      >
                        {activeMessages.map((message, index) => {
                          const showAvatar =
                            index === 0 ||
                            activeMessages[index - 1]?.author?.id !==
                              message.author?.id ||
                            new Date(message.created_at).getTime() -
                              new Date(
                                activeMessages[index - 1]?.created_at || 0
                              ).getTime() >
                              5 * 60 * 1000;

                          return (
                            <div
                              key={message.id}
                              className={`flex gap-3 px-2 py-1 hover:bg-base-200/50 rounded group ${
                                message.isOptimistic ? "opacity-70" : ""
                              }`}
                            >
                              {/* Avatar */}
                              <div className="flex-shrink-0 w-10">
                                {showAvatar && (
                                  <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                                    {message.author?.avatar ? (
                                      <img
                                        src={message.author.avatar}
                                        alt={
                                          message.author.display_name ||
                                          message.author.username
                                        }
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-sm font-medium">
                                        {(
                                          message.author?.display_name ||
                                          message.author?.username ||
                                          "U"
                                        )
                                          .charAt(0)
                                          .toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Message Content */}
                              <div className="flex-1 min-w-0">
                                {showAvatar && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm">
                                      {message.author?.display_name ||
                                        message.author?.username ||
                                        "Unknown User"}
                                    </span>
                                    <span className="text-xs text-base-content/50">
                                      {formatMessageTime(message.created_at)}
                                    </span>
                                    {message.isOptimistic && (
                                      <span className="badge badge-ghost badge-xs">
                                        sending...
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div
                                  className={`text-sm ${
                                    compactMode
                                      ? "leading-tight"
                                      : "leading-relaxed"
                                  }`}
                                >
                                  {message.content}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-base-content/50">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg mb-2">Welcome to Pingo!</h3>
                  <p className="mb-4">
                    {!activeServerId
                      ? "Create or join a server to start chatting with your community."
                      : "Select a channel from the sidebar to start chatting."}
                  </p>
                  {!activeServerId && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setShowCreateServerModal(true)}
                        className="btn btn-primary btn-sm"
                      >
                        Create Server
                      </button>
                      <Link to="/discover" className="btn btn-outline btn-sm">
                        Discover Servers
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        {activeChannelId && (
          <div className="p-4 border-t border-base-content/10">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={messageInputRef}
                  type="text"
                  placeholder={`Message #${activeChannel?.name}...`}
                  className="input input-bordered w-full pr-20"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={connectionStatus !== "connected"}
                />
                {messageInput.length > 0 && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-base-content/50">
                    {messageInput.length}/2000
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  !messageInput.trim() || connectionStatus !== "connected"
                }
              >
                Send
              </button>
            </form>
            <div className="text-xs text-base-content/50 mt-1">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ServerCreationModal
        isOpen={showCreateServerModal}
        onClose={() => setShowCreateServerModal(false)}
      />

      <ServerSettingsModal
        isOpen={showServerSettingsModal}
        onClose={() => setShowServerSettingsModal(false)}
        server={activeServer}
      />
    </div>
  );
}
