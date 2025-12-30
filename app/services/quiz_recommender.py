from flask import current_app
from app.services.recommender import MovieRecommender

def get_quiz_recommendations(params):
    """
    Returns quiz-based movie recommendations based on genres, tags, year range, and user history.
    """
    try:
        # Extract parameters
        genres_param = params.get("genres", "")
        tags_param = params.get("tags", "")
        year_start = params.get("year_start")
        year_end = params.get("year_end")
        user_id = params.get("user_id")
        limit = params.get("limit", 20)

        # Parse genres and tags
        genres = [g.strip().lower() for g in genres_param.split(',') if g.strip()] if genres_param else []
        tags = [t.strip().lower() for t in tags_param.split(',') if t.strip()] if tags_param else []

        # Get movie store and recommender from app context
        store = current_app.config['MOVIE_STORE']
        recommender: MovieRecommender = current_app.config['RECOMMENDER']

        # Start with all movies
        filtered_movies = store.get_all_movies()

        # 1️⃣ Filter by genres
        if genres:
            filtered_movies = [
                m for m in filtered_movies
                if any(g in m.get('genres', '').lower() for g in genres)
            ]

        # 2️⃣ Filter by year range
        if year_start and year_end:
            filtered_movies = [
                m for m in filtered_movies
                if isinstance(m.get('year'), (int, float)) and year_start <= m['year'] <= year_end
            ]

        # 3️⃣ Filter by tags (search across title, plot, keywords, director, cast)
        if tags:
            def matches_tags(movie):
                search_text = ' '.join([
                    str(movie.get('title', '')).lower(),
                    str(movie.get('genres', '')).lower(),
                    str(movie.get('plot', '')).lower(),
                    str(movie.get('keywords', '')).lower(),
                    str(movie.get('director', '')).lower(),
                    ' '.join([c.lower() for c in movie.get('cast', [])]) if isinstance(movie.get('cast', []), list) else str(movie.get('cast', '')).lower()
                ])
                return any(tag in search_text for tag in tags)

            filtered_movies = [m for m in filtered_movies if matches_tags(m)]

        # 4️⃣ Apply fallback if too few movies
        if len(filtered_movies) < 5:
            if user_id:
                hybrid_results = recommender.hybrid_recommendations(
                    user_id=user_id,
                    genre=genres[0] if genres else None,
                    top_n=limit
                )
                filtered_movies = hybrid_results if hybrid_results else filtered_movies
            if len(filtered_movies) < 5:
                if genres:
                    filtered_movies = recommender.get_similar_by_genre(genres[0], limit)
                else:
                    filtered_movies = recommender.get_popular_movies(limit)

        # 5️⃣ Apply diversity (avoid repeating same genres)
        if len(filtered_movies) > 10:
            grouped = {}
            for movie in filtered_movies:
                primary_genre = movie.get('genres', '').split(',')[0].strip() if movie.get('genres') else 'Other'
                grouped.setdefault(primary_genre, []).append(movie)

            filtered_movies = []
            max_per_genre = max(2, limit // max(len(grouped), 1))
            for movies in grouped.values():
                movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
                filtered_movies.extend(movies[:max_per_genre])
            filtered_movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
            filtered_movies = filtered_movies[:limit]

        # 6️⃣ Compute match scores and explanations
        for movie in filtered_movies:
            match_score = 0

            # Genre match
            if genres and movie.get('genres'):
                movie_genres = movie['genres'].lower()
                match_score += sum(3 for g in genres if g in movie_genres)

            # Tag match
            if tags:
                search_text = ' '.join([
                    str(movie.get('title', '')).lower(),
                    str(movie.get('plot', '')).lower(),
                    str(movie.get('keywords', '')).lower()
                ])
                match_score += sum(1 for t in tags if t in search_text)

            # Year match
            if year_start and year_end and 'year' in movie:
                year = movie['year']
                if year_start <= year <= year_end:
                    range_middle = (year_start + year_end) / 2
                    year_diff = abs(year - range_middle)
                    max_diff = max(abs(year_start - range_middle), abs(year_end - range_middle))
                    if max_diff > 0:
                        match_score += (1 - year_diff / max_diff) * 2

            movie['match_score'] = round(match_score, 2)

        # Sort by match score, then rating
        filtered_movies.sort(key=lambda x: (x.get('match_score', 0), x.get('rating', 0)), reverse=True)

        # Add explanation for top 10
        for movie in filtered_movies[:10]:
            explanations = []
            if genres and movie.get('genres'):
                matched_genres = [g for g in genres if g in movie['genres'].lower()]
                if matched_genres:
                    explanations.append(f"Matches your preferred genres: {', '.join(matched_genres[:2])}")
            if tags and any(t in str(movie.get('title', '')).lower() for t in tags):
                matched_tags = [t for t in tags if t in str(movie.get('title', '')).lower()]
                if matched_tags:
                    explanations.append(f"Matches your tags: {', '.join(matched_tags[:2])}")
            if year_start and year_end and 'year' in movie:
                if year_start <= movie['year'] <= year_end:
                    explanations.append(f"From your preferred era ({year_start}-{year_end})")
            movie['explanation'] = ' • '.join(explanations) if explanations else "Recommended based on quiz preferences"

        # Remove internal match_score
        for movie in filtered_movies:
            movie.pop('match_score', None)

        return {
            "success": True,
            "recommendations": filtered_movies[:limit],
            "count": len(filtered_movies[:limit]),
            "quiz_parameters": {
                "genres": genres,
                "tags": tags,
                "year_range": [year_start, year_end] if year_start and year_end else None
            },
            "algorithm": "Quiz-Based Recommendations",
            "diversity_applied": len(filtered_movies) > 1
        }

    except Exception as e:
        # Fallback: popular movies
        recommender = current_app.config['RECOMMENDER']
        fallback = recommender.get_popular_movies(min(limit, 20))
        return {
            "success": False,
            "error": str(e),
            "recommendations": fallback,
            "count": len(fallback),
            "algorithm": "Fallback - Popular Movies"
        }
