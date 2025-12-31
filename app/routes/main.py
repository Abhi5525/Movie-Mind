from flask import Blueprint, jsonify
from flask import current_app

from datetime import datetime


main_bp = Blueprint("main", __name__)

@main_bp.route("/", methods = ['GET']) 
def home():
    """
    Home endpoint for MovieMind Recommendation API
    """
    return jsonify({
    "message": "MovieMind Recommendation API",
    "version": "1.0",
    "endpoints": {
        "/health": "Check API health",
        "/movies": "Get all movies",
        "/recommendations/popular": "Get popular movies",
        "/recommendations/content-based": "Content-based recommendations",
        "/recommendations/collaborative": "Collaborative filtering",
        "/recommendations/hybrid": "Hybrid recommendations",
        "/recommendations/quiz": "Quiz-based recommendations",
        "/search": "Search movies",
        "/user/<user_id>/rate": "Rate a movie",
        "/user/<user_id>/history": "Get user history"
    }
})



@main_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health Check Endpoint
    
    """
    store = current_app.config.get('MOVIE_STORE')
    users = current_app.config.get('USER_INTERACTIONS', {})

    movies_count = len(store.get_all_movies()) if store else 0

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "movies_count": movies_count,
        "users_count": len(users)
    })