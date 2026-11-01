
const form = document.getElementById("bookingForm");

const service = document.getElementById("service");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

const propertyInputs = [
  ...document.querySelectorAll('input[name="property"]')
];

// Prevent selecting a date in the past.
const now = new Date();
dateInput.min = new Date(
  now.getTime() - now.getTimezoneOffset() * 60000
).toISOString().slice(0, 10);

function getProperty() {
  return propertyInputs.find(input => input.checked)?.value || "";
}

function formatDate(value) {
  if (!value) return "Not selected";

  return new Date(value + "T12:00:00").toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function updateSummary() {
  document.getElementById("sumService").textContent =
    service.value || "Not selected";

  document.getElementById("sumProperty").textContent =
    getProperty() || "Not selected";

  document.getElementById("sumDate").textContent =
    formatDate(dateInput.value);

  document.getElementById("sumTime").textContent =
    timeInput.value || "Not selected";
}

form.addEventListener("input", updateSummary);
form.addEventListener("change", updateSummary);

// Select a service passed from the homepage.
const requestedService =
  new URLSearchParams(window.location.search).get("service");

if (requestedService) {
  const option = [...service.options].find(
    option =>
      option.value === requestedService ||
      option.text === requestedService
  );

  if (option) service.value = option.value;
}

updateSummary();

// Send booking to Flask.
form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const booking = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    service: service.value,
    property: getProperty(),
    date: dateInput.value,
    time: timeInput.value,
    address: document.getElementById("address").value.trim(),
    notes: document.getElementById("notes").value.trim()
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    const response = await fetch("/book-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(booking)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not save booking.");
    }

    document.getElementById("successMessage").textContent =
      `Your ${booking.service} request for ${formatDate(booking.date)} has been saved successfully.`;

    document.getElementById("reference").textContent =
      "Reference: " + (result.booking_id || result.reference || "Saved");

    document.getElementById("bookingLayout").hidden = true;
    document.querySelector(".intro").hidden = true;
    document.getElementById("success").hidden = false;

    document.getElementById("success").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    alert("Booking could not be saved: " + error.message);
    console.error("Booking error:", error);

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit service request →";
  }
});

// Book another service.
document.getElementById("newBooking").addEventListener("click", () => {
  form.reset();
  updateSummary();

  document.getElementById("success").hidden = true;
  document.getElementById("bookingLayout").hidden = false;
  document.querySelector(".intro").hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Print booking summary.
document.getElementById("printBooking").addEventListener("click", () => {
  window.print();
});
