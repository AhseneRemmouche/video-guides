"""Day 5 - multimodal (image + audio).

The course builds an agent that generates images with DALL-E 3 / gpt-image-1
and speaks with OpenAI tts-1 / gpt-4o-mini-tts. Those are PAID cloud-only
models. We do NOT have a local equivalent wired up here, so this script does
NOT call them. It prints a clear note and shows the guarded code path only.

Mark: NOT RUN (no local image/audio model).
"""

from common import banner

# These would be the paid cloud calls. They are guarded off so nothing runs.
IMAGE_AVAILABLE = False  # would need OpenAI gpt-image-1 / DALL-E 3 (paid)
AUDIO_AVAILABLE = False  # would need OpenAI tts-1 / gpt-4o-mini-tts (paid)


def artist(city):
    """Guarded: image generation needs a paid cloud model (not called)."""
    if not IMAGE_AVAILABLE:
        raise RuntimeError("No local image model available - skipped.")
    # Reference only (NOT executed):
    #   from openai import OpenAI
    #   openai = OpenAI()
    #   resp = openai.images.generate(model="gpt-image-1", prompt=..., n=1)
    #   return resp.data[0].b64_json


def talker(message):
    """Guarded: text-to-speech needs a paid cloud model (not called)."""
    if not AUDIO_AVAILABLE:
        raise RuntimeError("No local audio model available - skipped.")
    # Reference only (NOT executed):
    #   from openai import OpenAI
    #   openai = OpenAI()
    #   resp = openai.audio.speech.create(model="tts-1", voice="onyx", input=message)
    #   return resp.content


def main():
    banner("Day 5 - multimodal: NOT RUN (no local image/audio model)")
    print(
        "Image generation (DALL-E 3 / gpt-image-1) and text-to-speech "
        "(tts-1 / gpt-4o-mini-tts) are PAID, cloud-only models."
    )
    print("There is no local Ollama equivalent configured, so these are skipped.")
    print(f"  IMAGE_AVAILABLE = {IMAGE_AVAILABLE}")
    print(f"  AUDIO_AVAILABLE = {AUDIO_AVAILABLE}")
    print(
        "\nThe artist() and talker() code paths above are guarded and were not "
        "called. See the course notebooks for the real paid implementation."
    )


if __name__ == "__main__":
    main()
