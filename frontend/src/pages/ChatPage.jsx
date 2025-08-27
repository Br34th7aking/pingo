import { Link } from "react-router";

export default function ChatPage() {
  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar */}
      <div className="w-64 bg-base-300 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-base-content/10">
          <h2 className="text-lg font-semibold">Pingo Chat</h2>
        </div>

        {/* Channels */}
        <div className="flex-1 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-base-content/70 mb-2">
              CHANNELS
            </h3>
            <ul className="space-y-1">
              <li>
                <a
                  href="#"
                  className="block p-2 rounded hover:bg-base-content/10"
                >
                  # general
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="block p-2 rounded hover:bg-base-content/10"
                >
                  # random
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="block p-2 rounded hover:bg-base-content/10"
                >
                  # dev-talk
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-base-content/70 mb-2">
              DIRECT MESSAGES
            </h3>
            <ul className="space-y-1">
              <li>
                <a
                  href="#"
                  className="block p-2 rounded hover:bg-base-content/10"
                >
                  👤 John Doe
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="block p-2 rounded hover:bg-base-content/10"
                >
                  👤 Jane Smith
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* User info at bottom */}
        <div className="p-4 border-t border-base-content/10">
          <div className="flex items-center space-x-2">
            <div className="avatar">
              <div className="w-8 rounded-full bg-primary/20">
                <span className="text-xs">👤</span>
              </div>
            </div>
            <span className="text-sm">Current User</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-base-content/10 bg-base-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold"># general</h1>
            <Link to="/settings" className="btn btn-ghost btn-sm">
              Settings
            </Link>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Sample messages */}
            <div className="chat chat-start">
              <div className="chat-image avatar">
                <div className="w-10 rounded-full bg-secondary/20">
                  <span className="text-xs">👤</span>
                </div>
              </div>
              <div className="chat-header">
                John Doe
                <time className="text-xs opacity-50 ml-2">12:45</time>
              </div>
              <div className="chat-bubble">Hey everyone! Welcome to Pingo!</div>
            </div>

            <div className="chat chat-end">
              <div className="chat-image avatar">
                <div className="w-10 rounded-full bg-accent/20">
                  <span className="text-xs">👤</span>
                </div>
              </div>
              <div className="chat-header">
                You
                <time className="text-xs opacity-50 ml-2">12:46</time>
              </div>
              <div className="chat-bubble chat-bubble-primary">
                Thanks! Excited to be here.
              </div>
            </div>
          </div>
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-base-content/10">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Message #general..."
              className="input input-bordered flex-1"
            />
            <button className="btn btn-primary">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
