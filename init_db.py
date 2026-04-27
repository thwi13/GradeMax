import urllib.parse
from app import app, db

# URL encode the password for SQLAlchemy
password = urllib.parse.quote_plus("[.gEaJYtp7Df?&82]")
db_url = f"postgresql://postgres:{password}@db.fdtcfjtwzuqyypypfozx.supabase.co:5432/postgres"

app.config['SQLALCHEMY_DATABASE_URI'] = db_url

with app.app_context():
    db.create_all()
    print("Tables initialized successfully in Supabase!")
