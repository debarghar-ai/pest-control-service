
from flask import Flask, request, jsonify, send_from_directory
from openpyxl import Workbook, load_workbook
from datetime import datetime
import os

app = Flask(__name__)

# Always save Excel in the same folder as app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.join(BASE_DIR, "pestcare_users.xlsx")


def create_excel_file():
    if not os.path.exists(EXCEL_FILE):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Registered Users"
        sheet.append([
            "Full Name",
            "Email",
            "Phone",
            "Registration Date"
        ])
        workbook.save(EXCEL_FILE)


create_excel_file()


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "login.html")


@app.route("/<path:filename>")
def files(filename):
    return send_from_directory(BASE_DIR, filename)


@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json(silent=True) or {}

        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        phone = str(data.get("phone", "")).strip()

        if not name or not email or not phone:
            return jsonify({
                "message": "Please fill all required fields."
            }), 400

        workbook = load_workbook(EXCEL_FILE)
        sheet = workbook["Registered Users"]

        # Check for duplicate email
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if str(row[1]).lower() == email:
                workbook.close()
                return jsonify({
                    "message": "This email is already registered."
                }), 409

        sheet.append([
            name,
            email,
            phone,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ])

        workbook.save(EXCEL_FILE)
        workbook.close()

        return jsonify({
            "message": "Registration successful!"
        }), 200

    except Exception:
        app.logger.exception("Registration failed")
        return jsonify({
            "message": "Registration failed. Check the VS Code terminal."
        }), 500


if __name__ == "__main__":
    print("Excel file location:", EXCEL_FILE)
    app.run(debug=True)
