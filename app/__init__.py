from flask import Flask, jsonify
from flask_cors import CORS
from app.models.data_loader import MovieDataStore
from app.models.users import User
from app.services.recommender import MovieRecommender
from .routes.movies import movies_bp, favorites_bp
from .routes.recommendations import recommendations_bp
from .routes.main import main_bp
from .routes.search import search_bp
from .routes.user import user_bp
from app.database import db
from .routes.auth import auth_bp
from .routes.quiz import quiz_bp
from flask_jwt_extended import JWTManager
from datetime import timedelta
from flask_migrate import Migrate

import os

basedir = os.path.abspath(os.path.dirname(__file__))

def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="../static")

    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'moviemind.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'dev-secret'
    app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-change-in-production'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
    
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:5000", "http://127.0.0.1:5000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    db.init_app(app)
    jwt = JWTManager(app)
    @jwt.user_identity_loader
    def user_identity_lookup(user):
        """How to create identity from user object"""
        return user
    

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        """Load user from JWT token"""
        identity = jwt_data["sub"]
        return User.query.get(int(identity))


    # ✅ Register all blueprints with /api prefix
    app.register_blueprint(movies_bp)
    app.register_blueprint(recommendations_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(auth_bp)  # Auth specific prefix
    app.register_blueprint(user_bp)  # User specific prefix
    app.register_blueprint(quiz_bp)  # Quiz specific prefix
    app.register_blueprint(favorites_bp)
    
    migrate = Migrate(app, db)
    with app.app_context():
        db.create_all()
        store = MovieDataStore()
        recommender = MovieRecommender(movies=store.get_all_movies(), user_interactions={})
    
    app.config['MOVIE_STORE'] = store
    app.config['RECOMMENDER'] = recommender
    app.config['USER_INTERACTIONS'] = {}

    # ✅ Serve HTML at root
    @app.route('/')
    @app.route('/quiz')
    @app.route('/app')
    def index():
        return app.send_static_file('index.html')
    
    # Serve static files (CSS, JS, images)
    @app.route('/<path:path>')
    def serve_static(path):
        return app.send_static_file(path)
    # Add to your __init__.py or main.py
    @app.route('/debug/routes')
    def debug_routes():
        import json
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'path': str(rule)
            })
        return jsonify(routes)

    return app