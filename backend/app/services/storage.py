"""Storage service abstraction for persisting audio recordings."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

import boto3

from app.core.config import Settings


class StorageServiceError(RuntimeError):
    """Base exception for storage failures."""


@dataclass
class AudioUploadResult:
    """Metadata returned after uploading an audio object."""

    url: str
    key: str


class S3AudioStorage:
    """Persist audio blobs to an Amazon S3 bucket."""

    def __init__(self, settings: Settings) -> None:
        if not settings.aws_s3_bucket:
            raise StorageServiceError("AWS_S3_BUCKET is not configured")

        session_kwargs: dict[str, str] = {}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            session_kwargs["aws_access_key_id"] = settings.aws_access_key_id
            session_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_region_name:
            session_kwargs["region_name"] = settings.aws_region_name

        self._bucket = settings.aws_s3_bucket
        self._region = settings.aws_region_name
        self._client = boto3.client("s3", **session_kwargs)

    def upload_audio(
        self,
        payload: bytes,
        content_type: str | None = None,
    ) -> AudioUploadResult:
        """Upload the given bytes to S3 and return the object location."""

        key = f"recordings/{uuid4().hex}.webm"
        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type

        try:
            self._client.put_object(Bucket=self._bucket, Key=key, Body=payload, **extra_args)
        except Exception as exc:  # pragma: no cover - boto3 raises many specific errors
            raise StorageServiceError("Failed to upload audio to S3") from exc

        if self._region:
            url = f"https://{self._bucket}.s3.{self._region}.amazonaws.com/{key}"
        else:
            url = f"https://{self._bucket}.s3.amazonaws.com/{key}"

        return AudioUploadResult(url=url, key=key)


__all__ = ["AudioUploadResult", "S3AudioStorage", "StorageServiceError"]

