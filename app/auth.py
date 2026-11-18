import jwt
from datetime import datetime, timezone, timedelta
from functools import wraps
from flask import request, jsonify, g
from app.config import Config
from app.database import db

def generate_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user['id']),
        'email': user['email'],
        'full_name': user['full_name'],
        'role': user['role'],
        'exp': now + timedelta(days=7),
        'iat': now
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')

def decode_token(token):
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required. Missing or malformed token.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired session. Please login again.'}), 401
        
        user = db.get_user_by_id(payload['sub'])
        if not user or not user.get('is_active'):
            return jsonify({'error': 'Account is inactive or does not exist.'}), 403
        
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def require_role(required_role):
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated(*args, **kwargs):
            if g.current_user.get('role') != required_role:
                return jsonify({
                    'error': f'Permission denied. This operation requires {required_role} role.',
                    'current_role': g.current_user.get('role')
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
