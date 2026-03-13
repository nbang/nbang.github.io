document.addEventListener('DOMContentLoaded', () => {
    fetch('freefordev-data.json')
        .then(response => response.json())
        .then(jsonData => {
            const data = jsonData;
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
                        header.className = 'flex items-center gap-4 mb-6 sticky top-24 z-40 py-4 bg-gray-50/90 backdrop-blur-md -mx-4 px-4 md:mx-0 md:px-0 border-b border-gray-200';
                        header.innerHTML = `
                            <h2 class="font-heading text-2xl font-bold text-gray-900 flex items-center gap-3">
                                ${category.name}
                                <span class="text-xs font-mono font-normal text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm">${itemsToShow.length}</span>
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
                            card.className = 'group bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-xl border border-white/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden p-6 cursor-pointer flex flex-col h-full animate-[fadeIn_0.5s_ease-out]';

                            card.innerHTML = `
                                <div class="relative z-10 flex flex-col h-full">
                                    <div class="flex items-start justify-between gap-2 mb-2">
                                        <h3 class="font-bold text-gray-900 group-hover:text-sky-600 transition-colors line-clamp-1" title="${item.name}">
                                            ${item.name}
                                        </h3>
                                        <i class="fa-solid fa-arrow-up-right-from-square text-xs text-gray-400 group-hover:text-sky-500 transition-colors pt-1"></i>
                                    </div>
                                    
                                    <p class="text-sm text-gray-500 leading-relaxed grow line-clamp-4 group-hover:text-gray-600 transition-colors">
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

        })
        .catch(error => {
            console.error('Error fetching freefordev-data.json:', error);
            document.getElementById('contentContainer').innerHTML = '<div class="text-center text-red-400">Error loading data. Please ensure freefordev-data.json exists.</div>';
        });
});
