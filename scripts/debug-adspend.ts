import 'dotenv/config';
import { db } from '../lib/db/drizzle';
import { amazonFinancialSummaries } from '../lib/db/schema';
import { asc } from 'drizzle-orm';

async function main() {
  const rows = await db
    .select()
    .from(amazonFinancialSummaries)
    .orderBy(asc(amazonFinancialSummaries.dateRangeStart));

  console.log('summary rows', rows.length);
  const parsed = rows.map(r => ({
    ...r,
    start: new Date(r.dateRangeStart as any),
    end: new Date(r.dateRangeEnd as any),
    ad: Number(r.totalAdSpend || 0),
  }));

  const overlaps: any[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    if (curr.start <= prev.end) {
      overlaps.push({
        prevStart: prev.start.toISOString().slice(0, 10),
        prevEnd: prev.end.toISOString().slice(0, 10),
        currStart: curr.start.toISOString().slice(0, 10),
        currEnd: curr.end.toISOString().slice(0, 10),
      });
    }
  }

  console.log('overlapping adjacent ranges', overlaps.length);
  console.log('first overlaps', overlaps.slice(0, 10));

  const totalAdSpend = parsed.reduce((sum, r) => sum + r.ad, 0);
  console.log('sum totalAdSpend across summaries', totalAdSpend.toFixed(2));

  const rangeStart = parsed[0]?.start;
  const rangeEnd = parsed[parsed.length - 1]?.end;
  console.log('overall range', rangeStart?.toISOString(), rangeEnd?.toISOString());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
