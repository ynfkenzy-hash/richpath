import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { LoginInput, RegisterInput } from '@richpath/shared';
import { ApiRequestError } from '../lib/api.js';
import { useAuth } from '../features/auth/AuthProvider.js';
import { Alert, Button, Card, Field, cx } from '../components/ui/index.js';
import { Logo } from '../components/layout/Logo.js';

/**
 * Sign in / sign up in one route, mirroring the reference UX where both flows
 * live behind a single entry point. Registration accepts an invite code.
 *
 * NOTE: neither form uses `watch`-based validation tricks; every rule is
 * duplicated in packages/shared and enforced again on the server.
 */

interface RegisterForm extends Omit<RegisterInput, 'acceptTerms' | 'locale'> {
  acceptTerms: boolean;
}

export function AuthPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'register' ? 'register' : 'login';
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { login, register } = useAuth();

  const referralFromLink = params.get('ref') ?? '';

  const loginForm = useForm<LoginInput>({ defaultValues: { email: '', password: '' } });
  const registerForm = useForm<RegisterForm>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      referralCode: referralFromLink,
      acceptTerms: false,
    },
  });

  const applyFieldErrors = (err: unknown, setError: (name: any, error: { message: string }) => void) => {
    if (err instanceof ApiRequestError) {
      setFormError(err.details ? null : err.message);
      if (err.details) {
        for (const [field, messages] of Object.entries(err.details)) {
          if (messages?.[0]) setError(field, { message: messages[0] });
        }
      }
    } else {
      setFormError(t('errors.generic'));
    }
  };

  const onLogin = loginForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate(location.state?.from ?? '/user', { replace: true });
    } catch (err) {
      applyFieldErrors(err, loginForm.setError as any);
    }
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await register({
        ...values,
        referralCode: values.referralCode?.trim() || '',
        locale: (i18n.resolvedLanguage ?? 'en') as RegisterInput['locale'],
        acceptTerms: true,
      } as RegisterInput);
      navigate('/user', { replace: true });
    } catch (err) {
      applyFieldErrors(err, registerForm.setError as any);
    }
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-900 px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2">
        <Logo className="h-9 w-9" />
        <span className="text-xl font-extrabold tracking-tight">
          Rich<span className="text-brand-400">Path</span>
        </span>
      </Link>

      <Card className="w-full max-w-md">
        <div role="tablist" aria-label="Authentication" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-700/70 p-1">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={mode === tab}
              onClick={() => {
                setFormError(null);
                setParams(tab === 'register' ? { mode: 'register', ...(referralFromLink ? { ref: referralFromLink } : {}) } : {});
              }}
              className={cx(
                'rounded-lg py-2 text-sm font-semibold transition',
                mode === tab ? 'bg-brand-500 text-ink-900' : 'text-slate-300 hover:bg-white/5',
              )}
            >
              {tab === 'login' ? t('common.signIn') : t('common.signUp')}
            </button>
          ))}
        </div>

        {formError && (
          <div className="mb-4">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={onLogin} className="space-y-4" noValidate>
            <h1 className="text-lg font-bold">{t('auth.welcomeBack')}</h1>
            <p className="-mt-2 text-sm text-slate-400">{t('auth.signInSubtitle')}</p>

            <Field
              label={t('common.email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              {...loginForm.register('email', { required: t('common.required') })}
              error={loginForm.formState.errors.email?.message}
            />
            <Field
              label={t('common.password')}
              type="password"
              autoComplete="current-password"
              {...loginForm.register('password', { required: t('common.required') })}
              error={loginForm.formState.errors.password?.message}
            />
            <Button type="submit" block size="lg" loading={loginForm.formState.isSubmitting}>
              {loginForm.formState.isSubmitting ? t('auth.signingIn') : t('common.signIn')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onRegister} className="space-y-4" noValidate>
            <h1 className="text-lg font-bold">{t('auth.createAccount')}</h1>
            <p className="-mt-2 text-sm text-slate-400">{t('auth.signUpSubtitle')}</p>

            <Field
              label={t('common.name')}
              autoComplete="name"
              {...registerForm.register('name', {
                required: t('common.required'),
                minLength: { value: 2, message: t('common.required') },
              })}
              error={registerForm.formState.errors.name?.message}
            />
            <Field
              label={t('common.email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              {...registerForm.register('email', { required: t('common.required') })}
              error={registerForm.formState.errors.email?.message}
            />
            <Field
              label={t('common.password')}
              type="password"
              autoComplete="new-password"
              hint={t('auth.passwordHint')}
              {...registerForm.register('password', {
                required: t('common.required'),
                minLength: { value: 8, message: t('auth.passwordHint') },
                pattern: { value: /(?=.*[a-zA-Z])(?=.*[0-9])/, message: t('auth.passwordHint') },
              })}
              error={registerForm.formState.errors.password?.message}
            />
            <Field
              label={t('auth.referralCode')}
              hint={t('auth.referralHint')}
              autoCapitalize="characters"
              {...registerForm.register('referralCode')}
              error={registerForm.formState.errors.referralCode?.message}
            />

            <label className="flex items-start gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-white/20 bg-ink-700"
                {...registerForm.register('acceptTerms', { required: t('common.required') })}
              />
              <span>
                {t('auth.acceptTerms')}{' '}
                <Link to="/privacy" className="text-brand-400 underline">
                  ↗
                </Link>
              </span>
            </label>
            {registerForm.formState.errors.acceptTerms && (
              <p className="text-xs text-red-300">{registerForm.formState.errors.acceptTerms.message}</p>
            )}

            <Button type="submit" block size="lg" loading={registerForm.formState.isSubmitting}>
              {t('common.signUp')}
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-4 max-w-md text-center text-xs text-slate-500">
        Demo build — do not reuse a real password. Data lives in a local SQLite file you own.
      </p>
      <Link to="/" className="mt-3 text-sm text-brand-400 hover:underline">
        ← {t('common.back')}
      </Link>
    </div>
  );
}

