from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class MovieRecommender:
    def __init__(self, movies, user_interactions=None):
        self.movies = movies
        self.user_movie_interactions = user_interactions or {}
        self.tfidf_matrix = None
        self.tfid_vectorizer = None
        self._create_tfidf_matrix()


    def _create_tfidf_matrix(self):
        """Build TF-IDF matrix for content-based filtering"""

        try:
            movie_texts = []
            for movie in self.movies:
                text = ' '.join([
                    str(movie.get('title', '')),
                    str(movie.get('genres', '')),
                    str(movie.get('director', '')),
                    str(movie.get('cast', '')),
                    str(movie.get('plot', '')),
                    str(movie.get('keywords', ''))
                ])

                movie_texts.append(text)
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(movie_texts)

            print("TF-IDF matrix built successfully.")

        except Exception as e:
            print(f"Error building TF-IDF matrix: {e}")

    def get_similar_movies(self, movie_title, top_n=10):
        """content-based filtering to get similar movies"""

        try:
            movie_idx = next((index for (index, d) in enumerate(self.movies) if d["title"].lower() == movie_title.lower()), None)
            if movie_idx is None:
                return self.get_popular_movies(top_n)

            cosine_similarities = cosine_similarity(self.tfidf_matrix[movie_idx], self.tfidf_matrix).flatten()
            similar_indices = cosine_similarities.argsort()[-top_n-1:-1][::-1]

            recommended_movies = [self.movies[i] for i in similar_indices if i < len(self.movies)]
            return recommended_movies
        
        except:
            return self.get_popular_movies(top_n)


    def get_similar_by_genre(self, genre, top_n=10):
        """Get movies similar by genre"""
        try:
            genre_movies = [movie for movie in self.movies if genre.lower() in movie.get('genres', '').lower()]
            genre_movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
            return genre_movies[:top_n]
        except:
            return self.get_popular_movies(top_n)

    def get_popular_movies(self, top_n=10):
        """Get top N popular movies based on rating"""
        try:
            popular_movies = self.movies.copy()
            popular_movies.sort(key=lambda x: x.get('rating', 0) * 0.7 + x.get('popularity', 0), reverse=True)
            return popular_movies[:min(top_n, len(popular_movies))]
        except:
            return self.movies[:top_n]
        
    def collaborative_recommendations(self, user_id, top_n=10):
        """Collaborative filtering to get movie recommendations based on user interactions"""
        try:
            user_data = self.user_movie_interactions.get(user_id, {})
            current_ratings = user_data.get("rated_movies", {})
            if not current_ratings:
                return self.get_popular_movies(top_n)
            
            similar_user = []
            for other_id, other_data in self.user_movie_interactions.items():
                if other_id == user_id:
                    continue
                other_ratings = other_data.get("rated_movies", {})
                common_movies = set(current_ratings.keys()) &(set(other_ratings.keys()))
                if len(common_movies) > 2:
                    similarity = sum(1 for movie in common_movies if abs(current_ratings[movie] - other_ratings[movie]) <= 1)/len(common_movies)
                    if similarity > 0.5:
                        similar_user.append((other_id, similarity))
                
            recommendations = {}
            for other_id, similarity in similar_user[:5]:
                for movie_id, rating in self.user_movie_interactions[other_id].get("rated_movies", {}).items():
                    if rating >= 4 and movie_id not in current_ratings:
                        recommendations.setdefault(movie_id, {'score':0, 'ratings':rating})
                        recommendations[movie_id]['score'] += similarity 

            recommended_movies = []
            for movie_id, data in recommendations.items():
                movie = self.get_movie_by_id(movie_id)
               
                if movie:
                    recommended_movies.append((movie))
            return recommended_movies[:top_n]
        except:
            print("Error in collaborative recommendation")
            return self.get_popular_movies(top_n)

    def hybrid_recommendations(self, user_id=None, movie_title=None, genre=None, top_n=20):
        """Hybrid recommendation combining content-based and collaborative filtering"""
        try:
            recommendations = []
            if genre:
                recommendations.extend(self.get_similar_by_genre(genre, top_n=top_n//2))

            if movie_title:
                recommendations.extend(self.get_similar_movies(movie_title, top_n=top_n//2))
            if user_id:
                recommendations.extend(self.collaborative_recommend(user_id, top_n=top_n//2))

            if len(recommendations) < top_n:
                recommendations.extend(self.get_popular_movies(top_n - len(recommendations)))

            unique_movies = {m['id']: m for m in recommendations}
            return list(unique_movies.values())[:top_n]
        except:
            return self.get_popular_movies(top_n)
        
    def get_movie_by_id(self, movie_id):
        for movie in self.movies:
            if movie['id'] == movie_id:
                return movie
        return None