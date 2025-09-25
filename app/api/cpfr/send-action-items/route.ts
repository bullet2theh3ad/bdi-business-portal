import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      to, 
      subject, 
      forecast, 
      timeline, 
      analysisData,
      includeTimeline,
      includeRiskAssessment,
      includeActionItems 
    } = body;

    // Format the work-backwards timeline email content
    const emailContent = generateCPFRActionItemsEmail({
      forecast,
      timeline,
      analysisData,
      includeTimeline,
      includeRiskAssessment,
      includeActionItems
    });

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'CPFR System <cpfr@bdibusinessportal.com>',
      to: to.split(',').map((email: string) => email.trim()),
      subject,
      html: emailContent,
      text: stripHtml(emailContent)
    });

    if (error) {
      console.error('Email sending error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'CPFR action items email sent successfully',
      recipients: to
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateCPFRActionItemsEmail({
  forecast,
  timeline,
  analysisData,
  includeTimeline,
  includeRiskAssessment,
  includeActionItems
}: any) {
  // Convert date strings back to Date objects (they get serialized during JSON transmission)
  const deliveryDate = new Date(timeline.deliveryDate);
  const warehouseArrival = new Date(timeline.warehouseArrival);
  const shippingStart = new Date(timeline.shippingStart);
  const productionStart = new Date(timeline.productionStart);
  const factorySignalDate = new Date(timeline.factorySignalDate);
  
  const riskColor = timeline.riskLevel === 'HIGH' ? '#dc2626' : 
                   timeline.riskLevel === 'MEDIUM' ? '#d97706' : '#16a34a';
  
  const isOverdue = factorySignalDate < new Date();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CPFR Action Items - ${forecast.sku?.sku}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8fafc; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { padding: 30px; }
    .risk-banner { padding: 15px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .risk-high { background: #fef2f2; border-left: 4px solid #dc2626; color: #dc2626; }
    .risk-medium { background: #fffbeb; border-left: 4px solid #d97706; color: #d97706; }
    .risk-low { background: #f0fdf4; border-left: 4px solid #16a34a; color: #16a34a; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .summary-item { background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .summary-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
    .summary-value { font-size: 18px; font-weight: bold; color: #1f2937; margin-top: 4px; }
    .timeline { margin: 30px 0; }
    .timeline-step { display: flex; margin-bottom: 20px; padding: 15px; border-radius: 8px; border-left: 4px solid; }
    .step-delivery { background: #dbeafe; border-color: #3b82f6; }
    .step-warehouse { background: #dcfce7; border-color: #16a34a; }
    .step-shipping { background: #f3e8ff; border-color: #8b5cf6; }
    .step-production { background: #fed7aa; border-color: #f97316; }
    .step-signal { background: #fef3c7; border-color: #f59e0b; }
    .step-signal.overdue { background: #fee2e2; border-color: #dc2626; }
    .step-icon { font-size: 24px; margin-right: 15px; flex-shrink: 0; }
    .step-content { flex: 1; }
    .step-title { font-weight: bold; margin-bottom: 4px; }
    .step-date { font-family: 'SF Mono', Monaco, monospace; font-size: 16px; font-weight: bold; color: #1f2937; }
    .step-description { color: #6b7280; font-size: 14px; }
    .overdue-alert { color: #dc2626; font-weight: bold; }
    .action-items { background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px solid #0ea5e9; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
    .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; }
    @media (max-width: 600px) {
      .container { margin: 10px; }
      .content { padding: 20px; }
      .summary-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🎯 CPFR Action Items Required</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Work-Backwards Timeline Analysis & Critical Actions</p>
    </div>
    
    <div class="content">
      ${includeRiskAssessment ? `
      <div class="risk-banner risk-${timeline.riskLevel.toLowerCase()}">
        ${timeline.riskLevel === 'HIGH' ? '🚨' : timeline.riskLevel === 'MEDIUM' ? '⚠️' : '✅'} 
        Risk Level: ${timeline.riskLevel} - 
        ${timeline.daysUntilDelivery} days until delivery 
        (${timeline.totalDaysRequired} days required)
      </div>
      ` : ''}

      <h2>📊 CPFR Analysis Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">SKU & Quantity</div>
          <div class="summary-value">${forecast.sku?.sku}</div>
          <div style="color: #6b7280; font-size: 14px;">${forecast.quantity.toLocaleString()} units</div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">Sales Delivery Target</div>
          <div class="summary-value">${deliveryDate.toLocaleDateString()}</div>
          <div style="color: #6b7280; font-size: 14px;">Week ${forecast.deliveryWeek}</div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">Factory Signal Due</div>
          <div class="summary-value" style="color: ${isOverdue ? '#dc2626' : '#f59e0b'};">
            ${factorySignalDate.toLocaleDateString()}
          </div>
          <div style="color: ${isOverdue ? '#dc2626' : '#6b7280'}; font-size: 14px;">
            ${isOverdue ? 'OVERDUE!' : 'Action Required'}
          </div>
        </div>
        
        <div class="summary-item">
          <div class="summary-label">Shipping Method</div>
          <div class="summary-value" style="font-size: 14px;">
            ${analysisData.shippingMethod === 'custom' ? 
              `Custom (${analysisData.customShippingDays} days)` : 
              analysisData.shippingMethod.replace(/_/g, ' ')}
          </div>
          <div style="color: #6b7280; font-size: 14px;">${timeline.shippingDays} transit days</div>
        </div>
      </div>

      ${includeTimeline ? `
      <h2>🔄 Work-Backwards Timeline (From Sales Delivery Date)</h2>
      <p style="color: #6b7280; margin-bottom: 25px;">
        Working backwards from the sales commitment to determine realistic factory signal timing:
      </p>
      
      <div class="timeline">
        <!-- Step 5: Sales Delivery (Stake in Ground) -->
        <div class="timeline-step step-delivery">
          <div class="step-icon">🎯</div>
          <div class="step-content">
            <div class="step-title">Sales Delivery Date (Customer Commitment)</div>
            <div class="step-date">${deliveryDate.toLocaleDateString()}</div>
            <div class="step-description">Stake in the ground - customer delivery commitment</div>
          </div>
        </div>

        <!-- Step 4: Warehouse Arrival -->
        <div class="timeline-step step-warehouse">
          <div class="step-icon">🏪</div>
          <div class="step-content">
            <div class="step-title">Warehouse Arrival Required</div>
            <div class="step-date">${warehouseArrival.toLocaleDateString()}</div>
            <div class="step-description">Safety buffer: ${timeline.bufferDays} days before customer delivery</div>
          </div>
        </div>

        <!-- Step 3: Shipping Start -->
        <div class="timeline-step step-shipping">
          <div class="step-icon">🚢</div>
          <div class="step-content">
            <div class="step-title">Shipping Must Start</div>
            <div class="step-date">${shippingStart.toLocaleDateString()}</div>
            <div class="step-description">
              Transit time: ${timeline.shippingDays} days 
              (${analysisData.shippingMethod === 'custom' ? 'Custom' : analysisData.shippingMethod.replace(/_/g, ' ')})
            </div>
          </div>
        </div>

        <!-- Step 2: Production Start -->
        <div class="timeline-step step-production">
          <div class="step-icon">🏭</div>
          <div class="step-content">
            <div class="step-title">Production Must Start</div>
            <div class="step-date">${productionStart.toLocaleDateString()}</div>
            <div class="step-description">Manufacturing lead time: ${timeline.leadTimeDays} days</div>
          </div>
        </div>

        <!-- Step 1: Factory Signal (Critical Action) -->
        <div class="timeline-step step-signal ${isOverdue ? 'overdue' : ''}">
          <div class="step-icon">📡</div>
          <div class="step-content">
            <div class="step-title">Factory Signal Required ${isOverdue ? '(OVERDUE)' : ''}</div>
            <div class="step-date ${isOverdue ? 'overdue-alert' : ''}">${factorySignalDate.toLocaleDateString()}</div>
            <div class="step-description ${isOverdue ? 'overdue-alert' : ''}">
              ${isOverdue ? 
                '🚨 CRITICAL: Signal should have been sent! Immediate action required.' : 
                'Signal factory to start production planning (7 days before production)'}
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${includeActionItems ? `
      <div class="action-items">
        <h3 style="margin-top: 0; color: #0c4a6e;">🎯 Immediate Action Items</h3>
        <ul style="margin: 15px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">
            <strong>${isOverdue ? 'URGENT' : 'Schedule'} Factory Signal:</strong> 
            Contact factory by ${factorySignalDate.toLocaleDateString()} 
            ${isOverdue ? '(OVERDUE - send immediately!)' : ''}
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Production Planning:</strong> Ensure ${timeline.leadTimeDays}-day lead time is achievable for ${forecast.quantity.toLocaleString()} units
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Shipping Coordination:</strong> Book ${analysisData.shippingMethod.replace(/_/g, ' ').toLowerCase()} capacity for ${shippingStart.toLocaleDateString()}
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Risk Mitigation:</strong> 
            ${timeline.riskLevel === 'HIGH' ? 
              'High risk timeline - consider expedited shipping or negotiate delivery date' :
              timeline.riskLevel === 'MEDIUM' ? 
              'Monitor closely - minimal buffer for delays' :
              'Timeline achievable with proper execution'}
          </li>
          <li style="margin-bottom: 8px;">
            <strong>Stakeholder Communication:</strong> Update sales team on realistic timeline requirements
          </li>
        </ul>
        
        <p style="margin-bottom: 0; font-weight: 600; color: #0c4a6e;">
          Feasibility: <span style="color: ${timeline.isRealistic ? '#16a34a' : '#dc2626'};">
            ${timeline.isRealistic ? 'ACHIEVABLE' : 'AT RISK'}
          </span>
        </p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://bdibusinessportal.com/cpfr/forecasts" class="btn">
          📊 View CPFR Dashboard
        </a>
        <a href="https://bdibusinessportal.com/cpfr/forecasts?sku=${forecast.sku?.sku}" class="btn" style="background: #059669;">
          🎯 View This Forecast
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 10px 0;"><strong>BDI Business Portal - CPFR Management</strong></p>
      <p style="margin: 0; font-size: 12px;">
        This analysis was generated from realistic shipping and lead time parameters to replace optimistic sales forecasts with actionable CPFR timelines.
      </p>
      <p style="margin: 10px 0 0 0; font-size: 12px;">
        Questions? Contact: <a href="mailto:cpfr@bdibusinessportal.com">cpfr@bdibusinessportal.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
