from app.models.movie import Movie
class MovieDataStore:
    def __init__(self):
        self.movies = []

    def load_movies(self):
        from app.models.movie import Movie  # if not already imported
        self.movies = [m.to_dict() for m in Movie.query.all()]  # ✅ clean dict

    def get_all_movies(self):
        if not self.movies:
            self.load_movies()
        return self.movies

    def get_movie_by_id(self, movie_id):
        from app.models.movie import Movie
        movie = Movie.query.get(movie_id)
        return movie.to_dict() if movie else None  # ✅ safe