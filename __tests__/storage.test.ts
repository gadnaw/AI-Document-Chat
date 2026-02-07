import { mockSupabaseClient } from '../jest.setup'
import { uploadDocument, getDocumentUrl, deleteDocument, listUserDocuments } from '@/lib/storage/client'

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
})

describe('uploadDocument', () => {
  test('generates correct file path with user ID and timestamp', async () => {
    const mockFile = new File(['test content'], 'test-document.pdf', { type: 'application/pdf' })
    const userId = 'user-123'
    
    mockSupabaseClient.storage.from().upload.mockResolvedValueOnce({
      data: { path: `${userId}/123456789-test-document.pdf` },
      error: null,
    })
    
    const result = await uploadDocument(mockFile, userId)
    
    expect(result.path).toMatch(new RegExp(`^${userId}/\\d+-test-document\\.pdf$`))
    expect(result.filename).toBe('test-document.pdf')
    expect(result.mimeType).toBe('application/pdf')
  })

  test('sanitizes filename to remove special characters', async () => {
    const mockFile = new File(['test'], 'My Document (1).pdf', { type: 'application/pdf' })
    const userId = 'user-123'
    
    mockSupabaseClient.storage.from().upload.mockResolvedValueOnce({
      data: { path: `${userId}/123-My_Document__1_.pdf` },
      error: null,
    })
    
    await uploadDocument(mockFile, userId)
    
    // Check that upload was called with a sanitized filename
    const uploadCall = mockSupabaseClient.storage.from().upload.mock.calls[0]
    expect(uploadCall[0]).toMatch(/My_Document__1_\.pdf$/)
  })

  test('throws StorageError on upload failure', async () => {
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    
    mockSupabaseClient.storage.from().upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Storage quota exceeded' },
    })
    
    await expect(uploadDocument(mockFile, 'user-123')).rejects.toThrow('Failed to upload document')
  })
})

describe('getDocumentUrl', () => {
  test('generates signed URL with default expiration', async () => {
    const filePath = 'user-123/document.pdf'
    const signedUrl = 'https://storage.supabase.co/signed/documents/user-123/document.pdf?token=abc123'
    
    mockSupabaseClient.storage.from().createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl },
      error: null,
    })
    
    const result = await getDocumentUrl(filePath)
    
    expect(result).toBe(signedUrl)
    expect(mockSupabaseClient.storage.from().createSignedUrl).toHaveBeenCalledWith(filePath, 60)
  })

  test('accepts custom expiration time', async () => {
    mockSupabaseClient.storage.from().createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    
    await getDocumentUrl('test/doc.pdf', 3600)
    
    expect(mockSupabaseClient.storage.from().createSignedUrl).toHaveBeenCalledWith('test/doc.pdf', 3600)
  })

  test('throws StorageError on URL generation failure', async () => {
    mockSupabaseClient.storage.from().createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'File not found' },
    })
    
    await expect(getDocumentUrl('nonexistent/file.pdf')).rejects.toThrow('Failed to get document URL')
  })
})

describe('deleteDocument', () => {
  test('calls storage remove with correct path', async () => {
    const filePath = 'user-123/document.pdf'
    
    mockSupabaseClient.storage.from().remove.mockResolvedValueOnce({
      data: { path: filePath },
      error: null,
    })
    
    await deleteDocument(filePath)
    
    expect(mockSupabaseClient.storage.from().remove).toHaveBeenCalledWith([filePath])
  })

  test('throws StorageError on deletion failure', async () => {
    mockSupabaseClient.storage.from().remove.mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied' },
    })
    
    await expect(deleteDocument('unauthorized/file.pdf')).rejects.toThrow('Failed to delete document')
  })
})

describe('listUserDocuments', () => {
  test('lists documents in user folder', async () => {
    const userId = 'user-123'
    const mockFiles = [
      { id: '1', name: 'doc1.pdf', metadata: { size: 1024, mimetype: 'application/pdf' }, updated_at: '2024-01-01' },
      { id: '2', name: 'doc2.pdf', metadata: { size: 2048, mimetype: 'application/pdf' }, updated_at: '2024-01-02' },
    ]
    
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: mockFiles,
      error: null,
    })
    
    const result = await listUserDocuments(userId)
    
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('doc1.pdf')
    expect(result[0].path).toBe(`${userId}/doc1.pdf`)
    expect(result[0].size).toBe(1024)
  })

  test('filters out folders from results', async () => {
    const mockItems = [
      { id: null, name: '.folder' }, // Folder (no ID)
      { id: '1', name: 'document.pdf', metadata: { size: 1024 }, updated_at: '2024-01-01' },
    ]
    
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: mockItems,
      error: null,
    })
    
    const result = await listUserDocuments('user-123')
    
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('document.pdf')
  })

  test('handles empty results gracefully', async () => {
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: [],
      error: null,
    })
    
    const result = await listUserDocuments('user-123')
    
    expect(result).toEqual([])
  })

  test('throws StorageError on list failure', async () => {
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: null,
      error: { message: 'Access denied' },
    })
    
    await expect(listUserDocuments('user-123')).rejects.toThrow('Failed to list documents')
  })
})
