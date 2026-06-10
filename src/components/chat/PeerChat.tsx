import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, ArrowRight } from 'lucide-react';
import { Button, Spinner } from '../atoms';
import { supabase } from '../../services/supabase';
import { checkFloodLimit } from '../../services/floodProtection';
import { sanitize } from '../../services/sanitize';

interface PeerMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message_text: string;
  peer_target_id?: string;
  room_type?: string;
  created_at: string;
}

interface Teammate {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface PeerChatProps {
  masterLawyerId: string;
  userId: string;
  target: Teammate | null;
  onBack: () => void;
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

function peerRoomId(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function PeerChat({ masterLawyerId, userId, target, onBack, push }: PeerChatProps) {
  const [msgs, setMsgs] = useState<PeerMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<any>(null);

  const roomId = target ? peerRoomId(userId, target.id) : '';

  useEffect(() => {
    if (!target) return;
    loadMessages();
  }, [target?.id]);

  useEffect(() => {
    if (!target) return;

    chRef.current?.unsubscribe();
    chRef.current = supabase
      .channel('peer_chat:' + roomId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const msg = payload.new as PeerMessage;
        if (msg.room_type === 'peer_chat' && msg.peer_target_id) {
          const isRelevant =
            (msg.sender_id === userId && msg.peer_target_id === target!.id) ||
            (msg.sender_id === target!.id && msg.peer_target_id === userId);
          if (isRelevant) {
            setMsgs((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      })
      .subscribe();

    return () => { chRef.current?.unsubscribe(); };
  }, [roomId, userId, target?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const loadMessages = async () => {
    if (!target) return;
    setLoading(true);
    // Fetch messages where either (sender=me, target=them) OR (sender=them, target=me)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_type', 'peer_chat')
      .or(`and(sender_id.eq.${userId},peer_target_id.eq.${target.id}),and(sender_id.eq.${target.id},peer_target_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (!error && data) setMsgs(data);
    setLoading(false);
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !target) return;
    const { allowed } = checkFloodLimit();
    if (!allowed) { push('⚠️ إرسال سريع جداً!', 'warning'); return; }

    setSending(true);
    const safeText = sanitize(input);
    const { error } = await supabase.from('messages').insert([{
      sender_id: userId,
      sender_role: 'internal',
      message_text: safeText,
      room_type: 'peer_chat',
      peer_target_id: target.id,
      team_id: masterLawyerId,
    }]);
    if (!error) setInput('');
    else push('خطأ في الإرسال', 'danger');
    setSending(false);
  }, [input, userId, target, masterLawyerId, push]);

  if (!target) return null;

  const isMe = (senderId: string) => senderId === userId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, #EFF6FF, #fff)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={onBack} style={{ background: 'rgba(15,37,87,.08)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowRight size={14} color="var(--navy)" />
        </button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {target.avatar_url ? <img src={target.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16 }}>👤</span>}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{target.full_name}</p>
          <p style={{ fontSize: 10, color: 'var(--muted)' }}>{ROLE_LABELS[target.role] || target.role}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="pulse" style={{ width: 7, height: 7, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>مباشر</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFBFE' }}>
        {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>جاري التحميل...</p>}
        {!loading && msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>ابدأ محادثة خاصة مع {target.full_name}</p>
          </div>
        )}
        {msgs.map((msg) => {
          const mine = isMe(msg.sender_id);
          return (
            <div key={msg.id} className="fade-up" style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div className={mine ? 'chat-me' : 'chat-other'} style={{ maxWidth: '76%', padding: '10px 14px', fontSize: 13, lineHeight: 1.75, direction: 'rtl' }}>
                {msg.message_text}
                <p style={{ fontSize: 9, marginTop: 4, opacity: 0.45, textAlign: 'left', fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: '#fff' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالة خاصة..."
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
