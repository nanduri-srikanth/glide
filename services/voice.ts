/**
 * Voice Processing Service
 */

import api from './api';

export interface VoiceProcessingResponse {
  note_id: string;
  title: string;
  transcript: string;
  summary: string | null;
  duration: number;
  folder_id: string | null;
  folder_name: string;
  tags: string[];
  actions: ActionExtractionResult;
  actions_count: number;
  created_at: string;
}

export interface ActionExtractionResult {
  title: string;
  folder: string;
  tags: string[];
  summary: string | null;
  calendar: { title: string; date: string; time: string | null; location: string | null; attendees: string[] }[];
  email: { to: string; subject: string; body: string }[];
  reminders: { title: string; due_date: string; due_time: string | null; priority: string }[];
  next_steps: string[];
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

class VoiceService {
  async processVoiceMemo(
    audioUri: string,
    folderId?: string,
    onProgress?: (progress: number, status: string) => void,
    userNotes?: string
  ): Promise<{ data?: VoiceProcessingResponse; error?: string }> {
    try {
      onProgress?.(10, 'Preparing audio...');

      const formData = new FormData();
      const filename = audioUri.split('/').pop() || 'recording.m4a';
      const fileType = this.getContentType(filename);

      formData.append('audio_file', {
        uri: audioUri,
        name: filename,
        type: fileType,
      } as unknown as Blob);

      if (folderId) formData.append('folder_id', folderId);
      if (userNotes) formData.append('user_notes', userNotes);

      onProgress?.(30, 'Uploading audio...');

      const response = await api.postFormData<VoiceProcessingResponse>('/voice/process', formData);

      if (response.error) return { error: response.error.message };

      onProgress?.(100, 'Complete!');
      return { data: response.data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to process voice memo' };
    }
  }

  async transcribeOnly(audioUri: string): Promise<{ data?: TranscriptionResult; error?: string }> {
    try {
      const formData = new FormData();
      const filename = audioUri.split('/').pop() || 'recording.m4a';
      formData.append('audio_file', {
        uri: audioUri,
        name: filename,
        type: this.getContentType(filename),
      } as unknown as Blob);

      const response = await api.postFormData<TranscriptionResult>('/voice/transcribe', formData);
      if (response.error) return { error: response.error.message };
      return { data: response.data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Transcription failed' };
    }
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      mp3: 'audio/mpeg', m4a: 'audio/x-m4a', wav: 'audio/wav',
      mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
    };
    return contentTypes[ext || ''] || 'audio/mpeg';
  }
}

export const voiceService = new VoiceService();
export default voiceService;
