(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total = slides.length;
  var current = 0;

  var progressFill = document.getElementById("progressFill");
  var currentSlideEl = document.getElementById("currentSlide");
  var totalSlidesEl = document.getElementById("totalSlides");
  var prevBtn = document.getElementById("prevBtn");
  var nextBtn = document.getElementById("nextBtn");

  totalSlidesEl.textContent = total;

  function showSlide(index) {
    if (index < 0 || index >= total) return;
    slides[current].classList.remove("active");
    current = index;
    slides[current].classList.add("active");

    var pct = ((current + 1) / total) * 100;
    progressFill.style.width = pct + "%";
    currentSlideEl.textContent = current + 1;

    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;

    if (slides[current].id === "scoreSlide") {
      updateScoreSlide();
    }
  }

  function next() {
    if (current < total - 1) showSlide(current + 1);
  }

  function prev() {
    if (current > 0) showSlide(current - 1);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.addEventListener("keydown", function (e) {
    // RTL convention: left = forward, right = backward
    if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      showSlide(0);
    } else if (e.key === "End") {
      e.preventDefault();
      showSlide(total - 1);
    }
  });

  showSlide(0);

  // ---------------- Quiz ----------------
  var quizQuestions = Array.prototype.slice.call(document.querySelectorAll(".slide[data-quiz-index]"));
  var quizTotal = quizQuestions.length;
  var quizScore = 0;
  var quizAnswered = new Array(quizTotal).fill(false);

  quizQuestions.forEach(function (qSlide, qIdx) {
    var options = Array.prototype.slice.call(qSlide.querySelectorAll(".quiz-option"));
    var explanation = qSlide.querySelector(".quiz-explanation");

    options.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (quizAnswered[qIdx]) return;
        quizAnswered[qIdx] = true;

        var isCorrect = btn.getAttribute("data-correct") === "true";
        if (isCorrect) quizScore++;

        options.forEach(function (o) {
          o.disabled = true;
          if (o.getAttribute("data-correct") === "true") {
            o.classList.add("correct");
          } else if (o === btn) {
            o.classList.add("incorrect");
          }
        });

        if (explanation) {
          explanation.classList.add("show");
          explanation.classList.add(isCorrect ? "is-correct" : "is-incorrect");
          var label = explanation.querySelector(".result-label");
          if (label) {
            label.textContent = isCorrect ? "إجابة صحيحة!" : "إجابة غير صحيحة";
          }
        }
      });
    });
  });

  function updateScoreSlide() {
    var scoreValueEl = document.getElementById("scoreValue");
    var scoreMessageEl = document.getElementById("scoreMessage");
    if (!scoreValueEl) return;

    scoreValueEl.textContent = quizScore + " / " + quizTotal;

    var msg;
    if (quizScore === quizTotal) {
      msg = "ممتاز! إتقان كامل لمفاهيم هذه الجلسة — جاهز للانتقال للـ Approval flow في الجلسة القادمة.";
    } else if (quizScore >= quizTotal - 2) {
      msg = "أداء جيد جدًا. راجع الأسئلة التي أخطأت فيها قبل بداية الجلسة القادمة.";
    } else {
      msg = "يُنصح بمراجعة سلايدات Expressions وIdempotency وRetry مرة أخرى قبل الجلسة القادمة.";
    }
    scoreMessageEl.textContent = msg;
  }

  var restartBtn = document.getElementById("restartQuizBtn");
  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      quizScore = 0;
      quizAnswered = new Array(quizTotal).fill(false);

      quizQuestions.forEach(function (qSlide) {
        var options = Array.prototype.slice.call(qSlide.querySelectorAll(".quiz-option"));
        var explanation = qSlide.querySelector(".quiz-explanation");
        options.forEach(function (o) {
          o.disabled = false;
          o.classList.remove("correct", "incorrect");
        });
        if (explanation) {
          explanation.classList.remove("show", "is-correct", "is-incorrect");
        }
      });

      if (quizQuestions.length > 0) {
        var firstQuizSlideIndex = slides.indexOf(quizQuestions[0]);
        showSlide(firstQuizSlideIndex);
      }
    });
  }
})();
