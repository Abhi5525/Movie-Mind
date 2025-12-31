from flask import Flask
from flask_cors import CORS
from app.models.data_loader import MovieDataStore
from app.services.recommender import MovieRecommender
from .routes.movies import movies_bp, recommendations_bp
from .routes.main import main_bp
from .routes.search import search_bp
from .routes.user import user_bp
from app.database import db
from .routes.auth import auth_bp
from flask_jwt_extended import JWTManager
from datetime import timedelta

import os

basedir = os.path.abspath(os.path.dirname(__file__))
# This ensures the DB is always created in the correct folder

def create_app():
    app = Flask(__name__, template_folder = "templates")

    # app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/moviemind.db'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'moviemind.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'dev-secret'
     # JWT Configuration
    app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-change-in-production'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
    
    # ===== ENABLE CORS =====
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    db.init_app(app)
    jwt = JWTManager(app)


    
    app.register_blueprint(movies_bp)
    app.register_blueprint(recommendations_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)

    
    with app.app_context():
        db.create_all()

        store = MovieDataStore()
        recommender = MovieRecommender(movies = store.get_all_movies(), user_interactions={})

    
    app.config['MOVIE_STORE'] = store
    app.config['RECOMMENDER'] = recommender
    app.config['USER_INTERACTIONS'] = {}  # Empty dict to store ratings and history



    
    return app
