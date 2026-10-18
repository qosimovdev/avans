import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/form-field';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TIMEZONE } from '@/lib/format';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Joriy parolni kiriting'),
    newPassword: z.string().min(8, 'Parol kamida 8 belgidan iborat boʻlishi kerak').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'Parollar mos kelmadi', path: ['confirm'] });
type Values = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user, setCsrf } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const m = useMutation({
    mutationFn: (v: Values) =>
      api.put<{ csrfToken: string }>('/auth/password', {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    onSuccess: (d) => {
      setCsrf(d.csrfToken);
      reset();
      toast.success('Parol muvaffaqiyatli oʻzgartirildi');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields?.currentPassword)
        setError('currentPassword', { message: e.fields.currentPassword });
      toast.error(e.message);
    },
  });

  return (
    <div>
      <PageHeader title="Sozlamalar" description="Hisob va tizim sozlamalari" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Parolni oʻzgartirish</CardTitle>
            <CardDescription>Administrator: {user?.username}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4" noValidate>
              <FormField id="currentPassword" label="Joriy parol" error={errors.currentPassword?.message}>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...register('currentPassword')}
                />
              </FormField>
              <FormField id="newPassword" label="Yangi parol" error={errors.newPassword?.message}>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
              </FormField>
              <FormField id="confirm" label="Yangi parolni takrorlang" error={errors.confirm?.message}>
                <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
              </FormField>
              <Button type="submit" className="justify-self-start" disabled={m.isPending}>
                {m.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Parolni saqlash
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hisoblash qoidalari</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              <b>Qolgan ish haqi</b> = shu oy uchun amal qiluvchi oylik maosh − shu oyda berilgan avanslar
              jami. Natija manfiy boʻlishi mumkin (avans maoshdan oshib ketgan holat).
            </p>
            <p>
              <b>Maosh oʻzgarishi</b> har doim tanlangan oyning 1-sanasidan boshlab butun oy uchun amal
              qiladi. Oldingi oylar hisobotlari eski maosh bilan saqlanib qoladi.
            </p>
            <p>
              <b>Nofaol xodimlar</b> oʻchirilmaydi — ularning barcha maosh va avans tarixi saqlanadi.
            </p>
            <p>
              Valyuta: Oʻzbek soʻmi (UZS). Vaqt mintaqasi: <b>{TIMEZONE}</b>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
