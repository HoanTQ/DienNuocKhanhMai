-- ============================================================
-- Migration: Triggers and Functions
-- Description: Database triggers cho:
-- 1. Stock updates khi bán hàng (sales_order_items)
-- 2. Stock updates + WAC recalculation khi nhập hàng (goods_receipt_items)
-- 3. Audit logging cho important operations
-- 4. Updated_at auto-update
-- ============================================================

-- ============================================================
-- HELPER: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_unit_conversions_updated_at
  BEFORE UPDATE ON unit_conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_transporters_updated_at
  BEFORE UPDATE ON transporters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_debt_records_updated_at
  BEFORE UPDATE ON debt_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_supplier_prices_updated_at
  BEFORE UPDATE ON supplier_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_goods_receipts_updated_at
  BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_supplier_debts_updated_at
  BEFORE UPDATE ON supplier_debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_defective_items_updated_at
  BEFORE UPDATE ON defective_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER 1: Decrease stock after sale (sales_order_items INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_sale_stock_decrease()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease product current_stock by sold quantity
  UPDATE products
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.product_id;

  -- Create stock movement record
  INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
  SELECT
    NEW.product_id,
    'sale',
    -NEW.quantity,
    NEW.unit,
    NEW.order_id,
    'sales_order',
    so.created_by
  FROM sales_orders so
  WHERE so.id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sale_stock_decrease
  AFTER INSERT ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_sale_stock_decrease();

-- ============================================================
-- TRIGGER 2: Increase stock + recalculate WAC after goods receipt
-- (goods_receipt_items INSERT when receipt is confirmed)
-- ============================================================
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
  -- Only process if the parent goods_receipt is confirmed
  SELECT gr.status, gr.supplier_id, gr.created_by
  INTO v_receipt_status, v_supplier_id, v_created_by
  FROM goods_receipts gr
  WHERE gr.id = NEW.goods_receipt_id;

  IF v_receipt_status = 'confirmed' THEN
    -- Get current stock and WAC
    SELECT current_stock, weighted_avg_cost
    INTO v_current_stock, v_current_wac
    FROM products
    WHERE id = NEW.product_id;

    -- Calculate new WAC: (current_stock * current_wac + new_qty * new_price) / (current_stock + new_qty)
    IF v_current_stock + NEW.quantity > 0 THEN
      v_new_wac := (v_current_stock * v_current_wac + NEW.quantity * NEW.unit_price) / (v_current_stock + NEW.quantity);
    ELSE
      v_new_wac := NEW.unit_price;
    END IF;

    -- Update product: increase stock, update WAC, update last_cost, update last_stocked_at
    UPDATE products
    SET
      current_stock = current_stock + NEW.quantity,
      weighted_avg_cost = v_new_wac,
      last_cost = NEW.unit_price,
      last_stocked_at = NOW()
    WHERE id = NEW.product_id;

    -- Create stock movement record
    INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
    VALUES (NEW.product_id, 'purchase', NEW.quantity, NEW.unit, NEW.goods_receipt_id, 'goods_receipt', v_created_by);

    -- Create price history record
    INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
    VALUES (NEW.product_id, v_supplier_id, NEW.unit_price, NEW.quantity, NEW.goods_receipt_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_receipt_stock_increase
  AFTER INSERT ON goods_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_stock_increase();

-- ============================================================
-- TRIGGER 2b: Handle goods_receipt status change to 'confirmed'
-- Process all items when receipt is confirmed after items are added
-- ============================================================
CREATE OR REPLACE FUNCTION handle_receipt_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_current_stock DECIMAL(15, 3);
  v_current_wac DECIMAL(15, 2);
  v_new_wac DECIMAL(15, 2);
BEGIN
  -- Only trigger when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Process each item in the receipt
    FOR v_item IN
      SELECT * FROM goods_receipt_items WHERE goods_receipt_id = NEW.id
    LOOP
      -- Get current stock and WAC
      SELECT current_stock, weighted_avg_cost
      INTO v_current_stock, v_current_wac
      FROM products
      WHERE id = v_item.product_id;

      -- Calculate new WAC
      IF v_current_stock + v_item.quantity > 0 THEN
        v_new_wac := (v_current_stock * v_current_wac + v_item.quantity * v_item.unit_price) / (v_current_stock + v_item.quantity);
      ELSE
        v_new_wac := v_item.unit_price;
      END IF;

      -- Update product
      UPDATE products
      SET
        current_stock = current_stock + v_item.quantity,
        weighted_avg_cost = v_new_wac,
        last_cost = v_item.unit_price,
        last_stocked_at = NOW()
      WHERE id = v_item.product_id;

      -- Create stock movement
      INSERT INTO stock_movements (product_id, movement_type, quantity, unit, reference_id, reference_type, created_by)
      VALUES (v_item.product_id, 'purchase', v_item.quantity, v_item.unit, NEW.id, 'goods_receipt', NEW.created_by);

      -- Create price history
      INSERT INTO price_history (product_id, supplier_id, unit_price, quantity, goods_receipt_id)
      VALUES (v_item.product_id, NEW.supplier_id, v_item.unit_price, v_item.quantity, NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_receipt_confirmation
  AFTER UPDATE ON goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_confirmation();

-- ============================================================
-- TRIGGER 3: Audit logging for important operations
-- ============================================================

-- 3a. Audit log for sales_orders
CREATE OR REPLACE FUNCTION audit_sales_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (NEW.created_by, 'create', 'sales_order', NEW.id, 
      jsonb_build_object('new', row_to_json(NEW)::jsonb));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), NEW.created_by), 'update', 'sales_order', NEW.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (COALESCE(auth.uid(), OLD.created_by), 'delete', 'sales_order', OLD.id,
      jsonb_build_object('old', row_to_json(OLD)::jsonb));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_sales_orders
  AFTER INSERT OR UPDATE OR DELETE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION audit_sales_orders();

-- 3b. Audit log for products (price changes, deletion)
CREATE OR REPLACE FUNCTION audit_products()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if important fields changed (price, stock adjustment)
    IF OLD.selling_price != NEW.selling_price 
       OR OLD.weighted_avg_cost != NEW.weighted_avg_cost
       OR OLD.is_active != NEW.is_active THEN
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
      VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'update', 'product', NEW.id,
        jsonb_build_object(
          'old', jsonb_build_object(
            'selling_price', OLD.selling_price,
            'weighted_avg_cost', OLD.weighted_avg_cost,
            'current_stock', OLD.current_stock,
            'is_active', OLD.is_active
          ),
          'new', jsonb_build_object(
            'selling_price', NEW.selling_price,
            'weighted_avg_cost', NEW.weighted_avg_cost,
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

CREATE TRIGGER trg_audit_products
  AFTER UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_products();

-- 3c. Audit log for stock adjustments (manual adjustments via stock_movements)
CREATE OR REPLACE FUNCTION audit_stock_adjustments()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'adjustment' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
    VALUES (NEW.created_by, 'update', 'stock_adjustment', NEW.product_id,
      jsonb_build_object(
        'movement_id', NEW.id,
        'quantity', NEW.quantity,
        'notes', NEW.notes
      ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_stock_adjustments
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION audit_stock_adjustments();

-- ============================================================
-- TRIGGER 4: Update customer stats after sale
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET
      total_purchased = total_purchased + NEW.total,
      purchase_count = purchase_count + 1
    WHERE id = NEW.customer_id;

    -- If credit sale, update customer debt
    IF NEW.is_credit = true THEN
      UPDATE customers
      SET current_debt = current_debt + NEW.total
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_customer_stats
  AFTER INSERT ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats_on_sale();

-- ============================================================
-- TRIGGER 5: Update debt record on payment
-- ============================================================
CREATE OR REPLACE FUNCTION update_debt_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_debt_remaining DECIMAL(15, 2);
  v_customer_id UUID;
BEGIN
  -- Update debt record
  UPDATE debt_records
  SET
    paid_amount = paid_amount + NEW.amount,
    remaining = remaining - NEW.amount,
    status = CASE
      WHEN remaining - NEW.amount <= 0 THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = NEW.debt_record_id
  RETURNING remaining, customer_id INTO v_debt_remaining, v_customer_id;

  -- Update customer current_debt
  UPDATE customers
  SET current_debt = current_debt - NEW.amount
  WHERE id = v_customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_debt_on_payment
  AFTER INSERT ON debt_payments
  FOR EACH ROW EXECUTE FUNCTION update_debt_on_payment();

-- ============================================================
-- TRIGGER 6: Update supplier debt on payment
-- ============================================================
CREATE OR REPLACE FUNCTION update_supplier_debt_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_debts
  SET
    paid_amount = paid_amount + NEW.amount,
    remaining = remaining - NEW.amount,
    status = CASE
      WHEN remaining - NEW.amount <= 0 THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = NEW.supplier_debt_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_supplier_debt_on_payment
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION update_supplier_debt_on_payment();
