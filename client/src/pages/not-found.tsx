import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <p className="text-lg font-medium">Sahifa topilmadi</p>
      <Button asChild>
        <Link to="/">Bosh sahifaga qaytish</Link>
      </Button>
    </div>
  );
}
