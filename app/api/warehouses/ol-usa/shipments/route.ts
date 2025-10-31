import { NextRequest, NextResponse } from 'next/server';

// Sandbox configuration
const SANDBOX_API_URL = 'https://tf-uat-accesshub.azurewebsites.net/move/';
const SANDBOX_API_KEY = '259e2642-2269-48d6-91f9-be580f5c6f13';

// Production configuration (from env vars)
const PRODUCTION_API_URL = process.env.OL_USA_API_URL || 'https://api.olxhub.app/move';
const PRODUCTION_API_KEY = process.env.OL_USA_API_KEY || '';

export const dynamic = 'force-dynamic';

/**
 * POST /api/warehouses/ol-usa/shipments
 * Query OL-USA AccessHub for shipment tracking information
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference, containerNumber, queryType = 'shipmentDetailsV2', verbose = false, environment = 'sandbox' } = body;
    
    // Select API configuration based on environment
    const OL_USA_API_URL = environment === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL;
    const OL_USA_API_KEY = environment === 'production' ? PRODUCTION_API_KEY : SANDBOX_API_KEY;

    // Validate inputs
    if (!reference && !containerNumber) {
      return NextResponse.json(
        { error: 'Either reference or containerNumber is required' },
        { status: 400 }
      );
    }

    if (!OL_USA_API_KEY) {
      console.error(`[OL-USA API] Missing API key for ${environment} environment`);
      return NextResponse.json(
        { error: `OL-USA API key not configured for ${environment} environment` },
        { status: 500 }
      );
    }

    // Build GraphQL query based on queryType
    let query = '';
    
    if (queryType === 'shipmentDetailsV2') {
      query = `
        query ShipmentDetailsV2 {
          shipmentDetailsV2(
            ${reference ? `reference: "${reference}"` : ''}
            ${containerNumber ? `containerNumber: "${containerNumber}"` : ''}
            verbose: ${verbose}
          ) {
            shipmentStatus
            reference
            unitId
            shipmentDetailsURL
            stops {
              stopNumber
              locationType
              location
              city
              country
              latitude
              longitude
              milestones {
                eventCode
                eventName
                estimatedDate
                actualDate
                plannedDate
              }
            }
            originPort
            loadingPort
            dischargePort
            shipFrom
            shipTo
            containerSeals
            containerSizeClass
          }
        }
      `;
    } else if (queryType === 'fullTransportDetails') {
      query = `
        query FullTransportDetails {
          fullTransportDetails(
            reference: "${reference}"
            verbose: ${verbose}
          ) {
            shipmentStatus
            reference
            shipmentDetailsURL
            containers {
              unitId
              stops {
                stopNumber
                locationType
                location
                city
                country
                latitude
                longitude
                milestones {
                  eventCode
                  eventName
                  estimatedDate
                  actualDate
                  plannedDate
                }
              }
              loadingPort
              dischargePort
              shipFrom
              shipTo
              containerSeals
              containerSizeClass
              originPort
            }
          }
        }
      `;
    } else {
      // Default to basic shipmentDetails
      query = `
        query ShipmentDetails {
          shipmentDetails(
            ${reference ? `reference: "${reference}"` : ''}
            ${containerNumber ? `containerNumber: "${containerNumber}"` : ''}
          ) {
            shipmentStatus
            reference
            unitId
            shipmentDetailsURL
            stops {
              stopNumber
              locationType
              location
              city
              country
              latitude
              longitude
              milestones {
                eventCode
                eventName
                estimatedDate
                actualDate
                plannedDate
              }
            }
            originPort
            loadingPort
            dischargePort
            shipFrom
            shipTo
            containerSizeClass
            containerSeals
          }
        }
      `;
    }

    console.log('[OL-USA API] Querying shipment tracking:', {
      reference,
      containerNumber,
      queryType,
      environment,
      apiUrl: OL_USA_API_URL
    });

    // Make GraphQL request to OL-USA AccessHub
    const response = await fetch(OL_USA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': OL_USA_API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OL-USA API] Error response:', response.status, errorText);
      
      let errorMessage = `OL-USA API error: ${response.status}`;
      if (response.status === 401) {
        errorMessage = `Authentication failed (401 Unauthorized). The ${environment} API key may be invalid or expired. Please contact OL-USA for valid credentials.`;
      } else if (response.status === 404) {
        errorMessage = `Shipment not found (404). Please verify the reference or container number.`;
      } else {
        errorMessage += ` - ${errorText}`;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check for GraphQL errors
    if (data.errors) {
      console.error('[OL-USA API] GraphQL errors:', data.errors);
      return NextResponse.json(
        { error: 'GraphQL query error', details: data.errors },
        { status: 400 }
      );
    }

    console.log('[OL-USA API] Successfully retrieved shipment data');
    return NextResponse.json(data.data);

  } catch (error: any) {
    console.error('[OL-USA API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to query OL-USA API', details: error.message },
      { status: 500 }
    );
  }
}

