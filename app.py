
from flask import (
    Flask, request, jsonify, send_from_directory,
    session, redirect
)
from openpyxl import Workbook, load_workbook
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
from datetime import datetime
from threading import Lock
import json
import os
import uuid


# ==========================================
# PESTCARE CONFIGURATION
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

USERS_FILE = os.path.join(BASE_DIR, "pestcare_users.xlsx")
SERVICES_FILE = os.path.join(BASE_DIR, "pestcare_services.xlsx")
CREDENTIALS_FILE = os.path.join(BASE_DIR, "admin_credentials.json")

app = Flask(__name__)

excel_lock = Lock()
credentials_lock = Lock()


# ==========================================
# LOAD ADMIN CREDENTIALS
# ==========================================

if not os.path.exists(CREDENTIALS_FILE):
    raise RuntimeError(
        "admin_credentials.json not found. "
        "Run python admin_setup.py first."
    )

with open(CREDENTIALS_FILE, "r") as file:
    admin_credentials = json.load(file)

if "admins" not in admin_credentials:
    admin_credentials["admins"] = [{
        "username": admin_credentials["username"],
        "password_hash": admin_credentials["password_hash"],
        "role": "main_admin"
    }]

if not admin_credentials.get("secret_key"):
    raise RuntimeError(
        "Secret key missing. Run python admin_setup.py."
    )

if not admin_credentials["admins"]:
    raise RuntimeError(
        "No admin accounts found. Run python admin_setup.py."
    )

for index, admin in enumerate(admin_credentials["admins"]):
    admin["role"] = "main_admin" if index == 0 else "admin"


def save_admin_credentials():
    with credentials_lock:
        temporary_file = CREDENTIALS_FILE + ".tmp"

        with open(temporary_file, "w") as file:
            json.dump(admin_credentials, file, indent=4)

        os.replace(temporary_file, CREDENTIALS_FILE)


save_admin_credentials()

app.secret_key = admin_credentials["secret_key"]

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)


# ==========================================
# EXCEL DATABASE SETUP
# ==========================================

def create_users_excel():
    if not os.path.exists(USERS_FILE):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Registered Users"

        sheet.append([
            "Full Name",
            "Email",
            "Phone",
            "Registration Date",
            "Password Hash"
        ])

        workbook.save(USERS_FILE)
        workbook.close()


def create_services_excel():
    if not os.path.exists(SERVICES_FILE):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Service Bookings"

        sheet.append([
            "Booking ID",
            "Customer Name",
            "Email",
            "Phone",
            "Service Name",
            "Property Type",
            "Booking Date",
            "Preferred Time",
            "Address",
            "Additional Details",
            "Status"
        ])

        workbook.save(SERVICES_FILE)
        workbook.close()


def migrate_users_excel():
    """Add Password Hash to existing customer spreadsheets."""

    with excel_lock:
        workbook = load_workbook(USERS_FILE)
        sheet = workbook["Registered Users"]

        headers = [
            cell.value for cell in sheet[1]
        ]

        if "Password Hash" not in headers:
            sheet.cell(
                row=1,
                column=len(headers) + 1,
                value="Password Hash"
            )

            workbook.save(USERS_FILE)

        workbook.close()


create_users_excel()
create_services_excel()
migrate_users_excel()


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def excel_date(value):
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    if value is None:
        return ""

    return str(value)


def read_excel_records(file_path):
    if not os.path.exists(file_path):
        return []

    workbook = load_workbook(file_path, data_only=True)
    sheet = workbook.active

    headers = [cell.value for cell in sheet[1]]
    records = []

    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not any(value is not None for value in row):
            continue

        record = {}

        for index, header in enumerate(headers):
            if header is None:
                continue

            value = row[index] if index < len(row) else None

            if isinstance(value, datetime):
                value = value.strftime("%Y-%m-%d %H:%M:%S")

            record[str(header)] = value

        records.append(record)

    workbook.close()
    return records


def find_customer_by_email(email):
    email = str(email or "").strip().lower()

    if not email:
        return None

    workbook = load_workbook(USERS_FILE, data_only=True)
    sheet = workbook["Registered Users"]

    headers = [cell.value for cell in sheet[1]]
    email_column = headers.index("Email") + 1

    customer = None

    for row_number in range(2, sheet.max_row + 1):
        saved_email = sheet.cell(
            row=row_number,
            column=email_column
        ).value

        if str(saved_email or "").strip().lower() == email:
            customer = {
                "row": row_number,
                "headers": headers
            }
            break

    workbook.close()
    return customer


def get_customer_details(email):
    """Return customer details without exposing the password hash."""

    workbook = load_workbook(USERS_FILE, data_only=True)
    sheet = workbook["Registered Users"]

    headers = [cell.value for cell in sheet[1]]
    email_index = headers.index("Email")
    name_index = headers.index("Full Name")
    phone_index = headers.index("Phone")

    result = None

    for row in sheet.iter_rows(min_row=2, values_only=True):
        saved_email = str(row[email_index] or "").strip().lower()

        if saved_email == email.lower():
            result = {
                "name": str(row[name_index] or ""),
                "email": saved_email,
                "phone": str(row[phone_index] or "")
            }
            break

    workbook.close()
    return result


def find_admin(username):
    if not username:
        return None

    return next(
        (
            admin for admin in admin_credentials["admins"]
            if admin["username"].lower() == username.lower()
        ),
        None
    )


def get_current_admin():
    if not session.get("admin_logged_in"):
        return None

    return find_admin(session.get("admin_username"))


def get_current_customer():
    if not session.get("customer_logged_in"):
        return None

    email = session.get("customer_email")

    if not email:
        return None

    with excel_lock:
        return get_customer_details(email)


# ==========================================
# CUSTOMER PERMISSION PROTECTION
# ==========================================

def customer_required(function):
    @wraps(function)
    def decorated_function(*args, **kwargs):
        customer = get_current_customer()

        if not customer:
            session.pop("customer_logged_in", None)
            session.pop("customer_email", None)

            return jsonify({
                "success": False,
                "message": "Please log in before booking a service."
            }), 401

        return function(*args, **kwargs)

    return decorated_function


# ==========================================
# ADMIN PERMISSION PROTECTION
# ==========================================

def admin_required(function):
    @wraps(function)
    def decorated_function(*args, **kwargs):
        admin = get_current_admin()

        if not admin:
            session.pop("admin_logged_in", None)
            session.pop("admin_username", None)
            return redirect("/admin-login")

        return function(*args, **kwargs)

    return decorated_function


def main_admin_required(function):
    @wraps(function)
    def decorated_function(*args, **kwargs):
        admin = get_current_admin()

        if not admin:
            session.pop("admin_logged_in", None)
            session.pop("admin_username", None)

            return jsonify({
                "success": False,
                "message": "Please log in again."
            }), 401

        if admin.get("role") != "main_admin":
            return jsonify({
                "success": False,
                "message": "Only the Main Admin can manage admin accounts."
            }), 403

        return function(*args, **kwargs)

    return decorated_function


# ==========================================
# WEBSITE ROUTES
# ==========================================

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/login")
def login_page():
    return send_from_directory(BASE_DIR, "login.html")


@app.route("/booking.html")
def booking_page():
    if not get_current_customer():
        return redirect("/login?next=/booking.html")

    return send_from_directory(BASE_DIR, "booking.html")


@app.route("/<path:filename>")
def website_files(filename):
    allowed_extensions = {
        ".html", ".css", ".js",
        ".png", ".jpg", ".jpeg",
        ".svg", ".ico", ".webp"
    }

    extension = os.path.splitext(filename)[1].lower()

    if extension not in allowed_extensions:
        return "Not Found", 404

    if filename.startswith("."):
        return "Not Found", 404

    return send_from_directory(BASE_DIR, filename)


# ==========================================
# CUSTOMER REGISTRATION
# ==========================================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = str(
        data.get("name") or data.get("full_name") or ""
    ).strip()

    email = str(data.get("email") or "").strip().lower()
    phone = str(data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not name or not email or not phone or not password:
        return jsonify({
            "success": False,
            "message": "Please fill in all required fields."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters."
        }), 400

    if len(password) > 128:
        return jsonify({
            "success": False,
            "message": "Password is too long."
        }), 400

    if len(email) > 254:
        return jsonify({
            "success": False,
            "message": "Please enter a valid email address."
        }), 400

    try:
        password_hash = generate_password_hash(password)

        with excel_lock:
            workbook = load_workbook(USERS_FILE)
            sheet = workbook["Registered Users"]

            headers = [cell.value for cell in sheet[1]]

            name_col = headers.index("Full Name") + 1
            email_col = headers.index("Email") + 1
            phone_col = headers.index("Phone") + 1
            date_col = headers.index("Registration Date") + 1
            password_col = headers.index("Password Hash") + 1

            existing_row = None

            for row_number in range(2, sheet.max_row + 1):
                saved_email = str(
                    sheet.cell(row_number, email_col).value or ""
                ).strip().lower()

                if saved_email == email:
                    existing_row = row_number
                    break

            if existing_row:
                existing_hash = sheet.cell(
                    existing_row, password_col
                ).value

                if existing_hash:
                    workbook.close()

                    return jsonify({
                        "success": False,
                        "message": "An account with this email already exists. Please log in."
                    }), 409

                sheet.cell(existing_row, name_col).value = name
                sheet.cell(existing_row, phone_col).value = phone
                sheet.cell(existing_row, password_col).value = password_hash

            else:
                sheet.append([
                    name,
                    email,
                    phone,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    password_hash
                ])

            workbook.save(USERS_FILE)
            workbook.close()

        return jsonify({
            "success": True,
            "message": "Registration successful! You can now log in."
        }), 200

    except Exception as error:
        print("REGISTRATION ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Registration could not be saved."
        }), 500


# ==========================================
# CUSTOMER LOGIN
# ==========================================

@app.route("/customer-login", methods=["POST"])
def customer_login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    try:
        with excel_lock:
            customer_record = find_customer_by_email(email)

            if not customer_record:
                return jsonify({
                    "success": False,
                    "message": "Invalid email or password."
                }), 401

            workbook = load_workbook(USERS_FILE, data_only=True)
            sheet = workbook["Registered Users"]

            password_col = (
                customer_record["headers"].index("Password Hash") + 1
            )

            password_hash = sheet.cell(
                customer_record["row"],
                password_col
            ).value

            workbook.close()

        if not password_hash or not check_password_hash(
            password_hash, password
        ):
            return jsonify({
                "success": False,
                "message": "Invalid email or password."
            }), 401

        session.pop("customer_logged_in", None)
        session.pop("customer_email", None)

        session["customer_logged_in"] = True
        session["customer_email"] = email

        print("CUSTOMER LOGIN:", email)

        return jsonify({
            "success": True,
            "message": "Login successful!"
        }), 200

    except Exception as error:
        print("CUSTOMER LOGIN ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Login could not be completed."
        }), 500


# ==========================================
# CUSTOMER SESSION STATUS
# ==========================================

@app.route("/customer-session")
def customer_session():
    customer = get_current_customer()

    if not customer:
        return jsonify({
            "success": False,
            "logged_in": False
        }), 401

    return jsonify({
        "success": True,
        "logged_in": True,
        "customer": customer
    }), 200


# ==========================================
# CUSTOMER LOGOUT
# ==========================================

@app.route("/customer-logout")
def customer_logout():
    session.pop("customer_logged_in", None)
    session.pop("customer_email", None)

    return redirect("/login")


# ==========================================
# SERVICE BOOKING
# ==========================================

@app.route("/book-service", methods=["POST"])
@customer_required
def book_service():
    data = request.get_json(silent=True) or {}

    customer = get_current_customer()

    if not customer:
        return jsonify({
            "success": False,
            "message": "Please log in before booking."
        }), 401

    customer_name = customer["name"]
    email = customer["email"]
    phone = customer["phone"]

    service_name = str(
        data.get("service_name") or data.get("service") or ""
    ).strip()

    property_type = str(
        data.get("property_type") or data.get("property") or ""
    ).strip()

    booking_date = str(
        data.get("booking_date") or data.get("date") or ""
    ).strip()

    preferred_time = str(
        data.get("preferred_time") or data.get("time") or ""
    ).strip()

    address = str(data.get("address") or "").strip()

    additional_details = str(
        data.get("additional_details")
        or data.get("message")
        or data.get("notes")
        or ""
    ).strip()

    required_fields = [
        service_name,
        property_type,
        booking_date,
        preferred_time,
        address
    ]

    if not all(required_fields):
        return jsonify({
            "success": False,
            "message": "Please complete all required booking fields."
        }), 400

    booking_id = "PC-" + uuid.uuid4().hex[:8].upper()

    try:
        with excel_lock:
            workbook = load_workbook(SERVICES_FILE)
            sheet = workbook["Service Bookings"]

            sheet.append([
                booking_id,
                customer_name,
                email,
                phone,
                service_name,
                property_type,
                booking_date,
                preferred_time,
                address,
                additional_details,
                "Pending"
            ])

            workbook.save(SERVICES_FILE)
            workbook.close()

        print("BOOKING SAVED SUCCESSFULLY!", booking_id)

        return jsonify({
            "success": True,
            "message": "Your booking has been submitted successfully!",
            "booking_id": booking_id
        }), 200

    except Exception as error:
        print("BOOKING ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Booking could not be saved. Please try again."
        }), 500


# ==========================================
# CUSTOMER BOOKING HISTORY
# ==========================================

@app.route("/customer-bookings", methods=["GET"])
@customer_required
def customer_bookings():
    try:
        customer = get_current_customer()

        if not customer:
            return jsonify({
                "success": False,
                "message": "Please log in to view your booking history."
            }), 401

        customer_email = customer["email"].strip().lower()

        with excel_lock:
            all_bookings = read_excel_records(SERVICES_FILE)

        customer_history = [
            booking for booking in all_bookings
            if str(booking.get("Email") or "").strip().lower()
            == customer_email
        ]

        customer_history.reverse()

        return jsonify({
            "success": True,
            "total_bookings": len(customer_history),
            "bookings": customer_history
        }), 200

    except Exception as error:
        print("CUSTOMER BOOKING HISTORY ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Could not load your booking history."
        }), 500


# ==========================================
# ADMIN LOGIN PAGE
# ==========================================

@app.route("/admin-login", methods=["GET"])
def admin_login_page():
    return send_from_directory(BASE_DIR, "admin-login.html")


# ==========================================
# ADMIN LOGIN
# ==========================================

@app.route("/admin-login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username") or "").strip()
    password = data.get("password") or ""

    admin = find_admin(username)

    if (
        admin
        and check_password_hash(admin["password_hash"], password)
    ):
        session.pop("admin_logged_in", None)
        session.pop("admin_username", None)

        session["admin_logged_in"] = True
        session["admin_username"] = admin["username"]

        print("ADMIN LOGIN:", admin["username"], admin.get("role"))

        return jsonify({
            "success": True,
            "message": "Login successful!",
            "role": admin["role"]
        }), 200

    return jsonify({
        "success": False,
        "message": "Invalid username or password."
    }), 401


# ==========================================
# ADMIN DASHBOARD
# ==========================================

@app.route("/admin-dashboard")
@admin_required
def admin_dashboard():
    return send_from_directory(
        BASE_DIR,
        "admin-dashboard.html"
    )


# ==========================================
# ADMIN MANAGEMENT PAGE
# ==========================================

@app.route("/admin-management")
@admin_required
def admin_management_page():
    admin = get_current_admin()

    if admin.get("role") != "main_admin":
        return redirect("/admin-dashboard")

    return send_from_directory(
        BASE_DIR,
        "admin-management.html"
    )


# ==========================================
# ADMIN DASHBOARD DATA
# ==========================================

@app.route("/admin-data")
@admin_required
def admin_data():
    try:
        with excel_lock:
            customers = read_excel_records(USERS_FILE)
            bookings = read_excel_records(SERVICES_FILE)

        for customer in customers:
            customer.pop("Password Hash", None)

        pending = sum(
            1 for booking in bookings
            if str(booking.get("Status", "")).lower() == "pending"
        )

        confirmed = sum(
            1 for booking in bookings
            if str(booking.get("Status", "")).lower() == "confirmed"
        )

        current_admin = get_current_admin()

        if current_admin is None:
            session.pop("admin_logged_in", None)
            session.pop("admin_username", None)

            return jsonify({
                "success": False,
                "message": "Admin account not found."
            }), 401

        print(
            "DASHBOARD ROLE CHECK:",
            current_admin.get("username"),
            current_admin.get("role")
        )

        return jsonify({
            "success": True,
            "admin_username": current_admin["username"],
            "admin_role": current_admin.get("role", "admin"),
            "customers": customers,
            "bookings": bookings,
            "total_customers": len(customers),
            "total_bookings": len(bookings),
            "pending_bookings": pending,
            "confirmed_bookings": confirmed
        }), 200

    except Exception as error:
        print("ADMIN DATA ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Could not load dashboard data."
        }), 500


# ==========================================
# MAIN ADMIN: ADD ADMIN
# ==========================================

@app.route("/admin-add", methods=["POST"])
@main_admin_required
def admin_add():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required."
        }), 400

    if len(username) > 50:
        return jsonify({
            "success": False,
            "message": "Username cannot exceed 50 characters."
        }), 400

    if len(password) < 12:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 12 characters."
        }), 400

    if find_admin(username):
        return jsonify({
            "success": False,
            "message": "This username already exists."
        }), 409

    new_admin = {
        "username": username,
        "password_hash": generate_password_hash(password),
        "role": "admin"
    }

    admin_credentials["admins"].append(new_admin)

    try:
        save_admin_credentials()

        return jsonify({
            "success": True,
            "message": "Admin account created successfully."
        }), 201

    except Exception as error:
        print("ADD ADMIN ERROR:", error)
        admin_credentials["admins"].remove(new_admin)

        return jsonify({
            "success": False,
            "message": "Could not save the new admin account."
        }), 500


# ==========================================
# MAIN ADMIN: DELETE ADMIN
# ==========================================

@app.route("/admin-delete", methods=["POST"])
@main_admin_required
def admin_delete():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username") or "").strip()
    admin = find_admin(username)

    if not admin:
        return jsonify({
            "success": False,
            "message": "Admin account not found."
        }), 404

    if admin.get("role") == "main_admin":
        return jsonify({
            "success": False,
            "message": "The Main Admin account cannot be deleted."
        }), 403

    if admin["username"].lower() == session.get(
        "admin_username", ""
    ).lower():
        return jsonify({
            "success": False,
            "message": "You cannot delete your own account."
        }), 403

    admin_credentials["admins"].remove(admin)

    try:
        save_admin_credentials()

        return jsonify({
            "success": True,
            "message": "Admin account deleted successfully."
        }), 200

    except Exception as error:
        print("DELETE ADMIN ERROR:", error)
        admin_credentials["admins"].append(admin)

        return jsonify({
            "success": False,
            "message": "Could not delete the admin account."
        }), 500


# ==========================================
# MAIN ADMIN: CHANGE ADMIN PASSWORD
# ==========================================

@app.route("/admin-change-password", methods=["POST"])
@main_admin_required
def admin_change_password():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and new password are required."
        }), 400

    if len(password) < 12:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 12 characters."
        }), 400

    admin = find_admin(username)

    if not admin:
        return jsonify({
            "success": False,
            "message": "Admin account not found."
        }), 404

    if admin["username"].lower() == session.get(
        "admin_username", ""
    ).lower():
        return jsonify({
            "success": False,
            "message": "Use the local admin manager to change your own password."
        }), 403

    old_hash = admin["password_hash"]
    admin["password_hash"] = generate_password_hash(password)

    try:
        save_admin_credentials()

        return jsonify({
            "success": True,
            "message": "Admin password changed successfully."
        }), 200

    except Exception as error:
        print("CHANGE PASSWORD ERROR:", error)
        admin["password_hash"] = old_hash

        return jsonify({
            "success": False,
            "message": "Could not change the admin password."
        }), 500


# ==========================================
# ADMIN LOGOUT
# ==========================================

@app.route("/admin-logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    session.pop("admin_username", None)

    return redirect("/admin-login")


# ==========================================
# RUN PESTCARE
# ==========================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False
    )
