import { useState, useEffect } from 'react';
import { UserPlus, Shield, Check, X, Trash2, Users, Pencil, Save, Lock } from 'lucide-react';
import { Button, Card, Badge, Field, Spinner } from '../atoms';
import { supabase } from '../../services/supabase';
import { sanitize } from '../../services/sanitize';

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
  phone_number?: string;
  staff_email?: string;
  avatar_url?: string;
  can_view_billing: boolean;
  can_manage_appointments: boolean;
  can_edit_documents: boolean;
  can_reply_client_chats: boolean;
  master_lawyer_id: string;
  created_at: string;
}

interface TeamManagementProps {
  masterLawyerId: string;
  push: (msg: string, type: 'success' | 'warning' | 'danger') => void;
}

const FIRM_CAP = 6;

const STAFF_ROLES = [
  { id: 'assistant', label: 'مساعد قانوني', icon: '🤝' },
  { id: 'secretary', label: 'سكرتير/ة', icon: '📋' },
  { id: 'accountant', label: 'محاسب/ة', icon: '🧮' },
  { id: 'lawyer', label: 'محامي مشارك', icon: '⚖️' },
  { id: 'partner', label: 'شريك', icon: '🏛️' },
];

const PERMISSIONS = [
  { key: 'can_view_billing', label: 'عرض الفواتير والماليات', description: 'عرض ملخص الإيرادات والمصاريف' },
  { key: 'can_manage_appointments', label: 'إدارة المواعيد', description: 'قبول/رفض طلبات الحجز' },
  { key: 'can_edit_documents', label: 'تعديل مستندات القضايا', description: 'رفع وتعديل الملفات والمستندات' },
  { key: 'can_reply_client_chats', label: 'الرد على شات الموكلين', description: 'إرسال رسائل في محادثات القضايا' },
] as const;

export function TeamManagement({ masterLawyerId, push }: TeamManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState('assistant');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');

  // Permissions edit state
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadStaff();
  }, [masterLawyerId]);

  const loadStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('master_lawyer_id', masterLawyerId)
      .in('role', ['assistant', 'secretary', 'accountant', 'lawyer', 'partner'])
      .order('created_at', { ascending: true });
    if (!error && data) setStaff(data);
    setLoading(false);
  };

  const handleAddStaff = async () => {
    if (staff.length >= FIRM_CAP) {
      push(`⚠️ تم بلوغ الحد الأقصى (${FIRM_CAP} أعضاء). قم بالترقية لإضافة المزيد.`, 'warning');
      return;
    }
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      push('يرجى تعبئة جميع الحقول', 'warning');
      return;
    }
    if (addPassword.length < 6) {
      push('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
      return;
    }

    setSaving(true);
    try {
      // Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: addEmail,
        password: addPassword,
      });

      if (authError) {
        // Fallback: if signup fails, try admin create or skip
        push('خطأ في إنشاء حساب: ' + authError.message, 'danger');
        setSaving(false);
        return;
      }

      if (authData.user) {
        const profile: Record<string, any> = {
          id: authData.user.id,
          full_name: sanitize(addName),
          role: addRole,
          phone_number: addPhone || null,
          staff_email: addEmail,
          tier: 'team',
          master_lawyer_id: masterLawyerId,
          can_view_billing: false,
          can_manage_appointments: addRole === 'secretary',
          can_edit_documents: addRole === 'assistant' || addRole === 'lawyer',
          can_reply_client_chats: addRole !== 'accountant',
          is_emergency_enabled: false,
        };

        const { error: profileError } = await supabase.from('profiles').insert([profile]);
        if (profileError) {
          push('خطأ في إنشاء الملف الشخصي', 'danger');
        } else {
          push(`✓ تم إنشاء حساب ${addName}`, 'success');
          setAddName(''); setAddRole('assistant'); setAddPhone(''); setAddEmail(''); setAddPassword('');
          setShowAddForm(false);
          loadStaff();
        }
      }
    } catch (err: any) {
      push('خطأ: ' + err.message, 'danger');
    }
    setSaving(false);
  };

  const handleRemoveStaff = async (staffId: string, staffName: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', staffId);
    if (!error) {
      setStaff((prev) => prev.filter((s) => s.id !== staffId));
      push(`تم حذف حساب ${staffName}`, 'warning');
    } else {
      push('خطأ في الحذف', 'danger');
    }
  };

  const startEditPerms = (member: StaffMember) => {
    setEditingId(member.id);
    setEditPerms({
      can_view_billing: member.can_view_billing,
      can_manage_appointments: member.can_manage_appointments,
      can_edit_documents: member.can_edit_documents,
      can_reply_client_chats: member.can_reply_client_chats,
    });
  };

  const savePerms = async (staffId: string) => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      can_view_billing: editPerms.can_view_billing ?? false,
      can_manage_appointments: editPerms.can_manage_appointments ?? false,
      can_edit_documents: editPerms.can_edit_documents ?? false,
      can_reply_client_chats: editPerms.can_reply_client_chats ?? false,
    }).eq('id', staffId);

    if (!error) {
      setStaff((prev) => prev.map((s) => s.id === staffId ? { ...s, ...editPerms } : s));
      push('✓ تم تحديث الصلاحيات', 'success');
    } else {
      push('خطأ في تحديث الصلاحيات', 'danger');
    }
    setEditingId(null);
    setSaving(false);
  };

  const getRoleLabel = (role: string) => STAFF_ROLES.find((r) => r.id === role)?.label || role;
  const getRoleIcon = (role: string) => STAFF_ROLES.find((r) => r.id === role)?.icon || '👤';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} /> إدارة فريق المكتب
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {staff.length}/{FIRM_CAP} عضو في الفريق
          </p>
        </div>
        <Button variant="gold" onClick={() => setShowAddForm(!showAddForm)} disabled={staff.length >= FIRM_CAP} style={{ opacity: staff.length >= FIRM_CAP ? 0.5 : 1 }}>
          <UserPlus size={14} /> {staff.length >= FIRM_CAP ? 'تم بلوغ الحد' : 'إضافة عضو'}
        </Button>
      </div>

      {/* Capacity Warning */}
      {staff.length >= FIRM_CAP && (
        <div style={{ padding: '12px 16px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={16} color="var(--warning)" />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>وصلت للحد الأقصى من الأعضاء ({FIRM_CAP}). لحذف عضو موجود يمكن إضافة عضو جديد.</span>
        </div>
      )}

      {/* Add Staff Form */}
      {showAddForm && (
        <Card className="fade-up" style={{ padding: 20, border: '2px solid var(--gold)' }}>
          <h4 style={{ fontWeight: 800, color: 'var(--gold)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={16} /> إنشاء حساب موظف جديد
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="الاسم الكامل" value={addName} onChange={setAddName} placeholder="محمد أحمد" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>الصلاحية</label>
              <select value={addRole} onChange={(e) => setAddRole(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, background: '#fff', fontFamily: "'Cairo',sans-serif" }}>
                {STAFF_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                ))}
              </select>
            </div>
            <Field label="رقم الهاتف" value={addPhone} onChange={setAddPhone} type="tel" placeholder="+20 xxx xxx xxxx" />
            <Field label="البريد الإلكتروني" value={addEmail} onChange={setAddEmail} type="email" placeholder="staff@mohkam.com" />
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="كلمة المرور" value={addPassword} onChange={setAddPassword} type="password" placeholder="6 أحرف على الأقل" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="gold" fullWidth onClick={handleAddStaff} disabled={saving}>
              {saving ? <><Spinner /> جاري الإنشاء...</> : <><Save size={14} /> إنشاء الحساب</>}
            </Button>
            <Button variant="ghost" onClick={() => setShowAddForm(false)}>
              <X size={14} /> إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* Staff List with Permissions Matrix */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={24} /></div>
      ) : staff.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Users size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 14 }}>لا يوجد أعضاء في الفريق بعد</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>اضغط "إضافة عضو" لبدء بناء فريقك</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {staff.map((member) => {
            const isEditing = editingId === member.id;
            return (
              <Card key={member.id} className="fade-up" style={{ padding: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--navy)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {getRoleIcon(member.role)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.full_name}
                      </p>
                      <Badge color={member.role === 'partner' ? 'gold' : member.role === 'lawyer' ? 'navy' : 'default'}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {member.staff_email || member.phone_number || '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="secondary" onClick={() => isEditing ? savePerms(member.id) : startEditPerms(member)}>
                      {isEditing ? <><Save size={12} /> حفظ</> : <><Pencil size={12} /> صلاحيات</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveStaff(member.id, member.full_name)}>
                      <Trash2 size={12} color="var(--danger)" />
                    </Button>
                  </div>
                </div>

                {/* Permissions Matrix */}
                {isEditing ? (
                  <div style={{ background: '#F5F8FF', borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={14} /> مصفوفة الصلاحيات الدقيقة
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {PERMISSIONS.map((perm) => (
                        <div key={perm.key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', background: '#fff', borderRadius: 8,
                          border: editPerms[perm.key] ? '1.5px solid var(--navy)' : '1px solid var(--border)',
                          transition: 'border .15s',
                        }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{perm.label}</p>
                            <p style={{ fontSize: 10, color: 'var(--muted)' }}>{perm.description}</p>
                          </div>
                          <button
                            onClick={() => setEditPerms((p) => ({ ...p, [perm.key]: !p[perm.key] }))}
                            style={{
                              width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                              background: editPerms[perm.key] ? 'var(--navy)' : 'var(--border)',
                              transition: 'background .2s', position: 'relative', flexShrink: 0,
                            }}
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', background: '#fff',
                              position: 'absolute', top: 3, transition: 'right .2s',
                              right: editPerms[perm.key] ? 3 : 23,
                              boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                            }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} style={{ marginTop: 10 }}>
                      <X size={12} /> إلغاء التعديل
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {PERMISSIONS.map((perm) => (
                      <Badge key={perm.key} color={member[perm.key as keyof StaffMember] ? 'green' : 'default'}>
                        {member[perm.key as keyof StaffMember] ? <Check size={10} style={{ marginLeft: 3 }} /> : <Lock size={10} style={{ marginLeft: 3 }} />}
                        {perm.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
