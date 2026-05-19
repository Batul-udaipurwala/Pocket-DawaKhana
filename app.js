// ==========================================
// 1. DATABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://puojzdgnhdwgbitgqozu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2p6ZGduaGR3Z2JpdGdxb3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjg1NjQsImV4cCI6MjA5NDc0NDU2NH0.C3YjLI3p8oEtoMKP6FfDrHeD7Y5bCOsvWYWrdWocBdU";

let supabaseClient = null;
let currentFamilyCode = "";
let currentSelectedProfile = "";
let inventory = [];
let sharedRemindersList = [];
let assignedFamilyProfiles = [];
let actionAuditTrailLogs = [];
const defaultSymptoms = ["Fever", "Cough", "Cold", "Headache", "BP", "Diabetes"];

// ==========================================
// 2. INITIALIZATION
// ==========================================
window.addEventListener('load', function() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase initialized");
    } else {
        console.error("❌ Supabase not loaded");
        alert("Error loading database. Please refresh the page.");
    }
    
    initEventListeners();
    initPrescriptionFileTracker();
    initFormSuggestions();
    initFrequencySelector();
    attemptAutoSessionRestore();
});

function initEventListeners() {
    // Auth tabs
    const joinTab = document.getElementById('tab-btn-join');
    const createTab = document.getElementById('tab-btn-create');
    if (joinTab) joinTab.addEventListener('click', () => switchAuthTab('join'));
    if (createTab) createTab.addEventListener('click', () => switchAuthTab('create'));
    
    // Auth submit
    const authBtn = document.getElementById('auth-submit-btn');
    if (authBtn) authBtn.addEventListener('click', processAuthenticationGateway);
    
    // Enter key on auth inputs
    ['auth-join-code', 'auth-create-code', 'auth-user-name'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') processAuthenticationGateway();
        });
    });
    
    // Bottom navigation
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
        });
    });
    
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    
    // Reminder form
    const reminderForm = document.getElementById('add-reminder-form');
    if (reminderForm) reminderForm.addEventListener('submit', handleCreateReminderSubmit);
    
    // Modal close buttons
    const closeUserModal = document.getElementById('close-user-modal-btn');
    if (closeUserModal) closeUserModal.addEventListener('click', () => {
        document.getElementById('add-user-modal').classList.add('hidden');
    });
    
    const submitUserBtn = document.getElementById('submit-user-btn');
    if (submitUserBtn) submitUserBtn.addEventListener('click', addNewFamilyMember);
    
    const closeEditModal = document.getElementById('close-edit-modal-btn');
    if (closeEditModal) closeEditModal.addEventListener('click', closeDetailsModal);
    
    const closePhotoModal = document.getElementById('close-photo-modal-btn');
    if (closePhotoModal) closePhotoModal.addEventListener('click', closePhotoModalFunc);
    
    // Profile dropdown
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) profileDropdown.addEventListener('change', handleProfileChange);
    
    // Click outside modal to close
    const photoModal = document.getElementById('photo-modal');
    if (photoModal) photoModal.addEventListener('click', (e) => {
        if (e.target === photoModal) closePhotoModalFunc();
    });
}

function initFrequencySelector() {
    const freqSelect = document.getElementById('rem-frequency');
    const weeklyDiv = document.getElementById('weekly-day-selector');
    const monthlyDiv = document.getElementById('monthly-date-selector');
    
    if (freqSelect) {
        freqSelect.addEventListener('change', function() {
            if (this.value === 'weekly') {
                weeklyDiv.classList.remove('hidden');
                monthlyDiv.classList.add('hidden');
            } else if (this.value === 'monthly') {
                weeklyDiv.classList.add('hidden');
                monthlyDiv.classList.remove('hidden');
            } else {
                weeklyDiv.classList.add('hidden');
                monthlyDiv.classList.add('hidden');
            }
        });
    }
}

function switchAuthTab(type) {
    const joinBtn = document.getElementById('tab-btn-join');
    const createBtn = document.getElementById('tab-btn-create');
    const joinPanel = document.getElementById('auth-join-form-panel');
    const createPanel = document.getElementById('auth-create-form-panel');
    
    if (type === 'join') {
        joinBtn.classList.add('active');
        createBtn.classList.remove('active');
        joinPanel.classList.remove('hidden');
        createPanel.classList.add('hidden');
    } else {
        joinBtn.classList.remove('active');
        createBtn.classList.add('active');
        joinPanel.classList.add('hidden');
        createPanel.classList.remove('hidden');
    }
}

function attemptAutoSessionRestore() {
    const savedCode = localStorage.getItem('dawakhan_family_code');
    const savedUser = localStorage.getItem('dawakhan_member_name');

    if (savedCode && savedUser && supabaseClient) {
        currentFamilyCode = savedCode;
        currentSelectedProfile = savedUser;
        document.getElementById('app-auth-screen').classList.add('hidden');
        document.getElementById('display-header-family-tag').textContent = `🏠 ${savedCode.toUpperCase()}`;
        showLoading("Loading your cabinet...");
        bootstrapFamilyCloudCabinet();
    }
}

function showLoading(message) {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        document.body.appendChild(loader);
    }
    loader.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 16px; text-align: center; min-width: 200px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 10px; color: #333;">${message}</p>
            </div>
        </div>
    `;
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.remove();
}

async function processAuthenticationGateway() {
    const isJoin = document.getElementById('tab-btn-join').classList.contains('active');
    const rawCode = isJoin ? document.getElementById('auth-join-code').value.trim() : document.getElementById('auth-create-code').value.trim();
    const userName = document.getElementById('auth-user-name').value.trim();

    if (!rawCode || !userName) {
        alert("Please enter both Family Code and your Name");
        return;
    }

    if (!supabaseClient) {
        alert("Database not ready. Please refresh.");
        return;
    }

    currentFamilyCode = rawCode.toLowerCase().replace(/[^a-z0-9]/g, "_");
    currentSelectedProfile = userName;

    localStorage.setItem('dawakhan_family_code', currentFamilyCode);
    localStorage.setItem('dawakhan_member_name', currentSelectedProfile);

    showLoading("Setting up...");

    try {
        // Add member to family_members table
        await supabaseClient.from('family_members').upsert([{
            family_code: currentFamilyCode,
            member_name: currentSelectedProfile
        }], { onConflict: 'family_code,member_name' });

        // Request notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        document.getElementById('app-auth-screen').classList.add('hidden');
        document.getElementById('display-header-family-tag').textContent = `🏠 ${currentFamilyCode.toUpperCase()}`;
        
        await bootstrapFamilyCloudCabinet();
    } catch (err) {
        console.error("Auth error:", err);
        alert("Error setting up. Please try again.");
        hideLoading();
    }
}

async function bootstrapFamilyCloudCabinet() {
    try {
        await Promise.all([
            pullGroupMembersList(),
            pullFamilyCabinetInventoryData(),
            pullSharedRemindersData(),
            pullCabinetActionAuditLogs()
        ]);

        renderProfileDropdownMenu();
        startLiveRealtimeListeners();
        startSystemAlarmClockScanner();

        document.getElementById('app-main-content').classList.remove('hidden');
        renderAppContent();
    } catch (error) {
        console.error("Bootstrap error:", error);
        alert("Error loading data. Please refresh.");
    } finally {
        hideLoading();
    }
}

// ==========================================
// 3. DATABASE FETCH METHODS
// ==========================================
async function pullGroupMembersList() {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient
            .from('family_members')
            .select('member_name')
            .eq('family_code', currentFamilyCode);
        
        if (data && data.length > 0) {
            assignedFamilyProfiles = [...new Set(data.map(m => m.member_name))];
        } else {
            assignedFamilyProfiles = [currentSelectedProfile];
        }
    } catch (error) {
        console.error("Error pulling members:", error);
        assignedFamilyProfiles = [currentSelectedProfile];
    }
}

async function pullFamilyCabinetInventoryData() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('medicine_cabinet')
            .select('*')
            .eq('family_code', currentFamilyCode)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        inventory = data || [];
    } catch (error) {
        console.error("Error pulling inventory:", error);
        inventory = [];
    }
}

async function pullSharedRemindersData() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('family_reminders')
            .select('*')
            .eq('family_code', currentFamilyCode)
            .order('reminder_time', { ascending: true });
        
        if (error) throw error;
        sharedRemindersList = data || [];
    } catch (error) {
        console.error("Error pulling reminders:", error);
        sharedRemindersList = [];
    }
}

async function pullCabinetActionAuditLogs() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('medicine_usage_logs')
            .select('*')
            .eq('family_code', currentFamilyCode)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        actionAuditTrailLogs = data || [];
    } catch (error) {
        console.error("Error pulling logs:", error);
        actionAuditTrailLogs = [];
    }
}

// ==========================================
// 4. ADD MEDICATION
// ==========================================
function initPrescriptionFileTracker() {
    const fileInput = document.getElementById('med-photo');
    const displaySpan = document.getElementById('photo-selected-indicator');
    
    if (fileInput && displaySpan) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                displaySpan.textContent = `📎 ${this.files[0].name.substring(0, 25)}`;
                displaySpan.style.color = "var(--primary)";
            } else {
                displaySpan.textContent = "No file selected";
                displaySpan.style.color = "var(--text-muted)";
            }
        });
    }

    const form = document.getElementById('add-packet-form');
    if (form) form.addEventListener('submit', handleAddPacketSubmit);
}

async function handleAddPacketSubmit(e) {
    e.preventDefault();
    
    if (!supabaseClient) {
        alert("Database not connected.");
        return;
    }
    
    const submitBtn = document.getElementById('btn-form-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    const symptom = document.getElementById('med-symptom').value.trim();
    const type = document.getElementById('med-type').value;
    const unit = document.getElementById('med-unit').value;
    const qty = parseFloat(document.getElementById('med-qty').value) || 0;
    const min_threshold = parseFloat(document.getElementById('med-min-alert').value) || 0;
    const expiry = document.getElementById('med-expiry').value || null;
    const notes = document.getElementById('med-notes').value.trim();
    const file = document.getElementById('med-photo').files[0];

    if (!symptom) {
        alert("Please enter medicine name");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
    }

    let photo_url = "";
    
    if (file) {
        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `${currentFamilyCode}/${Date.now()}_${safeName}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('prescriptions')
                .upload(path, file);
            
            if (!uploadError) {
                const { data: urlData } = supabaseClient.storage
                    .from('prescriptions')
                    .getPublicUrl(path);
                photo_url = urlData.publicUrl;
            } else {
                console.error("Upload error:", uploadError);
            }
        } catch (err) {
            console.error("File upload error:", err);
        }
    }

    const payload = {
        symptom, type, unit, qty, min_threshold, expiry, notes, photo_url,
        logged_by: currentSelectedProfile,
        family_code: currentFamilyCode
    };

    try {
        const { data, error } = await supabaseClient
            .from('medicine_cabinet')
            .insert([payload])
            .select();
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            inventory.unshift(data[0]);
            
            await supabaseClient.from('medicine_usage_logs').insert([{
                family_code: currentFamilyCode,
                member_name: currentSelectedProfile,
                symptom: symptom,
                action_taken: `added "${symptom}"`
            }]);
        }
        
        // Reset form
        document.getElementById('add-packet-form').reset();
        const fileIndicator = document.getElementById('photo-selected-indicator');
        if (fileIndicator) {
            fileIndicator.textContent = "No file selected";
            fileIndicator.style.color = "var(--text-muted)";
        }
        
        renderAppContent();
        alert(`✅ "${symptom}" added successfully!`);
        
        // Switch to cabinet view
        const cabinetTab = document.querySelector('[data-tab="tab-packets"]');
        if (cabinetTab) cabinetTab.click();
        
    } catch (err) {
        console.error("Save error:", err);
        alert("Error saving: " + (err.message || "Please try again"));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ==========================================
// 5. MEDICATION ACTIONS
// ==========================================
async function handleMedicineAction(action, id) {
    const packet = inventory.find(p => String(p.id) === String(id));
    if (!packet) return;

    if (action === "view") {
        showMedicineDetails(packet);
    } else if (action === "use") {
        if (packet.qty <= 0) {
            alert(`"${packet.symptom}" is out of stock!`);
            return;
        }
        
        const newQty = parseFloat((packet.qty - 1).toFixed(1));
        await updateMedicineQuantity(id, newQty, packet.symptom);
        
    } else if (action === "delete") {
        if (confirm(`Delete "${packet.symptom}" from cabinet?`)) {
            await deleteMedicine(id, packet.symptom);
        }
    }
}

async function updateMedicineQuantity(id, newQty, symptom) {
    if (!supabaseClient) return;
    
    try {
        await supabaseClient.from('medicine_cabinet').update({ qty: newQty }).eq('id', id);
        
        await supabaseClient.from('medicine_usage_logs').insert([{
            family_code: currentFamilyCode,
            member_name: currentSelectedProfile,
            symptom: symptom,
            action_taken: `used 1 dose of "${symptom}"`
        }]);
        
        await pullFamilyCabinetInventoryData();
        renderAppContent();
        
    } catch (err) {
        console.error("Update error:", err);
        alert("Error updating quantity");
    }
}

async function deleteMedicine(id, symptom) {
    if (!supabaseClient) return;
    
    try {
        await supabaseClient.from('medicine_cabinet').delete().eq('id', id);
        
        await supabaseClient.from('medicine_usage_logs').insert([{
            family_code: currentFamilyCode,
            member_name: currentSelectedProfile,
            symptom: symptom,
            action_taken: `deleted "${symptom}"`
        }]);
        
        await pullFamilyCabinetInventoryData();
        renderAppContent();
        
    } catch (err) {
        console.error("Delete error:", err);
        alert("Error deleting item");
    }
}

// ==========================================
// 6. MEDICINE DETAILS MODAL
// ==========================================
let currentEditingItem = null;

function showMedicineDetails(packet) {
    currentEditingItem = packet;
    const viewPane = document.getElementById('edit-modal-view-mode');
    const formPane = document.getElementById('edit-modal-form-mode');
    
    viewPane.classList.remove('hidden');
    formPane.classList.add('hidden');

    const expiryText = packet.expiry ? new Date(packet.expiry).toLocaleDateString() : 'Not set';
    const stockStatus = packet.qty <= packet.min_threshold ? 
        `<span style="color: var(--warning);">⚠️ Low Stock - ${packet.qty} left</span>` : 
        `<span style="color: var(--primary);">${packet.qty} available</span>`;

    viewPane.innerHTML = `
        <div class="readout-row"><strong>💊 Medicine:</strong> ${escapeHtml(packet.symptom)}</div>
        <div class="readout-row"><strong>📦 Type:</strong> ${escapeHtml(packet.type)} (${escapeHtml(packet.unit)})</div>
        <div class="readout-row"><strong>📊 Stock:</strong> ${stockStatus}</div>
        <div class="readout-row"><strong>🔔 Refill at:</strong> ≤ ${packet.min_threshold}</div>
        <div class="readout-row"><strong>📅 Expiry:</strong> ${expiryText}</div>
        <div class="readout-row"><strong>📝 Notes:</strong><p style="margin-top: 5px; padding: 8px; background: #f5f5f5; border-radius: 8px;">${escapeHtml(packet.notes) || 'No notes'}</p></div>
        ${packet.photo_url ? `<div class="readout-row"><strong>🖼️ Prescription:</strong><br><img src="${packet.photo_url}" style="max-width: 100%; border-radius: 8px; margin-top: 5px; cursor: pointer;" onclick="openPhotoModal('${packet.photo_url}')"></div>` : ''}
        <div class="popup-actions" style="margin-top: 20px;">
            <button class="btn-popup-cancel" onclick="closeDetailsModal()">Close</button>
            <button class="btn-popup-confirm" style="background: var(--warning)" onclick="showEditForm()"><i class="fa-solid fa-pen"></i> Edit</button>
        </div>
    `;
    
    document.getElementById('details-edit-modal').classList.remove('hidden');
}

function showEditForm() {
    if (!currentEditingItem) return;
    
    document.getElementById('edit-modal-view-mode').classList.add('hidden');
    const formPane = document.getElementById('edit-modal-form-mode');
    formPane.classList.remove('hidden');

    formPane.innerHTML = `
        <div class="form-group"><label>Medicine Name</label><input type="text" id="edit-symptom" value="${escapeHtml(currentEditingItem.symptom)}"></div>
        <div class="form-row">
            <div class="form-group"><label>Type</label><input type="text" id="edit-type" value="${escapeHtml(currentEditingItem.type)}"></div>
            <div class="form-group"><label>Unit</label><input type="text" id="edit-unit" value="${escapeHtml(currentEditingItem.unit)}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Quantity</label><input type="number" id="edit-qty" step="0.5" value="${currentEditingItem.qty}"></div>
            <div class="form-group"><label>Alert at</label><input type="number" id="edit-min" value="${currentEditingItem.min_threshold}"></div>
        </div>
        <div class="form-group"><label>Expiry Date</label><input type="date" id="edit-expiry" value="${currentEditingItem.expiry || ''}"></div>
        <div class="form-group"><label>Notes</label><textarea id="edit-notes" rows="2">${escapeHtml(currentEditingItem.notes || '')}</textarea></div>
        <div class="popup-actions">
            <button class="btn-popup-cancel" onclick="showMedicineDetails(currentEditingItem)">Cancel</button>
            <button class="btn-popup-confirm" onclick="saveEditedMedicine()">Save Changes</button>
        </div>
    `;
}

async function saveEditedMedicine() {
    if (!currentEditingItem || !supabaseClient) return;

    const updates = {
        symptom: document.getElementById('edit-symptom').value.trim(),
        type: document.getElementById('edit-type').value.trim(),
        unit: document.getElementById('edit-unit').value.trim(),
        qty: parseFloat(document.getElementById('edit-qty').value) || 0,
        min_threshold: parseFloat(document.getElementById('edit-min').value) || 0,
        expiry: document.getElementById('edit-expiry').value || null,
        notes: document.getElementById('edit-notes').value.trim()
    };

    try {
        await supabaseClient.from('medicine_cabinet').update(updates).eq('id', currentEditingItem.id);
        
        await supabaseClient.from('medicine_usage_logs').insert([{
            family_code: currentFamilyCode,
            member_name: currentSelectedProfile,
            symptom: updates.symptom,
            action_taken: `updated "${currentEditingItem.symptom}"`
        }]);
        
        await pullFamilyCabinetInventoryData();
        closeDetailsModal();
        renderAppContent();
        alert("✅ Medicine updated successfully!");
        
    } catch (err) {
        console.error("Save error:", err);
        alert("Error saving changes");
    }
}

function closeDetailsModal() {
    document.getElementById('details-edit-modal').classList.add('hidden');
    currentEditingItem = null;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==========================================
// 7. REMINDERS WITH RECURRING OPTIONS
// ==========================================
async function handleCreateReminderSubmit(e) {
    e.preventDefault();
    
    const symptom = document.getElementById('rem-med-symptom').value.trim();
    const time = document.getElementById('rem-time').value;
    const frequency = document.getElementById('rem-frequency').value;
    
    let weeklyDays = null;
    let monthlyDay = null;
    
    if (frequency === 'weekly') {
        const checkboxes = document.querySelectorAll('#weekly-day-selector input:checked');
        if (checkboxes.length === 0) {
            alert("Please select at least one day for weekly reminder");
            return;
        }
        weeklyDays = Array.from(checkboxes).map(cb => parseInt(cb.value)).join(',');
    }
    
    if (frequency === 'monthly') {
        monthlyDay = parseInt(document.getElementById('rem-monthly-day').value);
        if (!monthlyDay || monthlyDay < 1 || monthlyDay > 31) {
            alert("Please enter a valid day (1-31) for monthly reminder");
            return;
        }
    }

    if (!symptom || !time) {
        alert("Please enter both medicine and time");
        return;
    }

    if (!supabaseClient) return;

    showLoading("Setting reminder...");

    try {
        const { data, error } = await supabaseClient
            .from('family_reminders')
            .insert([{
                family_code: currentFamilyCode,
                creator_name: currentSelectedProfile,
                medicine_symptom: symptom,
                reminder_time: time,
                frequency: frequency,
                weekly_days: weeklyDays,
                monthly_day: monthlyDay
            }])
            .select();
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            sharedRemindersList.push(data[0]);
        }
        
        document.getElementById('add-reminder-form').reset();
        document.getElementById('weekly-day-selector').classList.add('hidden');
        document.getElementById('monthly-date-selector').classList.add('hidden');
        
        renderRemindersTabGrid();
        alert(`✅ Reminder set for ${time} ${frequency === 'daily' ? 'daily' : frequency === 'weekly' ? 'weekly' : 'monthly'}!`);
        
    } catch (err) {
        console.error("Reminder error:", err);
        alert("Error setting reminder");
    } finally {
        hideLoading();
    }
}

// Reminder Scanner with Recurring Support
function startSystemAlarmClockScanner() {
    let lastAlertMinute = -1;
    let lastAlertDate = "";
    
    setInterval(() => {
        const now = new Date();
        const currentMinute = now.getMinutes();
        const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(currentMinute).padStart(2,'0')}`;
        const currentDate = now.toDateString();
        
        // Reset minute check on new day
        if (currentDate !== lastAlertDate) {
            lastAlertMinute = -1;
            lastAlertDate = currentDate;
        }
        
        if (currentMinute === lastAlertMinute) return;
        
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const dayOfMonth = now.getDate();
        
        sharedRemindersList.forEach(reminder => {
            let shouldTrigger = false;
            const reminderTime = reminder.reminder_time.substring(0, 5);
            
            if (reminderTime !== currentTime) return;
            
            // Check frequency
            if (reminder.frequency === 'daily' || !reminder.frequency) {
                shouldTrigger = true;
            } else if (reminder.frequency === 'weekly' && reminder.weekly_days) {
                const days = reminder.weekly_days.split(',').map(Number);
                shouldTrigger = days.includes(dayOfWeek);
            } else if (reminder.frequency === 'monthly' && reminder.monthly_day) {
                shouldTrigger = reminder.monthly_day === dayOfMonth;
            }
            
            if (shouldTrigger) {
                lastAlertMinute = currentMinute;
                const message = `💊 Reminder: Take ${reminder.medicine_symptom} (set by ${reminder.creator_name})`;
                
                // Browser notification
                if (Notification.permission === "granted") {
                    new Notification("Pocket DawaKhana", { body: message });
                }
                
                // In-app banner
                const banner = document.getElementById('live-alert-banner');
                if (banner) {
                    banner.innerHTML = `🔔 ${message}`;
                    banner.classList.remove('hidden');
                    setTimeout(() => banner.classList.add('hidden'), 10000);
                }
                
                // Also show a subtle alert if app is open
                console.log("Reminder triggered:", message);
            }
        });
    }, 10000);
}

async function deleteReminder(id) {
    if (!confirm("Delete this reminder?")) return;
    
    if (!supabaseClient) return;
    
    try {
        await supabaseClient.from('family_reminders').delete().eq('id', id);
        sharedRemindersList = sharedRemindersList.filter(r => r.id !== id);
        renderRemindersTabGrid();
        
    } catch (err) {
        console.error("Delete error:", err);
        alert("Error deleting reminder");
    }
}

// ==========================================
// 8. UI RENDERING
// ==========================================
function renderAppContent() {
    renderHomeTiles();
    renderAllPacketsStock();
    renderRemindersTabGrid();
    renderPrescriptionsVault();
    renderActivityFeedLogs();
    checkLowStockAlerts();
}

function renderHomeTiles() {
    const container = document.getElementById('symptom-chips-container');
    if (!container) return;
    
    container.innerHTML = '';
    defaultSymptoms.forEach(symptom => {
        const tile = document.createElement('div');
        tile.className = 'symptom-tile';
        tile.innerHTML = `<i class="fa-solid fa-pills"></i>${symptom}`;
        tile.onclick = () => {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = symptom;
                handleSearch();
            }
        };
        container.appendChild(tile);
    });
}

function renderAllPacketsStock() {
    const container = document.getElementById('all-packets-list');
    if (!container) return;
    
    const countSpan = document.getElementById('total-packets-count');
    if (countSpan) countSpan.textContent = `${inventory.length} Items`;
    
    buildPacketList(inventory, container);
}

function buildPacketList(items, container) {
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 30px;">📭 No medicines yet. Tap + to add your first medicine!</p>`;
        return;
    }
    
    items.forEach(item => {
        const isLow = item.qty <= item.min_threshold;
        const isExpired = item.expiry && new Date(item.expiry) < new Date();
        let borderClass = '';
        let stockDisplay = `${item.qty} ${item.unit}`;
        
        if (item.qty === 0) {
            borderClass = 'expired-border';
            stockDisplay = '❌ OUT OF STOCK';
        } else if (isExpired) {
            borderClass = 'expired-border';
            stockDisplay += ' (Expired)';
        } else if (isLow) {
            borderClass = 'warning-border';
            stockDisplay += ' ⚠️ Low';
        }
        
        const card = document.createElement('div');
        card.className = `packet-card ${borderClass}`;
        card.innerHTML = `
            <div class="packet-main">
                <div>
                    <div class="packet-symptom">${escapeHtml(item.symptom)}</div>
                    <div class="packet-type">${escapeHtml(item.type)} (${escapeHtml(item.unit)})</div>
                </div>
                <div class="packet-stock">${stockDisplay}</div>
            </div>
            ${item.notes ? `<div class="packet-notes">📝 ${escapeHtml(item.notes.substring(0, 80))}${item.notes.length > 80 ? '...' : ''}</div>` : ''}
            <div class="packet-meta">
                <span><i class="fa-regular fa-user"></i> Added by: ${escapeHtml(item.logged_by)}</span>
                ${item.expiry ? `<span><i class="fa-regular fa-calendar"></i> Exp: ${new Date(item.expiry).toLocaleDateString()}</span>` : ''}
            </div>
            <div class="packet-actions">
                <button class="btn-action btn-preview" onclick="showMedicineDetailsById('${item.id}')"><i class="fa-solid fa-eye"></i> View</button>
                <button class="btn-action btn-use" onclick="handleMedicineAction('use', '${item.id}')" ${item.qty === 0 ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-minus"></i> Use 1</button>
                <button class="btn-action btn-delete" onclick="handleMedicineAction('delete', '${item.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function showMedicineDetailsById(id) {
    const item = inventory.find(i => String(i.id) === String(id));
    if (item) showMedicineDetails(item);
}

function renderRemindersTabGrid() {
    const container = document.getElementById('reminders-vault-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (sharedRemindersList.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">⏰ No active reminders. Create one above!</p>`;
        return;
    }
    
    sharedRemindersList.forEach(reminder => {
        const freqIcon = reminder.frequency === 'daily' ? '🔁' : reminder.frequency === 'weekly' ? '📅' : '📆';
        const freqText = reminder.frequency === 'daily' ? 'Daily' : 
                        reminder.frequency === 'weekly' ? `Weekly` : 
                        `Monthly (Day ${reminder.monthly_day})`;
        
        const card = document.createElement('div');
        card.className = 'packet-card warning-border';
        card.style.borderLeftColor = 'var(--warning)';
        card.innerHTML = `
            <div class="packet-main">
                <div>
                    <div class="packet-symptom">${freqIcon} ${reminder.reminder_time.substring(0, 5)}</div>
                    <div class="packet-type">${escapeHtml(reminder.medicine_symptom)} • ${freqText}</div>
                </div>
            </div>
            <div class="packet-meta">
                <span><i class="fa-regular fa-user"></i> Set by: ${escapeHtml(reminder.creator_name)}</span>
                <button class="btn-action btn-delete" onclick="deleteReminder('${reminder.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderPrescriptionsVault() {
    const container = document.getElementById('prescriptions-vault-list');
    if (!container) return;
    
    container.innerHTML = '';
    const photos = inventory.filter(i => i.photo_url && i.photo_url.length > 0);
    
    if (photos.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: span 2;">📸 No prescription photos uploaded. Add medicine with a photo!</p>`;
        return;
    }
    
    photos.forEach(photo => {
        const card = document.createElement('div');
        card.className = 'prescription-vault-card';
        card.innerHTML = `
            <div class="presc-filename">${escapeHtml(photo.logged_by)} - ${escapeHtml(photo.symptom.substring(0, 20))}</div>
            <button class="btn-vault-view" onclick="openPhotoModal('${photo.photo_url}')">📄 View Prescription</button>
        `;
        container.appendChild(card);
    });
}

function renderActivityFeedLogs() {
    const container = document.getElementById('activity-log-feed-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (actionAuditTrailLogs.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 15px;">📋 No recent activity</p>`;
        return;
    }
    
    actionAuditTrailLogs.forEach(log => {
        const date = new Date(log.created_at);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();
        
        const div = document.createElement('div');
        div.style.cssText = "background: white; padding: 10px 12px; border-radius: 12px; font-size: 0.8rem; box-shadow: var(--card-shadow); border-left: 3px solid var(--primary);";
        div.innerHTML = `<span style="color: var(--text-muted);">[${dateStr} ${timeStr}]</span> <strong>${escapeHtml(log.member_name)}</strong> ${escapeHtml(log.action_taken)}`;
        container.appendChild(div);
    });
}

function checkLowStockAlerts() {
    const banner = document.getElementById('live-alert-banner');
    if (!banner) return;
    
    const lowStockItems = inventory.filter(i => i.qty > 0 && i.qty <= i.min_threshold);
    
    if (lowStockItems.length > 0 && !banner.innerHTML.includes("Reminder")) {
        banner.innerHTML = `⚠️ Low Stock Alert: ${lowStockItems[0].symptom} has only ${lowStockItems[0].qty} left!`;
        banner.classList.remove('hidden');
    }
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const container = document.getElementById('home-packet-list');
    
    if (!container) return;
    
    if (query === "") {
        container.innerHTML = '';
        return;
    }
    
    const filtered = inventory.filter(i => 
        i.symptom.toLowerCase().includes(query) || 
        (i.notes && i.notes.toLowerCase().includes(query))
    );
    
    buildPacketList(filtered, container);
}

function initFormSuggestions() {
    const container = document.getElementById('form-suggestions');
    if (!container) return;
    
    container.innerHTML = '';
    defaultSymptoms.slice(0, 5).forEach(symptom => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = symptom;
        chip.onclick = () => {
            const symptomInput = document.getElementById('med-symptom');
            if (symptomInput) symptomInput.value = symptom;
        };
        container.appendChild(chip);
    });
}

function renderProfileDropdownMenu() {
    const dropdown = document.getElementById('profile-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    assignedFamilyProfiles.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `👤 ${name}`;
        if (name === currentSelectedProfile) option.selected = true;
        dropdown.appendChild(option);
    });
    
    const addOption = document.createElement('option');
    addOption.value = "__ADD_MEMBER__";
    addOption.textContent = "➕ Add Family Member";
    dropdown.appendChild(addOption);
    
    const logoutOption = document.createElement('option');
    logoutOption.value = "__LOGOUT__";
    logoutOption.textContent = "🚪 Leave Group";
    dropdown.appendChild(logoutOption);
}

function handleProfileChange() {
    const dropdown = document.getElementById('profile-dropdown');
    const value = dropdown.value;
    
    if (value === "__ADD_MEMBER__") {
        document.getElementById('add-user-modal').classList.remove('hidden');
        dropdown.value = currentSelectedProfile;
    } else if (value === "__LOGOUT__") {
        if (confirm("Sign out of this group?")) {
            localStorage.clear();
            window.location.reload();
        } else {
            dropdown.value = currentSelectedProfile;
        }
    } else if (value !== currentSelectedProfile) {
        currentSelectedProfile = value;
        localStorage.setItem('dawakhan_member_name', value);
        renderAppContent();
    }
}

async function addNewFamilyMember() {
    const name = document.getElementById('new-user-name-field').value.trim();
    
    if (!name) {
        alert("Please enter a name");
        return;
    }
    
    if (!supabaseClient) return;
    
    try {
        const { error } = await supabaseClient
            .from('family_members')
            .insert([{
                family_code: currentFamilyCode,
                member_name: name
            }]);
        
        if (error) throw error;
        
        assignedFamilyProfiles.push(name);
        renderProfileDropdownMenu();
        
        document.getElementById('add-user-modal').classList.add('hidden');
        document.getElementById('new-user-name-field').value = '';
        
        alert(`✅ ${name} added! They can join using code: ${currentFamilyCode}`);
        
    } catch (err) {
        console.error("Add member error:", err);
        alert("Error adding member. They might already exist.");
    }
}

function startLiveRealtimeListeners() {
    if (!supabaseClient) return;
    
    supabaseClient
        .channel('cabinet-changes')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'medicine_cabinet',
            filter: `family_code=eq.${currentFamilyCode}`
        }, async () => {
            await pullFamilyCabinetInventoryData();
            renderAllPacketsStock();
            renderPrescriptionsVault();
            checkLowStockAlerts();
        })
        .subscribe();
    
    supabaseClient
        .channel('reminder-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'family_reminders',
            filter: `family_code=eq.${currentFamilyCode}`
        }, async () => {
            await pullSharedRemindersData();
            renderRemindersTabGrid();
        })
        .subscribe();
}

function openPhotoModal(url) {
    const img = document.getElementById('modal-target-img');
    const modal = document.getElementById('photo-modal');
    if (img && modal) {
        img.src = url;
        modal.classList.remove('hidden');
    }
}

function closePhotoModalFunc() {
    const modal = document.getElementById('photo-modal');
    if (modal) modal.classList.add('hidden');
}

// Make functions global for onclick handlers
window.showMedicineDetailsById = showMedicineDetailsById;
window.handleMedicineAction = handleMedicineAction;
window.showMedicineDetails = showMedicineDetails;
window.showEditForm = showEditForm;
window.saveEditedMedicine = saveEditedMedicine;
window.closeDetailsModal = closeDetailsModal;
window.deleteReminder = deleteReminder;
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModalFunc;
