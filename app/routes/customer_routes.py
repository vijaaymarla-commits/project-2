from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

customer_bp = Blueprint('customers', __name__, url_prefix='/api/v1/customers')

@customer_bp.route('', methods=['GET'])
@require_auth
def get_customers():
    customers = db.get_customers()
    return jsonify({'customers': customers})

@customer_bp.route('', methods=['POST'])
@require_auth
def save_customer():
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({'error': "Customer name is required."}), 400

    cid = db.save_customer(data)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'SAVE_CUSTOMER', 'customers', cid,
                 {'name': data['name'], 'phone': data.get('phone')}, request.remote_addr)

    return jsonify({'message': 'Customer saved successfully.', 'customer_id': cid}), 200

@customer_bp.route('/<customer_id>/sales', methods=['GET'])
@require_auth
def get_customer_sales(customer_id):
    sales = db.query("SELECT * FROM public.sales WHERE customer_id = %s ORDER BY created_at DESC", (customer_id,))
    return jsonify({'sales': sales})
