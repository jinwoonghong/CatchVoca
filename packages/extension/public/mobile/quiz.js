/**
 * CatchVoca Mobile Quiz
 * URL Hash 기반 퀴즈 앱
 */

// LZ-String 라이브러리 (최소화 버전)
const LZString = (function() {
  var f = String.fromCharCode;
  var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  var baseReverseDic = {};

  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (var i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }

  var decompressFromEncodedURIComponent = function(input) {
    if (input == null) return "";
    if (input == "") return null;
    input = input.replace(/ /g, "+");
    return _decompress(input.length, 32, function(index) {
      return getBaseValue(keyStrUriSafe, input.charAt(index));
    });
  };

  function _decompress(length, resetValue, getNextValue) {
    var dictionary = [],
      next,
      enlargeIn = 4,
      dictSize = 4,
      numBits = 3,
      entry = "",
      result = [],
      i,
      w,
      bits,
      resb,
      maxpower,
      power,
      c,
      data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }

    bits = 0;
    maxpower = Math.pow(2, 2);
    power = 1;
    while (power != maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch ((next = bits)) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) {
        return "";
      }

      bits = 0;
      maxpower = Math.pow(2, numBits);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((c = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result.push(entry);

      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;

      w = entry;

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  }

  return {
    decompressFromEncodedURIComponent: decompressFromEncodedURIComponent,
  };
})();

// Quiz State
let words = [];
let currentIndex = 0;
let ratings = [];
let showingAnswer = false;

// DOM Elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('error-message');
const quizScreenEl = document.getElementById('quiz-screen');
const resultScreenEl = document.getElementById('result-screen');

const progressFillEl = document.getElementById('progress-fill');
const progressTextEl = document.getElementById('progress-text');
const wordEl = document.getElementById('word');
const phoneticEl = document.getElementById('phonetic');
const audioButtonEl = document.getElementById('audio-button');
const definitionEl = document.getElementById('definition');
const showAnswerButtonEl = document.getElementById('show-answer-button');
const ratingButtonsEl = document.getElementById('rating-buttons');
const resultStatsEl = document.getElementById('result-stats');

/**
 * URL Hash에서 퀴즈 데이터 로드
 */
function loadQuizData() {
  try {
    const hash = window.location.hash.substring(1);

    if (!hash) {
      throw new Error('퀴즈 데이터가 없습니다. 확장 프로그램에서 퀴즈 링크를 생성해주세요.');
    }

    const decompressed = LZString.decompressFromEncodedURIComponent(hash);

    if (!decompressed) {
      throw new Error('퀴즈 데이터를 불러올 수 없습니다. 링크가 손상되었을 수 있습니다.');
    }

    const data = JSON.parse(decompressed);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('유효한 단어 데이터가 없습니다.');
    }

    words = data;
    startQuiz();
  } catch (error) {
    showError(error.message);
  }
}

/**
 * 에러 표시
 */
function showError(message) {
  loadingEl.style.display = 'none';
  quizScreenEl.style.display = 'none';
  errorEl.style.display = 'block';
  errorMessageEl.textContent = message;
}

/**
 * 퀴즈 시작
 */
function startQuiz() {
  loadingEl.style.display = 'none';
  errorEl.style.display = 'none';
  quizScreenEl.style.display = 'block';

  currentIndex = 0;
  ratings = [];

  displayWord();
}

/**
 * 현재 단어 표시
 */
function displayWord() {
  if (currentIndex >= words.length) {
    showResult();
    return;
  }

  const word = words[currentIndex];
  showingAnswer = false;

  // Update UI
  wordEl.textContent = word.w;
  phoneticEl.textContent = word.p || '';

  // Audio button
  if (word.a) {
    audioButtonEl.style.display = 'inline-flex';
    audioButtonEl.onclick = () => playAudio(word.a);
  } else {
    audioButtonEl.style.display = 'none';
  }

  // Hide definition initially
  definitionEl.classList.remove('show');
  definitionEl.innerHTML = '';

  if (word.d && word.d.length > 0) {
    word.d.forEach((def, index) => {
      const defItem = document.createElement('div');
      defItem.className = 'definition-item';
      defItem.textContent = def;
      definitionEl.appendChild(defItem);
    });
  }

  // Show answer button
  showAnswerButtonEl.style.display = 'block';
  ratingButtonsEl.style.display = 'none';

  // Update progress
  updateProgress();
}

/**
 * 정답 보기
 */
function showAnswer() {
  if (showingAnswer) return;

  showingAnswer = true;
  definitionEl.classList.add('show');
  showAnswerButtonEl.style.display = 'none';
  ratingButtonsEl.style.display = 'grid';
}

/**
 * 오디오 재생
 */
function playAudio(url) {
  const audio = new Audio(url);
  audio.play().catch(err => {
    console.error('Audio play failed:', err);
    alert('발음을 재생할 수 없습니다.');
  });
}

/**
 * 평가 기록
 */
function rate(rating) {
  ratings.push(rating);
  currentIndex++;
  displayWord();
}

/**
 * 진행률 업데이트
 */
function updateProgress() {
  const progress = (currentIndex / words.length) * 100;
  progressFillEl.style.width = `${progress}%`;
  progressTextEl.textContent = `${currentIndex} / ${words.length}`;
}

/**
 * 결과 표시
 */
function showResult() {
  quizScreenEl.style.display = 'none';
  resultScreenEl.classList.add('show');

  // Calculate stats
  const totalWords = words.length;
  const againCount = ratings.filter(r => r === 1).length;
  const hardCount = ratings.filter(r => r === 2).length;
  const goodCount = ratings.filter(r => r === 3).length;
  const easyCount = ratings.filter(r => r === 4).length;

  const accuracy = Math.round(((goodCount + easyCount) / totalWords) * 100);

  // Render stats
  resultStatsEl.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">총 단어 수</span>
      <span class="stat-value">${totalWords}개</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">정확도</span>
      <span class="stat-value" style="color: #10B981;">${accuracy}%</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">❌ 모름</span>
      <span class="stat-value">${againCount}개</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">😅 어려움</span>
      <span class="stat-value">${hardCount}개</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">✅ 보통</span>
      <span class="stat-value">${goodCount}개</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">😊 쉬움</span>
      <span class="stat-value">${easyCount}개</span>
    </div>
  `;
}

/**
 * 이벤트 리스너 등록
 */
showAnswerButtonEl.addEventListener('click', showAnswer);

/**
 * 페이지 로드 시 퀴즈 데이터 로드
 */
window.addEventListener('load', loadQuizData);
