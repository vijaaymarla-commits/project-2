-- ==========================================================
-- FRESH CUT MEAT SHOP MANAGEMENT SYSTEM - SEED DATA
-- Version: 1.1
-- ==========================================================

-- 1. PROFILES
INSERT INTO public.profiles (id, email, full_name, role, phone, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@freshcuts.com', 'Rajesh Sharma (Owner)', 'admin', '+91 98765 43210', TRUE),
('00000000-0000-0000-0000-000000000002', 'emp1@freshcuts.com', 'Imran Khan (Cashier)', 'employee', '+91 98765 11223', TRUE),
('00000000-0000-0000-0000-000000000003', 'emp2@freshcuts.com', 'Suresh Kumar (Butcher & Sales)', 'employee', '+91 98765 44556', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. PRODUCTS
INSERT INTO public.products (id, code, name, category, unit, selling_price, cost_price, min_stock, description, is_active) VALUES
('10000000-0000-0000-0000-000000000001', 'CHK-01', 'Chicken Curry Cut (Skinless)', 'Chicken', 'kg', 240.00, 180.00, 15.000, 'Fresh tender broiler chicken cut into medium curry pieces', TRUE),
('10000000-0000-0000-0000-000000000002', 'CHK-02', 'Chicken Breast Boneless', 'Chicken', 'kg', 360.00, 270.00, 10.000, 'Lean, skinless and boneless chicken breast fillets', TRUE),
('10000000-0000-0000-0000-000000000003', 'CHK-03', 'Chicken Drumsticks', 'Chicken', 'kg', 310.00, 230.00, 8.000, 'Juicy tender chicken leg pieces perfect for grilling or frying', TRUE),
('10000000-0000-0000-0000-000000000004', 'CHK-04', 'Chicken Mince (Keema)', 'Chicken', 'kg', 380.00, 280.00, 5.000, 'Finely minced chicken breast and thigh meat', TRUE),
('10000000-0000-0000-0000-000000000005', 'CHK-05', 'Chicken Liver & Gizzard', 'Chicken', 'kg', 160.00, 100.00, 4.000, 'Cleaned fresh chicken liver and gizzard', TRUE),
('10000000-0000-0000-0000-000000000006', 'MUT-01', 'Mutton Curry Cut (Goat)', 'Mutton', 'kg', 850.00, 680.00, 12.000, 'Tender bone-in goat meat cuts from shoulder and leg', TRUE),
('10000000-0000-0000-0000-000000000007', 'MUT-02', 'Mutton Biryani Cut', 'Mutton', 'kg', 900.00, 720.00, 10.000, 'Specially chosen succulent cuts of mutton for aromatic biryani', TRUE),
('10000000-0000-0000-0000-000000000008', 'MUT-03', 'Mutton Chops (Ribs)', 'Mutton', 'kg', 950.00, 750.00, 6.000, 'Tender rib chops with optimal marbling', TRUE),
('10000000-0000-0000-0000-000000000009', 'MUT-04', 'Mutton Keema (Minced Meat)', 'Mutton', 'kg', 920.00, 740.00, 5.000, 'Finely minced fresh goat meat without bones', TRUE),
('10000000-0000-0000-0000-000000000010', 'SEA-01', 'Fresh Silver Pomfret (Cleaned)', 'Seafood', 'kg', 980.00, 780.00, 6.000, 'Whole cleaned and gutted silver pomfret', TRUE),
('10000000-0000-0000-0000-000000000011', 'SEA-02', 'Tiger Prawns (Peeled & Deveined)', 'Seafood', 'kg', 820.00, 640.00, 5.000, 'Jumbo tiger prawns cleaned and ready to cook', TRUE),
('10000000-0000-0000-0000-000000000012', 'SEA-03', 'Surmai (King Fish Steaks)', 'Seafood', 'kg', 1100.00, 890.00, 4.000, 'Fresh cut round steaks of Kingfish', TRUE),
('10000000-0000-0000-0000-000000000013', 'BEF-01', 'Premium Beef Boneless', 'Beef', 'kg', 460.00, 350.00, 8.000, 'Freshly carved boneless prime beef cuts', TRUE),
('10000000-0000-0000-0000-000000000014', 'MAR-01', 'Tandoori Marinated Chicken (500g)', 'Cold Cuts & Marinades', 'pack', 220.00, 150.00, 10.000, 'Pre-marinated in curd, Kashmiri chili, and chef spices', TRUE),
('10000000-0000-0000-0000-000000000015', 'MAR-02', 'Smoked Chicken Sausages (400g)', 'Cold Cuts & Marinades', 'pack', 260.00, 180.00, 8.000, 'Ready-to-grill breakfast sausages', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. INVENTORY
INSERT INTO public.inventory (product_id, current_stock, reserved_stock) VALUES
('10000000-0000-0000-0000-000000000001', 48.500, 0.000),
('10000000-0000-0000-0000-000000000002', 22.400, 0.000),
('10000000-0000-0000-0000-000000000003', 14.200, 0.000),
('10000000-0000-0000-0000-000000000004', 3.500, 0.000),  -- LOW STOCK ALERT!
('10000000-0000-0000-0000-000000000005', 6.000, 0.000),
('10000000-0000-0000-0000-000000000006', 28.000, 0.000),
('10000000-0000-0000-0000-000000000007', 18.500, 0.000),
('10000000-0000-0000-0000-000000000008', 4.000, 0.000),  -- LOW STOCK ALERT!
('10000000-0000-0000-0000-000000000009', 7.500, 0.000),
('10000000-0000-0000-0000-000000000010', 8.000, 0.000),
('10000000-0000-0000-0000-000000000011', 2.800, 0.000),  -- LOW STOCK ALERT!
('10000000-0000-0000-0000-000000000012', 6.500, 0.000),
('10000000-0000-0000-0000-000000000013', 15.000, 0.000),
('10000000-0000-0000-0000-000000000014', 25.000, 0.000),
('10000000-0000-0000-0000-000000000015', 18.000, 0.000)
ON CONFLICT (product_id) DO UPDATE SET current_stock = EXCLUDED.current_stock;

-- 4. CUSTOMERS
INSERT INTO public.customers (id, name, phone, email, address, credit_limit, outstanding_balance, notes) VALUES
('20000000-0000-0000-0000-000000000001', 'Walk-in Retail Customer', '0000000000', 'walkin@freshcuts.com', 'Store Counter', 0.00, 0.00, 'Standard retail walk-in'),
('20000000-0000-0000-0000-000000000002', 'Chef Vikram (Spice Garden Restaurant)', '+91 98220 54321', 'spicegarden@mail.com', '12 MG Road, City Center', 25000.00, 4200.00, 'Regular weekly restaurant bulk buyer'),
('20000000-0000-0000-0000-000000000003', 'Anita Desai', '+91 97654 32198', 'anita.d@mail.com', 'Green Villa Apt 402', 5000.00, 0.00, 'Prefers boneless chicken and pomfret'),
('20000000-0000-0000-0000-000000000004', 'Mohammed Arif (Grand Catering)', '+91 99112 87654', 'grandcaterers@mail.com', 'Plot 88 Industrial Area', 40000.00, 8500.00, 'Catering orders for weekends')
ON CONFLICT (id) DO NOTHING;

-- 5. SUPPLIERS
INSERT INTO public.suppliers (id, name, contact_person, phone, email, address, category, outstanding_balance) VALUES
('30000000-0000-0000-0000-000000000001', 'Royal Agro Poultry Farms', 'Manish Patil', '+91 94231 11222', 'manish@royalagro.com', 'Farm 14, Nashik Highway', 'Chicken', 12500.00),
('30000000-0000-0000-0000-000000000002', 'Highland Livestock Breeders', 'Iqbal Qureshi', '+91 98230 33444', 'iqbal@highlandlivestock.com', 'Sector 4, Sangli Rural', 'Mutton', 28000.00),
('30000000-0000-0000-0000-000000000003', 'Coastal Fishermen Union', 'Devanand Koli', '+91 91234 55667', 'devanand@coastalfish.com', 'Dock 3, Sassoon Docks', 'Seafood', 6400.00),
('30000000-0000-0000-0000-000000000004', 'Apex Cold-Chain & Packaging', 'Ramesh Varma', '+91 98877 66554', 'apexpack@mail.com', 'MIDC Phase 2', 'Cold Cuts & Packaging', 3200.00)
ON CONFLICT (id) DO NOTHING;

-- 6. SETTINGS
INSERT INTO public.settings (key, value) VALUES
('shop_name', 'Fresh Cut Prime Meat Shop'),
('shop_tagline', 'Hygienic, Farm-Fresh & Tender Cuts Everyday'),
('shop_phone', '+91 98765 43210'),
('shop_email', 'contact@freshcuts.com'),
('shop_address', 'Shop #14, High Street Avenue, Near City Market'),
('gstin_tax_id', '27AAECF1234F1Z5'),
('currency_symbol', '₹'),
('default_tax_rate', '5.0'),
('receipt_footer_note', 'Thank you for choosing Fresh Cut! Store meat between 0°C to 4°C.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 7. EXPENSES
INSERT INTO public.expenses (category, title, amount, payment_method, expense_date, notes) VALUES
('Electricity', 'Walk-in Chiller & Deep Freezer Power Bill', 8500.00, 'UPI', CURRENT_DATE - INTERVAL '5 days', 'Commercial electricity bill for cold-storage compressor'),
('Rent', 'Store Premises Monthly Lease', 22000.00, 'Bank Transfer', CURRENT_DATE - INTERVAL '15 days', 'Main shop floor rent for the month'),
('Packaging Materials', 'Vacuum Seal Pouches & Biodegradable Carry Bags', 3400.00, 'Cash', CURRENT_DATE - INTERVAL '2 days', '1000 units of food-safe certified vacuum seal bags'),
('Refrigeration & Ice', 'Dry Ice & Chiller Gas Refill', 1850.00, 'UPI', CURRENT_DATE - INTERVAL '3 days', 'Chiller coolant maintenance check'),
('Cleaning & Sanitation', 'Hospital-Grade Sanitizers & Butcher Cleaver Sharpening', 1200.00, 'Cash', CURRENT_DATE - INTERVAL '1 day', 'Daily sanitization supplies & blade maintenance');
