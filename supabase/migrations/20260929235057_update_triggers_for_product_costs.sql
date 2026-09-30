-- ============================================================
-- Cập nhật triggers để đọc/ghi giá vốn ở bảng product_costs
-- thay vì cột trên products (chuẩn bị drop cột).
-- ============================================================

-- 1. Trigger nhập hàng theo item: tính WAC dựa trên product_costs
CREATE OR REPLACE FUNCTION handle_receipt_stock_increase()
RETURNS TRIGGER AS $$
DECLARE
  v_current_stock DECIMAL(15, 3);
  v_current_wac DECIMAL(15, 2);
  v_new_wac DECIMAL(15, 2);
  v_receipt_status VARCHAR(10);
  v_supplier_id UUID;
  v_created_by UUID;
BEGIN
  SELECT gr.status, gr.supplier_id, gr.created_by
  INTO v_receipt_status, v_supplier_id, v_created_by
  FROM goods_receipts gr
  WHERE gr.id = NEW.goods_receipt_id;

  IF v_receipt_status = 'confirmed' THEN
    SELECT p.current_stock, COALESCE(pc.weighted_avg_cost, 0)
    INTO v_current_stock, v_current_wac
    FROM products p
    LEFT JOIN product_costs pc ON pc.product_id = p.id
    WHERE p.id = NEW.product_id;

    IF v_current_stock + NEW.quantity > 0 THEN
      v_new_wac := (v_current_stock * v_current_wac + NEW.quantity * NEW.unit_price) / (v_current_stock + NEW.quantity);
    ELSE
      v_new_wac := NEW.unit_price;
    END IF;

    UPDATE products
    SET current_stock = current_stock + NEW.quantity,
        last_stocked_at = NOW()
    WHERE id = NEW.product_id;

    INSERT INTO product_costs (product_id, weighted_avg_cost, last_cost)
    VALUES (NEW.product_id, v_new_wac, NEW.unit_price)
    ON CONFLICT (product_id) DO UPDATE
      SET weighted_avg_cost = EXCLUDED.weighted_avg_cost,
          last_cost = EXCLUDED.last_cost;

    INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
    VALUES (NEW.product_id, 'purchase', NEW.quantity, NEW.unit, NEW.goods_receipt_id, 'goods_receipt', v_created_by);

    INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
    VALUES (NEW.product_id, v_supplier_id, NEW.unit_price, NEW.quantity, NEW.goods_receipt_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger khi goods_receipt chuyển sang 'confirmed'
CREATE OR REPLACE FUNCTION handle_receipt_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_current_stock DECIMAL(15, 3);
  v_current_wac DECIMAL(15, 2);
  v_new_wac DECIMAL(15, 2);
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    FOR v_item IN
      SELECT * FROM goods_receipt_items WHERE goods_receipt_id = NEW.id
    LOOP
      SELECT p.current_stock, COALESCE(pc.weighted_avg_cost, 0)
      INTO v_current_stock, v_current_wac
      FROM products p
      LEFT JOIN product_costs pc ON pc.product_id = p.id
      WHERE p.id = v_item.product_id;

      IF v_current_stock + v_item.quantity > 0 THEN
        v_new_wac := (v_current_stock * v_current_wac + v_item.quantity * v_item.unit_price) / (v_current_stock + v_item.quantity);
      ELSE
        v_new_wac := v_item.unit_price;
      END IF;

      UPDATE products
      SET current_stock = current_stock + v_item.quantity,
          last_stocked_at = NOW()
      WHERE id = v_item.product_id;

      INSERT INTO product_costs (product_id, weighted_avg_cost, last_cost)
      VALUES (v_item.product_id, v_new_wac, v_item.unit_price)
      ON CONFLICT (product_id) DO UPDATE
        SET weighted_avg_cost = EXCLUDED.weighted_avg_cost,
            last_cost = EXCLUDED.last_cost;

      INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
      VALUES (v_item.product_id, 'purchase', v_item.quantity, v_item.unit, NEW.id, 'goods_receipt', NEW.created_by);

      INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
      VALUES (v_item.product_id, NEW.supplier_id, v_item.unit_price, v_item.quantity, NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. audit_products: bỏ tham chiếu weighted_avg_cost (cột sắp bị drop).
CREATE OR REPLACE FUNCTION audit_products()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.selling_price != NEW.selling_price
       OR OLD.is_active != NEW.is_active THEN
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
      VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', 'product', NEW.id,
        jsonb_build_object(
          'old', jsonb_build_object(
            'selling_price', OLD.selling_price,
            'current_stock', OLD.current_stock,
            'is_active', OLD.is_active
          ),
          'new', jsonb_build_object(
            'selling_price', NEW.selling_price,
            'current_stock', NEW.current_stock,
            'is_active', NEW.is_active
          )
        ));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'delete', 'product', OLD.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Audit riêng cho thay đổi giá vốn trên product_costs
CREATE OR REPLACE FUNCTION audit_product_costs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.weighted_avg_cost != NEW.weighted_avg_cost THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', 'product_cost', NEW.product_id,
      jsonb_build_object(
        'old', jsonb_build_object('weighted_avg_cost', OLD.weighted_avg_cost, 'last_cost', OLD.last_cost),
        'new', jsonb_build_object('weighted_avg_cost', NEW.weighted_avg_cost, 'last_cost', NEW.last_cost)
      ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_product_costs
  AFTER UPDATE ON product_costs
  FOR EACH ROW EXECUTE FUNCTION audit_product_costs();
