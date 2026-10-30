
const searchInput = document.getElementById("serviceSearch");
const filterButtons = document.querySelectorAll(".filter-btn");
const serviceCards = document.querySelectorAll(".service-card");
const noResults = document.getElementById("noResults");

let activeFilter = "all";

function filterServices() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    serviceCards.forEach((card) => {
        const categories = card.dataset.category.split(" ");
        const searchableText = (
            card.dataset.search + " " + card.innerText
        ).toLowerCase();

        const matchesSearch = searchableText.includes(searchTerm);
        const matchesCategory =
            activeFilter === "all" || categories.includes(activeFilter);

        const shouldShow = matchesSearch && matchesCategory;

        card.hidden = !shouldShow;

        if (shouldShow) {
            visibleCount++;
        }
    });

    noResults.hidden = visibleCount !== 0;
}

searchInput.addEventListener("input", filterServices);

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        filterButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");
        filterServices();
    });
});

// Mobile navigation
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "✕" : "☰";
});

// Close mobile navigation after selecting a link
navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

// Automatically update the copyright year
document.getElementById("currentYear").textContent =
    new Date().getFullYear();
