
document.addEventListener("DOMContentLoaded", function () {

    const bookingList = document.getElementById("bookingList");
    const loadingMessage = document.getElementById("loadingMessage");
    const errorMessage = document.getElementById("errorMessage");
    const emptyMessage = document.getElementById("emptyMessage");

    const totalBookings = document.getElementById("totalBookings");
    const pendingBookings = document.getElementById("pendingBookings");
    const completedBookings = document.getElementById("completedBookings");

    const refreshBtn = document.getElementById("refreshBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    function getStatusClass(status) {
        const normalized = String(status || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");

        if (normalized === "pending") return "status-pending";
        if (normalized === "completed") return "status-completed";
        if (normalized === "confirmed") return "status-confirmed";
        if (normalized === "in-progress") return "status-in-progress";
        if (normalized === "cancelled") return "status-cancelled";

        return "status-default";
    }

    function createDetail(label, value) {
        const wrapper = document.createElement("div");
        wrapper.className = "booking-detail";

        const small = document.createElement("small");
        small.textContent = label;

        const strong = document.createElement("strong");
        strong.textContent = value || "Not provided";

        wrapper.append(small, strong);
        return wrapper;
    }

    function createBookingCard(booking) {
        const card = document.createElement("article");
        card.className = "booking-card";

        const header = document.createElement("div");
        header.className = "booking-card-header";

        const titleWrapper = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = booking["Service Name"] || "PestCare Service";

        const bookingId = document.createElement("div");
        bookingId.className = "booking-id";
        bookingId.textContent =
            "Booking ID: " + (booking["Booking ID"] || "Not available");

        titleWrapper.append(title, bookingId);

        const status = document.createElement("span");
        status.className =
            "booking-status " + getStatusClass(booking.Status);
        status.textContent = booking.Status || "Pending";

        header.append(titleWrapper, status);

        const details = document.createElement("div");
        details.className = "booking-details";

        details.append(
            createDetail("Booking Date", booking["Booking Date"]),
            createDetail("Preferred Time", booking["Preferred Time"]),
            createDetail("Property Type", booking["Property Type"]),
            createDetail("Address", booking.Address)
        );

        card.append(header, details);
        return card;
    }

    async function loadBookingHistory() {
        loadingMessage.hidden = false;
        errorMessage.hidden = true;
        emptyMessage.hidden = true;
        bookingList.replaceChildren();

        try {
            const response = await fetch("/customer-bookings", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            });

            if (response.status === 401) {
                window.location.href = "/login?next=/history.html";
                return;
            }

            // Read the response as text first.
            const responseText = await response.text();

            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    "Server returned HTTP " + response.status +
                    " instead of JSON. Response: " +
                    responseText.substring(0, 150)
                );
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Could not load booking history."
                );
            }

            const bookings = Array.isArray(data.bookings)
                ? data.bookings
                : [];

            totalBookings.textContent = bookings.length;

            pendingBookings.textContent = bookings.filter(
                booking =>
                    String(booking.Status || "").toLowerCase() === "pending"
            ).length;

            completedBookings.textContent = bookings.filter(
                booking =>
                    String(booking.Status || "").toLowerCase() === "completed"
            ).length;

            loadingMessage.hidden = true;

            if (bookings.length === 0) {
                emptyMessage.hidden = false;
                return;
            }

            bookings.forEach(booking => {
                bookingList.appendChild(createBookingCard(booking));
            });

        } catch (error) {
            loadingMessage.hidden = true;
            errorMessage.hidden = false;
            errorMessage.textContent = error.message;

            console.error("Booking history error:", error);
        }
    }

    refreshBtn.addEventListener("click", loadBookingHistory);

    logoutBtn.addEventListener("click", async function () {
        logoutBtn.disabled = true;

        try {
            const response = await fetch("/customer-logout", {
                method: "GET",
                credentials: "same-origin"
            });

            if (response.ok) {
                window.location.href = "/";
                return;
            }

            throw new Error("Logout failed.");

        } catch (error) {
            alert("Could not log out. Please try again.");
            logoutBtn.disabled = false;
        }
    });

    loadBookingHistory();
});
