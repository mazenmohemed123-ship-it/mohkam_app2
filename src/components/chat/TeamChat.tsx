import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Shield, Image as ImageIcon } from 'lucide-react';
import { Button, Spinner } from '../atoms';
import { supabase, sendPushToClient } from '../../services/supabase';
import { checkFloodLimit } from '../../services/floodProtection';
import { sanitize } from '../../services/sanitize';

interface TeamMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message_text: string;
  is_deleted: boolean;
  room_type?: string;
  attachment_url?: string;
  attachment_type?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface TeamChatProps {
  masterLawyerId: string;
  userId: string;
  userRole: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'المحامي المسؤول',
  partner: 'شريك',
  lawyer: 'محامي',
  assistant: 'مساعد',
  secretary: 'سكرتير',
  accountant: 'محاسب',
};

export function TeamChat({ masterLawyerId, userId, userRole, push }: TeamChatProps) {
  const [msgs, setMsgs] = useState<TeamMessage[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<any>(null);

  const effectiveTeamId = masterLawyerId;

  useEffect(() => {
    loadMembers();
    loadMessages();
  }, [masterLawyerId]);

  useEffect(() => {
    if (!effectiveTeamId) return;

    chRef.current?.unsubscribe();
    chRef.current = supabase
      .channel('team_chat:' + effectiveTeamId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `team_id=eq.${effectiveTeamId}`,
      }, (payload) => {
        const msg = payload.new as TeamMessage;
        if (msg.room_type === 'internal_team_chat') {
          setMsgs((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      })
      .subscribe();

    return () => { chRef.current?.unsubscribe(); };
  }, [effectiveTeamId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const loadMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .or(`id.eq.${masterLawyerId},master_lawyer_id.eq.${masterLawyerId}`)
      .in('role', ['owner', 'partner', 'lawyer', 'assistant', 'secretary', 'accountant']);
    if (data) setMembers(data);
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_type', 'internal_team_chat')
      .eq('team_id', effectiveTeamId)
      .order('created_at', { ascending: true });
    if (!error && data) setMsgs(data);
    setLoading(false);
  };

  const sendMessage = useCallback(async (attachment?: File) => {
    if (!input.trim() && !attachment) return;
    const { allowed } = checkFloodLimit();
    if (!allowed) { push('⚠️ إرسال سريع جداً!', 'warning'); return; }

    setSending(true);
    let attachmentUrl: string | undefined;
    let attachmentType: string | undefined;

    if (attachment) {
      const path = `team-chat/${effectiveTeamId}/${Date.now()}_${attachment.name}`;
      const { error: uploadErr } = await supabase.storage.from('chat-attachments').upload(path, attachment);
      if (!uploadErr) {
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
        attachmentUrl = data?.publicUrl;
        attachmentType = attachment.type.startsWith('image/') ? 'image' : undefined;
      }
    }

    const safeText = sanitize(input);
    const { error } = await supabase.from('messages').insert([{
      sender_id: userId,
      sender_role: userRole,
      message_text: safeText,
      room_type: 'internal_team_chat',
      team_id: effectiveTeamId,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    }]);

    if (!error) {
      setInput('');
      // Notify other team members
      const senderName = members.find((m) => m.id === userId)?.full_name || 'عضو';
      for (const m of members) {
        if (m.id !== userId) {
          sendPushToClient(m.id, `رسالة داخلية من ${senderName}`, safeText.slice(0, 80));
        }
      }
    }
    else push('خطأ في الإرسال', 'danger');
    setSending(false);
  }, [input, effectiveTeamId, userId, userRole, push]);

  const getMemberName = (senderId: string) => {
    const m = members.find((m) => m.id === senderId);
    return m?.full_name || 'عضو';
  };

  const getMemberRole = (senderId: string) => {
    const m = members.find((m) => m.id === senderId);
    return m?.role || 'lawyer';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, #FFFBEB, #fff)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--gold)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 900, fontSize: 15, color: 'var(--gold)' }}>
            الشات الداخلي السري
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            خاص بأعضاء المكتب فقط — الموكلون لا يرونه
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="pulse" style={{ width: 7, height: 7, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>Real-time</span>
        </div>
      </div>

      {/* Member chips */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', background: '#FAFBFE' }}>
        {members.map((m) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 99,
            background: m.id === userId ? 'var(--navy)' : '#F5F8FF',
            color: m.id === userId ? '#fff' : 'var(--navy)',
            fontSize: 11, fontWeight: 700,
          }}>
            <span>{ROLE_LABELS[m.role] || m.role}</span>
            <span style={{ opacity: 0.7 }}>{m.full_name?.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFE' }}>
        {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>جاري التحميل...</p>}
        {!loading && msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Users size={32} color="var(--border)" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>ابدأ المحادثة الداخلية</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>هذه القناة مرئية لأعضاء المكتب فقط</p>
          </div>
        )}

        {msgs.map((msg) => {
          const isMe = msg.sender_id === userId;
          const senderRole = getMemberRole(msg.sender_id);
          return (
            <div key={msg.id} className="fade-up" style={{ display: 'flex', justifyContent: isMe ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '76%' }}>
                {!isMe && (
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', marginBottom: 3, marginRight: 4 }}>
                    {ROLE_LABELS[senderRole] || senderRole} — {getMemberName(msg.sender_id)}
                  </p>
                )}
                <div
                  className={isMe ? 'chat-me' : 'chat-other'}
                  style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.75, direction: 'rtl' }}
                >
                  {msg.attachment_url && msg.attachment_type === 'image' && (
                    <img src={msg.attachment_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: msg.message_text ? 8 : 0 }} />
                  )}
                  {msg.message_text}
                  <p style={{ fontSize: 9, marginTop: 4, opacity: 0.45, textAlign: 'left', fontFamily: "'JetBrains Mono', monospace" }}>
                    {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: '#fff' }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: '#F5F8FF', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendMessage(file);
            }}
            style={{ display: 'none' }}
          />
          <ImageIcon size={16} color="var(--navy)" />
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالة داخلية..."
          dir="rtl"
          maxLength={2000}
          style={{
            flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
            borderRadius: 10, fontSize: 13, fontFamily: "'Cairo',sans-serif", outline: 'none',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--navy-mid)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.border = '1.5px solid var(--border)'; }}
        />
        <Button onClick={() => sendMessage()} disabled={sending} style={{ padding: '10px 16px' }}>
          {sending ? <Spinner size={16} /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
