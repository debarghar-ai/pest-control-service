
import json
import os
import secrets
from getpass import getpass
from werkzeug.security import generate_password_hash

FILE_NAME = "admin_credentials.json"


def load_credentials():
    if not os.path.exists(FILE_NAME):
        return {
            "secret_key": secrets.token_hex(32),
            "admins": []
        }

    with open(FILE_NAME, "r") as file:
        data = json.load(file)

    if "admins" not in data:
        data = {
            "secret_key": secrets.token_hex(32),
            "admins": [{
                "username": data["username"],
                "password_hash": data["password_hash"],
                "role": "main_admin"
            }]
        }

    # Give the first existing admin the Main Admin role.
    for index, admin in enumerate(data["admins"]):
        if index == 0:
            admin["role"] = "main_admin"
        else:
            admin["role"] = "admin"

    if not data.get("secret_key"):
        data["secret_key"] = secrets.token_hex(32)

    save_credentials(data)
    return data


def save_credentials(data):
    temporary_file = FILE_NAME + ".tmp"

    with open(temporary_file, "w") as file:
        json.dump(data, file, indent=4)

    os.replace(temporary_file, FILE_NAME)


def add_admin(data):
    username = input("Enter admin username: ").strip()

    if not username:
        print("Username cannot be empty.")
        return

    if any(a["username"].lower() == username.lower()
           for a in data["admins"]):
        print("Username already exists.")
        return

    password = getpass("Create password (minimum 12 characters): ")
    confirm = getpass("Confirm password: ")

    if len(password) < 12:
        print("Password must contain at least 12 characters.")
        return

    if password != confirm:
        print("Passwords do not match.")
        return

    data["admins"].append({
        "username": username,
        "password_hash": generate_password_hash(password),
        "role": "admin"
    })

    save_credentials(data)
    print("Admin account created successfully!")


def list_admins(data):
    print("\n--- PESTCARE ADMIN ACCOUNTS ---")

    for number, admin in enumerate(data["admins"], start=1):
        role = admin.get("role", "admin")
        print(f"{number}. {admin['username']} ({role})")

    print("Total admins:", len(data["admins"]))


def remove_admin(data):
    list_admins(data)

    username = input("Enter username to remove: ").strip()

    admin = next(
        (a for a in data["admins"]
         if a["username"].lower() == username.lower()),
        None
    )

    if not admin:
        print("Admin not found.")
        return

    if admin.get("role") == "main_admin":
        print("The Main Admin account cannot be removed here.")
        return

    confirm = input("Confirm removal? (yes/no): ").strip().lower()

    if confirm == "yes":
        data["admins"].remove(admin)
        save_credentials(data)
        print("Admin removed successfully!")


def change_admin_password(data):
    list_admins(data)

    username = input("Enter admin username: ").strip()

    admin = next(
        (a for a in data["admins"]
         if a["username"].lower() == username.lower()),
        None
    )

    if not admin:
        print("Admin not found.")
        return

    password = getpass("Enter new password (minimum 12 characters): ")
    confirm = getpass("Confirm new password: ")

    if len(password) < 12:
        print("Password must contain at least 12 characters.")
        return

    if password != confirm:
        print("Passwords do not match.")
        return

    admin["password_hash"] = generate_password_hash(password)
    save_credentials(data)
    print("Password changed successfully!")


def main():
    try:
        data = load_credentials()

        while True:
            print("\n===== PESTCARE ADMIN MANAGER =====")
            print("1. Add Admin")
            print("2. View Admins")
            print("3. Remove Admin")
            print("4. Change Admin Password")
            print("5. Exit")

            choice = input("Choose an option: ").strip()

            if choice == "1":
                add_admin(data)
            elif choice == "2":
                list_admins(data)
            elif choice == "3":
                remove_admin(data)
            elif choice == "4":
                change_admin_password(data)
            elif choice == "5":
                break
            else:
                print("Invalid choice.")

    except (OSError, json.JSONDecodeError, KeyError) as error:
        print("Admin manager error:", error)


if __name__ == "__main__":
    main()
