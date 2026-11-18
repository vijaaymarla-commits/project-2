from flask import Blueprint, request, jsonify, send_file, make_response
import io
from datetime import datetime
from app.database import db
from app.auth import require_role
from app.services.report_service import ReportService
from app.services.export_service import ExportService

report_bp = Blueprint('reports', __name__, url_prefix='/api/v1/reports')

@report_bp.route('/pnl', methods=['GET'])
@require_role('admin')
def get_pnl():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    pnl = ReportService.get_pnl_summary(start_date=start_date, end_date=end_date)
    return jsonify(pnl)

@report_bp.route('/products', methods=['GET'])
@require_role('admin')
def get_product_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    rows = ReportService.get_product_sales_report(start_date=start_date, end_date=end_date)
    return jsonify({'product_sales': rows})

@report_bp.route('/employees', methods=['GET'])
@require_role('admin')
def get_employee_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    rows = ReportService.get_employee_sales_report(start_date=start_date, end_date=end_date)
    return jsonify({'employee_sales': rows})

@report_bp.route('/export/csv', methods=['GET'])
@require_role('admin')
def export_csv():
    report_type = request.args.get('type', 'sales')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if report_type == 'sales':
        sales = db.get_sales(limit=1000, start_date=start_date, end_date=end_date)
        headers = ['Invoice No', 'Date', 'Customer', 'Cashier', 'Subtotal', 'Discount', 'Tax', 'Total Amount', 'Payment Method']
        rows = [
            [s['invoice_no'], s['created_at'], s.get('customer_name') or 'Retail', s['cashier_name'],
             s['subtotal'], s['discount_amount'], s['tax_amount'], s['total_amount'], s['payment_method']]
            for s in sales
        ]
        csv_bytes = ExportService.export_csv(headers, rows)
        return make_response(csv_bytes, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename="sales_report_{datetime.now().strftime("%Y%m%d")}.csv"'
        })

    elif report_type == 'inventory':
        inventory = db.get_inventory()
        headers = ['Code', 'Product Name', 'Category', 'Unit', 'Selling Price', 'Cost Price', 'Current Stock', 'Min Stock Alert']
        rows = [
            [i['code'], i['name'], i['category'], i['unit'], i['selling_price'], i['cost_price'], i['current_stock'], 'LOW STOCK' if i['is_low_stock'] else 'OK']
            for i in inventory
        ]
        csv_bytes = ExportService.export_csv(headers, rows)
        return make_response(csv_bytes, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename="inventory_report_{datetime.now().strftime("%Y%m%d")}.csv"'
        })

    return jsonify({'error': 'Invalid report type.'}), 400

@report_bp.route('/export/excel', methods=['GET'])
@require_role('admin')
def export_excel():
    report_type = request.args.get('type', 'sales')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if report_type == 'sales':
        sales = db.get_sales(limit=1000, start_date=start_date, end_date=end_date)
        headers = ['Invoice No', 'Date', 'Customer', 'Cashier', 'Subtotal (₹)', 'Discount (₹)', 'Tax (₹)', 'Total Amount (₹)', 'Payment Method']
        rows = [
            [s['invoice_no'], str(s['created_at']), s.get('customer_name') or 'Retail', s['cashier_name'],
             s['subtotal'], s['discount_amount'], s['tax_amount'], s['total_amount'], s['payment_method']]
            for s in sales
        ]
        xlsx_bytes = ExportService.export_excel('Sales Report', headers, rows)
        return make_response(xlsx_bytes, 200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': f'attachment; filename="sales_report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        })

    elif report_type == 'inventory':
        inventory = db.get_inventory()
        headers = ['Code', 'Product Cut Name', 'Category', 'Unit', 'Selling Price (₹)', 'Cost Price (₹)', 'Stock Balance', 'Alert Status']
        rows = [
            [i['code'], i['name'], i['category'], i['unit'], i['selling_price'], i['cost_price'], i['current_stock'], 'LOW STOCK' if i['is_low_stock'] else 'OK']
            for i in inventory
        ]
        xlsx_bytes = ExportService.export_excel('Inventory Stock', headers, rows)
        return make_response(xlsx_bytes, 200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': f'attachment; filename="inventory_stock_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        })

    return jsonify({'error': 'Invalid report type.'}), 400

@report_bp.route('/export/pdf', methods=['GET'])
@require_role('admin')
def export_pdf():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    pnl = ReportService.get_pnl_summary(start_date=start_date, end_date=end_date)
    settings = db.get_settings()
    shop_name = settings.get('shop_name', 'Fresh Cut Prime Meat Shop')

    pdf_bytes = ExportService.export_pnl_pdf(pnl, shop_name=shop_name)
    return make_response(pdf_bytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename="profit_loss_statement_{datetime.now().strftime("%Y%m%d")}.pdf"'
    })
