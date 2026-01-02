# Complete corrected auth.py
from flask import Blueprint, request, jsonify
from app.models.users import User  # Make sure this import is correct
from app.database import db
from flask_jwt_extended import create_access_token
from datetime import timedelta, datetime
import traceback

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# Add this admin login route to your existing auth.py
@auth_bp.route('/admin/login', methods=['POST'])
def admin_login():
    """Admin login endpoint - uses same JWT system"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    # Find user
    user = User.query.filter_by(email=email).first()
    
    # Check if user exists, password is correct, AND user is admin
    if user and user.check_password(password) and user.is_admin:
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create access token (same as regular login)
        access_token = create_access_token(
        identity=str(user.id),  # Make sure this is also a string
        expires_delta=timedelta(days=7)
    )
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'is_admin': True,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'is_admin': user.is_admin
            }
        })
    
    return jsonify({'error': 'Invalid admin credentials'}), 401

@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        if not request.is_json:
            return jsonify({
                "success": False, 
                "message": "Content-Type must be application/json"
            }), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        required_fields = ["name", "email", "password"]
        missing = [field for field in required_fields if field not in data]
        if missing:
            return jsonify({
                "success": False, 
                "message": f"Missing fields: {', '.join(missing)}"
            }), 400

        # Check if user exists
        existing_user = User.query.filter_by(email=data["email"]).first()
        if existing_user:
            return jsonify({
                "success": False, 
                "message": "User already exists"
            }), 409

        # Create user
        user = User(name=data["name"], email=data["email"])
        user.set_password(data["password"])

        db.session.add(user)
        db.session.commit()

        # Get the user with ID (after commit)
        db.session.refresh(user)
        
        # Create token with user ID as string
        access_token = create_access_token(
            identity=str(user.id),  # Pass string ID
            expires_delta=timedelta(days=7)
        )

        return jsonify({
            "success": True,
            "access_token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "joinDate": user.join_date.strftime("%Y-%m-%d") if user.join_date else None
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Register error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            "success": False, 
            "message": f"Registration failed: {str(e)}"
        }), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        if not request.is_json:
            return jsonify({
                'success': False, 
                'message': 'Content-Type must be application/json'
            }), 400
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password required'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            # Create token with user ID as string
            access_token = create_access_token(
                identity=str(user.id),  # Pass string ID
                expires_delta=timedelta(days=7)
            )
            
            return jsonify({
                'success': True,
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'joinDate': user.join_date.strftime("%Y-%m-%d") if user.join_date else None
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False, 
            'message': f'Login failed: {str(e)}'
        }), 500


# Test endpoint
@auth_bp.route('/test', methods=['GET'])
def test_auth():
    return jsonify({
        "success": True,
        "message": "Auth routes are working",
        "available_routes": [
            "/auth/login (POST)",
            "/auth/register (POST)", 
            "/auth/test (GET)"
        ]
    })