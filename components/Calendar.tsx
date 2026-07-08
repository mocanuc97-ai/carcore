'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, isSameDay } from 'date-fns';

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  clients: { name: string };
  vehicles: { make: string; model: string; license_plate: string };
}

interface CalendarProps {
  appointments: Appointment[];
  onSelectDate?: (date: Date) => void;
  selectedDate?: Date;
}

export default function Calendar({ appointments, onSelectDate, selectedDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month
  const startDay = getDay(monthStart);
  const paddedDays = Array(startDay).fill(null).concat(days);

  const appointmentsByDate = appointments.reduce((acc, appt) => {
    // Local date key for UI calendar grid (date-fns format local); 
    // ICS/scheduled use UTC instants for DTSTART (see appointments exportToICS).
    // DST note: Romania DST (last Sun Mar/Oct) can shift local<->UTC; toISOString in ICS ensures absolute time correct; 
    // UI days use local calendar view to match user expectation. Test: create appt near 02:00 on DST day.
    const date = format(new Date(appt.scheduled_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(appt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="bg-white rounded-2xl p-4 shadow">
      <div className="flex justify-between items-center mb-4">
        <button onClick={handlePrevMonth} className="px-3 py-1 border rounded hover:bg-gray-100">←</button>
        <div>
          <button onClick={() => setCurrentMonth(new Date())} className="px-2 py-1 text-xs border rounded mr-2 hover:bg-gray-100">Today</button>
          <h3 className="text-lg font-semibold inline">{format(currentMonth, 'MMMM yyyy')}</h3>
        </div>
        <button onClick={handleNextMonth} className="px-3 py-1 border rounded hover:bg-gray-100">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, idx) => {
          if (!day) return <div key={idx} className="h-20 border bg-gray-50" />;
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayAppts = appointmentsByDate[dateStr] || [];
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={idx} 
              data-testid="calendar-day"
              data-date={dateStr}
              onClick={() => onSelectDate?.(day)}
              className={`h-20 border p-1 text-xs overflow-hidden cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-100 border-blue-500' : ''} ${isToday ? 'ring-2 ring-green-500' : ''}`}
            >
              <div className={`font-medium ${isToday ? 'text-green-600' : ''}`}>{format(day, 'd')}</div>
              {dayAppts.slice(0, 2).map((a, i) => (
                <div key={i} className="truncate text-[10px] bg-blue-200 rounded px-1 mt-0.5">
                  {a.clients.name} - {a.status}
                </div>
              ))}
              {dayAppts.length > 2 && <div className="text-[10px] text-gray-500">+{dayAppts.length - 2} more</div>}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Click a day to filter list below and open create form. Today highlighted in green. Export ICS for full import to Google/Outlook.
        <button onClick={() => onSelectDate?.(new Date())} className="ml-2 px-2 py-0.5 border text-xs rounded">Create for Today</button>
      </div>
    </div>
  );
}
