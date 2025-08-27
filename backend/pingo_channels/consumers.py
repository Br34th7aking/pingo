import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from .models import Channel, Message, DirectMessageConversation, DirectMessage
from servers.models import Server, ServerMembership
from .serializers import MessageSerializer, DirectMessageSerializer


class ChatConsumer(AsyncWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.authenticated = False
        self.user = AnonymousUser()
        self.server = None
        self.channel = None
        self.membership = None
        self.channel_permissions = None
        self.group_name = None

    async def connect(self):
        self.server_id = self.scope["url_route"]["kwargs"]["server_id"]
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]
        await self.accept()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "auth_required",
                    "message": "Authentication required. Please send your JWT token.",
                    "expected_format": {
                        "type": "auth",
                        "token": "your_jwt_access_token_here",
                    },
                    "server_id": str(self.server_id),
                    "channel_id": str(self.channel_id),
                }
            )
        )

    async def disconnect(self, close_code):
        if self.authenticated and self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get("type", "unknown")

            if not self.authenticated:
                if message_type == "auth":
                    await self._handle_authentication(data)
                else:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "error",
                                "message": "Authentication required. Send auth message first.",
                                "expected_format": {
                                    "type": "auth",
                                    "token": "your_jwt_access_token_here",
                                },
                            }
                        )
                    )
                return

            if message_type == "ping":
                await self._handle_ping()
            elif message_type == "chat_message":
                await self._handle_chat_message(data)

            elif message_type == "test_message":
                await self._handle_test_message(data)
            elif message_type == "connection_test":
                await self._handle_connection_test()
            else:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "message": f"Unknown message type: {message_type}",
                            "supported_types": [
                                "ping",
                                "test_message",
                                "connection_test",
                            ],
                        }
                    )
                )

        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            )
        except Exception as e:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Server error processing message"}
                )
            )

    async def _handle_chat_message(self, data):
        try:
            content = data.get("content", "").strip()
            if not content:
                await self.send(
                    text_data=json.dumps(
                        {"type": "error", "message": "Message content cannot be empty"}
                    )
                )
                return
            if not self.channel_permissions.get("can_post", False):
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "message": "You do not have permission to post messages in this channel",
                        }
                    )
                )
                return

            message = await database_sync_to_async(Message.objects.create)(
                content=content, channel=self.channel, author=self.user
            )
            message_data = self._serialize_message(message)

            # Broadcast message to all users in this channel group
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message_broadcast",  # Method name (underscores replace dots)
                    "message_data": message_data,
                },
            )

        except Exception as e:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": f"Failed to send message, {e}"}
                )
            )

    async def chat_message_broadcast(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": "chat_message", "message": event["message_data"]}
            )
        )

    def _serialize_message(self, message):
        serializer = MessageSerializer(message)
        return serializer.data

    async def _handle_ping(self):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "pong",
                    "message": "Server received your ping!",
                    "timestamp": self._get_timestamp(),
                }
            )
        )

    async def _handle_test_message(self, data):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "test_response",
                    "original_message": data.get("message", ""),
                    "server_response": "Message received successfully!",
                    "user": {
                        "id": str(self.user.id),
                        "username": self.user.username,
                    },
                    "channel": {
                        "id": str(self.channel.id),
                        "name": self.channel.name,
                    },
                    "server": {
                        "id": str(self.server.id),
                        "name": self.server.name,
                    },
                    "timestamp": self._get_timestamp(),
                }
            )
        )

    async def _handle_connection_test(self):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "connection_info",
                    "status": "connected",
                    "user": {
                        "id": str(self.user.id),
                        "username": self.user.username,
                    },
                    "membership": {
                        "role": self.membership.role,
                        "joined_at": self.membership.created_at.isoformat(),
                    },
                    "channel": {
                        "id": str(self.channel.id),
                        "name": self.channel.name,
                    },
                    "server": {
                        "id": str(self.server.id),
                        "name": self.server.name,
                    },
                    "permissions": self.channel_permissions,
                    "group_name": self.group_name,
                    "timestamp": self._get_timestamp(),
                }
            )
        )

    def _get_timestamp(self):
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()

    async def _handle_authentication(self, data):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model

            token = data.get("token")
            if not token:
                await self._send_auth_error("No token provided")
                return

            # Validate JWT token
            try:
                access_token = AccessToken(token)
                user_id = access_token["user_id"]
            except Exception as e:
                await self._send_auth_error(f"Invalid or expired token: {str(e)}")
                return

            # Get user from database
            User = get_user_model()
            try:
                user = await database_sync_to_async(User.objects.get)(id=user_id)
            except User.DoesNotExist:
                await self._send_auth_error("User not found")
                return

            # Validate server and channel permissions
            try:
                # Check if server exists
                server = await database_sync_to_async(Server.objects.get)(
                    id=self.server_id
                )

                # Check server membership
                membership = await database_sync_to_async(
                    ServerMembership.objects.filter(server=server, user=user).first
                )()

                if not membership:
                    await self._send_auth_error("You are not a member of this server")
                    return

                # Check if channel exists in this server
                channel = await database_sync_to_async(
                    Channel.objects.filter(id=self.channel_id, server=server).first
                )()

                if not channel:
                    await self._send_auth_error("Channel not found in this server")
                    return

                # Check channel permissions
                permissions = await database_sync_to_async(
                    channel.get_user_permissions
                )(user)

                if not permissions.get("can_view", False):
                    await self._send_auth_error(
                        "You do not have permission to view this channel"
                    )
                    return

            except Server.DoesNotExist:
                await self._send_auth_error("Server not found")
                return
            except Exception as e:
                await self._send_auth_error("Server error validating permissions")
                return

            # Authentication and authorization successful
            self.user = user
            self.server = server
            self.channel = channel
            self.membership = membership
            self.channel_permissions = permissions
            self.authenticated = True
            self.group_name = f"chat_{self.server_id}_{self.channel_id}"

            # Join channel group for broadcasting
            await self.channel_layer.group_add(self.group_name, self.channel_name)

            # Send success response
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "auth_success",
                        "message": f"Successfully authenticated and joined #{self.channel.name}",
                        "user": {
                            "id": str(user.id),
                            "username": user.username,
                        },
                        "server": {
                            "id": str(server.id),
                            "name": server.name,
                        },
                        "channel": {
                            "id": str(channel.id),
                            "name": channel.name,
                        },
                        "membership": {
                            "role": membership.role,
                            "joined_at": membership.created_at.isoformat(),
                        },
                        "permissions": permissions,
                        "group_name": self.group_name,
                    }
                )
            )

        except Exception as e:
            await self._send_auth_error("Server error during authentication")

    async def _send_auth_error(self, message):
        """Send authentication error and close connection."""
        await self.send(
            text_data=json.dumps({"type": "auth_error", "message": message})
        )
        await self.close(code=4001)  # Authentication failure


class DirectMessageConsumer(AsyncWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.authenticated = False
        self.user = AnonymousUser()
        self.conversation = None
        self.other_participant = None
        self.group_name = None

    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        await self.accept()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "auth_required",
                    "message": "Authentication required. Please send your JWT token.",
                    "expected_format": {
                        "type": "auth",
                        "token": "your_jwt_access_token_here",
                    },
                    "conversation_id": str(self.conversation_id),
                }
            )
        )

    async def disconnect(self, close_code):
        if self.authenticated and self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get("type", "unknown")

            if not self.authenticated:
                if message_type == "auth":
                    await self._handle_authentication(data)
                else:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "error",
                                "message": "Authentication required. Send auth message first.",
                                "expected_format": {
                                    "type": "auth",
                                    "token": "your_jwt_access_token_here",
                                },
                            }
                        )
                    )
                return

            if message_type == "direct_message":
                await self._handle_direct_message(data)
            elif message_type == "connection_test":
                await self._handle_connection_test()
            else:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "message": f"Unknown message type: {message_type}",
                            "supported_types": [
                                "ping",
                                "direct_message",
                                "test_message",
                                "connection_test",
                            ],
                        }
                    )
                )

        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            )
        except Exception as e:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Server error processing message"}
                )
            )

    async def _handle_direct_message(self, data):
        try:
            content = data.get("content", "").strip()
            if not content:
                await self.send(
                    text_data=json.dumps(
                        {"type": "error", "message": "Message content cannot be empty"}
                    )
                )
                return

            # Check if other participant still allows DMs from current user
            if not await database_sync_to_async(
                self.other_participant.can_receive_dm_from
            )(self.user):
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "message": "This user has restricted DM permissions",
                        }
                    )
                )
                return

            message = await database_sync_to_async(DirectMessage.objects.create)(
                content=content, conversation=self.conversation, sender=self.user
            )
            message_data = self._serialize_direct_message(message)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "direct_message_broadcast",
                    "message_data": message_data,
                },
            )

        except Exception as e:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": f"Failed to send message: {e}"}
                )
            )

    async def direct_message_broadcast(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": "direct_message", "message": event["message_data"]}
            )
        )

    def _serialize_direct_message(self, message):
        # Create mock request for serializer context
        # class MockRequest:
        # def __init__(self, user):
        # self.user = user

        serializer = DirectMessageSerializer(message)
        # message, context={"request": MockRequest(self.user)}
        # )
        return serializer.data

    async def _handle_connection_test(self):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "connection_info",
                    "status": "connected",
                    "user": {
                        "id": str(self.user.id),
                        "email": self.user.email,
                        "display_name": self.user.display_name,
                    },
                    "conversation": {
                        "id": str(self.conversation.id),
                        "created_at": self.conversation.created_at.isoformat(),
                        "other_participant": {
                            "id": str(self.other_participant.id),
                            "display_name": self.other_participant.display_name,
                        },
                    },
                    "group_name": self.group_name,
                    "timestamp": self._get_timestamp(),
                }
            )
        )

    def _get_timestamp(self):
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()

    async def _handle_authentication(self, data):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model

            token = data.get("token")
            if not token:
                await self._send_auth_error("No token provided")
                return

            # Validate JWT token
            try:
                access_token = AccessToken(token)
                user_id = access_token["user_id"]
            except Exception as e:
                await self._send_auth_error(f"Invalid or expired token: {str(e)}")
                return

            # Get user from database
            User = get_user_model()
            try:
                user = await database_sync_to_async(User.objects.get)(id=user_id)
            except User.DoesNotExist:
                await self._send_auth_error("User not found")
                return

            # Validate conversation permissions
            try:
                # Check if conversation exists
                conversation = await database_sync_to_async(
                    DirectMessageConversation.objects.get
                )(id=self.conversation_id)

                # Check if user is participant in this conversation
                is_participant = await database_sync_to_async(
                    conversation.is_participant
                )(user)

                if not is_participant:
                    await self._send_auth_error(
                        "You are not a participant in this conversation"
                    )
                    return

                # Get the other participant
                other_participant = await database_sync_to_async(
                    conversation.get_other_participant
                )(user)

                if not other_participant:
                    await self._send_auth_error("Could not find other participant")
                    return

            except DirectMessageConversation.DoesNotExist:
                await self._send_auth_error("Conversation not found")
                return
            except Exception as e:
                await self._send_auth_error("Server error validating conversation")
                return

            # Authentication and authorization successful
            self.user = user
            self.conversation = conversation
            self.other_participant = other_participant
            self.authenticated = True
            self.group_name = f"direct_message_conversation_{self.conversation_id}"

            # Join conversation group for broadcasting
            await self.channel_layer.group_add(self.group_name, self.channel_name)

            # Send success response
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "auth_success",
                        "message": f"Successfully authenticated and joined DirectMessage conversation",
                        "user": {
                            "id": str(user.id),
                            "email": user.email,
                            "display_name": user.display_name,
                        },
                        "conversation": {
                            "id": str(conversation.id),
                            "created_at": conversation.created_at.isoformat(),
                        },
                        "other_participant": {
                            "id": str(other_participant.id),
                            "display_name": other_participant.display_name,
                        },
                        "group_name": self.group_name,
                    }
                )
            )

        except Exception as e:
            await self._send_auth_error("Server error during authentication")

    async def _send_auth_error(self, message):
        """Send authentication error and close connection."""
        await self.send(
            text_data=json.dumps({"type": "auth_error", "message": message})
        )
        await self.close(code=4001)  # Authentication failure
