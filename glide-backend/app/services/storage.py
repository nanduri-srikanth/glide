"""Storage service for audio files using S3 or Supabase Storage."""
import os
import uuid
from datetime import datetime
from typing import BinaryIO, Optional

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings


class StorageService:
    """Service for file storage (S3 compatible - works with Supabase Storage)."""

    def __init__(self):
        settings = get_settings()
        self.bucket_name = settings.s3_bucket_name

        # Initialize S3 client
        # For Supabase Storage, use their S3-compatible endpoint
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            # Uncomment for Supabase Storage:
            # endpoint_url='https://YOUR_PROJECT.supabase.co/storage/v1/s3'
        )

    def _generate_key(self, user_id: str, filename: str) -> str:
        """Generate a unique S3 key for the file."""
        ext = os.path.splitext(filename)[1] or '.mp3'
        date_prefix = datetime.utcnow().strftime('%Y/%m/%d')
        unique_id = uuid.uuid4().hex[:8]
        return f"audio/{user_id}/{date_prefix}/{unique_id}{ext}"

    async def upload_audio(
        self,
        file: BinaryIO,
        user_id: str,
        filename: str,
        content_type: str = "audio/mpeg"
    ) -> dict:
        """
        Upload audio file to storage.

        Returns:
            dict with url and key
        """
        key = self._generate_key(user_id, filename)

        try:
            self.s3_client.upload_fileobj(
                file,
                self.bucket_name,
                key,
                ExtraArgs={
                    'ContentType': content_type,
                    'ACL': 'private'
                }
            )

            # Generate a presigned URL for access
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=3600 * 24 * 7  # 7 days
            )

            return {
                'key': key,
                'url': url,
                'bucket': self.bucket_name,
            }

        except ClientError as e:
            raise Exception(f"Failed to upload file: {str(e)}")

    async def get_presigned_url(
        self,
        key: str,
        expires_in: int = 3600
    ) -> str:
        """
        Get a presigned URL for accessing a file.

        Args:
            key: S3 object key
            expires_in: URL expiration in seconds

        Returns:
            Presigned URL string
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            raise Exception(f"Failed to generate URL: {str(e)}")

    async def delete_audio(self, key: str) -> bool:
        """
        Delete an audio file from storage.

        Returns:
            True if successful
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            return True
        except ClientError:
            return False

    async def get_upload_url(
        self,
        user_id: str,
        filename: str,
        content_type: str = "audio/mpeg",
        expires_in: int = 3600
    ) -> dict:
        """
        Generate a presigned URL for direct upload from client.

        Returns:
            dict with upload_url and key
        """
        key = self._generate_key(user_id, filename)

        try:
            url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key,
                    'ContentType': content_type,
                },
                ExpiresIn=expires_in
            )

            return {
                'upload_url': url,
                'key': key,
            }

        except ClientError as e:
            raise Exception(f"Failed to generate upload URL: {str(e)}")
