from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from .models import Channel, Message
from rest_framework.permissions import IsAuthenticated
from .serializers import ChannelSerializer, ChannelCreateSerializer
from servers.models import Server


class ChannelListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, server_id):
        # server must exist
        try:
            server = Server.objects.get(pk=server_id)
        except Server.DoesNotExist:
            return Response(
                {"error": "Server not found."}, status=status.HTTP_404_NOT_FOUND
            )
        # user must be a server member
        membership = server.membership.filter(user=request.user).first()
        if not membership:
            return Response(
                {"error": "You are not a member of this server."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # user must only see channels they have permissions for
        permitted_channels = []
        for channel in server.channels.all():
            permissions = channel.get_user_permissions(request.user)
            if permissions["can_view"]:
                permitted_channels.append(channel)

        serializer = ChannelSerializer(
            permitted_channels, many=True, context={"request": request}
        )
        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, server_id):
        try:
            server = Server.objects.get(pk=server_id)
        except Server.DoesNotExist:
            return Response(
                {"error": "Server not found."}, status=status.HTTP_404_NOT_FOUND
            )

        membership = server.membership.filter(user=request.user).first()
        if not membership:
            return Response(
                {"error": "You are not a member of this server."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # only the owner/admin of a server can create a channel
        if membership.role in ["owner", "admin"]:
            channel_serializer = ChannelCreateSerializer(data=request.data)
            if channel_serializer.is_valid():
                if Channel.objects.filter(
                    server=server, name=channel_serializer.validated_data["name"]
                ).exists():
                    return Response(
                        {
                            "error": f'Channel "{channel_serializer.validated_data["name"]}" already exists in this server'
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                new_channel = channel_serializer.save(
                    server=server, created_by=request.user
                )
                response_serializer = ChannelSerializer(
                    new_channel, context={"request": request}
                )
                return Response(
                    {
                        "message": "Channel created successfully.",
                        "channel": response_serializer.data,
                    },
                    status=status.HTTP_201_CREATED,
                )
            else:
                return Response(
                    channel_serializer.errors, status=status.HTTP_400_BAD_REQUEST
                )
        else:
            return Response(
                {
                    "error": "Permission Denied. You can not create a channel on this server."
                },
                status=status.HTTP_403_FORBIDDEN,
            )


class ChannelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_channel_and_check_access(
        self, request, server_id, channel_id, required_permission="can_view"
    ):
        try:
            server = Server.objects.get(pk=server_id)
        except Server.DoesNotExist:
            return (
                None,
                None,
                Response(
                    {"error": "Server not found."}, status=status.HTTP_404_NOT_FOUND
                ),
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
                Response(
                    {"error": "Channel not found."}, status=status.HTTP_400_BAD_REQUEST
                ),
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

    def get(self, request, server_id, channel_id):

        channel, _, error_response = self.get_channel_and_check_access(
            request, server_id, channel_id, "can_view"
        )

        if error_response:
            return error_response

        channel_serializer = ChannelSerializer(channel, context={"request": request})
        return Response(channel_serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, server_id, channel_id):
        channel, membership, error_response = self.get_channel_and_check_access(
            request, server_id, channel_id, "can_view"
        )
        if error_response:
            return error_response

        if membership.role not in ["owner", "admin"]:
            return Response(
                {"error": "You do not have permission to update this channel."},
                status=status.HTTP_403_FORBIDDEN,
            )

        channel_serializer = ChannelCreateSerializer(
            channel, data=request.data, partial=True
        )

        if channel_serializer.is_valid():
            if "name" in channel_serializer.validated_data:
                if (
                    Channel.objects.filter(
                        server=channel.server,
                        name=channel_serializer.validated_data["name"],
                    )
                    .exclude(id=channel_id)
                    .exists()
                ):
                    return Response(
                        {"error": "Another channel with the same name already exists."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                updated_channel = channel_serializer.save()
                response_serializer = ChannelSerializer(
                    updated_channel, context={"request": request}
                )
                return Response(response_serializer.data, status=status.HTTP_200_OK)
        return Response(
            {"error": "Can not update the channel details."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, server_id, channel_id):
        channel, membership, error_response = self.get_channel_and_check_access(
            request, server_id, channel_id
        )

        if error_response:
            return error_response

        if membership.role != "owner":
            return Response(
                {"error": "Only server owner can delete channels"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Prevent deleting default channel
        if channel.name == "general":
            return Response(
                {"error": 'Cannot delete the default "general" channel'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        channel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, server_id, channel_id):
        pass

    def post(self, request, server_id, channel_id):
        pass


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, server_id, channel_id, message_id):
        pass

    def patch(self, request, server_id, channel_id, message_id):
        pass

    def delete(self, request, server_id, channel_id, message_id):
        pass
