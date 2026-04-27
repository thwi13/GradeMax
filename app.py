import os
from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'super-secret-gradeflow-key')

# Handle Postgres connection strings (Vercel provides postgres:// but SQLAlchemy needs postgresql://)
db_url = os.environ.get('DATABASE_URL', 'sqlite:///grades.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100))
    age = db.Column(db.Integer)
    student_class = db.Column(db.String(50))
    gender = db.Column(db.String(20))
    photo_url = db.Column(db.String(200))
    subjects = db.relationship('Subject', backref='user', cascade='all, delete-orphan')

class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    target_grade = db.Column(db.Float, nullable=False)
    assessments = db.relationship('Assessment', backref='subject', cascade='all, delete-orphan')

class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    score = db.Column(db.Float, nullable=True)

with app.app_context():
    db.create_all()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/sw.js')
def sw():
    response = app.send_static_file('sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    return response

@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({'authenticated': True, 'user': {
                'username': user.username, 'name': user.name, 'email': user.email,
                'age': user.age, 'class': user.student_class, 'gender': user.gender, 
                'photo_url': user.photo_url or f"https://ui-avatars.com/api/?name={user.username}&background=random"
            }})
    return jsonify({'authenticated': False})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    
    hashed = generate_password_hash(data['password'])
    new_user = User(username=data['username'], password_hash=hashed)
    db.session.add(new_user)
    db.session.commit()
    session['user_id'] = new_user.id
    return jsonify({'message': 'Registered successfully'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        session['user_id'] = user.id
        return jsonify({'message': 'Logged in successfully'})
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out'})

@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    user = User.query.get(session['user_id'])
    data = request.json
    if 'name' in data: user.name = data['name']
    if 'email' in data: user.email = data['email']
    if 'age' in data: user.age = int(data['age']) if data['age'] else None
    if 'class' in data: user.student_class = data['class']
    if 'gender' in data: user.gender = data['gender']
    if 'photo_url' in data: user.photo_url = data['photo_url']
    db.session.commit()
    return jsonify({'message': 'Profile updated'})

@app.route('/api/subjects', methods=['GET'])
@login_required
def get_subjects():
    subjects = Subject.query.filter_by(user_id=session['user_id']).all()
    result = []
    for s in subjects:
        assessments = s.assessments
        current_earned = sum([(a.score * a.weight / 100) for a in assessments if a.score is not None])
        weight_graded = sum([a.weight for a in assessments if a.score is not None])
        weight_remaining = sum([a.weight for a in assessments if a.score is None])
        total_weight = weight_graded + weight_remaining
        
        current_grade = (current_earned / (weight_graded / 100)) if weight_graded > 0 else 0
        needed_points = s.target_grade - current_earned
        needed_avg = (needed_points / (weight_remaining / 100)) if weight_remaining > 0 else None
        
        if weight_remaining == 0 and needed_points > 0.01: needed_avg = -1 

        sub_data = {
            'id': s.id, 'name': s.name, 'target_grade': s.target_grade,
            'current_grade': current_grade, 'weight_graded': weight_graded,
            'weight_remaining': weight_remaining, 'total_weight': total_weight,
            'needed_avg': needed_avg,
            'assessments': [{'id': a.id, 'name': a.name, 'weight': a.weight, 'score': a.score} for a in assessments]
        }
        result.append(sub_data)
    return jsonify(result)

@app.route('/api/subjects', methods=['POST'])
@login_required
def add_subject():
    data = request.json
    new_sub = Subject(user_id=session['user_id'], name=data['name'], target_grade=float(data['target_grade']))
    db.session.add(new_sub)
    db.session.commit()
    return jsonify({'message': 'Subject added', 'id': new_sub.id})

@app.route('/api/subjects/<int:id>', methods=['DELETE'])
@login_required
def delete_subject(id):
    sub = Subject.query.filter_by(id=id, user_id=session['user_id']).first()
    if sub:
        db.session.delete(sub)
        db.session.commit()
        return jsonify({'message': 'Subject deleted'})
    return jsonify({'message': 'Not found'}), 404

@app.route('/api/assessments', methods=['POST'])
@login_required
def add_assessment():
    data = request.json
    sub = Subject.query.filter_by(id=data['subject_id'], user_id=session['user_id']).first()
    if not sub: return jsonify({'message': 'Subject not found'}), 404
    
    new_a = Assessment(
        subject_id=data['subject_id'], name=data['name'], weight=float(data['weight']),
        score=float(data['score']) if data.get('score') not in [None, ''] else None
    )
    db.session.add(new_a)
    db.session.commit()
    return jsonify({'message': 'Assessment added', 'id': new_a.id})

@app.route('/api/assessments/<int:id>', methods=['PUT', 'DELETE'])
@login_required
def manage_assessment(id):
    a = Assessment.query.join(Subject).filter(Assessment.id == id, Subject.user_id == session['user_id']).first()
    if not a: return jsonify({'message': 'Not found'}), 404
    
    if request.method == 'DELETE':
        db.session.delete(a)
        db.session.commit()
        return jsonify({'message': 'Deleted'})
    else:
        data = request.json
        if 'score' in data: a.score = float(data['score']) if data['score'] not in [None, ''] else None
        if 'weight' in data: a.weight = float(data['weight'])
        if 'name' in data: a.name = data['name']
        db.session.commit()
        return jsonify({'message': 'Updated'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
