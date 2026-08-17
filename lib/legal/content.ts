export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  listItems?: string[];
}

export const LEGAL_REVIEW_NOTICE =
  "This document is provided for informational purposes and may require final review by qualified legal counsel before publication.";

export const SUPPORT_EMAIL = "support@scanonix.com";

export const PRIVACY_LAST_UPDATED = "17 August 2026";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "information-we-collect",
    title: "Information we collect",
    paragraphs: [
      "Scanonix provides document, image, OCR, and related tools through our website and mobile applications. Depending on how you use Scanonix, we may collect the following types of information:",
    ],
    listItems: [
      "Account information you provide when registering or signing in, such as your name, email address, and authentication details.",
      "Support and contact information you send to us, including the content of messages submitted through our contact form or email.",
      "Usage and technical information, such as browser type, device type, pages visited, and approximate interaction data.",
      "Payment-related information when you purchase premium features. Payment processing is typically handled by third-party payment providers, and we do not store full payment card numbers on our servers unless explicitly stated at checkout.",
      "Files and content you choose to upload only where a specific tool or feature requires server-side processing, as described in the relevant tool documentation.",
    ],
  },
  {
    id: "files-uploaded-to-tools",
    title: "Files uploaded to tools",
    paragraphs: [
      "Many Scanonix tools allow you to upload PDFs, images, or other files for conversion, extraction, or editing. How those files are handled depends on the tool you use.",
      "For browser-based tools that process files locally, your files are generally read and transformed within your device using client-side technologies such as JavaScript, WebAssembly, or similar in-browser processing. In those cases, Scanonix does not receive the contents of your files unless you separately choose to send them to us, for example through a support request.",
      "You are responsible for ensuring that you have the right to upload and process any file you submit through Scanonix tools, and for complying with applicable laws and contractual obligations.",
    ],
  },
  {
    id: "local-browser-processing",
    title: "Local browser processing",
    paragraphs: [
      "A significant portion of Scanonix web tools — including many PDF, image, OCR, and QR utilities currently available on scanonix.com — are designed to process files locally in your browser whenever technically feasible.",
      "Local processing means that file data stays on your device during conversion or analysis, subject to your browser and operating system security settings. This approach is central to our privacy-first product design.",
      "Because processing happens on your device, performance may depend on your hardware, browser, and file size. Clearing browser data, closing a tab, or refreshing the page may remove in-memory file data associated with an active session.",
      "Tool pages may indicate when a feature runs locally. If a tool does not state that processing is local, you should assume server-side or hybrid processing may be involved.",
    ],
  },
  {
    id: "server-side-processing",
    title: "Server-side processing where applicable",
    paragraphs: [
      "Some Scanonix features — including certain current or future premium, AI, sync, account, billing, or mobile services — may require files or metadata to be transmitted to Scanonix or trusted infrastructure providers for processing, storage, or delivery.",
      "Where server-side processing applies, we aim to limit collection to what is necessary to provide the feature, protect the service, and comply with law. Specific handling may vary by tool, plan, and region.",
      "We do not represent that every Scanonix tool will always remain local-only. If we introduce or change a feature that processes files on our servers, we will update this policy and, where appropriate, provide in-product notice.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    paragraphs: [
      "Scanonix may use Google Analytics 4 to understand how visitors use our website — for example, which pages are viewed, how visitors reach Scanonix, and general device or browser characteristics.",
      "Analytics on scanonix.com is optional and consent-based. Google Analytics is loaded only after you accept analytics through our cookie banner or the Cookie preferences control in the website footer. If you reject analytics, or have not yet made a choice, Scanonix does not load Google Analytics for your visit.",
      "You can change or withdraw your analytics choice at any time using Cookie preferences. Withdrawing consent stops further Google Analytics collection on future visits in that browser, subject to any analytics cookies already set until they expire or are cleared.",
      "When analytics consent is granted, Google Analytics may process usage information such as pages visited, referral sources, device and browser type, screen resolution, approximate location derived from IP address, and configured page-interaction events. We configure Google Analytics to avoid collecting unnecessary personal information. Scanonix does not send names, email addresses, uploaded file names, document contents, OCR or PDF text, passwords, payment card details, or other tool-file data to Google Analytics.",
      "Google provides analytics services to us as a service provider and may act as a data processor where applicable. Google may process analytics information according to its own privacy policy and data processing terms. You may also use browser settings or provider opt-out tools where available, in addition to our Cookie preferences control.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    paragraphs: [
      "Scanonix uses cookies and similar technologies to operate the website, remember preferences, maintain sessions, and support analytics or security functions.",
      "Essential cookies are used to provide core functionality. Optional analytics cookies, where used, are set only after you accept analytics and help us measure website usage through Google Analytics 4.",
      "Your analytics consent preference may be stored locally in your browser (for example, using local storage) so Scanonix can remember your choice between visits. You can control cookies through your browser settings and through Cookie preferences on our website. Disabling certain cookies may affect site functionality or saved preferences.",
    ],
  },
  {
    id: "account-information",
    title: "Account information",
    paragraphs: [
      "If you create a Scanonix account, we collect and store information needed to authenticate you, manage your profile, provide workspace features, and communicate about your account.",
      "You are responsible for maintaining the confidentiality of your login credentials and for activity that occurs under your account, except where prohibited by applicable law.",
      "You may request access, correction, or deletion of account information subject to verification requirements and legal retention obligations.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    paragraphs: [
      "If you purchase premium features or subscriptions, payment information is processed by third-party payment processors. Scanonix typically receives limited billing details such as transaction status, plan type, and partial payment identifiers needed for invoicing and support.",
      "We retain purchase records as needed for accounting, fraud prevention, dispute resolution, and legal compliance.",
    ],
  },
  {
    id: "data-retention",
    title: "Data retention",
    paragraphs: [
      "We retain personal information only for as long as reasonably necessary to provide services, fulfil the purposes described in this policy, resolve disputes, enforce agreements, and comply with legal obligations.",
      "Files processed locally in your browser are generally not retained by Scanonix after your session ends, unless you explicitly upload them to a server-based feature or send them to us for support.",
      "Server-side data retention periods may vary by feature and will be described in product documentation where material.",
    ],
  },
  {
    id: "third-party-services",
    title: "Third-party services",
    paragraphs: [
      "Scanonix may rely on third-party providers for hosting, analytics, authentication, payment processing, email delivery, AI inference, content delivery, and customer support tools.",
      "These providers process information on our behalf according to contractual safeguards and their own privacy policies. We encourage you to review the policies of major providers we integrate with when relevant to your use case.",
      "Our website may contain links to third-party sites or app stores. Scanonix is not responsible for the privacy practices of those external services.",
    ],
  },
  {
    id: "childrens-privacy",
    title: "Children's privacy",
    paragraphs: [
      "Scanonix is not directed to children under 13, or the minimum age required in your jurisdiction, and we do not knowingly collect personal information from children without appropriate consent.",
      "If you believe a child has provided personal information to Scanonix, please contact us and we will take reasonable steps to delete such information where required by law.",
    ],
  },
  {
    id: "international-users",
    title: "International users",
    paragraphs: [
      "Scanonix may be accessed from multiple countries. If you use our services from outside the country where our infrastructure is located, your information may be transferred to, stored in, or processed in jurisdictions with different data protection laws.",
      "Where required, we implement appropriate safeguards for cross-border transfers. Your use of Scanonix may also be subject to local laws in addition to this policy.",
    ],
  },
  {
    id: "user-rights",
    title: "User rights",
    paragraphs: [
      "Depending on your location, you may have rights to access, correct, delete, restrict, or port personal information, or to object to certain processing activities.",
      "You may also have the right to withdraw consent where processing is based on consent, and to lodge a complaint with a supervisory authority.",
      "To exercise applicable rights, contact us at support@scanonix.com. We may need to verify your identity before responding.",
    ],
  },
  {
    id: "contact-information",
    title: "Contact information",
    paragraphs: [
      "If you have questions about this Privacy Policy or our data practices, contact us at:",
      "Email: support@scanonix.com",
      "You may also use our contact page at scanonix.com/contact for privacy-related requests.",
    ],
  },
  {
    id: "policy-updates",
    title: "Policy updates",
    paragraphs: [
      "We may update this Privacy Policy from time to time to reflect changes in our services, legal requirements, or operational practices.",
      "When we make material changes, we will update the “Last updated” date at the top of this page and, where appropriate, provide additional notice through the website or by email.",
      "Your continued use of Scanonix after an updated policy becomes effective constitutes acceptance of the revised policy, except where applicable law requires a different form of consent.",
    ],
  },
];

export const TERMS_LAST_UPDATED = "14 July 2026";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "acceptance-of-terms",
    title: "Acceptance of terms",
    paragraphs: [
      "These Terms of Service (“Terms”) govern your access to and use of Scanonix websites, tools, applications, and related services (collectively, the “Service”).",
      "By accessing or using the Service, you agree to these Terms. If you do not agree, do not use the Service.",
      LEGAL_REVIEW_NOTICE,
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    paragraphs: [
      "You must be at least the age of majority in your jurisdiction, or have valid parental or guardian consent, to use the Service.",
      "You represent that you have the legal capacity to enter into these Terms and that your use of the Service complies with applicable laws.",
    ],
  },
  {
    id: "use-of-tools",
    title: "Use of Scanonix tools",
    paragraphs: [
      "Scanonix provides online and mobile tools for document conversion, image processing, OCR, QR scanning, and related workflows.",
      "Many web tools process files locally in your browser. Other features may rely on server-side processing, accounts, sync, or premium capabilities as described for each product.",
      "We may modify, suspend, or discontinue any part of the Service at any time, with or without notice, subject to applicable law.",
    ],
  },
  {
    id: "user-responsibilities",
    title: "User responsibilities",
    paragraphs: [
      "You are responsible for your use of the Service, for maintaining appropriate backups of your files, and for verifying the accuracy and suitability of outputs before relying on them.",
      "You must provide accurate account and billing information where required and keep your credentials secure.",
      "You agree to use the Service in compliance with these Terms and all applicable laws and regulations.",
    ],
  },
  {
    id: "prohibited-use",
    title: "Prohibited use",
    paragraphs: [
      "You may not use the Service to:",
    ],
    listItems: [
      "Upload, process, or distribute unlawful, infringing, harmful, or malicious content.",
      "Attempt to gain unauthorized access to systems, accounts, or data.",
      "Reverse engineer, scrape, or overload the Service except as permitted by law.",
      "Misrepresent your identity or affiliation.",
      "Use the Service in a manner that interferes with other users or compromises security.",
    ],
  },
  {
    id: "uploaded-content",
    title: "Uploaded content",
    paragraphs: [
      "You retain ownership of files and content you submit through the Service, subject to any rights granted below.",
      "You grant Scanonix a limited license to host, process, transmit, and display uploaded content only as necessary to operate the Service, provide support, and comply with law.",
      "For tools that process files locally in your browser, Scanonix does not claim ownership of file contents processed entirely on your device.",
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    paragraphs: [
      "The Service, including its software, branding, design, documentation, and underlying technology, is owned by Scanonix or its licensors and is protected by intellectual property laws.",
      "Except for the limited rights expressly granted in these Terms, no license or ownership interest is transferred to you.",
    ],
  },
  {
    id: "free-and-premium",
    title: "Free and premium features",
    paragraphs: [
      "Scanonix may offer free and paid tiers. Feature availability, usage limits, and export options may differ between plans.",
      "Premium features may include higher resolution exports, advanced AI tools, team workspaces, or other capabilities described at purchase.",
      "We may change plan features or pricing prospectively. Existing subscribers will be notified where required by law or contract.",
    ],
  },
  {
    id: "payments-and-subscriptions",
    title: "Payments and subscriptions",
    paragraphs: [
      "Paid plans, where offered, may renew automatically until cancelled according to the billing terms presented at checkout.",
      "Prices, taxes, and payment methods are shown before purchase. You authorise us and our payment processors to charge applicable fees.",
      "Specific billing terms for mobile app purchases may be governed by the relevant app store provider.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    paragraphs: [
      "Refund eligibility depends on the plan purchased, the platform used, and applicable consumer protection laws.",
      "Unless otherwise stated at purchase or required by law, fees are non-refundable once a billing period has begun.",
      "Refund details are subject to final legal and commercial review and may be updated in product-specific terms.",
    ],
  },
  {
    id: "service-availability",
    title: "Service availability",
    paragraphs: [
      "We strive to keep the Service available and reliable, but we do not guarantee uninterrupted or error-free operation.",
      "Maintenance, updates, browser compatibility issues, network failures, or third-party outages may affect availability.",
      "Outputs generated by automated tools may contain errors, omissions, or formatting issues. You are responsible for reviewing results before use.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      "The Service is provided on an “as is” and “as available” basis to the fullest extent permitted by law.",
      "Scanonix disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, except where such disclaimers are prohibited.",
      "We do not warrant that outputs from OCR, conversion, compression, or AI features will be complete, accurate, or suitable for legal, medical, financial, or other professional purposes without human review.",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, Scanonix and its affiliates, officers, employees, and suppliers will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, goodwill, or business opportunity arising from your use of the Service.",
      "Our aggregate liability for claims relating to the Service will not exceed the greater of the amount you paid to Scanonix in the twelve months before the claim or one hundred US dollars (USD $100), except where liability cannot be limited by law.",
      "This section is subject to final legal review and may vary by jurisdiction.",
    ],
  },
  {
    id: "account-termination",
    title: "Account termination",
    paragraphs: [
      "You may stop using the Service at any time. You may also request account closure where account features are available.",
      "We may suspend or terminate access if we reasonably believe you violated these Terms, created risk or legal exposure, or where required by law.",
      "Provisions that by their nature should survive termination — including intellectual property, disclaimers, and limitations of liability — will survive.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    paragraphs: [
      "These Terms are governed by the laws of [jurisdiction to be specified — pending final legal review], without regard to conflict-of-law principles.",
      "Any disputes arising from these Terms or the Service will be resolved in the courts of [venue to be specified — pending final legal review], unless applicable law requires otherwise.",
    ],
  },
  {
    id: "contact-information",
    title: "Contact information",
    paragraphs: [
      "Questions about these Terms may be sent to:",
      "Email: support@scanonix.com",
      "Contact page: scanonix.com/contact",
    ],
  },
];

export const CONTACT_CATEGORIES = [
  { value: "technical-support", label: "Technical support" },
  { value: "billing", label: "Billing" },
  { value: "feature-request", label: "Feature request" },
  { value: "business-enquiry", label: "Business enquiry" },
  { value: "privacy-request", label: "Privacy request" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];
