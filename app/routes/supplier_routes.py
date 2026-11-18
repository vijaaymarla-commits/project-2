from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_role

supplier_bp = Blueprint('suppliers', __name__, url_prefix='/api/v1/suppliers')

@supplier_bp.route('', methods=['GET'])
@require_role('admin')
def get_suppliers():
    suppliers = db.get_suppliers()
    return jsonify({'suppliers': suppliers})

@supplier_bp.route('', methods=['POST'])
@require_role('admin')
def save_supplier():
    data = request.get_json() or {}
    for req in ['name', 'phone']:
        if not data.get(req):
            return jsonify({'error': f"Field '{req}' is required."}), 400

    sid = db.save_supplier(data)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'SAVE_SUPPLIER', 'suppliers', sid,
                 {'name': data['name'], 'phone': data['phone']}, request.remote_addr)

    return jsonify({'message': 'Supplier saved successfully.', 'supplier_id': sid}), 200
