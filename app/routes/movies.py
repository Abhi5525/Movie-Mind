from flask import Blueprint, jsonify, current_app, request
from app.services.quiz_recommender import get_quiz_recommendations
from app.models.movie import Movie
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.users import Favorite, QuizResult
from app.database import db
import json

# Blueprints
movies_bp = Blueprint('movies', __name__, url_prefix='/movies')


# ===== MOVIE ROUTES =====
@movies_bp.route("/", methods=['GET'])
def get_all_movies():
    """
    Return all movies with pagination

    """
    store = current_app.config['MOVIE_STORE']
    movies = store.get_all_movies()
    if not movies:
      return jsonify({"error": "No movies loaded"}), 500

    limit = request.args.get('limit', 50, type=int)
    page = request.args.get('page', 1, type=int)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit

    return jsonify({
        "success": True,
        "movies": movies[start_idx:end_idx],
        "total": len(movies),
        "page": page,
        "limit": limit
    })


@movies_bp.route("/<int:movie_id>", methods=['GET'])
def get_movie(movie_id):
    """
    Get a single movie by ID

    """
    store = current_app.config['MOVIE_STORE']
    movie = store.get_movie_by_id(movie_id)
    if not movie:
        return jsonify({"success": False, "error": "Movie not found"}), 404
    return jsonify({"success": True, "movie": movie})


# ===== RECOMMENDATION ROUTES =====


@movies_bp.route("/analyze", methods=["GET"])
def analyze_movies():
    """
    Analyze movie database statistics: genres, years, ratings, directors
    ---
    """
    try:
        store = current_app.config["MOVIE_STORE"]
        movies = store.get_all_movies()
        
        total_movies = len(movies)
        
        # Genre analysis
        all_genres = []
        for movie in movies:
            if movie.get("genres"):
                all_genres.extend([g.strip() for g in movie["genres"].split(",")])
        
        unique_genres = list(set(all_genres))
        genre_counts = {genre: all_genres.count(genre) for genre in unique_genres}
        top_genres = dict(sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:10])

        # Year analysis
        years = [m.get("year", 0) for m in movies if m.get("year")]
        avg_year = int(sum(years)/len(years)) if years else 0
        min_year, max_year = (min(years), max(years)) if years else (0, 0)

        # Rating analysis
        ratings = [m.get("rating", 0) for m in movies if m.get("rating")]
        avg_rating = round(sum(ratings)/len(ratings), 2) if ratings else 0

        # Director analysis
        directors = [m.get("director", "Unknown") for m in movies]
        director_counts = {}
        for d in directors:
            director_counts[d] = director_counts.get(d, 0) + 1
        top_directors = dict(sorted(director_counts.items(), key=lambda x: x[1], reverse=True)[:5])

        return jsonify({
            "total_movies": total_movies,
            "unique_genres": len(unique_genres),
            "top_genres": top_genres,
            "year_range": [min_year, max_year],
            "average_year": avg_year,
            "average_rating": avg_rating,
            "top_directors": top_directors,
            "algorithm_info": {
                "type": "Hybrid (Content + Collaborative)",
                "content_weight": 0.7,
                "collaborative_weight": 0.3,
                "similarity_metric": "Cosine Similarity"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    


favorites_bp = Blueprint("favorites", __name__, url_prefix="/favorites")

@favorites_bp.route("/", methods=["GET"])
@jwt_required()
def get_favorites():
    user_id = get_jwt_identity()
    favorites = Favorite.query.filter_by(user_id=user_id).all()
    return jsonify([fav.to_dict() for fav in favorites])

@favorites_bp.route("/toggle", methods=["POST"])
@jwt_required()
def toggle_favorite():
    user_id = get_jwt_identity()
    data = request.json
    movie_id = data.get("movie_id")

    if not movie_id:
        return jsonify({"error": "movie_id required"}), 400

    favorite = Favorite.query.filter_by(user_id=user_id, movie_id=movie_id).first()

    if favorite:
        # Remove
        db.session.delete(favorite)
        db.session.commit()
        return jsonify({"message": "Removed from favorites", "movie_id": movie_id})
    else:
        # Add
        new_fav = Favorite(
            user_id=user_id,
            movie_id=movie_id,
            title=data.get("title"),
            img=data.get("img"),
            rating=data.get("rating"),
            year=data.get("year")
        )
        db.session.add(new_fav)
        db.session.commit()
        return jsonify({"message": "Added to favorites", "movie": new_fav.to_dict()})
    

@favorites_bp.route("/clear", methods=["POST"])
@jwt_required()
def clear_favorites():
    user_id = get_jwt_identity()
    Favorite.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return jsonify({"message": "Favorites cleared"})
