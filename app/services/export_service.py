import io
import csv
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ExportService:
    @staticmethod
    def export_csv(headers, data_rows):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in data_rows:
            writer.writerow(row)
        return output.getvalue().encode('utf-8')

    @staticmethod
    def export_excel(sheet_title, headers, data_rows):
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_title[:31]

        # Header formatting (Deep Emerald green theme)
        header_fill = PatternFill(start_color="064E3B", end_color="064E3B", fill_type="solid")
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        ws.append(headers)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Data rows
        for row in data_rows:
            ws.append(row)

        for row_cells in ws.iter_rows(min_row=2, max_row=len(data_rows) + 1, min_col=1, max_col=len(headers)):
            for cell in row_cells:
                cell.border = thin_border
                cell.font = Font(name="Arial", size=10)

        # Auto fit column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    @staticmethod
    def export_pnl_pdf(pnl_data, shop_name="Fresh Cut Prime Meat Shop"):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#064E3B'),
            alignment=1,
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'SubTitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#64748B'),
            alignment=1,
            spaceAfter=20
        )
        section_style = ParagraphStyle(
            'SectionStyle',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            textColor=colors.HexColor('#0F172A'),
            spaceBefore=12,
            spaceAfter=8
        )

        elements.append(Paragraph(shop_name.upper(), title_style))
        period_str = f"Generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')}"
        elements.append(Paragraph(f"Profit & Loss Financial Statement • {period_str}", subtitle_style))

        # Statement Table
        table_data = [
            ['Financial Metric', 'Amount (₹)'],
            ['Gross Sales (Subtotal)', f"₹{pnl_data.get('gross_sales', 0.0):,.2f}"],
            ['Customer Discounts Allowed', f"- ₹{pnl_data.get('total_discounts', 0.0):,.2f}"],
            ['Taxes Collected (GST)', f"₹{pnl_data.get('total_tax', 0.0):,.2f}"],
            ['Net Sales Revenue', f"₹{pnl_data.get('net_sales_revenue', 0.0):,.2f}"],
            ['Cost of Goods Sold (COGS)', f"- ₹{pnl_data.get('cogs', 0.0):,.2f}"],
            ['Gross Profit', f"₹{pnl_data.get('gross_profit', 0.0):,.2f}"],
            ['Gross Margin %', f"{pnl_data.get('gross_margin_pct', 0.0)}%"],
            ['Wastage / Spoilage Loss', f"- ₹{pnl_data.get('total_wastage_loss', 0.0):,.2f}"],
            ['Operating Expenses', f"- ₹{pnl_data.get('total_expenses', 0.0):,.2f}"],
            ['Net Operating Result (Net Profit)', f"₹{pnl_data.get('net_operating_result', 0.0):,.2f}"]
        ]

        t = Table(table_data, colWidths=[320, 180])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#064E3B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 4), (-1, 4), 'Helvetica-Bold'),
            ('FONTNAME', (0, 6), (-1, 6), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#ECFDF5')),
            ('FONTNAME', (0, 10), (-1, 10), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#D1FAE5')),
            ('TEXTCOLOR', (0, 10), (-1, 10), colors.HexColor('#064E3B')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        # Expenses Breakdown
        exp_by_cat = pnl_data.get('expenses_by_category', {})
        if exp_by_cat:
            elements.append(Paragraph("Operating Expenses Breakdown", section_style))
            exp_table = [['Expense Category', 'Total Incurred (₹)']]
            for cat, amt in exp_by_cat.items():
                exp_table.append([cat, f"₹{amt:,.2f}"])
            
            et = Table(exp_table, colWidths=[320, 180])
            et.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(et)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
