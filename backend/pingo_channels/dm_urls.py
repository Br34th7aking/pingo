from django.urls import path
from .views import (
    DirectMessageConversationListView,
    DirectMessageConversationDetailView,
    DirectMessageListView,
)

urlpatterns = [
    path(
        "",
        DirectMessageConversationListView.as_view(),
        name="dm_conversation_list",
    ),
    path(
        "<uuid:conversation_id>/",
        DirectMessageConversationDetailView.as_view(),
        name="dm_conversation_detail",
    ),
    path(
        "<uuid:conversation_id>/messages/",
        DirectMessageListView.as_view(),
        name="dm_message_list",
    ),
]
