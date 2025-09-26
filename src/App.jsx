// src/App.jsx
import React, { useEffect, useState, useMemo } from "react";
import "./index.css";

const Result = {
  CORRECT: "CORRECT",
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
};

// Return feedback array for a guess vs the actual answer using Wordle rules.
function feedbackFor(guess, answer) {
  const g = guess.split("");
  const a = answer.split("");
  const res = Array(5).fill(Result.ABSENT);

  // First pass: correct letters
  const aUsed = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      res[i] = Result.CORRECT;
      aUsed[i] = true;
    }
  }

  // Second pass: present letters (taking counts into account)
  for (let i = 0; i < 5; i++) {
    if (res[i] === Result.CORRECT) continue;
    for (let j = 0; j < 5; j++) {
      if (aUsed[j]) continue;
      if (g[i] === a[j]) {
        res[i] = Result.PRESENT;
        aUsed[j] = true;
        break;
      }
    }
  }

  return res;
}

// Stable string key for a feedback array (used for grouping)
function feedbackKey(feedback) {
  return feedback.join("|");
}

// Filter candidate answers by applying history of guesses+feedbacks
function filterCandidates(words, history) {
  if (!words || words.length === 0) return [];
  if (!history || history.length === 0) return words.slice();

  return words.filter((candidate) => {
    for (const h of history) {
      const expected = h.feedback;
      const actual = feedbackFor(h.guess, candidate);
      // compare arrays
      if (expected.length !== actual.length) return false;
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] !== actual[i]) return false;
      }
    }
    return true;
  });
}

// Compute entropy (in bits) for a guess across a set of candidate answers.
function computeEntropyForGuess(guess, candidates) {
  if (!candidates || candidates.length === 0) return 0;
  const counts = Object.create(null);
  for (const ans of candidates) {
    const key = feedbackKey(feedbackFor(guess, ans));
    counts[key] = (counts[key] || 0) + 1;
  }
  const n = candidates.length;
  let entropy = 0;
  for (const k in counts) {
    const p = counts[k] / n;
    entropy += -p * Math.log2(p);
  }
  return entropy;
}

function mostLikelyCandidate(candidates) {
  if (!candidates || candidates.length === 0) return null;
  // simple heuristic: pick the first candidate (they're not ranked here)
  return candidates[0];
}

function EmojiFor(r) {
  switch (r) {
    case Result.CORRECT:
      return "✅";
    case Result.PRESENT:
      return "🟨";
    case Result.ABSENT:
    default:
      return "⬜";
  }
}

export default function App() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guessText, setGuessText] = useState("");
  const [feedbackBoxes, setFeedbackBoxes] = useState([
    Result.ABSENT,
    Result.ABSENT,
    Result.ABSENT,
    Result.ABSENT,
    Result.ABSENT,
  ]);
  const [history, setHistory] = useState([]);
  const [topGuesses, setTopGuesses] = useState([]);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    fetch("/words.txt")
      .then((r) => r.text())
      .then((text) => {
        const arr = text
          .split(/\r?\n/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z]{5}$/.test(s));
        setWords(arr);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load words.txt", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const cands = filterCandidates(words, history);
    setCandidates(cands);

    const ent = [];
    for (const g of cands) {
      const bits = computeEntropyForGuess(g, cands);
      ent.push({ guess: g, bits });
    }
    ent.sort((a, b) => b.bits - a.bits);
    setTopGuesses(ent.slice(0, 10));
  }, [words, history]);

  function applyGuess() {
    const guess = (guessText || "").trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(guess)) {
      alert("Enter a 5-letter guess (a-z).");
      return;
    }
    setHistory((h) => [{ guess, feedback: feedbackBoxes.slice() }, ...h]);
    setGuessText("");
    setFeedbackBoxes([
      Result.ABSENT,
      Result.ABSENT,
      Result.ABSENT,
      Result.ABSENT,
      Result.ABSENT,
    ]);
  }

  function undoLast() {
    setHistory((h) => (h.length > 0 ? h.slice(1) : h));
  }

  function resetAll() {
    setHistory([]);
  }

  function setFeedbackAt(i, val) {
    setFeedbackBoxes((fb) => {
      const copy = fb.slice();
      copy[i] = val;
      return copy;
    });
  }

  const mostLikely = useMemo(() => mostLikelyCandidate(candidates), [candidates]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Wordle Entropy Assistant</h1>
        <p className="subtitle">
          Enter a guess + feedback → see possible answers and best next guesses
          (bits)
        </p>
      </header>

      <main className="main-grid">
        {/* LEFT PANEL */}
        <section className="panel left-panel">
          <div className="card input-card">
            <div className="input-row">
              <input
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                placeholder="guess"
                maxLength={5}
                className="guess-input"
              />
              <div className="feedback-row">
                {feedbackBoxes.map((v, i) => (
                  <select
                    key={i}
                    value={v}
                    onChange={(e) => setFeedbackAt(i, e.target.value)}
                    className="feedback-select"
                  >
                    <option value={Result.CORRECT}>CORRECT</option>
                    <option value={Result.PRESENT}>PRESENT</option>
                    <option value={Result.ABSENT}>ABSENT</option>
                  </select>
                ))}
              </div>
              <div className="button-row">
                <button onClick={applyGuess} className="btn primary">
                  Apply
                </button>
                <button onClick={undoLast} className="btn">
                  Undo
                </button>
                <button onClick={resetAll} className="btn ghost">
                  Reset
                </button>
              </div>
            </div>
            <div className="meta">
              <div>
                Wordlist size: <strong>{words.length}</strong>
              </div>
              <div>
                Candidates: <strong>{candidates.length}</strong>
              </div>
            </div>
          </div>

          <div className="card history-card">
            <h3>History (most recent first)</h3>
            <div className="history-list">
              {history.length === 0 && (
                <div className="muted">(no history yet)</div>
              )}
              {history.map((h, idx) => (
                <div key={idx} className="history-row">
                  <div className="history-guess">{h.guess}</div>
                  <div className="history-feedback">
                    {h.feedback.map((r, i) => (
                      <span key={i} className="emoji">
                        {EmojiFor(r)}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setGuessText(h.guess)}
                    className="link-btn"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ✅ Candidates moved BELOW history */}
          <div className="card candidates-card">
            <h3>Candidates ({candidates.length})</h3>
            <div className="candidates-grid">
              {candidates.slice(0, 500).map((c) => (
                <div
                  key={c}
                  className={`candidate-pill ${
                    c === mostLikely ? "candidate-best" : ""
                  }`}
                  onClick={() => setGuessText(c)}
                >
                  {c}
                </div>
              ))}
            </div>
            {candidates.length > 500 && (
              <div className="muted">
                ... {candidates.length - 500} more
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="panel right-panel">
          <div className="card topguesses-card">
            <h3>Top 10 Next Guesses</h3>
            <div className="most-likely">
              Most likely: <strong>{mostLikely || "-"}</strong>
            </div>
            <table className="entropy-table">
              <thead>
                <tr>
                  <th>Guess</th>
                  <th>Bits</th>
                </tr>
              </thead>
              <tbody>
                {topGuesses.map((g) => (
                  <tr key={g.guess} className="entropy-row">
                    <td>
                      <button
                        onClick={() => setGuessText(g.guess)}
                        className="link-btn big"
                      >
                        {g.guess}
                      </button>
                    </td>
                    <td className="bits">{g.bits.toFixed(3)}</td>
                  </tr>
                ))}
                {topGuesses.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No suggestions (empty candidate set)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div>
          Entropy computed over the candidate set. Data loaded
          from <code>/words.txt</code>.
        </div>
        <div className="muted">
          Created by Griffin Volquartsen
        </div>
      </footer>
    </div>
  );
}
