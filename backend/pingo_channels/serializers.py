from rest_framework import serializers
from .models import Channel, Message, DirectMessage, DirectMessageConversation
from accounts.serializers import UserProfileSerializer
from servers.serializers import ServerSerializer
from django.conf import settings


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


class DirectMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectMessage
        fields = ["content"]


class DirectMessageSerializer(serializers.ModelSerializer):
    sender = UserProfileSerializer(read_only=True)

    class Meta:
        model = DirectMessage
        fields = [
            "id",
            "content",
            "sender",
            "conversation",
            "created_at",
            "updated_at",
            "is_read",
        ]

    def to_representation(self, instance):
        """Hide content of deleted messages"""
        data = super().to_representation(instance)
        # if instance.is_deleted:
        # data["content"] = "[Message deleted]"
        return data


User = settings.AUTH_USER_MODEL


class DirectMessageConversationCreateSerializer(serializers.Serializer):
    recipient_id = serializers.UUIDField()

    def validate_recipient_id(self, value):
        request = self.context.get("request")

        try:
            recipient = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        if request and request.user == recipient:
            raise serializers.ValidationError(
                "Cannot create DM conversation with yourself. Create a private server instead."
            )

        if not recipient.can_receive_dm_from(request.user):
            raise serializers.ValidationError(
                "This user has restricted DM permissions."
            )

        return value

    def create(self, validated_data):
        request = self.context["request"]
        recipient = User.objects.get(id=validated_data["recipient_id"])

        conversation, created = DirectMessageConversation.get_or_create_conversation(
            request.user, recipient
        )

        return conversation


class DirectMessageConversationSerializer(serializers.ModelSerializer):
    participant1 = UserProfileSerializer(read_only=True)
    participant2 = UserProfileSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessageConversation
        fields = [
            "id",
            "participant1",
            "participant2",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        ]

        read_only_fields = ["id", "created_at", "updated_at"]

    def get_last_message(self, obj):
        last_message = obj.messages.first()  # Due to ordering = ['-created_at']
        if last_message:
            return DirectMessageSerializer(last_message).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return (
                obj.messages.filter(is_read=False).exclude(sender=request.user).count()
            )
        return 0
