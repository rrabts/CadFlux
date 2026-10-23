import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { SafeUser } from "@/modules/users/types";
import { operationActor, unitContext } from "@/modules/operations/service";
import { serviceDateSchema } from "@/modules/attendances/schema";
import { dateInTimezone, weekStart } from "@/modules/attendances/contracts";

export function indicatorPeriods(now: Date) {
  const today = dateInTimezone(now, "America/Sao_Paulo");
  const start = weekStart(today);
  const end = new Date(start + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  const monthEnd = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  return {
    today,
    week: { from: start, to: end.toISOString().slice(0, 10) },
    month: { from: today.slice(0, 7) + "-01", to: monthEnd.toISOString().slice(0, 10) },
  };
}
const filtersSchema = z
  .object({
    from: serviceDateSchema.optional(),
    to: serviceDateSchema.optional(),
    unitId: z.string().min(1).max(100).optional(),
    ownerUserId: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    duplicatePage: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
type Summary = {
  total: number;
  guidance: number;
  withOpinion: number;
  withoutOpinion: number;
  pending: number;
  cancelled: number;
};
const summaryColumns = Prisma.sql`
  count(*) FILTER (WHERE a."cancelledAt" IS NULL)::int AS total,
  count(*) FILTER (WHERE a."cancelledAt" IS NULL AND a.kind = 'GUIDANCE')::int AS guidance,
  count(*) FILTER (WHERE a."cancelledAt" IS NULL AND a.opinion = 'WITH')::int AS "withOpinion",
  count(*) FILTER (WHERE a."cancelledAt" IS NULL AND a.opinion = 'WITHOUT')::int AS "withoutOpinion",
  count(*) FILTER (WHERE a."cancelledAt" IS NULL AND a.opinion = 'PENDING')::int AS pending,
  count(*) FILTER (WHERE a."cancelledAt" IS NOT NULL)::int AS cancelled`;
export async function indicators(actor: SafeUser, raw: unknown, now = new Date()) {
  const f = filtersSchema.parse(raw);
  const periods = indicatorPeriods(now);
  const from = f.from ?? periods.week.from,
    to = f.to ?? periods.week.to;
  if (from > to) throw new AppError(400, "A data final deve ser igual ou posterior à inicial.");
  return prisma.$transaction(
    async (tx) => {
      const current = await operationActor(tx, actor, "attendances:read");
      const direction = current.accessProfile === "DIRECTION";
      if (!direction && (f.unitId || f.ownerUserId))
        throw new AppError(403, "Filtros de operador e unidade são exclusivos da Direção.");
      const scope = Prisma.sql`TRUE ${!direction ? Prisma.sql`AND a."ownerUserId" = ${current.id}` : Prisma.empty}
      ${direction && f.ownerUserId ? Prisma.sql`AND a."ownerUserId" = ${f.ownerUserId}` : Prisma.empty}
      ${direction && f.unitId ? Prisma.sql`AND a."unitId" = ${f.unitId}` : Prisma.empty}`;
      const date = (lo: string, hi: string) =>
        Prisma.sql`a."serviceDate" >= ${lo}::date AND a."serviceDate" <= ${hi}::date`;
      const selected = Prisma.sql`${scope} AND ${date(from, to)}`;
      async function summary(lo: string, hi: string) {
        const rows = await tx.$queryRaw<Summary[]>(
          Prisma.sql`SELECT ${summaryColumns} FROM "Attendance" a WHERE ${scope} AND ${date(lo, hi)}`,
        );
        return rows[0];
      }
      const [range, today, week, month, duplicates, monthly, kinds, recent] = await Promise.all([
        summary(from, to),
        summary(periods.today, periods.today),
        summary(periods.week.from, periods.week.to),
        summary(periods.month.from, periods.month.to),
        tx.$queryRaw<{ groups: number; records: number }[]>(
          Prisma.sql`SELECT count(*)::int AS groups, coalesce(sum(n),0)::int AS records FROM (SELECT count(*) AS n FROM "Attendance" a WHERE ${selected} AND a."cancelledAt" IS NULL GROUP BY a."ownerUserId", a.cpf, a."serviceDate" HAVING count(*) > 1) d`,
        ),
        tx.$queryRaw<(Summary & { month: string })[]>(
          Prisma.sql`SELECT to_char(a."serviceDate",'YYYY-MM') AS month, ${summaryColumns} FROM "Attendance" a WHERE ${selected} GROUP BY to_char(a."serviceDate",'YYYY-MM') ORDER BY month`,
        ),
        tx.$queryRaw<{ code: string; name: string; total: number }[]>(
          Prisma.sql`SELECT a.kind AS code, t.name, count(*)::int AS total FROM "Attendance" a JOIN "AttendanceType" t ON t.code=a.kind WHERE ${selected} AND a."cancelledAt" IS NULL GROUP BY a.kind,t.name ORDER BY t.name`,
        ),
        tx.attendance.findMany({
          where: {
            ...(!direction ? { ownerUserId: current.id } : {}),
            ...(direction && f.ownerUserId ? { ownerUserId: f.ownerUserId } : {}),
            ...(direction && f.unitId ? { unitId: f.unitId } : {}),
            cancelledAt: null,
            serviceDate: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") },
          },
          orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            name: true,
            serviceDate: true,
            unitName: true,
            kindName: true,
            kind: true,
            opinion: true,
          },
        }),
      ]);
      const duplicateItems = await tx.$queryRaw<
        { id: string; name: string; serviceDate: Date; unitName: string }[]
      >(
        Prisma.sql`SELECT id,name,"serviceDate","unitName" FROM (SELECT a.id,a.name,a."serviceDate",a."unitName",count(*) OVER (PARTITION BY a."ownerUserId",a.cpf,a."serviceDate") AS n FROM "Attendance" a WHERE ${selected} AND a."cancelledAt" IS NULL) d WHERE n>1 ORDER BY "serviceDate" DESC,id DESC LIMIT 50 OFFSET ${(f.duplicatePage - 1) * 50}`,
      );
      const breakdown: {
        unitId: string;
        ownerUserId: string;
        unitName: string;
        operatorName: string;
        total: number;
      }[] = direction
        ? await tx.$queryRaw(
            Prisma.sql`SELECT a."unitId",a."ownerUserId",u.name AS "unitName",o.name AS "operatorName",count(*)::int AS total FROM "Attendance" a JOIN "Unit" u ON u.id=a."unitId" JOIN "User" o ON o.id=a."ownerUserId" WHERE ${selected} AND a."cancelledAt" IS NULL GROUP BY a."unitId",a."ownerUserId",u.name,o.name ORDER BY u.name,o.name,a."unitId",a."ownerUserId" LIMIT 50 OFFSET ${(f.page - 1) * 50}`,
          )
        : [];
      const groups = direction
        ? await tx.$queryRaw<{ total: number }[]>(
            Prisma.sql`SELECT count(*)::int AS total FROM (SELECT 1 FROM "Attendance" a WHERE ${selected} AND a."cancelledAt" IS NULL GROUP BY a."unitId",a."ownerUserId") g`,
          )
        : [{ total: 0 }];
      let unitTotal: { name: string; total: number } | null = null;
      if (!direction) {
        const context = await unitContext(tx, current);
        if (context.selected)
          unitTotal = {
            name: context.selected.name,
            total: await tx.attendance.count({
              where: {
                unitId: context.selected.id,
                cancelledAt: null,
                serviceDate: {
                  gte: new Date(from + "T00:00:00Z"),
                  lte: new Date(to + "T00:00:00Z"),
                },
              },
            }),
          };
      }
      return {
        range,
        today,
        week,
        month,
        periods,
        from,
        to,
        updatedAt: now.toISOString(),
        timezone: "America/Sao_Paulo",
        scope: direction ? "Visão da Direção" : "Meus atendimentos",
        duplicates: duplicates[0],
        duplicateItems,
        duplicatePage: f.duplicatePage,
        monthly,
        kinds,
        recent,
        breakdown,
        breakdownTotal: groups[0].total,
        page: f.page,
        pageSize: 50,
        unitTotal,
        activeUnits: direction ? await tx.unit.count({ where: { active: true } }) : null,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
  );
}
