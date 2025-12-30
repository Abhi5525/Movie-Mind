from flask import Blueprint, jsonify, current_app, request
from app.services.quiz_recommender import get_quiz_recommendations

# Blueprints
movies_bp = Blueprint('movies', __name__, url_prefix='/movies')
recommendations_bp = Blueprint('recommendations', __name__, url_prefix='/recommendations')


# ===== MOVIE ROUTES =====
@movies_bp.route("/", methods=['GET'])
def get_all_movies():
    """
    Return all movies with pagination
    ---
    parameters:
      - name: limit
        in: query
        type: integer
        required: false
        description: Number of movies per page (default 50)
      - name: page
        in: query
        type: integer
        required: false
        description: Page number (default 1)
    tags:
      - Movies
    responses:
      200:
        description: List of movies with pagination info
        schema:
          type: object
          properties:
            success:
              type: boolean
            movies:
              type: array
              items:
                type: object
                properties:
                  title:
                    type: string
                  genres:
                    type: string
                  director:
                    type: string
                  cast:
                    type: array
                    items:
                      type: string
                  plot:
                    type: string
                  keywords:
                    type: string
            total:
              type: integer
            page:
              type: integer
            limit:
              type: integer
      500:
        description: Server error
    """
    store = current_app.config['MOVIE_STORE']
    movies = store.get_all_movies()

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
    ---
    parameters:
      - name: movie_id
        in: path
        type: integer
        required: true
        description: ID of the movie to retrieve
    tags:
      - Movies
    responses:
      200:
        description: Movie details retrieved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
            movie:
              type: object
              properties:
                title:
                  type: string
                genres:
                  type: string
                director:
                  type: string
                cast:
                  type: array
                  items:
                    type: string
                plot:
                  type: string
                keywords:
                  type: string
      404:
        description: Movie not found
      500:
        description: Server error
    """
    store = current_app.config['MOVIE_STORE']
    movie = store.get_movie_by_id(movie_id)
    if not movie:
        return jsonify({"success": False, "error": "Movie not found"}), 404
    return jsonify({"success": True, "movie": movie})


# ===== RECOMMENDATION ROUTES =====


@recommendations_bp.route("/popular", methods=['GET'])
def popular_movies():
    """
    Get top popular movies
    ---
    parameters:
      - name: top_n
        in: query
        type: integer
        required: false
        description: Number of top movies to return (default 10)
    tags:
      - Movies
    responses:
      200:
        description: Top popular movies
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
            algorithm:
              type: string
      500:
        description: Server error
    """
    recommender = current_app.config['RECOMMENDER']
    top_n = int(request.args.get('top_n', 10))
    recommendations = recommender.get_popular_movies(top_n)
    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": "Popularity-Based"
    })


@recommendations_bp.route("/content-based", methods=['GET'])
def content_based_movies():
    """
    Content-based recommendations by movie title
    ---
    parameters:
      - name: movie_title
        in: query
        type: string
        required: true
        description: Movie title to find similar movies
      - name: top_n
        in: query
        type: integer
        required: false
        description: Number of recommendations to return (default 10)
    tags:
      - Movies
    responses:
      200:
        description: List of content-based recommendations
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
            algorithm:
              type: string
      400:
        description: Bad request, movie_title missing
      500:
        description: Server error
    """
    movie_title = request.args.get('movie_title')
    if not movie_title:
        return jsonify({"success": False, "error": "movie_title parameter is required"}), 400

    top_n = int(request.args.get('top_n', 10))
    recommender = current_app.config['RECOMMENDER']
    recommendations = recommender.get_similar_movies(movie_title, top_n)

    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": f"Content-Based (Similar to '{movie_title}')"
    })


@recommendations_bp.route("/collaborative", methods=['GET'])
def collaborative_recommendations():
    """
    Collaborative filtering recommendations for a user
    ---
    parameters:
      - name: user_id
        in: query
        type: string
        required: true
        description: User ID to generate recommendations
      - name: top_n
        in: query
        type: integer
        required: false
        description: Number of recommendations to return (default 10)
    tags:
      - Movies
    responses:
      200:
        description: List of collaborative recommendations
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
            algorithm:
              type: string
            user_id:
              type: string
      400:
        description: Bad request, user_id missing
      500:
        description: Server error
    """
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "error": "user_id parameter is required", "recommendations": []}), 400

    top_n = int(request.args.get('top_n', 10))
    recommender = current_app.config['RECOMMENDER']
    recommendations = recommender.collaborative_filtering(user_id, top_n)

    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": "Collaborative Filtering",
        "user_id": user_id
    })


@recommendations_bp.route("/hybrid", methods=['GET'])
def hybrid_recommendations_route():
    """
    Hybrid recommendations combining multiple algorithms
    ---
    parameters:
      - name: user_id
        in: query
        type: string
        required: false
        description: User ID for user-based recommendations
      - name: movie_title
        in: query
        type: string
        required: false
        description: Movie title for content-based recommendations
      - name: genre
        in: query
        type: string
        required: false
        description: Genre-based recommendations
      - name: top_n
        in: query
        type: integer
        required: false
        description: Number of recommendations to return (default 20)
    tags:
      - Movies
    responses:
      200:
        description: List of hybrid recommendations
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
            algorithm:
              type: string
      400:
        description: Bad request, at least one parameter required
      500:
        description: Server error
    """
    user_id = request.args.get('user_id')
    movie_title = request.args.get('movie_title')
    genre = request.args.get('genre')

    if not (user_id or movie_title or genre):
        return jsonify({"success": False, "error": "At least one of user_id, movie_title, or genre parameter is required"}), 400

    top_n = int(request.args.get('top_n', 20))
    recommender = current_app.config['RECOMMENDER']
    recommendations = recommender.hybrid_recommendations(
        user_id=user_id,
        movie_title=movie_title,
        genre=genre,
        top_n=top_n
    )

    algorithm_parts = []
    if user_id:
        algorithm_parts.append("User-based")
    if movie_title:
        algorithm_parts.append(f"Similar to '{movie_title}'")
    if genre:
        algorithm_parts.append(f"Genre: '{genre}'")
    
    algorithm = "Hybrid (" + " + ".join(algorithm_parts) + ")" if algorithm_parts else "Hybrid"

    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": algorithm
    })


@recommendations_bp.route("/genre", methods=['GET'])
def genre_based_recommendations():
    """
    Get top movies for a specific genre
    ---
    parameters:
      - name: genre
        in: query
        type: string
        required: true
        description: Genre to get top movies for
      - name: top_n
        in: query
        type: integer
        required: false
        description: Number of top movies to return (default 10)
    tags:
      - Movies
    responses:
      200:
        description: List of genre-based recommendations
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
            algorithm:
              type: string
      400:
        description: Bad request, genre missing
      500:
        description: Server error
    """
    genre = request.args.get('genre')
    if not genre:
        return jsonify({"success": False, "error": "genre parameter is required"}), 400

    top_n = int(request.args.get('top_n', 10))
    recommender = current_app.config['RECOMMENDER']
    recommendations = recommender.get_similar_by_genre(genre, top_n)

    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": f"Content-Based (Genre: '{genre}')"
    })


@recommendations_bp.route("/quiz", methods=['GET'])
def quiz_recommendations():
    """
    Get quiz-based movie recommendations based on genres, tags, year, and user preferences
    ---
    parameters:
      - name: genres
        in: query
        type: string
        required: false
        description: Comma-separated genres
      - name: tags
        in: query
        type: string
        required: false
        description: Comma-separated tags
      - name: year_start
        in: query
        type: integer
        required: false
        description: Start year for filtering
      - name: year_end
        in: query
        type: integer
        required: false
        description: End year for filtering
      - name: user_id
        in: query
        type: string
        required: false
        description: User ID for personalized recommendations
      - name: limit
        in: query
        type: integer
        required: false
        description: Maximum number of recommendations (default 20)
    tags:
      - Movies
    responses:
      200:
        description: Quiz-based recommendations
        schema:
          type: object
          properties:
            success:
              type: boolean
            recommendations:
              type: array
              items:
                type: object
            count:
              type: integer
      500:
        description: Server error
    """
    params = {
        "genres": request.args.get('genres', ''),
        "tags": request.args.get('tags', ''),
        "year_start": request.args.get('year_start', type=int),
        "year_end": request.args.get('year_end', type=int),
        "user_id": request.args.get('user_id'),
        "limit": request.args.get('limit', 20, type=int)
    }

    recommendations_data = get_quiz_recommendations(params)
    return jsonify(recommendations_data)




@movies_bp.route("/analyze", methods=["GET"])
def analyze_movies():
    """
    Analyze movie database statistics: genres, years, ratings, directors
    ---
    tags:
      - Movies
    responses:
      200:
        description: Statistics of the movie database
        schema:
          type: object
          properties:
            total_movies:
              type: integer
            unique_genres:
              type: integer
            top_genres:
              type: object
            year_range:
              type: array
              items:
                type: integer
            average_year:
              type: integer
            average_rating:
              type: number
            top_directors:
              type: object
            algorithm_info:
              type: object
              properties:
                type:
                  type: string
                content_weight:
                  type: number
                collaborative_weight:
                  type: number
                similarity_metric:
                  type: string
      500:
        description: Server error
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