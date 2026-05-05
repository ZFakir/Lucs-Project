class CivicModal {
    constructor() {
        this.modalId = 'civic-reusable-modal';
        this.init();
    }

    init() {
        if (document.getElementById(this.modalId)) {
            this.dialog = document.getElementById(this.modalId);
            return;
        }

        this.dialog = document.createElement('dialog');
        this.dialog.id = this.modalId;
        this.dialog.className = 'bg-surface border border-white/5 shadow-2xl rounded-xl overflow-hidden w-[95%] max-w-4xl p-0 backdrop:bg-background/80 backdrop:backdrop-blur-sm focus:outline-none m-auto z-50';

        this.dialog.innerHTML = `
            <header class="w-full px-8 py-5 flex items-center justify-between bg-[#1B1B1B] border-b border-white/5">
                <hgroup class="flex items-center gap-4 m-0">
                    <i id="${this.modalId}-icon" aria-hidden="true" class="material-symbols-outlined text-[#FF8C00] text-3xl" style="font-variation-settings: 'FILL' 1;">report</i>
                    <h2 id="${this.modalId}-title" class="text-white font-black tracking-tight uppercase leading-none text-2xl m-0">Issue Details</h2>
                </hgroup>
                <button id="${this.modalId}-close" type="button" class="text-[#E2E2E2] hover:bg-[#353535] transition-colors active:scale-95 duration-150 p-2 rounded-full">
                    <i aria-hidden="true" class="material-symbols-outlined">close</i>
                </button>
            </header>

            <article class="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-surface-container-lowest m-0">
                <section class="border-r border-white/5 border-b lg:border-b-0 flex flex-col">
                    <figure class="relative h-64 lg:h-80 bg-black overflow-hidden group m-0">
                        <ul id="${this.modalId}-carousel" class="flex overflow-x-auto snap-x snap-mandatory h-full w-full scrollbar-hide scroll-smooth p-0 m-0 list-none">
                        </ul>
                        <button id="${this.modalId}-prev" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-[#FF8C00] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm hidden md:block">
                            <i aria-hidden="true" class="material-symbols-outlined text-sm font-bold">arrow_back_ios_new</i>
                        </button>
                        <button id="${this.modalId}-next" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-[#FF8C00] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm hidden md:block">
                            <i aria-hidden="true" class="material-symbols-outlined text-sm font-bold">arrow_forward_ios</i>
                        </button>
                    </figure>
                </section>

                <section class="p-8 flex flex-col">
                    <main class="flex-grow">
                        <header class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 border-b border-white/5 pb-6">
                            <dl class="m-0">
                                <dt class="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Status</dt>
                                <dd id="${this.modalId}-status" class="m-0"></dd>
                            </dl>
                            <dl class="m-0">
                                <dt class="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Ward</dt>
                                <dd id="${this.modalId}-ward" class="font-bold text-white text-sm m-0"></dd>
                            </dl>
                            <dl class="m-0 lg:col-span-2">
                                <dt class="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Municipality</dt>
                                <dd id="${this.modalId}-muni" class="font-bold text-white text-sm m-0 truncate"></dd>
                            </dl>
                        </header>
                        
                        <dl class="mb-4">
                            <dt class="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Date Reported</dt>
                            <dd id="${this.modalId}-date" class="font-mono text-primary-fixed text-xs m-0"></dd>
                        </dl>
                        
                        <p id="${this.modalId}-desc" class="text-on-surface-variant font-medium leading-relaxed mb-8 text-sm"></p>
                        <section id="${this.modalId}-personnel-section" class="mt-4 border-t border-white/5 pt-6 hidden">
                             <h3 class="text-[10px] uppercase font-bold tracking-widest text-primary mb-4">Assigned Personnel</h3>
                                <div id="${this.modalId}-workers" class="flex flex-col gap-3">
                                </div>
                        </section>
                    </main>
                </section>
            </article>
        `;

        document.body.appendChild(this.dialog);
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById(`${this.modalId}-close`).addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) this.dialog.close(); 
        });

        const carousel = document.getElementById(`${this.modalId}-carousel`);
        const btnPrev = document.getElementById(`${this.modalId}-prev`);
        const btnNext = document.getElementById(`${this.modalId}-next`);

        if (btnPrev && btnNext && carousel) {
            btnNext.addEventListener('click', () => carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' }));
            btnPrev.addEventListener('click', () => carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' }));
        }
    }

getBadgeHTML(statusStr) {
        const progressStr = (statusStr || '').toLowerCase(); 
        
        // 🚨 Added 'whitespace-nowrap' and 'inline-block' to all spans
        if (progressStr === 'resolved') {
            return `<span class="inline-block whitespace-nowrap px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
        } else if (progressStr === 'in progress' || progressStr === 'assigned to field staff') {
            return `<span class="inline-block whitespace-nowrap px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
        } else {
            return `<span class="inline-block whitespace-nowrap px-3 py-1 bg-[#FF8C00] text-[#4d2600] text-[10px] font-black uppercase rounded-full">Active</span>`;
        }
    }

    // 🚨 NEW METHOD: The Modal now fetches its own images
    async fetchImagesForReport(reportId) {
        try {
            const response = await fetch(`/api/reports/report/${reportId}`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error("Failed to fetch images for modal:", error);
            return [];
        }
    }

   // 🚨 NEW: Made async so it can wait for the images
   async open(data) {
        // Set basic text data immediately
        document.getElementById(`${this.modalId}-title`).textContent = data.type || 'General Issue';
        document.getElementById(`${this.modalId}-desc`).textContent = data.description || 'No description provided.';
        document.getElementById(`${this.modalId}-date`).textContent = data.date ? new Date(data.date).toISOString().split('T')[0] : 'Unknown';
        document.getElementById(`${this.modalId}-status`).innerHTML = this.getBadgeHTML(data.status);
        
        document.getElementById(`${this.modalId}-ward`).textContent = data.ward ? `Ward ${data.ward}` : 'N/A';
        document.getElementById(`${this.modalId}-muni`).textContent = data.municipality || 'N/A';
        document.getElementById(`${this.modalId}-muni`).title = data.municipality || 'N/A'; 

        const carousel = document.getElementById(`${this.modalId}-carousel`);
        
        // 🚨 Show a beautiful loading state inside the carousel immediately
        carousel.innerHTML = `
            <li class="snap-center shrink-0 w-full h-full flex items-center justify-center bg-[#1B1B1B]">
                <span class="text-[#FF8C00] animate-pulse text-xs font-bold uppercase tracking-widest">Loading evidence...</span>
            </li>
        `;
        
        // Show the modal right away so it feels snappy
        this.dialog.showModal();

        // Now, fetch the images seamlessly in the background
        const fetchedImages = await this.fetchImagesForReport(data.id);
        
        // Clear the loading state
        carousel.innerHTML = ''; 

        if (fetchedImages.length > 0) {
            fetchedImages.forEach((img, i) => {
                let imgSrc = '';

                // Handle the clean base64 format returned by reports.js
                if (img.base64) {
                    imgSrc = `data:${img.Type};base64,${img.base64}`;
                } 
                // Fallback for raw Sequelize Buffers
                else if (img.Image && img.Image.type === 'Buffer' && img.Image.data) {
                    const uint8Array = new Uint8Array(img.Image.data);
                    const blob = new Blob([uint8Array], { type: img.Type || 'image/jpeg' });
                    imgSrc = URL.createObjectURL(blob);
                } else if (typeof img === 'string') {
                    imgSrc = img;
                }

                carousel.innerHTML += `
                    <li class="snap-center shrink-0 w-full h-full relative p-0 m-0 list-none">
                        <img src="${imgSrc}" 
                             alt="Issue Photo ${i+1}" 
                             class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                             onclick="window.open(this.src, '_blank')"
                             onerror="this.src='https://placehold.co/800x600?text=Image+Unavailable'" />
                    </li>
                `;
            });
        } else {
            carousel.innerHTML = `
                <li class="snap-center shrink-0 w-full h-full relative p-0 m-0 list-none flex items-center justify-center bg-[#1B1B1B]">
                    <span class="text-white/40 text-sm font-bold uppercase tracking-widest flex flex-col items-center gap-2">
                        <span class="material-symbols-outlined text-3xl">image_not_supported</span>
                        No Photos Provided
                    </span>
                </li>
            `;
        }

        // Personnel Section Rendering
        const personnelSection = document.getElementById(`${this.modalId}-personnel-section`);
        const workersContainer = document.getElementById(`${this.modalId}-workers`);
        
        if (data.workers === undefined) {
            personnelSection.classList.add('hidden');
        } else {
            personnelSection.classList.remove('hidden');
            
            if (data.workers.length > 0) {
                workersContainer.innerHTML = data.workers.map(w => {
                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(w.Name)}&background=353535&color=FF8C00&bold=true`;
                    return `
                        <article class="flex items-center p-3 bg-surface-container-high rounded-lg border border-white/5">
                            <img src="${avatarUrl}" alt="${w.Name}" class="w-8 h-8 rounded-full mr-4 opacity-90" />
                            <section>
                                <p class="text-sm font-bold text-white m-0 leading-tight">${w.Name}</p>
                                <p class="text-[9px] text-primary uppercase font-bold tracking-widest m-0">${w.EmployeeID}</p>
                            </section>
                        </article>
                    `;
                }).join('');
            } else {
                workersContainer.innerHTML = '<p class="text-xs text-on-surface/40 italic m-0">No personnel currently allocated to this task.</p>';
            }
        }
    }
}