export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          name: string
          file_path: string
          file_size: number
          mime_type: string
          chunk_count: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          file_path: string
          file_size: number
          mime_type: string
          chunk_count?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          chunk_count?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          content: string
          embedding: number[] | null
          chunk_index: number
          page_number: number | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding?: number[] | null
          chunk_index: number
          page_number?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: number[] | null
          chunk_index?: number
          page_number?: number | null
          metadata?: Json | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          source_chunks: Json | null
          token_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          source_chunks?: Json | null
          token_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          source_chunks?: Json | null
          token_count?: number | null
          created_at?: string
        }
      }
      citations: {
        Row: {
          id: string
          message_id: string
          document_id: string
          chunk_id: string
          page_number: number | null
          highlighted_text: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          document_id: string
          chunk_id: string
          page_number?: number | null
          highlighted_text: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          document_id?: string
          chunk_id?: string
          page_number?: number | null
          highlighted_text?: string
          created_at?: string
        }
      }
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          content: string
          document_id: string
          chunk_index: number
          similarity: number
        }[]
      }
      get_user_documents: {
        Args: {
          user_id: string
        }
        Returns: {
          id: string
          user_id: string
          name: string
          created_at: string
          status: string
        }[]
      }
      get_conversation_messages: {
        Args: {
          conversation_id: string
        }
        Returns: {
          id: string
          conversation_id: string
          role: string
          content: string
          created_at: string
        }[]
      }
    }
  }
}
