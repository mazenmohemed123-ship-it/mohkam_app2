
-- Create the documents storage bucket (public for client-facing URLs like QR codes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'];

-- Storage policy: authenticated users can upload
CREATE POLICY "auth_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Storage policy: authenticated users can read
CREATE POLICY "auth_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Storage policy: uploader can delete their own files
CREATE POLICY "auth_delete_documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policy: public read (for QR codes and shared documents)
CREATE POLICY "public_read_documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documents');
