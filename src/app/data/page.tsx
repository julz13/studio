'use client';

import { Header } from '@/components/header';
import { DataManager } from '@/components/data-manager';

export default function DataPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-semibold tracking-tight">
              Data Management
            </h1>
            <p className="text-muted-foreground">
              Import and export your financial records.
            </p>
          </div>
        </div>
        <DataManager />
      </main>
    </div>
  );
}
