from flask import Blueprint, request, jsonify, g
import uuid
from app.database import db
from app.auth import require_role

payment_bp = Blueprint('payments', __name__, url_prefix='/api/v1/payments')

@payment_bp.route('', methods=['GET'])
@require_role('admin')
def get_payments():
    payments = db.query("SELECT * FROM public.payments ORDER BY created_at DESC LIMIT 100")
    return jsonify({'payments': payments})

@payment_bp.route('', methods=['POST'])
@require_role('admin')
def record_payment():
    data = request.get_json() or {}
    for req in ['type', 'amount', 'payment_method']:
        if not data.get(req):
            return jsonify({'error': f"Field '{req}' is required."}), 400

    pay_type = data['type'] # CUSTOMER_RECEIPT or SUPPLIER_PAYMENT
    amount = float(data['amount'])
    ref_id = data.get('reference_id')

    pay_no = f"PAY-{uuid.uuid4().hex[:8].upper()}"
    p_id = str(uuid.uuid4())

    conn = db.get_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
        INSERT INTO public.payments (id, payment_no, type, reference_id, amount, payment_method, notes, created_by, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ''', (p_id, pay_no, pay_type, ref_id or None, amount, data['payment_method'], data.get('notes', ''), g.current_user['id']))

        if pay_type == 'CUSTOMER_RECEIPT' and ref_id:
            cur.execute("UPDATE public.customers SET outstanding_balance = GREATEST(0.0, outstanding_balance - %s) WHERE id = %s", (amount, ref_id))
        elif pay_type == 'SUPPLIER_PAYMENT' and ref_id:
            cur.execute("UPDATE public.suppliers SET outstanding_balance = GREATEST(0.0, outstanding_balance - %s) WHERE id = %s", (amount, ref_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'RECORD_PAYMENT', 'payments', p_id,
                 {'type': pay_type, 'amount': amount, 'reference_id': ref_id}, request.remote_addr)

    return jsonify({'message': 'Payment recorded successfully.', 'payment_no': pay_no}), 201
