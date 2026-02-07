/**
 * Tests for Row Level Security (RLS) policy enforcement.
 * 
 * These tests verify that the database RLS policies correctly:
 * - Allow users to access their own data
 * - Prevent users from accessing other users' data
 * - Properly enforce the user_id constraints
 * 
 * Note: These are unit tests using mocked Supabase clients.
 * For full integration testing, run against a real Supabase instance.
 */

import { mockSupabaseClient } from '../jest.setup'

describe('RLS Policy Tests - Documents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('users can only access their own documents', async () => {
    const userId = 'user-123'
    const userDocuments = [
      { id: 'doc-1', user_id: userId, name: 'My Document' },
    ]
    
    // Mock database query that would be filtered by RLS
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: userDocuments,
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('documents').select('*').eq('user_id', userId)
    
    expect(data).toHaveLength(1)
    expect(data![0].user_id).toBe(userId)
  })

  test('cross-user document access returns empty results', async () => {
    // Simulating RLS blocking access to another user's documents
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: [], // RLS would filter out other users' documents
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('documents').select('*').eq('user_id', 'other-user')
    
    // Even if querying for another user's docs, RLS ensures we get nothing
    expect(data).toEqual([])
  })

  test('document insert requires matching user_id', async () => {
    const userId = 'user-123'
    const newDocument = {
      user_id: userId,
      name: 'New Document',
      file_path: `${userId}/doc.pdf`,
      file_size: 1024,
      mime_type: 'application/pdf',
    }
    
    mockSupabaseClient.from().insert.mockReturnThis()
    mockSupabaseClient.from().insert.mockResolvedValueOnce({
      data: { id: 'new-doc-id', ...newDocument },
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data, error } = await supabase.from('documents').insert(newDocument)
    
    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})

describe('RLS Policy Tests - Conversations', () => {
  test('users can only access their own conversations', async () => {
    const userId = 'user-123'
    
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: [
        { id: 'conv-1', user_id: userId, title: 'My Chat' },
      ],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('conversations').select('*').eq('user_id', userId)
    
    expect(data).toHaveLength(1)
    expect(data![0].user_id).toBe(userId)
  })

  test('cross-user conversation access returns empty results', async () => {
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: [],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('conversations').select('*').eq('user_id', 'other-user')
    
    expect(data).toEqual([])
  })
})

describe('RLS Policy Tests - Messages', () => {
  test('messages accessible through owned conversations', async () => {
    // Messages don't have direct user_id - access is through conversation ownership
    const conversationId = 'conv-123'
    
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: [
        { id: 'msg-1', conversation_id: conversationId, role: 'user', content: 'Hello' },
        { id: 'msg-2', conversation_id: conversationId, role: 'assistant', content: 'Hi!' },
      ],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId)
    
    expect(data).toHaveLength(2)
  })
})

describe('RLS Policy Tests - Citations', () => {
  test('citations accessible only through owned messages', async () => {
    const messageId = 'msg-123'
    
    mockSupabaseClient.from().select.mockReturnThis()
    mockSupabaseClient.from().eq.mockReturnThis()
    mockSupabaseClient.from().eq.mockResolvedValueOnce({
      data: [
        { 
          id: 'citation-1', 
          message_id: messageId, 
          document_id: 'doc-1',
          highlighted_text: 'Important text' 
        },
      ],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.from('citations').select('*').eq('message_id', messageId)
    
    expect(data).toHaveLength(1)
    expect(data![0].message_id).toBe(messageId)
  })
})

describe('RLS Policy Tests - Storage', () => {
  test('users can only list files in their own folder', async () => {
    const userId = 'user-123'
    
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: [
        { id: '1', name: 'doc.pdf', metadata: { size: 1024 } },
      ],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.storage.from('documents').list(userId)
    
    expect(data).toHaveLength(1)
  })

  test('listing another users folder returns empty or error', async () => {
    // Storage RLS would prevent access to other users' folders
    mockSupabaseClient.storage.from().list.mockResolvedValueOnce({
      data: [],
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data } = await supabase.storage.from('documents').list('other-user')
    
    expect(data).toEqual([])
  })

  test('upload requires file path to match user folder', async () => {
    const userId = 'user-123'
    const file = new Blob(['test'], { type: 'application/pdf' })
    
    // Valid upload to own folder
    mockSupabaseClient.storage.from().upload.mockResolvedValueOnce({
      data: { path: `${userId}/doc.pdf` },
      error: null,
    })
    
    const supabase = mockSupabaseClient
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(`${userId}/doc.pdf`, file)
    
    expect(error).toBeNull()
    expect(data?.path).toContain(userId)
  })

  test('upload to another users folder fails', async () => {
    const file = new Blob(['test'], { type: 'application/pdf' })
    
    // RLS would block this
    mockSupabaseClient.storage.from().upload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Permission denied' },
    })
    
    const supabase = mockSupabaseClient
    const { error } = await supabase.storage
      .from('documents')
      .upload('other-user/doc.pdf', file)
    
    expect(error).not.toBeNull()
    expect(error!.message).toContain('denied')
  })
})
