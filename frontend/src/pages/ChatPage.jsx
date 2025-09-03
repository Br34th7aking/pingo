import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useServer } from "../contexts/ServerContext";
import { useUI } from "../contexts/UIContext";
import { useState, useEffect } from "react";
import UserProfile from "../components/ui/UserProfile";
import ServerCreationModal from "../components/server/ServerCreationModal";
import ServerSettingsModal from "../components/server/ServerSettingsModal";

export default function ChatPage() {
  const { user } = useAuth();
  const {
    messages,
    activeChannelId,
    connectionStatus,
    unreadCounts,
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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && activeChannelId) {
      sendMessage(messageInput);
      setMessageInput("");
      addToast({
        type: "success",
        message: "Message sent!",
        duration: 2000,
      });
    }
  };

  const handleServerClick = (serverId) => {
    setActiveServer(serverId);
    setActiveChannel(null);
  };

  const handleChannelClick = (channelId) => {
    setActiveChannel(channelId);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    addToast({
      type: "info",
      message: `Switched to ${newTheme} theme`,
      duration: 2000,
    });
  };

  const getCurrentUserRole = () => {
    if (!activeServer || !user) return null;
    if (activeServer.owner.id === user.id) return "owner";

    // You might need to load server members to get the role
    // For now, assume member if not owner
    return "member";
  };

  const activeMessages = activeChannelId ? messages[activeChannelId] || [] : [];
  const activeChannel = Array.isArray(activeServerChannels)
    ? activeServerChannels.find((c) => c.id === activeChannelId)
    : null;

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
          +{/* Tooltip */}
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
          {/* Tooltip */}
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

              <div className="flex items-center justify-between text-sm text-base-content/70">
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
                <p className="text-xs text-base-content/60 mt-2 line-clamp-2">
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

          <div className="text-xs mt-1">
            Status:{" "}
            <span
              className={`badge badge-xs ${
                connectionStatus === "connected"
                  ? "badge-success"
                  : "badge-warning"
              }`}
            >
              {connectionStatus}
            </span>
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
        <div className="flex-1 p-4 overflow-y-auto">
          {activeChannelId ? (
            <div className={`space-y-${compactMode ? "2" : "4"}`}>
              {activeMessages.length === 0 ? (
                <div className="text-center text-base-content/50 py-8">
                  <h3 className="text-lg mb-2">
                    Welcome to #{activeChannel?.name}!
                  </h3>
                  <p>
                    {activeChannel?.description || "Start the conversation!"}
                  </p>
                </div>
              ) : (
                activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat ${
                      message.author === "You" ? "chat-end" : "chat-start"
                    } ${compactMode ? "chat-compact" : ""}`}
                  >
                    <div className="chat-image avatar">
                      <div
                        className={`${
                          compactMode ? "w-6" : "w-10"
                        } rounded-full ${
                          message.author === "You"
                            ? "bg-primary/20"
                            : "bg-secondary/20"
                        }`}
                      >
                        <span className={compactMode ? "text-xs" : "text-sm"}>
                          {message.author?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                    </div>
                    <div className="chat-header">
                      {message.author}
                      <time className="text-xs opacity-50 ml-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </time>
                      {message.isOptimistic && (
                        <span className="badge badge-ghost badge-xs ml-2">
                          sending...
                        </span>
                      )}
                    </div>
                    <div
                      className={`chat-bubble ${
                        message.author === "You" ? "chat-bubble-primary" : ""
                      } ${compactMode ? "text-sm" : ""}`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
            </div>
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

        {/* Message Input */}
        {activeChannelId && (
          <div className="p-4 border-t border-base-content/10">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                placeholder={`Message #${activeChannel?.name}...`}
                className="input input-bordered flex-1"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Send
              </button>
            </form>
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
