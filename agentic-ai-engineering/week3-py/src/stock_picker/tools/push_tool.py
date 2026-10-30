from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field


class PushNotification(BaseModel):
    """A message to be sent to the user"""
    message: str = Field(..., description="The message to be sent to the user.")


class PushNotificationTool(BaseTool):
    name: str = "Send a Push Notification"
    description: str = (
        "This tool is used to send a push notification to the user."
    )
    args_schema: Type[BaseModel] = PushNotification

    def _run(self, message: str) -> str:
        # --- LOCAL/OFFLINE ADAPTATION -------------------------------------
        # In Ed Donner's course this tool sends a real push notification via
        # Pushover (POST https://api.pushover.net/1/messages.json using the
        # PUSHOVER_USER / PUSHOVER_TOKEN keys). We have no Pushover account
        # here, so instead of calling the paid/keyed service we simply log the
        # message to stdout. The crew behaves identically from the agent's
        # point of view: it calls the tool, gets an "ok" acknowledgement back,
        # and continues. Swap the body below for the real requests.post(...)
        # call if you have Pushover credentials.
        # ------------------------------------------------------------------
        print("\n==================== PUSH NOTIFICATION (local stub) ====================")
        print(f"Push: {message}")
        print("========================================================================\n")
        return '{"notification": "ok"}'
