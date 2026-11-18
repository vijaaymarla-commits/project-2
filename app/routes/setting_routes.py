from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

setting_bp = Blueprint('settings', __name__, url_prefix='/api/v1/settings')

@setting_bp.route('', methods=['GET'])
@require_auth
def get_settings():
    settings = db.get_settings()
    return jsonify({'settings': settings})

@setting_bp.route('', methods=['POST'])
@require_role('admin')
def update_settings():
    data = request.get_json() or {}
    for k, v in data.items():
        db.save_setting(k, v)

    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'UPDATE_SETTINGS', 'settings', '0',
                 {'updated_keys': list(data.keys())}, request.remote_addr)

    return jsonify({'message': 'Store settings updated successfully.', 'settings': db.get_settings()})
