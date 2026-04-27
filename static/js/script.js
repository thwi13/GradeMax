let currentSubjectId = null;
let isDarkMode = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    }

    // Theme setup
    const themeBtn = document.getElementById('theme-toggle');
    const themeName = document.getElementById('theme-name');
    
    themeBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        themeBtn.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        themeName.innerText = isDarkMode ? 'Earth-1610 (Miles)' : 'Academic Earth-65';
    });

    // Auth check
    checkAuth();

    // Event Listeners for Forms
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.innerText = 'LOGGING IN...';
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                })
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (res.ok) {
                checkAuth();
            } else {
                errEl.innerText = data.message || 'Login failed. Try again.';
                errEl.style.display = 'block';
            }
        } catch (err) {
            errEl.innerText = 'Network error: ' + err.message;
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerText = 'LOGIN';
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.innerText = 'REGISTERING...';
        const errEl = document.getElementById('reg-error');
        errEl.style.display = 'none';
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: document.getElementById('reg-username').value,
                    password: document.getElementById('reg-password').value
                })
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (res.ok) {
                checkAuth();
            } else {
                errEl.innerText = data.message || 'Registration failed. Try again.';
                errEl.style.display = 'block';
            }
        } catch (err) {
            errEl.innerText = 'Network error: ' + err.message;
            errEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerText = 'REGISTER';
        }
    });

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('prof-name').value;
        const email = document.getElementById('prof-email').value;
        const age = document.getElementById('prof-age').value;
        const studentClass = document.getElementById('prof-class').value;
        const gender = document.getElementById('prof-gender').value;
        const photo_url = document.getElementById('prof-photo_url').value;

        await fetch('/api/profile', {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, email, age, class: studentClass, gender, photo_url})
        });
        checkAuth();
    });

    document.getElementById('add-subject-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('subject-name').value;
        const target = document.getElementById('target-grade').value;
        await fetch('/api/subjects', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, target_grade: target })
        });
        document.getElementById('add-subject-form').reset();
        closeSubjectModal();
        fetchSubjects();
    });

    document.getElementById('assessment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const assessId = document.getElementById('modal-assessment-id').value;
        const subjId = document.getElementById('modal-assessment-subject-id').value || currentSubjectId;
        const name = document.getElementById('assessment-name').value;
        const weight = document.getElementById('assessment-weight').value;
        const score = document.getElementById('assessment-score').value;

        const data = { name, weight, score: score !== '' ? score : null };

        if (assessId) {
            await fetch(`/api/assessments/${assessId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            data.subject_id = subjId;
            await fetch('/api/assessments', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        closeAssessmentModal();
        if (currentSubjectId) openSubjectDetail(currentSubjectId);
        fetchSubjects();
    });
});

async function checkAuth() {
    const res = await fetch('/api/check_auth');
    const data = await res.json();
    if (data.authenticated) {
        currentUser = data.user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
        // Populate User UI
        document.getElementById('nav-user-photo').src = currentUser.photo_url;
        document.getElementById('dropdown-name').innerText = currentUser.name || currentUser.username;
        document.getElementById('dropdown-email').innerText = currentUser.email ? currentUser.email : '@'+currentUser.username;
        
        // Populate Profile Form
        document.getElementById('profile-edit-photo').src = currentUser.photo_url;
        document.getElementById('prof-photo_url').value = currentUser.photo_url || '';
        document.getElementById('prof-name').value = currentUser.name || '';
        document.getElementById('prof-email').value = currentUser.email || '';
        document.getElementById('prof-age').value = currentUser.age || '';
        document.getElementById('prof-class').value = currentUser.class || '';
        document.getElementById('prof-gender').value = currentUser.gender || '';

        fetchSubjects();
    } else {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-form-wrapper').style.display = 'none';
    document.getElementById('register-form-wrapper').style.display = 'none';

    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`${tab}-form-wrapper`).style.display = 'block';
}

async function logoutUser(e) {
    if(e) e.preventDefault();
    await fetch('/api/logout', {method: 'POST'});
    currentUser = null;
    toggleProfileMenu(null, true);
    checkAuth();
}

function toggleProfileMenu(e, forceClose=false) {
    if(e) e.preventDefault();
    const drop = document.getElementById('profile-dropdown');
    if(forceClose) drop.classList.remove('active');
    else drop.classList.toggle('active');
}

// Close dropdown when clicking outside
window.addEventListener('click', function(e) {
    const avatar = document.querySelector('.user-avatar');
    const dropdown = document.getElementById('profile-dropdown');
    if (!avatar.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

function getLetterGrade(percentage) {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 60) return 'D';
    return 'F';
}

function getGPA(percentage) {
    if (percentage >= 93) return 4.0;
    if (percentage >= 90) return 3.7;
    if (percentage >= 87) return 3.3;
    if (percentage >= 83) return 3.0;
    if (percentage >= 80) return 2.7;
    if (percentage >= 77) return 2.3;
    if (percentage >= 73) return 2.0;
    if (percentage >= 70) return 1.7;
    if (percentage >= 67) return 1.3;
    if (percentage >= 65) return 1.0;
    return 0.0;
}

function getRandomIcon() {
    const icons = ['fa-flask', 'fa-book', 'fa-calculator', 'fa-globe', 'fa-atom', 'fa-dna', 'fa-code', 'fa-palette'];
    return icons[Math.floor(Math.random() * icons.length)];
}

async function fetchSubjects() {
    const res = await fetch('/api/subjects');
    if(!res.ok) return;
    const subjects = await res.json();
    
    const container = document.getElementById('subjects-container');
    container.innerHTML = '';
    const barsContainer = document.getElementById('dashboard-bars');
    barsContainer.innerHTML = '';
    const allAssessContainer = document.getElementById('all-assessments-container');
    allAssessContainer.innerHTML = '';

    let overallSum = 0;
    let gradedSubjectsCount = 0;
    let totalWeightGraded = 0;
    let totalWeightExpected = 0;
    let totalGpa = 0;

    let masterySum = 0, proximitySum = 0, consistencyArr = [], allAssessments = [];

    subjects.forEach(sub => {
        sub.assessments.forEach(a => allAssessments.push({ ...a, subjectName: sub.name, subjectId: sub.id }));

        const letter = getLetterGrade(sub.current_grade || 0);
        const icon = getRandomIcon();
        
        const card = document.createElement('div');
        card.className = 'subject-item';
        card.onclick = () => openSubjectDetail(sub.id);
        card.innerHTML = `
            <div class="subject-icon"><i class="fas ${icon}"></i></div>
            <div class="subject-grade" style="color: ${sub.current_grade >= sub.target_grade ? 'var(--text-main)' : 'var(--magenta)'}">${sub.weight_graded > 0 ? letter : '-'}</div>
            <h3 class="subject-title">${sub.name}</h3>
            <p class="subject-subtitle">${sub.name} &bull; Target: ${sub.target_grade}%</p>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${Math.min(100, sub.current_grade || 0)}%; background: ${sub.current_grade >= sub.target_grade ? 'var(--cyan)' : 'var(--magenta)'}"></div>
            </div>
        `;
        container.appendChild(card);

        totalWeightExpected += 100;
        totalWeightGraded += sub.weight_graded;

        if (sub.weight_graded > 0) {
            overallSum += sub.current_grade;
            totalGpa += getGPA(sub.current_grade);
            gradedSubjectsCount++;
            
            masterySum += sub.current_grade;
            proximitySum += Math.max(0, 100 - Math.abs(sub.target_grade - sub.current_grade));
            consistencyArr.push(sub.current_grade);
            
            const height = Math.min(100, sub.current_grade);
            barsContainer.innerHTML += `
                <div class="bar-group">
                    <div class="bar-bg">
                        <div class="bar" style="height: ${height}%;"></div>
                    </div>
                    <div class="bar-label" title="${sub.name}">${sub.name.substring(0,4)}</div>
                </div>
            `;
        }
    });

    document.getElementById('overall-subjects').innerText = subjects.length;
    document.getElementById('overall-completion').innerText = totalWeightExpected > 0 ? Math.round((totalWeightGraded / totalWeightExpected) * 100) + '%' : '0%';

    let mastery = 50, targetGap = 50, momentum = 50, consistency = 50, completion = 0;

    if (gradedSubjectsCount > 0) {
        const avg = overallSum / gradedSubjectsCount;
        const gpa = totalGpa / gradedSubjectsCount;
        document.getElementById('overall-avg').innerText = getLetterGrade(avg);
        document.getElementById('gpa-value').innerText = gpa.toFixed(2);
        
        mastery = avg;
        targetGap = proximitySum / gradedSubjectsCount;
        completion = (totalWeightGraded / totalWeightExpected) * 100;
        momentum = Math.min(100, avg + (completion * 0.2));
        
        const max = Math.max(...consistencyArr);
        const min = Math.min(...consistencyArr);
        consistency = 100 - Math.min(100, (max - min) * 2);
    } else {
        document.getElementById('overall-avg').innerText = 'N/A';
        document.getElementById('gpa-value').innerText = '0.00';
    }

    drawRadarChart(mastery, targetGap, momentum, consistency, completion);
    renderAllAssessments(allAssessments);
}

function drawRadarChart(m, t, mo, co, cm) {
    const poly = document.getElementById('radar-data-poly');
    const cx = 50, cy = 50, r = 45;
    const angles = [0, 72, 144, 216, 288].map(a => (a - 90) * Math.PI / 180);
    const values = [m, t, mo, co, cm];
    
    let points = '';
    for(let i=0; i<5; i++) {
        const val = Math.max(10, Math.min(100, values[i])) / 100;
        const x = cx + r * val * Math.cos(angles[i]);
        const y = cy + r * val * Math.sin(angles[i]);
        points += `${x},${y} `;
    }
    poly.setAttribute('points', points.trim());
}

function renderAllAssessments(assessments) {
    const container = document.getElementById('all-assessments-container');
    if (assessments.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">No assessments found.</p>';
        return;
    }
    
    assessments.forEach(a => {
        const scoreVal = a.score !== null ? `${a.score} / 100` : 'Upcoming';
        const letter = a.score !== null ? getLetterGrade(a.score) : '-';
        const icon = a.score !== null ? 'fa-check-circle' : 'fa-clock';
        
        container.innerHTML += `
            <div class="assessment-card" onclick="editAssessment(${a.id}, ${a.subjectId}, '${a.name}', ${a.weight}, ${a.score})">
                <div class="assessment-icon"><i class="fas ${icon}"></i></div>
                <div class="assessment-details">
                    <h4 style="font-size:0.8rem; color:var(--magenta);">${a.subjectName.toUpperCase()}</h4>
                    <h4>${a.name}</h4>
                    <div class="assessment-meta">
                        <span>Weight: ${a.weight}%</span>
                    </div>
                </div>
                <div class="assessment-score-area">
                    <div class="score-label">SCORE</div>
                    <div class="score-val">${scoreVal}</div>
                </div>
                <div class="letter-grade-box ${a.score !== null && a.score >= 90 ? 'cyan-bg' : ''}">${letter}</div>
            </div>
        `;
    });
}

async function openSubjectDetail(id) {
    currentSubjectId = id;
    const res = await fetch('/api/subjects');
    const subjects = await res.json();
    const sub = subjects.find(s => s.id === id);
    if (!sub) return;

    hideAllViews();
    document.getElementById('subject-detail-view').classList.add('active');

    document.getElementById('detail-subject-tag').innerText = (sub.name.substring(0,4) + '402').toUpperCase();
    document.getElementById('detail-subject-name').innerText = sub.name.toUpperCase();
    document.getElementById('detail-subject-target').innerText = `Target Grade: ${sub.target_grade}%`;
    document.getElementById('detail-current-grade').innerText = sub.weight_graded > 0 ? sub.current_grade.toFixed(1) + '%' : 'N/A';

    const assContainer = document.getElementById('assessments-container');
    assContainer.innerHTML = '';
    
    sub.assessments.forEach(a => {
        const scoreVal = a.score !== null ? `${a.score} <span style="font-size:0.8rem; color:var(--text-muted)">/ 100</span>` : '<span style="font-size:0.9rem; color:var(--text-muted); font-style:italic;">Upcoming</span>';
        const letter = a.score !== null ? getLetterGrade(a.score) : '-';
        const icon = a.score !== null ? 'fa-file-alt' : 'fa-calendar';
        
        assContainer.innerHTML += `
            <div class="assessment-card" onclick="editAssessment(${a.id}, ${sub.id}, '${a.name}', ${a.weight}, ${a.score})">
                <div class="assessment-icon"><i class="fas ${icon}"></i></div>
                <div class="assessment-details">
                    <h4>${a.name}</h4>
                    <div class="assessment-meta">
                        <span><i class="fas fa-weight-hanging"></i> Weight: ${a.weight}%</span>
                    </div>
                </div>
                <div class="assessment-score-area">
                    <div class="score-label">SCORE</div>
                    <div class="score-val">${scoreVal}</div>
                </div>
                <div class="letter-grade-box ${a.score !== null && a.score >= 90 ? 'cyan-bg' : ''}">${letter}</div>
            </div>
        `;
    });

    const predInfo = document.getElementById('predictor-info');
    let predHtml = '';
    if (sub.current_grade >= sub.target_grade && sub.weight_graded > 0) {
        predHtml = `<p class="predictor-info-text">You are <strong>exceeding</strong> your target of ${sub.target_grade}%! Keep your momentum.</p>`;
    } else if (sub.needed_avg === null) {
        predHtml = `<p class="predictor-info-text">Add scores to your assessments to see predictions.</p>`;
    } else if (sub.needed_avg === -1 || sub.needed_avg > 100) {
        predHtml = `<p class="predictor-info-text">It's mathematically <strong>impossible</strong> to reach ${sub.target_grade}%. Time to re-evaluate.</p>`;
    } else {
        predHtml = `<p class="predictor-info-text">To hit your <strong>${sub.target_grade}% target</strong>, you need an average of <strong class="cyan-text">${sub.needed_avg.toFixed(1)}%</strong> on remaining tasks.</p>`;
    }
    predInfo.innerHTML = predHtml;

    const focusList = document.getElementById('dynamic-focus-areas');
    focusList.innerHTML = '';
    if(sub.weight_graded === 0) {
        focusList.innerHTML = '<li>Start your first assignment strong!</li>';
    } else if(sub.current_grade >= sub.target_grade) {
        focusList.innerHTML = '<li>You are performing exceptionally well!</li><li>Maintain current study habits.</li>';
    } else {
        focusList.innerHTML = `<li>Focus on upcoming tasks worth ${sub.weight_remaining}%.</li><li>Review mistakes from past assessments.</li>`;
    }

    document.getElementById('subject-progress-text').innerText = `${sub.weight_graded}%`;
    const bars = document.getElementById('subject-progress-bars').children;
    for(let i=0; i<4; i++) {
        bars[i].style.background = (sub.weight_graded > i*25) ? 'var(--magenta)' : 'transparent';
    }
}

async function deleteCurrentSubject() {
    if(!currentSubjectId) return;
    if(confirm('Delete this entire subject and all its assessments?')) {
        await fetch(`/api/subjects/${currentSubjectId}`, { method: 'DELETE' });
        currentSubjectId = null;
        showDashboard(new Event('click'));
    }
}

async function deleteCurrentAssessment() {
    const id = document.getElementById('modal-assessment-id').value;
    if(id && confirm('Delete this assessment?')) {
        await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
        closeAssessmentModal();
        if(currentSubjectId) openSubjectDetail(currentSubjectId);
        fetchSubjects();
    }
}

function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.top-nav a').forEach(el => el.classList.remove('active'));
}

function showDashboard(e) {
    if(e) e.preventDefault();
    hideAllViews();
    document.getElementById('dashboard-view').classList.add('active');
    document.querySelector('.nav-item').classList.add('active');
    document.querySelector('.top-nav a').classList.add('active');
    fetchSubjects();
}

function showAllAssessments(e) {
    if(e) e.preventDefault();
    hideAllViews();
    document.getElementById('all-assessments-view').classList.add('active');
    e.target.classList.add('active');
}

function showProfileView(e) {
    if(e) e.preventDefault();
    hideAllViews();
    document.getElementById('profile-view').classList.add('active');
    toggleProfileMenu(null, true);
}

function scrollToSection(e, id) {
    e.preventDefault();
    showDashboard(null);
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    e.currentTarget.classList.add('active');
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// Modals
function openSubjectModal() { document.getElementById('subject-modal').classList.add('active'); }
function closeSubjectModal() { document.getElementById('subject-modal').classList.remove('active'); }

function openAssessmentModal() {
    document.getElementById('modal-title').innerText = 'NEW ASSESSMENT';
    document.getElementById('modal-assessment-id').value = '';
    document.getElementById('modal-assessment-subject-id').value = '';
    document.getElementById('assessment-form').reset();
    document.getElementById('delete-assessment-btn').style.display = 'none';
    document.getElementById('assessment-modal').classList.add('active');
}
function closeAssessmentModal() { document.getElementById('assessment-modal').classList.remove('active'); }

function editAssessment(id, subjId, name, weight, score) {
    document.getElementById('modal-title').innerText = 'EDIT ASSESSMENT';
    document.getElementById('modal-assessment-id').value = id;
    document.getElementById('modal-assessment-subject-id').value = subjId;
    document.getElementById('assessment-name').value = name;
    document.getElementById('assessment-weight').value = weight;
    document.getElementById('assessment-score').value = score !== null ? score : '';
    document.getElementById('delete-assessment-btn').style.display = 'flex';
    document.getElementById('assessment-modal').classList.add('active');
}
