// =======================================================================
// CONFIGURATION
// =======================================================================

// For demo/local use only.
// Never expose production API keys in frontend code.
const GROQ_API_KEY = "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";

// =======================================================================
// STATE & DOM ELEMENTS
// =======================================================================

let quizState = {
    title: "",
    questions: [],
    currentIndex: 0,
    score: 0,
    userAnswers: []
};

// DOM Cache
const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen')
};

const setupForm = document.getElementById('setup-form');
const generateBtn = document.getElementById('generate-btn');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const closeErrorBtn = document.getElementById('close-error');

const nextBtn = document.getElementById('next-btn');
const optionsContainer = document.getElementById('options-container');
const explanationText = document.getElementById('explanation-text');

// =======================================================================
// EVENT LISTENERS
// =======================================================================

setupForm.addEventListener('submit', handleGenerateQuiz);
nextBtn.addEventListener('click', nextQuestion);
document.getElementById('restart-btn').addEventListener('click', restartQuiz);
closeErrorBtn.addEventListener('click', hideError);

// =======================================================================
// CORE FUNCTIONS
// =======================================================================

async function handleGenerateQuiz(e) {
    e.preventDefault();
    hideError();

    const topic = document.getElementById('topic').value.trim();
    const numQuestions = document.getElementById('num-questions').value;
    const difficulty = document.getElementById('difficulty').value;

    if (!topic) {
        showError("Please enter a quiz topic.");
        return;
    }
    if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY") {
        showError("Please configure your Groq API Key in script.js");
        return;
    }

    switchScreen('loading');

    try {
        const quizData = await fetchQuizFromGroq(topic, numQuestions, difficulty);
        
        if (!validateQuizData(quizData, parseInt(numQuestions))) {
            throw new Error("AI returned malformed or incomplete quiz data.");
        }

        initializeQuiz(quizData);
    } catch (error) {
        console.error("Quiz Generation Error:", error);
        switchScreen('setup');
        showError(error.message || "Failed to generate quiz. Please try again.");
    }
}

async function fetchQuizFromGroq(topic, numQuestions, difficulty) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    // Rigid prompt to force valid JSON output
    const systemPrompt = `You are an expert AI quiz generator. 
You must generate exactly ${numQuestions} multiple-choice questions on the topic: "${topic}" at a "${difficulty}" difficulty level.
You must return ONLY a raw, valid JSON object. Do NOT wrap it in markdown code blocks. Do not add any conversational text.
Each question MUST have exactly 4 options.
The "answer" field MUST be an integer (0, 1, 2, or 3) representing the index of the correct option.
Use this exact JSON structure:
{
  "quizTitle": "A catchy title for the quiz",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "answer": 0,
      "explanation": "Short explanation of the correct answer."
    }
  ]
}`;

    const payload = {
        model: "openai/gpt-oss-120b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the JSON quiz now." }
        ],
        temperature: 0.3,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content;
    
    // Clean up potential markdown formatting from AI
    if (content) {
        content = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
    }

    return JSON.parse(content);
}

function validateQuizData(data, expectedCount) {
    if (!data || !data.quizTitle || !Array.isArray(data.questions)) return false;
    if (data.questions.length !== expectedCount) return false;

    return data.questions.every(q => {
        return q.question && 
               Array.isArray(q.options) && 
               q.options.length === 4 && 
               typeof q.answer === 'number' && 
               q.answer >= 0 && q.answer <= 3 &&
               q.explanation;
    });
}

// =======================================================================
// QUIZ UI & LOGIC
// =======================================================================

function initializeQuiz(data) {
    quizState.title = data.quizTitle;
    quizState.questions = data.questions;
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.userAnswers = [];

    document.getElementById('quiz-title').innerText = quizState.title;
    switchScreen('quiz');
    displayQuestion();
}

function displayQuestion() {
    const qData = quizState.questions[quizState.currentIndex];
    
    // Update Header & Progress
    document.getElementById('question-tracker').innerText = `Question ${quizState.currentIndex + 1} of ${quizState.questions.length}`;
    const progressPercent = ((quizState.currentIndex) / quizState.questions.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPercent}%`;
    
    // Render Question
    document.getElementById('question-text').innerText = qData.question;
    
    // Render Options
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    
    qData.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<strong>${letters[index]}.</strong> ${option}`;
        btn.onclick = () => selectAnswer(index, btn);
        optionsContainer.appendChild(btn);
    });

    // Reset Footer
    explanationText.classList.add('hidden');
    nextBtn.classList.add('hidden');
    
    // Update button text if it's the last question
    if (quizState.currentIndex === quizState.questions.length - 1) {
        nextBtn.innerText = "Finish Quiz";
    } else {
        nextBtn.innerHTML = "Next Question &rarr;";
    }
}

function selectAnswer(selectedIndex, selectedBtn) {
    const qData = quizState.questions[quizState.currentIndex];
    const isCorrect = (selectedIndex === qData.answer);
    
    // Lock all buttons
    const allBtns = optionsContainer.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);

    // Track Answer
    quizState.userAnswers.push({
        question: qData.question,
        userAnswer: qData.options[selectedIndex],
        correctAnswer: qData.options[qData.answer],
        isCorrect: isCorrect,
        explanation: qData.explanation
    });

    // Visual Feedback
    if (isCorrect) {
        selectedBtn.classList.add('selected-correct');
        quizState.score++;
    } else {
        selectedBtn.classList.add('selected-incorrect');
        allBtns[qData.answer].classList.add('reveal-correct');
    }

    // Show Explanation & Next Button
    explanationText.innerHTML = `<strong>Explanation:</strong> ${qData.explanation}`;
    explanationText.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

function nextQuestion() {
    quizState.currentIndex++;
    
    if (quizState.currentIndex < quizState.questions.length) {
        displayQuestion();
    } else {
        // Complete Progress Bar before moving
        document.getElementById('progress-bar').style.width = `100%`;
        setTimeout(showResults, 300);
    }
}

// =======================================================================
// RESULTS & RESET
// =======================================================================

function showResults() {
    switchScreen('result');
    
    const total = quizState.questions.length;
    const score = quizState.score;
    const percentage = Math.round((score / total) * 100);
    
    // Update Score Circle & UI
    document.getElementById('score-percentage').innerText = `${percentage}%`;
    document.getElementById('score-text').innerText = `${score} / ${total}`;
    
    const circle = document.querySelector('.score-circle');
    circle.style.background = `conic-gradient(var(--primary-color) ${percentage}%, rgba(255,255,255,0.1) 0%)`;

    // Dynamic Message
    let msg = "Keep practicing!";
    if (percentage >= 90) msg = "Excellent work!";
    else if (percentage >= 70) msg = "Great job!";
    else if (percentage >= 50) msg = "Good effort!";
    document.getElementById('performance-msg').innerText = msg;

    // Render Review List
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.innerHTML = '';
    
    quizState.userAnswers.forEach((ans, idx) => {
        const item = document.createElement('div');
        item.className = `review-item ${ans.isCorrect ? 'rev-correct' : 'rev-incorrect'}`;
        
        item.innerHTML = `
            <h4>Q${idx + 1}. ${ans.question}</h4>
            <div class="ans-row">Your Answer: <span class="ans-val">${ans.userAnswer}</span></div>
            ${!ans.isCorrect ? `<div class="ans-row">Correct Answer: <span class="ans-val">${ans.correctAnswer}</span></div>` : ''}
            <div class="review-status ${ans.isCorrect ? 'status-c' : 'status-i'}">
                ${ans.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </div>
            <div class="review-exp">${ans.explanation}</div>
        `;
        reviewContainer.appendChild(item);
    });
}

function restartQuiz() {
    // Reset Form
    document.getElementById('topic').value = '';
    switchScreen('setup');
}

// =======================================================================
// UTILITIES
// =======================================================================

function switchScreen(activeScreenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    screens[activeScreenId].classList.remove('hidden');
    screens[activeScreenId].classList.add('active');
}

function showError(msg) {
    errorMessage.innerText = msg;
    errorToast.classList.remove('hidden');
    setTimeout(hideError, 6000);
}

function hideError() {
    errorToast.classList.add('hidden');
}
