import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Lock, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  username: z.string().trim().min(1, 'Loginni kiriting'),
  password: z.string().min(1, 'Parolni kiriting'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      await login(v.username, v.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-indigo-50/60 to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">IshHaqqi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ish haqi va avanslarni boshqarish tizimi</p>
        </div>
        <Card className="p-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
            aria-label="Kirish formasi"
          >
            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}
            <FormField id="username" label="Login" error={errors.username?.message}>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                aria-invalid={!!errors.username}
                {...register('username')}
              />
            </FormField>
            <FormField id="password" label="Parol" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-11"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>
            <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Lock />}
              Kirish
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Faqat administrator uchun</p>
      </div>
    </div>
  );
}
