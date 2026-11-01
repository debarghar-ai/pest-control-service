
from flask import Flask, request, jsonify, send_from_directory
from openpyxl import Workbook, load_workbook
from datetime import datetime
from threading import Lock
import os

app = Flask(__name__)

# ---------------------------------------
# PROJECT FILE LOCATIONS
# ---------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

USERS_FILE = os.path.join(BASE_DIR, "pestcare_users.xlsx")
SERVICES_FILE = os.path.join(BASE_DIR, "pestcare_services.xlsx")

excel_lock = Lock()


# ---------------------------------------
# CREATE USERS EXCEL
# ---------------------------------------

def create_users_excel():

    if not os.path.exists(USERS_FILE):

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Registered Users"

        sheet.append([
            "Full Name",
            "Email",
            "Phone",
            "Registration Date"
        ])

        workbook.save(USERS_FILE)
        workbook.close()


# ---------------------------------------
# CREATE SERVICES EXCEL
# ---------------------------------------

def create_services_excel():

    if not os.path.exists(SERVICES_FILE):

        workbook = Workbook()

        sheet = workbook.active
        sheet.title = "Service Details"

        sheet.append([
            "Service ID",
            "Service Name",
            "Description",
            "Price",
            "Duration",
            "Availability"
        ])

        bookings = workbook.create_sheet("Service Bookings")

        bookings.append([
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


# ---------------------------------------
# INITIALIZE EXCEL FILES
# ---------------------------------------

create_users_excel()
create_services_excel()


# ---------------------------------------
# WEBSITE ROUTES
# ---------------------------------------

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/login")
def login():
    return send_from_directory(BASE_DIR, "login.html")


@app.route("/<path:filename>")
def website_files(filename):
    return send_from_directory(BASE_DIR, filename)


# ---------------------------------------
# USER REGISTRATION
# ---------------------------------------

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

        with excel_lock:

            workbook = load_workbook(USERS_FILE)
            sheet = workbook["Registered Users"]

            # Check duplicate email
            for row in sheet.iter_rows(min_row=2, values_only=True):

                existing_email = str(row[1] or "").strip().lower()

                if existing_email == email:

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

            workbook.save(USERS_FILE)
            workbook.close()

        print("REGISTRATION SAVED:", email)
        print("Excel file:", USERS_FILE)

        return jsonify({
            "message": "Registration successful!"
        }), 200

    except Exception:

        app.logger.exception("Registration error")

        return jsonify({
            "message": "Registration failed. Check the server terminal."
        }), 500


# ---------------------------------------
# SERVICE BOOKING
# ---------------------------------------

@app.route("/book-service", methods=["POST"])
def book_service():

    try:

        data = request.get_json(silent=True) or {}

        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        phone = str(data.get("phone", "")).strip()

        service = str(data.get("service", "")).strip()
        property_type = str(data.get("property", "")).strip()

        booking_date = str(data.get("date", "")).strip()
        booking_time = str(data.get("time", "")).strip()

        address = str(data.get("address", "")).strip()
        notes = str(data.get("notes", "")).strip()

        # Email is optional.
        if not all([
            name,
            phone,
            service,
            property_type,
            booking_date,
            booking_time,
            address
        ]):

            return jsonify({
                "error": "Please fill in all required booking fields."
            }), 400

        # Validate date format.
        try:
            datetime.strptime(booking_date, "%Y-%m-%d")
        except ValueError:

            return jsonify({
                "error": "Invalid booking date."
            }), 400

        booking_id = "PC" + datetime.now().strftime(
            "%Y%m%d%H%M%S%f"
        )

        headers = [
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
        ]

        with excel_lock:

            # Open or create workbook.
            if os.path.exists(SERVICES_FILE):
                workbook = load_workbook(SERVICES_FILE)
            else:
                workbook = Workbook()

            # Find or create booking sheet.
            if "Service Bookings" in workbook.sheetnames:
                sheet = workbook["Service Bookings"]
            else:
                sheet = workbook.create_sheet("Service Bookings")

            # Add headers if the sheet is empty.
            if sheet.max_row == 1 and sheet.cell(1, 1).value is None:
                for column, heading in enumerate(headers, start=1):
                    sheet.cell(row=1, column=column, value=heading)

            # If an older sheet exists, update its headers.
            elif sheet.max_row == 1:
                for column, heading in enumerate(headers, start=1):
                    sheet.cell(row=1, column=column, value=heading)

            # Add booking.
            sheet.append([
                booking_id,
                name,
                email,
                phone,
                service,
                property_type,
                booking_date,
                booking_time,
                address,
                notes,
                "Pending"
            ])

            # Save workbook.
            workbook.save(SERVICES_FILE)
            workbook.close()

            # Verify saved file exists and is not empty.
            if not os.path.exists(SERVICES_FILE):
                raise IOError("Excel file was not created.")

            if os.path.getsize(SERVICES_FILE) == 0:
                raise IOError("Excel file is empty.")

        # Terminal confirmation.
        print("---------------------------------------")
        print("BOOKING SAVED SUCCESSFULLY!")
        print("Booking ID:", booking_id)
        print("Customer:", name)
        print("Service:", service)
        print("Excel location:", SERVICES_FILE)
        print("---------------------------------------")

        return jsonify({
            "message": "Booking saved successfully!",
            "booking_id": booking_id
        }), 200

    except PermissionError:

        app.logger.exception("Excel file permission error")

        return jsonify({
            "error": "Please close pestcare_services.xlsx in Excel and try again."
        }), 500

    except Exception:

        app.logger.exception("Booking error")

        return jsonify({
            "error": "Booking could not be saved. Check the Flask terminal."
        }), 500


# ---------------------------------------
# RUN FLASK SERVER
# ---------------------------------------

if __name__ == "__main__":

    print("=======================================")
    print("       PESTCARE WEBSITE SERVER")
    print("=======================================")

    print("Homepage:", "http://127.0.0.1:5000/")
    print("Login:", "http://127.0.0.1:5000/login")
    print("Booking:", "http://127.0.0.1:5000/booking.html")

    print("---------------------------------------")
    print("Users Excel:", USERS_FILE)
    print("Services Excel:", SERVICES_FILE)
    print("---------------------------------------")

    app.run(debug=True, use_reloader=False)
