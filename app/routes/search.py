from flask import Blueprint, jsonify, request, current_app
import re
from datetime import datetime

search_bp = Blueprint("search", __name__, url_prefix="/search")

def normalize(value):
    """Normalize value for search"""
    if isinstance(value, list):
        return " ".join(map(str, value))
    return str(value or "").lower()

def clean_query(query):
    """Clean and prepare search query"""
    # Remove extra spaces and special characters
    query = re.sub(r'[^\w\s]', ' ', query)
    # Remove extra spaces
    query = ' '.join(query.split())
    return query.lower().strip()
@search_bp.route("/", methods=["GET"])
def search_movies():
    """Enhanced movie search with exact title matching priority"""
    start_time = datetime.now()
    
    query = request.args.get("query", "").strip()
    limit = request.args.get("limit", 30, type=int)
    exact_match = request.args.get("exact", "true").lower() == "true"

    if not query or len(query) < 2:
        return jsonify({
            "results": [],
            "count": 0,
            "query": query,
            "message": "Please enter at least 2 characters"
        })

    store = current_app.config.get("MOVIE_STORE")
    if not store:
        return jsonify({
            "results": [],
            "count": 0,
            "query": query,
            "error": "Movie store not available"
        })

    # Prepare query
    query_cleaned = clean_query(query)
    query_lower = query_cleaned.lower()
    query_parts = query_lower.split()
    
    movies = store.get_all_movies()
    
    # STRATEGY 1: EXACT TITLE MATCHES (HIGHEST PRIORITY)
    exact_title_matches = []
    for movie in movies:
        title = normalize(movie.get("title", "")).lower()
        # Exact match (case-insensitive)
        if title == query_lower:
            exact_title_matches.append((movie, 100))  # Highest score
        # Contains exact phrase
        elif query_lower in title:
            exact_title_matches.append((movie, 90))  # Very high score
        # Title starts with query
        elif title.startswith(query_lower):
            exact_title_matches.append((movie, 85))
    
    # If we have exact title matches and exact_match is True, return only those
    if exact_match and exact_title_matches:
        exact_title_matches.sort(key=lambda x: x[1], reverse=True)
        results = [movie for movie, score in exact_title_matches[:limit]]
        
        search_time = (datetime.now() - start_time).total_seconds()
        return jsonify({
            "success": True,
            "results": results,
            "count": len(results),
            "query": query,
            "search_time": round(search_time, 3),
            "search_type": "exact_title",
            "message": f"Found {len(results)} exact title match{'es' if len(results) != 1 else ''}"
        })
    
    # STRATEGY 2: RELEVANT MATCHES (if no exact title matches or exact_match is False)
    scored_movies = []
    for movie in movies:
        score = calculate_relevance_score(movie, query_parts, query_lower)
        if score > 0:  # Only include movies with some relevance
            scored_movies.append((movie, score))
    
    # Sort by score (highest first), then by rating
    scored_movies.sort(key=lambda x: (x[1], x[0].get("rating", 0)), reverse=True)
    
    # Filter to get meaningful results
    meaningful_matches = []
    for movie, score in scored_movies:
        # Only include if score is significant
        if score >= 5:  # Minimum relevance threshold
            movie_copy = movie.copy()
            movie_copy["relevance_score"] = round(score, 2)
            meaningful_matches.append(movie_copy)
    
    # Limit results
    results = meaningful_matches[:limit]
    
    # Calculate search stats
    search_time = (datetime.now() - start_time).total_seconds()
    
    return jsonify({
        "success": True,
        "results": results,
        "count": len(results),
        "query": query,
        "search_time": round(search_time, 3),
        "search_type": "relevance",
        "stats": {
            "total_scored": len(scored_movies),
            "meaningful_matches": len(meaningful_matches),
            "returned": len(results)
        }
    })

def calculate_relevance_score(movie, query_parts, query_lower):
    """Calculate relevance score with title priority"""
    score = 0
    
    # Check title first (highest weight)
    title = normalize(movie.get("title", "")).lower()
    if title:
        # Exact title match (already handled, but keep for scoring)
        if title == query_lower:
            score += 100
        # Contains query
        elif query_lower in title:
            score += 50
        # Word-by-word matching in title
        else:
            title_words = set(title.split())
            matched_words = sum(1 for part in query_parts if part in title_words)
            if matched_words > 0:
                score += matched_words * 10
    
    # Then check other fields (lower weight)
    if score < 50:  # Only check other fields if title didn't match strongly
        other_weights = {
            "genres": 8,
            "keywords": 6,
            "cast": 5,
            "director": 4,
            "plot": 2
        }
        
        for field, weight in other_weights.items():
            field_value = normalize(movie.get(field, "")).lower()
            if field_value:
                if query_lower in field_value:
                    score += weight
                else:
                    for part in query_parts:
                        if part and part in field_value:
                            score += weight * 0.3
    
    # Rating and popularity bonus (smaller influence)
    rating = movie.get("rating", 0)
    if rating > 7:
        score += 2
    elif rating > 5:
        score += 1
    
    return score
@search_bp.route("/suggest", methods=["GET"])
def search_suggestions():
    """Get search suggestions"""
    query = request.args.get("query", "").strip().lower()
    
    if not query or len(query) < 2:
        return jsonify({"suggestions": []})
    
    store = current_app.config.get("MOVIE_STORE")
    if not store:
        return jsonify({"suggestions": []})
    
    movies = store.get_all_movies()
    
    suggestions = set()
    for movie in movies:
        # Title suggestions
        title = movie.get("title", "").lower()
        if query in title and len(suggestions) < 10:
            suggestions.add(movie.get("title"))
        
        # Genre suggestions
        genres = normalize(movie.get("genres", "")).lower()
        if query in genres:
            for genre in movie.get("genres", "").split(","):
                genre_clean = genre.strip().lower()
                if query in genre_clean and len(suggestions) < 15:
                    suggestions.add(genre.strip())
    
    return jsonify({
        "suggestions": list(suggestions)[:10],
        "query": query
    })