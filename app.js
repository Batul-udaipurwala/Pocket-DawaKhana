let inventory = JSON.parse(localStorage.getItem('dad_medicine_cabinet')) || [];
const defaultSymptoms = ["Viral", "Fever", "Tooth Ache", "Throat Ache", "Acidity", "Sinus", "Gas", "Cough"];

document.addEventListener('DOMContentLoaded', () => {
    // RUN APP TIMED PRELOADER
    setTimeout(() => {
        const preloader = document.getElementById('app-preloader');
        const mainContent = document.getElementById('app-main-content');
        
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.classList.add('hidden');
            mainContent.classList.remove('hidden');
            // Trigger dynamic systems elements rendering once UI space structural layout opens up
            initNavigation();
            initFormSuggestions();
            renderApp();
        }, 400); // Fading transition buffer
    }, 1000); // Preloader displays for 1.5 seconds

    // Operational event listener connections
    document.getElementById('add-packet-form').addEventListener('submit', handleAddPacket);
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('btn-export').addEventListener('click', exportBackup);
    document.getElementById('btn-import').addEventListener('change', importBackup);
});

// NAVIGATION FRAME CONTROLLER
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Special FAB behavior: If clicked while add form is active, click it again to escape safely back to home
            if(item.classList.contains('btn-nav-add') && item.classList.contains('active')) {
                document.querySelector('[data-tab="tab-home"]').click();
                return;
            }

            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            renderApp();
        });
    });
}

// FORM AUTOMATED SUGGESTIONS
function initFormSuggestions() {
    const container = document.getElementById('form-suggestions');
    container.innerHTML = '';
    
    const uniqueExisting = [...new Set(inventory.map(item => item.symptom))];
    const combined = [...new Set([...defaultSymptoms, ...uniqueExisting])].slice(0, 8);

    combined.forEach(symptom => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = symptom;
        chip.addEventListener('click', () => {
            document.getElementById('med-symptom').value = symptom;
        });
        container.appendChild(chip);
    });
}

// MAIN RE-RENDERING ENGINE
function saveToStorage() {
    localStorage.setItem('dad_medicine_cabinet', JSON.stringify(inventory));
}

function renderApp() {
    saveToStorage();
    renderHomeTiles();
    renderAllPackets();
    renderExpiryDashboard();
    handleSearch();
}

function renderHomeTiles() {
    const tileContainer = document.getElementById('symptom-chips-container');
    tileContainer.innerHTML = '';

    const operationalSymptoms = [...new Set(
        inventory.filter(item => item.qty > 0).map(item => item.symptom)
    )];

    const targetDisplay = operationalSymptoms.length > 0 ? operationalSymptoms : defaultSymptoms;

    targetDisplay.slice(0, 6).forEach(symptom => {
        const tile = document.createElement('div');
        tile.className = 'symptom-tile';
        tile.innerHTML = `<i class="fa-solid fa-pills" style="color: var(--primary); margin-bottom: 8px; font-size: 1.3rem;"></i><br>${symptom}`;
        tile.addEventListener('click', () => {
            const searchBar = document.getElementById('search-input');
            searchBar.value = symptom;
            handleSearch();
            searchBar.scrollIntoView({ behavior: 'smooth' });
        });
        tileContainer.appendChild(tile);
    });
}

function renderAllPackets() {
    const container = document.getElementById('all-packets-list');
    document.getElementById('total-packets-count').textContent = `${inventory.length} Packets`;
    buildPacketListMarkup(inventory, container, true);
}

function buildPacketListMarkup(dataArray, TargetContainer, showActionControls = false) {
    TargetContainer.innerHTML = '';
    
    if(dataArray.length === 0) {
        TargetContainer.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:40px 20px;">
                <i class="fa-solid fa-box-open" style="font-size:2.5rem; color:#cbd5e1; margin-bottom:12px;"></i>
                <p>No packets found matching this section.</p>
            </div>`;
        return;
    }

    dataArray.forEach(packet => {
        const card = document.createElement('div');
        const expiryStatus = checkExpiryStatus(packet.expiry);
        let borderClass = '';
        let expiryText = packet.expiry ? formatDate(packet.expiry) : 'No expiry date set';
        
        if (expiryStatus === 'EXPIRED') {
            borderClass = 'expired-border';
            expiryText = `Expired (${expiryText})`;
        } else if (expiryStatus === 'SOON') {
            borderClass = 'warning-border';
            expiryText = `Expiring Soon (${expiryText})`;
        }

        card.className = `packet-card ${borderClass}`;
        card.innerHTML = `
            <div class="packet-main">
                <div>
                    <div class="packet-symptom">${packet.symptom}</div>
                    <div class="packet-type"><i class="fa-regular fa-capsules"></i> ${packet.type}</div>
                </div>
                <div class="packet-stock">${packet.qty} <span style="font-size:0.75rem; font-weight:600; text-transform:lowercase;">${packet.unit}</span></div>
            </div>
            ${packet.notes ? `<div class="packet-notes"><strong>Note:</strong> ${packet.notes}</div>` : ''}
            <div class="packet-meta">
                <i class="fa-regular fa-calendar-check"></i> ${expiryText}
            </div>
            ${showActionControls ? `
                <div class="packet-actions">
                    <button class="btn-action btn-use" onclick="consumeMedicine('${packet.id}')"><i class="fa-solid fa-minus"></i> Use 1</button>
                    <button class="btn-action btn-delete" onclick="removePacket('${packet.id}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            ` : ''}
        `;
        TargetContainer.appendChild(card);
    });
}

// MANAGEMENT TRANSACTIONS
function handleAddPacket(e) {
    e.preventDefault();
    
    const newPacket = {
        id: 'pkg_' + Date.now(),
        symptom: document.getElementById('med-symptom').value.trim(),
        type: document.getElementById('med-type').value,
        unit: document.getElementById('med-unit').value,
        qty: parseFloat(document.getElementById('med-qty').value),
        expiry: document.getElementById('med-expiry').value,
        notes: document.getElementById('med-notes').value.trim()
    };

    inventory.unshift(newPacket);
    renderApp();
    initFormSuggestions();
    
    document.getElementById('add-packet-form').reset();
    
    // Smoothly bounce user back directly to inventory list page view frame
    document.querySelector('[data-tab="tab-packets"]').click();
}

function consumeMedicine(id) {
    const index = inventory.findIndex(p => p.id === id);
    if(index !== -1) {
        if(inventory[index].qty > 1) {
            inventory[index].qty -= 1;
        } else {
            const confirmRemove = confirm(`This is the last unit of "${inventory[index].symptom}". Delete empty packet?`);
            if(confirmRemove) {
                inventory.splice(index, 1);
            } else {
                inventory[index].qty = 0;
            }
        }
        renderApp();
    }
}

function removePacket(id) {
    if(confirm('Remove this packet permanently from your cabinet?')) {
        inventory = inventory.filter(p => p.id !== id);
        renderApp();
    }
}

// REALTIME FILTER SEARCH
function handleSearch() {
    const criteria = document.getElementById('search-input').value.toLowerCase().trim();
    const resultList = document.getElementById('home-packet-list');
    
    if (criteria === '') {
        resultList.innerHTML = '';
        return;
    }

    const filtered = inventory.filter(packet => 
        packet.symptom.toLowerCase().includes(criteria) || 
        (packet.notes && packet.notes.toLowerCase().includes(criteria))
    );

    buildPacketListMarkup(filtered, resultList, true);
}

// HEALTH CONTROL (EXPIRY TIMELINES)
function checkExpiryStatus(dateString) {
    if(!dateString) return 'OK';
    const expiryDate = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const safetyBufferDays = 60;
    const alertThreshold = new Date();
    alertThreshold.setDate(today.getDate() + safetyBufferDays);

    if (expiryDate < today) return 'EXPIRED';
    if (expiryDate <= alertThreshold) return 'SOON';
    return 'OK';
}

function renderExpiryDashboard() {
    const expiredList = inventory.filter(p => checkExpiryStatus(p.expiry) === 'EXPIRED');
    const soonList = inventory.filter(p => checkExpiryStatus(p.expiry) === 'SOON');

    document.getElementById('count-expired').textContent = expiredList.length;
    document.getElementById('count-soon').textContent = soonList.length;

    const mergedBadList = [...expiredList, ...soonList];
    const dashboardContainer = document.getElementById('expiry-packet-list');
    
    buildPacketListMarkup(mergedBadList, dashboardContainer, false);
}

// SECURITY BACKUPS
function exportBackup() {
    if(inventory.length === 0) {
        alert("Nothing to export yet!");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inventory, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dads_dispensary_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importBackup(e) {
    const fileReader = new FileReader();
    fileReader.onload = function(event) {
        try {
            const parsedData = JSON.parse(event.target.result);
            if(Array.isArray(parsedData)) {
                if(confirm(`Found ${parsedData.length} records. Merge into your cabinet?`)) {
                    inventory = [...parsedData, ...inventory];
                    const uniqueMap = {};
                    inventory = inventory.filter(item => uniqueMap[item.id] ? false : (uniqueMap[item.id] = true));
                    renderApp();
                    alert("Backup data fully restored!");
                }
            } else {
                alert("Invalid backup file format.");
            }
        } catch(err) {
            alert("Error reading file.");
        }
    };
    fileReader.readAsText(e.target.files[0]);
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}