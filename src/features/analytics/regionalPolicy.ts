export type AnalyticsPolicy = 'strict' | 'standard';
export type AnalyticsConsent = 'allow' | 'reject';

export const ANALYTICS_POLICY_COOKIE = 'jet_analytics_policy';
export const ANALYTICS_CONSENT_COOKIE = 'jet_analytics_consent';

const POLICY_COOKIE_MAX_AGE_SECONDS = 86_400;
const CONSENT_COOKIE_MAX_AGE_SECONDS = 15_552_000;

export const STRICT_ANALYTICS_COUNTRY_CODES = Object.freeze([
  'AT',
  'BE',
  'BG',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
] as const);

const RECOGNIZED_COUNTRY_CODES = new Set(
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
   BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
   CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
   DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
   GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
   HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
   KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
   MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
   NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
   QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
   TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
   VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`
    .split(/\s+/u)
    .filter(Boolean),
);

const STRICT_COUNTRY_CODE_SET = new Set<string>(STRICT_ANALYTICS_COUNTRY_CODES);

export function analyticsPolicyForCountry(
  countryCode: string | undefined,
): AnalyticsPolicy {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (
    normalizedCountryCode === undefined ||
    !/^[A-Z]{2}$/u.test(normalizedCountryCode) ||
    !RECOGNIZED_COUNTRY_CODES.has(normalizedCountryCode)
  ) {
    return 'strict';
  }

  return STRICT_COUNTRY_CODE_SET.has(normalizedCountryCode)
    ? 'strict'
    : 'standard';
}

export function serializeAnalyticsPolicyCookie(
  policy: AnalyticsPolicy,
): string {
  return serializeCookie(
    ANALYTICS_POLICY_COOKIE,
    policy,
    POLICY_COOKIE_MAX_AGE_SECONDS,
  );
}

export function serializeAnalyticsConsentCookie(
  consent: AnalyticsConsent,
): string {
  return serializeCookie(
    ANALYTICS_CONSENT_COOKIE,
    consent,
    CONSENT_COOKIE_MAX_AGE_SECONDS,
  );
}

export function clearAnalyticsConsentCookie(): string {
  return serializeCookie(ANALYTICS_CONSENT_COOKIE, '', 0);
}

export function readAnalyticsPolicy(
  cookieString: string,
): AnalyticsPolicy | undefined {
  const value = readCookie(cookieString, ANALYTICS_POLICY_COOKIE);
  return value === 'strict' || value === 'standard' ? value : undefined;
}

export function readAnalyticsConsent(
  cookieString: string,
): AnalyticsConsent | undefined {
  const value = readCookie(cookieString, ANALYTICS_CONSENT_COOKIE);
  return value === 'allow' || value === 'reject' ? value : undefined;
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; Secure; SameSite=Lax`;
}

function readCookie(cookieString: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const entry = cookieString
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));

  return entry?.slice(prefix.length);
}
