import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-3xl font-semibold tracking-tight">Reports</h1>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Coming Soon!</CardTitle>
                <CardDescription>The reports page is under construction. Check back later for insightful financial reports.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    <p>No reports available yet.</p>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
