-- ============================================================
-- Tách giá vốn (weighted_avg_cost, last_cost) khỏi bảng products
-- sang bảng product_costs riêng, chỉ owner truy cập được.
-- Staff sẽ KHÔNG thể đọc giá vốn dù query products kiểu gì.
-- ============================================================

-- 1. Tạo bảng product_costs (1-1 với products)
CREATE TABLE IF NOT EXISTS product_costs (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  weighted_avg_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  last_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Copy dữ liệu giá vốn hiện có từ products sang product_costs
INSERT INTO product_costs (product_id, weighted_avg_cost, last_cost)
SELECT id, weighted_avg_cost, last_cost
FROM products
ON CONFLICT (product_id) DO NOTHING;

-- 3. Bật RLS: chỉ owner có toàn quyền, staff KHÔNG có quyền nào
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_costs_owner_all" ON product_costs
  FOR ALL USING (get_user_role() = 'owner');

-- 4. Trigger auto-update updated_at
CREATE TRIGGER trg_product_costs_updated_at
  BEFORE UPDATE ON product_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Đảm bảo mọi product đều có dòng cost tương ứng khi tạo mới sau này
CREATE OR REPLACE FUNCTION ensure_product_cost_row()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_costs (product_id, weighted_avg_cost, last_cost)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ensure_product_cost_row
  AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION ensure_product_cost_row();
