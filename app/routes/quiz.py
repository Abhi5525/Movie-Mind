from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.users import  QuizResult, User
from app.database import db
import json
from datetime import datetime

quiz_bp = Blueprint('quiz', __name__)


# Add OPTIONS handler for CORS preflight
@quiz_bp.route('/save', methods=['OPTIONS'])
def handle_options():
    return jsonify({}), 200

@quiz_bp.route('/save', methods=['POST', 'OPTIONS'])
@jwt_required()
def save_quiz_result():
    """Save quiz results to database"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    try:
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        
        if not user_id:
            return jsonify({"success": False, "error": "User not found"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Debug: print received data
        print("Received quiz data:", data)
        
        # Validate required fields with fallbacks
        profileType = data.get('profileType', 'genre_explorer')
        name = data.get('name', 'Movie Enthusiast')
        description = data.get('description', 'Loves all kinds of movies')
        topGenres = data.get('topGenres', [])
        tags = data.get('tags', [])
        answers = data.get('answers', {})
        
        # Ensure lists are JSON serializable
        if not isinstance(topGenres, list):
            topGenres = []
        if not isinstance(tags, list):
            tags = []
        if not isinstance(answers, dict):
            answers = {}
        
        # Create quiz result
        quiz_result = QuizResult(
            user_id=user_id,
            profile_type=profileType,
            profile_name=name,
            profile_description=description,
            top_genres=json.dumps(topGenres),
            tags=json.dumps(tags),
            quiz_answers=json.dumps(answers)
        )
        
        db.session.add(quiz_result)
        
        # Update user's quiz profile
        user = User.query.get(user_id)
        if user:
            user.quiz_profile_type = profileType
            user.quiz_taken_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Quiz results saved successfully",
            "quiz_result": quiz_result.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Quiz save error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500    

@quiz_bp.route('/results', methods=['GET'])
@jwt_required()
def get_quiz_results():
    """
    Get user's quiz results
    """
    try:
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        
        quiz_results = QuizResult.query.filter_by(user_id=user_id)\
            .order_by(QuizResult.created_at.desc())\
            .all()
        
        results = [result.to_dict() for result in quiz_results]
        
        # Get latest quiz result
        latest_result = quiz_results[0] if quiz_results else None
        
        return jsonify({
            "success": True,
            "results": results,
            "latest_result": latest_result.to_dict() if latest_result else None,
            "count": len(results)
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@quiz_bp.route('/latest', methods=['GET'])
@jwt_required()
def get_latest_quiz_result():
    """
    Get user's latest quiz result
    """
    try:
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        
        latest_result = QuizResult.query\
            .filter_by(user_id=user_id)\
            .order_by(QuizResult.created_at.desc())\
            .first()
        
        if not latest_result:
            return jsonify({
                "success": True,
                "has_quiz": False,
                "message": "No quiz results found"
            })
        
        return jsonify({
            "success": True,
            "has_quiz": True,
            "quiz_result": latest_result.to_dict()
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@quiz_bp.route('/clear', methods=['DELETE'])
@jwt_required()
def clear_quiz_results():
    """
    Clear user's quiz results
    """
    try:
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        
        # Delete all quiz results for user
        deleted_count = QuizResult.query.filter_by(user_id=user_id).delete()
        
        # Clear user's quiz profile
        user = User.query.get(user_id)
        if user:
            user.quiz_profile_type = None
            user.quiz_taken_at = None
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Cleared {deleted_count} quiz results",
            "deleted_count": deleted_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500