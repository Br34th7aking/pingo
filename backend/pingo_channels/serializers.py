from rest_framework import serializers
from .models import Channel, Message
from accounts.serializers import UserProfileSerializer
from servers.serializers import ServerSerializer


class ChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ["name", "description"]


class ChannelSerializer(serializers.ModelSerializer):
    server = ServerSerializer(read_only=True)
    created_by = UserProfileSerializer(read_only=True)

    user_permissions = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            "id",
            "name",
            "description",
            "server",
            "min_read_role",
            "min_view_role",
            "min_message_role",
            "user_permissions",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_user_permissions(self, obj):
        """Get current user's permissions for this channel"""
        request = self.context.get("request")
        if request and request.user:
            return obj.get_user_permissions(request.user)
        return {"can_view": False, "can_read": False, "can_post": False}


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["content"]


class MessageSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "content",
            "is_deleted",
            "author",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        """Hide content of deleted messages"""
        data = super().to_representation(instance)
        if instance.is_deleted:
            data["content"] = "[Message deleted]"
        return data
