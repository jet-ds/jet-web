interface CanonicalObject {
  [key: string]: CanonicalValue;
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | CanonicalObject;

export function normalizeCanonicalString(value: string): string {
  return value.replace(/\r\n?/g, '\n').normalize('NFC');
}

function canonicalValue(value: unknown, seen: Set<object>): CanonicalValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return normalizeCanonicalString(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON rejects non-finite numbers.');
    }
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Canonical JSON rejects invalid dates.');
    }
    return value.toISOString();
  }
  if (typeof value !== 'object') {
    throw new TypeError(`Canonical JSON rejects ${typeof value} values.`);
  }
  if (seen.has(value)) {
    throw new TypeError('Canonical JSON rejects cyclic values.');
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => canonicalValue(item, seen));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON accepts only plain objects.');
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key], seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new Set()));
}
