from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_role

expense_bp = Blueprint('expenses', __name__, url_prefix='/api/v1/expenses')

@expense_bp.route('', methods=['GET'])
@require_role('admin')
def get_expenses():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')

    expenses = db.get_expenses(start_date=start_date, end_date=end_date, category=category)
    total_amount = sum(e['amount'] for e in expenses)
    return jsonify({'expenses': expenses, 'total_amount': round(total_amount, 2)})

@expense_bp.route('', methods=['POST'])
@require_role('admin')
def save_expense():
    data = request.get_json() or {}
    for req in ['category', 'title', 'amount', 'payment_method']:
        if not data.get(req):
            return jsonify({'error': f"Field '{req}' is required."}), 400

    data['created_by'] = g.current_user['id']
    eid = db.save_expense(data)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'RECORD_EXPENSE', 'expenses', eid,
                 {'title': data['title'], 'amount': data['amount'], 'category': data['category']}, request.remote_addr)

    return jsonify({'message': 'Expense recorded successfully.', 'expense_id': eid}), 201
