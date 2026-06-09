-- =====================================================
-- SECURITY PATCH: Harden RPC, fix insecure RLS policies
-- =====================================================

-- 1. Fix function search_path and revoke public/anon access
CREATE OR REPLACE FUNCTION public.increment_commission_debt(amount NUMERIC, lawyer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET commission_debt = COALESCE(commission_debt, 0) + amount
  WHERE id = lawyer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_commission_debt(numeric, uuid) FROM PUBLIC, anon;

-- 2. Fix insecure INSERT policies on appointment_requests
DROP POLICY IF EXISTS "insert_appointment_requests" ON appointment_requests;
DROP POLICY IF EXISTS "insert_appointment_requests_anon" ON appointment_requests;

-- Authenticated: must be the client on the appointment, and lawyer must exist
CREATE POLICY "insert_appointment_requests" ON appointment_requests FOR INSERT TO authenticated
  WITH CHECK (
    lawyer_id IS NOT NULL
    AND client_id = auth.uid()
    AND lawyer_id IN (SELECT id FROM profiles WHERE role IN ('owner', 'partner', 'lawyer'))
  );

-- Anonymous: must reference a valid lawyer, and case must exist
CREATE POLICY "insert_appointment_requests_anon" ON appointment_requests FOR INSERT TO anon
  WITH CHECK (
    lawyer_id IS NOT NULL
    AND lawyer_id IN (SELECT id FROM profiles WHERE role IN ('owner', 'partner', 'lawyer'))
    AND case_id IN (SELECT id FROM cases WHERE client_phone IS NOT NULL)
  );

-- 3. Fix insecure INSERT policies on case_emergencies
DROP POLICY IF EXISTS "insert_case_emergencies" ON case_emergencies;
DROP POLICY IF EXISTS "insert_case_emergencies_anon" ON case_emergencies;

-- Authenticated: must be case participant (client or lawyer on the case)
CREATE POLICY "insert_case_emergencies" ON case_emergencies FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND case_id IN (
      SELECT id FROM cases
      WHERE lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
    )
  );

-- Anonymous: must reference a valid case with client_phone (client zero-auth)
CREATE POLICY "insert_case_emergencies_anon" ON case_emergencies FOR INSERT TO anon
  WITH CHECK (
    case_id IN (SELECT id FROM cases WHERE client_phone IS NOT NULL)
    AND created_by IS NOT NULL
  );

-- 4. Fix insecure INSERT policies on documents
DROP POLICY IF EXISTS "insert_case_documents" ON documents;
DROP POLICY IF EXISTS "insert_case_documents_anon" ON documents;

-- Authenticated: must be participant on the case
CREATE POLICY "insert_case_documents" ON documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND case_id IN (
      SELECT id FROM cases
      WHERE lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
    )
  );

-- Anonymous: only for client chat attachments on cases with client_phone
CREATE POLICY "insert_case_documents_anon" ON documents FOR INSERT TO anon
  WITH CHECK (
    case_id IN (SELECT id FROM cases WHERE client_phone IS NOT NULL)
    AND uploaded_by IS NOT NULL
  );

-- 5. Fix insecure INSERT on messages (anon was too permissive)
DROP POLICY IF EXISTS "insert_case_messages_anon" ON messages;

CREATE POLICY "insert_case_messages_anon" ON messages FOR INSERT TO anon
  WITH CHECK (
    room_type = 'client_chat'
    AND sender_id IS NOT NULL
    AND case_id IN (SELECT id FROM cases WHERE client_phone IS NOT NULL)
  );