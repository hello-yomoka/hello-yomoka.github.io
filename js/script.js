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

    // -----------------------------
    // Navigation menu
    // -----------------------------
    const nav = document.querySelector(".header .nav");

    if (nav) {
        const navigation = nav.closest("nav");
        const menuButton = document.createElement("button");
        const navId = "site-navigation";

        nav.id = navId;
        menuButton.type = "button";
        menuButton.className = "nav-toggle";
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-controls", navId);
        menuButton.textContent = "メニュー";
        navigation.before(menuButton);

        menuButton.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("nav-open");
            menuButton.setAttribute("aria-expanded", String(isOpen));
        });

        const usageLink = Array.from(nav.querySelectorAll('a[href="usage.html"]')).find(link => link.parentElement.parentElement === nav);

        if (usageLink) {
            const usageItem = usageLink.parentElement;
            const usageDropdown = document.createElement("li");
            const usageLabel = document.createElement("div");
            const usageToggle = document.createElement("button");
            const usageSubmenu = document.createElement("ul");
            const usageParentLink = document.createElement("a");
            const usageCurrent = usageLink.getAttribute("aria-current");

            usageDropdown.className = "nav-dropdown";
            usageLabel.className = "nav-dropdown-label";
            usageParentLink.href = "usage.html";
            usageParentLink.textContent = "使い方 ";
            usageParentLink.insertAdjacentHTML("beforeend", '<span class="nav-dropdown-indicator" aria-hidden="true">▼</span>');

            if (usageCurrent) {
                usageParentLink.setAttribute("aria-current", usageCurrent);
            }

            usageToggle.className = "nav-dropdown-toggle";
            usageToggle.type = "button";
            usageToggle.setAttribute("aria-expanded", "false");
            usageToggle.setAttribute("aria-controls", "usage-submenu");
            usageToggle.setAttribute("aria-label", "使い方の詳細を開く");
            usageToggle.textContent = "▼";

            usageSubmenu.className = "nav-submenu";
            usageSubmenu.id = "usage-submenu";
            usageSubmenu.innerHTML = '<li><a href="usage.html">使い方トップ</a></li><li><a href="csv.html">CSVの作り方</a></li>';

            usageLabel.append(usageParentLink, usageToggle);
            usageDropdown.append(usageLabel, usageSubmenu);
            usageItem.replaceWith(usageDropdown);
        }

        nav.querySelectorAll(".nav-dropdown-toggle").forEach(toggle => {
            toggle.addEventListener("click", () => {
                const dropdown = toggle.closest(".nav-dropdown");
                const isOpen = dropdown.classList.toggle("is-open");
                toggle.setAttribute("aria-expanded", String(isOpen));
            });
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 760) {
                nav.classList.remove("nav-open");
                menuButton.setAttribute("aria-expanded", "false");
                nav.querySelectorAll(".nav-dropdown").forEach(dropdown => dropdown.classList.remove("is-open"));
                nav.querySelectorAll(".nav-dropdown-toggle").forEach(toggle => toggle.setAttribute("aria-expanded", "false"));
            }
        });
    }



});
