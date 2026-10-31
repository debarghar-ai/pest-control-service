console.log("LOGIN JS IS WORKING");
document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");

    const showRegisterLink = document.getElementById("showRegister");
    const showLoginLink = document.getElementById("showLogin");

    const message = document.getElementById("message");

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("error", isError);
    }

    function showLogin() {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");

        loginTab.classList.add("active");
        registerTab.classList.remove("active");

        showMessage("");
    }

    function showRegister() {
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");

        registerTab.classList.add("active");
        loginTab.classList.remove("active");

        showMessage("");
    }

    loginTab.addEventListener("click", showLogin);
    registerTab.addEventListener("click", showRegister);

    showRegisterLink.addEventListener("click", function (event) {
        event.preventDefault();
        showRegister();
    });

    showLoginLink.addEventListener("click", function (event) {
        event.preventDefault();
        showLogin();
    });

    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("fullName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const phone = document.getElementById("phone").value.trim();

        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password.length < 8) {
            showMessage("Password must be at least 8 characters.", true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", true);
            return;
        }

        try {
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, phone })
            });

            const result = await response.json();

            if (!response.ok) {
                showMessage(result.message || "Registration failed.", true);
                return;
            }

            showMessage(result.message);
            registerForm.reset();

            setTimeout(showLogin, 1500);

        } catch (error) {
            console.error(error);
            showMessage("Could not connect to the server.", true);
        }
    });

    // Demo login only: registration currently saves user details,
    // but does not create a secure login system.
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        showMessage("Registration is connected. Login authentication is not set up yet.", true);
    });
});
