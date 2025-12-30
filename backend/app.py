# ===== FLASK BACKEND WITH QUIZ RECOMMENDATIONS =====

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import pickle
from datetime import datetime
import random

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ===== MOVIE DATABASE =====
movies_db = []
user_movie_interactions = {}  # Store user preferences and ratings

# Load movie data
def load_movie_data():
    global movies_db
    try:
        # Try loading from CSV
        df = pd.read_csv('movies.csv')
        movies_db = df.to_dict('records')
        print(f"Loaded {len(movies_db)} movies from CSV")
    except:
        # Fallback: Create sample movie data
        print("Creating sample movie data...")
        movies_db = [
            {
                "id": 1,
                "title": "Inception",
                "genres": "Action, Sci-Fi, Thriller",
                "rating": 8.8,
                "year": 2010,
                "director": "Christopher Nolan",
                "cast": "Leonardo DiCaprio, Joseph Gordon-Levitt, Ellen Page",
                "plot": "A thief who steals corporate secrets through dream-sharing technology.",
                "keywords": "dream, heist, subconscious, reality",
                "popularity": 9.5
            },
            {
                "id": 2,
                "title": "The Dark Knight",
                "genres": "Action, Crime, Drama",
                "rating": 9.0,
                "year": 2008,
                "director": "Christopher Nolan",
                "cast": "Christian Bale, Heath Ledger, Aaron Eckhart",
                "plot": "Batman faces the Joker, a criminal mastermind.",
                "keywords": "superhero, crime, chaos, batman",
                "popularity": 9.7
            },
            {
                "id": 3,
                "title": "Interstellar",
                "genres": "Adventure, Drama, Sci-Fi",
                "rating": 8.6,
                "year": 2014,
                "director": "Christopher Nolan",
                "cast": "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
                "plot": "A team of explorers travel through a wormhole in space.",
                "keywords": "space, time, wormhole, survival",
                "popularity": 9.2
            },
            {
                "id": 4,
                "title": "The Godfather",
                "genres": "Crime, Drama",
                "rating": 9.2,
                "year": 1972,
                "director": "Francis Ford Coppola",
                "cast": "Marlon Brando, Al Pacino, James Caan",
                "plot": "The aging patriarch of an organized crime dynasty.",
                "keywords": "mafia, family, crime, power",
                "popularity": 9.4
            },
            {
                "id": 5,
                "title": "Pulp Fiction",
                "genres": "Crime, Drama",
                "rating": 8.9,
                "year": 1994,
                "director": "Quentin Tarantino",
                "cast": "John Travolta, Uma Thurman, Samuel L. Jackson",
                "plot": "The lives of two mob hitmen, a boxer, and a pair of diner bandits.",
                "keywords": "crime, nonlinear, violence, dark comedy",
                "popularity": 9.1
            },
            {
                "id": 6,
                "title": "The Shawshank Redemption",
                "genres": "Drama",
                "rating": 9.3,
                "year": 1994,
                "director": "Frank Darabont",
                "cast": "Tim Robbins, Morgan Freeman, Bob Gunton",
                "plot": "Two imprisoned men bond over a number of years.",
                "keywords": "prison, hope, friendship, redemption",
                "popularity": 9.6
            },
            {
                "id": 7,
                "title": "Forrest Gump",
                "genres": "Drama, Romance",
                "rating": 8.8,
                "year": 1994,
                "director": "Robert Zemeckis",
                "cast": "Tom Hanks, Robin Wright, Gary Sinise",
                "plot": "The presidencies of Kennedy and Johnson, Vietnam, Watergate.",
                "keywords": "life, love, war, historical",
                "popularity": 9.0
            },
            {
                "id": 8,
                "title": "The Matrix",
                "genres": "Action, Sci-Fi",
                "rating": 8.7,
                "year": 1999,
                "director": "Lana & Lilly Wachowski",
                "cast": "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss",
                "plot": "A computer hacker learns about the true nature of his reality.",
                "keywords": "virtual reality, simulation, chosen one, action",
                "popularity": 9.3
            },
            {
                "id": 9,
                "title": "Gladiator",
                "genres": "Action, Drama, Adventure",
                "rating": 8.5,
                "year": 2000,
                "director": "Ridley Scott",
                "cast": "Russell Crowe, Joaquin Phoenix, Connie Nielsen",
                "plot": "A former Roman General sets out to exact vengeance.",
                "keywords": "rome, revenge, emperor, colosseum",
                "popularity": 8.9
            },
            {
                "id": 10,
                "title": "The Avengers",
                "genres": "Action, Adventure, Sci-Fi",
                "rating": 8.0,
                "year": 2012,
                "director": "Joss Whedon",
                "cast": "Robert Downey Jr., Chris Evans, Scarlett Johansson",
                "plot": "Earth's mightiest heroes must come together.",
                "keywords": "superhero, team, marvel, action",
                "popularity": 8.8
            },
            {
                "id": 11,
                "title": "La La Land",
                "genres": "Comedy, Drama, Music",
                "rating": 8.0,
                "year": 2016,
                "director": "Damien Chazelle",
                "cast": "Ryan Gosling, Emma Stone, John Legend",
                "plot": "While navigating their careers in Los Angeles, a pianist and an actress fall in love.",
                "keywords": "music, romance, hollywood, jazz",
                "popularity": 8.2
            },
            {
                "id": 12,
                "title": "Parasite",
                "genres": "Comedy, Drama, Thriller",
                "rating": 8.6,
                "year": 2019,
                "director": "Bong Joon Ho",
                "cast": "Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong",
                "plot": "Greed and class discrimination threaten the newly formed symbiotic relationship.",
                "keywords": "class, family, thriller, dark comedy",
                "popularity": 8.7
            },
            {
                "id": 13,
                "title": "Joker",
                "genres": "Crime, Drama, Thriller",
                "rating": 8.4,
                "year": 2019,
                "director": "Todd Phillips",
                "cast": "Joaquin Phoenix, Robert De Niro, Zazie Beetz",
                "plot": "A mentally troubled comedian is disregarded by society.",
                "keywords": "mental illness, crime, origin story, dc",
                "popularity": 8.6
            },
            {
                "id": 14,
                "title": "Spirited Away",
                "genres": "Animation, Adventure, Family",
                "rating": 8.6,
                "year": 2001,
                "director": "Hayao Miyazaki",
                "cast": "Rumi Hiiragi, Miyu Irino, Mari Natsuki",
                "plot": "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods.",
                "keywords": "anime, fantasy, spirits, adventure",
                "popularity": 8.5
            },
            {
                "id": 15,
                "title": "Your Name",
                "genres": "Animation, Drama, Fantasy",
                "rating": 8.4,
                "year": 2016,
                "director": "Makoto Shinkai",
                "cast": "Ryunosuke Kamiki, Mone Kamishiraishi, Ryo Narita",
                "plot": "Two strangers find themselves linked in a bizarre way.",
                "keywords": "anime, romance, body swap, fantasy",
                "popularity": 8.3
            }
        ]
        # Add more sample movies to reach 50
        for i in range(16, 51):
            year = random.randint(1990, 2023)
            rating = round(random.uniform(6.5, 9.0), 1)
            genres_list = [
                ["Action", "Adventure"],
                ["Comedy", "Romance"],
                ["Drama", "Thriller"],
                ["Sci-Fi", "Fantasy"],
                ["Horror", "Mystery"],
                ["Animation", "Family"]
            ]
            genre_pair = random.choice(genres_list)
            
            movies_db.append({
                "id": i,
                "title": f"Sample Movie {i}",
                "genres": ", ".join(genre_pair),
                "rating": rating,
                "year": year,
                "director": f"Director {i}",
                "cast": f"Actor A, Actor B, Actor C",
                "plot": f"This is a sample plot for movie {i} with genres {genre_pair}.",
                "keywords": f"sample, {genre_pair[0].lower()}, {genre_pair[1].lower()}",
                "popularity": round(random.uniform(6.0, 9.0), 1)
            })

load_movie_data()

# ===== RECOMMENDER SYSTEM CLASS =====
class MovieRecommender:
    def __init__(self):
        self.movies = movies_db
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self._build_tfidf_matrix()
    
    def _build_tfidf_matrix(self):
        """Build TF-IDF matrix for content-based filtering"""
        try:
            # Combine text features for each movie
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
            print("TF-IDF matrix built successfully")
        except Exception as e:
            print(f"Error building TF-IDF matrix: {e}")
    
    def get_similar_movies(self, movie_title, top_n=10):
        """Get similar movies using content-based filtering"""
        try:
            # Find the movie index
            movie_idx = None
            for i, movie in enumerate(self.movies):
                if movie['title'].lower() == movie_title.lower():
                    movie_idx = i
                    break
            
            if movie_idx is None:
                return self.get_popular_movies(top_n)
            
            # Calculate cosine similarities
            cosine_sim = cosine_similarity(self.tfidf_matrix[movie_idx], self.tfidf_matrix).flatten()
            
            # Get top N similar movies (excluding itself)
            similar_indices = cosine_sim.argsort()[-(top_n+1):-1][::-1]
            
            similar_movies = []
            for idx in similar_indices:
                if idx < len(self.movies):
                    similar_movies.append(self.movies[idx])
            
            return similar_movies[:top_n]
        except:
            return self.get_popular_movies(top_n)
    
    def get_similar_by_genre(self, genre, top_n=10):
        """Get movies by genre with high ratings"""
        try:
            genre_movies = []
            for movie in self.movies:
                if genre.lower() in movie.get('genres', '').lower():
                    genre_movies.append(movie)
            
            # Sort by rating
            genre_movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
            return genre_movies[:top_n]
        except:
            return self.get_popular_movies(top_n)
    
    def get_popular_movies(self, top_n=20):
        """Get popular movies based on rating and popularity"""
        try:
            popular_movies = self.movies.copy()
            popular_movies.sort(
                key=lambda x: (x.get('rating', 0) * 0.7 + x.get('popularity', 0) * 0.3), 
                reverse=True
            )
            return popular_movies[:top_n]
        except:
            return self.movies[:min(top_n, len(self.movies))]
    
    def collaborative_filtering(self, user_id, top_n=10):
        """Simple collaborative filtering based on user interactions"""
        try:
            user_data = user_movie_interactions.get(user_id, {})
            
            if not user_data.get('rated_movies'):
                return self.get_popular_movies(top_n)
            
            # Find similar users (simplified)
            similar_users = []
            current_ratings = user_data['rated_movies']
            
            for other_id, other_data in user_movie_interactions.items():
                if other_id == user_id:
                    continue
                
                other_ratings = other_data.get('rated_movies', {})
                common_movies = set(current_ratings.keys()) & set(other_ratings.keys())
                
                if len(common_movies) > 2:
                    # Calculate similarity score
                    similarity = sum(
                        1 for movie in common_movies 
                        if abs(current_ratings[movie] - other_ratings[movie]) <= 1
                    ) / len(common_movies)
                    
                    if similarity > 0.5:
                        similar_users.append((other_id, similarity))
            
            # Get recommendations from similar users
            recommendations = {}
            for other_id, similarity in similar_users[:5]:  # Top 5 similar users
                other_data = user_movie_interactions[other_id]
                for movie_id, rating in other_data.get('rated_movies', {}).items():
                    if rating >= 4 and movie_id not in current_ratings:
                        if movie_id not in recommendations:
                            recommendations[movie_id] = {'score': 0, 'rating': rating}
                        recommendations[movie_id]['score'] += similarity
            
            # Convert to movie objects
            recommended_movies = []
            for movie_id, data in recommendations.items():
                movie = self.get_movie_by_id(movie_id)
                if movie:
                    movie['recommendation_score'] = data['score']
                    recommended_movies.append(movie)
            
            # Sort by recommendation score
            recommended_movies.sort(key=lambda x: x.get('recommendation_score', 0), reverse=True)
            
            # Remove score from output
            for movie in recommended_movies:
                movie.pop('recommendation_score', None)
            
            return recommended_movies[:top_n]
        except Exception as e:
            print(f"Collaborative filtering error: {e}")
            return self.get_popular_movies(top_n)
    
    def hybrid_recommendations(self, user_id=None, movie_title=None, genre=None, top_n=20):
        """Hybrid recommendations combining multiple approaches"""
        try:
            recommendations = []
            
            # 1. Content-based if movie_title is provided
            if movie_title:
                content_based = self.get_similar_movies(movie_title, top_n=top_n//2)
                recommendations.extend(content_based)
            
            # 2. Genre-based if genre is provided
            if genre:
                genre_based = self.get_similar_by_genre(genre, top_n=top_n//2)
                recommendations.extend(genre_based)
            
            # 3. Collaborative filtering if user_id is provided
            if user_id and user_id in user_movie_interactions:
                collab_based = self.collaborative_filtering(user_id, top_n=top_n//2)
                recommendations.extend(collab_based)
            
            # 4. Add popular movies if we don't have enough
            if len(recommendations) < top_n:
                popular = self.get_popular_movies(top_n - len(recommendations))
                recommendations.extend(popular)
            
            # Remove duplicates
            unique_movies = {}
            for movie in recommendations:
                if movie['id'] not in unique_movies:
                    unique_movies[movie['id']] = movie
            
            # Convert back to list and limit
            final_recommendations = list(unique_movies.values())[:top_n]
            
            return final_recommendations
        except:
            return self.get_popular_movies(top_n)
    
    def get_movie_by_id(self, movie_id):
        """Get movie by ID"""
        try:
            for movie in self.movies:
                if str(movie['id']) == str(movie_id):
                    return movie
            return None
        except:
            return None

# Initialize recommender
recommender = MovieRecommender()

# ===== HELPER FUNCTIONS FOR QUIZ ENDPOINT =====
def content_based_recommendations(genre, limit=20):
    """Get content-based recommendations by genre"""
    try:
        genre_movies = []
        for movie in movies_db:
            if genre.lower() in movie.get('genres', '').lower():
                genre_movies.append(movie)
        
        if not genre_movies:
            return get_popular_movies(limit)
        
        # Sort by rating and popularity
        genre_movies.sort(
            key=lambda x: (x.get('rating', 0), x.get('popularity', 0)), 
            reverse=True
        )
        
        return genre_movies[:limit]
    except:
        return get_popular_movies(limit)

def find_similar_users(user_id):
    """Find users with similar preferences"""
    try:
        current_user = user_movie_interactions.get(user_id, {})
        if not current_user:
            return []
        
        similarities = []
        for other_id, other_user in user_movie_interactions.items():
            if other_id == user_id:
                continue
            
            # Calculate simple similarity based on rated movies
            current_ratings = current_user.get('rated_movies', {})
            other_ratings = other_user.get('rated_movies', {})
            
            common_movies = set(current_ratings.keys()) & set(other_ratings.keys())
            
            if common_movies:
                similarity = len(common_movies) / max(len(current_ratings), 1)
                similarities.append((other_id, similarity))
        
        # Return top 5 similar users
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [user_id for user_id, score in similarities[:5]]
    except:
        return []

def get_collaborative_recommendations(similar_users, limit=10):
    """Get recommendations from similar users"""
    try:
        recommended_movies = {}
        
        for user_id in similar_users:
            user_data = user_movie_interactions.get(user_id, {})
            
            # Get highly rated movies from similar users
            for movie_id, rating in user_data.get('rated_movies', {}).items():
                if rating >= 4:  # Only highly rated movies
                    movie = get_movie_by_id(movie_id)
                    if movie and movie_id not in recommended_movies:
                        recommended_movies[movie_id] = movie
        
        recommendations = list(recommended_movies.values())
        recommendations.sort(key=lambda x: x.get('rating', 0), reverse=True)
        
        return recommendations[:limit]
    except:
        return []

def get_movie_by_id(movie_id):
    """Helper to get movie by ID"""
    try:
        for movie in movies_db:
            if str(movie.get('id')) == str(movie_id):
                return movie
        return None
    except:
        return None

def get_popular_movies(limit=20):
    """Get popular movies as fallback"""
    try:
        popular = movies_db.copy()
        popular.sort(
            key=lambda x: (x.get('rating', 0) * 0.7 + x.get('popularity', 0) * 0.3), 
            reverse=True
        )
        return popular[:limit]
    except:
        return movies_db[:limit] if len(movies_db) >= limit else movies_db

def hybrid_recommendations(genres, user_id, limit=20):
    """Hybrid recommendations combining quiz preferences and user history"""
    try:
        user_data = user_movie_interactions.get(user_id, {})
        
        # Get content-based recommendations
        content_recs = []
        if genres:
            for genre in genres[:2]:  # Use top 2 genres
                content_recs.extend(content_based_recommendations(genre, limit=limit//2))
        
        # Get collaborative recommendations if user has history
        collab_recs = []
        if user_data.get('rated_movies') or user_data.get('watch_history'):
            similar_users = find_similar_users(user_id)
            collab_recs = get_collaborative_recommendations(similar_users, limit=limit//2)
        
        # Combine and deduplicate
        all_recs = content_recs + collab_recs
        unique_recs = {}
        for movie in all_recs:
            unique_recs[movie['id']] = movie
        
        # Sort by combined score
        recommendations = list(unique_recs.values())
        recommendations.sort(
            key=lambda x: (x.get('rating', 0) * 0.7 + x.get('popularity', 0) * 0.3), 
            reverse=True
        )
        
        return recommendations[:limit]
    except Exception as e:
        print(f"Hybrid recommendations error: {e}")
        if genres:
            return content_based_recommendations(genres[0], limit)
        else:
            return get_popular_movies(limit)

# ===== FLASK ROUTES =====

@app.route('/')
def home():
    return jsonify({
        "message": "MovieMind Recommendation API",
        "version": "1.0",
        "endpoints": {
            "/health": "Check API health",
            "/movies": "Get all movies",
            "/recommend/popular": "Get popular movies",
            "/recommend/content": "Content-based recommendations",
            "/recommend/collaborative": "Collaborative filtering",
            "/recommend/hybrid": "Hybrid recommendations",
            "/recommend/quiz": "Quiz-based recommendations",
            "/search": "Search movies",
            "/user/<user_id>/rate": "Rate a movie",
            "/user/<user_id>/history": "Get user history"
        }
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "movies_count": len(movies_db),
        "users_count": len(user_movie_interactions)
    })

@app.route('/movies', methods=['GET'])
def get_all_movies():
    limit = request.args.get('limit', 50, type=int)
    page = request.args.get('page', 1, type=int)
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    
    return jsonify({
        "movies": movies_db[start_idx:end_idx],
        "total": len(movies_db),
        "page": page,
        "limit": limit
    })

@app.route('/recommend/popular', methods=['GET'])
def popular_recommendations():
    limit = request.args.get('limit', 20, type=int)
    recommendations = recommender.get_popular_movies(limit)
    return jsonify({
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": "Popularity-Based"
    })

@app.route('/recommend/content', methods=['GET'])
def content_recommendations():
    movie_title = request.args.get('movie', '')
    genre = request.args.get('genre', '')
    limit = request.args.get('limit', 10, type=int)
    
    if movie_title:
        recommendations = recommender.get_similar_movies(movie_title, limit)
        algorithm = f"Content-Based (Similar to '{movie_title}')"
    elif genre:
        recommendations = recommender.get_similar_by_genre(genre, limit)
        algorithm = f"Content-Based (Genre: '{genre}')"
    else:
        recommendations = recommender.get_popular_movies(limit)
        algorithm = "Popularity-Based (Fallback)"
    
    return jsonify({
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": algorithm
    })

@app.route('/recommend/collaborative', methods=['GET'])
def collaborative_recommendations():
    user_id = request.args.get('user_id')
    limit = request.args.get('limit', 10, type=int)
    
    if not user_id:
        return jsonify({
            "error": "user_id parameter is required",
            "recommendations": recommender.get_popular_movies(limit)
        }), 400
    
    recommendations = recommender.collaborative_filtering(user_id, limit)
    
    return jsonify({
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": "Collaborative Filtering",
        "user_id": user_id
    })

@app.route('/recommend/hybrid', methods=['GET'])
def hybrid_recommendations_route():
    user_id = request.args.get('user_id')
    movie_title = request.args.get('movie', '')
    genre = request.args.get('genre', '')
    limit = request.args.get('limit', 20, type=int)
    
    recommendations = recommender.hybrid_recommendations(
        user_id=user_id,
        movie_title=movie_title,
        genre=genre,
        top_n=limit
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
        "recommendations": recommendations,
        "count": len(recommendations),
        "algorithm": algorithm
    })

@app.route('/recommend/quiz', methods=['GET'])
def quiz_recommendations():
    try:
        # Get quiz parameters
        genres_param = request.args.get('genres', '')
        tags_param = request.args.get('tags', '')
        year_start = request.args.get('year_start', type=int)
        year_end = request.args.get('year_end', type=int)
        user_id = request.args.get('user_id', type=str)
        limit = request.args.get('limit', 20, type=int)
        
        print(f"Quiz parameters received - Genres: {genres_param}, Tags: {tags_param}, Year: {year_start}-{year_end}, User: {user_id}")

        # Parse parameters
        genres = [g.strip().lower() for g in genres_param.split(',') if g.strip()] if genres_param else []
        tags = [t.strip().lower() for t in tags_param.split(',') if t.strip()] if tags_param else []

        # Start with all movies
        filtered_movies = movies_db.copy()
        print(f"Total movies in database: {len(filtered_movies)}")

        # Filter by genres (case-insensitive and partial matching)
        if genres:
            genre_filtered = []
            for movie in filtered_movies:
                movie_genres = movie.get('genres', '').lower()
                if any(g in movie_genres for g in genres):
                    genre_filtered.append(movie)
            filtered_movies = genre_filtered
            print(f"After genre filter: {len(filtered_movies)} movies")

        # Filter by year range
        if year_start and year_end:
            year_filtered = []
            for movie in filtered_movies:
                if 'year' in movie and isinstance(movie['year'], (int, float)):
                    if year_start <= movie['year'] <= year_end:
                        year_filtered.append(movie)
            filtered_movies = year_filtered
            print(f"After year filter: {len(filtered_movies)} movies")

        # Filter by tags (search in multiple fields)
        if tags:
            tag_filtered = []
            for movie in filtered_movies:
                # Combine all searchable text
                search_text = ' '.join([
                    str(movie.get('title', '')).lower(),
                    str(movie.get('genres', '')).lower(),
                    str(movie.get('plot', '')).lower(),
                    str(movie.get('keywords', '')).lower(),
                    str(movie.get('director', '')).lower(),
                    ' '.join([c.lower() for c in movie.get('cast', [])]) if isinstance(movie.get('cast', []), list) else str(movie.get('cast', '')).lower()
                ])
                
                # Check if any tag appears in search text
                if any(tag in search_text for tag in tags):
                    tag_filtered.append(movie)
            filtered_movies = tag_filtered
            print(f"After tag filter: {len(filtered_movies)} movies")

        # Fallback logic if too few movies
        if len(filtered_movies) < 5:
            print(f"Too few movies ({len(filtered_movies)}), applying fallback logic...")
            
            # Try hybrid approach for logged-in users
            if user_id:
                try:
                    print(f"Trying hybrid recommendations for user {user_id}")
                    
                    hybrid_results = hybrid_recommendations(
                        genres=genres,
                        user_id=user_id,
                        limit=limit
                    )
                    if hybrid_results:
                        filtered_movies = hybrid_results
                        print(f"Hybrid algorithm returned {len(filtered_movies)} movies")
                    else:
                        raise Exception("Hybrid algorithm failed")
                        
                except Exception as e:
                    print(f"Hybrid fallback failed: {e}")
                    # Fallback to content-based by genre
                    if genres:
                        filtered_movies = content_based_recommendations(
                            genre=genres[0],
                            limit=limit
                        )
                        print(f"Content-based returned {len(filtered_movies)} movies")
                    else:
                        filtered_movies = get_popular_movies(limit)
                        print(f"Popular movies returned {len(filtered_movies)} movies")
            
            else:
                # Non-logged in user fallback
                if genres:
                    filtered_movies = content_based_recommendations(
                        genre=genres[0],
                        limit=limit
                    )
                else:
                    filtered_movies = get_popular_movies(limit)

        # Apply diversity to avoid similar movies
        if len(filtered_movies) > 10:
            # Group by primary genre to ensure variety
            grouped_movies = {}
            for movie in filtered_movies:
                primary_genre = movie.get('genres', '').split(',')[0].strip() if movie.get('genres') else 'Other'
                if primary_genre not in grouped_movies:
                    grouped_movies[primary_genre] = []
                grouped_movies[primary_genre].append(movie)
            
            # Take top movies from each genre
            filtered_movies = []
            max_per_genre = max(2, limit // max(len(grouped_movies), 1))
            for genre, movies in grouped_movies.items():
                # Sort by rating within genre
                movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
                filtered_movies.extend(movies[:max_per_genre])
            
            # Final sort by rating
            filtered_movies.sort(key=lambda x: x.get('rating', 0), reverse=True)
            filtered_movies = filtered_movies[:limit]

        # Calculate match scores for each movie
        for movie in filtered_movies:
            match_score = 0
            
            # Genre match score
            if genres and movie.get('genres'):
                movie_genres = movie['genres'].lower()
                for g in genres:
                    if g in movie_genres:
                        match_score += 3  # Higher weight for genre matches
            
            # Tag match score
            if tags:
                search_text = ' '.join([
                    str(movie.get('title', '')).lower(),
                    str(movie.get('plot', '')).lower(),
                    str(movie.get('keywords', '')).lower()
                ])
                for t in tags:
                    if t in search_text:
                        match_score += 1
            
            # Year match score (closer to preferred range gets higher score)
            if year_start and year_end and 'year' in movie:
                year = movie['year']
                if year_start <= year <= year_end:
                    # Calculate how close to the middle of the range
                    range_middle = (year_start + year_end) / 2
                    year_diff = abs(year - range_middle)
                    max_diff = max(abs(year_start - range_middle), abs(year_end - range_middle))
                    if max_diff > 0:
                        match_score += (1 - year_diff/max_diff) * 2
            
            movie['match_score'] = round(match_score, 2)
        
        # Sort by match score (primary) and rating (secondary)
        filtered_movies.sort(key=lambda x: (x.get('match_score', 0), x.get('rating', 0)), reverse=True)
        
        # Add explanation for each recommendation
        for i, movie in enumerate(filtered_movies[:10]):  # Add explanation only for top 10
            explanations = []
            
            if genres and movie.get('genres'):
                movie_genres = movie['genres'].lower()
                matched_genres = [g for g in genres if g in movie_genres]
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

        # Remove match_score from final output (internal use only)
        for movie in filtered_movies:
            movie.pop('match_score', None)

        print(f"Returning {len(filtered_movies[:limit])} quiz recommendations")
        
        return jsonify({
            "success": True,
            "recommendations": filtered_movies[:limit],
            "count": len(filtered_movies[:limit]),
            "quiz_parameters": {
                "genres": genres,
                "tags": tags,
                "year_range": [year_start, year_end] if year_start and year_end else None
            },
            "algorithm": "Quiz-Based Recommendations",
            "diversity_applied": 'grouped_movies' in locals() and len(grouped_movies) > 1
        })

    except Exception as e:
        print(f"Error in quiz_recommendations: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return safe fallback
        fallback_movies = get_popular_movies(min(limit, 20))
        
        return jsonify({
            "success": False,
            "error": str(e),
            "recommendations": fallback_movies,
            "count": len(fallback_movies),
            "algorithm": "Fallback - Popular Movies"
        }), 500

@app.route('/search', methods=['GET'])
def search_movies():
    query = request.args.get('query', '')
    limit = request.args.get('limit', 20, type=int)
    
    if not query:
        return jsonify({
            "results": [],
            "count": 0,
            "query": ""
        })
    
    # Search in multiple fields
    results = []
    for movie in movies_db:
        # Combine searchable fields
        search_text = ' '.join([
            str(movie.get('title', '')),
            str(movie.get('genres', '')),
            str(movie.get('director', '')),
            str(movie.get('cast', '')),
            str(movie.get('plot', '')),
            str(movie.get('keywords', ''))
        ]).lower()
        
        if query.lower() in search_text:
            results.append(movie)
    
    # Sort by relevance (simple: title match first, then others)
    def relevance_score(movie, query_lower):
        score = 0
        if query_lower in movie.get('title', '').lower():
            score += 10
        if query_lower in movie.get('genres', '').lower():
            score += 5
        if query_lower in movie.get('director', '').lower():
            score += 3
        if query_lower in movie.get('plot', '').lower():
            score += 2
        return score
    
    results.sort(key=lambda x: relevance_score(x, query.lower()), reverse=True)
    
    return jsonify({
        "results": results[:limit],
        "count": len(results[:limit]),
        "query": query
    })

@app.route('/user/<user_id>/rate', methods=['POST'])
def rate_movie(user_id):
    try:
        data = request.json
        movie_id = data.get('movie_id')
        rating = data.get('rating')
        
        if not movie_id or rating is None:
            return jsonify({"error": "movie_id and rating are required"}), 400
        
        if rating < 1 or rating > 5:
            return jsonify({"error": "rating must be between 1 and 5"}), 400
        
        # Initialize user data if not exists
        if user_id not in user_movie_interactions:
            user_movie_interactions[user_id] = {
                "rated_movies": {},
                "watch_history": [],
                "preferred_genres": []
            }
        
        # Add rating
        user_movie_interactions[user_id]["rated_movies"][str(movie_id)] = rating
        
        # Update preferred genres based on rated movies
        if len(user_movie_interactions[user_id]["rated_movies"]) >= 3:
            # Analyze top genres from highly rated movies
            genre_counts = {}
            for mid, r in user_movie_interactions[user_id]["rated_movies"].items():
                if r >= 4:  # Only consider highly rated movies
                    movie = get_movie_by_id(mid)
                    if movie and movie.get('genres'):
                        genres = [g.strip() for g in movie['genres'].split(',')]
                        for genre in genres:
                            genre_counts[genre] = genre_counts.get(genre, 0) + 1
            
            # Get top 3 genres
            preferred_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            user_movie_interactions[user_id]["preferred_genres"] = [g[0] for g in preferred_genres]
        
        return jsonify({
            "success": True,
            "message": f"Rating {rating} saved for movie {movie_id}",
            "user_id": user_id,
            "total_ratings": len(user_movie_interactions[user_id]["rated_movies"])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/user/<user_id>/history', methods=['GET'])
def get_user_history(user_id):
    if user_id not in user_movie_interactions:
        return jsonify({
            "user_id": user_id,
            "rated_movies": {},
            "watch_history": [],
            "preferred_genres": [],
            "total_ratings": 0
        })
    
    user_data = user_movie_interactions[user_id]
    
    # Get movie details for rated movies
    rated_movies_details = []
    for movie_id, rating in user_data.get('rated_movies', {}).items():
        movie = get_movie_by_id(movie_id)
        if movie:
            rated_movies_details.append({
                **movie,
                "user_rating": rating
            })
    
    return jsonify({
        "user_id": user_id,
        "rated_movies": rated_movies_details,
        "watch_history": user_data.get('watch_history', []),
        "preferred_genres": user_data.get('preferred_genres', []),
        "total_ratings": len(user_data.get('rated_movies', {}))
    })

@app.route('/movies/analyze', methods=['GET'])
def analyze_movies():
    """Analyze movie database statistics"""
    try:
        # Calculate statistics
        total_movies = len(movies_db)
        
        # Genre analysis
        all_genres = []
        for movie in movies_db:
            if movie.get('genres'):
                genres = [g.strip() for g in movie['genres'].split(',')]
                all_genres.extend(genres)
        
        unique_genres = list(set(all_genres))
        genre_counts = {genre: all_genres.count(genre) for genre in unique_genres}
        top_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Year analysis
        years = [movie.get('year', 0) for movie in movies_db if movie.get('year')]
        avg_year = int(sum(years) / len(years)) if years else 0
        min_year = min(years) if years else 0
        max_year = max(years) if years else 0
        
        # Rating analysis
        ratings = [movie.get('rating', 0) for movie in movies_db if movie.get('rating')]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        
        # Director analysis
        directors = [movie.get('director', 'Unknown') for movie in movies_db]
        director_counts = {}
        for director in directors:
            director_counts[director] = director_counts.get(director, 0) + 1
        top_directors = sorted(director_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return jsonify({
            "total_movies": total_movies,
            "unique_genres": len(unique_genres),
            "top_genres": dict(top_genres),
            "year_range": [min_year, max_year],
            "average_year": avg_year,
            "average_rating": round(avg_rating, 2),
            "top_directors": dict(top_directors),
            "algorithm_info": {
                "type": "Hybrid (Content + Collaborative)",
                "content_weight": 0.7,
                "collaborative_weight": 0.3,
                "similarity_metric": "Cosine Similarity"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🎬 MovieMind Recommendation System")
    print(f"📊 Loaded {len(movies_db)} movies")
    print("🚀 Starting server on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)