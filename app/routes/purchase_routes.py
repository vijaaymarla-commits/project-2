from flask import Blueprint, request, jsonify, g
from datetime import datetime, date
from app.database import db
from app.auth import require_role

purchase_bp = Blueprint('purchases', __name__, url_prefix='/api/v1/purchases')

@purchase_bp.route('', methods=['GET'])
@require_role('admin')
def get_purchases():
    purchases = db.get_purchases()
    return jsonify({'purchases': purchases})

@purchase_bp.route('', methods=['POST'])
@require_role('admin')
def create_purchase():
    data = request.get_json() or {}
    for req in ['supplier_id', 'items']:
        if not data.get(req):
            return jsonify({'error': f"Field '{req}' is required."}), 400

    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'Purchase order must have at least one product line.'}), 400

    total_amount = sum(float(i['quantity']) * float(i['unit_cost']) for i in items)
    paid_amount = float(data.get('paid_amount', 0.0))

    # Generate PO number
    po_no = f"PO-{datetime.now().strftime('%Y%m')}-{len(db.get_purchases()) + 1001:04d}"

    purchase_data = {
        'purchase_no': po_no,
        'supplier_id': data['supplier_id'],
        'invoice_ref': data.get('invoice_ref', ''),
        'total_amount': total_amount,
        'paid_amount': paid_amount,
        'status': data.get('status', 'RECEIVED'),
        'purchase_date': data.get('purchase_date', date.today().isoformat()),
        'notes': data.get('notes', ''),
        'created_by': g.current_user['id']
    }

    try:
        p_id = db.create_purchase(purchase_data, items)
        db.log_audit(g.current_user['id'], g.current_user['full_name'], 'CREATE_PURCHASE', 'purchases', p_id,
                     {'purchase_no': po_no, 'total_amount': total_amount}, request.remote_addr)

        return jsonify({'message': 'Purchase recorded and stock incremented successfully.', 'purchase_id': p_id, 'purchase_no': po_no}), 201
    except Exception as e:
        return jsonify({'error': f"Failed to record purchase: {str(e)}"}), 500
