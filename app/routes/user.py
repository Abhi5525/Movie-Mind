from flask import Blueprint, request, jsonify, current_app
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.movie import Movie
from app.models.users import UserRating, WatchHistory, QuizResult
from datetime import datetime
from app.models.users import db, User, Watchlist, WatchHistory, Favorite, UserRating
import json



user_bp = Blueprint("user", __name__, url_prefix="/user")
# routes.py

@user_bp.route('/panel', methods=['GET'])
@jwt_required()
def get_user_panel():
    try:
        # IMPORTANT: get_jwt_identity() returns the user_id (set during login)
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)  # Convert to int
    
        
        # Debug: Print user_id to check
        print(f"Getting panel for user_id: {user_id}")
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        watchlist_count = len(user.watchlist) if user.watchlist else 0
        history_count = len(user.history) if user.history else 0
        favorites_count = len(user.favorites) if user.favorites else 0
        ratings_count = len(user.ratings) if user.ratings else 0
        
        quiz_profile = None
        latest_quiz = QuizResult.query.filter_by(user_id=user_id)\
            .order_by(QuizResult.created_at.desc()).first()
        if latest_quiz:
            quiz_profile = {
                "name": latest_quiz.profile_name,
                "description": latest_quiz.profile_description,
                "topGenres": json.loads(latest_quiz.top_genres) if latest_quiz.top_genres else [],
                "profileType": latest_quiz.profile_type,
                "takenAt": latest_quiz.created_at.isoformat() if latest_quiz.created_at else None
            }
        
       # In user.py get_user_panel() function, update the return statement:
        return jsonify({
            "success": True,
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "joinDate": user.join_date.strftime("%Y-%m-%d") if user.join_date else None,
            # Move stats to top level
            "watchlist": watchlist_count,
            "watched": history_count,
            "favorites": favorites_count,
            "rated": ratings_count,
            "quiz_profile": quiz_profile
        })
        
    except Exception as e:
        print(f"ERROR in get_user_panel: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@user_bp.route("/ratings", methods=["POST"])
@jwt_required()
def rate_movie():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    data = request.json
    
    # ACCEPT BOTH FORMATS: movieId OR movie_id
    movie_id = data.get("movieId") or data.get("movie_id")
    rating = data.get("rating")

    if not movie_id or rating is None or not (1 <= rating <= 5):
        return jsonify({"success": False, "error": "Invalid movie_id or rating"}), 400

    # Check if user already rated this movie
    existing = UserRating.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if existing:
        existing.rating = rating
        existing.rated_at = datetime.utcnow()
        action = "updated"
    else:
        new_rating = UserRating(
            user_id=user_id,
            movie_id=movie_id,
            rating=rating
        )
        db.session.add(new_rating)
        action = "added"

    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Rating {rating} {action} for movie {movie_id}",
        "user_id": user_id,
        "movie_id": movie_id,
        "rating": rating
    })


@user_bp.route("/ratings", methods=["GET"])
@jwt_required()
def get_user_ratings():
    user_id = int(get_jwt_identity())
    ratings = UserRating.query.filter_by(user_id=user_id).all()
    result = [
        {
            "movieId": r.movie_id,
            "rating": r.rating,
            "movie": {
                "id": r.movie.id,
                "title": r.movie.title,
                "img": r.movie.img,
                "rating": r.movie.rating,
                "year": r.movie.year,
                "genres": r.movie.genres
            }
        }
        for r in ratings
    ]
    return jsonify(result), 200

# GET user's watch history
@user_bp.route("/watch-history/get", methods=["GET"])
@jwt_required()
def get_watch_history():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    history = WatchHistory.query.filter_by(user_id=user_id).order_by(WatchHistory.watched_date.desc()).limit(20).all()
    
    result = [
        {
            "movie_id": h.movie_id,
            "title": h.title,
            "img": h.img,
            "rating": h.rating,
            "year": h.year,
            "watchedDate": h.watched_date.isoformat()
        }
        for h in history
    ]
    return jsonify(result), 200

def get_movie_id_from_request(data):
    """Extract movie_id from request accepting both formats"""
    return data.get("movieId") or data.get("movie_id")

@user_bp.route("/watch-history", methods=["POST"])
@jwt_required()
def add_to_watch_history():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    data = request.json
    
    # ACCEPT BOTH FORMATS
    movie_id = data.get("movieId") or data.get("movie_id")
    title = data.get("title")
    img = data.get("img")
    rating = data.get("rating")
    year = data.get("year")

    if not movie_id:
        return jsonify({"success": False, "msg": "Movie ID is required"}), 400

    # Check if already exists in last 24 hours
    existing = WatchHistory.query.filter_by(
        user_id=user_id, 
        movie_id=movie_id
    ).first()
    
    if existing:
        # Update the existing entry's timestamp
        existing.watched_date = datetime.utcnow()
        message = "Watch history updated"
    else:
        # Add new entry
        new_entry = WatchHistory(
            user_id=user_id,
            movie_id=movie_id,
            title=title,
            img=img,
            rating=rating,
            year=year
        )
        db.session.add(new_entry)
        message = "Added to watch history"
    
    db.session.commit()

    return jsonify({"success": True, "msg": message}), 201



@user_bp.route("/history/<int:movie_id>", methods=["DELETE"])
@jwt_required()
def remove_history(movie_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    
    entry = WatchHistory.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
    return jsonify({"msg": "Removed from history"})




@user_bp.route("/watchlist/toggle", methods=["POST"])
@jwt_required()
def toggle_watchlist():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    data = request.json
    movie_id = get_movie_id_from_request(data)

    if not movie_id:
        return jsonify({"error": "movie_id required"}), 400

    item = Watchlist.query.filter_by(user_id=user_id, movie_id=movie_id).first()

    if item:
        # Remove from watchlist
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": f"Removed {data.get('title')} from watchlist"})
    else:
        # Add to watchlist
        new_item = Watchlist(
            user_id=user_id,
            movie_id=movie_id,
            title=data.get("title"),
            img=data.get("img"),
            rating=data.get("rating"),
            year=data.get("year")
        )
        db.session.add(new_item)
        db.session.commit()
        return jsonify({"message": f"Added {data.get('title')} to watchlist", "watchlist_item": new_item.to_dict()})


# GET user's watchlist
@user_bp.route("/watchlist", methods=["GET"])
@jwt_required()
def get_watchlist():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    watchlist_items = Watchlist.query.filter_by(user_id=user_id).order_by(Watchlist.added_date.desc()).all()
    
    result = [
        {
            "movie_id": w.movie_id,
            "title": w.title,
            "img": w.img,
            "rating": w.rating,
            "year": w.year,
            "added_date": w.added_date.isoformat()
        }
        for w in watchlist_items
    ]
    return jsonify(result), 200

# POST add to watchlist
@user_bp.route("/watchlist/add", methods=["POST"])
@jwt_required()
def add_to_watchlist():
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    data = request.json
    movie_id = get_movie_id_from_request(data)
    title = data.get("title")
    img = data.get("img")
    rating = data.get("rating")
    year = data.get("year")

    if not movie_id:
        return jsonify({"msg": "Movie ID is required"}), 400

    # Prevent duplicates
    existing = Watchlist.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if existing:
        return jsonify({"msg": "Movie already in watchlist"}), 400

    new_item = Watchlist(
        user_id=user_id,
        movie_id=movie_id,
        title=title,
        img=img,
        rating=rating,
        year=year
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify({"msg": "Added to watchlist"}), 201

@user_bp.route("/watchlist/<int:movie_id>/remove", methods=["DELETE"])
@jwt_required()
def remove_from_watchlist(movie_id):
    # movie_id comes from URL now
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)
    
    item = Watchlist.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if not item:
        return jsonify({"success": False, "msg": "Movie not found in watchlist"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True, "msg": "Removed from watchlist"}), 200




@user_bp.route("/watchlist/mark-watched/<int:movie_id>", methods=["POST"])
@jwt_required()
def mark_as_watched(movie_id):
    user_id_str = get_jwt_identity()
    user_id = int(user_id_str)  # Convert to int
    
    
    # Remove from watchlist
    Watchlist.query.filter_by(user_id=user_id, movie_id=movie_id).delete()
    
    # Add to history
    movie = Movie.query.get(movie_id)
    if not movie:
        return jsonify({"msg": "Movie not found"}), 404

    new_history = WatchHistory(
        user_id=user_id,
        movie_id=movie.id,
        title=movie.title,
        img=movie.img,
        rating=movie.rating,
        year=movie.year
    )
    db.session.add(new_history)
    db.session.commit()
    
    return jsonify({"msg": f"Marked {movie.title} as watched"}), 200

# Add to user.py - Clear watchlist endpoint
@user_bp.route("/watchlist/clear", methods=["DELETE"])
@jwt_required()
def clear_watchlist():
    """Clear all items from user's watchlist"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)  # Convert to int
    
        
        # Count before deletion for response
        count = Watchlist.query.filter_by(user_id=user_id).count()
        
        # Delete all watchlist items for this user
        Watchlist.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Cleared {count} items from watchlist",
            "cleared_count": count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

# Add to user.py - Clear watch history endpoint
@user_bp.route("/watch-history/clear", methods=["DELETE"])
@jwt_required()
def clear_watch_history():
    """Clear all watch history for user"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)  # Convert to int
    
        
        count = WatchHistory.query.filter_by(user_id=user_id).count()
        WatchHistory.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Cleared {count} items from watch history",
            "cleared_count": count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

# Add to user.py - Clear ratings endpoint
@user_bp.route("/ratings/clear", methods=["DELETE"])
@jwt_required()
def clear_ratings():
    """Clear all ratings for user"""
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)  # Convert to int
    
        count = UserRating.query.filter_by(user_id=user_id).count()
        UserRating.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Cleared {count} ratings",
            "cleared_count": count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500