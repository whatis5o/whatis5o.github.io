# 🌍 AfriStay — Rwanda Property Rental Platform

**AfriStay** (`afristay.rw`) is a premier property rental platform designed specifically for the Rwandan market. Similar to Airbnb, it connects property owners with guests looking for short-term or long-term stays. 

Built by Josue, Sabin, and Artur under **King Technologies**, AfriStay is the flagship application in the broader **Rwanda App Hub** vision—a unified digital ecosystem targeting Rwanda and the greater East African region.

---

## 🚀 The Vision
Our goal is to digitize and simplify the property rental experience in East Africa. By providing a seamless, secure, and locally optimized platform, we empower property owners to monetize their spaces while giving guests reliable, comfortable places to stay.

## 🛠️ How It Works (Current Flow - v3)
We are currently in the **v3 Testing Phase**. The platform operates in a clean, payment-free testing state so the entire booking lifecycle can be verified end-to-end.

**The Booking Journey:**
1. **Guest Books:** A guest selects dates and submits a booking request.
2. **Owner Review:** The property owner receives an automated email to approve or reject the stay.
3. **Guest Confirmation:** * *Current (Testing):* Once approved, the guest gets a "Confirm Your Stay" email to finalize the booking.
   * *Future (Live):* Once our payment gateway is approved, this step automatically switches to a payment link.
4. **Booking Confirmed:** The stay is locked in, and a receipt is generated.

> **Note on Payments:** We are integrating **DPO PayGate** as our exclusive payment provider. Our system is built so that the moment DPO merchant approval is granted, we simply add a single security key (`DPO_COMPANY_TOKEN`), and the system instantly upgrades to real financial transactions with zero code changes required.

---

## 💼 Business Model
* **Revenue Split:** AfriStay takes a **5% platform fee**, and the property owner keeps **95%**. 
* **Payouts:** All splits are automatically calculated and recorded in our system. Currently, payouts to owners are handled via manual bank transfers once DPO collects the funds.

---

## 💻 Under the Hood (For Developers)

AfriStay is built to be fast, lightweight, and highly scalable.

### Core Tech Stack
* **Frontend:** Vanilla HTML / CSS / JS (Hosted on AOS.rw via cPanel public_html)
* **Backend:** [Supabase](https://supabase.com/) (PostgreSQL + Auth + Edge Functions)
* **Email Processing:** Brevo Transactional API (`bookings@afristay.rw`)
* **Payments:** DPO PayGate (API v6 - XML-based)
* **SMS:** Twilio (Currently on standby)

### Supabase Edge Functions (Deno / TypeScript)
All server-side logic is handled via standalone, serverless Edge Functions. 
* `store-booking`: Handles guest checkout, creates the booking record, and alerts the owner.
* `approve-booking`: Processes owner approval and emails the guest (auto-detects DPO status).
* `reject-booking`: Processes owner rejection and notifies the guest.
* `confirm-booking`: Finalizes the stay and records the 5%/95% payout split in the database.
* `dpo-create-token`: Generates the DPO payment token (active once DPO is live).
* `dpo-webhook`: Listens for DPO IPN callbacks to confirm payments and email receipts.
* `generate-receipt`: Creates PDF/digital receipts for the booking.
* `send-sms`: Standby function for Twilio SMS notifications.

### 📝 Development Guidelines & Coding Style
* **No Partial Snippets:** All codebase updates must be complete, ready-to-use files.
* **Self-Contained Logic:** Edge functions do not use shared imports. Every function is entirely self-contained for maximum reliability and easy debugging.
* **Inline HTML:** Brevo email HTML templates are written directly inline inside their respective Edge Functions.

---

## 📋 Pending Milestones & Roadmap
- [ ] **DPO Merchant Approval:** Pending submission of company registration docs, bank letters, and finalizing Privacy Policy / T&C pages.
- [ ] **Email Verification (Brevo):** Verify the domain to remove the `brevosend.com` subdomain from outbound transactional emails.
- [ ] **Supabase SMTP Setup:** Configure custom SMTP so automated Auth emails (password resets, confirmations) send properly from `bookings@afristay.rw`.
- [ ] **Rwanda App Hub Integration:** Begin laying the groundwork to connect AfriStay to our future unified digital ecosystem.

---
*Built with ❤️ in Rwanda by King Technologies.*