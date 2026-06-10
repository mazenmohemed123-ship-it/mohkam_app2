export type CurrencyCode = 'EGP' | 'USD' | 'EUR' | 'AED' | 'MAD' | 'MRU';

export const CURRENCIES: { code: CurrencyCode; symbol: string; arLabel: string; enLabel: string; frLabel: string }[] = [
  { code: 'EGP', symbol: 'ج', arLabel: 'جنيه مصري', enLabel: 'Egyptian Pound', frLabel: 'Livre égyptienne' },
  { code: 'USD', symbol: '$', arLabel: 'دولار', enLabel: 'US Dollar', frLabel: 'Dollar américain' },
  { code: 'EUR', symbol: '€', arLabel: 'يورو', enLabel: 'Euro', frLabel: 'Euro' },
  { code: 'AED', symbol: 'د.إ', arLabel: 'درهم إماراتي', enLabel: 'UAE Dirham', frLabel: 'Dirham des EAU' },
  { code: 'MAD', symbol: 'د.م.', arLabel: 'درهم مغربي', enLabel: 'Moroccan Dirham', frLabel: 'Dirham marocain' },
  { code: 'MRU', symbol: 'أ.م.', arLabel: 'أوقية موريتانية', enLabel: 'Mauritanian Ouguiya', frLabel: 'Ouguiya mauritanienne' },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || 'ج';
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${amount.toLocaleString()} ${symbol}`;
}
