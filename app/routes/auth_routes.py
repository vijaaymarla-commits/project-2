import hashlib
from flask import Blueprint, request, jsonify, g
from app.database import db
from app.auth import generate_token, require_auth, require_role

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = db.get_user_by_email(email)
    if not user:
        return jsonify({'error': 'Invalid credentials. User not found.'}), 401

    if not user.get('is_active'):
        return jsonify({'error': 'This account has been deactivated. Please contact the administrator.'}), 403

    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    if user.get('password_hash') and user['password_hash'] != pwd_hash:
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = generate_token(user)
    db.log_audit(user['id'], user['full_name'], 'USER_LOGIN', 'profiles', user['id'], {'email': email}, request.remote_addr)

    user_info = {
        'id': user['id'],
        'email': user['email'],
        'full_name': user['full_name'],
        'role': user['role'],
        'phone': user.get('phone')
    }

    return jsonify({
        'message': 'Login successful.',
        'token': token,
        'user': user_info
    })

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    full_name = data.get('full_name', '').strip()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'employee').strip().lower()

    if not email or not password or not full_name:
        return jsonify({'error': 'Full name, email, and password are required.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400

    if role not in ('employee', 'admin', 'customer'):
        role = 'employee'

    existing = db.get_user_by_email(email)
    if existing:
        return jsonify({'error': 'An account with this email address already exists. Please login instead.'}), 409

    user_id = db.save_user({
        'email': email,
        'full_name': full_name,
        'role': role,
        'phone': phone,
        'password': password,
        'is_active': True
    })

    user = db.get_user_by_id(user_id)
    token = generate_token(user)
    db.log_audit(user_id, full_name, 'USER_REGISTER', 'profiles', user_id, {'email': email, 'role': role}, request.remote_addr)

    user_info = {
        'id': user['id'],
        'email': user['email'],
        'full_name': user['full_name'],
        'role': user['role'],
        'phone': user.get('phone')
    }

    return jsonify({
        'message': 'Account registered successfully.',
        'token': token,
        'user': user_info
    }), 201

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    user = g.current_user
    return jsonify({
        'id': user['id'],
        'email': user['email'],
        'full_name': user['full_name'],
        'role': user['role'],
        'phone': user.get('phone')
    })

@auth_bp.route('/users', methods=['GET'])
@require_role('admin')
def list_users():
    users = db.get_users()
    return jsonify({'users': users})

@auth_bp.route('/users', methods=['POST'])
@require_role('admin')
def create_user():
    data = request.get_json() or {}
    for field in ['email', 'full_name', 'role', 'password']:
        if not data.get(field):
            return jsonify({'error': f"Field '{field}' is required."}), 400

    if data['role'] not in ('admin', 'employee'):
        return jsonify({'error': "Role must be 'admin' or 'employee'."}), 400

    existing = db.get_user_by_email(data['email'].strip().lower())
    if existing:
        return jsonify({'error': 'An account with this email already exists.'}), 409

    user_id = db.save_user({
        'email': data['email'].strip().lower(),
        'full_name': data['full_name'].strip(),
        'role': data['role'],
        'phone': data.get('phone', ''),
        'password': data['password'],
        'is_active': bool(data.get('is_active', True))
    })

    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'CREATE_USER', 'profiles', user_id,
                 {'email': data['email'], 'role': data['role']}, request.remote_addr)

    return jsonify({'message': 'Employee account created successfully.', 'user_id': user_id}), 201

@auth_bp.route('/users/<user_id>', methods=['PUT'])
@require_role('admin')
def update_user(user_id):
    user = db.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404

    data = request.get_json() or {}
    updated = {
        'id': user_id,
        'email': data.get('email', user['email']).strip().lower(),
        'full_name': data.get('full_name', user['full_name']).strip(),
        'role': data.get('role', user['role']),
        'phone': data.get('phone', user.get('phone', '')),
        'is_active': bool(data['is_active']) if 'is_active' in data else user.get('is_active', True),
        'password': data.get('password') if data.get('password') else None
    }
    db.save_user(updated)
    db.log_audit(g.current_user['id'], g.current_user['full_name'], 'UPDATE_USER', 'profiles', user_id,
                 {'role': updated['role'], 'is_active': updated['is_active']}, request.remote_addr)

    return jsonify({'message': 'User updated successfully.'})
