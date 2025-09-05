import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, warehouses, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get shipment data with related forecast and SKU information
    const { data: shipmentData, error: shipmentError } = await supabase
      .from('shipments')
      .select(`
        *,
        sales_forecasts!inner(
          id,
          sku_id,
          quantity,
          delivery_week,
          shipping_preference,
          notes,
          product_skus!inner(
            sku,
            name,
            description,
            hts_code,
            box_length_cm,
            box_width_cm,
            box_height_cm,
            box_weight_kg,
            carton_length_cm,
            carton_width_cm,
            carton_height_cm,
            carton_weight_kg,
            boxes_per_carton,
            pallet_length_cm,
            pallet_width_cm,
            pallet_height_cm,
            pallet_weight_kg
          )
        )
      `)
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipmentData) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    console.log('📅 Shipment dates debug:');
    console.log('📅 estimated_departure:', shipmentData.estimated_departure);
    console.log('📅 estimated_arrival:', shipmentData.estimated_arrival);
    console.log('📅 Raw shipment data keys:', Object.keys(shipmentData));

    // Get factory warehouse details if linked
    let factoryWarehouse = null;
    if (shipmentData.factory_warehouse_id) {
      const [warehouseData] = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, shipmentData.factory_warehouse_id))
        .limit(1);
      
      factoryWarehouse = warehouseData;
      console.log('🏭 Factory warehouse data:', JSON.stringify(factoryWarehouse, null, 2));
      console.log('🏭 Contacts field type:', typeof (factoryWarehouse as any)?.contacts);
      console.log('🏭 Contacts data:', (factoryWarehouse as any)?.contacts);
    } else {
      console.log('🏭 No factory_warehouse_id found in shipment:', shipmentData.factory_warehouse_id);
    }

    // Get user organization for BDI contact info
    const [userData] = await db
      .select({
        user: users,
        organization: organizations
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    // Generate professional shipment form HTML
    const formHtml = generateShipmentFormHTML(shipmentData, factoryWarehouse, userData?.organization);

    return NextResponse.json({
      success: true,
      shipmentId: shipmentId,
      shipmentNumber: shipmentData.shipment_number,
      formHtml: formHtml,
      factoryWarehouse: factoryWarehouse,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating shipment form:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateShipmentFormHTML(shipmentData: any, factoryWarehouse: any, bdiOrg: any): string {
  const forecast = shipmentData.sales_forecasts;
  const sku = forecast?.product_skus;
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Calculate shipping data using the same logic as the UI
  const quantity = forecast?.quantity || 0;
  const unitsPerCarton = sku?.boxes_per_carton || 5;
  const cartonCount = Math.ceil(quantity / unitsPerCarton);
  const palletCount = Math.ceil(cartonCount / 40); // Assuming 40 cartons per pallet
  
  const shippingData = {
    totalUnits: quantity,
    cartonCount: cartonCount,
    palletCount: palletCount,
    unitsPerCarton: unitsPerCarton,
    ctnL: sku?.carton_length_cm || '0',
    ctnW: sku?.carton_width_cm || '0', 
    ctnH: sku?.carton_height_cm || '0',
    cbmPerCarton: sku?.carton_length_cm && sku?.carton_width_cm && sku?.carton_height_cm 
      ? ((parseFloat(sku.carton_length_cm) * parseFloat(sku.carton_width_cm) * parseFloat(sku.carton_height_cm)) / 1000000).toFixed(8)
      : '0',
    unitNW: sku?.box_weight_kg || '0',
    ctnGW: sku?.carton_weight_kg || '0',
    totalShippingWeight: cartonCount * parseFloat(sku?.carton_weight_kg || '0'),
    totalVolumeCartons: sku?.carton_length_cm && sku?.carton_width_cm && sku?.carton_height_cm 
      ? (cartonCount * (parseFloat(sku.carton_length_cm) * parseFloat(sku.carton_width_cm) * parseFloat(sku.carton_height_cm)) / 1000000).toFixed(7)
      : '0',
    htsCode: sku?.hts_code || 'TBD'
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipment Form - ${shipmentData.shipment_number}</title>
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f8fafc;
            color: #1f2937;
        }
        .form-container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            padding: 30px; 
            text-align: center;
        }
        .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold;
        }
        .header p { 
            margin: 8px 0 0 0; 
            opacity: 0.9; 
            font-size: 16px;
        }
        .content { 
            padding: 30px;
        }
        .section { 
            margin-bottom: 30px; 
            padding: 20px; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px;
            background: #f9fafb;
        }
        .section h2 { 
            margin: 0 0 15px 0; 
            color: #059669; 
            font-size: 18px;
            font-weight: bold;
            border-bottom: 2px solid #10b981;
            padding-bottom: 8px;
        }
        .grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px;
        }
        .grid-3 { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr; 
            gap: 15px;
        }
        .field { 
            margin-bottom: 12px;
        }
        .field-label { 
            font-weight: bold; 
            color: #374151; 
            margin-bottom: 4px;
            font-size: 14px;
        }
        .field-value { 
            color: #1f2937; 
            font-size: 15px;
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #d1d5db;
        }
        .highlight { 
            background: #dcfce7; 
            border: 1px solid #10b981;
            font-weight: bold;
        }
        .contact-card {
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .contact-name {
            font-weight: bold;
            color: #059669;
            font-size: 16px;
            margin-bottom: 8px;
        }
        .footer { 
            text-align: center; 
            padding: 20px; 
            background: #f3f4f6; 
            color: #6b7280; 
            font-size: 12px;
        }
        @media print {
            body { background: white; }
            .form-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="form-container">
        <div class="header">
            <h1>🚢 Professional Shipment Form</h1>
            <p>Shipment Number: ${shipmentData.shipment_number}</p>
            <p>Generated: ${currentDate}</p>
        </div>
        
        <div class="content">
            <!-- Shipment Overview -->
            <div class="section">
                <h2>📦 Shipment Overview</h2>
                <div class="grid">
                    <div class="field">
                        <div class="field-label">Shipment Number</div>
                        <div class="field-value highlight">${shipmentData.shipment_number}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Priority</div>
                        <div class="field-value">${(shipmentData.priority || 'Standard').charAt(0).toUpperCase() + (shipmentData.priority || 'standard').slice(1)}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Shipper Reference</div>
                        <div class="field-value">${shipmentData.shipper_reference || 'TBD'}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Incoterms</div>
                        <div class="field-value">${shipmentData.incoterms || forecast?.incoterms || 'FOB'}</div>
                    </div>
                </div>
            </div>

            <!-- Package Summary -->
            ${sku ? `
            <div class="section">
                <h2>📦 Package Summary</h2>
                <div class="grid">
                    <div class="field">
                        <div class="field-label">Total Units</div>
                        <div class="field-value highlight">${shippingData.totalUnits.toLocaleString()}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Total Cartons</div>
                        <div class="field-value highlight">${shippingData.cartonCount}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Total Pallets</div>
                        <div class="field-value highlight">${shippingData.palletCount}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Units/Carton</div>
                        <div class="field-value">${shippingData.unitsPerCarton}</div>
                    </div>
                </div>
            </div>

            <!-- Weight Breakdown -->
            <div class="section">
                <h2>⚖️ Weight Breakdown (kg)</h2>
                <div class="grid">
                    <div class="field">
                        <div class="field-label">Unit NW</div>
                        <div class="field-value">${shippingData.unitNW} kg</div>
                    </div>
                    <div class="field">
                        <div class="field-label">CTN GW</div>
                        <div class="field-value">${shippingData.ctnGW} kg</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Total Shipping Weight</div>
                        <div class="field-value highlight">${shippingData.totalShippingWeight} kg</div>
                    </div>
                    <div class="field">
                        <div class="field-label">HTS Code</div>
                        <div class="field-value">${shippingData.htsCode}</div>
                    </div>
                </div>
            </div>

            <!-- Volume Breakdown -->
            <div class="section">
                <h2>📐 Volume Breakdown (CBM)</h2>
                <div class="grid">
                    <div class="field">
                        <div class="field-label">Dimensions (L×W×H)</div>
                        <div class="field-value">${shippingData.ctnL}×${shippingData.ctnW}×${shippingData.ctnH} cm</div>
                    </div>
                    <div class="field">
                        <div class="field-label">CBM per Carton</div>
                        <div class="field-value">${shippingData.cbmPerCarton}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Total Volume</div>
                        <div class="field-value highlight">${shippingData.totalVolumeCartons} cbm</div>
                    </div>
                    <div class="field">
                        <div class="field-label">SKU Code</div>
                        <div class="field-value">${sku.sku.replace(/\([^)]*\)/g, '').replace(/-+$/, '').trim()}</div>
                    </div>
                </div>
            </div>

            <!-- Export Preview -->
            <div class="section">
                <h2>📄 Export Preview</h2>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; border: 1px solid #dee2e6;">
                    <div style="color: #6c757d;">SKU: ${sku.sku.replace(/\([^)]*\)/g, '').replace(/-+$/, '').trim()}</div>
                    <div>Units: ${shippingData.totalUnits.toLocaleString()}, Cartons: ${shippingData.cartonCount}</div>
                    <div>CBM: ${shippingData.cbmPerCarton}, Weight: ${shippingData.totalShippingWeight}kg</div>
                    <div style="color: #0d6efd; margin-top: 8px;">✅ Ready for CSV export to shipper</div>
                </div>
            </div>
            ` : ''}

            <!-- Factory Contact Information -->
            ${factoryWarehouse ? `
            <div class="section">
                <h2>🏭 Factory Contact Information</h2>
                <div class="contact-card">
                    <div class="contact-name">MTN Factory: ${factoryWarehouse.name}</div>
                    <div class="grid">
                        <div class="field">
                            <div class="field-label">Address</div>
                            <div class="field-value">${factoryWarehouse.address || 'Address TBD'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">City</div>
                            <div class="field-value">${factoryWarehouse.city || 'City TBD'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Country</div>
                            <div class="field-value">${factoryWarehouse.country || 'Country TBD'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Postal Code</div>
                            <div class="field-value">${factoryWarehouse.postalCode || 'Postal Code TBD'}</div>
                        </div>
                    </div>
                    
                    ${(() => {
                        // Handle both new contacts array format and old single contact format
                        let contactsToShow = [];
                        
                        // Try new contacts array format first
                        if (factoryWarehouse.contacts) {
                            try {
                                const contactsArray = typeof factoryWarehouse.contacts === 'string' 
                                    ? JSON.parse(factoryWarehouse.contacts) 
                                    : factoryWarehouse.contacts;
                                if (Array.isArray(contactsArray)) {
                                    contactsToShow = contactsArray;
                                }
                            } catch (e) {
                                console.log('Error parsing contacts array:', e);
                            }
                        }
                        
                        // Fallback to old single contact format
                        if (contactsToShow.length === 0 && (factoryWarehouse.contactName || factoryWarehouse.contactEmail || factoryWarehouse.contactPhone)) {
                            contactsToShow = [{
                                name: factoryWarehouse.contactName,
                                email: factoryWarehouse.contactEmail, 
                                phone: factoryWarehouse.contactPhone,
                                isPrimary: true
                            }];
                        }
                        
                        return contactsToShow.map((contact: any, index: number) => `
                            <div class="contact-card" style="margin-top: 15px; background: #f0fdf4;">
                                <div class="contact-name">${contact.name || contact.contact_name || 'Contact ' + (index + 1)}${contact.isPrimary || contact.is_primary ? ' (Primary)' : ''}</div>
                                <div class="grid">
                                    <div class="field">
                                        <div class="field-label">Email</div>
                                        <div class="field-value">${contact.email || contact.contact_email || 'Email TBD'}</div>
                                    </div>
                                    <div class="field">
                                        <div class="field-label">Phone</div>
                                        <div class="field-value">${contact.phone || contact.contact_phone || 'Phone TBD'}${(contact.extension || contact.contact_extension) ? ' ext. ' + (contact.extension || contact.contact_extension) : ''}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    })()}
                    
                    <div class="grid" style="margin-top: 15px;">
                        <div class="field">
                            <div class="field-label">Operating Hours</div>
                            <div class="field-value">${factoryWarehouse.operatingHours || 'Business Hours TBD'}</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Time Zone</div>
                            <div class="field-value">${factoryWarehouse.timezone || 'Time Zone TBD'}</div>
                        </div>
                    </div>
                </div>
            </div>
            ` : `
            <div class="section">
                <h2>🏭 Factory Contact Information</h2>
                <div class="field-value" style="text-align: center; padding: 20px; color: #6b7280;">
                    No factory warehouse selected. Please select a warehouse to display factory contact details.
                </div>
            </div>
            `}

            <!-- BDI Contact Information -->
            <div class="section">
                <h2>📞 BDI Business Contact Information</h2>
                <div class="contact-card">
                    <div class="contact-name">Boundless Devices, Inc.</div>
                    <div class="grid">
                        <div class="field">
                            <div class="field-label">Business Address</div>
                            <div class="field-value">17875 VON KARMAN AVE. SUITE 150<br>IRVINE, CA 92614</div>
                        </div>
                        <div class="field">
                            <div class="field-label">Phone</div>
                            <div class="field-value">949-994-7791</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Shipping Timeline -->
            <div class="section">
                <h2>📅 Shipping Timeline</h2>
                <div class="grid">
                    <div class="field">
                        <div class="field-label">Estimated Ship Date</div>
                        <div class="field-value">${shipmentData.estimated_departure ? new Date(shipmentData.estimated_departure).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'TBD'}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Requested Delivery Date</div>
                        <div class="field-value">${shipmentData.estimated_arrival ? new Date(shipmentData.estimated_arrival).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'TBD'}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Delivery Week</div>
                        <div class="field-value">${forecast?.delivery_week || 'TBD'}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">Shipping Method</div>
                        <div class="field-value">${forecast?.shipping_preference || shipmentData.shipping_method || 'TBD'}</div>
                    </div>
                </div>
            </div>

            <!-- Special Instructions -->
            ${shipmentData.notes || forecast?.notes ? `
            <div class="section">
                <h2>📝 Special Instructions</h2>
                <div class="field-value" style="white-space: pre-wrap;">${shipmentData.notes || forecast?.notes || ''}</div>
            </div>
            ` : ''}

            <!-- Footer -->
            <div class="section" style="text-align: center; background: #f3f4f6;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    This form was generated by the BDI Business Portal<br>
                    For questions, contact: cpfr@bdibusinessportal.com
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
}
