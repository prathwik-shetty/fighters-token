export interface RawSaleStatsData {
  totalTokens: number;
  pricePerToken: number;
  frozenCount: number;
  availableCount: number;
  heldCount: number;
  memberBookedCount: number; // booked by member, not yet paid
  adminAssignedCount: number;
  paidCount: number; // member or assigned paid
  refundsCount: number;
  refundsAmount: number;
  thresholdPercentage?: number; // default 10.0
}

export interface StatMetric {
  value: number;
  formattedValue: string;
  formula: string;
  explanation: string;
}

export interface CalculatedSaleStats {
  totalLiveTokens: StatMetric;
  frozenCount: StatMetric;
  availableCount: StatMetric;
  heldCount: StatMetric;
  memberBookedCount: StatMetric;
  adminAssignedCount: StatMetric;
  totalBookedAndAssigned: StatMetric;
  paidCount: StatMetric;
  unpaidCount: StatMetric;
  effectiveTokens: StatMetric; // totalLive - frozen
  percentageBooked: {
    percentage: number;
    formattedPercentage: string;
    formula: string;
    calculationSteps: string;
  };
  thresholdCheck: {
    thresholdPercentage: number;
    requiredTokens: number;
    currentBookedCount: number;
    currentPercentage: number;
    thresholdMet: boolean;
    displaySummary: string;
    formula: string;
  };
  revenue: {
    expected: StatMetric;
    collected: StatMetric;
    pending: StatMetric;
  };
  refunds: {
    count: StatMetric;
    amount: StatMetric;
  };
  allTokensBooked: boolean;
}

/**
 * Calculates all sale statistics transparently with exact mathematical formulas and explanations.
 */
export function calculateSaleStats(data: RawSaleStatsData): CalculatedSaleStats {
  const {
    totalTokens,
    pricePerToken,
    frozenCount,
    availableCount,
    heldCount,
    memberBookedCount,
    adminAssignedCount,
    paidCount,
    refundsCount,
    refundsAmount,
    thresholdPercentage = 10.0,
  } = data;

  const effectiveTokens = Math.max(0, totalTokens - frozenCount);
  const totalBookedAndAssigned = memberBookedCount + adminAssignedCount + paidCount;
  const unpaidCount = memberBookedCount;

  // Percentage booked formula:
  // booked_plus_assigned / (total_live − frozen) * 100
  let percentage = 0;
  if (effectiveTokens > 0) {
    percentage = (totalBookedAndAssigned / effectiveTokens) * 100;
    // Clamp to 100 max
    percentage = Math.min(100, Math.max(0, percentage));
  }

  // 10% threshold calculation:
  // Required = ceil((thresholdPercentage / 100) * effectiveTokens)
  const requiredTokens = Math.ceil((thresholdPercentage / 100) * effectiveTokens);
  const thresholdMet = totalBookedAndAssigned >= requiredTokens;

  // Revenue formulas:
  // Revenue expected = (memberBookedCount + adminAssignedCount + paidCount) * price
  // Revenue collected = paidCount * price - refundsAmount
  // Revenue pending = expected - collected
  const revenueExpected = totalBookedAndAssigned * pricePerToken;
  const revenueCollected = paidCount * pricePerToken;
  const revenuePending = Math.max(0, revenueExpected - revenueCollected);

  // All tokens booked condition:
  // Every non-frozen token is either memberBooked, adminAssigned, or paid
  const allTokensBooked = effectiveTokens > 0 && totalBookedAndAssigned >= effectiveTokens;

  return {
    totalLiveTokens: {
      value: totalTokens,
      formattedValue: totalTokens.toString(),
      formula: "N = total live tokens in sale grid",
      explanation: "Total tokens currently configured in the campaign grid (1 to N).",
    },
    frozenCount: {
      value: frozenCount,
      formattedValue: frozenCount.toString(),
      formula: "Count of tokens with status = FROZEN",
      explanation: "Blocked tokens excluded from booking, counts, and random assignment.",
    },
    availableCount: {
      value: availableCount,
      formattedValue: availableCount.toString(),
      formula: "Count of tokens with status = AVAILABLE",
      explanation: "Tokens completely free for members to hold and book.",
    },
    heldCount: {
      value: heldCount,
      formattedValue: heldCount.toString(),
      formula: "Count of tokens with status = HELD and holdExpiresAt > now()",
      explanation: "Tokens currently in members' carts under the active 180s countdown.",
    },
    memberBookedCount: {
      value: memberBookedCount,
      formattedValue: memberBookedCount.toString(),
      formula: "Count of tokens booked by members with payment pending",
      explanation: "Tokens reserved by members awaiting payment window opening.",
    },
    adminAssignedCount: {
      value: adminAssignedCount,
      formattedValue: adminAssignedCount.toString(),
      formula: "Count of tokens with isAdminAssigned = true",
      explanation: "Tokens manually or automatically allocated to designated recipients.",
    },
    totalBookedAndAssigned: {
      value: totalBookedAndAssigned,
      formattedValue: totalBookedAndAssigned.toString(),
      formula: "memberBookedCount + adminAssignedCount + paidCount",
      explanation: "Total occupied tokens out of effective live tokens.",
    },
    paidCount: {
      value: paidCount,
      formattedValue: paidCount.toString(),
      formula: "Count of tokens with status = PAID",
      explanation: "Tokens with successfully verified Razorpay payments.",
    },
    unpaidCount: {
      value: unpaidCount,
      formattedValue: unpaidCount.toString(),
      formula: "Total booked tokens pending payment",
      explanation: "Tokens that require payment once the payment window opens.",
    },
    effectiveTokens: {
      value: effectiveTokens,
      formattedValue: effectiveTokens.toString(),
      formula: "total_live - frozen",
      explanation: "Bookable capacity excluding admin-frozen tokens.",
    },
    percentageBooked: {
      percentage: Number(percentage.toFixed(2)),
      formattedPercentage: `${percentage.toFixed(2)}%`,
      formula: "percentage_booked = (booked_plus_assigned / (total_live - frozen)) * 100",
      calculationSteps: `(${totalBookedAndAssigned} / (${totalTokens} - ${frozenCount})) * 100 = (${totalBookedAndAssigned} / ${effectiveTokens}) * 100 = ${percentage.toFixed(2)}%`,
    },
    thresholdCheck: {
      thresholdPercentage,
      requiredTokens,
      currentBookedCount: totalBookedAndAssigned,
      currentPercentage: Number(percentage.toFixed(2)),
      thresholdMet,
      displaySummary: `${thresholdPercentage}% of ${effectiveTokens} = ${requiredTokens} tokens required; currently ${totalBookedAndAssigned} booked (${percentage.toFixed(1)}%); threshold met: ${thresholdMet ? "YES" : "NO"}`,
      formula: `ceil((${thresholdPercentage} / 100) * effective_tokens) = ${requiredTokens}`,
    },
    revenue: {
      expected: {
        value: revenueExpected,
        formattedValue: `₹${revenueExpected.toLocaleString("en-IN")}`,
        formula: "total_booked_and_assigned * price_per_token",
        explanation: `${totalBookedAndAssigned} tokens × ₹${pricePerToken.toLocaleString("en-IN")}`,
      },
      collected: {
        value: revenueCollected,
        formattedValue: `₹${revenueCollected.toLocaleString("en-IN")}`,
        formula: "paid_tokens * price_per_token",
        explanation: `${paidCount} tokens × ₹${pricePerToken.toLocaleString("en-IN")}`,
      },
      pending: {
        value: revenuePending,
        formattedValue: `₹${revenuePending.toLocaleString("en-IN")}`,
        formula: "revenue_expected - revenue_collected",
        explanation: `₹${revenueExpected.toLocaleString("en-IN")} - ₹${revenueCollected.toLocaleString("en-IN")}`,
      },
    },
    refunds: {
      count: {
        value: refundsCount,
        formattedValue: refundsCount.toString(),
        formula: "Count of processed refunds",
        explanation: "Total refunds issued to members.",
      },
      amount: {
        value: refundsAmount,
        formattedValue: `₹${refundsAmount.toLocaleString("en-IN")}`,
        formula: "Sum of refund amounts",
        explanation: "Total funds returned via Razorpay refund API.",
      },
    },
    allTokensBooked,
  };
}
