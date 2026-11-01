-- ============================================================
-- Migration: Thêm SKU cho products + seed danh mục 2 cấp
-- Description:
--   1) Thêm cột `sku` (mã sản phẩm nghiệp vụ dạng AA001) + unique index.
--   2) Seed bảng `categories` 2 cấp phục vụ import sản phẩm:
--        Cấp 1 (Nhóm): parent_id = NULL, description = mã nhóm 1 ký tự.
--        Cấp 2 (Loại): parent_id = nhóm, description = mã ghép 2 ký tự (SKU prefix).
--   Cột `description` được dùng làm nơi lưu MÃ để tra cứu tên <-> mã khi import.
-- ============================================================

-- 1. SKU ------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique
  ON products (sku) WHERE sku IS NOT NULL;

-- 2. Seed categories -----------------------------------------
DO $$
DECLARE
  a_id uuid; b_id uuid; c_id uuid; d_id uuid; z_id uuid;
BEGIN
  -- Cấp 1: Nhóm
  INSERT INTO categories (name, parent_id, description)
  SELECT 'Đồ điện', NULL, 'A' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE description='A' AND parent_id IS NULL);
  INSERT INTO categories (name, parent_id, description)
  SELECT 'Đồ nước', NULL, 'B' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE description='B' AND parent_id IS NULL);
  INSERT INTO categories (name, parent_id, description)
  SELECT 'Nhớt - Dầu mỡ', NULL, 'C' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE description='C' AND parent_id IS NULL);
  INSERT INTO categories (name, parent_id, description)
  SELECT 'Xe rùa', NULL, 'D' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE description='D' AND parent_id IS NULL);
  INSERT INTO categories (name, parent_id, description)
  SELECT 'Đồ khác', NULL, 'Z' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE description='Z' AND parent_id IS NULL);

  SELECT id INTO a_id FROM categories WHERE description='A' AND parent_id IS NULL;
  SELECT id INTO b_id FROM categories WHERE description='B' AND parent_id IS NULL;
  SELECT id INTO c_id FROM categories WHERE description='C' AND parent_id IS NULL;
  SELECT id INTO d_id FROM categories WHERE description='D' AND parent_id IS NULL;
  SELECT id INTO z_id FROM categories WHERE description='Z' AND parent_id IS NULL;

  -- Cấp 2: Loại (description = mã ghép)
  INSERT INTO categories (name, parent_id, description)
  SELECT v.name, v.pid, v.code FROM (VALUES
    ('Dây điện', a_id, 'AA'),
    ('Atomat - CB', a_id, 'AB'),
    ('Ổ cắm - Phích cắm', a_id, 'AC'),
    ('Đèn LED', a_id, 'AD'),
    ('Tủ - Đế điện', a_id, 'AE'),
    ('Ống luồn - Nẹp', a_id, 'AF'),
    ('Điện - Khác', a_id, 'AZ'),
    ('Ống', b_id, 'BA'),
    ('Phụ kiện nối', b_id, 'BB'),
    ('Van', b_id, 'BC'),
    ('Vòi', b_id, 'BD'),
    ('Keo dán ống', b_id, 'BE'),
    ('Phao', b_id, 'BF'),
    ('Hố ga', b_id, 'BG'),
    ('Dây cấp', b_id, 'BH'),
    ('Nước - Khác', b_id, 'BZ'),
    ('Nhớt', c_id, 'CA'),
    ('Dầu', c_id, 'CB'),
    ('Mỡ', c_id, 'CC'),
    ('Xe rùa', d_id, 'DA'),
    ('Dụng cụ cầm tay', z_id, 'ZA'),
    ('Khóa', z_id, 'ZB'),
    ('Bơm - Phớt', z_id, 'ZC'),
    ('Linh tinh', z_id, 'ZZ')
  ) AS v(name, pid, code)
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.description = v.code AND c.parent_id IS NOT NULL
  );
END $$;
