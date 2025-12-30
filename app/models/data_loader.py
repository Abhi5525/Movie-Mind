import pandas as pd
import os


DATA_PATH = os.path.join("data", "Movie.csv")

class MovieDataStore:
    def __init__(self):
        self.movies = []
        self.load_movies()

    def load_movies(self):
        if not os.path.exists(DATA_PATH):
            raise FileNotFoundError(f"Data file not found at path: {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        self.movies = df.to_dict(orient='records')

    def get_all_movies(self):
        return self.movies
    
    def get_movie_by_id(self, movie_id):
        for movie in self.movies:
            if int(movie['id']) == movie_id:
                return movie
        return None
