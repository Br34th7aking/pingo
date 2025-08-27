from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path(
        "chat/<uuid:server_id>/<uuid:channel_id>/",
        consumers.ChatConsumer.as_asgi(),
    ),
    path(
        "chat/direct/<uuid:conversation_id>/", consumers.DirectMessageConsumer.as_asgi()
    ),
]
