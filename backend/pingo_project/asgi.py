"""
ASGI config for pingo_project.

This file exposes the ASGI callable as a module-level variable named ``application``.
It handles both HTTP (Django) and WebSocket (Channels) connections.
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path, include

# Set Django settings module (adjust if using django-environ differently)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pingo_project.settings")

# Initialize Django ASGI application early to ensure settings are loaded
# This must happen before importing routing modules
django_asgi_app = get_asgi_application()

# Now import WebSocket routing (after Django is initialized)
from pingo_channels.routing import websocket_urlpatterns

# ASGI application that handles both HTTP and WebSocket
application = ProtocolTypeRouter(
    {
        # Handle traditional HTTP requests (REST API)
        "http": django_asgi_app,
        # Handle WebSocket connections (real-time chat)
        "websocket": AuthMiddlewareStack(
            URLRouter(
                [
                    # Route WebSocket connections to pingo_channels app
                    path("ws/", URLRouter(websocket_urlpatterns)),
                ]
            )
        ),
    }
)
