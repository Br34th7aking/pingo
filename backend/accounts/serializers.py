from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser


class UserRegistrationSerializer(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "email",
            "password",
            "password_confirm",
            "display_name",
            "phone",
            "bio",
        ]

    def validate_email(self, value):
        email = value.lower()
        if CustomUser.objects.filter(email__iexact=email):
            raise serializers.ValidationError("User with this email already exists.")
        return email

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError("Passwords must match.")
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = CustomUser.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "display_name",
            "bio",
            "phone",
            "avatar",
            "is_email_verified",
            "date_joined",
            "allow_dms_from",
        ]
        read_only_fields = ["id", "email", "is_email_verified", "date_joined"]


class UserSearchSerializer(serializers.ModelSerializer):
    can_dm = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ["id", "email", "display_name", "avatar", "can_dm"]

    def get_can_dm(self, obj):
        """Check if current user can DM this user"""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.can_receive_dm_from(request.user)
        return False
