/**
 * Unit tests for textUtils
 */

import {
  generateTitleFromContent,
  isUserSetTitle,
  shouldAutoGenerateTitle,
} from '../../utils/textUtils';

describe('textUtils', () => {
  describe('generateTitleFromContent', () => {
    it('should return empty string for empty content', () => {
      expect(generateTitleFromContent('')).toBe('');
      expect(generateTitleFromContent('   ')).toBe('');
    });

    it('should return empty string for null/undefined content', () => {
      expect(generateTitleFromContent(null as unknown as string)).toBe('');
      expect(generateTitleFromContent(undefined as unknown as string)).toBe('');
    });

    it('should use first line if within limit', () => {
      const content = 'First line\nSecond line\nThird line';
      expect(generateTitleFromContent(content)).toBe('First line');
    });

    it('should use first sentence if ends within limit', () => {
      const content = 'This is a short sentence. This is another sentence.';
      expect(generateTitleFromContent(content)).toBe('This is a short sentence.');
    });

    it('should handle exclamation marks as sentence enders', () => {
      const content = 'Hello World! This is more text.';
      expect(generateTitleFromContent(content)).toBe('Hello World!');
    });

    it('should handle question marks as sentence enders', () => {
      const content = 'Is this working? Yes it is.';
      expect(generateTitleFromContent(content)).toBe('Is this working?');
    });

    it('should return full content if under limit', () => {
      const content = 'Short content';
      expect(generateTitleFromContent(content)).toBe('Short content');
    });

    it('should truncate at word boundary with ellipsis', () => {
      const content = 'This is a very long piece of content that definitely exceeds the fifty character limit for titles';
      const result = generateTitleFromContent(content);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(result.endsWith('...')).toBe(true);
      expect(result).not.toMatch(/\s\.\.\.$/); // Should not have space before ellipsis
    });

    it('should trim whitespace from result', () => {
      const content = '  First line  \n  Second line  ';
      expect(generateTitleFromContent(content)).toBe('First line');
    });

    it('should handle content with only whitespace and newlines', () => {
      const content = '   \n   \n   ';
      expect(generateTitleFromContent(content)).toBe('');
    });
  });

  describe('isUserSetTitle', () => {
    it('should return false for empty title', () => {
      expect(isUserSetTitle('')).toBe(false);
      expect(isUserSetTitle('   ')).toBe(false);
    });

    it('should return false for null/undefined title', () => {
      expect(isUserSetTitle(null as unknown as string)).toBe(false);
      expect(isUserSetTitle(undefined as unknown as string)).toBe(false);
    });

    it('should return false for placeholder titles', () => {
      expect(isUserSetTitle('Untitled')).toBe(false);
      expect(isUserSetTitle('untitled')).toBe(false);
      expect(isUserSetTitle('UNTITLED')).toBe(false);
      expect(isUserSetTitle('Untitled Note')).toBe(false);
      expect(isUserSetTitle('untitled note')).toBe(false);
      expect(isUserSetTitle('New Note')).toBe(false);
      expect(isUserSetTitle('new note')).toBe(false);
      expect(isUserSetTitle('Note')).toBe(false);
      expect(isUserSetTitle('note')).toBe(false);
    });

    it('should return true for user-set titles', () => {
      expect(isUserSetTitle('My Meeting Notes')).toBe(true);
      expect(isUserSetTitle('Project Ideas')).toBe(true);
      expect(isUserSetTitle('Shopping List')).toBe(true);
      expect(isUserSetTitle('Important reminder')).toBe(true);
    });

    it('should handle trimmed titles with placeholder content', () => {
      expect(isUserSetTitle('  untitled  ')).toBe(false);
      expect(isUserSetTitle('  My Title  ')).toBe(true);
    });
  });

  describe('shouldAutoGenerateTitle', () => {
    it('should return false if content is empty', () => {
      expect(shouldAutoGenerateTitle('Untitled', '')).toBe(false);
      expect(shouldAutoGenerateTitle('Untitled', '   ')).toBe(false);
    });

    it('should return false if content is null/undefined', () => {
      expect(shouldAutoGenerateTitle('Untitled', null as unknown as string)).toBe(false);
      expect(shouldAutoGenerateTitle('Untitled', undefined as unknown as string)).toBe(false);
    });

    it('should return true if title is placeholder and content exists', () => {
      expect(shouldAutoGenerateTitle('Untitled', 'Some content')).toBe(true);
      expect(shouldAutoGenerateTitle('New Note', 'Some content')).toBe(true);
      expect(shouldAutoGenerateTitle('', 'Some content')).toBe(true);
    });

    it('should return false if title is user-set', () => {
      expect(shouldAutoGenerateTitle('My Custom Title', 'Some content')).toBe(false);
      expect(shouldAutoGenerateTitle('Project Notes', 'Some content')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(shouldAutoGenerateTitle('Note', 'Hello')).toBe(true);
      expect(shouldAutoGenerateTitle('note', 'Hello')).toBe(true);
      expect(shouldAutoGenerateTitle('Real Title', 'Hello')).toBe(false);
    });
  });
});
