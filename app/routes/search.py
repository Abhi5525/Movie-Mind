from flask import Blueprint, jsonify, request, current_app

search_bp = Blueprint("search", __name__, url_prefix="/search")

def normalize(value):
    if isinstance(value, list):
        return " ".join(map(str, value))
    return str(value or "")

@search_bp.route("/", methods=["GET"])
def search_movies():
    query = request.args.get("query", "").strip()
    limit = request.args.get("limit", 20, type=int)

    if not query:
        return jsonify({"results": [], "count": 0, "query": ""})

    store = current_app.config.get("MOVIE_STORE")
    if not store:
        return jsonify({"results": [], "count": 0, "query": query})

    movies = store.get_all_movies()
    query_lower = query.lower()

    results = []
    for movie in movies:
        search_text = " ".join([
            normalize(movie.get(field)) for field in 
            ["title", "genres", "director", "cast", "plot", "keywords"]
        ]).lower()
        if query_lower in search_text:
            results.append(movie)

    def relevance_score(movie):
        score_map = {"title": 15, "genres": 8, "keywords": 6, "cast": 5, "director": 4, "plot": 2}
        score = 0
        for field, weight in score_map.items():
            if query_lower in normalize(movie.get(field)).lower():
                score += weight
        return score

    # Compute scores once
    scored = [(movie, relevance_score(movie)) for movie in results]
    scored.sort(key=lambda x: x[1], reverse=True)
    results_sorted = [movie for movie, _ in scored]

    return jsonify({
        "results": results_sorted[:limit],
        "count": len(results_sorted[:limit]),
        "query": query
    })
