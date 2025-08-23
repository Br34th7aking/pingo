# pingo_channels/tests/test_models.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from servers.models import Server, ServerMembership
from pingo_channels.models import Channel, Message
from django.db.models.signals import post_save

User = get_user_model()


class ChannelModelTests(TestCase):
    """Test Channel model functionality"""

    def setUp(self):
        """Set up test fixtures"""
        # Disconnect signal for testing
        from pingo_channels.signals import create_default_channel
        from servers.models import Server

        post_save.disconnect(create_default_channel, sender=Server)

        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="testpass123"
        )
        self.moderator = User.objects.create_user(
            email="moderator@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        self.server = Server.objects.create(
            name="Test Server", description="A test server", owner=self.owner
        )

        # Create memberships with different roles
        ServerMembership.objects.create(
            user=self.admin, server=self.server, role="admin"
        )
        ServerMembership.objects.create(
            user=self.moderator, server=self.server, role="moderator"
        )
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )
        # owner membership is auto-created by Server.save()

    def tearDown(self):
        # Reconnect signal after tests
        from pingo_channels.signals import create_default_channel
        from servers.models import Server

        post_save.connect(create_default_channel, sender=Server)

    def test_channel_creation_success(self):
        """Test successful channel creation"""
        channel = Channel.objects.create(
            name="test-channel",
            description="A test channel",
            server=self.server,
            created_by=self.owner,
        )

        self.assertEqual(channel.name, "test-channel")
        self.assertEqual(channel.description, "A test channel")
        self.assertEqual(channel.server, self.server)
        self.assertEqual(channel.created_by, self.owner)
        self.assertEqual(channel.min_view_role, "member")  # Default
        self.assertEqual(channel.min_read_role, "member")  # Default
        self.assertEqual(channel.min_message_role, "member")  # Default

    def test_channel_creation_minimal_fields(self):
        """Test channel creation with minimal required fields"""
        channel = Channel.objects.create(name="minimal", server=self.server)

        self.assertEqual(channel.name, "minimal")
        self.assertEqual(channel.description, None)
        self.assertIsNone(channel.created_by)

    def test_channel_string_representation(self):
        """Test channel __str__ method"""
        channel = Channel.objects.create(name="general", server=self.server)

        self.assertEqual(str(channel), "general")

    def test_channel_unique_together_constraint(self):
        """Test that channel names must be unique per server"""
        Channel.objects.create(name="general", server=self.server)

        with self.assertRaises(IntegrityError):
            Channel.objects.create(name="general", server=self.server)

    def test_channel_same_name_different_servers(self):
        """Test that same channel name allowed in different servers"""
        server2 = Server.objects.create(name="Server 2", owner=self.owner)

        channel1 = Channel.objects.create(name="general", server=self.server)
        channel2 = Channel.objects.create(name="general", server=server2)

        self.assertNotEqual(channel1, channel2)
        self.assertEqual(channel1.name, channel2.name)

    def test_channel_role_choices_validation(self):
        """Test that only valid roles are accepted"""
        # Valid roles should work
        channel = Channel.objects.create(
            name="test",
            server=self.server,
            min_view_role="admin",
            min_read_role="moderator",
            min_message_role="owner",
        )

        self.assertEqual(channel.min_view_role, "admin")
        self.assertEqual(channel.min_read_role, "moderator")
        self.assertEqual(channel.min_message_role, "owner")


class ChannelPermissionTests(TestCase):
    """Test Channel permission logic"""

    def setUp(self):
        """Set up test fixtures for permission testing"""
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="testpass123"
        )
        self.moderator = User.objects.create_user(
            email="moderator@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        self.server = Server.objects.create(name="Test Server", owner=self.owner)

        # Create memberships
        ServerMembership.objects.create(
            user=self.admin, server=self.server, role="admin"
        )
        ServerMembership.objects.create(
            user=self.moderator, server=self.server, role="moderator"
        )
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )

    def test_owner_permissions_all_levels(self):
        """Test owner has access to all permission levels"""
        test_cases = [
            ("member", "member", "member"),
            ("moderator", "moderator", "moderator"),
            ("admin", "admin", "admin"),
            ("owner", "owner", "owner"),
        ]

        for view_role, read_role, message_role in test_cases:
            with self.subTest(
                f"view={view_role}, read={read_role}, message={message_role}"
            ):
                channel = Channel.objects.create(
                    name=f"test-{view_role}",
                    server=self.server,
                    min_view_role=view_role,
                    min_read_role=read_role,
                    min_message_role=message_role,
                )

                perms = channel.get_user_permissions(self.owner)
                self.assertTrue(perms["can_view"])
                self.assertTrue(perms["can_read"])
                self.assertTrue(perms["can_post"])

    def test_admin_permissions(self):
        """Test admin permissions vs different requirements"""
        test_cases = [
            # (min_role, expected_view, expected_read, expected_post)
            ("member", True, True, True),
            ("moderator", True, True, True),
            ("admin", True, True, True),
            ("owner", False, False, False),  # Admin cannot access owner-only
        ]

        for role_requirement, exp_view, exp_read, exp_post in test_cases:
            with self.subTest(f"admin vs {role_requirement} requirement"):
                channel = Channel.objects.create(
                    name=f"test-{role_requirement}",
                    server=self.server,
                    min_view_role=role_requirement,
                    min_read_role=role_requirement,
                    min_message_role=role_requirement,
                )

                perms = channel.get_user_permissions(self.admin)
                self.assertEqual(perms["can_view"], exp_view)
                self.assertEqual(perms["can_read"], exp_read)
                self.assertEqual(perms["can_post"], exp_post)

    def test_moderator_permissions(self):
        """Test moderator permissions vs different requirements"""
        test_cases = [
            ("member", True, True, True),
            ("moderator", True, True, True),
            ("admin", False, False, False),
            ("owner", False, False, False),
        ]

        for role_requirement, exp_view, exp_read, exp_post in test_cases:
            with self.subTest(f"moderator vs {role_requirement} requirement"):
                channel = Channel.objects.create(
                    name=f"test-{role_requirement}",
                    server=self.server,
                    min_view_role=role_requirement,
                    min_read_role=role_requirement,
                    min_message_role=role_requirement,
                )

                perms = channel.get_user_permissions(self.moderator)
                self.assertEqual(perms["can_view"], exp_view)
                self.assertEqual(perms["can_read"], exp_read)
                self.assertEqual(perms["can_post"], exp_post)

    def test_member_permissions(self):
        """Test member permissions vs different requirements"""
        test_cases = [
            ("member", True, True, True),
            ("moderator", False, False, False),
            ("admin", False, False, False),
            ("owner", False, False, False),
        ]

        for role_requirement, exp_view, exp_read, exp_post in test_cases:
            with self.subTest(f"member vs {role_requirement} requirement"):
                channel = Channel.objects.create(
                    name=f"test-{role_requirement}",
                    server=self.server,
                    min_view_role=role_requirement,
                    min_read_role=role_requirement,
                    min_message_role=role_requirement,
                )

                perms = channel.get_user_permissions(self.member)
                self.assertEqual(perms["can_view"], exp_view)
                self.assertEqual(perms["can_read"], exp_read)
                self.assertEqual(perms["can_post"], exp_post)

    def test_non_member_permissions(self):
        """Test that non-server-members have no permissions"""
        channel = Channel.objects.create(name="test", server=self.server)

        perms = channel.get_user_permissions(self.outsider)
        self.assertFalse(perms["can_view"])
        self.assertFalse(perms["can_read"])
        self.assertFalse(perms["can_post"])

    def test_mixed_permission_levels(self):
        """Test channels with different permission levels for view/read/message"""
        channel = Channel.objects.create(
            name="mixed-perms",
            server=self.server,
            min_view_role="member",  # Everyone can see
            min_read_role="moderator",  # Only moderator+ can read
            min_message_role="admin",  # Only admin+ can post
        )

        # Member can view but not read or post
        member_perms = channel.get_user_permissions(self.member)
        self.assertTrue(member_perms["can_view"])
        self.assertFalse(member_perms["can_read"])
        self.assertFalse(member_perms["can_post"])

        # Moderator can view and read but not post
        mod_perms = channel.get_user_permissions(self.moderator)
        self.assertTrue(mod_perms["can_view"])
        self.assertTrue(mod_perms["can_read"])
        self.assertFalse(mod_perms["can_post"])

        # Admin can do everything
        admin_perms = channel.get_user_permissions(self.admin)
        self.assertTrue(admin_perms["can_view"])
        self.assertTrue(admin_perms["can_read"])
        self.assertTrue(admin_perms["can_post"])


class MessageModelTests(TestCase):
    """Test Message model functionality"""

    def setUp(self):
        """Set up test fixtures"""
        from pingo_channels.signals import create_default_channel
        from servers.models import Server

        post_save.disconnect(create_default_channel, sender=Server)

        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        self.server = Server.objects.create(name="Test Server", owner=self.user)
        self.channel = Channel.objects.create(
            name="general", server=self.server, created_by=self.user
        )

    def tearDown(self):
        # Reconnect signal after tests
        from pingo_channels.signals import create_default_channel
        from servers.models import Server

        post_save.connect(create_default_channel, sender=Server)

    def test_message_creation_success(self):
        """Test successful message creation"""
        message = Message.objects.create(
            content="Hello world!", channel=self.channel, author=self.user
        )

        self.assertEqual(message.content, "Hello world!")
        self.assertEqual(message.channel, self.channel)
        self.assertEqual(message.author, self.user)
        self.assertFalse(message.is_deleted)  # Default
        self.assertIsNotNone(message.created_at)
        self.assertIsNotNone(message.updated_at)

    def test_message_string_representation(self):
        """Test message __str__ method"""
        message = Message.objects.create(
            content="This is a long message that should be truncated",
            channel=self.channel,
            author=self.user,
        )

        # Should show first 30 characters
        expected = "This is a long message that sh"
        self.assertEqual(str(message), expected)

    def test_message_string_representation_short(self):
        """Test message __str__ with short content"""
        message = Message.objects.create(
            content="Short msg", channel=self.channel, author=self.user
        )

        self.assertEqual(str(message), "Short msg")

    def test_message_content_max_length(self):
        """Test message content respects max_length"""
        long_content = "x" * 1000  # Exactly max length
        message = Message.objects.create(
            content=long_content, channel=self.channel, author=self.user
        )

        self.assertEqual(len(message.content), 1000)

    def test_message_soft_delete(self):
        """Test message soft delete functionality"""
        message = Message.objects.create(
            content="To be deleted", channel=self.channel, author=self.user
        )

        # Soft delete
        message.is_deleted = True
        message.save()

        # Message still exists in database
        self.assertTrue(Message.objects.filter(id=message.id).exists())
        self.assertTrue(message.is_deleted)

    def test_message_ordering(self):
        """Test messages are ordered by created_at descending"""
        message1 = Message.objects.create(
            content="First message", channel=self.channel, author=self.user
        )

        message2 = Message.objects.create(
            content="Second message", channel=self.channel, author=self.user
        )

        messages = list(Message.objects.all())
        self.assertEqual(messages[0], message2)  # Newest first
        self.assertEqual(messages[1], message1)

    def test_message_channel_relationship(self):
        """Test message-channel relationship and CASCADE"""
        message = Message.objects.create(
            content="Test message", channel=self.channel, author=self.user
        )

        # Delete channel should cascade to message
        channel_id = self.channel.id
        self.channel.delete()

        # Message should be deleted too
        self.assertFalse(Message.objects.filter(id=message.id).exists())


class ChannelSignalTests(TestCase):
    """Test channel auto-creation signal"""

    def setUp(self):
        """Set up test fixtures"""
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )

    def test_server_creation_creates_default_channel(self):
        """Test that creating a server auto-creates a 'general' channel"""
        # No channels should exist initially
        self.assertEqual(Channel.objects.count(), 0)

        # Create server
        server = Server.objects.create(
            name="Test Server", description="A test server", owner=self.user
        )

        # Should auto-create general channel
        self.assertEqual(Channel.objects.count(), 1)

        channel = Channel.objects.first()
        self.assertEqual(channel.name, "general")
        self.assertEqual(channel.server, server)
        self.assertEqual(channel.created_by, self.user)
        self.assertEqual(channel.description, "General discussion")

        # Should have default permissions (all members can access)
        self.assertEqual(channel.min_view_role, "member")
        self.assertEqual(channel.min_read_role, "member")
        self.assertEqual(channel.min_message_role, "member")

    def test_server_update_does_not_create_channel(self):
        """Test that updating server doesn't create additional channels"""
        server = Server.objects.create(name="Test Server", owner=self.user)

        # Should have 1 channel from creation
        self.assertEqual(Channel.objects.count(), 1)

        # Update server
        server.name = "Updated Server Name"
        server.save()

        # Should still have only 1 channel
        self.assertEqual(Channel.objects.count(), 1)

    def test_multiple_servers_create_multiple_channels(self):
        """Test that each server gets its own default channel"""
        server1 = Server.objects.create(name="Server 1", owner=self.user)
        server2 = Server.objects.create(name="Server 2", owner=self.user)

        # Should have 2 channels total
        self.assertEqual(Channel.objects.count(), 2)

        # Each server should have a general channel
        self.assertTrue(Channel.objects.filter(server=server1, name="general").exists())
        self.assertTrue(Channel.objects.filter(server=server2, name="general").exists())
