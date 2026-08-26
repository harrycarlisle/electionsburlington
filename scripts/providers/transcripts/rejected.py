"""Providers evaluated and rejected. Do not import these into the live pipeline."""

REJECTED_PROVIDERS = [
    {
        "name": "youtube_timedtext",
        "reason": "Unofficial caption download circumvents YouTube's captions.download OAuth requirement.",
        "priority": 1,
    },
    {
        "name": "invidious_instances",
        "reason": "Alternative frontends are not an official API. Random public instances often forbid automated harvesting and can change terms without notice.",
        "priority": 4,
    },
    {
        "name": "piped_instances",
        "reason": "Same class as other alternative frontends: not official, instance ToS vary, and using them to extract captions would bypass YouTube's caption controls.",
        "priority": 4,
    },
    {
        "name": "youtubetranscript.com",
        "reason": "Third-party transcript site. No confirmed license for automated harvesting of YouTube caption text.",
        "priority": 3,
    },
    {
        "name": "downsub_tactiq_class",
        "reason": "Commercial caption-export sites. Terms do not authorize unattended editorial harvesting.",
        "priority": 3,
    },
]
