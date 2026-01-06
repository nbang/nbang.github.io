// freefordev.js

document.addEventListener('DOMContentLoaded', () => {

    // Check if data is loaded
    if (!window.freeForDevData) {
        console.error("Data not loaded! Check ensure_data.py execution.");
        document.getElementById('contentContainer').innerHTML = '<div class="text-center text-red-400">Error loading data. Please ensure freefordev-data.js exists.</div>';
        return;
    }

    const data = window.freeForDevData;
    const container = document.getElementById('contentContainer');
    const searchInput = document.getElementById('searchInput');
    const noResults = document.getElementById('noResults');
    const totalResourcesEl = document.getElementById('totalResources');
    const totalCategoriesEl = document.getElementById('totalCategories');
    const backToTopBtn = document.getElementById('backToTop');

    // Stats
    let totalItems = 0;
    data.forEach(cat => totalItems += cat.items.length);
    totalResourcesEl.innerText = totalItems;
    totalCategoriesEl.innerText = data.length;

    // Render Function
    function render(filterText = '') {
        container.innerHTML = '';
        const lowerFilter = filterText.toLowerCase();
        let hasResults = false;

        data.forEach(category => {
            // Filter items
            const filteredItems = category.items.filter(item => {
                return item.name.toLowerCase().includes(lowerFilter) ||
                    item.description.toLowerCase().includes(lowerFilter);
            });

            // If category matches name, show all items unless items themselves are filtered out? 
            // Better UX: Show items that match OR if category matches, show all?
            // Let's stick to strict item matching for now, but if category name matches, maybe include all?
            // Simplify: Filter items. If category name matches, show all items (unless specifically searched for item text).

            // Actually, commonly user searches for "Email" (Category) or "SendGrid" (Item).

            let itemsToShow = filteredItems;
            if (category.name.toLowerCase().includes(lowerFilter)) {
                itemsToShow = category.items; // Show all if category matches
            }

            if (itemsToShow.length > 0) {
                hasResults = true;

                // Create Category Section
                const section = document.createElement('section');
                section.className = 'scroll-mt-24';

                // Header
                const header = document.createElement('div');
                header.className = 'flex items-center gap-4 mb-6 sticky top-20 z-30 py-4 bg-slate-950/90 backdrop-blur-md -mx-4 px-4 md:mx-0 md:px-0 border-b border-white/5';
                header.innerHTML = `
                    <h2 class="font-heading text-2xl font-bold text-slate-100 flex items-center gap-3">
                        ${category.name}
                        <span class="text-xs font-mono font-normal text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">${itemsToShow.length}</span>
                    </h2>
                `;
                section.appendChild(header);

                // Grid
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

                itemsToShow.forEach(item => {
                    const card = document.createElement('a');
                    card.href = item.link;
                    card.target = '_blank';
                    card.className = 'group relative flex flex-col p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl hover:bg-slate-800/60 hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 overflow-hidden';

                    card.innerHTML = `
                        <div class="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-primary-500/0 to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div class="relative z-10 flex flex-col h-full">
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <h3 class="font-bold text-slate-200 group-hover:text-primary-400 transition-colors line-clamp-1" title="${item.name}">
                                    ${item.name}
                                </h3>
                                <i class="fa-solid fa-arrow-up-right-from-square text-xs text-slate-600 group-hover:text-primary-400 transition-colors pt-1"></i>
                            </div>
                            
                            <p class="text-sm text-slate-400 leading-relaxed grow line-clamp-4 group-hover:text-slate-300 transition-colors">
                                ${item.description}
                            </p>
                        </div>
                    `;
                    grid.appendChild(card);
                });

                section.appendChild(grid);
                container.appendChild(section);
            }
        });

        if (hasResults) {
            noResults.classList.add('hidden');
        } else {
            noResults.classList.remove('hidden');
        }
    }

    // Initial Render
    render();

    // Search Event
    searchInput.addEventListener('input', (e) => {
        render(e.target.value);
    });

    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // Back to Top
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.remove('translate-y-20', 'opacity-0');
        } else {
            backToTopBtn.classList.add('translate-y-20', 'opacity-0');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

});
