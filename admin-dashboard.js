
document.addEventListener("DOMContentLoaded", function () {
    const bookingTable = document.getElementById("bookingTable");
    const customerTable = document.getElementById("customerTable");
    const bookingMessage = document.getElementById("bookingMessage");
    const bookingSearch = document.getElementById("bookingSearch");

    // Store all bookings for searching
    let allBookings = [];

    // Safely display values in table cells
    function createCell(value) {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        return cell;
    }

    // Support Excel column names used by Flask
    function getValue(row, ...keys) {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null) {
                return row[key];
            }
        }
        return "";
    }

    // Show Admin Management only to Main Admin
    function displayAdminManagementLink(data) {
        const adminManagementLink = document.querySelector(
            'a[href="/admin-management"]'
        );

        if (adminManagementLink) {
            adminManagementLink.style.display =
                data.admin_role === "main_admin" ? "" : "none";
        }
    }

    // Display logged-in admin's username and role
    function displayAdminDetails(data) {
        const adminName = document.getElementById("adminName");

        if (!adminName) return;

        adminName.textContent = data.admin_username || "Admin";

        let adminRole = document.getElementById("adminRole");

        if (!adminRole) {
            adminRole = document.createElement("span");
            adminRole.id = "adminRole";
            adminRole.style.marginLeft = "10px";
            adminRole.style.padding = "5px 10px";
            adminRole.style.borderRadius = "12px";
            adminRole.style.fontSize = "12px";
            adminRole.style.fontWeight = "bold";

            adminName.insertAdjacentElement("afterend", adminRole);
        }

        if (data.admin_role === "main_admin") {
            adminRole.textContent = "MAIN ADMIN";
            adminRole.style.backgroundColor = "#d1fae5";
            adminRole.style.color = "#065f46";
        } else {
            adminRole.textContent = "ADMIN";
            adminRole.style.backgroundColor = "#dbeafe";
            adminRole.style.color = "#1e40af";
        }
    }

    // Load dashboard information
    async function loadDashboard() {
        try {
            const response = await fetch("/admin-data");

            if (response.redirected || response.status === 401) {
                window.location.href = "/admin-login";
                return;
            }

            if (!response.ok) {
                throw new Error("Unable to load dashboard data.");
            }

            const data = await response.json();

            if (!Array.isArray(data.bookings) ||
                !Array.isArray(data.customers)) {
                throw new Error("Unexpected dashboard data format.");
            }

            // Apply admin role information
            displayAdminManagementLink(data);
            displayAdminDetails(data);

            // Store bookings for searching
            allBookings = data.bookings;

            displayStatistics(data);
            displayBookings(allBookings);
            displayCustomers(data.customers);

        } catch (error) {
            console.error(error);

            bookingMessage.textContent =
                "Unable to load dashboard. Please check the Flask server.";

            bookingMessage.style.color = "red";
        }
    }

    // Display statistics
    function displayStatistics(data) {
        const bookings = data.bookings;
        const customers = data.customers;

        document.getElementById("totalBookings").textContent =
            bookings.length;

        document.getElementById("totalCustomers").textContent =
            customers.length;

        document.getElementById("pendingBookings").textContent =
            bookings.filter(booking =>
                getValue(booking, "Status", "status") === "Pending"
            ).length;

        document.getElementById("confirmedBookings").textContent =
            bookings.filter(booking =>
                getValue(booking, "Status", "status") === "Confirmed"
            ).length;
    }

    // Search bookings
    function searchBookings() {
        if (!bookingSearch) return;

        const searchText = bookingSearch.value
            .trim()
            .toLowerCase();

        const filteredBookings = allBookings.filter(booking => {
            const customerName = String(
                getValue(booking, "Customer Name", "customer_name")
            ).toLowerCase();

            const phone = String(
                getValue(booking, "Phone", "phone")
            ).toLowerCase();

            const bookingId = String(
                getValue(booking, "Booking ID", "booking_id")
            ).toLowerCase();

            return (
                customerName.includes(searchText) ||
                phone.includes(searchText) ||
                bookingId.includes(searchText)
            );
        });

        displayBookings(filteredBookings);
    }

    // Display bookings
    function displayBookings(bookings) {
        bookingTable.replaceChildren();

        if (bookings.length === 0) {
            const row = document.createElement("tr");
            const cell = createCell("No bookings found.");
            cell.colSpan = 8;
            row.appendChild(cell);
            bookingTable.appendChild(row);
            return;
        }

        bookings.forEach(booking => {
            const row = document.createElement("tr");

            const bookingId = getValue(
                booking, "Booking ID", "booking_id"
            );

            row.appendChild(createCell(bookingId));

            row.appendChild(createCell(
                getValue(booking, "Customer Name", "customer_name")
            ));

            row.appendChild(createCell(
                getValue(booking, "Service Name", "service_name")
            ));

            row.appendChild(createCell(
                getValue(booking, "Booking Date", "booking_date")
            ));

            row.appendChild(createCell(
                getValue(booking, "Preferred Time", "preferred_time")
            ));

            row.appendChild(createCell(
                getValue(booking, "Phone", "phone")
            ));

            // Status dropdown
            const statusCell = document.createElement("td");
            const statusSelect = document.createElement("select");

            const statuses = [
                "Pending",
                "Confirmed",
                "Cancelled",
                "Completed"
            ];

            const currentStatus = getValue(
                booking, "Status", "status"
            ) || "Pending";

            statuses.forEach(status => {
                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;
                statusSelect.appendChild(option);
            });

            statusSelect.value = statuses.includes(currentStatus)
                ? currentStatus
                : "Pending";

            statusCell.appendChild(statusSelect);
            row.appendChild(statusCell);

            // Update button
            const actionCell = document.createElement("td");
            const updateButton = document.createElement("button");

            updateButton.textContent = "Update";

            updateButton.addEventListener("click", async function () {
                await updateBooking(
                    bookingId,
                    statusSelect.value,
                    updateButton
                );
            });

            actionCell.appendChild(updateButton);
            row.appendChild(actionCell);

            bookingTable.appendChild(row);
        });
    }

    // Display registered customers
    function displayCustomers(customers) {
        customerTable.replaceChildren();

        if (customers.length === 0) {
            const row = document.createElement("tr");
            const cell = createCell("No customers registered.");
            cell.colSpan = 4;
            row.appendChild(cell);
            customerTable.appendChild(row);
            return;
        }

        customers.forEach(customer => {
            const row = document.createElement("tr");

            row.appendChild(createCell(
                getValue(customer, "Full Name", "Name", "name")
            ));

            row.appendChild(createCell(
                getValue(customer, "Email", "email")
            ));

            row.appendChild(createCell(
                getValue(customer, "Phone", "phone")
            ));

            row.appendChild(createCell(
                getValue(
                    customer,
                    "Registration Date",
                    "Date",
                    "registration_date"
                )
            ));

            customerTable.appendChild(row);
        });
    }

    // Update booking status
    async function updateBooking(bookingId, status, button) {
        button.disabled = true;
        button.textContent = "Updating...";

        bookingMessage.textContent = "";

        try {
            const response = await fetch("/admin-update-booking", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    status: status
                })
            });

            if (response.redirected || response.status === 401) {
                window.location.href = "/admin-login";
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Could not update booking."
                );
            }

            bookingMessage.textContent =
                "Booking status updated successfully!";

            bookingMessage.style.color = "green";

            await loadDashboard();

        } catch (error) {
            bookingMessage.textContent = error.message;
            bookingMessage.style.color = "red";
        } finally {
            button.disabled = false;
            button.textContent = "Update";
        }
    }

    // Connect booking search box
    if (bookingSearch) {
        bookingSearch.addEventListener("input", searchBookings);
    }

    // Initial dashboard loading
    loadDashboard();

    // Refresh button
    const refreshButton = document.getElementById("refreshButton");

    if (refreshButton) {
        refreshButton.addEventListener("click", loadDashboard);
    }
});
