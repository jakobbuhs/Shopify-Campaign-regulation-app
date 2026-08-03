import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock functions so the module-level `new PrismaClient()` and
// `new GraphQLClient()` instances created inside src/compliance.ts resolve to
// controllable spies. `vi.hoisted` guarantees they exist before vi.mock runs.
const { groupByMock, requestMock } = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  requestMock: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    priceHistory: { groupBy: groupByMock },
  })),
}));

vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn(() => ({ request: requestMock })),
  // Passthrough tag: the mocked client ignores the query text anyway.
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({ raw: strings }, ...values),
}));

// Imported after the mocks are registered.
import { validateVariantsForCampaign } from '../src/compliance';

// Prisma returns Decimal objects; the code only calls `.toString()` on them.
const decimal = (value: string | number) => ({ toString: () => String(value) });

const START = new Date('2026-02-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  groupByMock.mockReset();
  requestMock.mockReset();
});

describe('validateVariantsForCampaign', () => {
  it('returns no violations for an empty variant list without touching the DB', async () => {
    const result = await validateVariantsForCampaign([], START);
    expect(result).toEqual([]);
    expect(groupByMock).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('queries the 30-day window BEFORE the campaign start', async () => {
    groupByMock.mockResolvedValue([]);
    requestMock.mockResolvedValue({ productVariant: { id: 'v1', price: '100.00' } });

    await validateVariantsForCampaign(['v1'], START);

    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['variantId'],
        where: expect.objectContaining({
          variantId: { in: ['v1'] },
          changedAt: { gte: new Date(START.getTime() - 30 * DAY_MS), lt: START },
        }),
        _min: { price: true },
      })
    );
  });

  it('flags NO_HISTORY when a variant has no price history in the window', async () => {
    groupByMock.mockResolvedValue([]); // nothing recorded for this variant
    requestMock.mockResolvedValue({ productVariant: { id: 'v-no-history', price: '100.00' } });

    const result = await validateVariantsForCampaign(['v-no-history'], START);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      variantId: 'v-no-history',
      reason: 'NO_HISTORY',
      currentPrice: 100,
      minPriceLast30: null,
    });
  });

  it('flags COMPARE_ABOVE_30D_LOW when the current price exceeds the 30-day low', async () => {
    groupByMock.mockResolvedValue([
      { variantId: 'v-above', _min: { price: decimal('80.00') } },
    ]);
    requestMock.mockResolvedValue({ productVariant: { id: 'v-above', price: '100.00' } });

    const result = await validateVariantsForCampaign(['v-above'], START);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      variantId: 'v-above',
      reason: 'COMPARE_ABOVE_30D_LOW',
      currentPrice: 100,
      minPriceLast30: 80,
    });
  });

  it('passes when the current price is below the 30-day low', async () => {
    groupByMock.mockResolvedValue([
      { variantId: 'v-ok', _min: { price: decimal('100.00') } },
    ]);
    requestMock.mockResolvedValue({ productVariant: { id: 'v-ok', price: '90.00' } });

    const result = await validateVariantsForCampaign(['v-ok'], START);

    expect(result).toEqual([]);
  });

  it('passes when the current price equals the 30-day low (boundary is inclusive)', async () => {
    groupByMock.mockResolvedValue([
      { variantId: 'v-equal', _min: { price: decimal('50.00') } },
    ]);
    requestMock.mockResolvedValue({ productVariant: { id: 'v-equal', price: '50.00' } });

    const result = await validateVariantsForCampaign(['v-equal'], START);

    expect(result).toEqual([]);
  });
});
