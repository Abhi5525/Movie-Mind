# app/routes/admin.py
from functools import wraps
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity, exceptions, verify_jwt_in_request, decode_token
from app.database import db
from app.models.users import User
from app.models.movie import Movie
from app.models.users import QuizResult
from datetime import datetime, timedelta
import io, csv, json
from sqlalchemy import func, distinct
from collections import Counter

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# ========== DASHBOARD ==========
@admin_bp.route('/dashboard')
@jwt_required()
def admin_dashboard():
    """Admin dashboard statistics"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Get statistics
    total_users = User.query.count()
    total_movies = Movie.query.count()
    total_quizzes = QuizResult.query.count() if hasattr(QuizResult, 'query') else 0
    
    # Recent activity
    recent_users = User.query.order_by(User.join_date.desc()).limit(5).all()
    recent_movies = Movie.query.order_by(Movie.created_at.desc()).limit(5).all()
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'is_admin': user.is_admin
        },
        'stats': {
            'total_users': total_users,
            'total_movies': total_movies,
            'total_quizzes': total_quizzes
        },
        'recent_users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'join_date': u.join_date.isoformat() if u.join_date else None,
            'is_admin': u.is_admin
        } for u in recent_users],
        'recent_movies': [{
            'id': m.id,
            'title': m.title,
            'year': m.year,
            'genres': m.genres,
            'rating': m.rating,
            'created_at': m.created_at.isoformat() if hasattr(m, 'created_at') and m.created_at else None
        } for m in recent_movies]
    })

# ========== MOVIES MANAGEMENT ==========
@admin_bp.route('/movies')
@jwt_required()
def get_movies():
    """Get all movies (paginated)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()

    query = Movie.query
    if search:
        query = query.filter(
            Movie.title.ilike(f'%{search}%') |
            Movie.genres.ilike(f'%{search}%') |
            Movie.director.ilike(f'%{search}%')
        )
    
    # Query movies
    movies = query.order_by(Movie.created_at.desc())\
                        .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'movies': [movie.to_dict() for movie in movies.items],
        'pagination': {
            'total': movies.total,
            'pages': movies.pages,
            'current_page': movies.page,
            'per_page': movies.per_page
        }
    })

# ========== SINGLE MOVIE ENDPOINT (GET) ==========
@admin_bp.route('/movies/<int:movie_id>', methods=['GET'])
@jwt_required()
def get_movie(movie_id):
    """Get single movie details"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    movie = Movie.query.get(movie_id)
    if not movie:
        return jsonify({'error': 'Movie not found'}), 404
    
    return jsonify({
        'success': True,
        'movie': movie.to_dict()
    })

@admin_bp.route('/movies', methods=['POST'])
@jwt_required()
def create_movie():
    """Create a new movie"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    
    # Basic validation
    required_fields = ['title', 'year', 'genres']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if movie already exists
    existing = Movie.query.filter_by(title=data['title'], year=data['year']).first()
    if existing:
        return jsonify({'error': 'Movie already exists'}), 409
    
    # Create movie
    try:
        movie = Movie(
            title=data['title'],
            year=data['year'],
            genres=data['genres'],
            rating=data.get('rating', 0),
            runtime=data.get('runtime'),
            director=data.get('director', ''),
            cast=data.get('cast', ''),
            plot=data.get('plot', ''),
            img=data.get('img', '/static/images/placeholders/poster-not-available.jpg'),
            created_at=datetime.utcnow()
        )
        
        db.session.add(movie)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Movie created successfully',
            'movie': movie.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/movies/<int:movie_id>', methods=['PUT'])
@jwt_required()
def update_movie(movie_id):
    """Update movie details"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    movie = Movie.query.get(movie_id)
    if not movie:
        return jsonify({'error': 'Movie not found'}), 404
    
    data = request.get_json()
    
    try:
        # Update fields
        if 'title' in data:
            movie.title = data['title']
        if 'year' in data:
            movie.year = data['year']
        if 'genres' in data:
            movie.genres = data['genres']
        if 'rating' in data:
            movie.rating = data['rating']
        if 'runtime' in data:
            movie.runtime = data['runtime']
        if 'director' in data:
            movie.director = data['director']
        if 'cast' in data:
            movie.cast = data['cast']
        if 'plot' in data:
            movie.plot = data['plot']
        if 'img' in data:
            movie.img = data['img']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Movie updated successfully',
            'movie': movie.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/movies/<int:movie_id>', methods=['DELETE'])
@jwt_required()
def delete_movie(movie_id):
    """Delete a movie"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    movie = Movie.query.get(movie_id)
    if not movie:
        return jsonify({'error': 'Movie not found'}), 404
    
    try:
        db.session.delete(movie)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Movie deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ========== USERS MANAGEMENT ==========
@admin_bp.route('/users')
@jwt_required()
def get_users():
    """Get all users (paginated)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()

    query  = User.query

    if search:
         query = query.filter(
            User.name.ilike(f'%{search}%') |
            User.email.ilike(f'%{search}%')
        )

    
    # Query users
    users = query.order_by(User.join_date.desc())\
                      .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'join_date': u.join_date.isoformat() if u.join_date else None,
            'is_admin': u.is_admin,
            'is_active': u.is_active,
            'last_login': u.last_login.isoformat() if u.last_login else None
        } for u in users.items],
        'pagination': {
            'total': users.total,
            'pages': users.pages,
            'current_page': users.page,
            'per_page': users.per_page
        }
    })

# ========== SINGLE USER ENDPOINT (GET) ==========
@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user details"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': {
            'id': target_user.id,
            'name': target_user.name,
            'email': target_user.email,
            'join_date': target_user.join_date.isoformat() if target_user.join_date else None,
            'last_login': target_user.last_login.isoformat() if target_user.last_login else None,
            'is_admin': target_user.is_admin,
            'is_active': target_user.is_active
        }
    })

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user details"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Cannot modify yourself
    if target_user.id == user.id:
        return jsonify({'error': 'Cannot modify your own admin status'}), 400
    
    try:
        if 'name' in data:
            target_user.name = data['name']
        if 'is_admin' in data:
            target_user.is_admin = bool(data['is_admin'])
        if 'is_active' in data:
            target_user.is_active = bool(data['is_active'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User updated successfully',
            'user': {
                'id': target_user.id,
                'name': target_user.name,
                'email': target_user.email,
                'is_admin': target_user.is_admin,
                'is_active': target_user.is_active
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete a user"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Cannot delete yourself
    if target_user.id == user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    # Cannot delete other admins (optional restriction)
    if target_user.is_admin:
        return jsonify({'error': 'Cannot delete admin users'}), 400
    
    try:
        db.session.delete(target_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ========== SEARCH FUNCTIONALITY ==========
@admin_bp.route('/search')
@jwt_required()
def search():
    """Search movies and users"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query required'}), 400
    
    # Search movies
    movies = Movie.query.filter(
        Movie.title.ilike(f'%{query}%') |
        Movie.genres.ilike(f'%{query}%') |
        Movie.director.ilike(f'%{query}%')
    ).limit(10).all()
    
    # Search users
    users = User.query.filter(
        User.name.ilike(f'%{query}%') |
        User.email.ilike(f'%{query}%')
    ).limit(10).all()
    
    return jsonify({
        'success': True,
        'movies': [movie.to_dict() for movie in movies],
        'users': [{
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'is_admin': u.is_admin
        } for u in users]
    })

# ========== TEST ENDPOINT ==========
@admin_bp.route('/test')
@jwt_required()
def test_admin():
    """Test endpoint"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    return jsonify({
        'success': True,
        'message': 'Admin access verified!',
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email
        }
    })

# Flask endpoint for quiz analytics
@admin_bp.route('/quiz-analytics')
@jwt_required()
def get_quiz_analytics():
    """Get comprehensive quiz analytics"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        # Total quizzes taken
        total_quizzes = QuizResult.query.count()
        
        # User engagement
        active_quiz_takers = db.session.query(
            func.count(distinct(QuizResult.user_id))
        ).scalar() or 0
        
        # Time-based trends
        quizzes_by_date = db.session.query(
            func.date(QuizResult.created_at).label('date'),
            func.count(QuizResult.id).label('count')
        ).group_by(func.date(QuizResult.created_at))\
         .order_by(func.date(QuizResult.created_at).desc())\
         .limit(30).all()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_quizzes': total_quizzes,
                'active_quiz_takers': active_quiz_takers,
                'average_quiz_score': 0,  # If you have scoring
                'completion_rate': 0      # If you track completion
            },
            'recent_trends': [
                {'date': str(d[0]), 'count': d[1]} for d in quizzes_by_date
            ]
        })
        
    except Exception as e:
        print(f"Quiz analytics error: {str(e)}")
        return jsonify({
            'success': True,
            'stats': {
                'total_quizzes': 0,
                'active_quiz_takers': 0,
                'average_quiz_score': 0,
                'completion_rate': 0
            },
            'recent_trends': []
        })

@admin_bp.route('/quiz-analytics/stats')
@jwt_required()
def get_quiz_stats():
    """Get quiz analytics statistics"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        # Total quizzes
        total_quizzes = QuizResult.query.count()
        
        # Unique users who took quizzes
        unique_users = db.session.query(
            func.count(distinct(QuizResult.user_id))
        ).scalar() or 0
        
        # Recent quizzes with user info
        recent_quizzes = QuizResult.query\
            .join(User, QuizResult.user_id == User.id)\
            .order_by(QuizResult.created_at.desc())\
            .limit(10)\
            .all()
        
        # Calculate top genres from JSON data
        all_genres = []
        for quiz in QuizResult.query.with_entities(QuizResult.top_genres).all():
            if quiz.top_genres:
                try:
                    # Parse JSON array from top_genres field
                    genres = json.loads(quiz.top_genres)
                    if isinstance(genres, list):
                        all_genres.extend(genres)
                except:
                    continue
        
        # Count genres and get top 10
        top_genres = []
        if all_genres:
            genre_counts = Counter(all_genres)
            top_genres = [{"genre": g, "count": c} for g, c in genre_counts.most_common(10)]
        
        # Process recent quizzes
        recent_quizzes_data = []
        for q in recent_quizzes:
            try:
                # Parse top_genres JSON
                top_genres_list = json.loads(q.top_genres) if q.top_genres else []
                
                recent_quizzes_data.append({
                    'id': q.id,
                    'user_name': q.user.name if q.user else 'Unknown',
                    'user_email': q.user.email if q.user else '',
                    'top_genres': top_genres_list,  # This is the array
                    'created_at': q.created_at.isoformat() if q.created_at else None
                })
            except:
                continue
        
        return jsonify({
            'success': True,
            'stats': {
                'total_quizzes': total_quizzes,
                'unique_users': unique_users,
                'avg_quizzes_per_user': round(total_quizzes / unique_users, 2) if unique_users > 0 else 0
            },
            'top_genres': top_genres,
            'recent_quizzes': recent_quizzes_data
        })
        
    except Exception as e:
        print(f"Quiz analytics error: {str(e)}")
        return jsonify({
            'success': True,
            'stats': {
                'total_quizzes': 0,
                'unique_users': 0,
                'avg_quizzes_per_user': 0
            },
            'top_genres': [],
            'recent_quizzes': []
        })

@admin_bp.route('/reports/export/<report_type>')
@jwt_required()
def export_report(report_type):
    """Export data as CSV"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    if report_type == 'users':
        users = User.query.all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['ID', 'Name', 'Email', 'Join Date', 'Last Login', 'Is Admin'])
        
        # Write data
        for user in users:
            writer.writerow([
                user.id,
                user.name,
                user.email,
                user.join_date.strftime('%Y-%m-%d') if user.join_date else '',
                user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else '',
                'Yes' if user.is_admin else 'No',
                'Yes' if user.is_active else 'No'
            ])
        
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment;filename=users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    elif report_type == 'movies':
        movies = Movie.query.all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['ID', 'Title', 'Year', 'Genres', 'Rating', 'Runtime', 'Director', 'Created At'])
        
        for movie in movies:
            writer.writerow([
                movie.id,
                movie.title,
                movie.year,
                movie.genres,
                movie.rating,
                movie.runtime,
                movie.director,
                movie.created_at.strftime('%Y-%m-%d %H:%M:%S') if movie.created_at else ''
            ])
        
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment;filename=movies_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    elif report_type == 'quiz-results':
        results = QuizResult.query.join(User).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['Quiz ID', 'User Name', 'User Email', 'Profile Type', 'Profile Name', 'Top Genres', 'Tags', 'Date Taken'])
        
        for result in results:
            try:
                # Parse JSON data
                top_genres = json.loads(result.top_genres) if result.top_genres else []
                tags = json.loads(result.tags) if result.tags else []
                
                writer.writerow([
                    result.id,
                    result.user.name if result.user else 'Unknown',
                    result.user.email if result.user else '',
                    result.profile_type,
                    result.profile_name,
                    ', '.join(top_genres) if isinstance(top_genres, list) else str(top_genres),
                    ', '.join(tags) if isinstance(tags, list) else str(tags),
                    result.created_at.strftime('%Y-%m-%d %H:%M:%S') if result.created_at else ''
                ])
            except Exception as e:
                print(f"Error processing quiz result {result.id}: {e}")
                continue
        
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f"attachment;filename=quiz_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    
    return jsonify({'error': 'Invalid report type'}), 400
# Add this temporary debug endpoint
@admin_bp.route('/quiz-analytics/debug')
@jwt_required()
def quiz_debug():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    # Debug: Check what's in QuizResult
    all_quizzes = QuizResult.query.all()
    quiz_count = QuizResult.query.count()
    
    # Show sample data if exists
    sample_data = []
    if all_quizzes:
        for i, quiz in enumerate(all_quizzes[:3]):  # First 3
            sample_data.append({
                'id': quiz.id,
                'user_id': quiz.user_id,
                'top_genres': quiz.top_genres,
                'created_at': quiz.created_at.isoformat() if quiz.created_at else None
            })
    
    return jsonify({
        'debug': True,
        'quiz_count': quiz_count,
        'sample_data': sample_data,
        'quiz_columns': [c.key for c in QuizResult.__table__.columns] if hasattr(QuizResult, '__table__') else []
    })


@admin_bp.route('/movies/bulk', methods=['POST'])
@jwt_required()
def bulk_upload_movies():
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, list):
            return jsonify({'success': False, 'message': 'Invalid data format'}), 400
        
        movies_added = 0
        errors = []
        
        for i, movie_data in enumerate(data):
            try:
                # Validate required fields
                if not movie_data.get('title'):
                    errors.append(f'Row {i+1}: Missing title')
                    continue
                
                # Create new movie
                # Update these lines in your loop to handle both versions of header names
                movie = Movie(
                title=movie_data.get('title').strip(),
                genres=movie_data.get('genres') or '',
                rating=float(movie_data.get('rating') or 0),
                year=int(movie_data.get('year')) if movie_data.get('year') else None,
                runtime=int(movie_data.get('runtime')) if movie_data.get('runtime') else None,
                director=movie_data.get('director') or '',
                cast=movie_data.get('cast') or '',
                plot=movie_data.get('plot') or '',
                keywords=movie_data.get('keywords') or '',
                popularity=float(movie_data.get('popularity') or 0),
                img=movie_data.get('img') or ''  # or handle poster_filename if uploading files
            )
                db.session.add(movie)
                movies_added += 1
                
            except Exception as e:
                errors.append(f'Row {i+1}: {str(e)}')
                continue
        
        if movies_added > 0:
            db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Added {movies_added} movies successfully',
            'added': movies_added,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500