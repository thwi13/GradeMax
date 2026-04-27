# GradeFlow: Grade Tracker & Predictor

A beautiful, dynamic web application to track your academic progress and predict the grades you need to hit your target goals. Built with a modern design using Flask for the backend, SQLite for the database, and Vanilla HTML/CSS/JS for the frontend.

## Features

- **Beautiful UI**: Modern glassmorphism design, dark mode, gradients, and micro-animations.
- **Track Subjects**: Add multiple subjects with a specific target grade.
- **Manage Assessments**: Add assignments, midterms, finals, etc. Provide their weight (%) and score (%).
- **Grade Prediction**: Automatically calculates your current grade and predicts the average score you need on remaining assessments to hit your target.
- **Responsive**: Works on desktop and mobile devices.

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom properties, animations), Vanilla JS (Fetch API)
- **Backend**: Python, Flask, Flask-SQLAlchemy
- **Database**: SQLite

## How to Run Locally

1. **Install Dependencies**
   Ensure you have Python installed, then navigate to the `grade-tracker` folder and run:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**
   Start the Flask development server:
   ```bash
   python app.py
   ```

3. **View the App**
   Open your browser and navigate to `http://127.0.0.1:5000/`

## How to Use
1. Enter a Subject Name and your Target Grade (e.g., 90%).
2. Click **Add Subject**.
3. For the newly added subject, click **Add Assessment**.
4. Enter the assessment name (e.g., "Midterm 1"), its weight (e.g., 30%), and your score if you've taken it. Leave the score blank if it's an upcoming exam.
5. The app will calculate what you need to average on your remaining assessments to achieve your target grade!
