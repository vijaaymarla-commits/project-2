from flask import Blueprint, jsonify, g, request
from datetime import datetime, date
from app.database import db
from app.auth import require_auth
from app.services.report_service import ReportService

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/v1/dashboard')

@dashboard_bp.route('/summary', methods=['GET'])
@require_auth
def get_summary():
    user = g.current_user
    today_str = date.today().isoformat()

    if user['role'] == 'employee':
        # Employee specific view
        my_sales = db.query('''
        SELECT COUNT(id) as bills_count, COALESCE(SUM(total_amount), 0.0) as today_sales
        FROM public.sales
        WHERE cashier_id = %s AND DATE(created_at) = %s AND payment_status = 'COMPLETED'
        ''', (user['id'], today_str), one=True)

        recent_bills = db.query('''
        SELECT invoice_no, total_amount, payment_method, created_at
        FROM public.sales
        WHERE cashier_id = %s ORDER BY created_at DESC LIMIT 5
        ''', (user['id'],))

        prods_count = db.query("SELECT COUNT(*) as count FROM public.products WHERE is_active = TRUE", one=True)['count']

        return jsonify({
            'role': 'employee',
            'today_sales': float(my_sales['today_sales'] or 0.0),
            'bills_count': int(my_sales['bills_count'] or 0),
            'active_products_count': prods_count,
            'recent_transactions': recent_bills
        })

    # Admin view: Complete Financial & Operational KPI Cards
    today_sales_row = db.query('''
    SELECT COUNT(id) as bills_count, COALESCE(SUM(total_amount), 0.0) as total_sales
    FROM public.sales
    WHERE DATE(created_at) = %s AND payment_status = 'COMPLETED'
    ''', (today_str,), one=True)

    today_sales = float(today_sales_row['total_sales'] or 0.0)
    today_bills = int(today_sales_row['bills_count'] or 0)

    # Lifetime / Overall P&L
    pnl = ReportService.get_pnl_summary()

    # Stock metrics
    inv_rows = db.get_inventory()
    total_stock_kg = sum(r['current_stock'] for r in inv_rows if r['unit'] == 'kg')
    total_stock_pcs = sum(r['current_stock'] for r in inv_rows if r['unit'] in ('pcs', 'pack'))
    low_stock_items = [r for r in inv_rows if r['is_low_stock']]

    # Recent transactions
    recent_sales = db.get_sales(limit=6)

    # 7-day sales trend for Chart.js
    daily_trends = ReportService.get_daily_sales_trend(days=7)

    # Category breakdown for doughnut chart
    cat_sales = db.query('''
    SELECT p.category, SUM(si.total_price) as revenue
    FROM public.sale_items si
    JOIN public.products p ON si.product_id = p.id
    JOIN public.sales s ON si.sale_id = s.id
    WHERE s.payment_status = 'COMPLETED'
    GROUP BY p.category
    ORDER BY revenue DESC
    ''')

    return jsonify({
        'role': 'admin',
        'kpi': {
            'today_sales': today_sales,
            'today_bills': today_bills,
            'total_revenue': pnl['net_sales_revenue'],
            'total_expenses': pnl['total_expenses'],
            'gross_profit': pnl['gross_profit'],
            'gross_margin_pct': pnl['gross_margin_pct'],
            'net_operating_result': pnl['net_operating_result'],
            'total_stock_kg': round(total_stock_kg, 1),
            'total_stock_pcs': int(total_stock_pcs),
            'low_stock_count': len(low_stock_items)
        },
        'low_stock_alerts': low_stock_items[:5],
        'recent_transactions': recent_sales,
        'charts': {
            'daily_trends': daily_trends,
            'categories': cat_sales
        }
    })
