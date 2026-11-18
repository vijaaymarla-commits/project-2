import os
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import require_auth, require_role

setting_bp = Blueprint('settings', __name__, url_prefix='/api/v1/settings')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@setting_bp.route('', methods=['GET'])
def get_settings():
    """Public store settings for branding, receipt, and frontend display."""
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

@setting_bp.route('/upload-image', methods=['POST'])
@require_auth
def upload_shop_image():
    """Upload shop storefront or brand logo image."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided in request.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, WEBP, SVG.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"shop_logo_{uuid.uuid4().hex[:8]}.{ext}"
    upload_dir = os.path.join('static', 'uploads', 'shop')
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    image_url = f"/static/uploads/shop/{filename}"
    db.save_setting('shop_image_url', image_url)

    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'UPLOAD_SHOP_IMAGE', 'settings', '0',
                 {'image_url': image_url}, request.remote_addr)

    return jsonify({
        'message': 'Shop image uploaded and updated successfully.',
        'image_url': image_url,
        'settings': db.get_settings()
    })
