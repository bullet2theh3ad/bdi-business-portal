# OL-USA Shipment Tracking Integration

## Overview
This document describes the OL-USA AccessHub API integration for shipment tracking functionality added to the BDI Business Portal.

## Features
- **Real-time shipment tracking** through OL-USA AccessHub GraphQL API
- **Mobile-optimized full-page modal** for detailed shipment information
- **Multiple query types** supported (ShipmentDetailsV2, FullTransportDetails)
- **Comprehensive tracking data** including stops, milestones, and timeline

## Files Created/Modified

### New Files
1. **`/app/api/warehouses/ol-usa/shipments/route.ts`**
   - API endpoint for querying OL-USA AccessHub
   - Handles GraphQL query construction and execution
   - Returns shipment tracking data

2. **`/components/OLShipmentTrackingModal.tsx`**
   - Full-page modal component for shipment tracking
   - Search form with reference/container number inputs
   - Detailed results display with stops and milestones
   - Mobile-responsive design

### Modified Files
1. **`/app/(dashboard)/inventory/warehouses/page.tsx`**
   - Added "Where's My Shipment" button for OLM warehouse
   - Integrated OLShipmentTrackingModal component
   - Added modal state management

## Environment Configuration

### Sandbox Environment (Default)
The sandbox environment is **hardcoded** in the application with test credentials:
- **URL**: `https://tf-uat-accesshub.azurewebsites.net/move/`
- **API Key**: `259e2642-2269-48d6-91f9-be580f5c6f13`

No environment variables needed for sandbox testing!

### Production Environment (Optional)
For production use, add the following to your `.env.local` file:

```bash
# OL-USA AccessHub Production Configuration
OL_USA_API_URL=https://api.olxhub.app/move
OL_USA_API_KEY=your-production-api-key-here
```

**Note**: If production credentials are not configured, the production option will show an error when selected.

## API Documentation Reference

The integration is based on the OL-USA AccessHub GraphQL API documentation located in:
- `/API/AccessHubDocumentation_24-09-06/`
  - `GetStartedWithMoveAccessHub.docx`
  - `MoveHttpCollection/` - Postman collection
  - `SampleQueries/` - GraphQL query examples

## Usage

1. **Access the feature**:
   - Navigate to `/inventory/warehouses`
   - Find the warehouse with code `OLM`
   - Click the "Where's My Shipment" button

2. **Search for shipments**:
   - **Select Environment**: Choose between 🧪 Sandbox (Testing) or 🚀 Production
   - Enter either a **Reference Number** or **Container Number**
   - Select the query type (ShipmentDetailsV2 or FullTransportDetails)
   - Click "Track Shipment"

3. **View results**:
   - **Environment Badge**: Shows which environment is active
   - **Shipment Summary**: Status, reference, unit ID, ports, container details
   - **Journey Timeline**: Stops with location details and milestones
   - **Milestone Details**: Planned, estimated, and actual dates for each event

## API Endpoints

### POST `/api/warehouses/ol-usa/shipments`

**Request Body**:
```json
{
  "reference": "SHIP123",           // Optional: Shipment reference number
  "containerNumber": "CONT456",     // Optional: Container number
  "queryType": "shipmentDetailsV2", // Options: shipmentDetailsV2, fullTransportDetails
  "environment": "sandbox",         // Options: sandbox (default), production
  "verbose": true                   // Optional: Include verbose details
}
```

**Response** (ShipmentDetailsV2):
```json
{
  "shipmentDetailsV2": {
    "shipmentStatus": "In Transit",
    "reference": "SHIP123",
    "unitId": "CONT456",
    "shipmentDetailsURL": "https://...",
    "originPort": "Shanghai",
    "loadingPort": "Shanghai",
    "dischargePort": "Los Angeles",
    "shipFrom": "Shanghai, China",
    "shipTo": "Los Angeles, USA",
    "containerSeals": "SEAL123",
    "containerSizeClass": "40HC",
    "stops": [
      {
        "stopNumber": 1,
        "locationType": "Port",
        "location": "Shanghai Port",
        "city": "Shanghai",
        "country": "China",
        "milestones": [
          {
            "eventCode": "LOAD",
            "eventName": "Loaded on Vessel",
            "plannedDate": "2025-10-01T00:00:00Z",
            "estimatedDate": "2025-10-01T08:00:00Z",
            "actualDate": "2025-10-01T09:30:00Z"
          }
        ]
      }
    ]
  }
}
```

## GraphQL Query Types

### 1. ShipmentDetailsV2
Best for tracking individual containers with detailed information.

```graphql
query ShipmentDetailsV2 {
  shipmentDetailsV2(
    reference: "SHIP123"
    verbose: true
  ) {
    shipmentStatus
    reference
    unitId
    shipmentDetailsURL
    stops { ... }
    originPort
    loadingPort
    dischargePort
    shipFrom
    shipTo
    containerSeals
    containerSizeClass
  }
}
```

### 2. FullTransportDetails
Best for tracking shipments with multiple containers.

```graphql
query FullTransportDetails {
  fullTransportDetails(
    reference: "SHIP123"
    verbose: true
  ) {
    shipmentStatus
    reference
    shipmentDetailsURL
    containers {
      unitId
      stops { ... }
      loadingPort
      dischargePort
    }
  }
}
```

## Testing

### Using cURL
```bash
# Test the API endpoint directly
curl -X POST http://localhost:3000/api/warehouses/ol-usa/shipments \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "TEST123",
    "queryType": "shipmentDetailsV2",
    "verbose": true
  }'
```

### Using the UI
1. Ensure you have a warehouse with code `OLM` in the database
2. Navigate to the Warehouses page
3. Click "Where's My Shipment" on the OLM warehouse card
4. Enter test data:
   - Reference: Any valid reference from your OL-USA account
   - Or Container Number: Any valid container number

## Error Handling

The system handles various error scenarios:
- **Missing API Key**: Returns 500 error with "OL-USA API key not configured"
- **Invalid Reference/Container**: Returns 400 error from OL-USA API
- **Network Issues**: Displays user-friendly error message in the modal
- **No Results Found**: Shows "No shipment data found" message

## Mobile Responsiveness

The modal is fully optimized for mobile devices:
- Full-page overlay on mobile devices
- Responsive grid layouts for shipment details
- Touch-friendly buttons and inputs
- Scrollable content areas

## Future Enhancements

Potential improvements for future iterations:
1. **Shipment History**: Store and display historical tracking queries
2. **Push Notifications**: Alert users when shipment status changes
3. **Bulk Tracking**: Track multiple shipments simultaneously
4. **Export Functionality**: Export tracking data to PDF/Excel
5. **Map Integration**: Visual map display of shipment journey
6. **Predictive ETA**: AI-based arrival time predictions

## Support

For issues or questions:
- Check OL-USA AccessHub API documentation in `/API/` folder
- Review GraphQL sample queries in `/API/AccessHubDocumentation_24-09-06/SampleQueries/`
- Contact OL-USA support for API-related issues

## Deployment Notes

Before deploying to production:
1. ✅ Update `.env.local` with production API credentials
2. ✅ Ensure OLM warehouse exists in the database
3. ✅ Test with real shipment references
4. ✅ Verify API rate limits with OL-USA
5. ✅ Configure error logging and monitoring

---

**Created**: October 31, 2025  
**Last Updated**: October 31, 2025  
**Version**: 1.0.0

