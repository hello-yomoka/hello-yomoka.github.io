// ========================================
// Yomoka
// script.js
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------
    // Header Shadow
    // -----------------------------
    const header = document.querySelector(".header");

    window.addEventListener("scroll", () => {

        if (window.scrollY > 10) {
            header.style.boxShadow = "0 2px 12px rgba(0,0,0,.08)";
        } else {
            header.style.boxShadow = "none";
        }

    });


    // -----------------------------
    // Smooth Scroll
    // -----------------------------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {

        anchor.addEventListener("click", function (e) {

            const targetId = this.getAttribute("href");

            if (targetId === "#") return;

            const target = document.querySelector(targetId);

            if (!target) return;

            e.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });



});
