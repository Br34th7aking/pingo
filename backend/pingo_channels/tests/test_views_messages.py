# pingo_channels/tests/test_message_views.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from servers.models import Server, ServerMembership
from pingo_channels.models import Channel, Message

User = get_user_model()


class MessageListViewTests(TestCase):
    """Test MessageListView GET and POST methods"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()

        # Create users
        self.owner = User.objects.create_user(
            email="owner@test.com", password="testpass123"
        )
        self.member = User.objects.create_user(
            email="member@test.com", password="testpass123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@test.com", password="testpass123"
        )

        # Create server
        self.server = Server.objects.create(name="Test Server", owner=self.owner)

        # Create membership
        ServerMembership.objects.create(
            user=self.member, server=self.server, role="member"
        )

        # Clear auto-created channels and create test channel
        Channel.objects.filter(server=self.server).delete()
        self.channel = Channel.objects.create(
            name="test-channel", server=self.server, created_by=self.owner
        )

        # Create test messages
        self.message1 = Message.objects.create(
            content="First message", channel=self.channel, author=self.owner
        )
        self.message2 = Message.objects.create(
            content="Second message", channel=self.channel, author=self.member
        )
        self.deleted_message = Message.objects.create(
            content="Deleted message",
            channel=self.channel,
            author=self.owner,
            is_deleted=True,
        )

    # GET Tests
    def test_list_messages_success(self):
        """Test that members can list messages in channel they can read"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Excludes deleted message

        # Check message content and ordering (newest first due to model ordering)
        contents = [msg["content"] for msg in response.data]
        self.assertIn("First message", contents)
        self.assertIn("Second message", contents)
        self.assertNotIn("Deleted message", contents)

    def test_list_messages_includes_author_info(self):
        """Test that messages include author information"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message = response.data[0]

        self.assertIn("author", message)
        self.assertIn("email", message["author"])
        self.assertIn("created_at", message)
        self.assertIn("is_deleted", message)

    def test_list_messages_non_member_forbidden(self):
        """Test that non-server-members cannot list messages"""
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_messages_no_read_permission(self):
        """Test listing messages in channel without read permission"""
        # Create admin-only channel
        admin_channel = Channel.objects.create(
            name="admin-only",
            server=self.server,
            created_by=self.owner,
            min_read_role="admin",
        )

        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{admin_channel.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_messages_invalid_channel(self):
        """Test listing messages for non-existent channel"""
        self.client.force_authenticate(user=self.owner)
        fake_uuid = "12345678-1234-5678-9012-123456789012"

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{fake_uuid}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_messages_unauthenticated(self):
        """Test that unauthenticated users cannot list messages"""
        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # POST Tests
    def test_post_message_success(self):
        """Test that members can post messages to channels"""
        self.client.force_authenticate(user=self.member)

        data = {"content": "New message from member"}

        response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/", data
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["content"], "New message from member")
        self.assertEqual(response.data["author"]["email"], "member@test.com")

        # Verify message was created in database
        self.assertTrue(
            Message.objects.filter(
                channel=self.channel,
                content="New message from member",
                author=self.member,
            ).exists()
        )

    def test_post_message_non_member_forbidden(self):
        """Test that non-server-members cannot post messages"""
        self.client.force_authenticate(user=self.outsider)

        data = {"content": "Outsider message"}

        response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/", data
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_post_message_no_post_permission(self):
        """Test posting to channel without post permission"""
        # Create admin-only channel for posting
        admin_channel = Channel.objects.create(
            name="admin-announcements",
            server=self.server,
            created_by=self.owner,
            min_message_role="admin",
        )

        self.client.force_authenticate(user=self.member)

        data = {"content": "Member trying to post"}

        response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{admin_channel.id}/messages/", data
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_post_message_invalid_data(self):
        """Test posting message with invalid data"""
        self.client.force_authenticate(user=self.member)

        data = {}  # Missing content

        response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/", data
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_post_message_empty_content(self):
        """Test posting message with empty content"""
        self.client.force_authenticate(user=self.member)

        data = {"content": ""}

        response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/", data
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MessageDetailViewTests(TestCase):
    """Test MessageDetailView GET, PATCH, and DELETE methods"""

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
        self.other_member = User.objects.create_user(
            email="other@test.com", password="testpass123"
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
        ServerMembership.objects.create(
            user=self.other_member, server=self.server, role="member"
        )

        # Clear auto-created channels and create test channel
        Channel.objects.filter(server=self.server).delete()
        self.channel = Channel.objects.create(
            name="test-channel", server=self.server, created_by=self.owner
        )

        # Create test message
        self.message = Message.objects.create(
            content="Test message content", channel=self.channel, author=self.member
        )

        self.deleted_message = Message.objects.create(
            content="Deleted message",
            channel=self.channel,
            author=self.member,
            is_deleted=True,
        )

    # GET Tests
    def test_get_message_success(self):
        """Test getting specific message"""
        self.client.force_authenticate(user=self.member)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "Test message content")
        self.assertEqual(response.data["author"]["email"], "member@test.com")

    def test_get_message_non_member_forbidden(self):
        """Test that non-members cannot get message"""
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_message_not_found(self):
        """Test getting non-existent message"""
        self.client.force_authenticate(user=self.member)
        fake_uuid = "12345678-1234-5678-9012-123456789012"

        response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{fake_uuid}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # PATCH Tests
    def test_edit_message_success_author(self):
        """Test that message author can edit their message"""
        self.client.force_authenticate(user=self.member)

        data = {"content": "Updated message content"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "Updated message content")

        # Verify message was updated in database
        self.message.refresh_from_db()
        self.assertEqual(self.message.content, "Updated message content")

    def test_edit_message_success_admin(self):
        """Test that admin can edit any message"""
        self.client.force_authenticate(user=self.admin)

        data = {"content": "Admin edited this message"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "Admin edited this message")

    def test_edit_message_success_owner(self):
        """Test that owner can edit any message"""
        self.client.force_authenticate(user=self.owner)

        data = {"content": "Owner edited this message"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "Owner edited this message")

    def test_edit_message_non_author_forbidden(self):
        """Test that non-authors cannot edit messages"""
        self.client.force_authenticate(user=self.other_member)

        data = {"content": "Trying to edit others message"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_edit_deleted_message_forbidden(self):
        """Test that deleted messages cannot be edited"""
        self.client.force_authenticate(user=self.member)

        data = {"content": "Trying to edit deleted message"}

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.deleted_message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Can not edit deleted messages.")

    def test_edit_message_content_only(self):
        """Test that only content field can be edited"""
        self.client.force_authenticate(user=self.member)

        data = {"author": self.other_member.id}  # Trying to change author

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Only the content can be edited.")

    def test_edit_message_invalid_content(self):
        """Test editing message with invalid content"""
        self.client.force_authenticate(user=self.member)

        data = {"content": ""}  # Empty content

        response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/",
            data,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # DELETE Tests
    def test_delete_message_success_author(self):
        """Test that message author can delete their message (soft delete)"""
        self.client.force_authenticate(user=self.member)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify message was soft deleted
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_deleted)

    def test_delete_message_success_admin(self):
        """Test that admin can delete any message"""
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify message was soft deleted
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_deleted)

    def test_delete_message_non_author_forbidden(self):
        """Test that non-authors cannot delete messages"""
        self.client.force_authenticate(user=self.other_member)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_already_deleted_message(self):
        """Test deleting already deleted message"""
        self.client.force_authenticate(user=self.member)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.deleted_message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Message is already deleted.")

    def test_delete_message_non_member_forbidden(self):
        """Test that non-members cannot delete messages"""
        self.client.force_authenticate(user=self.outsider)

        response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{self.message.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MessageViewIntegrationTests(TestCase):
    """Integration tests for message operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()

        self.user = User.objects.create_user(
            email="user@test.com", password="testpass123"
        )
        self.server = Server.objects.create(name="Test Server", owner=self.user)

        # Clear auto-created channels
        Channel.objects.filter(server=self.server).delete()
        self.channel = Channel.objects.create(
            name="integration-test", server=self.server, created_by=self.user
        )

    def test_full_message_workflow(self):
        """Test complete message workflow: create -> list -> get -> edit -> delete"""
        self.client.force_authenticate(user=self.user)

        # 1. Create message
        create_data = {"content": "Original message"}
        create_response = self.client.post(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/",
            create_data,
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        message_id = create_response.data["id"]

        # 2. List messages - should include our message
        list_response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["content"], "Original message")

        # 3. Get specific message
        get_response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{message_id}/"
        )
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["content"], "Original message")

        # 4. Edit message
        edit_data = {"content": "Updated message"}
        edit_response = self.client.patch(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{message_id}/",
            edit_data,
        )
        self.assertEqual(edit_response.status_code, status.HTTP_200_OK)
        self.assertEqual(edit_response.data["content"], "Updated message")

        # 5. Delete message (soft delete)
        delete_response = self.client.delete(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/{message_id}/"
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        # 6. List messages - should be empty (deleted message filtered out)
        final_list_response = self.client.get(
            f"/api/servers/{self.server.id}/channels/{self.channel.id}/messages/"
        )
        self.assertEqual(final_list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(final_list_response.data), 0)
