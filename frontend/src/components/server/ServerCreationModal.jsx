import { useState } from "react";
import { useForm } from "react-hook-form";
import { useServer } from "../../contexts/ServerContext";
import { useUI } from "../../contexts/UIContext";

export default function ServerCreationModal({ isOpen, onClose }) {
  const { createServer } = useServer();
  const { addToast } = useUI();
  const [iconPreview, setIconPreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    defaultValues: {
      name: "",
      description: "",
      visibility: "public",
      icon: null,
    },
  });

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
    setIconPreview(null);
    // Clear file input
    const fileInput = document.getElementById("server-icon-input");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onSubmit = async (data) => {
    setIsCreating(true);

    try {
      const result = await createServer(data);

      if (result.success) {
        addToast({
          type: "success",
          message: `Server "${data.name}" created successfully!`,
          duration: 3000,
        });

        // Reset form and close modal
        reset();
        setIconPreview(null);
        onClose();
      } else {
        addToast({
          type: "error",
          message: result.error || "Failed to create server",
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
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (isCreating) return; // Prevent closing while creating
    reset();
    setIconPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-xl mb-6">Create Your Server</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server Icon */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Server Icon (Optional)</span>
            </label>

            <div className="flex items-center gap-4">
              {/* Icon Preview */}
              <div className="w-20 h-20 rounded-lg bg-base-300 flex items-center justify-center overflow-hidden">
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt="Server icon preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-2xl text-base-content/50">
                    {watch("name")
                      ? watch("name").charAt(0).toUpperCase()
                      : "📷"}
                  </div>
                )}
              </div>

              {/* Upload/Remove Buttons */}
              <div className="flex-1">
                <input
                  id="server-icon-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleIconChange}
                />

                <div className="space-y-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm w-full"
                    onClick={() =>
                      document.getElementById("server-icon-input").click()
                    }
                  >
                    Choose Image
                  </button>

                  {iconPreview && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm w-full text-error"
                      onClick={removeIcon}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <p className="text-xs text-base-content/60 mt-1">
                  Max 5MB, PNG/JPG/GIF
                </p>
              </div>
            </div>
          </div>

          {/* Server Name */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Server Name *</span>
            </label>
            <input
              type="text"
              className={`input input-bordered w-full ${
                errors.name ? "input-error" : ""
              }`}
              placeholder="My Awesome Server"
              {...register("name", {
                required: "Server name is required",
                minLength: {
                  value: 2,
                  message: "Server name must be at least 2 characters",
                },
                maxLength: {
                  value: 100,
                  message: "Server name must be less than 100 characters",
                },
                pattern: {
                  value: /^[a-zA-Z0-9\s\-_!@#$%^&*()+={}[\]:";'<>,.?/~`|\\]*$/,
                  message: "Server name contains invalid characters",
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
              <span className="label-text">Description (Optional)</span>
            </label>
            <textarea
              className={`textarea textarea-bordered w-full h-20 resize-none ${
                errors.description ? "textarea-error" : ""
              }`}
              placeholder="Tell people what your server is about..."
              {...register("description", {
                maxLength: {
                  value: 500,
                  message: "Description must be less than 500 characters",
                },
              })}
            />
            {errors.description && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.description.message}
                </span>
              </label>
            )}
            <label className="label">
              <span className="label-text-alt">
                {watch("description")?.length || 0}/500 characters
              </span>
            </label>
          </div>

          {/* Visibility */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Server Visibility</span>
            </label>
            <div className="space-y-2">
              <label className="label cursor-pointer">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    className="radio radio-primary"
                    value="public"
                    {...register("visibility")}
                  />
                  <div>
                    <span className="label-text font-medium">
                      🌍 Public Server
                    </span>
                    <p className="text-xs text-base-content/70 mt-1">
                      Anyone can discover and join this server
                    </p>
                  </div>
                </div>
                <span></span>
              </label>

              <label className="label cursor-pointer">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    className="radio radio-primary"
                    value="private"
                    {...register("visibility")}
                  />
                  <div>
                    <span className="label-text font-medium">
                      🔒 Private Server
                    </span>
                    <p className="text-xs text-base-content/70 mt-1">
                      Only users with an invite code can join
                    </p>
                  </div>
                </div>
                <span></span>
              </label>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="alert alert-info">
            <div className="text-sm">
              <p className="font-medium mb-1">📋 Server Setup</p>
              <p>
                After creating your server, you'll be the owner with full
                administrative rights. A "general" channel will be created
                automatically.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Creating...
                </>
              ) : (
                "Create Server"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
