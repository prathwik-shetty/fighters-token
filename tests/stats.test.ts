import { describe, it, expect } from "vitest";
import { calculateSaleStats } from "../src/services/stats";

describe("calculateSaleStats", () => {
  it("calculates percentage booked correctly according to the required formula", () => {
    // Total 80, 10 frozen, 35 member booked, 5 admin assigned, 0 paid
    // Effective = 80 - 10 = 70
    // Total booked + assigned = 40
    // Percentage = (40 / 70) * 100 = 57.14%
    const stats = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1000,
      frozenCount: 10,
      availableCount: 30,
      heldCount: 0,
      memberBookedCount: 35,
      adminAssignedCount: 5,
      paidCount: 0,
      refundsCount: 0,
      refundsAmount: 0,
      thresholdPercentage: 10.0,
    });

    expect(stats.effectiveTokens.value).toBe(70);
    expect(stats.totalBookedAndAssigned.value).toBe(40);
    expect(stats.percentageBooked.percentage).toBe(57.14);
    expect(stats.percentageBooked.formattedPercentage).toBe("57.14%");
    expect(stats.percentageBooked.formula).toBe(
      "percentage_booked = (booked_plus_assigned / (total_live - frozen)) * 100"
    );
  });

  it("checks the 10% threshold correctly", () => {
    // Total 80, 0 frozen -> 80 effective
    // 10% of 80 = 8 required tokens
    // When 7 booked -> threshold not met
    const statsUnder = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1000,
      frozenCount: 0,
      availableCount: 73,
      heldCount: 0,
      memberBookedCount: 7,
      adminAssignedCount: 0,
      paidCount: 0,
      refundsCount: 0,
      refundsAmount: 0,
      thresholdPercentage: 10.0,
    });

    expect(statsUnder.thresholdCheck.requiredTokens).toBe(8);
    expect(statsUnder.thresholdCheck.thresholdMet).toBe(false);
    expect(statsUnder.thresholdCheck.displaySummary).toContain("threshold met: NO");

    // When 8 booked -> threshold met!
    const statsMet = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1000,
      frozenCount: 0,
      availableCount: 72,
      heldCount: 0,
      memberBookedCount: 8,
      adminAssignedCount: 0,
      paidCount: 0,
      refundsCount: 0,
      refundsAmount: 0,
      thresholdPercentage: 10.0,
    });

    expect(statsMet.thresholdCheck.requiredTokens).toBe(8);
    expect(statsMet.thresholdCheck.thresholdMet).toBe(true);
    expect(statsMet.thresholdCheck.displaySummary).toContain("threshold met: YES");
  });

  it("computes revenue expected, collected, and pending accurately", () => {
    const stats = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1500,
      frozenCount: 0,
      availableCount: 60,
      heldCount: 0,
      memberBookedCount: 10,
      adminAssignedCount: 5,
      paidCount: 5, // 20 booked/assigned total
      refundsCount: 1,
      refundsAmount: 1500,
      thresholdPercentage: 10.0,
    });

    // Total booked & assigned = 10 + 5 + 5 = 20 tokens
    // Expected = 20 * 1500 = 30,000
    // Collected = 5 * 1500 = 7,500
    // Pending = 30,000 - 7,500 = 22,500
    expect(stats.revenue.expected.value).toBe(30000);
    expect(stats.revenue.collected.value).toBe(7500);
    expect(stats.revenue.pending.value).toBe(22500);
  });

  it("flags allTokensBooked only when every non-frozen token is accounted for", () => {
    // 80 tokens, 10 frozen -> 70 effective
    // 69 booked -> allTokensBooked = false
    const notAll = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1000,
      frozenCount: 10,
      availableCount: 1,
      heldCount: 0,
      memberBookedCount: 50,
      adminAssignedCount: 19,
      paidCount: 0,
      refundsCount: 0,
      refundsAmount: 0,
    });
    expect(notAll.allTokensBooked).toBe(false);

    // 70 booked -> allTokensBooked = true
    const allBooked = calculateSaleStats({
      totalTokens: 80,
      pricePerToken: 1000,
      frozenCount: 10,
      availableCount: 0,
      heldCount: 0,
      memberBookedCount: 50,
      adminAssignedCount: 20,
      paidCount: 0,
      refundsCount: 0,
      refundsAmount: 0,
    });
    expect(allBooked.allTokensBooked).toBe(true);
    expect(allBooked.percentageBooked.percentage).toBe(100);
  });
});
