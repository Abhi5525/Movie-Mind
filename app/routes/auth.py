from flask import Blueprint, request, jsonify
from app.models.users import User
from app.database import db
from flask_jwt_extended import create_access_token
auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not all(k in data for k in ("name", "email", "password")):
        return jsonify({"error": "Missing fields"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "User already exists"}), 409

    user = User(name=data["name"], email=data["email"])
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    user = User.query.filter_by(email=data.get("email")).first()
    if not user or not user.check_password(data.get("password")):
        return jsonify({"error": "Invalid credentials"}), 401
    access_token = create_access_token(identity = user.id)

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,        # ← REQUIRED
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    })
