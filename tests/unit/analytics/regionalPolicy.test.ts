import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_POLICY_COOKIE,
  STRICT_ANALYTICS_COUNTRY_CODES,
  analyticsPolicyForCountry,
  readAnalyticsConsent,
  readAnalyticsPolicy,
  serializeAnalyticsConsentCookie,
  serializeAnalyticsPolicyCookie,
} from '../../../src/features/analytics/regionalPolicy';

describe('regional analytics policy', () => {
  it('maps the explicit EEA, UK, and Switzerland risk-policy table to strict', () => {
    expect(STRICT_ANALYTICS_COUNTRY_CODES).toEqual([
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
    ]);

    for (const countryCode of STRICT_ANALYTICS_COUNTRY_CODES) {
      expect(analyticsPolicyForCountry(countryCode)).toBe('strict');
      expect(analyticsPolicyForCountry(countryCode.toLowerCase())).toBe(
        'strict',
      );
    }
  });

  it.each(['US', 'PH', 'NZ', 'SG', 'JP'])(
    'maps recognized non-strict country %s to standard',
    (countryCode) => {
      expect(analyticsPolicyForCountry(countryCode)).toBe('standard');
      expect(analyticsPolicyForCountry(countryCode.toLowerCase())).toBe(
        'standard',
      );
    },
  );

  it.each([undefined, '', ' ', 'USA', '1A', 'ZZ', 'uk'])(
    'fails closed for missing, malformed, or unknown country %s',
    (countryCode) => {
      expect(analyticsPolicyForCountry(countryCode)).toBe('strict');
    },
  );
});

describe('analytics privacy cookies', () => {
  it('serializes only a short-lived coarse policy for the whole secure site', () => {
    expect(serializeAnalyticsPolicyCookie('strict')).toBe(
      `${ANALYTICS_POLICY_COOKIE}=strict; Max-Age=86400; Path=/; Secure; SameSite=Lax`,
    );
    expect(serializeAnalyticsPolicyCookie('standard')).toBe(
      `${ANALYTICS_POLICY_COOKIE}=standard; Max-Age=86400; Path=/; Secure; SameSite=Lax`,
    );
  });

  it('serializes only an explicit allow or reject preference', () => {
    expect(serializeAnalyticsConsentCookie('allow')).toBe(
      `${ANALYTICS_CONSENT_COOKIE}=allow; Max-Age=15552000; Path=/; Secure; SameSite=Lax`,
    );
    expect(serializeAnalyticsConsentCookie('reject')).toBe(
      `${ANALYTICS_CONSENT_COOKIE}=reject; Max-Age=15552000; Path=/; Secure; SameSite=Lax`,
    );
  });

  it('reads only exact supported values from a browser cookie string', () => {
    const cookies = [
      'unrelated=DE',
      `${ANALYTICS_POLICY_COOKIE}=standard`,
      `${ANALYTICS_CONSENT_COOKIE}=reject`,
    ].join('; ');

    expect(readAnalyticsPolicy(cookies)).toBe('standard');
    expect(readAnalyticsConsent(cookies)).toBe('reject');
    expect(
      readAnalyticsPolicy(`${ANALYTICS_POLICY_COOKIE}=country-DE`),
    ).toBeUndefined();
    expect(
      readAnalyticsConsent(`${ANALYTICS_CONSENT_COOKIE}=yes`),
    ).toBeUndefined();
  });
});
