
-- Create chat-attachments storage bucket for chat file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "auth_upload_chat_attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Allow anon users to upload (for client zero-auth)
CREATE POLICY "anon_upload_chat_attachments" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'chat-attachments');

-- Allow public read access
CREATE POLICY "public_read_chat_attachments" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-attachments');
