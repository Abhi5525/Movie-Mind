from flask import Blueprint, request, jsonify, current_app

user_bp = Blueprint("user", __name__, url_prefix="/user")


@user_bp.route("/<user_id>/rate", methods=["POST"])
def rate_movie(user_id):
    """
    Endpoint for a user to rate a movie.
    ---
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
        description: ID of the user
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            movie_id:
              type: string
            rating:
              type: integer
              minimum: 1
              maximum: 5
    tags:
      - User
    responses:
      200:
        description: Rating saved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            message:
              type: string
            user_id:
              type: string
            total_ratings:
              type: integer
      400:
        description: Invalid input
      500:
        description: Server error
    """
    try:
        data = request.get_json(silent=True) or request.form or {}

        movie_id = data.get("movie_id")
        rating = data.get("rating")
        
        if not movie_id or rating is None:
            return jsonify({"error": "movie_id and rating are required"}), 400
        if rating < 1 or rating > 5:
            return jsonify({"error": "rating must be between 1 and 5"}), 400

        # Access global user interactions (or move to a service if preferred)
        user_interactions = current_app.config.get("USER_INTERACTIONS", {})

        # Initialize user data if not exists
        if user_id not in user_interactions:
            user_interactions[user_id] = {
                "rated_movies": {},
                "watch_history": [],
                "preferred_genres": []
            }
        
        # Add rating
        user_interactions[user_id]["rated_movies"][str(movie_id)] = rating

        # Update preferred genres if user has rated >= 3 movies
        if len(user_interactions[user_id]["rated_movies"]) >= 3:
            genre_counts = {}
            store = current_app.config['MOVIE_STORE']
            for mid, r in user_interactions[user_id]["rated_movies"].items():
                if r >= 4:
                    movie = store.get_movie_by_id(mid)
                    if movie and movie.get("genres"):
                        for genre in movie["genres"].split(","):
                            genre_counts[genre.strip()] = genre_counts.get(genre.strip(), 0) + 1
            
            top_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            user_interactions[user_id]["preferred_genres"] = [g[0] for g in top_genres]

        # Save back to app config (if needed)
        current_app.config["USER_INTERACTIONS"] = user_interactions

        return jsonify({
            "success": True,
            "message": f"Rating {rating} saved for movie {movie_id}",
            "user_id": user_id,
            "total_ratings": len(user_interactions[user_id]["rated_movies"])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@user_bp.route("/<user_id>/history", methods=["GET"])
def get_user_history(user_id):
    """
    Returns user ratings, watch history, and preferred genres.
    ---
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
        description: ID of the user
    tags:
      - User
    responses:
      200:
        description: User history retrieved successfully
        schema:
          type: object
          properties:
            user_id:
              type: string
            rated_movies:
              type: array
              items:
                type: object
            watch_history:
              type: array
              items:
                type: string
            preferred_genres:
              type: array
              items:
                type: string
            total_ratings:
              type: integer
      404:
        description: User not found
      500:
        description: Server error
    """
    user_interactions = current_app.config.get("USER_INTERACTIONS", {})

    if user_id not in user_interactions:
        return jsonify({
            "user_id": user_id,
            "rated_movies": [],
            "watch_history": [],
            "preferred_genres": [],
            "total_ratings": 0
        })

    user_data = user_interactions[user_id]

    # Get movie details for rated movies
    rated_movies_details = []
    store = current_app.config["MOVIE_STORE"]
    for movie_id, rating in user_data.get("rated_movies", {}).items():
        movie = store.get_movie_by_id(movie_id)
        if movie:
            rated_movies_details.append({
                **movie,
                "user_rating": rating
            })

    return jsonify({
        "user_id": user_id,
        "rated_movies": rated_movies_details,
        "watch_history": user_data.get("watch_history", []),
        "preferred_genres": user_data.get("preferred_genres", []),
        "total_ratings": len(user_data.get("rated_movies", {}))
    })