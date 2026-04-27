import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root_dir)

from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__,
            template_folder=os.path.join(root_dir, 'templates'),
            static_folder=os.path.join(root_dir, 'static'))

app.secret_key = os.environ.get('SECRET_KEY', 'gradeflow-secret-2025-xk92')

# ── Database URL ──────────────────────────────────────────────────────────────
raw_url = os.environ.get('DATABASE_URL', '')

if not raw_url:
    db_url = 'sqlite:////tmp/grades.db'
    logger.warning('No DATABASE_URL set — using /tmp/grades.db (non-persistent)')
elif raw_url.startswith('postgres://'):
    db_url = raw_url.replace('postgres://', 'postgresql+pg8000://', 1)
elif raw_url.startswith('postgresql://') and '+pg8000' not in raw_url:
    db_url = raw_url.replace('postgresql://', 'postgresql+pg8000://', 1)
else:
    db_url = raw_url

logger.info(f'DB: {db_url[:40]}...')

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 280,
}

db = SQLAlchemy(app)

# ── Models ────────────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = 'users'
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name          = db.Column(db.String(100))
    email         = db.Column(db.String(100))
    age           = db.Column(db.Integer)
    student_class = db.Column(db.String(50))
    gender        = db.Column(db.String(20))
    photo_url     = db.Column(db.String(500))
    subjects      = db.relationship('Subject', backref='user', cascade='all, delete-orphan')

class Subject(db.Model):
    __tablename__ = 'subjects'
    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name         = db.Column(db.String(100), nullable=False)
    target_grade = db.Column(db.Float, nullable=False)
    assessments  = db.relationship('Assessment', backref='subject', cascade='all, delete-orphan')

class Assessment(db.Model):
    __tablename__ = 'assessments'
    id         = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    weight     = db.Column(db.Float, nullable=False)
    score      = db.Column(db.Float, nullable=True)

# Create tables once
with app.app_context():
    try:
        db.create_all()
        logger.info('Tables OK')
    except Exception as exc:
        logger.error(f'db.create_all() failed: {exc}')

# ── Auth helpers ──────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return wrapper

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/sw.js')
def sw():
    resp = app.send_static_file('sw.js')
    resp.headers['Service-Worker-Allowed'] = '/'
    return resp

@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.route('/api/check_auth')
def check_auth():
    uid = session.get('user_id')
    if uid:
        user = db.session.get(User, uid)
        if user:
            return jsonify({'authenticated': True, 'user': {
                'username': user.username,
                'name':     user.name,
                'email':    user.email,
                'age':      user.age,
                'class':    user.student_class,
                'gender':   user.gender,
                'photo_url': user.photo_url or
                             f'https://ui-avatars.com/api/?name={user.username}&background=e500e5&color=fff'
            }})
    return jsonify({'authenticated': False})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(force=True)
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username and password required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already taken'}), 400
    user = User(username=data['username'],
                password_hash=generate_password_hash(data['password']))
    db.session.add(user)
    db.session.commit()
    session['user_id'] = user.id
    return jsonify({'message': 'Registered'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'message': 'No data provided'}), 400
    user = User.query.filter_by(username=data.get('username', '')).first()
    if user and check_password_hash(user.password_hash, data.get('password', '')):
        session['user_id'] = user.id
        return jsonify({'message': 'Logged in'})
    return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    user = db.session.get(User, session['user_id'])
    data = request.get_json(force=True) or {}
    user.name          = data.get('name',      user.name)
    user.email         = data.get('email',     user.email)
    user.student_class = data.get('class',     user.student_class)
    user.gender        = data.get('gender',    user.gender)
    user.photo_url     = data.get('photo_url', user.photo_url)
    if data.get('age') not in [None, '']:
        user.age = int(data['age'])
    db.session.commit()
    return jsonify({'message': 'Profile updated'})

# ── Subjects ──────────────────────────────────────────────────────────────────
@app.route('/api/subjects', methods=['GET'])
@login_required
def get_subjects():
    subs = Subject.query.filter_by(user_id=session['user_id']).all()
    result = []
    for s in subs:
        aa = s.assessments
        earned   = sum(a.score * a.weight / 100 for a in aa if a.score is not None)
        w_graded = sum(a.weight for a in aa if a.score is not None)
        w_remain = sum(a.weight for a in aa if a.score is None)
        cur_grade = (earned / (w_graded / 100)) if w_graded else 0
        needed_pts = s.target_grade - earned
        needed_avg = (needed_pts / (w_remain / 100)) if w_remain else None
        if w_remain == 0 and needed_pts > 0.01:
            needed_avg = -1
        result.append({
            'id': s.id, 'name': s.name, 'target_grade': s.target_grade,
            'current_grade': cur_grade, 'weight_graded': w_graded,
            'weight_remaining': w_remain, 'needed_avg': needed_avg,
            'assessments': [{'id': a.id, 'name': a.name,
                             'weight': a.weight, 'score': a.score} for a in aa]
        })
    return jsonify(result)

@app.route('/api/subjects', methods=['POST'])
@login_required
def add_subject():
    data = request.get_json(force=True)
    sub = Subject(user_id=session['user_id'],
                  name=data['name'],
                  target_grade=float(data['target_grade']))
    db.session.add(sub)
    db.session.commit()
    return jsonify({'id': sub.id})

@app.route('/api/subjects/<int:sid>', methods=['DELETE'])
@login_required
def delete_subject(sid):
    sub = Subject.query.filter_by(id=sid, user_id=session['user_id']).first_or_404()
    db.session.delete(sub)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

# ── Assessments ───────────────────────────────────────────────────────────────
@app.route('/api/assessments', methods=['POST'])
@login_required
def add_assessment():
    data = request.get_json(force=True)
    sub = Subject.query.filter_by(id=data['subject_id'],
                                  user_id=session['user_id']).first_or_404()
    a = Assessment(
        subject_id=sub.id,
        name=data['name'],
        weight=float(data['weight']),
        score=float(data['score']) if data.get('score') not in [None, ''] else None
    )
    db.session.add(a)
    db.session.commit()
    return jsonify({'id': a.id})

@app.route('/api/assessments/<int:aid>', methods=['PUT', 'DELETE'])
@login_required
def manage_assessment(aid):
    a = (Assessment.query
         .join(Subject)
         .filter(Assessment.id == aid, Subject.user_id == session['user_id'])
         .first_or_404())
    if request.method == 'DELETE':
        db.session.delete(a)
        db.session.commit()
        return jsonify({'message': 'Deleted'})
    data = request.get_json(force=True) or {}
    if 'name'   in data: a.name   = data['name']
    if 'weight' in data: a.weight = float(data['weight'])
    if 'score'  in data:
        a.score = float(data['score']) if data['score'] not in [None, ''] else None
    db.session.commit()
    return jsonify({'message': 'Updated'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
