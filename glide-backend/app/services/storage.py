"""Storage service for audio files using S3, Supabase, or local filesystem."""
import os
import uuid
import shutil
from datetime import datetime
from typing import BinaryIO

from app.config import get_settings


class StorageService:
    """Service for file storage (S3, Supabase, or local filesystem)."""

    def __init__(self):
        self.settings = get_settings()
        self.use_local = self.settings.use_local_storage
        self.local_path = self.settings.local_storage_path

        if not self.use_local:
            # Initialize S3 client only when using cloud storage
            import boto3
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.settings.aws_access_key_id,
                aws_secret_access_key=self.settings.aws_secret_access_key,
                region_name=self.settings.aws_region,
            )
            self.bucket_name = self.settings.s3_bucket_name
        else:
            self.s3_client = None
            self.bucket_name = None

    def _generate_key(self, user_id: str, filename: str) -> str:
        """Generate a unique key for the file."""
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

        if self.use_local:
            return await self._upload_local(file, key)
        else:
            return await self._upload_s3(file, key, content_type)

    async def _upload_local(self, file: BinaryIO, key: str) -> dict:
        """Upload to local filesystem (placeholder for dev - doesn't actually store)."""
        # For local dev, we just generate a placeholder path
        # The audio data is not actually stored to save disk space during testing
        file_path = os.path.join(self.local_path, key)

        return {
            'key': key,
            'url': f"local://{key}",  # Placeholder URL
            'bucket': 'local',
        }

    async def _upload_s3(self, file: BinaryIO, key: str, content_type: str) -> dict:
        """Upload to S3."""
        from botocore.exceptions import ClientError

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

            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=3600 * 24 * 7
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
        """Get a URL for accessing a file."""
        if self.use_local:
            return f"local://{key}"

        from botocore.exceptions import ClientError
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
        """Delete an audio file from storage."""
        if self.use_local:
            file_path = os.path.join(self.local_path, key)
            if os.path.exists(file_path):
                os.remove(file_path)
            return True

        from botocore.exceptions import ClientError
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
        """Generate a presigned URL for direct upload from client."""
        key = self._generate_key(user_id, filename)

        if self.use_local:
            return {
                'upload_url': f"local://{key}",
                'key': key,
            }

        from botocore.exceptions import ClientError
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
