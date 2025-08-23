from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from .models import Channel, Message
from rest_framework.permissions import IsAuthenticated


class ChannelListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, server_id):
        pass

    def post(self, request, server_id):
        pass


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
