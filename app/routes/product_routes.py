from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

product_bp = Blueprint('products', __name__, url_prefix='/api/v1/products')

@product_bp.route('', methods=['GET'])
@require_auth
def list_products():
    category = request.args.get('category')
    active_param = request.args.get('active_only', 'true').lower() == 'true'
    
    # If employee, always only active products
    if g.current_user['role'] == 'employee':
        active_param = True

    products = db.get_products(category=category, active_only=active_param)
    
    # For employee role, hide cost_price to maintain margin confidentiality
    if g.current_user['role'] == 'employee':
        for p in products:
            p.pop('cost_price', None)

    return jsonify({'products': products})

@product_bp.route('/<product_id>', methods=['GET'])
@require_auth
def get_product(product_id):
    product = db.get_product(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404

    if g.current_user['role'] == 'employee':
        product.pop('cost_price', None)

    return jsonify({'product': product})

@product_bp.route('', methods=['POST'])
@require_role('admin')
def create_product():
    data = request.get_json() or {}
    for req in ['code', 'name', 'category', 'unit', 'selling_price', 'cost_price']:
        if req not in data:
            return jsonify({'error': f"Field '{req}' is required."}), 400

    pid = db.save_product(data)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'CREATE_PRODUCT', 'products', pid,
                 {'code': data['code'], 'name': data['name'], 'selling_price': data['selling_price']}, request.remote_addr)

    return jsonify({'message': 'Product created successfully.', 'product_id': pid}), 201

@product_bp.route('/<product_id>', methods=['PUT'])
@require_role('admin')
def update_product(product_id):
    existing = db.get_product(product_id)
    if not existing:
        return jsonify({'error': 'Product not found.'}), 404

    data = request.get_json() or {}
    data['id'] = product_id
    db.save_product(data)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'UPDATE_PRODUCT', 'products', product_id,
                 {'name': data.get('name'), 'selling_price': data.get('selling_price')}, request.remote_addr)

    return jsonify({'message': 'Product updated successfully.'})

@product_bp.route('/<product_id>', methods=['DELETE'])
@require_role('admin')
def delete_product(product_id):
    existing = db.get_product(product_id)
    if not existing:
        return jsonify({'error': 'Product not found.'}), 404

    db.delete_product(product_id)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'DEACTIVATE_PRODUCT', 'products', product_id,
                 {'name': existing['name']}, request.remote_addr)

    return jsonify({'message': 'Product deactivated successfully.'})
