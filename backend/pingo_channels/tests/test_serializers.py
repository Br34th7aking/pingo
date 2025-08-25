# pingo_channels/tests/test_serializers.py

from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from servers.models import Server, ServerMembership
from pingo_channels.models import Channel, Message
from pingo_channels.serializers import (
    ChannelCreateSerializer,
    ChannelSerializer,
    MessageCreateSerializer,
    MessageSerializer,
)

User = get_user_model()


class ChannelCreateSerializerTests(TestCase):
    """Test ChannelCreateSerializer for input validation"""

    def test_valid_data_serialization(self):
        """Test serializer with valid channel data"""
        data = {"name": "test-channel", "description": "A test channel"}

        serializer = ChannelCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["name"], "test-channel")
        self.assertEqual(serializer.validated_data["description"], "A test channel")

    def test_minimal_valid_data(self):
        """Test serializer with minimal required data"""
        data = {"name": "minimal"}

        serializer = ChannelCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["name"], "minimal")

    def test_missing_required_field(self):
        """Test serializer fails with missing name"""
        data = {"description": "Missing name field"}

        serializer = ChannelCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_empty_name_validation(self):
        """Test serializer fails with empty name"""
        data = {"name": ""}

        serializer = ChannelCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)


class ChannelSerializerTests(TestCase):
    """Test ChannelSerializer for output representation"""

    def setUp(self):
        """Set up test fixtures"""
        self.factory = APIRequestFactory()
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        self.server = Server.objects.create(name="Test Server", owner=self.owner)

        # Add member to server
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )

        self.channel = Channel.objects.create(
            name="test-channel",
            description="Test description",
            server=self.server,
            created_by=self.owner,
        )

    def test_channel_serialization_basic_fields(self):
        """Test basic channel fields are serialized correctly"""
        serializer = ChannelSerializer(self.channel)
        data = serializer.data

        self.assertEqual(data["id"], str(self.channel.id))
        self.assertEqual(data["name"], "test-channel")
        self.assertEqual(data["description"], "Test description")
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)

    def test_channel_nested_server_serialization(self):
        """Test server field is properly nested"""
        serializer = ChannelSerializer(self.channel)
        data = serializer.data

        self.assertIn("server", data)
        self.assertEqual(data["server"]["name"], "Test Server")
        self.assertEqual(data["server"]["id"], str(self.server.id))

    def test_channel_nested_created_by_serialization(self):
        """Test created_by field is properly nested"""
        serializer = ChannelSerializer(self.channel)
        data = serializer.data

        self.assertIn("created_by", data)
        self.assertEqual(data["created_by"]["email"], "owner@test.com")

    def test_user_permissions_for_owner(self):
        """Test user_permissions field for channel owner"""
        request = self.factory.get("/")
        request.user = self.owner

        serializer = ChannelSerializer(self.channel, context={"request": request})
        data = serializer.data

        self.assertIn("user_permissions", data)
        permissions = data["user_permissions"]
        self.assertTrue(permissions["can_view"])
        self.assertTrue(permissions["can_read"])
        self.assertTrue(permissions["can_post"])

    def test_user_permissions_for_member(self):
        """Test user_permissions field for regular member"""
        request = self.factory.get("/")
        request.user = self.member

        serializer = ChannelSerializer(self.channel, context={"request": request})
        data = serializer.data

        permissions = data["user_permissions"]
        self.assertTrue(permissions["can_view"])
        self.assertTrue(permissions["can_read"])
        self.assertTrue(permissions["can_post"])

    def test_user_permissions_for_outsider(self):
        """Test user_permissions field for non-member"""
        request = self.factory.get("/")
        request.user = self.outsider

        serializer = ChannelSerializer(self.channel, context={"request": request})
        data = serializer.data

        permissions = data["user_permissions"]
        self.assertFalse(permissions["can_view"])
        self.assertFalse(permissions["can_read"])
        self.assertFalse(permissions["can_post"])

    def test_user_permissions_without_request_context(self):
        """Test user_permissions field without request in context"""
        serializer = ChannelSerializer(self.channel)
        data = serializer.data

        permissions = data["user_permissions"]
        self.assertFalse(permissions["can_view"])
        self.assertFalse(permissions["can_read"])
        self.assertFalse(permissions["can_post"])

    def test_admin_only_channel_permissions(self):
        """Test permissions for admin-only channel"""
        admin_channel = Channel.objects.create(
            name="admin-only",
            server=self.server,
            min_view_role="admin",
            min_read_role="admin",
            min_message_role="admin",
        )

        request = self.factory.get("/")
        request.user = self.member

        serializer = ChannelSerializer(admin_channel, context={"request": request})
        permissions = serializer.data["user_permissions"]

        # Member cannot access admin-only channel
        self.assertFalse(permissions["can_view"])
        self.assertFalse(permissions["can_read"])
        self.assertFalse(permissions["can_post"])


class MessageCreateSerializerTests(TestCase):
    """Test MessageCreateSerializer for input validation"""

    def test_valid_message_data(self):
        """Test serializer with valid message content"""
        data = {"content": "Hello world!"}

        serializer = MessageCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["content"], "Hello world!")

    def test_long_content_within_limit(self):
        """Test serializer accepts content up to max length"""
        long_content = "x" * 1000  # Max length from model
        data = {"content": long_content}

        serializer = MessageCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_empty_content_validation(self):
        """Test serializer fails with empty content"""
        data = {"content": ""}

        serializer = MessageCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("content", serializer.errors)

    def test_missing_content_field(self):
        """Test serializer fails with missing content"""
        data = {}

        serializer = MessageCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("content", serializer.errors)


class MessageSerializerTests(TestCase):
    """Test MessageSerializer for output representation"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email="user@test.com", password="testpass123"
        )
        self.server = Server.objects.create(name="Test Server", owner=self.user)
        self.channel = Channel.objects.create(
            name="test-channel", server=self.server, created_by=self.user
        )
        self.message = Message.objects.create(
            content="Test message content", channel=self.channel, author=self.user
        )

    def test_message_serialization_basic_fields(self):
        """Test basic message fields are serialized correctly"""
        serializer = MessageSerializer(self.message)
        data = serializer.data

        self.assertEqual(data["id"], str(self.message.id))
        self.assertEqual(data["content"], "Test message content")
        self.assertFalse(data["is_deleted"])
        self.assertIn("created_at", data)
        self.assertIn("updated_at", data)

    def test_message_author_serialization(self):
        """Test author field is properly nested"""
        serializer = MessageSerializer(self.message)
        data = serializer.data

        self.assertIn("author", data)
        self.assertEqual(data["author"]["email"], "user@test.com")

    def test_message_without_author(self):
        """Test message serialization when author is None"""
        message = Message.objects.create(
            content="Anonymous message", channel=self.channel, author=None
        )

        serializer = MessageSerializer(message)
        data = serializer.data

        self.assertIsNone(data["author"])
        self.assertEqual(data["content"], "Anonymous message")

    def test_deleted_message_serialization(self):
        """Test deleted message basic serialization"""
        deleted_message = Message.objects.create(
            content="This will be deleted",
            channel=self.channel,
            author=self.user,
            is_deleted=True,
        )

        serializer = MessageSerializer(deleted_message)
        data = serializer.data

        self.assertTrue(data["is_deleted"])
        # Note: Add to_representation test here if you implement it

    def test_multiple_messages_serialization(self):
        """Test serializing multiple messages"""
        message2 = Message.objects.create(
            content="Second message", channel=self.channel, author=self.user
        )

        messages = [self.message, message2]
        serializer = MessageSerializer(messages, many=True)
        data = serializer.data

        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["content"], "Test message content")
        self.assertEqual(data[1]["content"], "Second message")


class SerializerIntegrationTests(TestCase):
    """Integration tests for serializers working together"""

    def setUp(self):
        """Set up complex test scenario"""
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="testpass123"
        )

        self.server = Server.objects.create(name="Integration Server", owner=self.owner)

        ServerMembership.objects.create(
            user=self.admin, server=self.server, role="admin"
        )

    def test_create_and_retrieve_channel_workflow(self):
        """Test creating channel with CreateSerializer then reading with Serializer"""
        factory = APIRequestFactory()

        # Create channel using CreateSerializer
        create_data = {"name": "workflow-test", "description": "Testing workflow"}
        create_serializer = ChannelCreateSerializer(data=create_data)
        self.assertTrue(create_serializer.is_valid())

        # Simulate saving (would happen in view)
        channel = Channel.objects.create(
            server=self.server,
            created_by=self.owner,
            **create_serializer.validated_data
        )

        # Read back using output serializer
        request = factory.get("/")
        request.user = self.admin

        output_serializer = ChannelSerializer(channel, context={"request": request})
        output_data = output_serializer.data

        self.assertEqual(output_data["name"], "workflow-test")
        self.assertEqual(output_data["description"], "Testing workflow")
        self.assertTrue(output_data["user_permissions"]["can_view"])

    def test_create_and_retrieve_message_workflow(self):
        """Test creating message with CreateSerializer then reading with Serializer"""
        channel = Channel.objects.create(
            name="test-channel", server=self.server, created_by=self.owner
        )

        # Create message using CreateSerializer
        create_data = {"content": "Integration test message"}
        create_serializer = MessageCreateSerializer(data=create_data)
        self.assertTrue(create_serializer.is_valid())

        # Simulate saving
        message = Message.objects.create(
            channel=channel, author=self.admin, **create_serializer.validated_data
        )

        # Read back using output serializer
        output_serializer = MessageSerializer(message)
        output_data = output_serializer.data

        self.assertEqual(output_data["content"], "Integration test message")
        self.assertEqual(output_data["author"]["email"], "admin@test.com")
        self.assertFalse(output_data["is_deleted"])
