from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
import uuid


class CustomUserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_email_verified", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(max_length=255, unique=True)
    display_name = models.CharField(max_length=75, blank=True, default="User")
    phone = models.CharField(max_length=20, blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    DM_PRIVACY_CHOICES = (
        ("everyone", "Everyone can dm me"),
        ("friends", "Only friends can dm me"),  # TODO: friend system
        ("none", "No one can dm me"),
    )

    allow_dms_from = models.CharField(
        choices=DM_PRIVACY_CHOICES, max_length=20, default="everyone"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.display_name} ({self.email})"

    def can_receive_dm_from(self, sender):
        """Check if this user can receive DM from sender_user"""
        if self.allow_dms_from == "everyone":
            return True
        elif self.allow_dms_from == "none":
            return False
        elif self.allow_dms_from == "friends":
            return True
        return False
