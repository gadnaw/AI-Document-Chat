-- Migration: 005_storage_bucket.sql
-- Description: Create documents storage bucket with RLS policies

-- Enable storage extension if not already enabled
-- Note: This is usually enabled by default in Supabase

-- Create the documents bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Private bucket - requires authentication
  52428800, -- 50MB file size limit
  ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policy: Users can upload files to their own folder
-- Files are stored as: {user_id}/{filename}
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Users can view/download their own files
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Users can update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: Users can delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable RLS on storage.objects (usually already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant usage on storage schema to authenticated users
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Comment for documentation
COMMENT ON POLICY "Users can upload to their own folder" ON storage.objects IS 
  'Allows authenticated users to upload files only to their own folder (/{user_id}/)';
COMMENT ON POLICY "Users can view their own files" ON storage.objects IS 
  'Allows authenticated users to view and download only their own files';
COMMENT ON POLICY "Users can update their own files" ON storage.objects IS 
  'Allows authenticated users to update only their own files';
COMMENT ON POLICY "Users can delete their own files" ON storage.objects IS 
  'Allows authenticated users to delete only their own files';
