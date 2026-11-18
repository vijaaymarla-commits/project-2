from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/v1/inventory')

@inventory_bp.route('', methods=['GET'])
@require_auth
def get_inventory():
    items = db.get_inventory()
    if g.current_user['role'] == 'employee':
        for itm in items:
            itm.pop('cost_price', None)
    return jsonify({'inventory': items})

@inventory_bp.route('/adjust', methods=['POST'])
@require_role('admin')
def adjust_stock():
    data = request.get_json() or {}
    product_id = data.get('product_id')
    
    # Support both direct quantity_delta and action ('INCREMENT' / 'DECREMENT')
    action = data.get('action') # 'INCREMENT' or 'DECREMENT'
    quantity = data.get('quantity')
    
    if action and quantity is not None:
        qty = abs(float(quantity))
        quantity_delta = qty if action == 'INCREMENT' else -qty
        default_reason = f"Stock {action.title()} by Admin"
    else:
        quantity_delta = data.get('quantity_delta')
        default_reason = 'Stock adjustment'

    movement_type = data.get('movement_type', 'ADJUSTMENT')
    if movement_type not in ('PURCHASE', 'SALE', 'WASTAGE', 'DAMAGE', 'RETURN', 'ADJUSTMENT'):
        movement_type = 'ADJUSTMENT'

    reason = data.get('reason') or default_reason
    reference_id = data.get('reference_id', 'ADMIN-STOCK-ADJ')

    if not product_id or quantity_delta is None:
        return jsonify({'error': 'Product ID and quantity are required.'}), 400

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
                     {'action': action or ('INCREMENT' if float(quantity_delta) > 0 else 'DECREMENT'),
                      'delta': quantity_delta, 'new_balance': new_balance, 'reason': reason}, request.remote_addr)

        return jsonify({
            'message': f"Stock successfully {'increased' if float(quantity_delta) > 0 else 'decreased'} to {new_balance:.2f}.",
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
