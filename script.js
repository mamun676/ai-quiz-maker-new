// ==========================================
// CONFIGURATION
// ==========================================
// Paste your Groq API key here
const GROQ_API_KEY = "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"; 

// ==========================================
// STATE MANAGEMENT
// ==========================================
let quizData = null;
let currentQuestionIndex = 0;
let userAnswers = [];

// ==========================================
// DOM ELEMENTS
// ==========================================
const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    error: document.getElementById('error-screen'),
    quiz: document.getElementById('quiz-screen'),
    results: document.getElementById('results-screen')
};

// Setup Inputs
const inputTopic = document.getElementById('topic');
const selectDifficulty = document.getElementById('difficulty');
const selectCount = document.getElementById('questionCount');
const btnGenerate = document.getElementById('btn-generate');

// Quiz Elements
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSubmit = document.getElementById('btn-submit');

// Error Elements
const errorMessage = document.getElementById('error-message');
const btnErrorBack = document.getElementById('btn-error-back');

// Result Elements
const scorePercentage = document.getElementById('score-percentage');
const scoreFraction = document.getElementById('score-fraction');
const scoreMessage = document.getElementById('score-message');
const statCorrect = document.getElementById('stat-correct');
const statWrong = document.getElementById('stat-wrong');
const reviewContainer = document.getElementById('review-container');
const btnRetake = document.getElementById('btn-retake');
const btnNew = document.getElementById('btn-new');

// ==========================================
// EVENT LISTENERS
// ==========================================
btnGenerate.addEventListener('click', handleGenerateClick);
btnPrev.addEventListener('click', previousQuestion);
btnNext.addEventListener('click', nextQuestion);
btnSubmit.addEventListener('click', submitQuiz);
btnErrorBack.addEventListener('click', newQuiz);
btnRetake.addEventListener('click', resetQuiz);
btnNew.addEventListener('click', newQuiz);

// ==========================================
// NAVIGATION & UI
// ==========================================
function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showError(message) {
    errorMessage.textContent = message;
    switchScreen('error');
}

// ==========================================
// API & GENERATION
// ==========================================
async function handleGenerateClick() {
    const topic = inputTopic.value.trim();
    if (!topic) {
        showError("Please enter a topic to generate a quiz.");
        return;
    }
    
    if (GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE" || !GROQ_API_KEY) {
        showError("Missing API Key. Please add your Groq API key in script.js.");
        return;
    }

    const difficulty = selectDifficulty.value;
    const count = parseInt(selectCount.value, 10);

    switchScreen('loading');
    
    try {
        const response = await fetchGroqCompletion(topic, difficulty, count);
        const parsedData = parseJSONResponse(response);
        
        if (!validateQuizData(parsedData, count)) {
            throw new Error("AI generated an invalid quiz structure.");
        }
        
        quizData = parsedData;
        resetQuiz();
    } catch (error) {
        console.error(error);
        showError(error.message || "An unexpected error occurred while contacting the AI.");
    }
}

async function fetchGroqCompletion(topic, difficulty, count) {
    const systemPrompt = `You are an expert quiz generator. Generate high-quality multiple-choice quizzes based on the user's requested topic, difficulty, and number of questions.

Rules:
1. Generate exactly the requested number of questions.
2. Every question must have exactly 4 options.
3. Each option must be unique.
4. Only one option can be correct.
5. Questions must be factually accurate.
6. Match the requested difficulty.
7. Questions must be directly related to the requested topic.
8. Avoid duplicate or extremely similar questions.
9. Include a short explanation for every correct answer.
10. Do not reveal the correct answer outside the JSON structure.
11. Return ONLY valid JSON.
12. Do not use Markdown.
13. Do not include \`\`\`json or code fences.

Return this exact structure:
{
  "title": "string",
  "topic": "string",
  "difficulty": "string",
  "questions": [
    {
      "question": "string",
      "options": [
        "string",
        "string",
        "string",
        "string"
      ],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}

The correctAnswer value must be the zero-based index of the correct option.`;

    const userPrompt = `Topic: ${topic}\nDifficulty: ${difficulty}\nNumber of Questions: ${count}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7
        })
    });

    if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

function parseJSONResponse(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    
    return JSON.parse(cleaned.trim());
}

function validateQuizData(data, expectedCount) {
    if (!data || !Array.isArray(data.questions)) return false;
    if (data.questions.length !== expectedCount) return false;
    
    for (let q of data.questions) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) return false;
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) return false;
        if (!q.explanation) return false;
    }
    return true;
}

// ==========================================
// QUIZ LOGIC
// ==========================================
function startQuiz() {
    switchScreen('quiz');
    renderQuestion();
}

function renderQuestion() {
    const qData = quizData.questions[currentQuestionIndex];
    const totalQ = quizData.questions.length;

    // Progress updating
    progressText.textContent = `QUESTION ${currentQuestionIndex + 1} / ${totalQ}`;
    const percent = ((currentQuestionIndex) / totalQ) * 100;
    progressBar.style.width = `${percent}%`;

    // Question content
    const qNumStr = (currentQuestionIndex + 1).toString().padStart(2, '0');
    questionText.innerHTML = `<span style="color: var(--blue)">Q${qNumStr}.</span> ${qData.question}`;
    
    // Options rendering
    optionsContainer.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];
    
    qData.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'brutal-btn option-btn';
        if (userAnswers[currentQuestionIndex] === index) {
            btn.classList.add('selected');
        }
        btn.innerHTML = `[ ${labels[index]} ] &nbsp; ${opt}`;
        btn.onclick = () => selectAnswer(index);
        optionsContainer.appendChild(btn);
    });

    // Nav Buttons logic
    btnPrev.disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === totalQ - 1) {
        btnNext.classList.add('hidden');
        btnSubmit.classList.remove('hidden');
    } else {
        btnNext.classList.remove('hidden');
        btnSubmit.classList.add('hidden');
    }
}

function selectAnswer(index) {
    userAnswers[currentQuestionIndex] = index;
    renderQuestion(); // Re-render to show selected state
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < quizData.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

// ==========================================
// RESULTS & REVIEW
// ==========================================
function submitQuiz() {
    const total = quizData.questions.length;
    
    // Ensure all questions are answered
    const unanswered = userAnswers.filter(a => a === undefined).length;
    if (unanswered > 0) {
        alert(`You have ${unanswered} unanswered question(s).`);
    }

    progressBar.style.width = `100%`; // Finish progress bar visually

    let correctCount = 0;
    quizData.questions.forEach((q, index) => {
        if (userAnswers[index] === q.correctAnswer) {
            correctCount++;
        }
    });

    showResults(correctCount, total);
}

function showResults(correct, total) {
    switchScreen('results');
    
    const percentage = Math.round((correct / total) * 100);
    scorePercentage.textContent = `${percentage}%`;
    scoreFraction.textContent = `${correct} / ${total}`;
    statCorrect.textContent = correct;
    statWrong.textContent = total - correct;

    // Set Performance Message & Colors
    if (percentage >= 90) {
        scoreMessage.textContent = "EXCELLENT WORK!";
        scorePercentage.style.color = "var(--green)";
    } else if (percentage >= 70) {
        scoreMessage.textContent = "GREAT JOB!";
        scorePercentage.style.color = "var(--blue)";
    } else if (percentage >= 50) {
        scoreMessage.textContent = "KEEP PRACTICING!";
        scorePercentage.style.color = "var(--yellow)";
    } else {
        scoreMessage.textContent = "BACK TO LEARNING!";
        scorePercentage.style.color = "var(--red)";
    }

    renderReview();
}

function renderReview() {
    reviewContainer.innerHTML = '';
    
    quizData.questions.forEach((q, index) => {
        const userAnsIndex = userAnswers[index];
        const isCorrect = userAnsIndex === q.correctAnswer;
        const qNumStr = (index + 1).toString().padStart(2, '0');
        
        const card = document.createElement('div');
        card.className = 'review-card';
        
        const userAnsText = userAnsIndex !== undefined ? q.options[userAnsIndex] : 'No answer provided';
        const correctAnsText = q.options[q.correctAnswer];
        
        card.innerHTML = `
            <div class="review-q">${qNumStr}. ${q.question}</div>
            <div class="review-row">Your Answer: <span>${userAnsText}</span></div>
            <div class="review-row">Correct Answer: <span>${correctAnsText}</span></div>
            ${isCorrect 
                ? `<div class="review-correct-mark">&check; Correct</div>` 
                : `<div class="review-wrong-mark">&cross; Incorrect</div>`
            }
            <div class="review-explanation"><strong>Explanation:</strong> ${q.explanation}</div>
        `;
        
        reviewContainer.appendChild(card);
    });
}

// ==========================================
// RESET & RESTART
// ==========================================
function resetQuiz() {
    currentQuestionIndex = 0;
    userAnswers = new Array(quizData.questions.length).fill(undefined);
    startQuiz();
}

function newQuiz() {
    quizData = null;
    currentQuestionIndex = 0;
    userAnswers = [];
    inputTopic.value = '';
    switchScreen('setup');
}