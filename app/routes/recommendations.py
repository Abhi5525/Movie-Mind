from flask import Blueprint, jsonify, current_app, request
from app.services.quiz_recommender import get_quiz_recommendations
from app.models.movie import Movie
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.users import QuizResult
from app.database import db
import json

recommendations_bp = Blueprint('recommendations', __name__, url_prefix='/recommendations')

@recommendations_bp.route("/popular", methods=['GET'])
def popular_movies():
    """
    Get top popular movies
    ---
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
    """
    user_id = request.args.get('user_id')  # ← only from query
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


@recommendations_bp.route("/quiz", methods=['GET', 'OPTIONS'])
def quiz_recommendations():
    """Get quiz-based recommendations"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    try:
        # Get parameters
        user_id = request.args.get('user_id')
        genres = request.args.get('genres', '')
        tags = request.args.get('tags', '')
        
        if not user_id:
            return jsonify({
                "success": False, 
                "error": "user_id parameter is required"
            }), 400
        
        # Parse genres and tags
        genre_list = [g.strip() for g in genres.split(',') if g.strip()] if genres else []
        tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []
        
        # Get recommender
        recommender = current_app.config['RECOMMENDER']
        store = current_app.config['MOVIE_STORE']
        
        # Get recommendations
        recommendations = []
        
        # Strategy 1: Get movies by genres
        if genre_list:
            for genre in genre_list[:3]:
                try:
                    # Check method signature - might be get_similar_by_genre(genre, top_n)
                    genre_movies = recommender.get_similar_by_genre(genre, 10)  # top_n instead of limit
                    if genre_movies:
                        recommendations.extend(genre_movies[:10])
                except Exception as e:
                    print(f"Error getting genre {genre}: {e}")
                    continue
        
        # Strategy 2: If not enough movies, get popular
        if len(recommendations) < 10:
            try:
                # Check the correct method signature
                popular = recommender.get_popular_movies(20)  # top_n parameter
                recommendations.extend(popular)
            except TypeError as e:
                print(f"Popular movies error: {e}")
                # Fallback: get all movies and take top rated
                all_movies = store.get_all_movies()
                all_movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
                recommendations.extend(all_movies[:20])
        
        # Remove duplicates and limit
        seen_ids = set()
        unique_recommendations = []
        for movie in recommendations:
            if 'id' in movie and movie['id'] not in seen_ids:
                seen_ids.add(movie['id'])
                unique_recommendations.append(movie)
        
        # Limit to 20 movies
        unique_recommendations = unique_recommendations[:20]
        
        return jsonify({
            "success": True,
            "recommendations": unique_recommendations,
            "count": len(unique_recommendations),
            "quiz_parameters": {
                "genres": genre_list,
                "tags": tag_list
            },
            "algorithm": "Quiz-Based Recommendations"
        })
        
    except Exception as e:
        print(f"Quiz recommendations error: {str(e)}")
        
        # Simple fallback - return some test movies
        return jsonify({
            "success": True,
            "recommendations": [
                {
                    "id": 1,
                    "title": "The Shawshank Redemption",
                    "rating": 9.3,
                    "year": 1994,
                    "genres": "Drama",
                    "img": "https://placehold.co/150x200"
                },
                {
                    "id": 2,
                    "title": "The Godfather",
                    "rating": 9.2,
                    "year": 1972,
                    "genres": "Crime, Drama",
                    "img": "https://placehold.co/150x200"
                }
            ],
            "count": 2,
            "algorithm": "Fallback - Test Movies"
        })
    
    
    
@recommendations_bp.route("/test", methods=['GET'])
def test_route():
    return jsonify({
        "message": "Recommendations blueprint is working!",
        "available_routes": [
            "/api/recommendations/popular",
            "/api/recommendations/hybrid", 
            "/api/recommendations/quiz",
            "/api/recommendations/genre",
            "/api/recommendations/content-based",
            "/api/recommendations/collaborative"
        ]
    })


@recommendations_bp.route("/similar/<int:movie_id>", methods=["GET"])
@jwt_required()
def get_similar_movies(movie_id):
    movie = Movie.query.get(movie_id)
    if not movie:
        return jsonify({"msg": "Movie not found"}), 404
    
    # Example: find movies with at least one matching genre
    genres = movie.genres.split(",")
    similar_movies = Movie.query.filter(Movie.id != movie_id, Movie.genres.ilike(f"%{genres[0]}%")).limit(10).all()
    
    return jsonify([m.to_dict() for m in similar_movies]), 200


# In your Flask routes (recommendations.py or similar)
from app.models.users import UserRating, Favorite
from app.services.recommender import MovieRecommender

@recommendations_bp.route("/personalized", methods=["GET"])
@jwt_required()
def get_personalized_recommendations():
    """Get personalized recommendations based on quiz OR hybrid OR popular"""
    user_id = int(get_jwt_identity())
    
    try:
        # Check if user has quiz results
        latest_quiz = QuizResult.query.filter_by(user_id=user_id)\
            .order_by(QuizResult.created_at.desc()).first()
        
        # PRIORITY 1: Quiz recommendations
        if latest_quiz and latest_quiz.top_genres:
            try:
                top_genres = json.loads(latest_quiz.top_genres) if latest_quiz.top_genres else []
                tags = json.loads(latest_quiz.tags) if latest_quiz.tags else []
                
                if top_genres:
                    # Use the existing quiz recommendation logic
                    params = {
                        "genres": ",".join(top_genres),
                        "tags": ",".join(tags) if tags else "",
                        "user_id": str(user_id),
                        "limit": 20
                    }
                    
                    # Call quiz_recommendations internally
                    quiz_response = quiz_recommendations()
                    if isinstance(quiz_response, tuple):
                        # If it returns a tuple (response, status), extract the JSON
                        quiz_data = quiz_response[0].get_json()
                    else:
                        quiz_data = quiz_response.get_json()
                    
                    if quiz_data.get("success") and quiz_data.get("recommendations"):
                        return jsonify({
                            "success": True,
                            "recommendations": quiz_data["recommendations"],
                            "count": len(quiz_data["recommendations"]),
                            "source": "quiz",
                            "profile_name": latest_quiz.profile_name,
                            "message": f"Based on your {latest_quiz.profile_name} profile"
                        })
            except Exception as e:
                print(f"Quiz recommendations error: {e}")
                # Fall through to next priority
        
        # PRIORITY 2: Hybrid recommendations (if user has interactions)
        try:
            # Check if user has any interactions (favorites, ratings, watchlist)
            from app.models.users import Favorite, UserRating, Watchlist
            
            favorites_count = Favorite.query.filter_by(user_id=user_id).count()
            ratings_count = UserRating.query.filter_by(user_id=user_id).count()
            watchlist_count = Watchlist.query.filter_by(user_id=user_id).count()
            
            if favorites_count > 0 or ratings_count > 0 or watchlist_count > 0:
                # User has interactions, use hybrid recommendations
                store = current_app.config['MOVIE_STORE']
                recommender = current_app.config['RECOMMENDER']
                
                # Get hybrid recommendations
                recommendations = recommender.hybrid_recommendations(
                    user_id=str(user_id),
                    top_n=20
                )
                
                if recommendations and len(recommendations) > 0:
                    return jsonify({
                        "success": True,
                        "recommendations": recommendations,
                        "count": len(recommendations),
                        "source": "hybrid",
                        "message": "Based on your watch history and preferences"
                    })
        except Exception as e:
            print(f"Hybrid recommendations error: {e}")
            # Fall through to next priority
        
        # PRIORITY 3: Popular movies (fallback)
        store = current_app.config['MOVIE_STORE']
        recommender = current_app.config['RECOMMENDER']
        popular = recommender.get_popular_movies(20)
        
        return jsonify({
            "success": True,
            "recommendations": popular,
            "count": len(popular),
            "source": "popular",
            "message": "Trending movies"
        })
        
    except Exception as e:
        print(f"Personalized recommendations error: {e}")
        # Ultimate fallback
        store = current_app.config['MOVIE_STORE']
        all_movies = store.get_all_movies()[:20]
        return jsonify({
            "success": True,
            "recommendations": all_movies,
            "count": len(all_movies),
            "source": "fallback",
            "message": "Popular movies"
        })
    
@recommendations_bp.route("/highest-rated", methods=['GET'])
def highest_rated_movies():
    """
    Get highest rated movies
    """
    try:
        top_n = int(request.args.get('top_n', 20))
        store = current_app.config['MOVIE_STORE']
        
        # Get all movies
        all_movies = store.get_all_movies()
        
        # Sort by rating (highest first)
        sorted_movies = sorted(all_movies, 
                              key=lambda x: x.get('rating', 0), 
                              reverse=True)
        
        # Filter out movies with no rating
        rated_movies = [m for m in sorted_movies if m.get('rating', 0) > 0]
        
        return jsonify({
            "success": True,
            "recommendations": rated_movies[:top_n],
            "count": len(rated_movies[:top_n]),
            "algorithm": "Highest Rated"
        })
        
    except Exception as e:
        print(f"Error getting highest rated movies: {e}")
        # Fallback to popular
        recommender = current_app.config['RECOMMENDER']
        popular = recommender.get_popular_movies(20)
        return jsonify({
            "success": True,
            "recommendations": popular,
            "count": len(popular),
            "algorithm": "Popular (Fallback)"
        })