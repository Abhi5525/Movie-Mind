from flask import Blueprint, jsonify
from flask import current_app
from datetime import datetime


main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def home():
    """
    Home endpoint for MovieMind Recommendation API
    ---
    tags:
      - Main
    responses:
      200:
        description: API information and available endpoints
        schema:
          type: object
          properties:
            message:
              type: string
              example: "MovieMind Recommendation API"
            version:
              type: string
              example: "1.0"
            endpoints:
              type: object
              example:
                /health: "Check API health"
                /movies: "Get all movies"
                /recommendations/popular: "Get popular movies"
                /recommendations/content: "Content-based recommendationsations"
                /recommendations/collaborative: "Collaborative filtering"
                /recommendations/hybrid: "Hybrid recommendationsations"
                /recommendations/quiz: "Quiz-based recommendationsations"
                /search: "Search movies"
                /user/<user_id>/rate: "Rate a movie"
                /user/<user_id>/history: "Get user history"
    """
    return jsonify({
        "message": "MovieMind recommendationsation API",
        "version": "1.0",
        "endpoints": {
            "/health": "Check API health",
            "/movies": "Get all movies",
            "/recommendations/popular": "Get popular movies",
            "/recommendations/content-based": "Content-based recommendationsations",
            "/recommendations/collaborative": "Collaborative filtering",
            "/recommendations/hybrid": "Hybrid recommendationsations",
            "/recommendations/quiz": "Quiz-based recommendationsations",
            "/search": "Search movies",
            "/user/<user_id>/rate": "Rate a movie",
            "/user/<user_id>/history": "Get user history"
        }
    })



@main_bp.route("/health", methods=["GET"])
def health_check():
    """
    Health Check Endpoint
    ---
    tags:
      - Main
    responses:
      200:
        description: API is healthy
        schema:
          type: object
          properties:
            status:
              type: string
            timestamp:
              type: string
            movies_count:
              type: integer
            users_count:
              type: integer
    """
    store = current_app.config['MOVIE_STORE']
    users = current_app.config.get('USER_INTERACTIONS', {})  # optional if stored separately
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "movies_count": len(store.get_all_movies()),
        "users_count": len(users)
    })
