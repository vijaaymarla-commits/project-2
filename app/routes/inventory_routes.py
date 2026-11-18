from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/v1/inventory')

@inventory_bp.route('', methods=['GET'])
@require_auth
def get_inventory():
    items = db.get_inventory()
    # If employee, hide cost price
    if g.current_user['role'] == 'employee':
        for itm in items:
            itm.pop('cost_price', None)
    return jsonify({'inventory': items})

@inventory_bp.route('/adjust', methods=['POST'])
@require_role('admin')
def adjust_stock():
    data = request.get_json() or {}
    product_id = data.get('product_id')
    quantity_delta = data.get('quantity_delta')
    movement_type = data.get('movement_type', 'WASTAGE')
    reason = data.get('reason', 'Stock adjustment')
    reference_id = data.get('reference_id', 'MANUAL-ADJ')

    if not product_id or quantity_delta is None:
        return jsonify({'error': 'Product ID and quantity delta are required.'}), 400

    if movement_type not in ('WASTAGE', 'DAMAGE', 'RETURN', 'ADJUSTMENT', 'PURCHASE'):
        return jsonify({'error': 'Invalid movement type.'}), 400

    try:
        new_balance = db.adjust_stock(
            product_id=product_id,
            quantity_delta=float(quantity_delta),
            movement_type=movement_type,
            reference_id=reference_id,
            reason=reason,
            performed_by=g.current_user['id']
        )
        db.log_audit(g.current_user['id'], g.current_user['full_name'], 'STOCK_ADJUSTMENT', 'inventory', product_id,
                     {'movement_type': movement_type, 'delta': quantity_delta, 'reason': reason}, request.remote_addr)

        return jsonify({
            'message': 'Stock adjusted successfully.',
            'product_id': product_id,
            'new_stock': new_balance
        })
    except Exception as e:
        return jsonify({'error': f"Failed to adjust stock: {str(e)}"}), 500

@inventory_bp.route('/movements', methods=['GET'])
@require_role('admin')
def get_movements():
    limit = int(request.args.get('limit', 100))
    movements = db.get_stock_movements(limit=limit)
    return jsonify({'movements': movements})
