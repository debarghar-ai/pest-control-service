
document.addEventListener("DOMContentLoaded", () => {
    const addAdminForm = document.getElementById("addAdminForm");
    const changePasswordForm = document.getElementById("changePasswordForm");

    const adminTable = document.getElementById("adminTable");
    const totalAdmins = document.getElementById("totalAdmins");
    const mainAdminName = document.getElementById("mainAdminName");

    const addAdminMessage = document.getElementById("addAdminMessage");
    const passwordMessage = document.getElementById("passwordMessage");
    const tableMessage = document.getElementById("tableMessage");

    const refreshButton = document.getElementById("refreshAdmins");

    function showMessage(element, message, success = false) {
        if (!element) return;

        element.textContent = message;
        element.className = success ? "success-message" : "error-message";
    }

    async function sendRequest(url, data = null) {
        const options = {
            method: data ? "POST" : "GET",
            headers: {}
        };

        if (data) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (response.redirected) {
            window.location.href = "/admin-login";
            throw new Error("Your session has expired. Please log in again.");
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong.");
        }

        return result;
    }

    async function loadAdmins() {
        if (!adminTable) return;

        adminTable.innerHTML = "";
        showMessage(tableMessage, "Loading admin accounts...", true);

        try {
            const result = await sendRequest("/admin-list");

            const admins = result.admins || [];

            if (totalAdmins) {
                totalAdmins.textContent = admins.length;
            }

            if (mainAdminName) {
                const mainAdmin = admins.find(admin => admin.role === "main_admin");
                mainAdminName.textContent = mainAdmin
                    ? mainAdmin.username
                    : "Not found";
            }

            if (admins.length === 0) {
                showMessage(tableMessage, "No admin accounts found.");
                return;
            }

            admins.forEach(admin => {
                const row = document.createElement("tr");

                const usernameCell = document.createElement("td");
                usernameCell.textContent = admin.username;

                const roleCell = document.createElement("td");
                roleCell.textContent =
                    admin.role === "main_admin" ? "Main Admin" : "Admin";

                roleCell.className =
                    admin.role === "main_admin" ? "role-main" : "role-admin";

                const actionCell = document.createElement("td");

                if (admin.role !== "main_admin") {
                    const deleteButton = document.createElement("button");

                    deleteButton.textContent = "Delete";
                    deleteButton.className = "delete-button";

                    deleteButton.addEventListener("click", async () => {
                        const confirmed = confirm(
                            `Are you sure you want to delete ${admin.username}?`
                        );

                        if (!confirmed) return;

                        try {
                            await sendRequest("/admin-delete", {
                                username: admin.username
                            });

                            showMessage(
                                tableMessage,
                                "Admin deleted successfully.",
                                true
                            );

                            await loadAdmins();
                        } catch (error) {
                            showMessage(tableMessage, error.message);
                        }
                    });

                    actionCell.appendChild(deleteButton);
                } else {
                    actionCell.textContent = "Protected";
                }

                row.appendChild(usernameCell);
                row.appendChild(roleCell);
                row.appendChild(actionCell);

                adminTable.appendChild(row);
            });

            showMessage(tableMessage, "Admin accounts loaded.", true);

        } catch (error) {
            showMessage(tableMessage, error.message);
        }
    }

    if (addAdminForm) {
        addAdminForm.addEventListener("submit", async event => {
            event.preventDefault();

            const username = document.getElementById("adminUsername").value.trim();
            const password = document.getElementById("adminPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;

            if (!username || !password || !confirmPassword) {
                showMessage(addAdminMessage, "Please fill in all fields.");
                return;
            }

            if (password.length < 12) {
                showMessage(
                    addAdminMessage,
                    "Password must contain at least 12 characters."
                );
                return;
            }

            if (password !== confirmPassword) {
                showMessage(addAdminMessage, "Passwords do not match.");
                return;
            }

            try {
                await sendRequest("/admin-add", {
                    username,
                    password
                });

                showMessage(
                    addAdminMessage,
                    "New admin added successfully.",
                    true
                );

                addAdminForm.reset();
                await loadAdmins();

            } catch (error) {
                showMessage(addAdminMessage, error.message);
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", async event => {
            event.preventDefault();

            const username = document.getElementById("passwordUsername").value.trim();
            const password = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("newPasswordConfirm").value;

            if (!username || !password || !confirmPassword) {
                showMessage(passwordMessage, "Please fill in all fields.");
                return;
            }

            if (password.length < 12) {
                showMessage(
                    passwordMessage,
                    "Password must contain at least 12 characters."
                );
                return;
            }

            if (password !== confirmPassword) {
                showMessage(passwordMessage, "Passwords do not match.");
                return;
            }

            try {
                await sendRequest("/admin-change-password", {
                    username,
                    password
                });

                showMessage(
                    passwordMessage,
                    "Password changed successfully.",
                    true
                );

                changePasswordForm.reset();

            } catch (error) {
                showMessage(passwordMessage, error.message);
            }
        });
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", loadAdmins);
    }

    loadAdmins();
});
