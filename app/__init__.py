import os
from flask import Flask, render_template, send_from_directory, jsonify
from flask_cors import CORS
from app.config import Config

def create_app():
    app = Flask(__name__,
                template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates'),
                static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static'))
    
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register Route Blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.product_routes import product_bp
    from app.routes.pos_routes import pos_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.customer_routes import customer_bp
    from app.routes.supplier_routes import supplier_bp
    from app.routes.purchase_routes import purchase_bp
    from app.routes.expense_routes import expense_bp
    from app.routes.report_routes import report_bp
    from app.routes.payment_routes import payment_bp
    from app.routes.setting_routes import setting_bp
    from app.routes.audit_routes import audit_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(pos_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(customer_bp)
    app.register_blueprint(supplier_bp)
    app.register_blueprint(purchase_bp)
    app.register_blueprint(expense_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(setting_bp)
    app.register_blueprint(audit_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/admin/login')
    def admin_login():
        return render_template('admin_login.html')

    @app.route('/staff/login')
    @app.route('/login')
    def staff_login():
        return render_template('staff_login.html')

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Resource not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    return app
