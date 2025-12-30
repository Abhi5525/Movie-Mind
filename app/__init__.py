from flask import Flask
from app.extensions import cors
from app.models.data_loader import MovieDataStore
from app.services.recommender import MovieRecommender
from .routes.movies import movies_bp, recommendations_bp
from .routes.main import main_bp
from .routes.search import search_bp
from .routes.user import user_bp
from flasgger import Swagger

def create_app():
    app = Flask(__name__)
    cors.init_app(app)




    # Swagger config
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/apispec.json",
                "rule_filter": lambda rule: True,  # include all endpoints
                "model_filter": lambda tag: True,  # include all models
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs/"
    }
    
    store = MovieDataStore()
    recommender = MovieRecommender(movies = store.get_all_movies(), user_interactions={})

    app.config['MOVIE_STORE'] = store
    app.config['RECOMMENDER'] = recommender
    app.config['USER_INTERACTIONS'] = {}  # Empty dict to store ratings and history

    
    app.register_blueprint(movies_bp)
    app.register_blueprint(recommendations_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(search_bp)

    app.register_blueprint(user_bp)
    Swagger(app, config=swagger_config)



    return app
