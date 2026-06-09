import { supabase } from './supabase';
import type { Tier } from '../context/RoleContext';

export interface ChatQuota {
  maxImagesPerDay: number;
  maxFileSizeMB: number;
  isUnlimited: boolean;
}

export const TIER_CHAT_QUOTAS: Record<Tier, ChatQuota> = {
  free: { maxImagesPerDay: 10, maxFileSizeMB: 50, isUnlimited: false },
  premium: { maxImagesPerDay: 30, maxFileSizeMB: 100, isUnlimited: false },
  team: { maxImagesPerDay: Infinity, maxFileSizeMB: Infinity, isUnlimited: true },
};

export async function getDailyChatUploadCount(caseId: string, _lawyerId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('case_id', caseId)
    .not('attachment_url', 'is', null)
    .gte('created_at', today.toISOString());

  return data?.length || 0;
}

export function checkChatUploadQuota(
  tier: Tier,
  currentUploadCount: number,
  fileSizeMB: number,
): { allowed: boolean; reason?: string } {
  const quota = TIER_CHAT_QUOTAS[tier];

  if (quota.isUnlimited) return { allowed: true };

  if (currentUploadCount >= quota.maxImagesPerDay) {
    return {
      allowed: false,
      reason: `تم الوصول للحد اليومي (${quota.maxImagesPerDay} صورة/ملف). قم بالترقية لمزيد.`,
    };
  }

  if (fileSizeMB > quota.maxFileSizeMB) {
    return {
      allowed: false,
      reason: `حجم الملف يتجاوز الحد (${quota.maxFileSizeMB} ميجابايت).`,
    };
  }

  return { allowed: true };
}
