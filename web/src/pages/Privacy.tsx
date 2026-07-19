import React from 'react';
import { Shield, Eye, Database, Share2, UserCheck, CheckCircle2 } from 'lucide-react';

export function Privacy() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
      
      {/* Hero Section */}
      <header className="mb-24 md:mb-32">
        <div className="border-l-8 border-on-surface pl-6 md:pl-10">
          <p className="font-mono text-primary text-sm md:text-base tracking-widest uppercase mb-4">Legal & Compliance</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black font-headline tracking-tighter uppercase leading-none mb-8">
            Privacy<br/>Policy
          </h1>
          <p className="text-lg md:text-2xl max-w-3xl font-medium leading-relaxed text-on-surface/80">
            We value your privacy. This policy outlines how SWACN collects, uses, protects, and handles your personal data.
          </p>
        </div>
      </header>

      {/* 01. Information We Collect */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">01. Information We Collect</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-on-surface/80">
          <div>
            <p className="text-xl leading-relaxed mb-8">
              We collect the minimum amount of data required to operate the service and manage your account.
            </p>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary"><UserCheck size={16} /></div>
                <div>
                  <h4 className="font-bold mb-1">Identity & Authentication</h4>
                  <p className="text-sm opacity-70 leading-relaxed">When logging in via GitHub or Google, we collect your email address, username, public profile photo, and OAuth user IDs to create and secure your account.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary"><Database size={16} /></div>
                <div>
                  <h4 className="font-bold mb-1">Uploaded Environment Data</h4>
                  <p className="text-sm opacity-70 leading-relaxed">We store the directory metadata, baseline workspace archives, and asciinema recording casts you upload to sync playback with the browser VM.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-high border-4 border-on-surface p-8 hard-shadow flex flex-col justify-center">
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter mb-4 text-on-surface">Billing Information</h3>
            <p className="text-sm leading-relaxed mb-6">
              Payment processing is handled securely by <strong className="font-bold text-on-surface">Dodo Payments</strong>. SWACN does not store credit card numbers or raw billing details. We only receive your subscription status, subscription ID, and billing customer ID.
            </p>
            <div className="bg-primary/5 border-l-4 border-primary p-4 text-sm font-mono italic">
              All personal details are stored in encrypted PostgreSQL database instances.
            </div>
          </div>
        </div>
      </section>

      {/* 02. How We Use Data */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">02. How We Use Data</h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <Eye className="text-primary" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Service Provision</h4>
            <p className="text-sm opacity-70 leading-relaxed">To run the terminal visualizer, fetch workspace files, and boot your isolated v86 WASM browser sandboxes.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <Shield className="text-primary" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">Access Verification</h4>
            <p className="text-sm opacity-70 leading-relaxed">To authorize enterprise seat usage automatically based on domain names, and check Pro subscription status.</p>
          </div>
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-4">
            <Share2 className="text-on-surface" size={32} />
            <h4 className="font-bold uppercase tracking-tighter text-xl">No Ads or Selling</h4>
            <p className="text-sm opacity-70 leading-relaxed">We will never sell your personal data or target you with advertisements. Your data is used purely to run SWACN.</p>
          </div>
        </div>
      </section>

      {/* 03. Cookies & Local Storage */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">03. Cookies & Local Storage</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="bg-white border-4 border-on-surface p-8 md:p-12 hard-shadow">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-6">Essential Storage Only</h3>
              <p className="text-lg leading-relaxed text-on-surface/70 mb-6">
                SWACN does not use tracking cookies for advertising. We rely strictly on essential browser local storage to maintain session states.
              </p>
              <ul className="space-y-4 font-mono text-sm">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>We use local storage keys to store your authentication session token.</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>These tokens are essential for authorizing uploads, deletes, and dashboard views.</span>
                </li>
              </ul>
            </div>
            <div className="bg-surface-container-low p-8 border-2 border-on-surface flex flex-col gap-6">
              <h4 className="font-bold uppercase text-primary">Your Control</h4>
              <p className="text-sm leading-relaxed opacity-80">
                You can block or purge local storage in your browser settings. However, logging out of the application automatically clears all credentials and session tokens from your local storage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 04. Rights & Erasure (GDPR/CCPA) */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">04. Your Rights & Erasure</h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>
        
        <div className="bg-white border-4 border-on-surface p-8 hard-shadow text-on-surface/80">
          <p className="text-lg leading-relaxed mb-6">
            Under data protection regulations like GDPR (Europe) and CCPA (California), you have full rights to control your personal data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h5 className="font-bold mb-2">Right to Erasure (Delete Account)</h5>
              <p className="opacity-70 leading-relaxed mb-4">
                You can request the deletion of your account and associated personal information (email, profile info, and all uploaded casts/projects) by opening a support ticket in our <a href="https://discord.gg/SDyspbmkKq" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Discord Server</a>. We will process erasure requests within 30 days.
              </p>
            </div>
            <div>
              <h5 className="font-bold mb-2">Right to Access and Rectification</h5>
              <p className="opacity-70 leading-relaxed">
                You can query what personal details we have stored or request corrections to your account record by contacting us.
              </p>
            </div>
            <div>
              <h5 className="font-bold mb-2">India DPDP Act (2023) & Grievance</h5>
              <p className="opacity-70 leading-relaxed">
                For residents of India, your data is processed in accordance with the Digital Personal Data Protection Act. Any data grievances can be submitted to our designated Grievance Officer by opening a ticket in the <a href="https://discord.gg/SDyspbmkKq" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Discord Server</a>.
              </p>
            </div>
          </div>
          <div className="border-t border-on-surface/10 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-mono text-xs opacity-50 uppercase">Contact: <a href="https://discord.gg/SDyspbmkKq" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Discord Support</a></span>
            <span className="font-mono text-xs opacity-50 uppercase">Last Updated: July 19, 2026</span>
          </div>
        </div>
      </section>

      {/* Footer Disclaimer */}
      <div className="mt-32 border-t-4 border-on-surface pt-12">
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface/60 max-w-2xl">
          We operate and secure the platform according to strict industry standards. For any questions regarding your data, reach out to our team.
        </p>
      </div>

    </div>
  );
}
