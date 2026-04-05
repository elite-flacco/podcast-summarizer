#!/usr/bin/env python3
import argparse
import json
import os
import sys

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    IpBlocked,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    TranslationLanguageNotAvailable,
    VideoUnavailable,
)
from yt_dlp import YoutubeDL


def emit_success(data):
    print(json.dumps({"ok": True, "data": data}))


def emit_error(message, error_type=None, reason=None, exit_code=1):
    print(
        json.dumps(
            {
                "ok": False,
                "message": message,
                "error_type": error_type,
                "reason": reason,
            }
        ),
        file=sys.stderr,
    )
    sys.exit(exit_code)


def handle_transcript(args):
    try:
        transcript = YouTubeTranscriptApi().fetch(
            args.video_id,
            languages=[args.language],
        )
        text = " ".join(
            snippet.text.strip() for snippet in transcript if snippet.text.strip()
        )

        if not text:
            emit_error(
                "No captions are available for this video",
                error_type="NoTranscriptFound",
                reason="not_available",
            )

        emit_success({"text": text})
    except TranscriptsDisabled as error:
        emit_error(str(error), type(error).__name__, "disabled")
    except TranslationLanguageNotAvailable as error:
        emit_error(str(error), type(error).__name__, "language_unavailable")
    except NoTranscriptFound as error:
        emit_error(str(error), type(error).__name__, "not_available")
    except VideoUnavailable as error:
        emit_error(str(error), type(error).__name__, "video_unavailable")
    except RequestBlocked as error:
        emit_error(str(error), type(error).__name__, "request_blocked")
    except IpBlocked as error:
        emit_error(str(error), type(error).__name__, "ip_blocked")
    except Exception as error:
        emit_error(str(error), type(error).__name__, "unknown")


def handle_download_audio(args):
    output_template = os.path.abspath(args.output_template)
    url = f"https://www.youtube.com/watch?v={args.video_id}"

    options = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "outtmpl": output_template,
        "noplaylist": True,
    }

    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            requested_downloads = info.get("requested_downloads") or []

            if requested_downloads and requested_downloads[0].get("filepath"):
                file_path = requested_downloads[0]["filepath"]
            else:
                file_path = ydl.prepare_filename(info)

        emit_success({"file_path": os.path.abspath(file_path)})
    except Exception as error:
        emit_error(str(error), type(error).__name__)


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    transcript_parser = subparsers.add_parser("transcript")
    transcript_parser.add_argument("video_id")
    transcript_parser.add_argument("--language", default="en")
    transcript_parser.set_defaults(func=handle_transcript)

    audio_parser = subparsers.add_parser("download-audio")
    audio_parser.add_argument("video_id")
    audio_parser.add_argument("--output-template", required=True)
    audio_parser.set_defaults(func=handle_download_audio)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
