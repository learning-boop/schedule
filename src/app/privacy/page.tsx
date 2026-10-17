export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-4">Last updated: October 2026</p>

      <div className="prose prose-sm dark:prose-invert space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>
        <p>
          We collect the information you provide when creating an account: your name, email address,
          and password. When you use the planner, we store your goals, schedule blocks, daily pages,
          weekly/monthly plans, and notes.
        </p>

        <h2 className="text-lg font-semibold mt-6">2. How We Use Your Information</h2>
        <p>
          Your data is used solely to provide the Schedule Planner service. We do not sell your
          personal information to third parties.
        </p>

        <h2 className="text-lg font-semibold mt-6">3. Visibility Within Your Company</h2>
        <p>
          <strong>Schedules are visible to your entire company.</strong> All colleagues in the same
          organisation can view your calendar blocks, Top 3 priorities, done-today log, and hours
          worked. Depending on your company's visibility setting, goals, SWOT analysis, and notes
          may also be visible to colleagues.
        </p>

        <h2 className="text-lg font-semibold mt-6">4. Data Storage and Security</h2>
        <p>
          Your data is stored in a PostgreSQL database hosted by Supabase with encryption at rest
          and in transit. Row-Level Security ensures you can only modify your own data. We use HTTPS
          for all communications.
        </p>

        <h2 className="text-lg font-semibold mt-6">5. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. You may request deletion of all
          your data at any time from your account settings.
        </p>

        <h2 className="text-lg font-semibold mt-6">6. Data Deletion</h2>
        <p>
          You can delete your account and all associated data from the Account Settings page. This
          action is irreversible and removes all goals, schedules, daily pages, weekly plans,
          monthly plans, and exported PDFs. If you are a company founder, you must first remove all
          team members or transfer ownership.
        </p>

        <h2 className="text-lg font-semibold mt-6">7. Cookies</h2>
        <p>
          We use essential cookies for authentication. We do not use tracking or advertising
          cookies.
        </p>

        <h2 className="text-lg font-semibold mt-6">8. Third-Party Services</h2>
        <p>
          We use Supabase (database and authentication), Resend (transactional emails), and Vercel
          (hosting). These services have their own privacy policies.
        </p>

        <h2 className="text-lg font-semibold mt-6">9. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of significant changes via
          email.
        </p>

        <h2 className="text-lg font-semibold mt-6">10. Contact</h2>
        <p>For privacy questions or data deletion requests, email us at privacy@creativetouch.in</p>
      </div>
    </div>
  );
}
