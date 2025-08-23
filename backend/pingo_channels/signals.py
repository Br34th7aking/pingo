from django.db.models.signals import post_save
from django.dispatch import receiver
from servers.models import Server
from .models import Channel


@receiver(post_save, sender=Server)
def create_default_channel(sender, instance, created, **kwargs):
    """
    Auto-create a "general" channel when a new server is created
    """
    if created:
        Channel.objects.create(
            name="general",
            description="General discussion",
            server=instance,
            created_by=instance.owner,
        )
