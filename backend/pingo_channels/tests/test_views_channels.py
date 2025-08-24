# pingo_channels/tests/test_channel_views.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from servers.models import Server, ServerMembership
from pingo_channels.models import Channel

User = get_user_model()


class ChannelListViewTests(TestCase):
    """Test ChannelListView GET and POST methods"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()

        # Create users
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        # Create server
        self.server = Server.objects.create(name="Test Server", owner=self.owner)

        # Create memberships (note: owner membership auto-created by Server.save())
        ServerMembership.objects.create(
            user=self.admin, server=self.server, role="admin"
        )
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )

        # Clear auto-created channels for clean testing
        Channel.objects.filter(server=self.server).delete()

        # Create test channels with different permissions
        self.public_channel = Channel.objects.create(
            name="public-channel",
            description="Everyone can see",
            server=self.server,
            created_by=self.owner,
        )

        self.admin_channel = Channel.objects.create(
            name="admin-only",
            description="Admins only",
            server=self.server,
            created_by=self.owner,
            min_view_role="admin",
            min_read_role="admin",
            min_message_role="admin",
        )

    # GET Tests
    def test_list_channels_success_for_member(self):
        """Test that members can list channels they have permission to view"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(f"/api/servers/{self.server.id}/channels/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # Only sees public channel
        self.assertEqual(response.data[0]["name"], "public-channel")

    def test_list_channels_success_for_admin(self):
        """Test that admins can see all channels they have permission for"""
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(f"/api/servers/{self.server.id}/channels/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Sees both channels
        channel_names = [ch["name"] for ch in response.data]
        self.assertIn("public-channel", channel_names)
        self.assertIn("admin-only", channel_names)

    def test_list_channels_includes_user_permissions(self):
        """Test that response includes user_permissions for each channel"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(f"/api/servers/{self.server.id}/channels/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        channel = response.data[0]

        self.assertIn("user_permissions", channel)
        permissions = channel["user_permissions"]
        self.assertTrue(permissions["can_view"])
        self.assertTrue(permissions["can_read"])
        self.assertTrue(permissions["can_post"])

    def test_list_channels_non_member_forbidden(self):
        """Test that non-server-members cannot list channels"""
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(f"/api/servers/{self.server.id}/channels/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"], "You are not a member of this server.")

    def test_list_channels_unauthenticated_user(self):
        """Test that unauthenticated users cannot list channels"""
        response = self.client.get(f"/api/servers/{self.server.id}/channels/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_channels_invalid_server(self):
        """Test listing channels for non-existent server"""
        self.client.force_authenticate(user=self.owner)
        fake_uuid = "12345678-1234-5678-9012-123456789012"

        response = self.client.get(f"/api/servers/{fake_uuid}/channels/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"], "Server not found.")

    # POST Tests
    def test_create_channel_success_owner(self):
        """Test that server owner can create channels"""
        self.client.force_authenticate(user=self.owner)

        data = {"name": "new-channel", "description": "A new test channel"}

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Channel created successfully.")
        self.assertEqual(response.data["channel"]["name"], "new-channel")
        self.assertEqual(response.data["channel"]["description"], "A new test channel")

        # Verify channel was created in database
        self.assertTrue(
            Channel.objects.filter(server=self.server, name="new-channel").exists()
        )

    def test_create_channel_success_admin(self):
        """Test that server admin can create channels"""
        self.client.force_authenticate(user=self.admin)

        data = {"name": "admin-created", "description": "Created by admin"}

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Channel created successfully.")
        self.assertEqual(response.data["channel"]["name"], "admin-created")

    def test_create_channel_member_forbidden(self):
        """Test that regular members cannot create channels"""
        self.client.force_authenticate(user=self.member)

        data = {"name": "forbidden-channel"}

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data["error"],
            "Permission Denied. You can not create a channel on this server.",
        )

    def test_create_channel_duplicate_name(self):
        """Test creating channel with duplicate name fails"""
        self.client.force_authenticate(user=self.owner)

        data = {"name": "public-channel"}  # Already exists

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"],
            'Channel "public-channel" already exists in this server',
        )

    def test_create_channel_invalid_data(self):
        """Test creating channel with invalid data"""
        self.client.force_authenticate(user=self.owner)

        data = {"description": "Missing name field"}

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_channel_non_member_forbidden(self):
        """Test that non-server-members cannot create channels"""
        self.client.force_authenticate(user=self.outsider)

        data = {"name": "outsider-channel"}

        response = self.client.post(f"/api/servers/{self.server.id}/channels/", data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"], "You are not a member of this server.")


class ChannelDetailViewTests(TestCase):
    """Test ChannelDetailView GET, PATCH, and DELETE methods"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()

        # Create users
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.admin = User.objects.create_user(
            email="admin@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        # Create server
        self.server = Server.objects.create(name="Test Server", owner=self.owner)

        # Create memberships
        ServerMembership.objects.create(
            user=self.admin, server=self.server, role="admin"
        )
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )

        # Clear auto-created channels
        Channel.objects.filter(server=self.server).delete()

        # Create test channel
        self.channel = Channel.objects.create(
            name="test-channel",
            description="Test channel",
            server=self.server,
            created_by=self.owner,
        )

    # GET Tests
    def test_get_channel_success(self):
        """Test getting channel details"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "test-channel")
        self.assertEqual(response.data["description"], "Test channel")
        self.assertIn("user_permissions", response.data)

    def test_get_channel_non_member_forbidden(self):
        """Test that non-members cannot get channel details"""
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_channel_not_found(self):
        """Test getting non-existent channel"""
        self.client.force_authenticate(user=self.owner)
        fake_uuid = "12345678-1234-5678-9012-123456789012"

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{fake_uuid}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # PATCH Tests
    def test_update_channel_success_owner(self):
        """Test that owner can update channel"""
        self.client.force_authenticate(user=self.owner)

        data = {"name": "updated-channel", "description": "Updated description"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/", data
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "updated-channel")
        self.assertEqual(response.data["description"], "Updated description")

    def test_update_channel_success_admin(self):
        """Test that admin can update channel"""
        self.client.force_authenticate(user=self.admin)

        data = {"description": "Admin updated this"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/", data
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Admin updated this")

    def test_update_channel_member_forbidden(self):
        """Test that regular members cannot update channels"""
        self.client.force_authenticate(user=self.member)

        data = {"description": "Member trying to update"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/", data
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data["error"], "You do not have permission to update this channel."
        )

    def test_update_channel_duplicate_name(self):
        """Test updating channel to duplicate name"""
        # Create another channel
        Channel.objects.create(
            name="existing-channel", server=self.server, created_by=self.owner
        )

        self.client.force_authenticate(user=self.owner)

        data = {"name": "existing-channel"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/", data
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"], "Another channel with the same name already exists."
        )

    # DELETE Tests
    def test_delete_channel_success_owner(self):
        """Test that owner can delete channel"""
        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify channel was deleted
        self.assertFalse(Channel.objects.filter(id=self.channel.id).exists())

    def test_delete_channel_admin_forbidden(self):
        """Test that admin cannot delete channels (owner only)"""
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data["error"], "Only server owner can delete channels"
        )

    def test_delete_general_channel_forbidden(self):
        """Test that default 'general' channel cannot be deleted"""
        general_channel = Channel.objects.create(
            name="general", server=self.server, created_by=self.owner
        )

        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{general_channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"], 'Cannot delete the default "general" channel'
        )

    def test_delete_channel_member_forbidden(self):
        """Test that members cannot delete channels"""
        self.client.force_authenticate(user=self.member)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
