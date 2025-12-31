import pandas as pd
from app import db, create_app
from app.models.movie import Movie

DATA_PATH = "data/Movie.csv"

def import_movies():
    df = pd.read_csv(DATA_PATH)

    for _, row in df.iterrows():
        movie = Movie(
            id=int(row['id']),
            title=row['title'],
            genres=row.get('genres'),
            rating=row.get('rating', 0.0),
            year=row.get('year'),
            director=row.get('director'),
            cast=row.get('cast'),
            plot=row.get('plot'),
            keywords=row.get('keywords'),
            popularity=row.get('popularity', 0.0),
            img=row.get('img')  # optional
        )
        db.session.merge(movie)  # merge updates if already exists
    db.session.commit()
    print("Movies imported successfully!")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        import_movies()
