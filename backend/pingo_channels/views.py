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

    def get(self, request, server_id, channel_id):
        pass

    def patch(self, request, server_id, channel_id):
        pass

    def delete(self, request, server_id, channel_id):
        pass


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
