
const loginForm = document.getElementById("adminLoginForm");

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const message = document.getElementById("message");
    const loginButton = document.getElementById("loginButton");

    message.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {

        const response = await fetch("/admin-login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username: username,
                password: password
            })

        });

        const result = await response.json();

        if (response.ok) {

            message.style.color = "green";
            message.textContent = "Login successful! Redirecting...";

            window.location.href = "/admin-dashboard";

        } else {

            message.style.color = "red";
            message.textContent = result.message || "Invalid login details.";

        }

    } catch (error) {

        message.style.color = "red";
        message.textContent = "Unable to connect to the server.";

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login to Dashboard";

    }

});
