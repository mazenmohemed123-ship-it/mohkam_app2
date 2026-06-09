import type { Tier } from '../context/RoleContext';

export const TIER_CASE_LIMITS: Record<Tier, number> = {
  free: 5,
  premium: 15,
  team: Infinity,
};

export function isCaseCreationBlocked(tier: Tier, currentCaseCount: number): boolean {
  const limit = TIER_CASE_LIMITS[tier];
  if (limit === Infinity) return false;
  return currentCaseCount >= limit;
}

export function getCaseLimitLabel(tier: Tier, lang: 'ar' | 'en' = 'ar'): string {
  const limit = TIER_CASE_LIMITS[tier];
  if (limit === Infinity) return lang === 'ar' ? 'غير محدود' : 'Unlimited';
  return String(limit);
}
