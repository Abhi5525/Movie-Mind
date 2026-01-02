# app/routes/admin.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import db
from app.models.users import User
from app.models.movie import Movie
from app.models.users import QuizResult
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# ========== DASHBOARD ==========
@admin_bp.route('/dashboard')
@jwt_required()
def admin_dashboard():
    """Admin dashboard statistics"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Get statistics
    total_users = User.query.count()
    total_movies = Movie.query.count()
    total_quizzes = QuizResult.query.count() if hasattr(QuizResult, 'query') else 0
    
    # Recent activity
    recent_users = User.query.order_by(User.join_date.desc()).limit(5).all()
    recent_movies = Movie.query.order_by(Movie.created_at.desc()).limit(5).all()
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'is_admin': user.is_admin
        },
        'stats': {
            'total_users': total_users,
            'total_movies': total_movies,
            'total_quizzes': total_quizzes
        },
        'recent_users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'join_date': u.join_date.isoformat() if u.join_date else None,
            'is_admin': u.is_admin
        } for u in recent_users],
        'recent_movies': [{
            'id': m.id,
            'title': m.title,
            'year': m.year,
            'genres': m.genres,
            'rating': m.rating,
            'created_at': m.created_at.isoformat() if hasattr(m, 'created_at') and m.created_at else None
        } for m in recent_movies]
    })

# ========== MOVIES MANAGEMENT ==========
@admin_bp.route('/movies')
@jwt_required()
def get_movies():
    """Get all movies (paginated)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # Query movies
    movies = Movie.query.order_by(Movie.created_at.desc())\
                        .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'movies': [movie.to_dict() for movie in movies.items],
        'pagination': {
            'total': movies.total,
            'pages': movies.pages,
            'current_page': movies.page,
            'per_page': movies.per_page
        }
    })

# ========== USERS MANAGEMENT ==========
@admin_bp.route('/users')
@jwt_required()
def get_users():
    """Get all users (paginated)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # Query users
    users = User.query.order_by(User.join_date.desc())\
                      .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'join_date': u.join_date.isoformat() if u.join_date else None,
            'is_admin': u.is_admin,
            'is_active': u.is_active,
            'last_login': u.last_login.isoformat() if u.last_login else None
        } for u in users.items],
        'pagination': {
            'total': users.total,
            'pages': users.pages,
            'current_page': users.page,
            'per_page': users.per_page
        }
    })

# ========== TEST ENDPOINT ==========
@admin_bp.route('/test')
@jwt_required()
def test_admin():
    """Test endpoint"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    return jsonify({
        'success': True,
        'message': 'Admin access verified!',
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email
        }
    })