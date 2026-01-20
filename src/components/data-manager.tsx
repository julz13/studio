'use client';

import { useState } from 'react';
import { useRecord } from '@/context/record-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download as DownloadIcon } from 'lucide-react';
import type { DailyRecord } from '@/lib/types';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function DataManager() {
  const { importRecords } = useRecord();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const handleJsonExport = async () => {
    if (!user) {
       toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'You must be logged in to export data.',
      });
      return;
    }
    if (!startDate || !endDate) {
      toast({
        variant: 'destructive',
        title: 'Date Range Required',
        description: 'Please select a start and end date for the export.',
      });
      return;
    }
    
    if (startDate > endDate) {
       toast({
        variant: 'destructive',
        title: 'Invalid Date Range',
        description: 'The start date cannot be after the end date.',
      });
      return;
    }

    const recordsToExport: { [date: string]: DailyRecord } = {};
    
    const recordsRef = collection(firestore, 'users', user.uid, 'records');
    const q = query(
      recordsRef,
      where('date', '>=', format(startDate, 'yyyy-MM-dd')),
      where('date', '<=', format(endDate, 'yyyy-MM-dd'))
    );

    try {
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        recordsToExport[doc.id] = doc.data() as DailyRecord;
      });

      if (Object.keys(recordsToExport).length === 0) {
        toast({
          title: 'No Data Found',
          description: 'There is no data in the selected date range to export.',
        });
        return;
      }

      const jsonString = JSON.stringify(recordsToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financeflow-backup-${format(
        startDate,
        'yyyy-MM-dd'
      )}-to-${format(endDate, 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed: ", error);
       toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not fetch records from the database. Please check your connection and permissions.',
      });
    }
  };

  const handleJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File is not readable');
        }
        const importedData = JSON.parse(text);
        // Basic validation
        if (typeof importedData !== 'object' || importedData === null) {
            throw new Error('Invalid JSON format');
        }
        importRecords(importedData);
        toast({
          title: 'Import Successful',
          description: 'Your data has been submitted for import.',
        });
        // Reset the file input so the same file can be uploaded again if needed
        event.target.value = '';
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description:
            'The selected file is not a valid JSON backup file. Please check the file and try again.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">Export Data</h3>
          <p className="text-sm text-muted-foreground">
            Select a date range to export your financial records as a JSON file.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : <span>Start date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : <span>End date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={handleJsonExport} className="w-full sm:w-auto">
              <DownloadIcon className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">Import Data</h3>
          <p className="text-sm text-muted-foreground">
            Upload a JSON backup file. This will merge the imported records
            with your existing data in the database.
          </p>
          <div className="flex items-center gap-4">
             <Label htmlFor="import-file" className="sr-only">Import File</Label>
             <Input id="import-file" type="file" accept=".json" onChange={handleJsonImport} className="flex-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
