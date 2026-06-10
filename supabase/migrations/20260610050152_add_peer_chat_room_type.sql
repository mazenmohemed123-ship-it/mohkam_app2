
-- Add peer_chat room type for direct staff-to-staff messaging
ALTER TABLE messages DROP CONSTRAINT messages_room_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_room_type_check
  CHECK (room_type IN ('client_chat', 'internal_team_chat', 'peer_chat'));

-- Add peer_target_id column for peer-to-peer chat (the other user's ID)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS peer_target_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- RLS for peer_chat: both sender and target can see the conversation
DROP POLICY IF EXISTS "select_case_messages" ON messages;

CREATE POLICY "select_case_messages" ON messages FOR SELECT TO authenticated USING (
  -- Internal team chat
  (room_type = 'internal_team_chat' AND (
    team_id = auth.uid()
    OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
  OR
  -- Client chat
  (room_type = 'client_chat' AND case_id IN (
    SELECT id FROM cases WHERE
      lawyer_id = auth.uid()
      OR client_id = auth.uid()
      OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
  OR
  -- Peer chat: sender or target can read
  (room_type = 'peer_chat' AND (sender_id = auth.uid() OR peer_target_id = auth.uid()))
  OR
  -- Fallback for legacy messages without room_type
  room_type IS NULL
);

-- Update INSERT policy to support peer_chat
DROP POLICY IF EXISTS "insert_case_messages" ON messages;

CREATE POLICY "insert_case_messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    (room_type = 'internal_team_chat' AND (
      team_id = auth.uid()
      OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR
    (room_type = 'client_chat' AND case_id IN (
      SELECT id FROM cases WHERE
        lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR
    -- Peer chat: target must be a teammate (same master_lawyer_id or is the master lawyer)
    (room_type = 'peer_chat' AND peer_target_id IN (
      SELECT p2.id FROM profiles p2 WHERE
        p2.id = (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid())
        OR p2.master_lawyer_id = (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid())
        OR p2.master_lawyer_id = auth.uid()
        OR (p2.id = auth.uid() AND (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()) IS NULL AND p2.id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid()))
    ))
    OR
    room_type IS NULL
  )
);
