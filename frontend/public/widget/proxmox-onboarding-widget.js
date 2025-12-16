/**
 * Proxmox Multi-Tenant Onboarding Widget
 * Embeddable registration form for external websites
 *
 * Usage:
 * <div id="proxmox-onboarding"></div>
 * <script src="https://your-domain.com/widget/proxmox-onboarding-widget.js"></script>
 * <script>
 *   ProxmoxOnboarding.init({
 *     apiToken: 'pmt_live_xxxxxxxxxx',
 *     apiUrl: 'https://your-api.com/api/public/onboarding',
 *     containerId: 'proxmox-onboarding',
 *     theme: {
 *       primaryColor: '#0066cc',
 *       fontFamily: 'Arial, sans-serif'
 *     },
 *     onSuccess: function(data) {
 *       console.log('Registration successful:', data);
 *     },
 *     onError: function(error) {
 *       console.error('Registration failed:', error);
 *     }
 *   });
 * </script>
 */

(function(window) {
  'use strict';

  const ProxmoxOnboarding = {
    config: {},
    currentStep: 1,
    registrationData: {},

    /**
     * Initialize the widget
     */
    init: function(options) {
      this.config = {
        apiToken: options.apiToken,
        apiUrl: options.apiUrl || 'https://api.example.com/api/public/onboarding',
        containerId: options.containerId || 'proxmox-onboarding',
        theme: options.theme || {},
        onSuccess: options.onSuccess || function() {},
        onError: options.onError || function() {},
        showPlans: options.showPlans !== false, // Default true
        autoVerify: options.autoVerify || false,
        utm: options.utm || {} // UTM tracking params
      };

      // Apply theme
      this.applyTheme();

      // Render form
      this.renderForm();
    },

    /**
     * Apply custom theme
     */
    applyTheme: function() {
      const theme = this.config.theme;
      const style = document.createElement('style');
      style.textContent = `
        .pm-widget {
          font-family: ${theme.fontFamily || 'Arial, sans-serif'};
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
        }
        .pm-widget h2 {
          color: ${theme.primaryColor || '#0066cc'};
          margin-bottom: 20px;
          font-size: 24px;
        }
        .pm-widget .pm-form-group {
          margin-bottom: 16px;
        }
        .pm-widget label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }
        .pm-widget input,
        .pm-widget select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .pm-widget input:focus,
        .pm-widget select:focus {
          outline: none;
          border-color: ${theme.primaryColor || '#0066cc'};
        }
        .pm-widget .pm-btn {
          background: ${theme.primaryColor || '#0066cc'};
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
        }
        .pm-widget .pm-btn:hover {
          opacity: 0.9;
        }
        .pm-widget .pm-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .pm-widget .pm-error {
          color: #d32f2f;
          margin-top: 8px;
          font-size: 14px;
        }
        .pm-widget .pm-success {
          color: #2e7d32;
          margin-top: 8px;
          font-size: 14px;
        }
        .pm-widget .pm-loading {
          text-align: center;
          padding: 20px;
        }
        .pm-widget .pm-spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid ${theme.primaryColor || '#0066cc'};
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: pm-spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes pm-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .pm-widget .pm-plan-card {
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pm-widget .pm-plan-card:hover {
          border-color: ${theme.primaryColor || '#0066cc'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .pm-widget .pm-plan-card.selected {
          border-color: ${theme.primaryColor || '#0066cc'};
          background: #f0f8ff;
        }
        .pm-widget .pm-plan-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .pm-widget .pm-plan-price {
          font-size: 24px;
          color: ${theme.primaryColor || '#0066cc'};
          margin-bottom: 8px;
        }
        .pm-widget .pm-plan-features {
          list-style: none;
          padding: 0;
          margin: 12px 0;
        }
        .pm-widget .pm-plan-features li {
          padding: 4px 0;
          font-size: 14px;
        }
        .pm-widget .pm-plan-features li:before {
          content: '✓ ';
          color: #2e7d32;
          font-weight: bold;
        }
        .pm-widget .pm-step-indicator {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .pm-widget .pm-step {
          flex: 1;
          text-align: center;
          padding: 10px;
          background: #f5f5f5;
          margin: 0 4px;
          border-radius: 4px;
          font-size: 14px;
        }
        .pm-widget .pm-step.active {
          background: ${theme.primaryColor || '#0066cc'};
          color: white;
        }
        .pm-widget .pm-step.completed {
          background: #2e7d32;
          color: white;
        }
      `;
      document.head.appendChild(style);
    },

    /**
     * Render the registration form
     */
    renderForm: function() {
      const container = document.getElementById(this.config.containerId);
      if (!container) {
        console.error('Container not found:', this.config.containerId);
        return;
      }

      container.innerHTML = `
        <div class="pm-widget">
          <h2>Register Your Account</h2>
          <div id="pm-step-indicator"></div>
          <div id="pm-form-content"></div>
        </div>
      `;

      this.renderStep(1);
    },

    /**
     * Render specific step
     */
    renderStep: function(step) {
      this.currentStep = step;

      // Update step indicator
      const indicator = document.getElementById('pm-step-indicator');
      indicator.innerHTML = `
        <div class="pm-step-indicator">
          <div class="pm-step ${step >= 1 ? (step === 1 ? 'active' : 'completed') : ''}">1. Details</div>
          <div class="pm-step ${step >= 2 ? (step === 2 ? 'active' : 'completed') : ''}">2. Verify Email</div>
          ${this.config.showPlans ? `<div class="pm-step ${step >= 3 ? (step === 3 ? 'active' : 'completed') : ''}">3. Select Plan</div>` : ''}
          <div class="pm-step ${step >= 4 ? 'active' : ''}">4. Complete</div>
        </div>
      `;

      // Render step content
      const content = document.getElementById('pm-form-content');

      switch(step) {
        case 1:
          content.innerHTML = this.getStep1HTML();
          document.getElementById('pm-registration-form').addEventListener('submit', this.handleSubmit.bind(this));
          break;
        case 2:
          content.innerHTML = this.getStep2HTML();
          break;
        case 3:
          content.innerHTML = this.getStep3HTML();
          this.loadPlans();
          break;
        case 4:
          content.innerHTML = this.getStep4HTML();
          break;
      }
    },

    /**
     * Step 1: Registration Form HTML
     */
    getStep1HTML: function() {
      return `
        <form id="pm-registration-form">
          <div class="pm-form-group">
            <label for="company_name">Company Name *</label>
            <input type="text" id="company_name" required>
          </div>
          <div class="pm-form-group">
            <label for="contact_email">Email Address *</label>
            <input type="email" id="contact_email" required>
          </div>
          <div class="pm-form-group">
            <label for="contact_name">Contact Name</label>
            <input type="text" id="contact_name">
          </div>
          <div class="pm-form-group">
            <label for="contact_phone">Phone Number</label>
            <input type="tel" id="contact_phone">
          </div>
          <div class="pm-form-group">
            <label for="company_size">Company Size</label>
            <select id="company_size">
              <option value="">Select...</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>
          <div class="pm-form-group">
            <label for="country">Country</label>
            <input type="text" id="country">
          </div>
          <button type="submit" class="pm-btn" id="pm-submit-btn">Register</button>
          <div id="pm-error" class="pm-error" style="display:none;"></div>
        </form>
      `;
    },

    /**
     * Step 2: Email Verification HTML
     */
    getStep2HTML: function() {
      return `
        <div style="text-align: center; padding: 40px 20px;">
          <h3>Check Your Email</h3>
          <p>We've sent a verification link to <strong>${this.registrationData.contact_email}</strong></p>
          <p>Please click the link in the email to continue.</p>
          <p style="margin-top: 30px;">
            <button class="pm-btn" onclick="ProxmoxOnboarding.resendVerification()">
              Resend Verification Email
            </button>
          </p>
          <div id="pm-error" class="pm-error" style="display:none;"></div>
          <div id="pm-success" class="pm-success" style="display:none;"></div>
        </div>
      `;
    },

    /**
     * Step 3: Plan Selection HTML
     */
    getStep3HTML: function() {
      return `
        <div id="pm-plans-container">
          <div class="pm-loading">
            <div class="pm-spinner"></div>
            <p>Loading plans...</p>
          </div>
        </div>
      `;
    },

    /**
     * Step 4: Completion HTML
     */
    getStep4HTML: function() {
      return `
        <div style="text-align: center; padding: 40px 20px;">
          <h3 style="color: #2e7d32;">✓ Registration Complete!</h3>
          <p>Thank you for registering. We'll review your application and get back to you shortly.</p>
          <p>Your tracking code: <strong>${this.registrationData.tracking_code}</strong></p>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            You will receive an email once your account is approved.
          </p>
        </div>
      `;
    },

    /**
     * Handle form submission
     */
    handleSubmit: function(e) {
      e.preventDefault();

      const formData = {
        company_name: document.getElementById('company_name').value,
        contact_email: document.getElementById('contact_email').value,
        contact_name: document.getElementById('contact_name').value || null,
        contact_phone: document.getElementById('contact_phone').value || null,
        company_size: document.getElementById('company_size').value || null,
        country: document.getElementById('country').value || null,
        ...this.config.utm
      };

      this.showLoading();
      this.apiRequest('/register', 'POST', formData)
        .then(response => {
          this.registrationData = response.data;
          this.hideLoading();

          if (this.config.showPlans) {
            this.renderStep(3); // Go to plan selection
          } else {
            this.renderStep(2); // Go to email verification
          }

          if (this.config.onSuccess) {
            this.config.onSuccess(response.data);
          }
        })
        .catch(error => {
          this.hideLoading();
          this.showError(error.message || 'Registration failed');
        });
    },

    /**
     * Load subscription plans
     */
    loadPlans: function() {
      this.apiRequest('/plans', 'GET')
        .then(response => {
          const plans = response.data;
          const container = document.getElementById('pm-plans-container');

          let html = '<h3 style="margin-bottom: 20px;">Choose Your Plan</h3>';

          plans.forEach(plan => {
            const features = JSON.parse(plan.features || '[]');
            html += `
              <div class="pm-plan-card" data-plan-id="${plan.id}" onclick="ProxmoxOnboarding.selectPlan(${plan.id})">
                <div class="pm-plan-name">${plan.name}</div>
                <div class="pm-plan-price">
                  $${plan.price} / ${plan.billing_period}
                </div>
                <p>${plan.description || ''}</p>
                <ul class="pm-plan-features">
                  ${features.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            `;
          });

          container.innerHTML = html;
        })
        .catch(error => {
          document.getElementById('pm-plans-container').innerHTML = `
            <div class="pm-error">Failed to load plans: ${error.message}</div>
          `;
        });
    },

    /**
     * Select a plan
     */
    selectPlan: function(planId) {
      // Highlight selected plan
      document.querySelectorAll('.pm-plan-card').forEach(card => {
        card.classList.remove('selected');
      });
      document.querySelector(`[data-plan-id="${planId}"]`).classList.add('selected');

      this.showLoading();
      this.apiRequest(`/${this.registrationData.tracking_code}/select-plan`, 'POST', { plan_id: planId })
        .then(() => {
          this.hideLoading();
          this.renderStep(2); // Go to email verification
        })
        .catch(error => {
          this.hideLoading();
          this.showError(error.message || 'Plan selection failed');
        });
    },

    /**
     * Resend verification email
     */
    resendVerification: function() {
      this.showLoading();
      this.apiRequest(`/${this.registrationData.tracking_code}/resend-verification`, 'POST', {})
        .then(() => {
          this.hideLoading();
          document.getElementById('pm-success').textContent = 'Verification email sent!';
          document.getElementById('pm-success').style.display = 'block';
          setTimeout(() => {
            document.getElementById('pm-success').style.display = 'none';
          }, 5000);
        })
        .catch(error => {
          this.hideLoading();
          this.showError(error.message || 'Failed to resend email');
        });
    },

    /**
     * Make API request
     */
    apiRequest: function(endpoint, method, data) {
      const url = this.config.apiUrl + endpoint;
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': this.config.apiToken
        }
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      return fetch(url, options)
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.message || 'Request failed');
            });
          }
          return response.json();
        })
        .then(data => {
          if (!data.success) {
            throw new Error(data.message || 'Request failed');
          }
          return data;
        });
    },

    /**
     * Show loading state
     */
    showLoading: function() {
      const btn = document.getElementById('pm-submit-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Please wait...';
      }
    },

    /**
     * Hide loading state
     */
    hideLoading: function() {
      const btn = document.getElementById('pm-submit-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Register';
      }
    },

    /**
     * Show error message
     */
    showError: function(message) {
      const errorDiv = document.getElementById('pm-error');
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
          errorDiv.style.display = 'none';
        }, 5000);
      }

      if (this.config.onError) {
        this.config.onError(message);
      }
    }
  };

  // Expose to global scope
  window.ProxmoxOnboarding = ProxmoxOnboarding;

})(window);
