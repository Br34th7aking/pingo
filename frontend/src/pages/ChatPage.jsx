import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { useServer } from "../contexts/ServerContext";
import { useUI } from "../contexts/UIContext";
import { useState, useEffect } from "react";

export default function ChatPage() {
  const { user, isAuthenticated } = useAuth();
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
    setActiveServer,
    loadMockData,
  } = useServer();

  const {
    theme,
    compactMode,
    setTheme,
    toggleCompactMode,
    addToast,
    openModal,
    closeModal,
    modals,
  } = useUI();

  const [messageInput, setMessageInput] = useState("");

  // Load mock data when component mounts
  useEffect(() => {
    if (servers.length === 0) {
      loadMockData();
    }
  }, [servers.length, loadMockData]);

  // Auto-select first server if none selected
  useEffect(() => {
    if (servers.length > 0 && !activeServerId) {
      setActiveServer(servers[0].id);
    }
  }, [servers, activeServerId, setActiveServer]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
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

  const activeMessages = activeChannelId ? messages[activeChannelId] || [] : [];
  const activeChannel = activeServerChannels.find(
    (c) => c.id === activeChannelId
  );

  return (
    <div className="flex h-screen bg-base-100">
      {/* Server List (Left sidebar) */}
      <div className="w-16 bg-base-300 flex flex-col items-center py-2 space-y-2">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => handleServerClick(server.id)}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:rounded-2xl transition-all duration-200 ${
              activeServerId === server.id
                ? "bg-primary text-primary-content rounded-2xl"
                : "bg-base-200 hover:bg-base-100"
            }`}
            title={server.name}
          >
            {server.icon}
          </button>
        ))}

        {/* Add Server Button */}
        <button
          onClick={() => openModal("createServer")}
          className="w-12 h-12 rounded-full bg-base-200 hover:bg-base-100 hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-2xl"
          title="Add Server"
        >
          +
        </button>
      </div>

      {/* Channels Sidebar */}
      <div className="w-64 bg-base-200 flex flex-col">
        {/* Server Header with Theme Controls */}
        <div className="p-4 border-b border-base-content/10">
          <h2 className="text-lg font-semibold truncate">
            {activeServer ? activeServer.name : "Select Server"}
          </h2>
          {activeServer && (
            <p className="text-sm text-base-content/70">
              {activeServer.memberCount} members
            </p>
          )}

          {/* Theme Switcher */}
          <div className="flex items-center gap-2 mt-2">
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
              className={`badge ${
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
        <div className="flex-1 p-4">
          {activeServerId && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-base-content/70">
                  TEXT CHANNELS
                </h3>
                <button
                  onClick={() => openModal("createChannel")}
                  className="btn btn-ghost btn-xs"
                  title="Create Channel"
                >
                  +
                </button>
              </div>
              <ul className="space-y-1">
                {activeServerChannels.map((channel) => (
                  <li key={channel.id}>
                    <button
                      onClick={() => handleChannelClick(channel.id)}
                      className={`w-full text-left p-2 rounded hover:bg-base-content/10 flex justify-between items-center ${
                        activeChannelId === channel.id
                          ? "bg-primary/20 text-primary"
                          : ""
                      }`}
                    >
                      <span className="flex items-center">
                        <span className="mr-2">#</span>
                        {channel.name}
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

        {/* User info */}
        <div className="p-4 border-t border-base-content/10">
          <div className="flex items-center space-x-2">
            <div className="avatar">
              <div className="w-8 rounded-full bg-primary/20">
                <span className="text-xs">👤</span>
              </div>
            </div>
            <span className="text-sm">
              {isAuthenticated ? user?.username : "Guest"}
            </span>
          </div>
        </div>
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
            </div>
            <Link to="/settings" className="btn btn-ghost btn-sm">
              Settings
            </Link>
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
                        <span className="text-xs">👤</span>
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
                <h3 className="text-lg mb-2">Welcome to Pingo!</h3>
                <p>
                  {activeServerId
                    ? "Select a channel from the sidebar to start chatting."
                    : "Select a server to see available channels."}
                </p>
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

      {/* Simple Modal Example */}
      {modals.createServer && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Create Server</h3>
            <p className="py-4">This is where you'd create a new server!</p>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => closeModal("createServer")}
              >
                Close
              </button>
              <button className="btn btn-primary">Create</button>
            </div>
          </div>
        </div>
      )}

      {modals.createChannel && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Create Channel</h3>
            <p className="py-4">This is where you'd create a new channel!</p>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => closeModal("createChannel")}
              >
                Close
              </button>
              <button className="btn btn-primary">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
