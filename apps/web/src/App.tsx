import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RequireAuth, RedirectIfAuthed } from './components/guards/RequireAuth.js';
import { Shell } from './components/layout/Shell.js';
import { applyDirection } from './i18n/index.js';
import { AuthPage } from './pages/AuthPage.js';
import { DailyPage } from './pages/DailyPage.js';
import { FaqPage } from './pages/FaqPage.js';
import { LandingPage } from './pages/LandingPage.js';
import { NotFoundPage, AboutPage, ContactPage, PrivacyPage } from './pages/StaticPages.js';
import { OfferPage } from './pages/OfferPage.js';
import { RecordsPage } from './pages/RecordsPage.js';
import { ReferralPage } from './pages/ReferralPage.js';
import { TaskCenterPage } from './pages/TaskCenterPage.js';
import { UserPage } from './pages/UserPage.js';
import { VideoPage } from './pages/VideoPage.js';
import { WithdrawPage } from './pages/WithdrawPage.js';

export function App() {
  const { i18n } = useTranslation();

  // Keep <html dir/lang> in sync with the active locale (RTL support).
  useEffect(() => {
    applyDirection(i18n.resolvedLanguage ?? 'en');
  }, [i18n.resolvedLanguage]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />

      {/* Signed-in experience: shared shell (top bar, drawer, bottom tabs). */}
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route path="/user" element={<UserPage />} />
          <Route path="/task" element={<TaskCenterPage />} />
          <Route path="/video" element={<VideoPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/partners" element={<ReferralPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/record" element={<RecordsPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
      </Route>

      {/* Stand-in for a third-party offer page (see pages/OfferPage.tsx). */}
      <Route path="/offer/:slug" element={<OfferPage />} />

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
