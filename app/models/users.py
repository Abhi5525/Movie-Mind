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
    
    # Add quiz profile fields to User
    quiz_profile_type = db.Column(db.String(100))
    quiz_taken_at = db.Column(db.DateTime)
    
    # Relationships
    watchlist = db.relationship('Watchlist', backref='user', lazy=True)
    history = db.relationship('WatchHistory', back_populates='user', lazy=True)
    favorites = db.relationship('Favorite', backref='user', lazy=True)
    ratings = db.relationship('UserRating', backref='user', lazy=True)
    quiz_results = db.relationship('QuizResult', back_populates='user', lazy=True, cascade="all, delete-orphan")

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
import json
class QuizResult(db.Model):
    __tablename__ = 'quiz_results'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    profile_type = db.Column(db.String(100), nullable=False)
    profile_name = db.Column(db.String(200), nullable=False)
    profile_description = db.Column(db.Text, nullable=False)
    top_genres = db.Column(db.String(500), nullable=False)
    tags = db.Column(db.String(1000), nullable=False)
    quiz_answers = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Remove these - they belong in User model:
    # quiz_profile_type = db.Column(db.String(100))  # ❌ REMOVE
    # quiz_taken_at = db.Column(db.DateTime)         # ❌ REMOVE
    
    # Relationships
    user = db.relationship('User', back_populates='quiz_results')
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "profile_type": self.profile_type,
            "profile_name": self.profile_name,
            "profile_description": self.profile_description,
            "top_genres": json.loads(self.top_genres) if self.top_genres else [],
            "tags": json.loads(self.tags) if self.tags else [],
            "quiz_answers": json.loads(self.quiz_answers) if self.quiz_answers else {},
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def from_data(cls, user_id, quiz_data):
        """Create a QuizResult from quiz data"""
        return cls(
            user_id=user_id,
            profile_type=quiz_data.get('profileType'),
            profile_name=quiz_data.get('name'),
            profile_description=quiz_data.get('description'),
            top_genres=json.dumps(quiz_data.get('topGenres', [])),
            tags=json.dumps(quiz_data.get('tags', [])),
            quiz_answers=json.dumps(quiz_data.get('answers', {}))
        )