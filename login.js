
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

    // CUSTOMER REGISTRATION
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("fullName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const phone = document.getElementById("phone").value.trim();

        const password =
            document.getElementById("registerPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (password.length < 8) {
            showMessage("Password must be at least 8 characters.", true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.", true);
            return;
        }

        const button = registerForm.querySelector(
            'button[type="submit"]'
        );

        button.disabled = true;
        button.textContent = "Creating account...";

        try {
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    password
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(
                    result.message || "Registration failed.",
                    true
                );
                return;
            }

            showMessage(
                "Account created successfully! You can now log in."
            );

            registerForm.reset();

            setTimeout(showLogin, 1500);

        } catch (error) {
            console.error("Registration error:", error);
            showMessage("Could not connect to the server.", true);

        } finally {
            button.disabled = false;
            button.textContent = "Create Account";
        }
    });

    // CUSTOMER LOGIN
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        const button = loginForm.querySelector(
            'button[type="submit"]'
        );

        button.disabled = true;
        button.textContent = "Logging in...";

        try {
            const response = await fetch("/customer-login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(
                    result.message || "Invalid email or password.",
                    true
                );
                return;
            }

            showMessage("Login successful! Redirecting...");

            const nextPage =
                new URLSearchParams(window.location.search).get("next");

            // Only allow local website paths.
            const safeNextPage =
                nextPage &&
                nextPage.startsWith("/") &&
                !nextPage.startsWith("//") &&
                !nextPage.includes("\\")
                    ? nextPage
                    : "/";

            window.location.href = safeNextPage;

        } catch (error) {
            console.error("Login error:", error);
            showMessage("Could not connect to the server.", true);

        } finally {
            button.disabled = false;
            button.textContent = "Login";
        }
    });
});
