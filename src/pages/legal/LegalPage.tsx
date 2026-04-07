import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

type LegalPageType = 'privacy-policy' | 'terms' | 'refund-policy' | 'about'

const PAGES: Record<LegalPageType, { title: string; content: React.ReactNode }> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <p className="text-slate-400 text-xs">Last updated: April 2025</p>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">1. Introduction</h2>
          <p>Welcome to Getmypro ('we', 'our', or 'us'). We are an online marketplace connecting customers with home service professionals in Andhra Pradesh and across India. This Privacy Policy explains how we collect, use, disclose and protect your personal information when you use our mobile application (the 'Platform').</p>
          <p className="mt-2">By using the Platform, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use our Platform.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">2. Information We Collect</h2>
          <p className="mb-2">We collect the following types of information:</p>

          <p className="text-slate-200 font-semibold mb-1">2.1 Information You Provide:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Name, phone number and email address when you register</li>
            <li>Address and location details when you book a service</li>
            <li>Payment information (processed securely by our payment partner — we do not store card or UPI details)</li>
            <li>Aadhaar number and image for worker identity verification (workers only)</li>
            <li>Profile photos and job completion photos</li>
            <li>Messages and communications through our platform</li>
          </ul>

          <p className="text-slate-200 font-semibold mt-3 mb-1">2.2 Information Collected Automatically:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Device information (model, operating system, app version)</li>
            <li>Location data (GPS coordinates — only when you allow it and only when a job is active)</li>
            <li>Usage data (pages visited, features used, time spent)</li>
            <li>IP address and browser type</li>
          </ul>

          <p className="text-slate-200 font-semibold mt-3 mb-1">2.3 Information from Third Parties:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Payment status from our payment processing partner</li>
            <li>SMS OTP verification data from our OTP provider</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">3. How We Use Your Information</h2>
          <p className="mb-2">We use your information to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Create and manage your account</li>
            <li>Connect you with suitable home service professionals</li>
            <li>Process bookings and payments</li>
            <li>Send OTP for account verification and job completion</li>
            <li>Show your location to assigned workers during active jobs (with your consent)</li>
            <li>Send notifications about your bookings via SMS or WhatsApp</li>
            <li>Resolve disputes and provide customer support</li>
            <li>Improve our platform and develop new features</li>
            <li>Comply with legal obligations under Indian law</li>
            <li>Prevent fraud and ensure platform security</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">4. How We Share Your Information</h2>
          <p className="mb-3"><span className="text-slate-200 font-semibold">4.1 Service Professionals:</span> When you book a service, your name, phone number, and address are shared with the assigned professional so they can complete your job.</p>
          <p className="mb-3"><span className="text-slate-200 font-semibold">4.2 Payment Partners:</span> Payment data is processed by our RBI-licensed payment processing partner. We do not store your card or bank details.</p>
          <p className="mb-3"><span className="text-slate-200 font-semibold">4.3 SMS/OTP Providers:</span> Your phone number is shared with our OTP service provider solely to send verification messages.</p>
          <p className="mb-3"><span className="text-slate-200 font-semibold">4.4 Legal Authorities:</span> We may disclose information when required by law, court order, or government authority.</p>
          <p>We do not sell, rent or trade your personal information to any third party for marketing purposes.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">5. Data Security</h2>
          <p className="mb-2">We take data security seriously. We implement appropriate technical and organizational measures including:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>All data transmitted over HTTPS (TLS encryption)</li>
            <li>Secure database with Row Level Security</li>
            <li>Aadhaar images stored in private, access-controlled storage</li>
            <li>OTP-based authentication — no passwords stored</li>
            <li>Payment data handled exclusively by PCI-DSS certified infrastructure</li>
          </ul>
          <p className="mt-2">However, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your data.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">6. Data Retention</h2>
          <p className="mb-2">We retain your personal information for as long as your account is active or as needed to provide services. Specifically:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Account data: Retained until you delete your account</li>
            <li>Order history: Retained for 3 years for legal and tax compliance</li>
            <li>Aadhaar documents (workers): Retained for the duration of active worker status, deleted within 30 days of account closure</li>
            <li>Payment records: Retained for 5 years as required by Indian financial regulations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">7. Your Rights</h2>
          <p className="mb-2">Under applicable Indian law, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate or incomplete information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for location tracking at any time</li>
            <li>Receive a copy of your data in a portable format</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us at getmypro.care@gmail.com. We will respond within 30 days.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">8. Cookies</h2>
          <p className="mb-2">Our website uses cookies and similar technologies to improve your experience. We use:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Essential cookies: Required for the website to function</li>
            <li>Analytics cookies: To understand how visitors use our site (anonymised)</li>
          </ul>
          <p className="mt-2">You can control cookies through your browser settings. Disabling essential cookies may affect website functionality.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">9. Children's Privacy</h2>
          <p>Our Platform is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, please contact us immediately and we will delete it.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date, and where appropriate, by sending you an SMS or WhatsApp notification.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">11. Contact Us</h2>
          <p>If you have any questions or concerns about this Privacy Policy, please contact us:</p>
          <div className="mt-2 bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-slate-200 font-semibold">Getmypro</p>
            <p>Srirama Nagar Colony, Korada Street, Bobbili, Vizianagaram, Andhra Pradesh — 535558</p>
            <p>Email: getmypro.care@gmail.com</p>
            <p>Phone: +91 89856 14758</p>
          </div>
        </section>
      </div>
    ),
  },

  'terms': {
    title: 'Terms & Conditions',
    content: (
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <p className="text-slate-400 text-xs">Last updated: April 2025</p>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using the Getmypro platform (website or mobile app), you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not use our platform.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">2. Platform Description</h2>
          <p>Getmypro is an online marketplace that connects customers seeking home services with independent skilled professionals ('Pros') across India. Getmypro is not a service provider itself — we are a technology platform that facilitates the connection, booking, and payment between customers and independent professionals.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">3. User Accounts</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for maintaining the confidentiality of your OTP and account</li>
            <li>You must notify us immediately if you suspect unauthorised access to your account</li>
            <li>You must be at least 18 years old to use this platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">4. Booking and Payment</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>All bookings are subject to availability of professionals</li>
            <li>A booking fee is required to confirm a booking — this fee is subject to our Refund Policy</li>
            <li>The final service charge is agreed upon after the professional's on-site inspection</li>
            <li>Payment for services must be made through the platform via our secure payment gateway</li>
            <li>Off-platform cash payments are discouraged and not covered by our dispute resolution process</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">5. Professional Conduct</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Getmypro verifies professionals' identity via Aadhaar</li>
            <li>However, Getmypro does not guarantee the quality of work performed by independent professionals</li>
            <li>Customer ratings and reviews are used to maintain platform quality standards</li>
            <li>Professionals found to be fraudulent or conducting themselves inappropriately will be removed from the platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">6. Prohibited Activities</h2>
          <p className="mb-2">You may not:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use the platform for any unlawful purpose</li>
            <li>Attempt to contact professionals outside the platform to avoid fees</li>
            <li>Submit false bookings or fake reviews</li>
            <li>Use automated tools to access the platform</li>
            <li>Attempt to reverse-engineer or tamper with the platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">7. Limitation of Liability</h2>
          <p className="mb-2">Getmypro is not liable for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>The quality of work performed by independent professionals</li>
            <li>Damage caused by professionals beyond what is covered by our dispute resolution</li>
            <li>Indirect, incidental or consequential damages</li>
            <li>Service disruptions due to internet connectivity, payment gateway issues, or force majeure events</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">8. Governing Law</h2>
          <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Vizianagaram District, Andhra Pradesh.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">9. Contact</h2>
          <div className="bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-slate-200 font-semibold">Getmypro</p>
            <p>Srirama Nagar Colony, Korada Street, Bobbili, Vizianagaram, Andhra Pradesh — 535558</p>
            <p>Email: getmypro.care@gmail.com</p>
            <p>Phone: +91 89856 14758</p>
          </div>
        </section>
      </div>
    ),
  },

  'refund-policy': {
    title: 'Refund & Cancellation Policy',
    content: (
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <p className="text-slate-400 text-xs">Last updated: April 2025</p>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">1. Overview</h2>
          <p>This Refund and Cancellation Policy governs all payments made on the Getmypro platform. By making a payment on our platform, you agree to the terms of this policy. Please read it carefully before booking a service.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">2. Booking Fee</h2>
          <p className="mb-2">When you book a service on Getmypro, you pay a non-refundable booking fee (plus applicable payment gateway charges). This booking fee:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Secures your service slot</li>
            <li>Covers the cost of sending a verified professional to your location for inspection</li>
            <li>Is charged regardless of whether you proceed with the work after receiving the quote</li>
          </ul>
          <p className="mt-2">The booking fee is collected to prevent spam bookings and compensate professionals for their time and travel to your location.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">3. Booking Fee Refund Eligibility</h2>
          <p className="mb-3">The booking fee is refundable ONLY in the following situations:</p>

          <p className="text-green-400 font-semibold mb-1">✅ Full Refund Situations:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mb-4">
            <li>Getmypro is unable to assign a verified professional to your booking within 24 hours</li>
            <li>The assigned professional fails to visit your location within the agreed timeframe without prior notice</li>
            <li>A technical error results in a duplicate payment being charged</li>
            <li>The service you booked is unavailable in your specific area</li>
          </ul>

          <p className="text-red-400 font-semibold mb-1">❌ Non-Refundable Situations:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>You cancel the booking after a professional has been assigned</li>
            <li>You are unavailable when the professional arrives at the agreed time</li>
            <li>You decide not to proceed with work after receiving the quote</li>
            <li>The booking fee has already been used to dispatch a professional to your location</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">4. Work Payment (Service Charges)</h2>
          <p className="mb-2">The work payment is the amount you pay after reviewing and approving the professional's quote for labour and materials. This payment:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
            <li>Is only charged after you explicitly approve the quoted price</li>
            <li>Covers the professional's labour charges and materials used</li>
          </ul>
          <p className="text-slate-200 font-semibold mb-1">Refund on Work Payment:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>If the work is not completed as described in the quote, you may raise a dispute within 24 hours of job completion</li>
            <li>If a dispute is verified by our team, we will offer a re-do of the work by another professional or a partial/full refund</li>
            <li>If you raise a dispute after 48 hours of job completion, no refund will be provided</li>
            <li>Work payments are not refundable if the job has been completed and verified via OTP</li>
          </ul>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">5. Cancellation Policy</h2>
          <p className="text-slate-200 font-semibold mb-2">Cancellation by Customer:</p>
          <div className="space-y-2 mb-4">
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-200 font-semibold text-xs mb-1">Before professional is assigned</p>
              <p>Full booking fee refund within 5–7 working days</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-200 font-semibold text-xs mb-1">After professional is assigned but before visit</p>
              <p>Booking fee is non-refundable</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-200 font-semibold text-xs mb-1">After professional has visited and quote is sent</p>
              <p>Booking fee is non-refundable. Work payment (if any) is fully refunded.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-slate-200 font-semibold text-xs mb-1">After work payment is made and work has started</p>
              <p>No refund. Raise a dispute if work quality is unsatisfactory.</p>
            </div>
          </div>
          <p className="text-slate-200 font-semibold mb-1">Cancellation by Getmypro:</p>
          <p>If we cancel a confirmed booking due to professional unavailability, 100% of all payments made will be refunded within 5–7 working days.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">6. How to Request a Refund</h2>
          <p className="mb-2">To request a refund, contact us within the eligible timeframe through any of these channels:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2 mb-3">
            <li>WhatsApp: Send your Order ID and reason to +91 89856 14758</li>
            <li>Email: Send your Order ID and reason to getmypro.care@gmail.com</li>
            <li>In-App: Tap 'Raise a Dispute' on your order page</li>
          </ol>
          <p className="mb-2">Please include:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your registered mobile number</li>
            <li>Order ID (starts with ORD-)</li>
            <li>Reason for refund request</li>
            <li>Any supporting photos or evidence</li>
          </ul>
          <p className="mt-2">We will acknowledge your request within 24 hours and resolve it within 5 working days.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">7. Refund Processing Time</h2>
          <div className="bg-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span>UPI payments</span>
              <span className="text-green-400 font-semibold">2–3 working days</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span>Debit / Credit Card</span>
              <span className="text-green-400 font-semibold">5–7 working days</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span>Net Banking</span>
              <span className="text-green-400 font-semibold">3–5 working days</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span>Wallet payments</span>
              <span className="text-green-400 font-semibold">1–2 working days</span>
            </div>
          </div>
          <p className="mt-2">Refunds are credited back to the original payment source only. We cannot process refunds to a different account than the one used for payment.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">8. Dispute Resolution</h2>
          <p className="mb-2">If you are unhappy with a completed job:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Raise a dispute within 24 hours via WhatsApp or email</li>
            <li>Our team will contact both you and the professional within 48 hours</li>
            <li>If the complaint is valid, we will arrange a free re-service or issue a partial refund</li>
            <li>If the dispute cannot be resolved amicably, it shall be subject to arbitration under the Arbitration and Conciliation Act, 1996, with jurisdiction in Vizianagaram District, Andhra Pradesh</li>
          </ol>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">9. Payment Gateway Charges</h2>
          <p>Payment gateway charges (approximately 2–3% of the transaction value) collected by our payment processing partner are non-refundable in all circumstances, as these are charged by the payment processor and are not retained by Getmypro.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">10. Contact for Refunds</h2>
          <div className="bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-slate-200 font-semibold">Getmypro</p>
            <p>Srirama Nagar Colony, Korada Street, Bobbili, Vizianagaram, Andhra Pradesh — 535558</p>
            <p>Email: getmypro.care@gmail.com</p>
            <p>WhatsApp: +91 89856 14758</p>
            <p>Support Hours: Monday–Saturday, 8 AM – 8 PM</p>
          </div>
        </section>
      </div>
    ),
  },

  'about': {
    title: 'About Us',
    content: (
      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">

        <section className="flex flex-col items-center text-center py-4">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white text-3xl font-black">G</span>
          </div>
          <h2 className="text-slate-50 font-black text-xl">Getmypro</h2>
          <p className="text-slate-400 text-xs mt-1">We started with one goal — make it easy for every home to get quality repairs done by trusted, local professionals.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">Our Story</h2>
          <p>Getmypro was founded to solve a simple but frustrating problem — finding a reliable, trustworthy home service professional is hard. You never know if the person you call is skilled, if their price is fair, or if they'll actually show up.</p>
          <p className="mt-2">We built Getmypro to change that. Every professional on our platform is Aadhaar-verified and background-checked. You see the full price before you approve any work. And if anything goes wrong, our support team is available on WhatsApp.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">What Makes Us Different</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Our Pros keep 100% of what they earn — zero commission</li>
            <li>Low booking prices for customers</li>
            <li>High quality materials supplied at fair prices</li>
            <li>Technology-driven marketplace connecting customers with independent skilled professionals</li>
          </ul>
        </section>

        <section>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Founded', value: 'Feb 27, 2026' },
              { label: 'Headquarters', value: 'Vizag' },
              { label: 'Service Categories', value: '8' },
              { label: 'Commission for Pros', value: '0%' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-blue-400 font-black text-lg">{value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">Our Mission</h2>
          <p>To make quality home services accessible, affordable and trustworthy for every household in India — with 100% commission free earnings for professionals and low prices for customers.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">Our Vision</h2>
          <p>To become India's most trusted home services platform, empowering thousands of skilled local professionals with consistent, well-paying, commission-free work.</p>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">Meet the Co-Founders</h2>
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-50 font-bold">Pedapolu Hemanth Krishna</p>
              <p className="text-blue-400 text-xs font-semibold mt-0.5">CEO & Co-Founder</p>
              <p className="text-slate-400 text-xs mt-2">Building India's most trusted home services platform — empowering local professionals with zero commission work.</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-50 font-bold">K. Oswald Samuel</p>
              <p className="text-blue-400 text-xs font-semibold mt-0.5">CTO & Co-Founder</p>
              <p className="text-slate-400 text-xs mt-2">Leading the technology vision to build a scalable, reliable platform that connects customers with skilled professionals across India.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-slate-50 font-bold text-base mb-2">Business Information</h2>
          <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-xs">
            {[
              ['Business Name', 'Getmypro'],
              ['Business Type', 'Online Marketplace — Home Services'],
              ['Co-Founders', 'Pedapolu Hemanth Krishna (CEO) & K. Oswald Samuel (CTO)'],
              ['Registered Address', 'Srirama Nagar Colony, Korada Street, Bobbili, Vizianagaram, Andhra Pradesh — 535558'],
              ['Email', 'getmypro.care@gmail.com'],
              ['Phone', '+91 89856 14758'],
              ['Operating Since', 'Feb 27, 2026'],
            ].map(([key, val]) => (
              <div key={key} className="flex gap-2 border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-400 shrink-0 w-32">{key}</span>
                <span className="text-slate-200">{val}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    ),
  },
}

export default function LegalPage() {
  const { page } = useParams<{ page: string }>()
  const navigate = useNavigate()
  const pageData = PAGES[page as LegalPageType]

  if (!pageData) {
    navigate('/', { replace: true })
    return null
  }

  return (
    <div className="page-content px-5 py-6 pb-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-5 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-semibold">Back</span>
      </button>

      <h1 className="text-2xl font-black font-heading text-slate-50 mb-6">{pageData.title}</h1>

      {pageData.content}
    </div>
  )
}
