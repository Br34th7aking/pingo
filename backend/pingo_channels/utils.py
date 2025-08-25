from rest_framework.response import Response
from rest_framework import status
from servers.models import Server
from pingo_channels.models import Channel, Message


def get_channel_and_check_access(
    request, server_id, channel_id, required_permission="can_view"
):
    try:
        server = Server.objects.get(pk=server_id)
    except Server.DoesNotExist:
        return (
            None,
            None,
            Response({"error": "Server not found."}, status=status.HTTP_404_NOT_FOUND),
        )

    membership = server.membership.filter(user=request.user).first()
    if not membership:
        return (
            None,
            None,
            Response(
                {"error": "You are not a member of this server."},
                status=status.HTTP_403_FORBIDDEN,
            ),
        )

    try:
        channel = server.channels.get(pk=channel_id)
    except Channel.DoesNotExist:
        return (
            None,
            membership,
            Response({"error": "Channel not found."}, status=status.HTTP_404_NOT_FOUND),
        )
    # Check channel permissions
    permissions = channel.get_user_permissions(request.user)
    if not permissions[required_permission]:
        return (
            None,
            membership,
            Response(
                {
                    "error": f'You do not have permission to {required_permission.replace("can_", "")} this channel'
                },
                status=status.HTTP_403_FORBIDDEN,
            ),
        )

    return channel, membership, None


def get_message_and_check_access(
    request,
    server_id,
    channel_id,
    message_id,
    required_permission="can_read",
    require_author=False,
):
    channel, membership, error_response = get_channel_and_check_access(
        request, server_id, channel_id, required_permission
    )
    if error_response:
        return None, None, None, error_response

    try:
        message = channel.messages.get(pk=message_id)
    except Message.DoesNotExist:
        return (
            None,
            None,
            None,
            Response({"error": "Message not found."}, status=status.HTTP_404_NOT_FOUND),
        )

    # Check author permission if required
    if require_author and message.author != request.user:
        # Allow admins/owners/moderators to modify any message
        if membership.role not in ["owner", "admin", "moderators"]:
            return (
                None,
                None,
                None,
                Response(
                    {"error": "You can only modify your own messages."},
                    status=status.HTTP_403_FORBIDDEN,
                ),
            )

    return channel, membership, message, None
