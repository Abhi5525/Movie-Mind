from app.database import db
from datetime import datetime

class Movie(db.Model):
    __tablename__ = "movies"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    genres = db.Column(db.String(255))
    rating = db.Column(db.Float, default=0.0)
    year = db.Column(db.Integer)
    runtime = db.Column(db.Integer, nullable=True)
    director = db.Column(db.String(255))
    cast = db.Column(db.Text)
    plot = db.Column(db.Text)
    keywords = db.Column(db.Text)
    popularity = db.Column(db.Float, default=0.0)
    
    # Store only the filename
    poster_filename = db.Column(db.String(255), nullable=True)
    
    # Keep for backward compatibility
    img = db.Column(db.String(500), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "genres": self.genres,
            "rating": self.rating,
            "year": self.year,
            "runtime": self.runtime,
            "director": self.director,
            "cast": self.cast,
            "plot": self.plot,
            "keywords": self.keywords,
            "popularity": self.popularity,
            "img": self.get_image_url(),  # ✅ This returns correct path
            "poster_filename": self.poster_filename,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def get_image_url(self):
        """
        Generate correct URL for the movie poster
        Since static/ is at same level as app/, use relative path
        """
        if self.poster_filename:
            # ✅ CORRECT PATH: Go up from app/ to Movie-Mind/, then into static/
            return f"/static/images/posters/{self.poster_filename}"
        elif self.img:
            # During transition
            if self.img.startswith('/static/'):
                return self.img
            # TMDB URL (temporary)
            return self._fix_image_url(self.img)
        else:
            # Placeholder
            return "/static/images/poster-not-available.jpg"
    
    @staticmethod
    def _fix_image_url(img):
        """Backward compatibility for TMDB URLs"""
        if img and not img.startswith('http') and not img.startswith('/static/'):
            return f"https://image.tmdb.org/t/p/w500{img}"
        return img