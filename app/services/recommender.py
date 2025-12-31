import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logging.basicConfig(level=logging.INFO)


class MovieRecommender:
    def __init__(self, movies, user_interactions=None):
        self.movies = movies
        self.user_movie_interactions = user_interactions or {}
        self.tfidf_matrix = None
        self.tfidf_vectorizer = None
        self._tfidf_built = False

    # ===== Helper Functions =====
    def _normalize_text(self, text):
        return str(text or "").lower().strip()

    def _movie_to_text(self, movie):
        return " ".join([
            self._normalize_text(movie.get("title")),
            self._normalize_text(movie.get("genres")),
            self._normalize_text(movie.get("director")),
            self._normalize_text(movie.get("cast")),
            self._normalize_text(movie.get("plot")),
            self._normalize_text(movie.get("keywords"))
        ])

    def _ensure_tfidf_matrix(self):
        """Build TF-IDF matrix only once"""
        if self._tfidf_built:
            return
        try:
            movie_texts = [self._movie_to_text(m) for m in self.movies]
            self.tfidf_vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(movie_texts)
            self._tfidf_built = True
            logging.info("TF-IDF matrix built successfully.")
        except Exception as e:
            logging.error("Error building TF-IDF matrix", exc_info=True)

    # ===== Movie Retrieval =====
    def get_movie_by_id(self, movie_id):
        return next((m for m in self.movies if m["id"] == movie_id), None)

    # ===== Content-Based Recommendations =====
    def get_similar_movies(self, movie_title, top_n=10):
        try:
            self._ensure_tfidf_matrix()
            movie_idx = next((i for i, m in enumerate(self.movies)
                              if self._normalize_text(m["title"]) == self._normalize_text(movie_title)), None)
            if movie_idx is None:
                return self.get_popular_movies(top_n)

            cosine_similarities = cosine_similarity(self.tfidf_matrix[movie_idx], self.tfidf_matrix).flatten()
            similar_indices = [i for i in cosine_similarities.argsort()[::-1] if i != movie_idx][:top_n]
            return [self.movies[i] for i in similar_indices]

        except Exception as e:
            logging.error(f"Error in content-based recommendation for '{movie_title}'", exc_info=True)
            return self.get_popular_movies(top_n)

    def get_similar_by_genre(self, genre, top_n=10):
        try:
            genre_lower = self._normalize_text(genre)
            genre_movies = [m for m in self.movies if genre_lower in self._normalize_text(m.get("genres"))]
            genre_movies.sort(key=lambda x: x.get("rating", 0), reverse=True)
            return genre_movies[:top_n]
        except Exception as e:
            logging.error(f"Error in genre-based recommendation for '{genre}'", exc_info=True)
            return self.get_popular_movies(top_n)

    # ===== Popular Movies =====
    def get_popular_movies(self, top_n=10, rating_weight=0.7, popularity_weight=0.3):
        try:
            popular_movies = self.movies.copy()
            popular_movies.sort(key=lambda x: x.get("rating", 0) * rating_weight + x.get("popularity", 0) * popularity_weight,
                                reverse=True)
            return popular_movies[:min(top_n, len(popular_movies))]
        except Exception as e:
            logging.error("Error fetching popular movies", exc_info=True)
            return self.movies[:top_n]

    # ===== Collaborative Filtering =====
    def collaborative_recommendations(self, user_id, top_n=10, min_common=2, similarity_threshold=0.5):
        try:
            current_ratings = self.user_movie_interactions.get(user_id, {}).get("rated_movies", {})
            if not current_ratings:
                return self.get_popular_movies(top_n)

            similar_users = []
            for other_id, other_data in self.user_movie_interactions.items():
                if other_id == user_id:
                    continue
                other_ratings = other_data.get("rated_movies", {})
                common_movies = set(current_ratings.keys()) & set(other_ratings.keys())
                if len(common_movies) > min_common:
                    similarity = sum(1 for m in common_movies if abs(current_ratings[m] - other_ratings[m]) <= 1) / len(common_movies)
                    if similarity > similarity_threshold:
                        similar_users.append((other_id, similarity))

            recommendations = {}
            for other_id, similarity in similar_users[:5]:
                for movie_id, rating in self.user_movie_interactions[other_id].get("rated_movies", {}).items():
                    if rating >= 4 and movie_id not in current_ratings:
                        recommendations.setdefault(movie_id, {"score": 0, "ratings": rating})
                        recommendations[movie_id]["score"] += similarity

            recommended_movies = [self.get_movie_by_id(mid) for mid in recommendations.keys() if self.get_movie_by_id(mid)]
            # Optional: sort by score
            recommended_movies.sort(key=lambda m: recommendations[m["id"]]["score"], reverse=True)
            return recommended_movies[:top_n]

        except Exception as e:
            logging.error(f"Error in collaborative recommendations for user {user_id}", exc_info=True)
            return self.get_popular_movies(top_n)

    # ===== Hybrid Recommendations =====
    def hybrid_recommendations(self, user_id=None, movie_title=None, genre=None, top_n=20):
        try:
            recommendations = []

            # Split top_n fairly among available sources
            sources = [s for s in [user_id, movie_title, genre] if s]
            split_n = max(top_n // len(sources), 1) if sources else top_n

            if genre:
                recommendations.extend(self.get_similar_by_genre(genre, split_n))
            if movie_title:
                recommendations.extend(self.get_similar_movies(movie_title, split_n))
            if user_id:
                recommendations.extend(self.collaborative_recommendations(user_id, split_n))

            # Fill remaining slots with popular movies
            if len(recommendations) < top_n:
                recommendations.extend(self.get_popular_movies(top_n - len(recommendations)))

            # Remove duplicates
            unique_movies = {m["id"]: m for m in recommendations}
            return list(unique_movies.values())[:top_n]

        except Exception as e:
            logging.error("Error in hybrid recommendations", exc_info=True)
            return self.get_popular_movies(top_n)
