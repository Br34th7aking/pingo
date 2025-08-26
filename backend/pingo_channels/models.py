from django.db import models
from django.conf import settings
from common.models import TimeStampedBaseModel
from servers.models import Server


class Channel(TimeStampedBaseModel):
    ROLE_CHOICES = (
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("moderator", "Moderator"),
        ("member", "Member"),
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    server = models.ForeignKey(
        Server, on_delete=models.CASCADE, related_name="channels"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    min_view_role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default="member"
    )
    min_read_role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default="member"
    )
    min_message_role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default="member"
    )

    def __str__(self):
        return f"{self.name}"

    class Meta:
        unique_together = ["server", "name"]

    def get_user_permissions(self, user):
        membership = self.server.membership.filter(user=user).first()
        if not membership:
            return {"can_view": False, "can_read": False, "can_post": False}

        role_hierarchy = {"member": 0, "moderator": 1, "admin": 2, "owner": 3}

        user_level = role_hierarchy.get(membership.role, 0)

        return {
            "can_view": user_level >= role_hierarchy.get(self.min_view_role, 0),
            "can_read": user_level >= role_hierarchy.get(self.min_read_role, 0),
            "can_post": user_level >= role_hierarchy.get(self.min_message_role, 0),
        }


class Message(TimeStampedBaseModel):
    content = models.TextField(max_length=1000)
    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="messages"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.content[:30]}"


# Add these models to your existing pingo_channels/models.py file


class DirectMessageConversation(TimeStampedBaseModel):
    participant1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dm_conversations_as_p1",
    )
    participant2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dm_conversations_as_p2",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["participant1", "participant2"], name="unique_dm_conversation"
            )
        ]
        ordering = ["-updated_at"]

    def __str__(self):
        return (
            f"DM: {self.participant1.display_name} ↔ {self.participant2.display_name}"
        )

    def get_other_participant(self, user):
        if user == self.participant1:
            return self.participant2
        elif user == self.participant2:
            return self.participant1
        else:
            return None

    def is_participant(self, user):
        return user in [self.participant1, self.participant2]

    @classmethod
    def get_or_create_conversation(cls, user1, user2):

        if user1 == user2:
            # block the conversation
            raise ValueError(
                "Can not create a conversation with yourself. Create a private server instead."
            )

        if str(user1.id) > str(user2.id):
            user1, user2 = user2, user1

        conversation, created = cls.objects.get_or_create(
            participant1=user1, participant2=user2
        )
        return conversation, created


class DirectMessage(TimeStampedBaseModel):

    conversation = models.ForeignKey(
        DirectMessageConversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["conversation", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        return f"DM from {self.sender.username}: {self.content[:50]}..."

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.conversation.updated_at = self.created_at
        self.conversation.save(update_fields=["updated_at"])
