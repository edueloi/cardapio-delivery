import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  blockedDates?: string[];
  closedDates?: string[];
  selectedDate?: string | null;
  onDateToggle?: (date: string) => void;
  onDateSelect?: (date: string) => void;
  mode?: 'block' | 'select';
}

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const toIsoDate = (year: number, month: number, day: number) => {
  return [year, String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
};

export const Calendar: React.FC<CalendarProps> = ({
  blockedDates = [],
  closedDates = [],
  selectedDate,
  onDateToggle,
  onDateSelect,
  mode = 'block',
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const blockedDatesSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  const closedDatesSet = useMemo(() => new Set(closedDates), [closedDates]);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();

  const monthLabel = useMemo(() => {
    const label = currentDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            {mode === 'block' ? 'Dias bloqueados' : 'Selecionar data'}
          </p>
          <h3 className="text-sm font-black text-zinc-800">{monthLabel}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-50"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-1 rounded-xl bg-zinc-100 p-1 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
        {WEEK_DAYS.map((day, i) => (
          <div key={i} className="flex h-8 items-center justify-center rounded-lg">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, index) => (
          <div key={'empty-' + index} className="h-10 rounded-xl" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
          const dayNumber = dayIndex + 1;
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
          const dateString = toIsoDate(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
          const isBlocked = blockedDatesSet.has(dateString);
          const isClosed = closedDatesSet.has(dateString);
          const isSelected = selectedDate === dateString;
          const isPast = date < today;
          const isToday = date.getTime() === today.getTime();

          let className = 'h-10 rounded-xl text-sm font-bold transition-all ';

          if (isPast && !isClosed) {
            className += 'text-zinc-300 cursor-default';
          } else if (isClosed) {
            // Dias fechados/feriados — destaque rosado
            className += 'border border-rose-300 bg-rose-100 text-rose-600 cursor-default';
          } else if (mode === 'block' && isBlocked) {
            className += 'border border-zinc-900 bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 cursor-pointer';
          } else if (mode === 'select' && isSelected) {
            className += 'border border-amber-500 bg-amber-500 text-white shadow-sm hover:bg-amber-600 cursor-pointer';
          } else if (isToday) {
            className += 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer';
          } else {
            className += 'border border-transparent bg-white text-zinc-600 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700 cursor-pointer';
          }

          return (
            <button
              key={dateString}
              type="button"
              disabled={isPast && !isClosed}
              onClick={() => {
                if (isClosed) return; // Não permite interagir com dias fechados
                if (mode === 'block') onDateToggle?.(dateString);
                else onDateSelect?.(dateString);
              }}
              className={className}
              title={isClosed ? 'Estúdio fechado' : isBlocked ? 'Dia bloqueado' : 'Dia disponível'}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
        <span>Branco: livre</span>
        {closedDates.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded bg-rose-300" /> Fechado
          </span>
        )}
        {mode === 'block' && <span>Escuro: bloqueado</span>}
      </div>
    </div>
  );
};
