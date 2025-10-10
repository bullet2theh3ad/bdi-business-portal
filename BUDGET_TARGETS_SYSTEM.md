# 🎯 Budget Targets System - Estimates vs Actuals

## Overview

The **Budget Targets** system allows you to enter **estimated/target budget numbers** for each project and compare them against **actual NRE spending**. This gives you powerful variance analysis and helps you track budget performance over time.

---

## 🔑 Key Concepts

### Budget Targets (This System)
- **ESTIMATED** budget amounts you plan to spend
- Top-level project budget numbers
- Payment schedule breakdown (weekly/monthly/quarterly)
- Used for **planning and forecasting**

### NRE Budgets (Existing System)
- **ACTUAL** vendor quotes and spending
- Detailed line items and invoices
- Used for **tracking real costs**

### The Magic: Comparison & Analysis
The system automatically compares your **budget targets** against **actual NRE spending** to show:
- 💰 **Variance Amount**: How much over/under budget you are
- 📊 **Variance Percentage**: % difference from target
- 🚦 **Status Indicators**: Over budget, near budget, under budget
- 📈 **Trend Analysis**: Spending patterns over time

---

## 🎨 Three Layout Options

You can test **three different ways** to enter and view budget data:

### Option 1: Weekly Table View 📋
- Simple table format
- Weekly or bi-weekly breakdown
- Best for: Short-term projects, granular tracking
- **Use when**: You need week-by-week budget allocation

### Option 2: Monthly Calendar View 📅
- Calendar-style input
- Monthly payment periods
- Best for: Standard project timelines, fiscal reporting
- **Use when**: You think in months and quarters

### Option 3: Category Matrix View 🎛️
- Categories across timeline
- Multi-project overview
- Best for: Portfolio management, executive dashboards
- **Use when**: Managing multiple projects simultaneously

---

## 📝 How to Use

### Step 1: Create a Budget Target

1. Go to **Admin → Budget Targets** (in sidebar)
2. Click **"Create Budget Target"**
3. Fill in **Basic Info** tab:
   - **Project Name**: e.g., "MNQ15 DVT"
   - **SKU Code**: Link to a product SKU (optional but recommended)
   - **Fiscal Year**: 2025, 2026, etc.
   - **Budget Category**: NRE Design, Tooling, EVT/DVT/PVT, etc.
   - **Total Budget Amount**: Your estimated budget (e.g., $150,000)
   - **Payment Frequency**: Weekly, Monthly, Quarterly, or Custom
   - **Start/End Dates**: Budget period timeline

### Step 2: Set Payment Schedule

1. Switch to **Payment Schedule** tab
2. **Auto-Generated Option**:
   - System automatically breaks down total budget based on frequency
   - Equal distribution across time periods
   - Edit amounts as needed

3. **Custom Option**:
   - Set frequency to "Custom"
   - Manually add payment periods
   - Define your own schedule (e.g., 50% deposit, 25% mid-project, 25% completion)

### Step 3: Document Assumptions

1. Switch to **Notes & Assumptions** tab
2. **Notes**: General comments about this budget
3. **Assumptions**: Document WHY you chose these numbers
   - Example: "Based on previous DVT cost of $120K + 25% buffer for new features"
   - Example: "Assumes 6 months timeline with 3 milestone payments"

### Step 4: Save and Compare

1. Click **"Create Budget Target"**
2. System automatically pulls actual spending from NRE Budgets
3. View **variance analysis** on the main page
4. Track **over/under budget** status in real-time

---

## 📊 Budget Analysis Features

### Summary Cards
- **Total Budget Target**: Sum of all estimated budgets
- **Total Actual Spent**: Real spending from NRE system
- **Total Variance**: Difference between target and actual
- **Active Projects**: Number of projects being tracked

### Project Cards
Each budget target shows:
- **Target Budget** (blue): What you planned to spend
- **Actual Spent** (green): What you've actually spent
- **Variance** (red/green): Over/under budget amount and %
- **Status Badge**: Visual indicator of budget health
- **Payment Schedule**: Breakdown by week/month

### Budget Status Indicators
- 🔴 **OVER_BUDGET**: Spending exceeds target
- 🟡 **NEAR_BUDGET**: Within 90% of target (warning zone)
- 🟢 **UNDER_BUDGET**: Spending below target (on track)
- ⚪ **NO_ACTUALS**: No real spending recorded yet

---

## 💡 Use Cases & Examples

### Use Case 1: DVT Project Budget
**Scenario**: Planning a new device DVT phase

```
Project Name: MNQ15 DVT
Total Budget: $180,000
Frequency: Monthly
Timeline: 6 months

Payment Schedule:
- Month 1: $30,000 (Design & tooling deposit)
- Month 2: $40,000 (EVT samples)
- Month 3: $35,000 (DVT builds)
- Month 4: $30,000 (Testing & certifications)
- Month 5: $25,000 (PVT prep)
- Month 6: $20,000 (Final validation)

Assumptions: Based on MNQ10 DVT costs ($150K) + 20% for 
additional features and new certification requirements.
```

### Use Case 2: Annual Firmware Budget
**Scenario**: Yearly firmware development budget

```
Project Name: FW Development 2025
Total Budget: $500,000
Frequency: Quarterly
Timeline: Full year

Payment Schedule:
- Q1 2025: $125,000
- Q2 2025: $125,000
- Q3 2025: $125,000
- Q4 2025: $125,000

Assumptions: 4 engineers @ $125K/quarter. Includes 
weekly NRE, special projects, and iOS/Android development.
```

### Use Case 3: Multi-Product Portfolio
**Scenario**: Managing budgets across multiple products

```
Projects:
1. MNQ15 DVT: $180,000
2. MNB10 EVT: $120,000
3. MNQ20 PVT: $95,000
4. Certifications 2025: $75,000

Total Portfolio Budget: $470,000

Compare against actuals monthly to see:
- Which projects are on track
- Where budget adjustments needed
- Overall program financial health
```

---

## 🔧 Technical Details

### Database Schema

**budget_targets** table:
- Project identification (name, SKU, fiscal year)
- Budget metadata (category, description)
- Total budget amount
- Payment frequency settings
- Status and audit fields

**budget_target_payments** table:
- Payment period breakdown
- Start/end dates for each period
- Estimated amount per period
- Period labels (Week 1, Jan 2025, Q1-2025)

**budget_vs_actual_analysis** view:
- Automatic comparison calculation
- Variance amount and percentage
- Budget status determination
- Real-time sync with NRE actuals

### API Endpoints

```
GET    /api/admin/budget-targets           - Fetch all targets
POST   /api/admin/budget-targets           - Create new target
GET    /api/admin/budget-targets/[id]      - Fetch single target
PUT    /api/admin/budget-targets/[id]      - Update target
DELETE /api/admin/budget-targets/[id]      - Delete target (soft)
GET    /api/admin/budget-targets/analysis  - Fetch comparison data
```

---

## 🎯 Best Practices

### 1. **Document Your Assumptions**
- Always fill in the "Assumptions" field
- Explain WHY you chose these numbers
- Reference previous projects or quotes
- Note any risks or uncertainties

### 2. **Review Regularly**
- Check variance analysis weekly/monthly
- Adjust budgets as needed (projects evolve!)
- Update payment schedules based on reality
- Lock budgets when they become baseline

### 3. **Start Simple**
- Begin with monthly frequency (easiest)
- Use equal distribution across periods
- Refine as you get more confident
- Add custom periods for special cases

### 4. **Link to SKUs**
- Always link budgets to SKU codes when possible
- Makes reporting and analysis much easier
- Auto-populates project name
- Enables product-level budget tracking

### 5. **Use Categories Consistently**
- Stick to predefined NRE categories
- Makes comparison across projects easier
- Enables category-level budget analysis
- Helps with financial reporting

---

## 🚀 Quick Start Guide

**5-Minute Setup**:

1. **Create your first budget target**
   ```
   Project: MNQ15 DVT
   Budget: $150,000
   Frequency: Monthly
   Duration: 6 months
   ```

2. **Let system auto-generate schedule**
   - System splits $150K into 6 equal payments of $25K

3. **Adjust amounts if needed**
   - Maybe you want 50% upfront: $75K, $15K, $15K, $15K, $15K, $15K

4. **Save and compare**
   - System automatically compares against actual NRE spending
   - Watch variance numbers update as real invoices come in

5. **Test the layouts**
   - Switch between Weekly Table, Monthly Calendar, Category Matrix
   - See which view works best for your workflow

---

## 📚 Related Systems

- **NRE Budget**: Actual vendor quotes and spending
- **Purchase Orders**: Production orders (not NRE)
- **Invoices**: Payment tracking
- **Analytics**: Financial reporting dashboard

---

## 🆘 Troubleshooting

**Q: Why is my variance showing 0?**
A: No actual NRE budgets have been created yet for this project. The system needs actual spending data to calculate variance.

**Q: Can I change the payment frequency after creating?**
A: Yes! Edit the budget target and change frequency. Payment periods will regenerate.

**Q: What if my project goes longer than planned?**
A: Update the end date and add new payment periods. The system is flexible.

**Q: Can I track multiple budgets for the same project?**
A: Yes! Use different categories. Example: MNQ15 DVT with separate budgets for NRE Design, Tooling, and Certifications.

**Q: How do I "lock" a budget?**
A: Edit the budget and toggle "isLocked" - this prevents accidental changes to baseline budgets.

---

## 🎉 What's Next?

Future enhancements could include:
- 📧 **Email alerts** when variance exceeds threshold
- 📊 **Export to Excel** for CFO reporting
- 📈 **Trend charts** showing budget health over time
- 🔄 **Budget templates** for common project types
- 🎯 **AI-powered suggestions** based on historical data
- 📱 **Mobile budget tracking** for on-the-go updates

---

## 📞 Support

For questions or issues:
1. Check this documentation first
2. Review example use cases above
3. Test the three different layouts
4. Contact system administrator if stuck

**Remember**: This is a tool for **planning and analysis**. The goal is to help you make better financial decisions, not to add administrative burden. Start simple, iterate, and find what works for YOUR workflow!

🎯 **Happy budgeting!**

