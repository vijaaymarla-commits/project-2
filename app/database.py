import os
import json
import uuid
from datetime import datetime, date
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import Config

class Database:
    def __init__(self):
        self.mode = 'supabase'
        self._test_connection()

    def _test_connection(self):
        try:
            conn = self.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT 1;")
            cur.close()
            conn.close()
            print(f"[Database] Successfully connected to live Supabase PostgreSQL at {Config.DB_HOST}")
        except Exception as e:
            print(f"[Database] Warning: Supabase PostgreSQL connection error: {e}")

    def get_connection(self):
        return psycopg2.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            dbname=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            connect_timeout=10
        )

    def _serialize(self, obj):
        if isinstance(obj, (Decimal, float)):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return obj

    def _clean_row(self, row):
        if not row:
            return None
        return {k: self._serialize(v) for k, v in dict(row).items()}

    def _clean_rows(self, rows):
        return [self._clean_row(r) for r in rows]

    def query(self, sql, params=(), one=False):
        conn = self.get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(sql, params)
            if one:
                row = cur.fetchone()
                return self._clean_row(row)
            rows = cur.fetchall()
            return self._clean_rows(rows)
        finally:
            cur.close()
            conn.close()

    def execute(self, sql, params=()):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            cur.execute(sql, params)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    # ==========================
    # PRODUCTS
    # ==========================
    def get_products(self, category=None, active_only=True):
        sql = '''
        SELECT p.*, COALESCE(i.current_stock, 0.0) as current_stock, COALESCE(i.reserved_stock, 0.0) as reserved_stock
        FROM public.products p
        LEFT JOIN public.inventory i ON p.id = i.product_id
        WHERE 1=1
        '''
        params = []
        if active_only:
            sql += ' AND p.is_active = TRUE'
        if category and category != 'All':
            sql += ' AND p.category = %s'
            params.append(category)
        sql += ' ORDER BY p.name ASC'
        return self.query(sql, params)

    def get_product(self, product_id):
        sql = '''
        SELECT p.*, COALESCE(i.current_stock, 0.0) as current_stock
        FROM public.products p
        LEFT JOIN public.inventory i ON p.id = i.product_id
        WHERE p.id = %s
        '''
        return self.query(sql, (product_id,), one=True)

    def save_product(self, data):
        p_id = data.get('id') or str(uuid.uuid4())
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            cur.execute('''
            INSERT INTO public.products (id, code, name, category, unit, selling_price, cost_price, min_stock, description, image_url, is_active, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code,
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                unit = EXCLUDED.unit,
                selling_price = EXCLUDED.selling_price,
                cost_price = EXCLUDED.cost_price,
                min_stock = EXCLUDED.min_stock,
                description = EXCLUDED.description,
                image_url = EXCLUDED.image_url,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            ''', (p_id, data['code'], data['name'], data['category'], data['unit'],
                  float(data['selling_price']), float(data['cost_price']),
                  float(data.get('min_stock', 5.0)), data.get('description', ''),
                  data.get('image_url', ''),
                  bool(data.get('is_active', True))))

            # Ensure inventory entry exists
            initial_stock = float(data.get('initial_stock', 0.0))
            cur.execute('''
            INSERT INTO public.inventory (id, product_id, current_stock, reserved_stock)
            VALUES (%s, %s, %s, 0.0)
            ON CONFLICT (product_id) DO NOTHING
            ''', (str(uuid.uuid4()), p_id, initial_stock))

            conn.commit()
            return p_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    def delete_product(self, product_id):
        # Soft delete / deactivate
        self.execute("UPDATE public.products SET is_active = FALSE, updated_at = NOW() WHERE id = %s", (product_id,))

    # ==========================
    # INVENTORY & WASTAGE
    # ==========================
    def get_inventory(self):
        sql = '''
        SELECT p.id as product_id, p.code, p.name, p.category, p.unit, p.selling_price, p.cost_price, p.min_stock,
               COALESCE(i.current_stock, 0.0) as current_stock,
               CASE WHEN COALESCE(i.current_stock, 0.0) <= p.min_stock THEN TRUE ELSE FALSE END as is_low_stock
        FROM public.products p
        LEFT JOIN public.inventory i ON p.id = i.product_id
        WHERE p.is_active = TRUE
        ORDER BY is_low_stock DESC, p.name ASC
        '''
        return self.query(sql)

    def adjust_stock(self, product_id, quantity_delta, movement_type, reference_id, reason, performed_by=None):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            cur.execute('SELECT current_stock FROM public.inventory WHERE product_id = %s FOR UPDATE', (product_id,))
            row = cur.fetchone()
            current = float(row[0]) if row else 0.0
            new_stock = max(0.0, current + float(quantity_delta))

            cur.execute('''
            UPDATE public.inventory SET current_stock = %s, updated_at = NOW() WHERE product_id = %s
            ''', (new_stock, product_id))

            mov_id = str(uuid.uuid4())
            cur.execute('''
            INSERT INTO public.stock_movements (id, product_id, quantity, movement_type, reference_id, reason, performed_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (mov_id, product_id, float(quantity_delta), movement_type, reference_id, reason, performed_by))

            conn.commit()
            return new_stock
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    def get_stock_movements(self, limit=100):
        sql = '''
        SELECT m.*, p.name as product_name, p.unit, p.code as product_code, prof.full_name as performed_by_name
        FROM public.stock_movements m
        JOIN public.products p ON m.product_id = p.id
        LEFT JOIN public.profiles prof ON m.performed_by = prof.id
        ORDER BY m.created_at DESC
        LIMIT %s
        '''
        return self.query(sql, (limit,))

    # ==========================
    # POS BILLING & SALES
    # ==========================
    def create_sale_transaction(self, sale_data, items):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            sale_id = sale_data.get('id') or str(uuid.uuid4())
            invoice_no = sale_data['invoice_no']

            # Insert sale record
            cur.execute('''
            INSERT INTO public.sales (id, invoice_no, customer_id, cashier_id, cashier_name, subtotal, discount_amount,
                                      tax_amount, total_amount, cost_total, payment_method, payment_status, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ''', (sale_id, invoice_no, sale_data.get('customer_id') or None, sale_data['cashier_id'], sale_data['cashier_name'],
                  float(sale_data['subtotal']), float(sale_data.get('discount_amount', 0.0)),
                  float(sale_data.get('tax_amount', 0.0)), float(sale_data['total_amount']),
                  float(sale_data.get('cost_total', 0.0)), sale_data['payment_method'],
                  sale_data.get('payment_status', 'COMPLETED'), sale_data.get('notes', '')))

            for item in items:
                item_id = str(uuid.uuid4())
                cur.execute('''
                INSERT INTO public.sale_items (id, sale_id, product_id, product_name, unit, quantity, unit_price, unit_cost, total_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (item_id, sale_id, item['product_id'], item['product_name'], item['unit'],
                      float(item['quantity']), float(item['unit_price']), float(item['unit_cost']), float(item['total_price'])))

                # Decrement inventory
                cur.execute('''
                UPDATE public.inventory SET current_stock = current_stock - %s, updated_at = NOW()
                WHERE product_id = %s
                ''', (float(item['quantity']), item['product_id']))

                # Record stock movement
                cur.execute('''
                INSERT INTO public.stock_movements (id, product_id, quantity, movement_type, reference_id, reason, performed_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (str(uuid.uuid4()), item['product_id'], -float(item['quantity']), 'SALE', invoice_no, f"POS Sale {invoice_no}", sale_data['cashier_id']))

            # Update customer balance if credit sale
            if sale_data['payment_method'] == 'Credit' and sale_data.get('customer_id'):
                cur.execute('''
                UPDATE public.customers SET outstanding_balance = outstanding_balance + %s WHERE id = %s
                ''', (float(sale_data['total_amount']), sale_data['customer_id']))

            # Audit log
            cur.execute('''
            INSERT INTO public.audit_logs (id, user_id, user_name, action, entity, entity_id, details, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ''', (str(uuid.uuid4()), sale_data['cashier_id'], sale_data['cashier_name'], 'CREATE_SALE', 'sales', sale_id,
                  json.dumps({'invoice_no': invoice_no, 'total': float(sale_data['total_amount']), 'items': len(items)}), '127.0.0.1'))

            conn.commit()
            return sale_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    def get_sales(self, limit=100, cashier_id=None, start_date=None, end_date=None):
        sql = '''
        SELECT s.*, c.name as customer_name, c.phone as customer_phone
        FROM public.sales s
        LEFT JOIN public.customers c ON s.customer_id = c.id
        WHERE 1=1
        '''
        params = []
        if cashier_id:
            sql += ' AND s.cashier_id = %s'
            params.append(cashier_id)
        if start_date:
            sql += ' AND DATE(s.created_at) >= %s'
            params.append(start_date)
        if end_date:
            sql += ' AND DATE(s.created_at) <= %s'
            params.append(end_date)
        sql += ' ORDER BY s.created_at DESC LIMIT %s'
        params.append(limit)
        return self.query(sql, params)

    def get_sale_details(self, sale_id):
        sale = self.query('''
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM public.sales s
        LEFT JOIN public.customers c ON s.customer_id = c.id
        WHERE s.id::text = %s OR s.invoice_no = %s
        ''', (str(sale_id), str(sale_id)), one=True)
        if not sale:
            return None
        items = self.query('SELECT * FROM public.sale_items WHERE sale_id = %s', (sale['id'],))
        sale['items'] = items
        return sale

    # ==========================
    # CUSTOMERS
    # ==========================
    def get_customers(self):
        return self.query('SELECT * FROM public.customers ORDER BY name ASC')

    def save_customer(self, data):
        c_id = data.get('id') or str(uuid.uuid4())
        sql = '''
        INSERT INTO public.customers (id, name, phone, email, address, credit_limit, outstanding_balance, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            address = EXCLUDED.address,
            credit_limit = EXCLUDED.credit_limit,
            outstanding_balance = EXCLUDED.outstanding_balance,
            notes = EXCLUDED.notes
        '''
        self.execute(sql, (c_id, data['name'], data.get('phone'), data.get('email'),
                           data.get('address'), float(data.get('credit_limit', 0.0)),
                           float(data.get('outstanding_balance', 0.0)), data.get('notes', '')))
        return c_id

    # ==========================
    # SUPPLIERS
    # ==========================
    def get_suppliers(self):
        return self.query('SELECT * FROM public.suppliers ORDER BY name ASC')

    def save_supplier(self, data):
        s_id = data.get('id') or str(uuid.uuid4())
        sql = '''
        INSERT INTO public.suppliers (id, name, contact_person, phone, email, address, category, outstanding_balance)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            contact_person = EXCLUDED.contact_person,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            address = EXCLUDED.address,
            category = EXCLUDED.category,
            outstanding_balance = EXCLUDED.outstanding_balance
        '''
        self.execute(sql, (s_id, data['name'], data.get('contact_person'), data['phone'],
                           data.get('email'), data.get('address'), data.get('category'),
                           float(data.get('outstanding_balance', 0.0))))
        return s_id

    # ==========================
    # PURCHASES
    # ==========================
    def create_purchase(self, purchase_data, items):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            p_id = purchase_data.get('id') or str(uuid.uuid4())
            purchase_no = purchase_data['purchase_no']

            cur.execute('''
            INSERT INTO public.purchases (id, purchase_no, supplier_id, invoice_ref, total_amount, paid_amount, status, purchase_date, notes, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (p_id, purchase_no, purchase_data['supplier_id'], purchase_data.get('invoice_ref', ''),
                  float(purchase_data['total_amount']), float(purchase_data.get('paid_amount', 0.0)),
                  purchase_data.get('status', 'RECEIVED'), purchase_data.get('purchase_date', date.today().isoformat()),
                  purchase_data.get('notes', ''), purchase_data.get('created_by') or None))

            for itm in items:
                cur.execute('''
                INSERT INTO public.purchase_items (id, purchase_id, product_id, quantity, unit_cost, total_cost)
                VALUES (%s, %s, %s, %s, %s, %s)
                ''', (str(uuid.uuid4()), p_id, itm['product_id'], float(itm['quantity']), float(itm['unit_cost']), float(itm['total_cost'])))

                # Increment stock if status is RECEIVED
                if purchase_data.get('status', 'RECEIVED') == 'RECEIVED':
                    cur.execute('''
                    UPDATE public.inventory SET current_stock = current_stock + %s, updated_at = NOW()
                    WHERE product_id = %s
                    ''', (float(itm['quantity']), itm['product_id']))

                    # Movement record
                    cur.execute('''
                    INSERT INTO public.stock_movements (id, product_id, quantity, movement_type, reference_id, reason, performed_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ''', (str(uuid.uuid4()), itm['product_id'], float(itm['quantity']), 'PURCHASE', purchase_no, f"Inbound PO {purchase_no}", purchase_data.get('created_by') or None))

            # Outstanding balance
            unpaid = float(purchase_data['total_amount']) - float(purchase_data.get('paid_amount', 0.0))
            if unpaid > 0:
                cur.execute('''
                UPDATE public.suppliers SET outstanding_balance = outstanding_balance + %s WHERE id = %s
                ''', (unpaid, purchase_data['supplier_id']))

            conn.commit()
            return p_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    def get_purchases(self):
        sql = '''
        SELECT p.*, s.name as supplier_name, s.phone as supplier_phone
        FROM public.purchases p
        JOIN public.suppliers s ON p.supplier_id = s.id
        ORDER BY p.purchase_date DESC, p.created_at DESC
        '''
        purchases = self.query(sql)
        for p in purchases:
            p['items'] = self.query('''
            SELECT pi.*, pr.name as product_name, pr.unit
            FROM public.purchase_items pi
            JOIN public.products pr ON pi.product_id = pr.id
            WHERE pi.purchase_id = %s
            ''', (p['id'],))
        return purchases

    # ==========================
    # EXPENSES
    # ==========================
    def get_expenses(self, start_date=None, end_date=None, category=None):
        sql = 'SELECT * FROM public.expenses WHERE 1=1'
        params = []
        if start_date:
            sql += ' AND expense_date >= %s'
            params.append(start_date)
        if end_date:
            sql += ' AND expense_date <= %s'
            params.append(end_date)
        if category and category != 'All':
            sql += ' AND category = %s'
            params.append(category)
        sql += ' ORDER BY expense_date DESC, created_at DESC'
        return self.query(sql, params)

    def save_expense(self, data):
        e_id = data.get('id') or str(uuid.uuid4())
        sql = '''
        INSERT INTO public.expenses (id, category, title, amount, payment_method, expense_date, receipt_url, notes, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        self.execute(sql, (e_id, data['category'], data['title'], float(data['amount']),
                           data['payment_method'], data.get('expense_date', date.today().isoformat()),
                           data.get('receipt_url'), data.get('notes'), data.get('created_by') or None))
        return e_id

    # ==========================
    # SETTINGS
    # ==========================
    def get_settings(self):
        rows = self.query('SELECT key, value FROM public.settings')
        return {r['key']: r['value'] for r in rows}

    def save_setting(self, key, value):
        sql = '''
        INSERT INTO public.settings (id, key, value, updated_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        '''
        self.execute(sql, (str(uuid.uuid4()), key, str(value)))

    # ==========================
    # PROFILES / USERS
    # ==========================
    def get_user_by_email(self, email):
        return self.query('SELECT * FROM public.profiles WHERE email = %s', (email,), one=True)

    def get_user_by_id(self, user_id):
        return self.query('SELECT * FROM public.profiles WHERE id::text = %s', (str(user_id),), one=True)

    def get_users(self):
        return self.query('SELECT id, email, full_name, role, phone, is_active, created_at FROM public.profiles ORDER BY full_name ASC')

    def save_user(self, data):
        u_id = data.get('id') or str(uuid.uuid4())
        import hashlib
        pwd_hash = hashlib.sha256(data['password'].encode()).hexdigest() if data.get('password') else None

        if pwd_hash:
            sql = '''
            INSERT INTO public.profiles (id, email, full_name, role, phone, is_active, password_hash, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                phone = EXCLUDED.phone,
                is_active = EXCLUDED.is_active,
                password_hash = EXCLUDED.password_hash,
                updated_at = NOW()
            '''
            self.execute(sql, (u_id, data['email'], data['full_name'], data['role'], data.get('phone', ''),
                               bool(data.get('is_active', True)), pwd_hash))
        else:
            sql = '''
            INSERT INTO public.profiles (id, email, full_name, role, phone, is_active, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                phone = EXCLUDED.phone,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            '''
            self.execute(sql, (u_id, data['email'], data['full_name'], data['role'], data.get('phone', ''),
                               bool(data.get('is_active', True))))
        return u_id

    # ==========================
    # AUDIT LOGS
    # ==========================
    def log_audit(self, user_id, user_name, action, entity, entity_id, details=None, ip_address='127.0.0.1'):
        sql = '''
        INSERT INTO public.audit_logs (id, user_id, user_name, action, entity, entity_id, details, ip_address, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        '''
        det_str = json.dumps(details) if isinstance(details, (dict, list)) else (details or '')
        try:
            self.execute(sql, (str(uuid.uuid4()), user_id or None, user_name, action, entity, str(entity_id), det_str, ip_address))
        except Exception as e:
            print(f"[Audit Log Error] {e}")

    def get_audit_logs(self, limit=100):
        return self.query('SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT %s', (limit,))

db = Database()
