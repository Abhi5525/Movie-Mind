from flask import Blueprint, jsonify, request, current_app

search_bp = Blueprint("search", __name__, url_prefix="/search")

def normalize(value):
    if isinstance(value, list):
        return " ".join(map(str, value))
    return str(value or "")


@search_bp.route("/", methods=["GET"])
def search_movies():
    """
    Search movies by title, genres, director, cast, plot, keywords.
    Supports simple relevance scoring.
    ---
    parameters:
      - name: query
        in: query
        type: string
        required: true
        description: Text to search in movies
      - name: limit
        in: query
        type: integer
        required: false
        description: Maximum number of results to return (default 20)
    tags:
      - Search
    responses:
      200:
        description: Search results
        schema:
          type: object
          properties:
            results:
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
            count:
              type: integer
            query:
              type: string
      400:
        description: Bad request, query missing
      500:
        description: Internal server error
    """
    query = request.args.get("query", "")
    limit = request.args.get("limit", 20, type=int)

    if not query:
        return jsonify({
            "results": [],
            "count": 0,
            "query": ""
        })

    store = current_app.config["MOVIE_STORE"]
    movies = store.get_all_movies()

    results = []
    query_lower = query.lower()

    for movie in movies:
        search_text = " ".join([
            normalize(movie.get("title")),
            normalize(movie.get("genres")),
            normalize(movie.get("director")),
            normalize(movie.get("cast")),
            normalize(movie.get("plot")),
            normalize(movie.get("keywords")),
        ]).lower()

        if query_lower in search_text:
            results.append(movie)
        
    def relevance_score(movie):
        score = 0

        title = normalize(movie.get("title")).lower()
        genres = normalize(movie.get("genres")).lower()
        director = normalize(movie.get("director")).lower()
        plot = normalize(movie.get("plot")).lower()
        cast = normalize(movie.get("cast")).lower()
        keywords = normalize(movie.get("keywords")).lower()

        if query_lower in title:
            score += 15
        if query_lower in genres:
            score += 8
        if query_lower in keywords:
            score += 6
        if query_lower in cast:
            score += 5
        if query_lower in director:
            score += 4
        if query_lower in plot:
            score += 2

        return score
    
    
    results.sort(key=relevance_score, reverse=True)

    return jsonify({
        "results": results[:limit],
        "count": len(results[:limit]),
        "query": query
    })


    

