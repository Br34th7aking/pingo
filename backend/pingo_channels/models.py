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
