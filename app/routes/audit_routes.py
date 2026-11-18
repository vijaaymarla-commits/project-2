from flask import Blueprint, request, jsonify
from app.database import db
from app.auth import require_role

audit_bp = Blueprint('audit', __name__, url_prefix='/api/v1/audit')

@audit_bp.route('', methods=['GET'])
@require_role('admin')
def get_audit_logs():
    limit = int(request.args.get('limit', 100))
    logs = db.get_audit_logs(limit=limit)
    return jsonify({'audit_logs': logs})
