import { describe, it, expect } from 'vitest';
import {
  STREAM_COLORS,
  STREAM_COLOR_KEYS,
  STREAM_ICON_CATEGORIES,
  ALL_STREAM_ICONS,
  ALL_PRO_STREAM_ICONS,
  ALL_ICONS_COMBINED,
  isValidStreamIcon,
  isProStreamIcon,
  isValidStreamColor,
  isValidStreamColorKey,
  resolveStreamColorKey,
  resolveStreamColorHex,
  filterStreamIcons,
  type StreamColorKey,
} from './streamIconCatalog';

// Mock theme stream palette for testing
const MOCK_PALETTE: Record<StreamColorKey, string> = {
  red: '#FF0000',
  orange: '#FF8800',
  amber: '#FFAA00',
  green: '#00FF00',
  emerald: '#00CC88',
  teal: '#00BBAA',
  blue: '#0000FF',
  indigo: '#4400FF',
  purple: '#8800FF',
  pink: '#FF00AA',
  gray: '#888888',
  brown: '#884400',
};

describe('streamIconCatalog', () => {
  describe('STREAM_COLORS', () => {
    it('has 12 colors', () => {
      expect(STREAM_COLORS).toHaveLength(12);
    });

    it('all colors have key and label', () => {
      for (const color of STREAM_COLORS) {
        expect(color.key).toBeTruthy();
        expect(color.label).toBeTruthy();
      }
    });

    it('has no duplicate keys', () => {
      const keys = STREAM_COLORS.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('keys match STREAM_COLOR_KEYS', () => {
      const keys = STREAM_COLORS.map((c) => c.key);
      expect(keys).toEqual([...STREAM_COLOR_KEYS]);
    });
  });

  describe('isValidStreamColorKey', () => {
    it('returns true for valid keys', () => {
      expect(isValidStreamColorKey('red')).toBe(true);
      expect(isValidStreamColorKey('blue')).toBe(true);
      expect(isValidStreamColorKey('brown')).toBe(true);
    });

    it('returns false for invalid keys', () => {
      expect(isValidStreamColorKey('nope')).toBe(false);
      expect(isValidStreamColorKey('#ef4444')).toBe(false);
      expect(isValidStreamColorKey('')).toBe(false);
    });
  });

  describe('resolveStreamColorKey', () => {
    it('returns key for valid keys', () => {
      expect(resolveStreamColorKey('red')).toBe('red');
      expect(resolveStreamColorKey('blue')).toBe('blue');
    });

    it('maps legacy hex to key', () => {
      expect(resolveStreamColorKey('#ef4444')).toBe('red');
      expect(resolveStreamColorKey('#3b82f6')).toBe('blue');
      expect(resolveStreamColorKey('#92400e')).toBe('brown');
    });

    it('is case-insensitive for hex', () => {
      expect(resolveStreamColorKey('#EF4444')).toBe('red');
      expect(resolveStreamColorKey('#3B82F6')).toBe('blue');
    });

    it('returns null for unrecognized values', () => {
      expect(resolveStreamColorKey('#000000')).toBeNull();
      expect(resolveStreamColorKey('nope')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(resolveStreamColorKey(null)).toBeNull();
      expect(resolveStreamColorKey(undefined)).toBeNull();
    });
  });

  describe('resolveStreamColorHex', () => {
    it('resolves key to themed hex', () => {
      expect(resolveStreamColorHex('red', MOCK_PALETTE)).toBe('#FF0000');
      expect(resolveStreamColorHex('blue', MOCK_PALETTE)).toBe('#0000FF');
    });

    it('resolves legacy hex to themed hex', () => {
      expect(resolveStreamColorHex('#ef4444', MOCK_PALETTE)).toBe('#FF0000');
      expect(resolveStreamColorHex('#3b82f6', MOCK_PALETTE)).toBe('#0000FF');
    });

    it('returns null for unrecognized values', () => {
      expect(resolveStreamColorHex('#000000', MOCK_PALETTE)).toBeNull();
      expect(resolveStreamColorHex('nope', MOCK_PALETTE)).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(resolveStreamColorHex(null, MOCK_PALETTE)).toBeNull();
      expect(resolveStreamColorHex(undefined, MOCK_PALETTE)).toBeNull();
    });
  });

  describe('isValidStreamColor (deprecated)', () => {
    it('returns true for valid keys', () => {
      expect(isValidStreamColor('red')).toBe(true);
      expect(isValidStreamColor('blue')).toBe(true);
    });

    it('returns true for legacy hex values', () => {
      expect(isValidStreamColor('#ef4444')).toBe(true);
      expect(isValidStreamColor('#3b82f6')).toBe(true);
    });

    it('returns false for unknown values', () => {
      expect(isValidStreamColor('#000000')).toBe(false);
      expect(isValidStreamColor('nope')).toBe(false);
    });
  });

  describe('STREAM_ICON_CATEGORIES', () => {
    it('has 13 categories', () => {
      expect(STREAM_ICON_CATEGORIES).toHaveLength(13);
    });

    it('all categories have label and icons', () => {
      for (const cat of STREAM_ICON_CATEGORIES) {
        expect(cat.label).toBeTruthy();
        expect(cat.icons.length).toBeGreaterThan(0);
      }
    });

    it('has no duplicate icon names across categories (free)', () => {
      const allNames = STREAM_ICON_CATEGORIES.flatMap((c) => c.icons);
      expect(new Set(allNames).size).toBe(allNames.length);
    });

    it('has no duplicate icon names across categories (pro)', () => {
      const allPro = STREAM_ICON_CATEGORIES.flatMap((c) => c.proIcons ?? []);
      expect(new Set(allPro).size).toBe(allPro.length);
    });

    it('has no overlap between free and pro icons', () => {
      const freeSet = new Set(ALL_STREAM_ICONS);
      for (const name of ALL_PRO_STREAM_ICONS) {
        expect(freeSet.has(name)).toBe(false);
      }
    });
  });

  describe('ALL_STREAM_ICONS', () => {
    it('is a flat array of all free icons', () => {
      const expected = STREAM_ICON_CATEGORIES.flatMap((c) => c.icons);
      expect(ALL_STREAM_ICONS).toEqual(expected);
    });

    it('has at least 85 free icons', () => {
      expect(ALL_STREAM_ICONS.length).toBeGreaterThanOrEqual(85);
    });
  });

  describe('ALL_PRO_STREAM_ICONS', () => {
    it('is a flat array of all pro icons', () => {
      const expected = STREAM_ICON_CATEGORIES.flatMap((c) => c.proIcons ?? []);
      expect(ALL_PRO_STREAM_ICONS).toEqual(expected);
    });

    it('has at least 130 pro icons', () => {
      expect(ALL_PRO_STREAM_ICONS.length).toBeGreaterThanOrEqual(130);
    });
  });

  describe('ALL_ICONS_COMBINED', () => {
    it('has correct total count', () => {
      expect(ALL_ICONS_COMBINED.length).toBe(ALL_STREAM_ICONS.length + ALL_PRO_STREAM_ICONS.length);
    });

    it('total is at least 220 icons', () => {
      expect(ALL_ICONS_COMBINED.length).toBeGreaterThanOrEqual(220);
    });
  });

  describe('isValidStreamIcon', () => {
    it('returns true for free icon names', () => {
      expect(isValidStreamIcon('BookOpen')).toBe(true);
      expect(isValidStreamIcon('Coffee')).toBe(true);
      expect(isValidStreamIcon('Heart')).toBe(true);
    });

    it('returns true for pro icon names', () => {
      expect(isValidStreamIcon('BookMarked')).toBe(true);
      expect(isValidStreamIcon('Clapperboard')).toBe(true);
      expect(isValidStreamIcon('Crown')).toBe(true);
    });

    it('returns false for invalid icon names', () => {
      expect(isValidStreamIcon('NotAnIcon')).toBe(false);
      expect(isValidStreamIcon('')).toBe(false);
    });
  });

  describe('isProStreamIcon', () => {
    it('returns true for pro-only icons', () => {
      expect(isProStreamIcon('BookMarked')).toBe(true);
      expect(isProStreamIcon('Crown')).toBe(true);
      expect(isProStreamIcon('Laptop')).toBe(true);
    });

    it('returns false for free icons', () => {
      expect(isProStreamIcon('BookOpen')).toBe(false);
      expect(isProStreamIcon('Coffee')).toBe(false);
      expect(isProStreamIcon('Heart')).toBe(false);
    });

    it('returns false for invalid icons', () => {
      expect(isProStreamIcon('NotAnIcon')).toBe(false);
    });

    it('pro icons are still valid stream icons (downgrade scenario)', () => {
      // A user who had pro and set a pro icon, then downgraded,
      // should still have a valid icon in the DB
      expect(isProStreamIcon('BookMarked')).toBe(true);
      expect(isValidStreamIcon('BookMarked')).toBe(true);
      expect(isProStreamIcon('Crown')).toBe(true);
      expect(isValidStreamIcon('Crown')).toBe(true);
    });
  });

  describe('filterStreamIcons', () => {
    it('returns all free icons for empty query', () => {
      expect(filterStreamIcons('')).toEqual([...ALL_STREAM_ICONS]);
      expect(filterStreamIcons('  ')).toEqual([...ALL_STREAM_ICONS]);
    });

    it('returns all icons (free+pro) for empty query when includePro=true', () => {
      expect(filterStreamIcons('', true)).toEqual([...ALL_ICONS_COMBINED]);
    });

    it('filters free icons by partial name match', () => {
      const results = filterStreamIcons('book');
      expect(results).toContain('BookOpen');
      expect(results).toContain('Bookmark');
      expect(results).not.toContain('Coffee');
      // Pro icons excluded by default
      expect(results).not.toContain('BookMarked');
    });

    it('includes pro icons in filter when includePro=true', () => {
      const results = filterStreamIcons('book', true);
      expect(results).toContain('BookOpen');
      expect(results).toContain('BookMarked');
      expect(results).toContain('BookCopy');
    });

    it('is case-insensitive', () => {
      const lower = filterStreamIcons('heart');
      const upper = filterStreamIcons('HEART');
      expect(lower).toEqual(upper);
      expect(lower).toContain('Heart');
    });

    it('returns empty array for no matches', () => {
      expect(filterStreamIcons('zzzzzzzzz')).toEqual([]);
    });
  });
});
