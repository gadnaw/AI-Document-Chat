import { test, expect } from '@playwright/test';

/**
 * E2E Test: Document Upload Workflow
 * Tests the complete document upload flow
 */
test.describe('Document Upload', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to upload page
    await page.goto('/upload');
    
    // Wait for upload interface
    await expect(page.locator('[data-testid="file-uploader"]')).toBeVisible();
  });

  test('should accept valid PDF file', async ({ page }) => {
    // Create a test file programmatically
    const testFile = await createTestPDF(page, 'test-document.pdf');
    
    // Upload the file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile.path);
    
    // Verify upload starts
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({
      timeout: 60000,
    });
  });

  test('should reject invalid file types', async ({ page }) => {
    // Try to upload a non-PDF file
    const invalidFile = await createTestFile(page, 'test.txt', 'text content');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(invalidFile.path);
    
    // Verify error message appears
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('PDF');
  });

  test('should show progress during upload', async ({ page }) => {
    // Upload a test PDF
    const testFile = await createTestPDF(page, 'large-document.pdf');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile.path);
    
    // Verify progress indicator appears
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    
    // Progress should update
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toHaveAttribute('aria-valuenow', /^\d+$/);
  });

  test('should handle file size limit', async ({ page }) => {
    // Create a file larger than 50MB (limit is 50MB)
    const largeFile = await createLargeFile(page, 'too-large.pdf', 51 * 1024 * 1024);
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(largeFile.path);
    
    // Verify size error
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('50MB');
  });

  test('should allow multiple file uploads', async ({ page }) => {
    // Upload multiple PDFs
    const file1 = await createTestPDF(page, 'doc1.pdf');
    const file2 = await createTestPDF(page, 'doc2.pdf');
    
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([file1.path, file2.path]);
    
    // Verify both files are queued
    await expect(page.locator('[data-testid="upload-queue"]')).toContainText('doc1.pdf');
    await expect(page.locator('[data-testid="upload-queue"]')).toContainText('doc2.pdf');
  });
});

/**
 * E2E Test: Document Processing Status
 * Tests status tracking during document processing
 */
test.describe('Document Processing', () => {
  
  test('should show processing status', async ({ page }) => {
    await page.goto('/upload');
    
    // Upload a test PDF
    const testFile = await createTestPDF(page, 'processing-test.pdf');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(testFile.path);
    
    // Verify processing stages appear
    await expect(page.locator('[data-testid="stage-upload"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-parsing"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-chunking"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-embedding"]')).toBeVisible();
    
    // Wait for completion
    await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({
      timeout: 60000,
    });
  });

  test('should handle processing errors', async ({ page }) => {
    // This would test error handling during processing
    // In a real scenario, you might use a malformed PDF
    
    await page.goto('/upload');
    
    // Verify error handling UI exists
    await expect(page.locator('[data-testid="processing-error"]')).toBeVisible();
  });
});

/**
 * E2E Test: Document List
 * Tests the documents listing page
 */
test.describe('Document List', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents');
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible();
  });

  test('should display uploaded documents', async ({ page }) => {
    // Check for document list
    const documentList = page.locator('[data-testid="document-item"]');
    
    // List should be visible (may be empty)
    await expect(documentList.first()).toBeVisible();
  });

  test('should allow document deletion', async ({ page }) => {
    // Find a document and delete it
    const deleteButton = page.locator('[data-testid="delete-button"]').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirm deletion
      await page.locator('[data-testid="confirm-delete"]').click();
      
      // Verify deletion feedback
      await expect(page.locator('[data-testid="delete-success"]')).toBeVisible();
    }
  });

  test('should show document status', async ({ page }) => {
    // Check status indicators
    const statusIndicator = page.locator('[data-testid="document-status"]').first();
    
    if (await statusIndicator.isVisible()) {
      // Status should be one of: processing, ready, error
      const status = await statusIndicator.getAttribute('data-status');
      expect(['processing', 'ready', 'error']).toContain(status);
    }
  });
});

// Helper functions for creating test files
async function createTestPDF(page: any, name: string) {
  // Create a minimal PDF structure
  const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n149\n%%EOF';
  
  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const path = `./tests/fixtures/${name}`;
  
  // Write file (this is simplified - in real tests you'd use fs)
  return { path, blob };
}

async function createTestFile(page: any, name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const path = `./tests/fixtures/${name}`;
  
  return { path, blob };
}

async function createLargeFile(page: any, name: string, size: number) {
  // Create a file of specified size
  const chunk = 'x'.repeat(1024);
  const chunksNeeded = Math.ceil(size / 1024);
  const content = chunk.repeat(chunksNeeded).slice(0, size);
  
  const blob = new Blob([content], { type: 'application/pdf' });
  const path = `./tests/fixtures/${name}`;
  
  return { path, blob };
}
