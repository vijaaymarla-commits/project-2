import uuid
from datetime import datetime
from app.database import db

class POSService:
    @staticmethod
    def generate_invoice_no():
        prefix = datetime.now().strftime("INV-%Y%m-")
        # Fetch latest invoice with this prefix to increment
        rows = db.query("SELECT invoice_no FROM public.sales WHERE invoice_no LIKE %s ORDER BY created_at DESC LIMIT 1", (f"{prefix}%",))
        if rows:
            latest = rows[0]['invoice_no']
            try:
                seq = int(latest.replace(prefix, "")) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1001
        return f"{prefix}{seq:04d}"

    @classmethod
    def process_checkout(cls, cart_data, cashier):
        """
        cart_data format:
        {
            "customer_id": "...",
            "payment_method": "Cash|UPI|Card|Credit",
            "discount_amount": 0.0,
            "tax_rate": 5.0,  # percentage
            "notes": "...",
            "items": [
                {
                    "product_id": "...",
                    "quantity": 1.5,
                    "unit_price": 240.0
                }
            ]
        }
        """
        items_input = cart_data.get('items', [])
        if not items_input:
            raise ValueError("Cannot checkout with an empty cart.")

        # Load all products and current stock
        products_map = {p['id']: p for p in db.get_products(active_only=False)}

        subtotal = 0.0
        cost_total = 0.0
        sale_items = []

        for item in items_input:
            pid = item['product_id']
            if pid not in products_map:
                raise ValueError(f"Product ID '{pid}' does not exist.")
            
            p = products_map[pid]
            if not p.get('is_active'):
                raise ValueError(f"Product '{p['name']}' is deactivated and cannot be billed.")

            qty = float(item['quantity'])
            if qty <= 0:
                raise ValueError(f"Quantity for '{p['name']}' must be greater than zero.")

            # Validate unit rules (pieces/pack should be positive integers or reasonable decimals)
            if p['unit'] in ('pcs', 'pack') and not qty.is_integer():
                raise ValueError(f"Product '{p['name']}' is sold in {p['unit']}; quantity must be a whole number.")

            price = float(p['selling_price'])
            cost = float(p.get('cost_price', 0.0))
            line_total = round(qty * price, 2)
            line_cost = round(qty * cost, 2)

            subtotal += line_total
            cost_total += line_cost

            sale_items.append({
                'product_id': pid,
                'product_name': p['name'],
                'unit': p['unit'],
                'quantity': qty,
                'unit_price': price,
                'unit_cost': cost,
                'total_price': line_total
            })

        subtotal = round(subtotal, 2)
        discount = float(cart_data.get('discount_amount', 0.0))
        discount = max(0.0, min(discount, subtotal))

        discounted_subtotal = subtotal - discount

        # Optional GST — tax_rate=0 means GST is disabled for this bill
        tax_rate = float(cart_data.get('tax_rate', 0.0))
        tax_amount = round(discounted_subtotal * (tax_rate / 100.0), 2) if tax_rate > 0 else 0.0

        # Extra prescribed charge (e.g. delivery, cutting, packing fee)
        extra_charge_amount = round(max(0.0, float(cart_data.get('extra_charge_amount', 0.0))), 2)
        extra_charge_label = str(cart_data.get('extra_charge_label', 'Extra Charges')).strip() or 'Extra Charges'

        total_amount = round(discounted_subtotal + tax_amount + extra_charge_amount, 2)

        invoice_no = cls.generate_invoice_no()

        sale_data = {
            'id': str(uuid.uuid4()),
            'invoice_no': invoice_no,
            'customer_id': cart_data.get('customer_id') or None,
            'cashier_id': cashier['id'],
            'cashier_name': cashier['full_name'],
            'subtotal': subtotal,
            'discount_amount': discount,
            'tax_amount': tax_amount,
            'extra_charge_amount': extra_charge_amount,
            'extra_charge_label': extra_charge_label,
            'total_amount': total_amount,
            'cost_total': cost_total,
            'payment_method': cart_data.get('payment_method', 'Cash'),
            'payment_status': 'COMPLETED',
            'notes': cart_data.get('notes', '')
        }

        sale_id = db.create_sale_transaction(sale_data, sale_items)
        
        # Return full sale record
        return db.get_sale_details(sale_id)
