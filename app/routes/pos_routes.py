from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth
from app.services.pos_service import POSService

pos_bp = Blueprint('pos', __name__, url_prefix='/api/v1/pos')

@pos_bp.route('/checkout', methods=['POST'])
@require_auth
def checkout():
    data = request.get_json() or {}
    cashier = g.current_user
    try:
        sale = POSService.process_checkout(data, cashier)
        settings = db.get_settings()
        return jsonify({
            'message': 'Bill completed successfully.',
            'sale': sale,
            'settings': settings
        }), 201
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': f"Failed to process checkout: {str(e)}"}), 500

@pos_bp.route('/receipt/<sale_id>', methods=['GET'])
@require_auth
def get_receipt(sale_id):
    sale = db.get_sale_details(sale_id)
    if not sale:
        return jsonify({'error': 'Invoice not found.'}), 404

    # If employee, verify permitted access
    if g.current_user['role'] == 'employee' and sale['cashier_id'] != g.current_user['id']:
        return jsonify({'error': 'Unauthorized to view this invoice.'}), 403

    settings = db.get_settings()
    return jsonify({
        'sale': sale,
        'settings': settings
    })

@pos_bp.route('/history', methods=['GET'])
@require_auth
def get_history():
    user = g.current_user
    cashier_filter = user['id'] if user['role'] == 'employee' else request.args.get('cashier_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = int(request.args.get('limit', 100))

    sales = db.get_sales(limit=limit, cashier_id=cashier_filter, start_date=start_date, end_date=end_date)
    return jsonify({'sales': sales})
