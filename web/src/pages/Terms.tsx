import React from 'react';
import { Shield, Lock, FileText, Scale, AlertCircle, CheckCircle2, X } from 'lucide-react';

export function Terms() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
      
      {/* Hero Section */}
      <header className="mb-24 md:mb-32">
        <div className="border-l-8 border-on-surface pl-6 md:pl-10">
          <p className="font-mono text-primary text-sm md:text-base tracking-widest uppercase mb-4">Legal & Compliance</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black font-headline tracking-tighter uppercase leading-none mb-8">
            Terms &<br/>Conditions
          </h1>
          <p className="text-lg md:text-2xl max-w-3xl font-medium leading-relaxed text-on-surface/80">
            By using SWACN, you agree to the following terms. Please read them carefully to understand your rights and responsibilities.
          </p>
        </div>
      </header>

      {/* 01. Platform Ownership */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">01. Platform Ownership</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-on-surface/80">
          <div>
            <p className="text-xl leading-relaxed mb-8">
              SWACN is provided as a managed service. All components, including the server infrastructure and web client, are the property of SWACN.
            </p>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary"><Lock size={16} /></div>
                <div>
                  <h4 className="font-bold mb-1">Access License</h4>
                  <p className="text-sm opacity-70 leading-relaxed">We grant you a non-transferable right to access and use the platform for creating and sharing terminal recordings.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary"><Shield size={16} /></div>
                <div>
                  <h4 className="font-bold mb-1">Rights Reserved</h4>
                  <p className="text-sm opacity-70 leading-relaxed">We reserve all rights not expressly granted to you. The underlying source code and binaries remain under our exclusive control.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-high border-4 border-on-surface p-8 hard-shadow flex flex-col justify-center">
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter mb-4 text-on-surface">Usage Boundaries</h3>
            <p className="text-sm leading-relaxed mb-6">
              Users are expected to use the provided interfaces as intended. Redistribution, modification, or unauthorized extraction of the platform's components is not permitted.
            </p>
            <div className="bg-primary/5 border-l-4 border-primary p-4 text-sm font-mono italic">
              These terms apply to all current and future versions of the service.
            </div>
          </div>
        </div>
      </section>

      {/* 02. Acceptable Use */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">02. Acceptable Use</h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <AlertCircle className="text-error" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">No Malware</h4>
            <p className="text-sm opacity-70 leading-relaxed">Do not use SWACN to host, distribute, or test malicious software, phishing pages, or exploits.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <Scale className="text-primary" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Fair Usage</h4>
            <p className="text-sm opacity-70 leading-relaxed">Avoid automated scraping or high-frequency requests that may degrade service for other users.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <FileText className="text-on-surface" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Legal Compliance</h4>
            <p className="text-sm opacity-70 leading-relaxed">Users are responsible for ensuring their uploads comply with local and international laws.</p>
          </div>
        </div>
      </section>

      {/* 03. Data & Privacy */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">03. Data & Privacy</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="bg-white border-4 border-on-surface p-8 md:p-12 hard-shadow">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-6">Your Content</h3>
              <p className="text-lg leading-relaxed text-on-surface/70 mb-6">
                You retain ownership of the content you upload. However, by uploading to SWACN, you grant us a worldwide license to host, display, and distribute that content.
              </p>
              <ul className="space-y-4 font-mono text-sm">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>Public projects are visible to anyone with the URL.</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>Deduplicated storage means identical files are stored once.</span>
                </li>
              </ul>
            </div>
            <div className="bg-surface-container-low p-8 border-2 border-on-surface flex flex-col gap-6">
              <h4 className="font-bold uppercase text-primary">Security Warning</h4>
              <p className="text-sm leading-relaxed opacity-80 italic">
                "SWACN is designed for public sharing of terminal workflows. Never upload secrets, private keys, or sensitive personal data to the platform."
              </p>
              <div className="mt-auto pt-6 border-t border-on-surface/10">
                <p className="text-xs opacity-50 uppercase font-black">Last Updated: April 24, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04. Subscriptions & Payments */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">04. Subscriptions & Payments</h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <CheckCircle2 className="text-primary" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Billing & Renewals</h4>
            <p className="text-sm opacity-70 leading-relaxed">Subscriptions are processed automatically via Dodo Payments on a recurring monthly or annual basis. You can view your status on the Dashboard.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <X className="text-error" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Cancellation</h4>
            <p className="text-sm opacity-70 leading-relaxed">You may cancel your subscription at any time via your dashboard or customer billing portal. Access to Pro features will remain active until the end of the current billing cycle.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <Scale className="text-on-surface" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Refund Policy</h4>
            <p className="text-sm opacity-70 leading-relaxed">Payments are generally non-refundable. If you believe there was a billing error, open a support ticket in our <a href="https://discord.gg/SDyspbmkKq" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Discord Server</a> within 14 days of the charge.</p>
          </div>
        </div>
      </section>

      {/* 05. DMCA & Copyright Takedowns */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">05. Copyright & DMCA</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="bg-white border-4 border-on-surface p-8 md:p-12 hard-shadow">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-6">Notice and Takedown</h3>
              <p className="text-lg leading-relaxed text-on-surface/70 mb-6">
                We respect intellectual property rights. If you believe content uploaded to SWACN infringes your copyright, you can submit a takedown request.
              </p>
            </div>
            <div className="bg-surface-container-low p-8 border-2 border-on-surface flex flex-col gap-6">
              <h4 className="font-bold uppercase text-primary">How to File a Notice</h4>
              <p className="text-sm leading-relaxed opacity-80">
                Open a support ticket in our <a href="https://discord.gg/SDyspbmkKq" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Discord Server</a> with the specific URL of the recording, evidence of ownership of the copyrighted work, and your contact details. We will review and disable access to infringing material promptly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Disclaimer */}
      <div className="mt-32 border-t-4 border-on-surface pt-12">
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface/60 max-w-2xl">
          Disclaimer: SWACN provides these services "as is" without any warranties. We are not liable for any data loss, security breaches, or misuse of the platform by third parties.
        </p>
      </div>

    </div>
  );
}
