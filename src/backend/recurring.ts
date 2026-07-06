// Lógica de recorrências financeiras (água, luz, aluguel, sistema, etc).
// Sem cron real disponível no projeto — a geração é "lazy": sempre que o
// usuário abre/consulta a tela de Entradas e Saídas, geramos (de forma
// idempotente) os lançamentos de todos os meses ainda não gerados até hoje
// para cada RecurringEntry ativa.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prisma = any;

export interface RecurringEntryLike {
  id: string;
  tenantId: string;
  type: string;
  category: string;
  description: string;
  frequency: string; // FIXED | VARIABLE
  amount: number | null;
  dueDay: number;
  startDate: Date;
  endDate: Date | null;
  installmentsTotal: number | null;
  lateFeeEnabled: boolean;
  lateFeeRate: number | null;
  lateFeeInterval: string | null; // DAILY | MONTHLY | YEARLY
  active: boolean;
  lastGeneratedFor: string | null;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function clampDueDay(day: number, year: number, month: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDayOfMonth);
}

// Lista de meses (year, month 0-based) entre o início da recorrência e hoje,
// que ainda não foram gerados (a partir de lastGeneratedFor, exclusive).
function pendingMonths(entry: RecurringEntryLike, today: Date): Array<{ year: number; month: number }> {
  const start = new Date(entry.startDate);
  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth();

  if (entry.lastGeneratedFor) {
    const [y, m] = entry.lastGeneratedFor.split("-").map(Number);
    cursorYear = m === 12 ? y + 1 : y;
    cursorMonth = m === 12 ? 0 : m; // m é 1-based no lastGeneratedFor
  }

  const months: Array<{ year: number; month: number }> = [];
  const limit = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = entry.endDate ? new Date(entry.endDate) : null;

  while (true) {
    const cursor = new Date(cursorYear, cursorMonth, 1);
    if (cursor > limit) break;
    if (end && cursor > new Date(end.getFullYear(), end.getMonth(), 1)) break;
    months.push({ year: cursorYear, month: cursorMonth });
    cursorMonth++;
    if (cursorMonth > 11) { cursorMonth = 0; cursorYear++; }
    if (months.length > 600) break; // guarda-corpo contra loop infinito
  }
  return months;
}

// Quantas parcelas já foram geradas para esta recorrência (para respeitar installmentsTotal)
async function countGeneratedInstallments(prisma: Prisma, recurringEntryId: string): Promise<number> {
  return prisma.financialEntry.count({ where: { recurringEntryId } });
}

export function calculateLateFee(
  baseAmount: number,
  dueDate: Date,
  asOf: Date,
  rate: number,
  interval: string
): number {
  if (asOf <= dueDate) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.floor((asOf.getTime() - dueDate.getTime()) / msPerDay);
  if (daysLate <= 0) return 0;

  if (interval === "DAILY") {
    return parseFloat((baseAmount * (rate / 100) * daysLate).toFixed(2));
  }
  if (interval === "YEARLY") {
    const yearsLate = daysLate / 365;
    return parseFloat((baseAmount * (rate / 100) * yearsLate).toFixed(2));
  }
  // MONTHLY (padrão) — conta meses de atraso iniciados (30 dias corridos por mês)
  const monthsLate = Math.ceil(daysLate / 30);
  return parseFloat((baseAmount * (rate / 100) * monthsLate).toFixed(2));
}

// Gera os lançamentos pendentes de uma recorrência até o mês atual (idempotente).
export async function generateDueEntries(prisma: Prisma, entry: RecurringEntryLike, today: Date = new Date()): Promise<number> {
  if (!entry.active) return 0;

  const months = pendingMonths(entry, today);
  if (!months.length) return 0;

  let generated = 0;
  let lastFor = entry.lastGeneratedFor;
  let installmentsSoFar = entry.installmentsTotal ? await countGeneratedInstallments(prisma, entry.id) : 0;

  for (const { year, month } of months) {
    if (entry.installmentsTotal && installmentsSoFar >= entry.installmentsTotal) break;

    const dueDay = clampDueDay(entry.dueDay, year, month);
    const dueDate = new Date(year, month, dueDay);
    const isFixed = entry.frequency === "FIXED";
    const installmentNumber = entry.installmentsTotal ? installmentsSoFar + 1 : null;

    await prisma.financialEntry.create({
      data: {
        tenantId: entry.tenantId,
        type: entry.type,
        category: entry.category,
        description: entry.installmentsTotal
          ? `${entry.description} (${installmentNumber}/${entry.installmentsTotal})`
          : entry.description,
        amount: isFixed ? (entry.amount ?? 0) : 0,
        date: dueDate,
        dueDate,
        status: isFixed ? "PAID" : "PENDING",
        paidAt: isFixed ? dueDate : null,
        source: "RECURRING",
        recurringEntryId: entry.id,
        installmentNumber,
        installmentsTotal: entry.installmentsTotal,
        baseAmount: isFixed ? (entry.amount ?? 0) : null,
      },
    });

    generated++;
    if (entry.installmentsTotal) installmentsSoFar++;
    lastFor = monthKey(year, month);
  }

  if (lastFor && lastFor !== entry.lastGeneratedFor) {
    await prisma.recurringEntry.update({
      where: { id: entry.id },
      data: { lastGeneratedFor: lastFor },
    });
  }

  return generated;
}

// Roda a geração lazy para todas as recorrências ativas de um tenant.
export async function runLazyGeneration(prisma: Prisma, tenantId: string, today: Date = new Date()): Promise<number> {
  const entries: RecurringEntryLike[] = await prisma.recurringEntry.findMany({
    where: { tenantId, active: true },
  });
  let total = 0;
  for (const entry of entries) {
    total += await generateDueEntries(prisma, entry, today);
  }
  return total;
}

// Recalcula e aplica juros de atraso em lançamentos VARIABLE/PENDING ainda não pagos
// e cujo dueDate já passou. Só se aplica quando a recorrência tem lateFeeEnabled.
export async function applyLateFees(prisma: Prisma, tenantId: string, today: Date = new Date()): Promise<number> {
  const overdue = await prisma.financialEntry.findMany({
    where: {
      tenantId,
      status: "PENDING",
      dueDate: { lt: today },
      recurringEntryId: { not: null },
    },
    include: { recurringEntry: true },
  });

  let updated = 0;
  for (const fe of overdue) {
    const rec = fe.recurringEntry;
    if (!rec || !rec.lateFeeEnabled || !rec.lateFeeRate || !fe.dueDate) continue;
    const base = fe.baseAmount ?? fe.amount ?? 0;
    if (!base) continue; // valor ainda não preenchido (variável) — nada a calcular ainda

    const fee = calculateLateFee(base, new Date(fe.dueDate), today, rec.lateFeeRate, rec.lateFeeInterval || "MONTHLY");
    if (fee !== (fe.lateFeeApplied ?? 0)) {
      await prisma.financialEntry.update({
        where: { id: fe.id },
        data: { lateFeeApplied: fee, amount: base + fee },
      });
      updated++;
    }
  }
  return updated;
}
