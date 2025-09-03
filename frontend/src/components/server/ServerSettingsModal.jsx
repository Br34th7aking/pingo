import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useServer } from "../../contexts/ServerContext";
import { useUI } from "../../contexts/UIContext";
import { useAuth } from "../../contexts/AuthContext";

export default function ServerSettingsModal({ isOpen, onClose, server }) {
  const {
    updateServer,
    deleteServer,
    loadServerMembers,
    activeServerMembers,
    leaveServer,
  } = useServer();
  const { addToast } = useUI();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [iconPreview, setIconPreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm();

  // Initialize form with server data
  useEffect(() => {
    if (server && isOpen) {
      reset({
        name: server.name,
        description: server.description || "",
        visibility: server.visibility,
      });
      setIconPreview(server.icon || null);
      // Load server members for the members tab
      loadServerMembers(server.id);
    }
  }, [server, isOpen, reset, loadServerMembers]);

  // Check if current user is owner or admin
  const isOwner = server && user && server.owner.id === user.id;
  const currentMembership = activeServerMembers?.find(
    (m) => m.user.id === user.id
  );
  const isAdmin = currentMembership?.role === "admin";
  const canManageServer = isOwner || isAdmin;

  const handleIconChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        addToast({
          type: "error",
          message: "Please select a valid image file",
          duration: 3000,
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        addToast({
          type: "error",
          message: "Image must be smaller than 5MB",
          duration: 3000,
        });
        return;
      }

      setValue("icon", file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIcon = () => {
    setValue("icon", null);
    setIconPreview(server.icon); // Reset to original server icon
    const fileInput = document.getElementById("server-settings-icon-input");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onSubmit = async (data) => {
    if (!canManageServer) return;

    setIsUpdating(true);
    try {
      const result = await updateServer(server.id, data);

      if (result.success) {
        addToast({
          type: "success",
          message: "Server updated successfully!",
          duration: 3000,
        });
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to update server",
          duration: 4000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        message: "An unexpected error occurred",
        duration: 4000,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteServer = async () => {
    if (deleteConfirmText !== server.name) {
      addToast({
        type: "error",
        message: `Please type "${server.name}" to confirm deletion`,
        duration: 3000,
      });
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteServer(server.id);

      if (result.success) {
        addToast({
          type: "success",
          message: "Server deleted successfully",
          duration: 3000,
        });
        onClose();
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to delete server",
          duration: 4000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        message: "An unexpected error occurred",
        duration: 4000,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  const handleLeaveServer = async () => {
    try {
      const result = await leaveServer(server.id, user.id);

      if (result.success) {
        addToast({
          type: "success",
          message: result.message || "Left server successfully",
          duration: 3000,
        });
        onClose();
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to leave server",
          duration: 4000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        message: "An unexpected error occurred",
        duration: 4000,
      });
    }
  };

  const handleClose = () => {
    if (isUpdating || isDeleting) return;
    setActiveTab("overview");
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    onClose();
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "owner":
        return "badge-error";
      case "admin":
        return "badge-warning";
      case "moderator":
        return "badge-info";
      default:
        return "badge-ghost";
    }
  };

  if (!isOpen || !server) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl max-h-none">
        {/* Header */}
        <h3 className="font-bold text-xl mb-4">Server Settings</h3>

        {/* Tabs */}
        <div className="tabs tabs-bordered mb-6">
          <button
            className={`tab ${activeTab === "overview" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === "members" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            Members ({activeServerMembers?.length || 0})
          </button>
          <button
            className={`tab ${activeTab === "actions" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("actions")}
          >
            Actions
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-2">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Server Icon */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Server Icon</span>
                </label>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-base-300 flex items-center justify-center overflow-hidden">
                    {iconPreview ? (
                      <img
                        src={iconPreview}
                        alt="Server icon"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-2xl text-base-content/50">
                        {server.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {canManageServer && (
                    <div className="flex-1">
                      <input
                        id="server-settings-icon-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleIconChange}
                      />

                      <div className="space-y-2">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            document
                              .getElementById("server-settings-icon-input")
                              .click()
                          }
                        >
                          Change Icon
                        </button>

                        {iconPreview && iconPreview !== server.icon && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-error"
                            onClick={removeIcon}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Server Name */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Server Name</span>
                </label>
                <input
                  type="text"
                  className={`input input-bordered w-full ${
                    errors.name ? "input-error" : ""
                  }`}
                  disabled={!canManageServer}
                  {...register("name", {
                    required: canManageServer
                      ? "Server name is required"
                      : false,
                    minLength: {
                      value: 2,
                      message: "Server name must be at least 2 characters",
                    },
                    maxLength: {
                      value: 100,
                      message: "Server name must be less than 100 characters",
                    },
                  })}
                />
                {errors.name && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {errors.name.message}
                    </span>
                  </label>
                )}
              </div>

              {/* Description */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className={`textarea textarea-bordered w-full h-20 resize-none ${
                    errors.description ? "textarea-error" : ""
                  }`}
                  disabled={!canManageServer}
                  {...register("description", {
                    maxLength: {
                      value: 500,
                      message: "Description must be less than 500 characters",
                    },
                  })}
                />
                {canManageServer && (
                  <label className="label">
                    <span className="label-text-alt">
                      {watch("description")?.length || 0}/500 characters
                    </span>
                  </label>
                )}
              </div>

              {/* Visibility */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Server Visibility</span>
                </label>
                <div className="space-y-2">
                  <label className="label cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        className="radio radio-primary"
                        value="public"
                        disabled={!canManageServer}
                        {...register("visibility")}
                      />
                      <span className="label-text">Public Server</span>
                    </div>
                    <span></span>
                  </label>

                  <label className="label cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        className="radio radio-primary"
                        value="private"
                        disabled={!canManageServer}
                        {...register("visibility")}
                      />
                      <span className="label-text">Private Server</span>
                    </div>
                    <span></span>
                  </label>
                </div>
              </div>

              {/* Server Info */}
              <div className="bg-base-200 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-base-content/70">Created:</span>
                  <span className="text-sm">
                    {new Date(server.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-base-content/70">Members:</span>
                  <span className="text-sm">{server.member_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-base-content/70">Owner:</span>
                  <span className="text-sm">{server.owner.display_name}</span>
                </div>
              </div>

              {/* Actions */}
              {canManageServer && (
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold">Server Members</h4>
                <span className="text-sm text-base-content/70">
                  {activeServerMembers?.length || 0} members
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {activeServerMembers?.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                        {membership.user.avatar ? (
                          <img
                            src={membership.user.avatar}
                            alt={membership.user.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium">
                            {membership.user.display_name
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {membership.user.display_name}
                        </p>
                        <p className="text-sm text-base-content/70">
                          {membership.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${getRoleBadgeColor(
                          membership.role
                        )}`}
                      >
                        {membership.role}
                      </span>
                      <span className="text-xs text-base-content/50">
                        Joined{" "}
                        {new Date(membership.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold">Server Actions</h4>

              {/* Leave Server (for non-owners) */}
              {!isOwner && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h5 className="card-title text-warning">Leave Server</h5>
                    <p className="text-sm text-base-content/70 mb-4">
                      You will lose access to all channels and messages in this
                      server. You can rejoin later if the server is public or if
                      you have an invite code.
                    </p>
                    <button
                      className="btn btn-warning btn-sm w-fit"
                      onClick={handleLeaveServer}
                    >
                      Leave Server
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Server (owners only) */}
              {isOwner && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h5 className="card-title text-error">Delete Server</h5>
                    <p className="text-sm text-base-content/70 mb-4">
                      Permanently delete this server and all its data. This
                      action cannot be undone. All {server.member_count} members
                      will lose access immediately.
                    </p>

                    {!showDeleteConfirm ? (
                      <button
                        className="btn btn-error btn-sm w-fit"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Delete Server
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text">
                              Type "{server.name}" to confirm deletion:
                            </span>
                          </label>
                          <input
                            type="text"
                            className="input input-bordered w-full max-w-xs"
                            value={deleteConfirmText}
                            onChange={(e) =>
                              setDeleteConfirmText(e.target.value)
                            }
                            placeholder={server.name}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeleteConfirmText("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-error btn-sm"
                            onClick={handleDeleteServer}
                            disabled={
                              deleteConfirmText !== server.name || isDeleting
                            }
                          >
                            {isDeleting ? (
                              <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Deleting...
                              </>
                            ) : (
                              "Delete Forever"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Server Information */}
              <div className="bg-base-200 p-4 rounded-lg">
                <h6 className="font-semibold mb-2">Server Information</h6>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-base-content/70">Your Role:</span>
                    <span
                      className={`badge ${
                        isOwner ? "badge-error" : "badge-ghost"
                      }`}
                    >
                      {isOwner ? "Owner" : currentMembership?.role || "Member"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/70">Joined:</span>
                    <span>
                      {currentMembership?.created_at
                        ? new Date(
                            currentMembership.created_at
                          ).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/70">Server ID:</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        navigator.clipboard.writeText(server.id);
                        addToast({
                          type: "info",
                          message: "Server ID copied!",
                          duration: 2000,
                        });
                      }}
                    >
                      Copy ID
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="modal-action">
          <button
            className="btn"
            onClick={handleClose}
            disabled={isUpdating || isDeleting}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
