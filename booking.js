
// ==========================================
// PESTCARE BOOKING PAGE
// ==========================================

const form = document.getElementById("bookingForm");

const service = document.getElementById("service");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

const propertyInputs = [
  ...document.querySelectorAll('input[name="property"]')
];

const submitButton = form.querySelector('button[type="submit"]');
const formMessage = document.getElementById("formMessage");


// ==========================================
// PREVENT PAST DATES
// ==========================================

function getToday() {
  const now = new Date();

  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

dateInput.min = getToday();


// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getProperty() {
  return propertyInputs.find(input => input.checked)?.value || "";
}


function formatDate(value) {
  if (!value) return "Not selected";

  return new Date(value + "T12:00:00").toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}


// ==========================================
// UPDATE BOOKING SUMMARY
// ==========================================

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


// ==========================================
// SELECT SERVICE FROM HOMEPAGE
// ==========================================

const requestedService =
  new URLSearchParams(window.location.search).get("service");

if (requestedService) {

  const option = [...service.options].find(
    option =>
      option.value === requestedService ||
      option.text === requestedService
  );

  if (option) {
    service.value = option.value;
  }
}

updateSummary();


// ==========================================
// SUBMIT BOOKING TO FLASK
// ==========================================

form.addEventListener("submit", async event => {

  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  if (dateInput.value < getToday()) {
    showError("Please select today or a future date.");
    dateInput.focus();
    return;
  }

  // IMPORTANT:
  // These field names match app.py exactly.

  const booking = {

    customer_name:
      document.getElementById("name").value.trim(),

    email:
      document.getElementById("email").value.trim(),

    phone:
      document.getElementById("phone").value.trim(),

    service_name:
      service.value,

    property_type:
      getProperty(),

    booking_date:
      dateInput.value,

    preferred_time:
      timeInput.value,

    address:
      document.getElementById("address").value.trim(),

    additional_details:
      document.getElementById("notes").value.trim()
  };


  // Disable button during submission.

  submitButton.disabled = true;
  submitButton.textContent = "Submitting request...";

  formMessage.hidden = true;

  try {

    const response = await fetch("/book-service", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(booking)

    });

    const result = await response.json();

    if (!response.ok || !result.success) {

      throw new Error(
        result.message || "Could not save your booking."
      );
    }


    // Show successful booking.

    document.getElementById("successMessage").textContent =
      `Your ${booking.service_name} request for ${formatDate(booking.booking_date)} has been submitted successfully. Our service team will review your preferred appointment.`;

    document.getElementById("reference").textContent =
      result.booking_id || "Saved successfully";


    document.getElementById("bookingLayout").hidden = true;

    document.querySelector(".intro").hidden = true;

    document.getElementById("success").hidden = false;


    document.getElementById("success").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {

    showError(error.message);

    console.error("Booking error:", error);

  } finally {

    submitButton.disabled = false;

    submitButton.innerHTML =
      'Submit service request <span>→</span>';
  }

});


// ==========================================
// DISPLAY FORM ERROR
// ==========================================

function showError(message) {

  formMessage.textContent = message;

  formMessage.hidden = false;

  formMessage.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


// ==========================================
// BOOK ANOTHER SERVICE
// ==========================================

document.getElementById("newBooking").addEventListener("click", () => {

  form.reset();

  dateInput.min = getToday();

  updateSummary();

  formMessage.hidden = true;

  document.getElementById("success").hidden = true;

  document.getElementById("bookingLayout").hidden = false;

  document.querySelector(".intro").hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});


// ==========================================
// PRINT BOOKING CONFIRMATION
// ==========================================

document.getElementById("printBooking").addEventListener("click", () => {

  window.print();

});
