from django.urls import path
from .views import (
    ChannelListView,
    ChannelDetailView,
    MessageListView,
    MessageDetailView,
)

urlpatterns = [
    path("", ChannelListView.as_view(), name="channel-list"),
    path("<uuid:channel_id>/", ChannelDetailView.as_view(), name="channel-detail"),
    path("<uuid:channel_id>/messages/", MessageListView.as_view(), name="message-list"),
    path(
        "<uuid:channel_id>/messages/<uuid:message_id>/",
        MessageDetailView.as_view(),
        name="message-detail",
    ),
]
