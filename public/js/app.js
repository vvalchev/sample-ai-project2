/**
 * Frontend Application
 * Real-time event feed client with WebSocket integration
 */

class EventFeedApp {
    constructor() {
        // DOM elements
        this.tenantSelect = document.getElementById('tenant-select');
        this.connectionStatus = document.getElementById('connection-status');
        this.eventForm = document.getElementById('event-form');
        this.messageInput = document.getElementById('message-input');
        this.submitBtn = document.getElementById('submit-btn');
        this.charCount = document.getElementById('char-count');
        this.formFeedback = document.getElementById('form-feedback');
        this.eventsContainer = document.getElementById('events-container');
        this.eventCount = document.getElementById('event-count');
        this.lastUpdate = document.getElementById('last-update');

        // Application state
        this.currentTenant = null;
        this.socket = null;
        this.events = [];
        this.isConnected = false;

        // Initialize application
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.bindEvents();
        this.updateUI();
        console.log('[APP] Event Feed application initialized');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Tenant selection
        this.tenantSelect.addEventListener('change', (e) => {
            this.switchTenant(e.target.value);
        });

        // Form submission
        this.eventForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitEvent();
        });

        // Character counter
        this.messageInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Keyboard shortcuts
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.submitEvent();
            }
        });
    }

    /**
     * Switch to a different tenant
     * @param {string} tenantId - The tenant identifier
     */
    switchTenant(tenantId) {
        if (tenantId === this.currentTenant) {
            return;
        }

        // Disconnect current socket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.currentTenant = tenantId;
        this.events = [];
        this.isConnected = false;

        if (tenantId) {
            this.connectWebSocket(tenantId);
        }

        this.updateUI();
        this.clearForm();
    }

    /**
     * Connect to WebSocket server
     * @param {string} tenantId - The tenant identifier
     */
    connectWebSocket(tenantId) {
        this.updateConnectionStatus('connecting');

        try {
            // Connect with tenant query parameter
            this.socket = io({
                query: { tenant: tenantId },
                transports: ['websocket', 'polling'],
                timeout: 5000,
                forceNew: true
            });

            // Connection established
            this.socket.on('connect', () => {
                console.log(`[WEBSOCKET] Connected to tenant: ${tenantId}`);
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.updateUI();
                this.showFeedback('Connected to event stream', 'success');
            });

            // Connection confirmation from server
            this.socket.on('connection_established', (data) => {
                console.log('[WEBSOCKET] Connection confirmed:', data);
                this.updateLastActivity('Connected');
            });

            // Initial events from server
            this.socket.on('initial_events', (data) => {
                console.log('[WEBSOCKET] Received initial events:', data.count);
                this.events = data.events || [];
                this.renderEvents();
                this.updateEventCount();
            });

            // New event received
            this.socket.on('event_created', (data) => {
                console.log('[WEBSOCKET] New event received:', data.event.id);
                this.addNewEvent(data.event);
                this.updateLastActivity('New event received');
            });

            // System messages
            this.socket.on('system_message', (data) => {
                console.log('[WEBSOCKET] System message:', data.message);
                this.showFeedback(data.message, 'warning');
            });

            // Connection error
            this.socket.on('connect_error', (error) => {
                console.error('[WEBSOCKET] Connection error:', error.message);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.showFeedback(`Connection failed: ${error.message}`, 'error');
            });

            // Disconnection
            this.socket.on('disconnect', (reason) => {
                console.log('[WEBSOCKET] Disconnected:', reason);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.updateUI();

                if (reason === 'io server disconnect') {
                    this.showFeedback('Disconnected by server', 'warning');
                } else {
                    this.showFeedback('Connection lost. Attempting to reconnect...', 'warning');
                }
            });

            // Reconnection
            this.socket.on('reconnect', () => {
                console.log('[WEBSOCKET] Reconnected');
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.showFeedback('Reconnected to event stream', 'success');
            });

        } catch (error) {
            console.error('[WEBSOCKET] Failed to connect:', error);
            this.showFeedback('Failed to establish connection', 'error');
            this.updateConnectionStatus('disconnected');
        }
    }

    /**
     * Submit a new event
     */
    async submitEvent() {
        const message = this.messageInput.value.trim();

        if (!message) {
            this.showFeedback('Please enter a message', 'error');
            return;
        }

        if (!this.currentTenant) {
            this.showFeedback('Please select a tenant', 'error');
            return;
        }

        if (!this.isConnected) {
            this.showFeedback('Not connected to server', 'error');
            return;
        }

        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '<span class="loading-spinner"></span> Posting...';

        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-ID': this.currentTenant
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (response.ok) {
                this.showFeedback('Event posted successfully', 'success');
                this.clearForm();
            } else {
                throw new Error(data.error || 'Failed to post event');
            }

        } catch (error) {
            console.error('[API] Failed to post event:', error);
            this.showFeedback(`Failed to post event: ${error.message}`, 'error');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = 'Post Event';
        }
    }

    /**
     * Add a new event to the display
     * @param {Object} event - The event object
     */
    addNewEvent(event) {
        // Add to beginning of events array
        this.events.unshift(event);
        
        // Limit number of displayed events for performance
        const MAX_DISPLAYED_EVENTS = 100;
        if (this.events.length > MAX_DISPLAYED_EVENTS) {
            this.events = this.events.slice(0, MAX_DISPLAYED_EVENTS);
        }

        this.renderEvents();
        this.updateEventCount();

        // Highlight new event
        setTimeout(() => {
            const eventElement = this.eventsContainer.querySelector('.event-item');
            if (eventElement) {
                eventElement.classList.add('new-event');
                setTimeout(() => {
                    eventElement.classList.remove('new-event');
                }, 2000);
            }
        }, 100);
    }

    /**
     * Render all events in the container
     */
    renderEvents() {
        if (!this.currentTenant) {
            this.eventsContainer.innerHTML = '<div class="no-tenant-message">Please select a tenant to view events</div>';
            return;
        }

        if (this.events.length === 0) {
            this.eventsContainer.innerHTML = '<div class="no-events-message">No events yet. Post the first event!</div>';
            return;
        }

        const eventsHTML = this.events.map(event => this.createEventHTML(event)).join('');
        this.eventsContainer.innerHTML = eventsHTML;
    }

    /**
     * Create HTML for a single event
     * @param {Object} event - The event object
     * @returns {string} - HTML string
     */
    createEventHTML(event) {
        const timestamp = new Date(event.timestamp).toLocaleString();
        const shortId = event.id.substring(0, 8);

        return `
            <div class="event-item" data-event-id="${event.id}">
                <div class="event-header">
                    <span class="event-id">${shortId}</span>
                    <span class="event-tenant">${event.tenant_id}</span>
                    <span class="event-timestamp">${timestamp}</span>
                </div>
                <div class="event-message">${this.escapeHtml(event.message)}</div>
            </div>
        `;
    }

    /**
     * Update character count display
     */
    updateCharacterCount() {
        const length = this.messageInput.value.length;
        const maxLength = 500;
        
        this.charCount.textContent = length;
        
        // Update styling based on character count
        const countElement = this.charCount.parentElement;
        countElement.className = 'character-count';
        
        if (length > maxLength * 0.9) {
            countElement.classList.add('danger');
        } else if (length > maxLength * 0.8) {
            countElement.classList.add('warning');
        }
    }

    /**
     * Auto-resize textarea based on content
     */
    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
    }

    /**
     * Update connection status indicator
     * @param {string} status - The connection status
     */
    updateConnectionStatus(status) {
        this.connectionStatus.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connected':
                this.connectionStatus.textContent = 'Connected';
                break;
            case 'connecting':
                this.connectionStatus.textContent = 'Connecting...';
                break;
            case 'disconnected':
                this.connectionStatus.textContent = 'Disconnected';
                break;
        }
    }

    /**
     * Update event count display
     */
    updateEventCount() {
        const count = this.events.length;
        this.eventCount.textContent = `${count} event${count !== 1 ? 's' : ''}`;
    }

    /**
     * Update last activity timestamp
     * @param {string} activity - The activity description
     */
    updateLastActivity(activity) {
        const timestamp = new Date().toLocaleTimeString();
        this.lastUpdate.textContent = `${activity} at ${timestamp}`;
    }

    /**
     * Show feedback message
     * @param {string} message - The message to show
     * @param {string} type - The message type (success, error, warning)
     */
    showFeedback(message, type) {
        this.formFeedback.textContent = message;
        this.formFeedback.className = `feedback ${type}`;
        this.formFeedback.style.display = 'block';

        // Auto-hide after 5 seconds for success/warning messages
        if (type !== 'error') {
            setTimeout(() => {
                this.formFeedback.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Clear the form
     */
    clearForm() {
        this.messageInput.value = '';
        this.updateCharacterCount();
        this.autoResizeTextarea();
        this.formFeedback.style.display = 'none';
    }

    /**
     * Update UI based on current state
     */
    updateUI() {
        const hasSelectedTenant = !!this.currentTenant;
        
        this.messageInput.disabled = !hasSelectedTenant || !this.isConnected;
        this.submitBtn.disabled = !hasSelectedTenant || !this.isConnected;
        
        this.renderEvents();
        this.updateEventCount();
    }

    /**
     * Escape HTML characters to prevent XSS
     * @param {string} text - The text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EventFeedApp();
});
