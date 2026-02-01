import { Paths, File, Directory } from 'expo-file-system';

const AUDIO_DIR_NAME = 'audio';

/**
 * Get the audio directory path
 */
function getAudioDirectory(): Directory {
  return new Directory(Paths.document, AUDIO_DIR_NAME);
}

export interface AudioFileInfo {
  path: string;
  filename: string;
  size: number;
  createdAt: string;
}

/**
 * Manages local audio file storage in the app's permanent document directory
 */
export class AudioStorageService {
  /**
   * Ensure audio directory exists
   */
  async ensureDirectory(): Promise<Directory> {
    const audioDir = getAudioDirectory();
    if (!audioDir.exists) {
      audioDir.create();
      console.log('[AudioStorage] Created audio directory');
    }
    return audioDir;
  }

  /**
   * Save audio from temporary location to permanent storage
   * Returns the new permanent path
   */
  async saveAudio(tempUri: string, noteId: string): Promise<string> {
    const audioDir = await this.ensureDirectory();

    // Generate unique filename
    const timestamp = Date.now();
    const extension = this.getExtension(tempUri);
    const filename = `${noteId}_${timestamp}${extension}`;

    const tempFile = new File(tempUri);
    const permanentFile = new File(audioDir, filename);

    // Copy file to permanent storage
    tempFile.copy(permanentFile);

    console.log(`[AudioStorage] Saved audio: ${permanentFile.uri}`);
    return permanentFile.uri;
  }

  /**
   * Move audio file to permanent storage (faster than copy)
   */
  async moveAudio(tempUri: string, noteId: string): Promise<string> {
    const audioDir = await this.ensureDirectory();

    const timestamp = Date.now();
    const extension = this.getExtension(tempUri);
    const filename = `${noteId}_${timestamp}${extension}`;

    const tempFile = new File(tempUri);
    const permanentFile = new File(audioDir, filename);

    // Move file to permanent storage
    tempFile.move(permanentFile);

    console.log(`[AudioStorage] Moved audio: ${permanentFile.uri}`);
    return permanentFile.uri;
  }

  /**
   * Get file info for an audio file
   */
  async getFileInfo(path: string): Promise<AudioFileInfo | null> {
    try {
      const file = new File(path);
      if (!file.exists) return null;

      return {
        path,
        filename: file.name,
        size: file.size || 0,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AudioStorage] Failed to get file info:', error);
      return null;
    }
  }

  /**
   * Delete an audio file
   */
  async deleteAudio(path: string): Promise<boolean> {
    try {
      const file = new File(path);
      if (file.exists) {
        file.delete();
        console.log(`[AudioStorage] Deleted audio: ${path}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AudioStorage] Failed to delete audio:', error);
      return false;
    }
  }

  /**
   * Get all stored audio files
   */
  async listAudioFiles(): Promise<AudioFileInfo[]> {
    try {
      const audioDir = await this.ensureDirectory();
      const contents = audioDir.list();
      const audioFiles: AudioFileInfo[] = [];

      for (const item of contents) {
        if (item instanceof File) {
          const info = await this.getFileInfo(item.uri);
          if (info) {
            audioFiles.push(info);
          }
        }
      }

      return audioFiles;
    } catch (error) {
      console.error('[AudioStorage] Failed to list audio files:', error);
      return [];
    }
  }

  /**
   * Get total storage used by audio files
   */
  async getTotalStorageUsed(): Promise<number> {
    const files = await this.listAudioFiles();
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Clear all audio files (for storage management)
   */
  async clearAllAudio(): Promise<void> {
    try {
      const audioDir = getAudioDirectory();
      if (audioDir.exists) {
        audioDir.delete();
        await this.ensureDirectory();
        console.log('[AudioStorage] Cleared all audio files');
      }
    } catch (error) {
      console.error('[AudioStorage] Failed to clear audio:', error);
    }
  }

  /**
   * Read audio file as base64
   */
  async readAsBase64(path: string): Promise<string | null> {
    try {
      const file = new File(path);
      const text = file.text();
      // Convert to base64 - expo-file-system v19 uses Blob API
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (error) {
      console.error('[AudioStorage] Failed to read audio as base64:', error);
      return null;
    }
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    const file = new File(path);
    return file.exists;
  }

  /**
   * Get file extension from URI
   */
  private getExtension(uri: string): string {
    // Remove query params if present
    const pathWithoutQuery = uri.split('?')[0];
    const extension = pathWithoutQuery.match(/\.[^.]+$/)?.[0] || '.m4a';
    return extension;
  }

  /**
   * Get MIME type for audio file
   */
  getMimeType(path: string): string {
    const extension = this.getExtension(path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.m4a': 'audio/m4a',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.mp4': 'audio/mp4',
    };
    return mimeTypes[extension] || 'audio/m4a';
  }
}

// Export singleton instance
export const audioStorageService = new AudioStorageService();
