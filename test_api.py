import unittest
import json
from app import create_app
from app.database import db

class FreshCutsApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_01_admin_login(self):
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'admin@freshcuts.com',
            'password': 'admin123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'admin')

    def test_02_employee_login_and_restrictions(self):
        # 1. Login as employee
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'emp1@freshcuts.com',
            'password': 'emp123'
        })
        self.assertEqual(res.status_code, 200)
        token = res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        # 2. Try to access admin-only employee management -> MUST BE 403 Forbidden!
        res_users = self.client.get('/api/v1/auth/users', headers=headers)
        self.assertEqual(res_users.status_code, 403)

        # 3. Try to access admin-only P&L report -> MUST BE 403 Forbidden!
        res_pnl = self.client.get('/api/v1/reports/pnl', headers=headers)
        self.assertEqual(res_pnl.status_code, 403)

        # 4. View products as employee -> MUST NOT reveal cost_price!
        res_prods = self.client.get('/api/v1/products', headers=headers)
        self.assertEqual(res_prods.status_code, 200)
        prods = res_prods.get_json()['products']
        self.assertGreater(len(prods), 0)
        for p in prods:
            self.assertNotIn('cost_price', p)

    def test_03_pos_checkout_and_stock_deduction(self):
        # Login as employee
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'emp1@freshcuts.com',
            'password': 'emp123'
        })
        token = res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        # Pick a product
        prods_res = self.client.get('/api/v1/products', headers=headers)
        product = prods_res.get_json()['products'][0]
        pid = product['id']
        initial_stock = product['current_stock']

        # Checkout 1.5 units
        qty_to_buy = 1.0 if product['unit'] in ('pcs', 'pack') else 1.5
        cart = {
            'customer_id': None,
            'payment_method': 'UPI',
            'discount_amount': 0.0,
            'tax_rate': 5.0,
            'notes': 'Automated POS Test',
            'items': [
                {
                    'product_id': pid,
                    'quantity': qty_to_buy,
                    'unit_price': product['selling_price']
                }
            ]
        }

        checkout_res = self.client.post('/api/v1/pos/checkout', json=cart, headers=headers)
        self.assertEqual(checkout_res.status_code, 201)
        data = checkout_res.get_json()
        self.assertIn('sale', data)
        self.assertTrue(data['sale']['invoice_no'].startswith('INV-'))

        # Check stock deduction
        updated_prod = self.client.get(f'/api/v1/products/{pid}', headers=headers).get_json()['product']
        expected_stock = round(initial_stock - qty_to_buy, 3)
        self.assertAlmostEqual(updated_prod['current_stock'], expected_stock, places=2)

    def test_04_pnl_calculation(self):
        # Admin login
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'admin@freshcuts.com',
            'password': 'admin123'
        })
        token = res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        pnl_res = self.client.get('/api/v1/reports/pnl', headers=headers)
        self.assertEqual(pnl_res.status_code, 200)
        pnl = pnl_res.get_json()
        self.assertIn('gross_profit', pnl)
        self.assertIn('net_operating_result', pnl)
        # Gross profit = Net Revenue - COGS
        calc_gp = round(pnl['net_sales_revenue'] - pnl['cogs'], 2)
        self.assertEqual(pnl['gross_profit'], calc_gp)

    def test_05_public_registration(self):
        import uuid
        test_email = f"staff_{uuid.uuid4().hex[:6]}@freshcuts.com"
        res = self.client.post('/api/v1/auth/register', json={
            'full_name': 'Test Butcher Cashier',
            'email': test_email,
            'phone': '9876543210',
            'role': 'employee',
            'password': 'password123'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn('token', data)
        self.assertEqual(data['user']['email'], test_email)
        self.assertEqual(data['user']['role'], 'employee')

    def test_06_public_settings_and_shop_image(self):
        # Settings should be accessible publicly without authorization header
        res = self.client.get('/api/v1/settings')
        self.assertEqual(res.status_code, 200)
        settings = res.get_json().get('settings', {})
        self.assertIn('shop_name', settings)

    def test_07_no_beef_in_active_products(self):
        # Login
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'emp1@freshcuts.com',
            'password': 'emp123'
        })
        token = res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        res = self.client.get('/api/v1/products?active_only=true', headers=headers)
        self.assertEqual(res.status_code, 200)
        products = res.get_json().get('products', [])
        for p in products:
            self.assertNotEqual(p.get('category'), 'Beef')
            self.assertNotIn('beef', p.get('name', '').lower())

    def test_08_extra_charges_with_kg_breakdown(self):
        # Login
        res = self.client.post('/api/v1/auth/login', json={
            'email': 'emp1@freshcuts.com',
            'password': 'emp123'
        })
        token = res.get_json()['token']
        headers = {'Authorization': f'Bearer {token}'}

        prods_res = self.client.get('/api/v1/products', headers=headers)
        product = prods_res.get_json()['products'][0]

        cart = {
            'customer_id': None,
            'payment_method': 'Cash',
            'discount_amount': 0.0,
            'tax_rate': 0.0,  # GST optional / off
            'extra_charge_amount': 50.0,
            'extra_charge_label': 'Cutting & Slicing (2.50 kg @ ₹20/kg)',
            'notes': 'Test with extra charge per kg',
            'items': [
                {
                    'product_id': product['id'],
                    'quantity': 1.0,
                    'unit_price': product['selling_price']
                }
            ]
        }

        checkout_res = self.client.post('/api/v1/pos/checkout', json=cart, headers=headers)
        self.assertEqual(checkout_res.status_code, 201)
        sale = checkout_res.get_json()['sale']
        self.assertEqual(float(sale['extra_charge_amount']), 50.0)
        self.assertIn('Cutting & Slicing', sale['extra_charge_label'])
        expected_total = round(float(product['selling_price']) + 50.0, 2)
        self.assertEqual(float(sale['total_amount']), expected_total)

if __name__ == '__main__':
    unittest.main()
