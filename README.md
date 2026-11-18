# Fresh Cut Meat Shop Management System 🥩

> **Modern, Premium, Commercial-Grade Retail POS & Butchery ERP Platform**  
> Built with HTML5, CSS3, Bootstrap 5, JavaScript, Python Flask, Pandas, and Supabase PostgreSQL.

---

## 🌟 Overview & Key Highlights

**Fresh Cut Meat Shop Management System** is a full-featured commercial solution designed specifically for modern fresh meat, poultry, seafood, and butcher shop retail operations.

- **Theme & UI/UX**: Fresh, hygienic emerald and organic green aesthetic (`#064e3b` / `#059669`) with crisp white glassmorphic cards and dark charcoal typography.
- **Interactive Animations**:
  - Dashboard cards gently lift (`translateY(-6px)`) and cast ambient glow shadows on hover or touch.
  - Animated number counters for revenue, gross profit, and stock using easing requestAnimationFrame algorithms.
  - Smooth Chart.js redraw transitions for revenue curves and category distribution.
  - POS flying cart animation, stepper micro-interactions, and thermal print formatting.
  - Skeleton shimmer loaders and toast pop physics.
- **Role-Based Access Control**:
  - **Admin / Owner**: Full access to all 13 modules, financial statements, employee administration, and settings.
  - **Employee / Cashier**: Fast POS checkout, product catalog view with hidden cost margins, and personal sales statistics.
- **Database Architecture**: Directly connected to live **Supabase PostgreSQL 17** with complete tables, constraints, foreign keys, and audit logging.
- **Future Mobile Ready**: Fully documented REST API endpoints (`/api/v1/...`) ready to power future Android, iOS, or PWA applications.

---

## 🚀 Live Demo Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin / Owner** | `admin@freshcuts.com` | `admin123` | Full System Control (POS, Inventory, Finance, P&L, Staff) |
| **Employee (Cashier)** | `emp1@freshcuts.com` | `emp123` | POS Billing, Product Catalog, Personal Sales |
| **Employee (Butcher)** | `emp2@freshcuts.com` | `emp123` | POS Billing, Stock Checks |

---

## 📦 System Modules (13 Core Modules)

1. **Executive Dashboard**: Real-time sales KPIs, Chart.js 7-day revenue curves, category share doughnut charts, and low-stock alert thresholds.
2. **POS Billing Engine**: Fast touch-screen billing, KG / piece / pack support, weight shortcuts (250g, 500g, 750g, 1kg, 2kg), discounts, GST calculation, dynamic UPI QR preview, and 80mm thermal receipt generator.
3. **Products & Meat Cuts**: Catalog for Chicken, Mutton, Seafood, Beef, and Marinades with unit pricing and stock alert levels.
4. **Inventory & Wastage Control**: Real-time stock balances, spoilage/damage loss tracking, bone & fat trimming records, and stock movement logs.
5. **Customer Ledger**: Retail customer accounts with credit balance limits and billing history.
6. **Suppliers & Farms**: Directory for livestock farms, hatcheries, and fishermen unions.
7. **Purchase Orders**: Inbound stock shipments with automatic inventory increments.
8. **Shop Expenses**: Categorized operational cost logger (electricity, rent, cold-chain maintenance, packaging).
9. **Reports & P&L Analytics**: Pandas-powered financial statements:
   - Gross Sales, Net Sales Revenue, Cost of Goods Sold (COGS), Gross Profit & Margin %, Wastage Loss, Operating Expenses, and Net Operating Result.
   - 1-Click Export to **CSV**, **Excel (.xlsx)**, and **Official PDF Statement**.
10. **Staff Accounts**: Employee creation and access toggle (Admin only).
11. **Store Settings**: GSTIN, tax rate %, shop branding, and thermal receipt footer message.
12. **Audit Logs**: Immutable log of security events, logins, and operational changes.
13. **Mobile Pathway**: Clean JSON API with stateless JWT tokens.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons, JavaScript (ES6+), Chart.js 4.4
- **Backend**: Python 3.14+, Flask 3.1+, Flask-CORS, PyJWT, Python-dotenv
- **Data Processing & Export**: Pandas, OpenPyXL, ReportLab
- **Database**: Supabase PostgreSQL (Host: `db.bxzjnzwmzixiyduaqvmf.supabase.co`)

---

## ⚡ Quickstart & Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vijaaymarla-commits/project-2.git
   cd project-2
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Verify Environment Variables (`.env`)**:
   ```env
   DB_HOST=db.bxzjnzwmzixiyduaqvmf.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=YourPassword
   JWT_SECRET=fresh-cuts-jwt-secret-key-meat-shop-2026
   PORT=5000
   ```

4. **Initialize Supabase Schema & Seeds (Already Applied)**:
   ```bash
   python init_supabase.py
   ```

5. **Start the Application**:
   ```bash
   python run.py
   ```
   Open your browser at: **`http://127.0.0.1:5000`**

6. **Run Automated Test Suite**:
   ```bash
   python test_api.py
   ```
