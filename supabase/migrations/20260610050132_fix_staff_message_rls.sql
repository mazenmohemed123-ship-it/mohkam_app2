
-- Fix staff sub-account access to internal team chat and client chat messages.
-- The old policy failed because staff auth.uid() != team_id (master lawyer's ID).
-- New policy: also allow when the user's master_lawyer_id matches the team_id
-- (for team chat) or the case's lawyer_id (for client chat).

DROP POLICY IF EXISTS "select_case_messages" ON messages;

CREATE POLICY "select_case_messages" ON messages FOR SELECT TO authenticated USING (
  -- Internal team chat: user is the team owner OR user's master_lawyer_id equals team_id
  (room_type = 'internal_team_chat' AND (
    team_id = auth.uid()
    OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
  OR
  -- Client chat: user is the lawyer, the client, or a staff member of the lawyer
  (room_type = 'client_chat' AND case_id IN (
    SELECT id FROM cases WHERE
      lawyer_id = auth.uid()
      OR client_id = auth.uid()
      OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
);

-- Fix INSERT policy: staff must be able to insert messages into cases they have access to.
-- The old policy only checked sender_id = auth.uid(), which works for INSERT itself,
-- but the CHECK on case_id FK could fail if staff can't see the case.
-- Add an explicit staff-friendly INSERT policy.
DROP POLICY IF EXISTS "insert_case_messages" ON messages;

CREATE POLICY "insert_case_messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    -- Internal team chat: team_id must be the user or their master lawyer
    (room_type = 'internal_team_chat' AND (
      team_id = auth.uid()
      OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR
    -- Client chat: case must belong to user or their master lawyer
    (room_type = 'client_chat' AND case_id IN (
      SELECT id FROM cases WHERE
        lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR
    -- Fallback: no room_type specified (legacy messages)
    room_type IS NULL
  )
);
