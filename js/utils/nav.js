/**
 * Shared navigation bar + dark mode toggle for Bang's Tools pages.
 *
 * Usage — add ONE script tag to any tool page (after common.js):
 *   <script src="/js/utils/nav.js"></script>
 *
 * The nav bar is automatically injected before <main>.
 * Optionally configure via a data attribute on <body>:
 *   <body data-nav-back="/" data-nav-back-label="Back to Tools" data-nav-accent="red">
 *
 * data-nav-back:        URL the back-arrow links to (default: /)
 * data-nav-back-label:  Text for the back link (default: "Back to Tools")
 * data-nav-accent:      Tailwind color name for hover effect (default: "indigo")
 */

(function () {
    // ── Dark mode ──────────────────────────────────────────────────────────────
    // Apply persisted preference before the page renders (prevents flash)
    const DARK_KEY = 'bang-dark-mode';
    if (localStorage.getItem(DARK_KEY) === 'true') {
        document.documentElement.classList.add('dark');
    }

    function isDark() {
        return document.documentElement.classList.contains('dark');
    }

    function toggleDark() {
        const nowDark = !isDark();
        document.documentElement.classList.toggle('dark', nowDark);
        localStorage.setItem(DARK_KEY, String(nowDark));
        updateDarkIcon();
    }

    function updateDarkIcon() {
        const btn = document.getElementById('dark-mode-btn');
        if (!btn) return;
        btn.innerHTML = isDark()
            ? '<i class="fa-solid fa-sun text-amber-400"></i>'
            : '<i class="fa-solid fa-moon text-gray-500"></i>';
        btn.title = isDark() ? 'Switch to light mode' : 'Switch to dark mode';
    }

    // ── Inject nav ─────────────────────────────────────────────────────────────
    function injectNav() {
        const body = document.body;
        const backUrl   = body.dataset.navBack       || '/';
        const backLabel = body.dataset.navBackLabel  || 'Back to Tools';
        const accent    = body.dataset.navAccent     || 'indigo';

        const nav = document.createElement('nav');
        nav.id = 'bang-nav';
        nav.className = 'sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/50 dark:border-gray-700/50 shadow-sm';
        nav.innerHTML = `
            <div class="container mx-auto px-4 py-3 flex items-center justify-between max-w-5xl">
                <a href="${backUrl}"
                   class="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-${accent}-600 dark:hover:text-${accent}-400 transition-colors text-sm font-medium">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>${backLabel}</span>
                </a>
                <button id="dark-mode-btn"
                        class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Toggle dark mode">
                </button>
            </div>
        `;

        // Insert before first <main>, or prepend to body
        const main = document.querySelector('main');
        if (main) {
            body.insertBefore(nav, main);
        } else {
            body.prepend(nav);
        }

        document.getElementById('dark-mode-btn').addEventListener('click', toggleDark);
        updateDarkIcon();
    }

    // ── Dark mode global CSS ───────────────────────────────────────────────────
    // Inject a <style> that maps dark: Tailwind classes to common overrides.
    // Individual pages can add their own dark: classes via Tailwind as usual.
    function injectDarkStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .dark body {
                background-color: rgb(17 24 39);   /* gray-900 */
                color: rgb(229 231 235);            /* gray-200 */
            }
            .dark .bg-white\\/80 {
                background-color: rgb(31 41 55 / 0.8); /* gray-800/80 */
            }
            .dark .bg-gray-50 {
                background-color: rgb(17 24 39);
            }
            .dark .text-gray-800 { color: rgb(229 231 235); }
            .dark .text-gray-700 { color: rgb(209 213 219); }
            .dark .text-gray-600 { color: rgb(156 163 175); }
            .dark .text-gray-500 { color: rgb(107 114 128); }
            .dark .text-gray-900 { color: rgb(243 244 246); }
            .dark .border-white\\/50 { border-color: rgb(55 65 81 / 0.5); }
            .dark .bg-white {
                background-color: rgb(31 41 55);   /* gray-800 */
            }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectDarkStyles();
            injectNav();
        });
    } else {
        injectDarkStyles();
        injectNav();
    }
})();
