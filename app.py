import csv
import random
from datetime import date, timedelta
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
TODOS_PATH = Path(__file__).parent / "todos.csv"
HISTORY_PATH = Path(__file__).parent / "history.csv"
TODOS_FIELDS = ["name", "category", "reoccuring", "reoccuring_rate", "last_done", "due_date", "effort"]
HISTORY_FIELDS = ["name", "category", "completion_date"]


def parse_date(s: str) -> date | None:
    if not s:
        return None
    parts = s.strip().split("/")
    return date(int(parts[2]), int(parts[1]), int(parts[0]))


def format_date(d: date) -> str:
    return f"{d.day}/{d.month}/{d.year}"


def parse_rate(rate_str: str) -> timedelta:
    parts = rate_str.lower().split()
    n = int(parts[0])
    unit = parts[1]
    if "week" in unit:
        return timedelta(days=7 * n)
    if "month" in unit:
        return timedelta(days=30 * n)
    return timedelta(days=n)


def compute_weight(due_date_str: str, weight_effect: float = 1.0) -> float:
    if not due_date_str or weight_effect == 0:
        return 1.0
    due = parse_date(due_date_str)
    days_remaining = (due - date.today()).days
    if days_remaining < 0:
        bonus = 3.0
    elif days_remaining >= 30:
        bonus = 0.0
    else:
        bonus = (30 - days_remaining) / 10.0
    return 1.0 + bonus * weight_effect


def load_todos() -> list[dict]:
    with open(TODOS_PATH, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def save_todos(todos: list[dict]) -> None:
    with open(TODOS_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TODOS_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(todos)


def load_history() -> list[dict]:
    if not HISTORY_PATH.exists():
        return []
    with open(HISTORY_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [
            {k: row[k] for k in HISTORY_FIELDS if k in row}
            for row in reader
            if row.get("name", "").strip()
        ]


def append_history(name: str, category: str) -> None:
    history = load_history()
    history.append({
        "name": name,
        "category": category,
        "completion_date": format_date(date.today()),
    })
    with open(HISTORY_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=HISTORY_FIELDS)
        writer.writeheader()
        writer.writerows(history)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/spin", methods=["POST"])
def spin():
    data = request.get_json()
    energy = int(data.get("energy", 1))
    weight_effect = float(data.get("weight_effect", 1.0))

    todos = load_todos()
    candidates = [t for t in todos if int(t["effort"]) <= energy]

    if not candidates:
        return jsonify({"error": "no_tasks"}), 200

    weights = [compute_weight(t["due_date"], weight_effect) for t in candidates]
    total = sum(weights)
    normalised = [w / total for w in weights]

    selected = random.choices(candidates, weights=weights, k=1)[0]

    tasks_out = [
        {
            "name": t["name"],
            "category": t["category"],
            "effort": int(t["effort"]),
            "weight": normalised[i],
            "due_date": t["due_date"],
        }
        for i, t in enumerate(candidates)
    ]

    return jsonify({"selected": selected["name"], "tasks": tasks_out})


@app.route("/api/complete", methods=["POST"])
def complete():
    data = request.get_json()
    name = data.get("name")

    todos = load_todos()
    today = date.today()
    updated = []

    for t in todos:
        if t["name"] == name:
            if t["reoccuring"].upper() == "TRUE":
                t["last_done"] = format_date(today)
                if t["reoccuring_rate"]:
                    t["due_date"] = format_date(today + parse_rate(t["reoccuring_rate"]))
                updated.append(t)
            else:
                append_history(t["name"], t["category"])
                # task is dropped by not appending to updated
        else:
            updated.append(t)

    save_todos(updated)
    return jsonify({"ok": True})


@app.route("/api/history", methods=["GET"])
def history():
    return jsonify(list(reversed(load_history())))


if __name__ == "__main__":
    app.run(debug=True, port=5001)
