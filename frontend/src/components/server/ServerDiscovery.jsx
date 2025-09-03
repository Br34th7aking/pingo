import { useState, useEffect } from "react";
import { useServer } from "../../contexts/ServerContext";
import { useUI } from "../../contexts/UIContext";

export default function ServerDiscovery() {
  const {
    publicServers,
    isLoadingPublicServers,
    error,
    loadPublicServers,
    joinServer,
    servers: userServers,
  } = useServer();

  const { addToast } = useUI();
  const [searchQuery, setSearchQuery] = useState("");
  const [joinningServerId, setJoinningServerId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [inviteCode, setInviteCode] = useState("");

  // Load public servers on component mount
  useEffect(() => {
    loadPublicServers();
  }, [loadPublicServers]);

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPublicServers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadPublicServers]);

  const handleJoinServer = async (server) => {
    if (server.visibility === "private") {
      setSelectedServer(server);
      setShowInviteModal(true);
      return;
    }

    setJoinningServerId(server.id);
    try {
      const result = await joinServer(server.id);
      if (result.success) {
        addToast({
          type: "success",
          message: result.message || `Successfully joined ${server.name}!`,
          duration: 3000,
        });
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to join server",
          duration: 4000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        message: "An error occurred while joining the server",
        duration: 4000,
      });
    } finally {
      setJoinningServerId(null);
    }
  };

  const handlePrivateJoin = async () => {
    if (!inviteCode.trim()) {
      addToast({
        type: "error",
        message: "Please enter an invite code",
        duration: 3000,
      });
      return;
    }

    setJoinningServerId(selectedServer.id);
    try {
      const result = await joinServer(selectedServer.id, inviteCode);
      if (result.success) {
        addToast({
          type: "success",
          message:
            result.message || `Successfully joined ${selectedServer.name}!`,
          duration: 3000,
        });
        setShowInviteModal(false);
        setInviteCode("");
        setSelectedServer(null);
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to join server",
          duration: 4000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        message: "An error occurred while joining the server",
        duration: 4000,
      });
    } finally {
      setJoinningServerId(null);
    }
  };

  const isUserMember = (serverId) => {
    return userServers.some((server) => server.id === serverId);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteCode("");
    setSelectedServer(null);
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="alert alert-error max-w-md mx-auto">
          <span>{error}</span>
        </div>
        <button
          className="btn btn-primary mt-4"
          onClick={() => loadPublicServers(searchQuery)}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Discover Servers</h1>
        <p className="text-base-content/70">
          Find and join communities that match your interests
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="form-control w-full max-w-md">
          <input
            type="text"
            placeholder="Search servers..."
            className="input input-bordered w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoadingPublicServers && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingPublicServers && publicServers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">No servers found</h3>
          <p className="text-base-content/70">
            {searchQuery
              ? `No servers match "${searchQuery}". Try a different search term.`
              : "There are no public servers available right now."}
          </p>
        </div>
      )}

      {/* Server Grid */}
      {!isLoadingPublicServers && publicServers.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {publicServers.map((server) => (
            <div
              key={server.id}
              className="card bg-base-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="card-body">
                {/* Server Header */}
                <div className="flex items-start gap-3 mb-3">
                  {server.icon ? (
                    <img
                      src={server.icon}
                      alt={`${server.name} icon`}
                      className="w-12 h-12 rounded-lg object-cover bg-base-300"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-lg font-bold">
                      {server.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {server.name}
                    </h3>
                    <p className="text-sm text-base-content/70">
                      {server.member_count} members
                    </p>
                  </div>
                  {server.visibility === "private" && (
                    <div className="badge badge-secondary badge-sm">
                      Private
                    </div>
                  )}
                </div>

                {/* Server Description */}
                {server.description && (
                  <p className="text-sm text-base-content/80 mb-4 line-clamp-3">
                    {server.description}
                  </p>
                )}

                {/* Owner Info */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center text-xs">
                    👑
                  </div>
                  <span className="text-sm text-base-content/70">
                    Owner: {server.owner.display_name}
                  </span>
                </div>

                {/* Join Button */}
                <div className="card-actions">
                  {isUserMember(server.id) ? (
                    <button className="btn btn-success btn-sm w-full" disabled>
                      ✓ Already Joined
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm w-full"
                      onClick={() => handleJoinServer(server)}
                      disabled={joinningServerId === server.id}
                    >
                      {joinningServerId === server.id ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          Joining...
                        </>
                      ) : (
                        <>
                          {server.visibility === "private"
                            ? "🔒 Join (Invite Required)"
                            : "Join Server"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Private Server Invite Modal */}
      {showInviteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Join Private Server</h3>

            {selectedServer && (
              <div className="mb-4">
                <div className="flex items-center gap-3 p-3 bg-base-300 rounded-lg">
                  {selectedServer.icon ? (
                    <img
                      src={selectedServer.icon}
                      alt={`${selectedServer.name} icon`}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-bold">
                      {selectedServer.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold">{selectedServer.name}</h4>
                    <p className="text-sm text-base-content/70">
                      {selectedServer.member_count} members
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Invite Code</span>
              </label>
              <input
                type="text"
                placeholder="Enter invite code..."
                className="input input-bordered w-full"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePrivateJoin();
                  }
                }}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={closeInviteModal}
                disabled={joinningServerId === selectedServer?.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePrivateJoin}
                disabled={joinningServerId === selectedServer?.id}
              >
                {joinningServerId === selectedServer?.id ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Joining...
                  </>
                ) : (
                  "Join Server"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
