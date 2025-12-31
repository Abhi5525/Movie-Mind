from app.database import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    join_date = db.Column(db.DateTime, default=datetime.utcnow)



    watchlist = db.relationship('Watchlist', backref='user', lazy=True)
    history = db.relationship('WatchHistory', back_populates='user', lazy=True)
    favorites = db.relationship('Favorite', backref='user', lazy=True)
    ratings = db.relationship('UserRating', backref='user', lazy=True)


    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    

# app/models/watch_history.py

class WatchHistory(db.Model):
    __tablename__ = 'watch_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    movie_id = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=False)
    watched_date = db.Column(db.DateTime, default=datetime.utcnow)
    title = db.Column(db.String(255))
    img = db.Column(db.String(255))
    rating = db.Column(db.Float)
    year = db.Column(db.Integer)

    user = db.relationship('User', back_populates='history')
    movie = db.relationship('Movie', backref='watch_history_entries')

    def to_dict(self):
        return {
            "id": self.id,
            "movie_id": self.movie_id,
            "movie_title": self.movie.title,
            "movie_img": self.movie.img,
            "movie_year": self.movie.year,
            "movie_rating": self.movie.rating,
            "watched_date": self.watched_date.isoformat()
        }



class Watchlist(db.Model):
    __tablename__ = 'watchlist'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    movie_id = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=False)
    movie = db.relationship('Movie', backref='watchlist_entries')
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

    # Optional: store snapshot of movie info
    title = db.Column(db.String(255))
    img = db.Column(db.String(255))
    rating = db.Column(db.Float)
    year = db.Column(db.Integer)

    def to_dict(self):
        """Return a dictionary representation of the watchlist entry"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "movie_id": self.movie_id,
            "title": self.title,
            "img": self.img,
            "rating": self.rating,
            "year": self.year,
            "addedDate": self.added_date.isoformat() if self.added_date else None
        }



class UserRating(db.Model):
    __tablename__ = 'user_ratings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    movie_id = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=False)
    movie = db.relationship('Movie', backref='userRatings')
    rating = db.Column(db.Integer, nullable=False)
    rated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "movie_id": self.movie_id,
            "rating": self.rating,
            "rated_at": self.rated_at.isoformat()
        }

class Favorite(db.Model):
    __tablename__ = 'favorites'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    movie_id = db.Column(db.Integer, db.ForeignKey('movies.id'), nullable=False)
    movie = db.relationship('Movie', backref='favorite_entries')
    added_date = db.Column(db.DateTime, default=datetime.utcnow)

    # Optional: store movie snapshot
    title = db.Column(db.String(255))
    img = db.Column(db.String(255))
    rating = db.Column(db.Float)
    year = db.Column(db.Integer)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "movie_id": self.movie_id,
            "title": self.title,
            "img": self.img,
            "rating": self.rating,
            "year": self.year,
            "addedDate": self.added_date.isoformat() if self.added_date else None
        }
