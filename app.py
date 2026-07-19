import csv
import random
from datetime import date, timedelta
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
TODOS_PATH = Path(__file__).parent / "todos.csv"


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


def compute_weight(due_date_str: str) -> float:
    if not due_date_str:
        return 1.0
    due = parse_date(due_date_str)
    days_remaining = (due - date.today()).days
    if days_remaining < 0:
        return 4.0
    if days_remaining >= 30:
        return 1.0
    return 1.0 + (30 - days_remaining) / 10.0


def load_todos() -> list[dict]:
    with open(TODOS_PATH, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def save_todos(todos: list[dict]) -> None:
    fieldnames = ["name", "category", "reoccuring", "reoccuring_rate",
                  "last_done", "due_date", "effort", "done"]
    with open(TODOS_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(todos)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/spin", methods=["POST"])
def spin():
    data = request.get_json()
    energy = int(data.get("energy", 1))

    todos = load_todos()
    candidates = [
        t for t in todos
        if t["done"].upper() == "FALSE" and int(t["effort"]) <= energy
    ]

    if not candidates:
        return jsonify({"error": "no_tasks"}), 200

    weights = [compute_weight(t["due_date"]) for t in candidates]
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

    for t in todos:
        if t["name"] == name:
            if t["reoccuring"].upper() == "TRUE":
                t["last_done"] = format_date(today)
                if t["reoccuring_rate"]:
                    t["due_date"] = format_date(today + parse_rate(t["reoccuring_rate"]))
            else:
                t["done"] = "TRUE"
            break

    save_todos(todos)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
