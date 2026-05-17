class AlertModal {
    constructor(dialogId = 'custom-modal') {
        this.dialogId = dialogId;
        this.init();
    }

    init() {
        if (document.getElementById(this.dialogId)) {
            this.dialog = document.getElementById(this.dialogId);
            return;
        }

        this.dialog = document.createElement('dialog');
        this.dialog.id = this.dialogId;
        this.dialog.className = 'bg-surface-container-high border border-outline-variant rounded-xl shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm p-0 w-[90%] max-w-md m-auto focus:outline-none';
        
        this.dialog.innerHTML = `
            <div class="p-6">
                <h3 id="modal-title" class="text-xl font-black tracking-widest text-on-background mb-2 uppercase">Alert</h3>
                <p id="modal-message" class="text-on-surface-variant font-bold text-sm mb-8 leading-relaxed"></p>
                <div id="modal-actions" class="flex justify-end gap-3 m-0"></div>
            </div>
        `;

        document.body.appendChild(this.dialog);
    }

    show(title, message, type = 'alert') {
        return new Promise((resolve) => {
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const actionsEl = document.getElementById('modal-actions');

            titleEl.textContent = title;
            messageEl.textContent = message;
            actionsEl.innerHTML = ''; 
            
            titleEl.className = 'text-xl font-black tracking-widest mb-2 uppercase ';

            if (type === 'confirm') {
                titleEl.className += 'text-red-400';
                actionsEl.innerHTML = `
                    <button id="modal-cancel" class="px-5 py-2 rounded-md text-on-surface-variant hover:text-on-background hover:bg-white/5 transition-colors font-bold text-sm">Cancel</button>
                    <button id="modal-confirm" class="px-5 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors font-bold text-sm">Confirm</button>
                `;

                document.getElementById('modal-cancel').onclick = () => {
                    this.dialog.close();
                    resolve(false); 
                };
                document.getElementById('modal-confirm').onclick = () => {
                    this.dialog.close();
                    resolve(true); 
                };
            } else {
                titleEl.className += title.toLowerCase() === 'error' ? 'text-red-500' : 'text-primary';
                actionsEl.innerHTML = `
                    <button id="modal-ok" class="px-5 py-2 rounded-md bg-primary-container/10 text-primary hover:bg-primary-container/20 border border-primary/20 transition-colors font-bold text-sm">Got it</button>
                `;
                
                document.getElementById('modal-ok').onclick = () => {
                    this.dialog.close();
                    resolve(true);
                };
            }

            this.dialog.showModal();
        });
    }
}

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AlertModal };
}