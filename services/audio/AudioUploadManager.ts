import { eq, and, asc, sql } from 'drizzle-orm';
import { db, audioUploads, generateLocalId, AudioUploadRecord, NewAudioUploadRecord } from '../db';
import { audioStorageService } from './AudioStorageService';
import voiceService from '../voice';

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface AudioUpload {
  id: string;
  noteId: string;
  localPath: string;
  fileSize: number | null;
  status: UploadStatus;
  uploadProgress: number;
  remoteUrl: string | null;
  transcription: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface QueueUploadInput {
  noteId: string;
  localPath: string;
  fileSize?: number;
}

type UploadProgressCallback = (upload: AudioUpload) => void;

function recordToAudioUpload(record: AudioUploadRecord): AudioUpload {
  return {
    id: record.id,
    noteId: record.noteId,
    localPath: record.localPath,
    fileSize: record.fileSize,
    status: record.status as UploadStatus,
    uploadProgress: record.uploadProgress ?? 0,
    remoteUrl: record.remoteUrl,
    transcription: record.transcription,
    retryCount: record.retryCount ?? 0,
    lastError: record.lastError,
    createdAt: record.createdAt,
    completedAt: record.completedAt,
  };
}

/**
 * Manages the audio upload queue for offline-first audio handling
 */
export class AudioUploadManager {
  private static MAX_RETRIES = 3;
  private isProcessing = false;
  private progressCallback?: UploadProgressCallback;

  /**
   * Set callback for upload progress updates
   */
  onProgress(callback: UploadProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Report progress to callback
   */
  private reportProgress(upload: AudioUpload): void {
    if (this.progressCallback) {
      this.progressCallback(upload);
    }
  }

  /**
   * Queue an audio file for upload
   */
  async queueUpload(input: QueueUploadInput): Promise<AudioUpload> {
    const now = new Date().toISOString();
    const id = generateLocalId();

    // Get file size if not provided
    let fileSize = input.fileSize;
    if (!fileSize) {
      const info = await audioStorageService.getFileInfo(input.localPath);
      fileSize = info?.size || 0;
    }

    const newUpload: NewAudioUploadRecord = {
      id,
      noteId: input.noteId,
      localPath: input.localPath,
      fileSize,
      status: 'pending',
      uploadProgress: 0,
      remoteUrl: null,
      transcription: null,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      completedAt: null,
    };

    await db.insert(audioUploads).values(newUpload);

    console.log(`[AudioUploadManager] Queued upload: ${id} for note ${input.noteId}`);

    const upload = await this.getById(id);
    if (!upload) throw new Error('Failed to queue upload');
    return upload;
  }

  /**
   * Get upload by ID
   */
  async getById(id: string): Promise<AudioUpload | null> {
    const results = await db
      .select()
      .from(audioUploads)
      .where(eq(audioUploads.id, id));

    return results.length > 0 ? recordToAudioUpload(results[0]) : null;
  }

  /**
   * Get all pending uploads
   */
  async getPendingUploads(): Promise<AudioUpload[]> {
    const results = await db
      .select()
      .from(audioUploads)
      .where(
        and(
          eq(audioUploads.status, 'pending'),
          sql`${audioUploads.retryCount} < ${AudioUploadManager.MAX_RETRIES}`
        )
      )
      .orderBy(asc(audioUploads.createdAt));

    return results.map(recordToAudioUpload);
  }

  /**
   * Get all uploads (for UI display)
   */
  async getAllUploads(): Promise<AudioUpload[]> {
    const results = await db
      .select()
      .from(audioUploads)
      .orderBy(asc(audioUploads.createdAt));

    return results.map(recordToAudioUpload);
  }

  /**
   * Get count of pending uploads
   */
  async getPendingCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(audioUploads)
      .where(eq(audioUploads.status, 'pending'));

    return result[0]?.count || 0;
  }

  /**
   * Get total size of pending uploads
   */
  async getPendingSize(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`sum(file_size)` })
      .from(audioUploads)
      .where(eq(audioUploads.status, 'pending'));

    return result[0]?.total || 0;
  }

  /**
   * Update upload status
   */
  private async updateStatus(id: string, status: UploadStatus, additionalFields?: Partial<AudioUploadRecord>): Promise<void> {
    await db
      .update(audioUploads)
      .set({
        status,
        ...additionalFields,
      })
      .where(eq(audioUploads.id, id));
  }

  /**
   * Process a single upload
   */
  async processUpload(upload: AudioUpload): Promise<boolean> {
    console.log(`[AudioUploadManager] Processing upload: ${upload.id}`);

    try {
      // Update status to uploading
      await this.updateStatus(upload.id, 'uploading', { uploadProgress: 0 });
      this.reportProgress({ ...upload, status: 'uploading', uploadProgress: 0 });

      // Process the audio using voice service
      const result = await voiceService.processVoiceMemo(
        upload.localPath,
        undefined, // folderId will be handled by the note
        (progress, status) => {
          // Update progress
          this.updateStatus(upload.id, 'uploading', { uploadProgress: progress / 100 });
          this.reportProgress({ ...upload, status: 'uploading', uploadProgress: progress / 100 });
        }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Mark as processing (server is transcribing)
      await this.updateStatus(upload.id, 'processing', { uploadProgress: 1 });
      this.reportProgress({ ...upload, status: 'processing', uploadProgress: 1 });

      // Update with result
      const now = new Date().toISOString();
      await this.updateStatus(upload.id, 'completed', {
        uploadProgress: 1,
        remoteUrl: null, // Audio URL is on the server, not returned in response
        transcription: result.data?.transcript || null,
        completedAt: now,
      });

      const completedUpload = await this.getById(upload.id);
      if (completedUpload) {
        this.reportProgress(completedUpload);
      }

      console.log(`[AudioUploadManager] Upload completed: ${upload.id}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      console.error(`[AudioUploadManager] Upload failed: ${upload.id}`, error);

      const retryCount = upload.retryCount + 1;
      if (retryCount >= AudioUploadManager.MAX_RETRIES) {
        await this.updateStatus(upload.id, 'failed', {
          retryCount,
          lastError: errorMsg,
        });
      } else {
        await this.updateStatus(upload.id, 'pending', {
          retryCount,
          lastError: errorMsg,
        });
      }

      const failedUpload = await this.getById(upload.id);
      if (failedUpload) {
        this.reportProgress(failedUpload);
      }

      return false;
    }
  }

  /**
   * Process all pending uploads
   */
  async processAll(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[AudioUploadManager] Already processing');
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      const pending = await this.getPendingUploads();
      console.log(`[AudioUploadManager] Processing ${pending.length} pending uploads`);

      for (const upload of pending) {
        const success = await this.processUpload(upload);
        if (success) {
          processed++;
        } else {
          failed++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, failed };
  }

  /**
   * Cancel an upload
   */
  async cancelUpload(id: string): Promise<void> {
    const upload = await this.getById(id);
    if (!upload) return;

    // Delete from queue
    await db.delete(audioUploads).where(eq(audioUploads.id, id));

    // Optionally delete the local file (be careful with this!)
    // await audioStorageService.deleteAudio(upload.localPath);

    console.log(`[AudioUploadManager] Cancelled upload: ${id}`);
  }

  /**
   * Delete completed uploads (cleanup)
   */
  async cleanupCompleted(deleteLocalFiles: boolean = false): Promise<number> {
    const completed = await db
      .select()
      .from(audioUploads)
      .where(eq(audioUploads.status, 'completed'));

    if (deleteLocalFiles) {
      for (const upload of completed) {
        await audioStorageService.deleteAudio(upload.localPath);
      }
    }

    await db.delete(audioUploads).where(eq(audioUploads.status, 'completed'));

    console.log(`[AudioUploadManager] Cleaned up ${completed.length} completed uploads`);
    return completed.length;
  }

  /**
   * Retry failed uploads
   */
  async retryFailed(): Promise<number> {
    const result = await db
      .update(audioUploads)
      .set({
        status: 'pending',
        retryCount: 0,
        lastError: null,
      })
      .where(eq(audioUploads.status, 'failed'));

    console.log('[AudioUploadManager] Reset failed uploads for retry');
    return 0; // SQLite doesn't return affected rows count easily
  }

  /**
   * Get upload for a specific note
   */
  async getUploadForNote(noteId: string): Promise<AudioUpload | null> {
    const results = await db
      .select()
      .from(audioUploads)
      .where(eq(audioUploads.noteId, noteId))
      .orderBy(asc(audioUploads.createdAt));

    return results.length > 0 ? recordToAudioUpload(results[0]) : null;
  }

  /**
   * Check if processing
   */
  get processing(): boolean {
    return this.isProcessing;
  }
}

// Export singleton instance
export const audioUploadManager = new AudioUploadManager();
