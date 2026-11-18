import pandas as pd
from datetime import datetime, date, timedelta
from app.database import db

class ReportService:
    @staticmethod
    def get_pnl_summary(start_date=None, end_date=None):
        """
        Calculates Net Sales Revenue, Cost of Goods Sold, Gross Profit,
        Wastage Loss, Operating Expenses, and Net Operating Result.
        """
        # Fetch completed sales
        sales_sql = "SELECT * FROM public.sales WHERE payment_status = 'COMPLETED'"
        params = []
        if start_date:
            sales_sql += " AND DATE(created_at) >= %s"
            params.append(start_date)
        if end_date:
            sales_sql += " AND DATE(created_at) <= %s"
            params.append(end_date)
        
        sales_rows = db.query(sales_sql, params)
        sales_df = pd.DataFrame(sales_rows) if sales_rows else pd.DataFrame(columns=['total_amount', 'subtotal', 'discount_amount', 'tax_amount', 'cost_total'])

        # Fetch expenses
        exp_sql = "SELECT * FROM public.expenses WHERE 1=1"
        exp_params = []
        if start_date:
            exp_sql += " AND expense_date >= %s"
            exp_params.append(start_date)
        if end_date:
            exp_sql += " AND expense_date <= %s"
            exp_params.append(end_date)
        
        exp_rows = db.query(exp_sql, exp_params)
        exp_df = pd.DataFrame(exp_rows) if exp_rows else pd.DataFrame(columns=['amount', 'category'])

        # Fetch wastage movements
        wastage_sql = '''
        SELECT sm.*, p.cost_price 
        FROM public.stock_movements sm
        JOIN public.products p ON sm.product_id = p.id
        WHERE sm.movement_type IN ('WASTAGE', 'DAMAGE')
        '''
        wastage_params = []
        if start_date:
            wastage_sql += " AND DATE(sm.created_at) >= %s"
            wastage_params.append(start_date)
        if end_date:
            wastage_sql += " AND DATE(sm.created_at) <= %s"
            wastage_params.append(end_date)

        wastage_rows = db.query(wastage_sql, wastage_params)
        wastage_df = pd.DataFrame(wastage_rows) if wastage_rows else pd.DataFrame(columns=['quantity', 'cost_price'])

        # Compute totals
        gross_sales = float(sales_df['subtotal'].sum()) if not sales_df.empty else 0.0
        total_discounts = float(sales_df['discount_amount'].sum()) if not sales_df.empty else 0.0
        total_tax = float(sales_df['tax_amount'].sum()) if not sales_df.empty else 0.0
        net_sales_revenue = float(sales_df['total_amount'].sum()) if not sales_df.empty else 0.0
        cogs = float(sales_df['cost_total'].sum()) if not sales_df.empty else 0.0

        gross_profit = round(net_sales_revenue - cogs, 2)
        gross_margin_pct = round((gross_profit / net_sales_revenue * 100), 1) if net_sales_revenue > 0 else 0.0

        if not wastage_df.empty:
            wastage_df['loss_value'] = wastage_df['quantity'].abs() * wastage_df['cost_price']
            total_wastage_loss = round(float(wastage_df['loss_value'].sum()), 2)
        else:
            total_wastage_loss = 0.0

        total_expenses = float(exp_df['amount'].sum()) if not exp_df.empty else 0.0
        net_operating_result = round(gross_profit - total_wastage_loss - total_expenses, 2)

        # Expense breakdown
        expense_by_cat = {}
        if not exp_df.empty:
            grouped = exp_df.groupby('category')['amount'].sum().to_dict()
            expense_by_cat = {k: round(float(v), 2) for k, v in grouped.items()}

        return {
            'period': {'start_date': start_date, 'end_date': end_date},
            'bills_count': len(sales_df),
            'gross_sales': round(gross_sales, 2),
            'total_discounts': round(total_discounts, 2),
            'total_tax': round(total_tax, 2),
            'net_sales_revenue': round(net_sales_revenue, 2),
            'cogs': round(cogs, 2),
            'gross_profit': gross_profit,
            'gross_margin_pct': gross_margin_pct,
            'total_wastage_loss': total_wastage_loss,
            'total_expenses': round(total_expenses, 2),
            'net_operating_result': net_operating_result,
            'expenses_by_category': expense_by_cat
        }

    @staticmethod
    def get_product_sales_report(start_date=None, end_date=None):
        sql = '''
        SELECT si.product_id, si.product_name, si.unit, p.category,
               SUM(si.quantity) as total_quantity,
               SUM(si.total_price) as total_revenue,
               SUM(si.quantity * si.unit_cost) as total_cost,
               COUNT(DISTINCT si.sale_id) as order_count
        FROM public.sale_items si
        JOIN public.products p ON si.product_id = p.id
        JOIN public.sales s ON si.sale_id = s.id
        WHERE s.payment_status = 'COMPLETED'
        '''
        params = []
        if start_date:
            sql += " AND DATE(s.created_at) >= %s"
            params.append(start_date)
        if end_date:
            sql += " AND DATE(s.created_at) <= %s"
            params.append(end_date)
        
        sql += " GROUP BY si.product_id, si.product_name, si.unit, p.category ORDER BY total_revenue DESC"
        rows = db.query(sql, params)
        if not rows:
            return []

        df = pd.DataFrame(rows)
        df['gross_profit'] = df['total_revenue'] - df['total_cost']
        df['margin_pct'] = (df['gross_profit'] / df['total_revenue'] * 100).round(1)
        return df.to_dict(orient='records')

    @staticmethod
    def get_employee_sales_report(start_date=None, end_date=None):
        sql = '''
        SELECT s.cashier_id, s.cashier_name,
               COUNT(s.id) as total_bills,
               SUM(s.total_amount) as total_revenue,
               AVG(s.total_amount) as avg_bill_value
        FROM public.sales s
        WHERE s.payment_status = 'COMPLETED'
        '''
        params = []
        if start_date:
            sql += " AND DATE(s.created_at) >= %s"
            params.append(start_date)
        if end_date:
            sql += " AND DATE(s.created_at) <= %s"
            params.append(end_date)

        sql += " GROUP BY s.cashier_id, s.cashier_name ORDER BY total_revenue DESC"
        rows = db.query(sql, params)
        return rows or []

    @staticmethod
    def get_daily_sales_trend(days=14):
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        sql = '''
        SELECT DATE(created_at) as sale_date,
               COUNT(id) as bill_count,
               SUM(total_amount) as total_sales,
               SUM(cost_total) as total_cogs
        FROM public.sales
        WHERE payment_status = 'COMPLETED' AND DATE(created_at) >= %s
        GROUP BY DATE(created_at)
        ORDER BY sale_date ASC
        '''
        rows = db.query(sql, (cutoff,))
        return rows or []
