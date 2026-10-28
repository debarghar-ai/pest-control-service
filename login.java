
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const form = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const switchBtn = document.getElementById("switchBtn");
const switchText = document.getElementById("switchText");
const formTitle = document.getElementById("formTitle");
const formDescription = document.getElementById("formDescription");
const exportBtn = document.getElementById("exportBtn");
const logoutBtn = document.getElementById("logoutBtn");

let isRegistering = false;

function showMessage(text) {
  message.textContent = text;
}

switchBtn.addEventListener("click", () => {
  isRegistering = !isRegistering;

  formTitle.textContent = isRegistering
    ? "Create Account"
    : "Welcome Back!";

  formDescription.textContent = isRegistering
    ? "Register for your PestCare account."
    : "Login to continue to your account.";

  submitBtn.textContent = isRegistering ? "Register" : "Login";

  switchText.textContent = isRegistering
    ? "Already have an account?"
    : "Don't have an account?";

  switchBtn.textContent = isRegistering ? "Login" : "Register";
  showMessage("");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitBtn.disabled = true;
  showMessage("Please wait...");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (isRegistering) {
      const { data, error } = await db.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (!data.session) {
        showMessage(
          "Registration received. Check your email to verify your account."
        );
      } else {
        showMessage("Account created successfully!");
      }
    } else {
      const { error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showMessage("Login successful!");
    }

    await updateSessionUI();
  } catch (error) {
    showMessage(error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

async function updateSessionUI() {
  const { data: { user } } = await db.auth.getUser();

  const loggedIn = Boolean(user);

  form.hidden = loggedIn;
  switchBtn.hidden = loggedIn;
  switchText.hidden = loggedIn;
  formTitle.textContent = loggedIn ? "You're Logged In!" :
    (isRegistering ? "Create Account" : "Welcome Back!");

  formDescription.textContent = loggedIn
    ? "Your PestCare account is active."
    : "Login to continue to your account.";

  exportBtn.hidden = !loggedIn;
  logoutBtn.hidden = !loggedIn;

  if (loggedIn) {
    showMessage("Signed in as " + user.email);
  }
}

exportBtn.addEventListener("click", async () => {
  try {
    const { data: { user }, error } = await db.auth.getUser();

    if (error || !user) {
      throw new Error("Please log in again.");
    }

    // Export only non-sensitive account information.
    // Never export passwords or authentication tokens.
    const rows = [{
      User_ID: user.id,
      Email: user.email,
      Account_Created: user.created_at
    }];

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      "My Profile"
    );

    XLSX.writeFile(workbook, "PestCare_My_Profile.xlsx");
    showMessage("Your profile Excel file has been generated.");
  } catch (error) {
    showMessage(error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(error.message);
    return;
  }

  isRegistering = false;
  form.reset();
  showMessage("Logged out successfully.");
  await updateSessionUI();
});

updateSessionUI();
