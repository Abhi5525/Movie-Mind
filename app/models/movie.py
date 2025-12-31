from app.database import db
class Movie(db.Model):
    __tablename__ = "movies"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    genres = db.Column(db.String(255))
    rating = db.Column(db.Float, default=0.0)       # e.g., 8.8
    year = db.Column(db.Integer)                    # e.g., 2010
    director = db.Column(db.String(255))
    cast = db.Column(db.Text)                       # e.g., "Leonardo DiCaprio, ..."
    plot = db.Column(db.Text)
    keywords = db.Column(db.Text)                   # e.g., "dream, heist, ..."
    popularity = db.Column(db.Float, default=0.0)   # e.g., 9.5
    img = db.Column(db.String(500))                 # ✅ Use 'img', NOT 'poster_url'

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "genres": self.genres,
            "rating": self.rating,
            "year": self.year,
            "director": self.director,
            "cast": self.cast,
            "plot": self.plot,
            "keywords": self.keywords,
            "popularity": self.popularity,
            "img": self.img or ""
        }