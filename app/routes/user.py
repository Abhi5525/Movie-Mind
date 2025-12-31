from flask import Blueprint, request, jsonify, current_app
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.movie import Movie
from app.models.users import UserRating, WatchHistory
from datetime import datetime
from app.models.users import db, User, Watchlist, WatchHistory, Favorite, UserRating



user_bp = Blueprint("user", __name__, url_prefix="/user")
# routes.py

@user_bp.route('/panel', methods=['GET'])
@jwt_required()
def get_user_panel():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    watchlist = [
        {
            "id": item.movie_id,
            "title": item.title,
            "img": item.img
        } for item in user.watchlist
    ]

    history = [
        {
            "id": item.movie_id,
            "title": item.title,
            "img": item.img,
            "watchedDate": item.watched_date.isoformat()
        } for item in user.history
    ]

    favorites = [
        {
            "id": item.movie_id,
            "title": item.title,
            "img": item.img
        } for item in user.favorites
    ]

    ratings = {item.movie_id: item.rating for item in user.ratings}

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "joinDate": user.join_date.strftime("%Y-%m-%d"),
        "watchlist": watchlist,
        "watch_history": history,
        "favorites": favorites,
        "ratings": ratings
    })



@user_bp.route("/rate", methods=["POST"])
@jwt_required()
def rate_movie():
    user_id = get_jwt_identity()  # get current logged-in user
    data = request.json
    movie_id = data.get("movie_id")
    rating = data.get("rating")

    if not movie_id or rating is None or not (1 <= rating <= 5):
        return jsonify({"error": "Invalid movie_id or rating"}), 400

    # Check if user already rated this movie
    existing = UserRating.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if existing:
        existing.rating = rating
        existing.rated_at = datetime.utcnow()
    else:
        new_rating = UserRating(
            user_id=user_id,
            movie_id=movie_id,
            rating=rating
        )
        db.session.add(new_rating)

    db.session.commit()

    # Optional: compute preferred genres after rating
    # You can query top genres based on ratings >= 4, similar to your current logic

    return jsonify({
        "success": True,
        "message": f"Rating {rating} saved for movie {movie_id}",
        "user_id": user_id,
        "total_ratings": UserRating.query.filter_by(user_id=user_id).count()
    })



# GET user's watch history
@user_bp.route("/watch-history/get", methods=["GET"])
@jwt_required()
def get_watch_history():
    user_id = get_jwt_identity()
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

# POST add to watch history
@user_bp.route("/watch-history", methods=["POST"])
@jwt_required()
def add_to_watch_history():
    user_id = get_jwt_identity()
    data = request.json
    movie_id = data.get("movie_id")
    title = data.get("title")
    img = data.get("img")
    rating = data.get("rating")
    year = data.get("year")

    if not movie_id:
        return jsonify({"msg": "Movie ID is required"}), 400

    # Remove duplicate if exists
    existing = WatchHistory.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()

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
    db.session.commit()

    return jsonify({"msg": "Added to watch history"}), 201


@user_bp.route("/history/<int:movie_id>", methods=["DELETE"])
@jwt_required()
def remove_history(movie_id):
    user_id = get_jwt_identity()
    
    entry = WatchHistory.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
    return jsonify({"msg": "Removed from history"})




@user_bp.route("/watchlist/toggle", methods=["POST"])
@jwt_required()
def toggle_watchlist():
    user_id = get_jwt_identity()
    data = request.json
    movie_id = data.get("movie_id")

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
    user_id = get_jwt_identity()
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
    user_id = get_jwt_identity()
    data = request.json
    movie_id = data.get("movie_id")
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


# DELETE remove from watchlist
@user_bp.route("/watchlist/<int:movie_id>/remove", methods=["DELETE"])
@jwt_required()
def remove_from_watchlist(movie_id):
    user_id = get_jwt_identity()
    item = Watchlist.query.filter_by(user_id=user_id, movie_id=movie_id).first()
    if not item:
        return jsonify({"msg": "Movie not found in watchlist"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"msg": "Removed from watchlist"}), 200






@user_bp.route("/watchlist/mark-watched/<int:movie_id>", methods=["POST"])
@jwt_required()
def mark_as_watched(movie_id):
    user_id = get_jwt_identity()
    
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

