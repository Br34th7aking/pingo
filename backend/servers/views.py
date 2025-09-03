from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .serializers import (
    ServerSerializer,
    ServerCreateSerializer,
    ServerMembershipCreateSerializer,
    ServerMembershipSerializer,
)
from .models import Server, ServerMembership
from django.db.models import Q


class ServerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        servers = Server.objects.all()

        # Handle different query modes
        discovery = request.query_params.get("discovery")
        my_servers = request.query_params.get("my_servers")
        member_type = request.query_params.get("member_type")
        visibility = request.query_params.get("visibility")
        search = request.query_params.get("search")

        # Discovery mode - show public servers user can join
        if discovery == "true":
            servers = servers.filter(visibility="public")

            # Get servers user is already in (as owner or member)
            user_server_ids = ServerMembership.objects.filter(
                user=request.user
            ).values_list("server_id", flat=True)

            # Exclude servers user already owns or is member of
            servers = servers.exclude(Q(owner=request.user) | Q(id__in=user_server_ids))

        # My servers mode - show only user's joined servers
        elif my_servers == "true" or (
            not any([member_type, visibility, search, discovery])
        ):
            # Default behavior: return user's servers if no specific filtering
            server_ids = ServerMembership.objects.filter(user=request.user).values_list(
                "server_id", flat=True
            )

            servers = servers.filter(
                Q(owner=request.user) | Q(id__in=server_ids)
            ).distinct()

        # Legacy filtering by member role (keep existing behavior)
        else:
            if member_type == "owner":
                servers = servers.filter(owner=request.user)
            elif member_type in ["admin", "moderator", "member"]:
                server_ids = ServerMembership.objects.filter(
                    user=request.user, role=member_type
                ).values_list("server_id", flat=True)
                servers = servers.filter(
                    Q(owner=request.user) | Q(id__in=server_ids)
                ).distinct()

        # Apply common filters (visibility, search)
        if (
            visibility and discovery != "true"
        ):  # Don't override discovery visibility filter
            servers = servers.filter(visibility=visibility)
        if search:
            servers = servers.filter(name__icontains=search)

        serializer = ServerSerializer(servers, many=True)
        return Response(
            {"message": "Success", "servers": serializer.data},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ServerCreateSerializer(data=request.data)
        if serializer.is_valid():
            server = serializer.save(owner=request.user)
            response_serializer = ServerSerializer(server)
            return Response(
                {
                    "message": "Server created successfully",
                    "server": response_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ServerDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            server = Server.objects.get(pk=pk)
        except Server.DoesNotExist:
            return Response({"message": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        # data of public server can be openly accessed
        # data of private server only accessible by members
        is_member = ServerMembership.objects.filter(
            user=request.user, server=server
        ).exists()
        is_owner = server.owner == request.user

        if server.visibility == "private" and not (is_member or is_owner):
            return Response(
                {"error": "Permission Denied"}, status=status.HTTP_403_FORBIDDEN
            )
        serializer = ServerSerializer(server)

        return Response(
            {"message": "Success", "server": serializer.data}, status=status.HTTP_200_OK
        )

    def patch(self, request, pk):
        try:
            server = Server.objects.get(pk=pk)
        except Server.DoesNotExist:
            return Response(
                {"message": "Server does not exist."}, status=status.HTTP_404_NOT_FOUND
            )

        if server.owner == request.user:
            has_permission = True
        else:
            has_permission = ServerMembership.objects.filter(
                user=request.user, role="admin", server=server
            ).exists()

        if not has_permission:
            return Response(
                {"error": "Permission denied. You are not the owner of this server."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ServerSerializer(data=request.data, instance=server, partial=True)
        if serializer.is_valid():
            updated_server = serializer.save()
            response_serializer = ServerSerializer(updated_server)
            return Response(
                {
                    "message": "Server details updated successfully",
                    "server": response_serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {"error": "Failed to update the server details"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        try:
            server = Server.objects.get(pk=pk)
        except Server.DoesNotExist:
            return Response(
                {"message": "Server does not exist."}, status=status.HTTP_404_NOT_FOUND
            )

        if server.owner != request.user:
            return Response(
                {"error": "Permission denied. You are not the owner of this server."},
                status.HTTP_403_FORBIDDEN,
            )
        server.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServerMembershipListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, server_id=None):

        if server_id:
            try:
                server = Server.objects.prefetch_related("membership__user").get(
                    pk=server_id
                )
            except Server.DoesNotExist:
                return Response(
                    {"error": "Server does not exist."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            memberships = server.membership.all()
            is_owner = request.user == server.owner
            is_member = (
                any(membership.user == request.user for membership in memberships)
                if not is_owner
                else False
            )

            if not (is_owner or is_member):
                return Response(
                    {
                        "error": "Permission denied. You are not a member of this server."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        else:
            memberships = ServerMembership.objects.filter(
                user=request.user
            ).select_related("server", "user")
            return Response(
                {"error": "Permission denied. You can only view your own memberships"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ServerMembershipSerializer(memberships, many=True)
        return Response(
            {"message": "Success", "memberships": serializer.data},
            status=status.HTTP_200_OK,
        )

    def post(self, request, server_id):
        try:
            server = Server.objects.get(pk=server_id)
        except Server.DoesNotExist:
            return Response(
                {"error": "Server does not exist."}, status=status.HTTP_404_NOT_FOUND
            )

        if server.owner == request.user:
            return Response(
                {"error": "You are the owner of this server and already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ServerMembership.objects.filter(user=request.user, server=server).exists():
            return Response(
                {"error": "You are already a member of this server."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # check for invite code for private servers
        if server.visibility == "private":
            invite_code = request.data.get("invite_code")
            if not invite_code or invite_code != server.invite_code:
                return Response(
                    {
                        "error": "This is a private server. You need a valid invitation code to join."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        membership_data = {"user": request.user.id}

        serializer = ServerMembershipCreateSerializer(data=membership_data)
        if serializer.is_valid():
            membership = serializer.save(server=server)
            response_serializer = ServerMembershipSerializer(membership)
            return Response(
                {
                    "message": f"Congratulations! You have joined {server.name}.",
                    "membership": response_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"error": "Failed to join the server"}, status=status.HTTP_400_BAD_REQUEST
        )


class ServerMembershipDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_membership(self, server_id, user_id):
        """Helper method to get membership with error handling"""
        try:
            return ServerMembership.objects.select_related("user", "server").get(
                server_id=server_id, user_id=user_id
            )
        except ServerMembership.DoesNotExist:
            return None

    def check_permission(self, membership, user, action="view"):
        if membership.user == user:
            return True, "self"

        if membership.server.owner == user:
            return True, "owner"

        # Check if user is admin of the server
        is_admin = ServerMembership.objects.filter(
            user=user, server=membership.server, role="admin"
        ).exists()

        if is_admin:
            # Admins can't modify owner's membership
            if action in ["update", "delete"] and membership.role == "owner":
                return False, "admin_cannot_modify_owner"
            return True, "admin"

        return False, "no_permission"

    def get(self, request, server_id, user_id):
        membership = self.get_membership(server_id, user_id)
        if not membership:
            return Response(
                {"error": "Membership does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )
        has_permission, _ = self.check_permission(membership, request.user)
        if not has_permission:
            return Response(
                {"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = ServerMembershipSerializer(membership)
        return Response(
            {"message": "Success", "membership": serializer.data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, server_id, user_id):
        membership = self.get_membership(server_id, user_id)
        if not membership:
            return Response(
                {"error": "Membership does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        has_permission, reason = self.check_permission(membership, request.user)

        if not has_permission:
            error_messages = {
                "admin_cannot_modify_owner": "Admins cannot modify the owner's membership.",
                "no_permission": "Permission denied. Only server owners and admins can update member roles.",
            }
            return Response(
                {"error": error_messages.get(reason, "Permission denied.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        # 1. Don't allow changing owner's role
        if membership.role == "owner":
            return Response(
                {"error": "Cannot modify the owner's role. Transfer ownership first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Don't allow users to change their own role (except leaving)
        if membership.user == request.user and "role" in request.data:
            return Response(
                {"error": "You cannot change your own role. Ask an admin or owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Only allow role updates (not user/server changes)
        allowed_fields = ["role"]
        invalid_fields = [
            field for field in request.data.keys() if field not in allowed_fields
        ]
        if invalid_fields:
            return Response(
                {
                    "error": f"Cannot update fields: {', '.join(invalid_fields)}. Only 'role' can be updated."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ServerMembershipCreateSerializer(
            membership, data=request.data, partial=True
        )
        if serializer.is_valid():
            updated_membership = serializer.save()
            response_serializer = ServerMembershipSerializer(updated_membership)
            return Response(
                {
                    "message": "Member role updated successfully.",
                    "membership": response_serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {"error": "Failed to update membership.", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, server_id, user_id):
        membership = self.get_membership(server_id, user_id)
        if not membership:
            return Response(
                {"error": "Membership does not exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        has_permission, reason = self.check_permission(
            membership, request.user, "delete"
        )
        if not has_permission:
            error_messages = {
                "admin_cannot_modify_owner": "Admins cannot remove the server owner.",
                "no_permission": "Permission denied. You can only leave servers yourself or be removed by admins/owners.",
            }
            return Response(
                {"error": error_messages.get(reason, "Permission denied.")},
                status=status.HTTP_403_FORBIDDEN,
            )

        if membership.role == "owner":
            return Response(
                {
                    "error": "Server owners cannot leave their own server. Transfer ownership or delete the server."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if membership.user == request.user:
            action_message = f"You have left {membership.server.name}."
        else:
            action_message = f"{membership.user.display_name} has been removed from {membership.server.name}."

        membership.delete()
        return Response(
            {"message": action_message},
            status=status.HTTP_200_OK,
        )
