# Purchase Order Number Generation Policy

**Document Type:** Policy  
**Effective Date:** September 28, 2025  
**Version:** 1.0  
**Department:** Operations & CPFR  
**Applies To:** All BDI Business Portal Users

---

## Overview

This policy establishes the standardized 10-digit Purchase Order (PO) number generation system used across the BDI Business Portal. The new format ensures unique PO identification while encoding critical business data including supplier, product, date, and uniqueness identifiers.

## PO Number Format

### Structure: `XXYYYZZZZ####`

All Purchase Order numbers follow this exact 10-digit format:

| Position | Digits | Component | Description |
|----------|--------|-----------|-------------|
| 1-2 | `XX` | Organization Code | 2-digit supplier/partner code |
| 3-5 | `YYY` | SKU Code | 3-digit product identifier |
| 6-9 | `ZZZZ` | Epoch Date | Days since January 1, 2025 |
| 10-13 | `####` | Random Code | 4-digit uniqueness identifier |

### Example: `1010002711234`
- **10** = MTN (Organization)
- **100** = SKU Code #100
- **0271** = Day #271 since Jan 1, 2025 (September 28, 2025)
- **1234** = Random 4-digit code

---

## Organization Codes (2-Digit)

Each partner organization is assigned a unique 2-digit code:

| Organization | Code | Description |
|--------------|------|-------------|
| **MTN** | `10` | MTN Technology Partners |
| **CBN** | `20` | CBN Manufacturing |
| **ASK** | `30` | ASK Solutions |
| **ATL** | `40` | ATL Logistics |
| **GPN** | `70` | GPN Global Partners |
| **CAT** | `80` | CAT Technologies |
| **BDI** | `90` | Boundless Devices Inc |

*Note: Code `99` is reserved for unknown/new organizations*

---

## SKU Codes (3-Digit)

Each product SKU is assigned a unique 3-digit code (001-999):

- **Range:** 001 to 999 (supports up to 999 unique SKUs)
- **Assignment:** Sequential based on SKU creation date
- **Format:** Zero-padded (e.g., 001, 042, 100, 999)
- **Uniqueness:** Each SKU has exactly one 3-digit code

### SKU Code Assignment Process:
1. New SKUs automatically receive the next available 3-digit code
2. Codes are assigned sequentially starting from 001
3. Once assigned, SKU codes never change
4. Discontinued SKUs retain their codes (no reuse)

---

## Epoch Date System (4-Digit)

The date component uses an epoch system starting January 1, 2025:

- **Epoch Start:** January 1, 2025 = Day 0000
- **Current Example:** September 28, 2025 = Day 0271
- **Format:** Zero-padded 4-digit number
- **Range:** 0000 to 9999 (supports ~27 years from 2025)

### Date Calculation:
```
Days Since Epoch = (Current Date - January 1, 2025) in days
```

**Examples:**
- January 1, 2025 → `0000`
- January 2, 2025 → `0001`
- September 28, 2025 → `0271`
- December 31, 2025 → `0364`

---

## Random Code (4-Digit)

The final component ensures uniqueness within each day:

- **Range:** 0000 to 9999
- **Capacity:** 10,000 unique POs per organization per day
- **Generation:** Automatic with manual regeneration option
- **Format:** Zero-padded 4-digit number

### Uniqueness Guarantee:
- **Per Organization:** Each org can have up to 10,000 POs per day
- **Per Day:** Date epoch changes daily, resetting random pool
- **Per SKU:** Different SKUs can share random codes (separated by SKU code)
- **Collision Avoidance:** Extremely low probability with 10,000 daily options

---

## PO Number Builder Usage

### Automatic Generation Process:

1. **Select Supplier Organization** from dropdown
2. **Select Product SKU** from dropdown  
3. **Choose Date** (defaults to current date)
4. **Random Code** auto-generates (🎲 to regenerate)

### Generated Output:
- **PO Number:** Displays complete 10-digit number
- **Breakdown:** Shows each component with explanations
- **Validation:** Ensures all components are valid

### Manual Regeneration:
- Click the **dice button** to generate a new random code
- All displays update consistently (box, PO number, breakdown)
- Use if you want a different random code for the same PO

---

## Business Benefits

### Data Encoding:
- **Supplier Identification:** Immediate recognition from first 2 digits
- **Product Identification:** SKU encoded in positions 3-5
- **Date Tracking:** Creation date encoded in positions 6-9
- **Uniqueness:** Collision-resistant with 4-digit random

### Operational Advantages:
- **No Dashes:** Clean numeric format for systems integration
- **Fixed Length:** Always exactly 10 digits for database consistency
- **Human Readable:** Each component has clear meaning
- **Scalable:** Supports 999 SKUs × 10,000 daily POs per organization

### System Integration:
- **Database Efficiency:** Numeric indexing and sorting
- **API Compatibility:** Consistent format across all systems
- **Reporting:** Easy filtering and grouping by components
- **Legacy Support:** Maintains compatibility with existing systems

---

## Implementation Notes

### Database Requirements:
- `organizations.po_code_2_digit` field for organization codes
- `product_skus.sku_code_3_digit` field for SKU codes
- Unique constraints on both code fields

### Frontend Features:
- Interactive PO Builder with live preview
- Component breakdown with explanations
- Random code regeneration with dice button
- Validation and error handling

### Migration Process:
1. Execute SQL scripts to add required database fields
2. Assign 2-digit codes to all organizations
3. Assign 3-digit codes to all existing SKUs
4. Update PO generation logic in application
5. Train users on new format and builder tool

---

## Compliance & Standards

### Format Requirements:
- **Exactly 10 digits** - no more, no less
- **Numeric only** - no letters or special characters
- **Zero-padded** - all components properly formatted
- **No delimiters** - continuous digit string

### Validation Rules:
- Organization code must exist in system
- SKU code must be assigned and valid
- Date must be valid and not future-dated
- Random code must be 4 digits (0000-9999)

### Quality Assurance:
- System prevents duplicate PO numbers
- Validation occurs before PO creation
- Error handling for invalid components
- Audit trail for all PO number assignments

---

## Support & Troubleshooting

### Common Issues:
- **"Select options above"** - Complete all dropdown selections
- **"SKU not found"** - Verify SKU exists and has assigned 3-digit code
- **Invalid date** - Ensure date is not before January 1, 2025

### Contact Information:
- **Technical Support:** IT Department
- **Policy Questions:** Operations Manager
- **System Issues:** BDI Business Portal Support

---

**Document Control:**
- **Created:** September 28, 2025
- **Last Modified:** September 28, 2025  
- **Next Review:** March 28, 2026
- **Owner:** BDI Operations Team
