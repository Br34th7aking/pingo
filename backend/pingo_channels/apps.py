from django.apps import AppConfig


class PingoChannelsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pingo_channels"

    def ready(self):
        import pingo_channels.signals
