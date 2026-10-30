
const form = document.getElementById('bookingForm');

const service = document.getElementById('service');
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');

const propertyInputs = [
  ...document.querySelectorAll('input[name="property"]')
];

// Prevent customers from selecting a date in the past.
const now = new Date();

dateInput.min = new Date(
  now.getTime() - now.getTimezoneOffset() * 60000
).toISOString().slice(0, 10);


function getProperty() {
  return propertyInputs.find(input => input.checked)?.value
    || 'Not selected';
}


function formatDate(value) {
  if (!value) return 'Not selected';

  return new Date(value + 'T12:00:00').toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );
}


// Update booking summary automatically.
function updateSummary() {

  document.getElementById('sumService').textContent =
    service.value || 'Not selected';

  document.getElementById('sumProperty').textContent =
    getProperty();

  document.getElementById('sumDate').textContent =
    formatDate(dateInput.value);

  document.getElementById('sumTime').textContent =
    timeInput.value || 'Not selected';
}


form.addEventListener('input', updateSummary);
form.addEventListener('change', updateSummary);


// Automatically select a service from the homepage link.
const requestedService =
  new URLSearchParams(window.location.search).get('service');

if (requestedService) {

  const matchingOption = [...service.options].find(option =>
    option.value === requestedService ||
    option.text === requestedService
  );

  if (matchingOption) {
    service.value = matchingOption.value;
  }
}

updateSummary();


// Submit booking form.
form.addEventListener('submit', event => {

  event.preventDefault();

  if (!form.reportValidity()) return;

  const booking = Object.fromEntries(
    new FormData(form).entries()
  );

  booking.createdAt = new Date().toISOString();

  booking.reference =
    'PC-' + Date.now().toString().slice(-8);


  // Save bookings in browser storage.
  let bookings = [];

  try {
    bookings = JSON.parse(
      localStorage.getItem('pestcareBookings') || '[]'
    );
  } catch (error) {
    bookings = [];
  }


  bookings.push(booking);

  try {

    localStorage.setItem(
      'pestcareBookings',
      JSON.stringify(bookings)
    );

  } catch (error) {

    alert(
      'The booking could not be saved in this browser. Check browser storage settings.'
    );

    return;
  }


  // Show confirmation.
  document.getElementById('successMessage').textContent =
    `Your ${booking.service} request for ${formatDate(booking.date)} (${booking.time}) has been saved in this browser.`;

  document.getElementById('reference').textContent =
    'Reference: ' + booking.reference;


  document.getElementById('bookingLayout').hidden = true;

  document.querySelector('.intro').hidden = true;

  document.getElementById('success').hidden = false;

  document.getElementById('success').scrollIntoView({
    behavior: 'smooth'
  });

});


// Book another service.
document.getElementById('newBooking').addEventListener('click', () => {

  form.reset();

  updateSummary();

  document.getElementById('success').hidden = true;

  document.getElementById('bookingLayout').hidden = false;

  document.querySelector('.intro').hidden = false;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

});


// Print booking summary.
document.getElementById('printBooking').addEventListener('click', () => {
  window.print();
});
