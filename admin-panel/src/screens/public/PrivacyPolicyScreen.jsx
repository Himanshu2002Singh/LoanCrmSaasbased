import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  FileText,
  MapPin,
  Camera,
  PhoneCall,
  Server,
  UserCheck,
  Trash2,
  HelpCircle,
  ArrowLeft,
  Printer,
  CheckCircle,
  Building2,
  Mail,
  Smartphone,
  Database,
  Users,
} from "lucide-react";
import CrmLogo from "../../components/CrmLogo";

export default function PrivacyPolicyScreen() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CrmLogo className="h-8 w-auto" />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <span className="text-sm font-semibold text-slate-700">Loan CRM Platform</span>
              <span className="block text-xs text-slate-400">Privacy & Compliance Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Print Policy"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to CRM</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-900 via-slate-900 to-slate-900 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <ShieldCheck size={14} className="text-blue-400" />
            <span>Google Play Store & Regulatory Compliance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Privacy Policy
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Transparency, enterprise data protection, and adherence to user privacy standards for our
            web management platform and mobile application.
          </p>

          <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2">
            <span><strong>Platform:</strong> Web Admin Panel & Android App</span>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Quick Navigation Sidebar (Desktop) */}
          <aside className="hidden lg:block lg:col-span-1 print:hidden">
            <div className="sticky top-24 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1 text-xs">
              <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 px-2">Table of Contents</p>
              <nav className="space-y-1">
                {[
                  { id: "overview", label: "1. Overview & Scope" },
                  { id: "data-collected", label: "2. Information We Collect" },
                  { id: "permissions", label: "3. App Permissions Disclosed" },
                  { id: "purpose", label: "4. How We Use Data" },
                  { id: "security", label: "5. Security & Isolation" },
                  { id: "third-parties", label: "6. Third-Party Sharing" },
                  { id: "retention", label: "7. Data Retention & Deletion" },
                  { id: "children", label: "8. Children's Privacy" },
                  { id: "contact", label: "9. Grievance & Contact" },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Policy Sections */}
          <article className="lg:col-span-3 space-y-8">
            {/* 1. Overview */}
            <section id="overview" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1. Overview & Scope</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  This Privacy Policy applies to the <strong>Loan CRM</strong> mobile application and the accompanying SaaS Web CRM platform (collectively, the <strong>"Platform"</strong>, <strong>"Service"</strong>, <strong>"We"</strong>, <strong>"Us"</strong>, or <strong>"Our"</strong>).
                </p>
                <p>
                  The Loan CRM platform operates as an enterprise Business-to-Business (B2B) Loan Management and Customer Relationship Management solution used by authorized financial institutions, Direct Selling Agents (DSAs), loan distributors, and authorized field representatives.
                </p>
                <p>
                  This policy outlines how we collect, process, disclose, and safeguard user information, customer leads, and employee operational telemetry in full compliance with applicable data protection laws and <strong>Google Play Store Developer Policies</strong>.
                </p>
              </div>
            </section>

            {/* 2. Information We Collect */}
            <section id="data-collected" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Database size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. Information We Collect</h2>
              </div>
              <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                <p>To provide reliable CRM workflows and loan processing services, we collect the following categories of data:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                      <UserCheck size={18} className="text-blue-600" />
                      <span>Employee & Agent Profile</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Full name, official email address, mobile phone number, employee code, assigned branch, and designated organization role (e.g. Telecaller, Sales Executive, Branch Manager).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                      <FileText size={18} className="text-emerald-600" />
                      <span>Loan Applicant & Lead Records</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Customer applicant contact details, desired loan product, requested amount, credit parameters, KYC identity documents (Aadhaar, PAN, Voter ID), salary slips, and bank statements submitted explicitly for loan processing.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                      <MapPin size={18} className="text-amber-600" />
                      <span>GPS & Geo-Location Telemetry</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Accurate GPS coordinates collected <em>only</em> at the specific moments an employee triggers attendance <strong>"Punch In"</strong> or <strong>"Punch Out"</strong>, to verify geofenced presence at registered office branches.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                      <Camera size={18} className="text-purple-600" />
                      <span>Camera & Document Attachments</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Photos and PDF documents selected by the user to attach KYC documents to loan files or receipts/invoices to internal expense reimbursement claims.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Google Play Store Permission Disclosures */}
            <section id="permissions" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Smartphone size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">3. App Permissions Disclosed (Play Store Compliance)</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                The Loan CRM Android mobile application requests specific device permissions. In accordance with Google Play Store policies, each permission and its precise business necessity is detailed below:
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Permission</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Explicit Purpose & Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <tr>
                      <td className="p-3 font-mono font-medium text-blue-600">ACCESS_FINE_LOCATION / COARSE_LOCATION</td>
                      <td className="p-3 font-semibold text-slate-800">Foreground Only</td>
                      <td className="p-3">
                        Utilized strictly when the employee taps the "Punch In" or "Punch Out" button on the Attendance screen to calculate distance from the employer's branch office. <strong>We do not track continuous or background location.</strong>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-blue-600">CAMERA</td>
                      <td className="p-3 font-semibold text-slate-800">User Initiated</td>
                      <td className="p-3">
                        Allows users to snap photos of physical KYC documents, customer paperwork, or expense bills to upload them into the CRM.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-blue-600">READ_EXTERNAL_STORAGE / READ_MEDIA</td>
                      <td className="p-3 font-semibold text-slate-800">User Initiated</td>
                      <td className="p-3">
                        Enables the selection of existing PDF files or gallery images for loan application submission.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-blue-600">CALL_PHONE</td>
                      <td className="p-3 font-semibold text-slate-800">User Initiated</td>
                      <td className="p-3">
                        Allows telecallers and relationship managers to launch the native phone dialer directly from lead profiles to contact customers.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-medium text-blue-600">INTERNET / ACCESS_NETWORK_STATE</td>
                      <td className="p-3 font-semibold text-slate-800">System</td>
                      <td className="p-3">
                        Enables secure encrypted communication with the CRM backend server.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Purpose of Data Processing */}
            <section id="purpose" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <CheckCircle size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">4. How We Use Your Data</h2>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-600 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-800">Loan Workflow Facilitation:</strong> To evaluate eligibility, organize applicant documents, and submit loan files to partner lenders.</li>
                <li><strong className="text-slate-800">Workforce Attendance Management:</strong> To record daily work hours, late markings, half-days, and punch locations within company guidelines.</li>
                <li><strong className="text-slate-800">Customer Communication:</strong> To schedule follow-ups, deliver automated reminder alerts, and maintain relationship logs.</li>
                <li><strong className="text-slate-800">Expense Claim Processing:</strong> To allow staff to submit travel and daily expense claims with supporting invoices for management reimbursement.</li>
                <li><strong className="text-slate-800">Security & Fraud Prevention:</strong> To prevent unauthorized logins, prevent geo-spoofing during attendance, and ensure audit trail integrity.</li>
              </ul>
            </section>

            {/* 5. Security & Isolation */}
            <section id="security" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Lock size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">5. Enterprise Security & Multi-Tenancy</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  Security is the foundational pillar of our platform. We implement state-of-the-art technical and organizational safeguards:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <Server size={20} className="mx-auto text-blue-600" />
                    <p className="font-semibold text-slate-900 text-xs">256-Bit SSL/TLS</p>
                    <p className="text-[11px] text-slate-500">All data in transit is encrypted using modern cryptographic protocols.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <Database size={20} className="mx-auto text-emerald-600" />
                    <p className="font-semibold text-slate-900 text-xs">Tenant Isolation</p>
                    <p className="text-[11px] text-slate-500">Companies have isolated records, with dedicated or encrypted cloud storage.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <Users size={20} className="mx-auto text-purple-600" />
                    <p className="font-semibold text-slate-900 text-xs">Role-Based Access</p>
                    <p className="text-[11px] text-slate-500">Granular permissions ensure employees only access data they are authorized to see.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. Third-Party Sharing */}
            <section id="third-parties" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                  <Building2 size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Third-Party Sharing & Disclosure Policy</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>We NEVER sell, monetize, rent, or trade your personal or customer data to advertisers or third-party brokers.</span>
                </div>
                <p>Data is shared strictly under the following scenarios:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>Banking Partners & Lending Institutions:</strong> Customer loan files are transmitted only to verified lenders selected by the applicant for loan underwriting.</li>
                  <li><strong>Cloud Infrastructure Providers:</strong> AWS / cloud servers operating under strict confidentiality and SOC2/ISO compliance agreements.</li>
                  <li><strong>Legal & Regulatory Mandates:</strong> If required by valid court order, government agency, or statutory compliance.</li>
                </ul>
              </div>
            </section>

            {/* 7. Data Retention & Deletion */}
            <section id="retention" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. Data Retention & Account Deletion (Google Play Compliance)</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  In compliance with Google Play Store’s <strong>Data Safety & Account Deletion Policy</strong>, users and organization administrators have the right to request deletion of their personal accounts and stored records.
                </p>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="font-semibold text-slate-900 text-sm">How to Request Account or Data Deletion:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600">
                    <li>
                      Submit a request directly via our{" "}
                      <Link to="/delete-account" className="text-blue-600 font-semibold underline hover:text-blue-700">
                        Online Account Deletion Request Form
                      </Link>
                      , or email <strong>trustingbrains@gmail.com</strong> with the subject line <em>"Account / Data Deletion Request"</em>.
                    </li>
                    <li>Provide your registered mobile number, email, and company name.</li>
                    <li>Upon receiving the request, our data protection desk will permanently purge your authentication credentials, personal profile, and associated application telemetry within <strong>48 hours</strong>.</li>
                  </ol>
                  <div className="pt-1">
                    <Link
                      to="/delete-account"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>Submit Deletion Request Online (48 Hours Turnaround)</span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* 8. Children's Privacy */}
            <section id="children" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <HelpCircle size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">8. Children's Privacy</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Our services and applications are exclusively intended for commercial enterprise use by working professionals aged 18 and older. We do not knowingly solicit or collect personal identifiable information from children under 18 years of age.
              </p>
            </section>

            {/* 9. Contact Us */}
            <section id="contact" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs scroll-mt-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Mail size={22} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">9. Grievance Officer & Contact Us</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p>
                  If you have questions, grievances, or inquiries regarding this Privacy Policy or our data handling practices, please contact our compliance desk:
                </p>
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-slate-800 text-xs space-y-1.5">
                  <p><strong>Entity Name:</strong> Trusting Brains</p>
                  <p><strong>Grievance Officer:</strong> Data Protection & Security Team</p>
                  <p><strong>Email Address:</strong> <a href="mailto:trustingbrains@gmail.com" className="text-blue-600 hover:underline">trustingbrains@gmail.com</a></p>
                  <p><strong>Response Time:</strong> Within 48 business hours</p>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-slate-200 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Trusting Brains. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-blue-600 transition-colors">Admin Login</Link>
            <span>•</span>
            <span className="text-slate-400">Google Play Compliant Privacy Standard</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
