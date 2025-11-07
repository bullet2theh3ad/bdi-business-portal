-- Fix Sales Commissions Calculation for All Existing SKU Scenarios
-- Change from % of ASP to % of Net Sales

-- Update all scenarios to recalculate salesCommissionsAmount based on Net Sales
UPDATE sku_financial_scenarios
SET 
    sales_commissions_amount = ROUND(
        (
            -- Net Sales = ASP - FBA Fee - Referral Fee - ACOS - Other Fees
            CAST(asp AS NUMERIC) 
            - COALESCE(CAST(fba_fee_amount AS NUMERIC), 0)
            - COALESCE(CAST(amazon_referral_fee_amount AS NUMERIC), 0)
            - COALESCE(CAST(acos_amount AS NUMERIC), 0)
            - COALESCE(
                (SELECT SUM(CAST(value AS NUMERIC)) 
                 FROM jsonb_array_elements(other_fees_and_advertising) AS item
                 WHERE item->>'value' IS NOT NULL), 
                0
            )
        ) * COALESCE(CAST(sales_commissions_percent AS NUMERIC), 0) / 100
    , 2)::TEXT
WHERE 
    sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent != '0'
    AND asp IS NOT NULL;

-- Show summary of changes
SELECT 
    COUNT(*) as total_scenarios_updated,
    AVG(CAST(sales_commissions_amount AS NUMERIC)) as avg_new_commission_amount
FROM sku_financial_scenarios
WHERE sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent != '0';

-- Show before/after for verification (sample)
SELECT 
    scenario_name,
    sku_name,
    CAST(asp AS NUMERIC) as asp,
    CAST(fba_fee_amount AS NUMERIC) + CAST(amazon_referral_fee_amount AS NUMERIC) + CAST(acos_amount AS NUMERIC) as total_fees,
    CAST(asp AS NUMERIC) - CAST(fba_fee_amount AS NUMERIC) - CAST(amazon_referral_fee_amount AS NUMERIC) - CAST(acos_amount AS NUMERIC) as net_sales,
    CAST(sales_commissions_percent AS NUMERIC) as commission_percent,
    CAST(sales_commissions_amount AS NUMERIC) as new_commission_amount,
    ROUND(CAST(sales_commissions_amount AS NUMERIC) / (
        CAST(asp AS NUMERIC) - CAST(fba_fee_amount AS NUMERIC) - CAST(amazon_referral_fee_amount AS NUMERIC) - CAST(acos_amount AS NUMERIC)
    ) * 100, 2) as verified_percent
FROM sku_financial_scenarios
WHERE sales_commissions_percent IS NOT NULL 
    AND sales_commissions_percent != '0'
    AND asp IS NOT NULL
LIMIT 10;

