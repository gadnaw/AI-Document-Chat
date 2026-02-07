import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit Tests: File Validation (src/lib/file-validation.ts)
 * Tests file validation utilities
 */
describe('File Validation', () => {
  
  describe('validateExtension', () => {
    it('should accept .pdf extension (case insensitive)', async () => {
      const { validateExtension } = await createValidator();
      
      expect(validateExtension('document.pdf').valid).toBe(true);
      expect(validateExtension('document.PDF').valid).toBe(true);
      expect(validateExtension('Document.Pdf').valid).toBe(true);
    });

    it('should reject non-PDF extensions', async () => {
      const { validateExtension } = await createValidator();
      
      expect(validateExtension('document.txt').valid).toBe(false);
      expect(validateExtension('document.docx').valid).toBe(false);
      expect(validateExtension('document.jpg').valid).toBe(false);
    });

    it('should provide helpful error message', async () => {
      const { validateExtension } = await createValidator();
      
      const result = validateExtension('file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('PDF');
      expect(result.error).toContain('50MB');
    });
  });

  describe('validateFileSize', () => {
    it('should accept files under 50MB', async () => {
      const { validateFileSize } = await createValidator();
      
      // 1MB file
      expect(validateFileSize(1 * 1024 * 1024).valid).toBe(true);
      
      // 49MB file
      expect(validateFileSize(49 * 1024 * 1024).valid).toBe(true);
    });

    it('should reject files over 50MB', async () => {
      const { validateFileSize } = await createValidator();
      
      // 51MB file
      const result = validateFileSize(51 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('50MB');
    });

    it('should reject empty files', async () => {
      const { validateFileSize } = await createValidator();
      
      expect(validateFileSize(0).valid).toBe(false);
      expect(validateFileSize(-1).valid).toBe(false);
    });
  });

  describe('validateMimeType', () => {
    it('should accept standard PDF MIME type', async () => {
      const { validateMimeType } = await createValidator();
      
      expect(validateMimeType('application/pdf').valid).toBe(true);
    });

    it('should accept alternative PDF MIME types', async () => {
      const { validateMimeType } = await createValidator();
      
      const alternativeTypes = [
        'application/x-pdf',
        'application/acrobat',
        'applications/pdf',
        'text/pdf',
        'text/x-pdf',
      ];
      
      for (const type of alternativeTypes) {
        expect(validateMimeType(type).valid).toBe(true);
      }
    });

    it('should reject non-PDF MIME types', async () => {
      const { validateMimeType } = await createValidator();
      
      expect(validateMimeType('text/plain').valid).toBe(false);
      expect(validateMimeType('application/msword').valid).toBe(false);
      expect(validateMimeType('image/jpeg').valid).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should validate complete file requirements', async () => {
      const { validateFile } = await createValidator();
      
      const mockFile = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
        size: 1 * 1024 * 1024, // 1MB
      });
      
      const result = await validateFile(mockFile);
      
      expect(result.valid).toBe(true);
      expect(result.sha256).toBeDefined();
    });

    it('should fail on invalid extension', async () => {
      const { validateFile } = await createValidator();
      
      const mockFile = createMockFile({
        name: 'document.txt',
        type: 'text/plain',
        size: 1000,
      });
      
      const result = await validateFile(mockFile);
      expect(result.valid).toBe(false);
    });

    it('should fail on file too large', async () => {
      const { validateFile } = await createValidator();
      
      const mockFile = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
        size: 51 * 1024 * 1024, // 51MB
      });
      
      const result = await validateFile(mockFile);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMultipleFiles', () => {
    it('should separate valid and invalid files', async () => {
      const { validateMultipleFiles } = await createValidator();
      
      const files = [
        createMockFile({ name: 'valid.pdf', type: 'application/pdf', size: 1000 }),
        createMockFile({ name: 'invalid.txt', type: 'text/plain', size: 1000 }),
        createMockFile({ name: 'also-valid.pdf', type: 'application/pdf', size: 1000 }),
      ];
      
      const result = await validateMultipleFiles(files);
      
      expect(result.valid.length).toBe(2);
      expect(result.invalid.length).toBe(1);
      expect(result.invalid[0].file.name).toBe('invalid.txt');
    });
  });

  describe('generateFileHash', () => {
    it('should generate SHA-256 hash', async () => {
      const { generateFileHash } = await createValidator();
      
      const mockFile = createMockFile({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 100,
      });
      
      const hash = await generateFileHash(mockFile);
      
      // SHA-256 is 64 hex characters
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('should handle hash generation errors gracefully', async () => {
      const { generateFileHash } = await createValidator();
      
      // Mock file that will cause arrayBuffer to fail
      const mockFile = {
        name: 'test.pdf',
        type: 'application/pdf',
        size: 100,
        arrayBuffer: vi.fn().mockRejectedValue(new Error('Read error')),
      };
      
      const hash = await generateFileHash(mockFile as any);
      
      // Should return placeholder
      expect(hash).toContain('placeholder');
    });
  });

  describe('validateFilesForUpload', () => {
    it('should provide summary of validation results', async () => {
      const { validateFilesForUpload } = await createValidator();
      
      const files = [
        createMockFile({ name: 'doc1.pdf', type: 'application/pdf', size: 1000 }),
        createMockFile({ name: 'doc2.pdf', type: 'application/pdf', size: 2000 }),
      ];
      
      const result = await validateFilesForUpload(files);
      
      expect(result.ready.length).toBe(2);
      expect(result.rejected.length).toBe(0);
      expect(result.summary).toContain('ready');
    });

    it('should show correct summary when some files rejected', async () => {
      const { validateFilesForUpload } = await createValidator();
      
      const files = [
        createMockFile({ name: 'doc.pdf', type: 'application/pdf', size: 1000 }),
        createMockFile({ name: 'doc.txt', type: 'text/plain', size: 1000 }),
      ];
      
      const result = await validateFilesForUpload(files);
      
      expect(result.ready.length).toBe(1);
      expect(result.rejected.length).toBe(1);
      expect(result.summary).toContain('ready');
      expect(result.summary).toContain('rejected');
    });
  });
});

// Helper function to create isolated module instance
async function createValidator() {
  const module = await import('@/lib/file-validation');
  return {
    validateExtension: module.validateExtension,
    validateMimeType: module.validateMimeType,
    validateFileSize: module.validateFileSize,
    validateFile: module.validateFile,
    validateMultipleFiles: module.validateMultipleFiles,
    generateFileHash: module.generateFileHash,
    validateFilesForUpload: module.validateFilesForUpload,
  };
}

// Helper function to create mock File object
function createMockFile(config: { name: string; type: string; size: number }) {
  return {
    name: config.name,
    type: config.type,
    size: config.size,
    slice: vi.fn().mockImplementation((start: number, end: number) => ({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    })),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(config.size)),
  };
}
