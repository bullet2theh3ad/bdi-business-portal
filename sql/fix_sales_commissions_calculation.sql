-- Fix Sales Commissions Calculation for All Existing SKU Scenarios
-- Change from % of ASP to % of Net Sales

-- Update all scenarios to recalculate salesCommissionsAmount based on Net Sales
UPDATE sku_financial_scenarios
SET 
    sales_commissions_amount = ROUND(
        (
            -- Net Sales = ASP - FBA Fee - Referral Fee - ACOS - Other Fees
            COALESCE(asp, 0) 
            - COALESCE(fba_fee_amount, 0)
            - COALESCE(amazon_referral_fee_amount, 0)
            - COALESCE(acos_amount, 0)
            - COALESCE(
                (SELECT SUM((item->>'value')::NUMERIC) 
                 FROM jsonb_array_elements(other_fees_and_advertising) AS item
                 WHERE item->>'value' IS NOT NULL), 
                0
            )
        ) * COALESCE(sales_commissions_percent, 0) / 100
    , 2)
WHERE 
    sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent > 0
    AND asp IS NOT NULL;

-- Show summary of changes
SELECT 
    COUNT(*) as total_scenarios_updated,
    ROUND(AVG(sales_commissions_amount), 2) as avg_new_commission_amount
FROM sku_financial_scenarios
WHERE sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent > 0;

-- Show before/after for verification (sample)
SELECT 
    scenario_name,
    sku_name,
    asp,
    fba_fee_amount + amazon_referral_fee_amount + acos_amount as total_fees,
    asp - fba_fee_amount - amazon_referral_fee_amount - acos_amount as net_sales,
    sales_commissions_percent as commission_percent,
    sales_commissions_amount as new_commission_amount,
    ROUND(sales_commissions_amount / (
        asp - fba_fee_amount - amazon_referral_fee_amount - acos_amount
    ) * 100, 2) as verified_percent
FROM sku_financial_scenarios
WHERE sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent > 0
    AND asp IS NOT NULL
LIMIT 10;

