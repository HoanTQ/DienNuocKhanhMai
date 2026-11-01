import { describe, it, expect } from 'vitest';
import {
  stripAccents,
  cleanText,
  extractCode,
  normalizePrice,
  normalizeQty,
  canonUnit,
  SkuGenerator,
  maxSeqByPrefix,
  parseRow,
  isEmptyRow,
  buildConversions,
  type RawRow,
} from './product-import.service';

const VALID_CODES = new Set(['AA', 'AB', 'BA', 'BB', 'CA', 'ZZ']);

function makeRaw(over: Partial<RawRow> = {}): RawRow {
  return {
    rowNumber: 2,
    nhom: 'A - Đồ điện',
    loai: 'AA - Dây điện',
    ten_san_pham: 'DÂY CV CADIVI 2.5',
    thuong_hieu: 'Cadivi',
    quy_cach: '2.5mm',
    dvt_co_ban: 'Cuộn',
    gia_nhap: 300000,
    gia_ban_le: 350000,
    gia_tho_thau: '',
    so_luong: 10,
    nha_cung_cap: 'Điện - Sinh Thu',
    hinh_anh: '',
    dvt_qd1: '',
    ty_le_qd1: '',
    gia_ban_qd1: '',
    dvt_qd2: '',
    ty_le_qd2: '',
    gia_ban_qd2: '',
    ...over,
  };
}

describe('product-import.service', () => {
  describe('stripAccents', () => {
    it('removes Vietnamese diacritics and đ', () => {
      expect(stripAccents('Đồ điện nước')).toBe('Do dien nuoc');
    });
  });

  describe('cleanText', () => {
    it('collapses whitespace and trims', () => {
      expect(cleanText('  a\n b   c ')).toBe('a b c');
    });
    it('handles null/undefined', () => {
      expect(cleanText(null)).toBe('');
      expect(cleanText(undefined)).toBe('');
    });
  });

  describe('extractCode', () => {
    it('extracts code before " - "', () => {
      expect(extractCode('A - Đồ điện')).toBe('A');
      expect(extractCode('AA - Dây điện')).toBe('AA');
    });
    it('returns whole string uppercased when no separator', () => {
      expect(extractCode('bb')).toBe('BB');
    });
  });

  describe('normalizePrice', () => {
    it('multiplies values below 1000 by 1000 (nghìn đồng)', () => {
      expect(normalizePrice(140)).toBe(140000);
      expect(normalizePrice(55)).toBe(55000);
    });
    it('keeps values >= 1000 as-is', () => {
      expect(normalizePrice(550000)).toBe(550000);
      expect(normalizePrice(1000)).toBe(1000);
    });
    it('returns null for empty/zero/negative/non-number', () => {
      expect(normalizePrice('')).toBeNull();
      expect(normalizePrice(0)).toBeNull();
      expect(normalizePrice(-5)).toBeNull();
      expect(normalizePrice('abc')).toBeNull();
    });
    it('parses numeric strings', () => {
      expect(normalizePrice('140')).toBe(140000);
      expect(normalizePrice('550000')).toBe(550000);
    });
  });

  describe('normalizeQty', () => {
    it('rounds to integer >= 0', () => {
      expect(normalizeQty(10)).toBe(10);
      expect(normalizeQty('20')).toBe(20);
      expect(normalizeQty(-3)).toBe(0);
      expect(normalizeQty('')).toBe(0);
    });
  });

  describe('canonUnit', () => {
    it('normalizes known units regardless of case (accent preserved)', () => {
      expect(canonUnit('cái')).toBe('Cái');
      expect(canonUnit('CÁI')).toBe('Cái');
      expect(canonUnit('m')).toBe('Mét');
    });
    it('does not merge different units that share an accent-stripped form', () => {
      expect(canonUnit('bó')).toBe('Bó');
      expect(canonUnit('bộ')).toBe('Bộ');
    });
    it('keeps unknown units unchanged', () => {
      expect(canonUnit('Thùng')).toBe('Thùng');
    });
  });

  describe('SkuGenerator', () => {
    it('generates sequential 3-digit SKUs per prefix', () => {
      const g = new SkuGenerator();
      expect(g.next('AA')).toBe('AA001');
      expect(g.next('AA')).toBe('AA002');
      expect(g.next('BB')).toBe('BB001');
    });
    it('continues from existing max per prefix', () => {
      const g = new SkuGenerator({ AA: 5, BB: 12 });
      expect(g.next('AA')).toBe('AA006');
      expect(g.next('BB')).toBe('BB013');
      expect(g.next('CC')).toBe('CC001');
    });
    it('expands beyond 999', () => {
      const g = new SkuGenerator({ AA: 999 });
      expect(g.next('AA')).toBe('AA1000');
    });
  });

  describe('maxSeqByPrefix', () => {
    it('computes max sequence per prefix, ignoring invalid', () => {
      const r = maxSeqByPrefix(['AA001', 'AA005', 'BB002', null, 'xx', 'ABC']);
      expect(r).toEqual({ AA: 5, BB: 2 });
    });
  });

  describe('isEmptyRow', () => {
    it('detects a fully empty row', () => {
      expect(
        isEmptyRow(makeRaw({ nhom: '', loai: '', ten_san_pham: '', thuong_hieu: '', quy_cach: '' }))
      ).toBe(true);
    });
    it('non-empty when name present', () => {
      expect(isEmptyRow(makeRaw())).toBe(false);
    });
  });

  describe('parseRow', () => {
    it('parses a valid row', () => {
      const res = parseRow(makeRaw(), VALID_CODES);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.ma_nhom).toBe('A');
        expect(res.data.ma_loai).toBe('AA');
        expect(res.data.gia_ban_le).toBe(350000);
        expect(res.data.dvt_co_ban).toBe('Cuộn');
      }
    });

    it('fails when required field missing (giá bán lẻ)', () => {
      const res = parseRow(makeRaw({ gia_ban_le: '' }), VALID_CODES);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.join(' ')).toContain('Giá bán lẻ');
      }
    });

    it('fails when brand missing', () => {
      const res = parseRow(makeRaw({ thuong_hieu: '' }), VALID_CODES);
      expect(res.ok).toBe(false);
    });

    it('fails when loai not in catalog', () => {
      const res = parseRow(makeRaw({ nhom: 'A - Đồ điện', loai: 'AX - Không có' }), VALID_CODES);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errors.join(' ')).toContain('danh mục');
    });

    it('fails when loai does not belong to nhom', () => {
      // BB thuộc nhóm B nhưng nhóm chọn là A
      const res = parseRow(makeRaw({ nhom: 'A - Đồ điện', loai: 'BB - Phụ kiện nối' }), VALID_CODES);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errors.join(' ')).toContain('không thuộc Nhóm');
    });

    it('normalizes nghìn-đồng price in a row', () => {
      const res = parseRow(makeRaw({ gia_ban_le: 140, loai: 'CA - Nhớt', nhom: 'C - Nhớt' }), VALID_CODES);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.gia_ban_le).toBe(140000);
    });

    it('normalizes giá thợ/thầu (trade price)', () => {
      const res = parseRow(makeRaw({ gia_tho_thau: 320 }), VALID_CODES);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.gia_tho_thau).toBe(320000);
    });

    it('parses unit conversions (1 cây = 4 mét)', () => {
      const res = parseRow(
        makeRaw({ dvt_co_ban: 'Mét', dvt_qd1: 'Cây', ty_le_qd1: 4, gia_ban_qd1: 58000 }),
        VALID_CODES
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.unit_conversions).toHaveLength(1);
        expect(res.data.unit_conversions![0]).toMatchObject({
          ten_dvt: 'Cây',
          ty_le: 4,
          gia_ban: 58000,
        });
      }
    });

    it('fails when conversion rate <= 0', () => {
      const res = parseRow(makeRaw({ dvt_qd1: 'Cây', ty_le_qd1: 0 }), VALID_CODES);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errors.join(' ')).toContain('Tỷ lệ');
    });

    it('fails when conversion unit duplicates base unit', () => {
      const res = parseRow(
        makeRaw({ dvt_co_ban: 'Mét', dvt_qd1: 'mét', ty_le_qd1: 2 }),
        VALID_CODES
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.errors.join(' ')).toContain('trùng');
    });

    it('ignores empty conversion pairs', () => {
      const res = parseRow(makeRaw(), VALID_CODES);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.unit_conversions).toHaveLength(0);
    });
  });

  describe('buildConversions', () => {
    it('builds two conversions when both pairs present', () => {
      const raw = makeRaw({
        dvt_qd1: 'Cây', ty_le_qd1: 4, gia_ban_qd1: 58000,
        dvt_qd2: 'Bó', ty_le_qd2: 20, gia_ban_qd2: '',
      });
      const conv = buildConversions(raw);
      expect(conv).toHaveLength(2);
      expect(conv[1]).toMatchObject({ ten_dvt: 'Bó', ty_le: 20 });
      expect(conv[1].gia_ban).toBeUndefined();
    });
    it('skips fully empty pairs', () => {
      expect(buildConversions(makeRaw())).toHaveLength(0);
    });
  });
});
