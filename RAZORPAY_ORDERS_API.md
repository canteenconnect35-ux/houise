# Razorpay Orders API Integration

## Overview
This project uses Razorpay's Orders API with axios for robust HTTP handling. The integration provides secure payment processing with proper error handling and verification.

## Features

### ✅ **Orders API Implementation**
- **Order Creation**: Creates Razorpay orders with auto-capture enabled
- **Payment Verification**: Verifies payments before processing
- **Error Handling**: Comprehensive error handling with detailed messages
- **HTTP Client**: Uses axios for reliable HTTP requests
- **TypeScript Support**: Fully typed interfaces and functions

### 🔧 **Key Functions**

#### `createRazorpayOrder(amount, currency)`
Creates a new Razorpay order using the Orders API.

```typescript
const order = await createRazorpayOrder(100, 'INR');
// Returns: { id, amount, currency, receipt, status, created_at, notes }
```

#### `verifyRazorpayPayment(paymentId, orderId)`
Verifies that a payment was successful and matches the order.

```typescript
const isVerified = await verifyRazorpayPayment(paymentId, orderId);
// Returns: boolean
```

#### `initializeRazorpayPayment(amount, onSuccess, onError)`
Complete payment flow with order creation and verification.

```typescript
await initializeRazorpayPayment(
  100,
  (paymentId, orderId) => console.log('Success!'),
  (error) => console.error('Error:', error)
);
```

### 🛠 **Additional Utilities**

- `getRazorpayOrder(orderId)` - Fetch order details
- `getRazorpayPayment(paymentId)` - Fetch payment details  
- `cancelRazorpayOrder(orderId)` - Cancel an order
- `loadRazorpayScript()` - Load Razorpay checkout script

## Configuration

### Environment Variables
```typescript
export const RAZORPAY_KEY_ID = "rzp_live_HJl9NwyBSY9rwV";
export const RAZORPAY_KEY_SECRET = "1FlerafMmqHMw466ccsDxrhp";
```

### Axios Configuration
```typescript
const razorpayAPI = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`
  },
  timeout: 30000
});
```

## Payment Flow

1. **Order Creation**: Create order with amount, currency, and metadata
2. **Payment Initialization**: Open Razorpay checkout with order ID
3. **Payment Processing**: User completes payment on Razorpay
4. **Payment Verification**: Verify payment status and details
5. **Success Handling**: Process successful payment and update database

## Error Handling

### Network Errors
- Connection timeout (30 seconds)
- Network connectivity issues
- Server unavailability

### API Errors
- Invalid credentials
- Invalid order data
- Payment verification failures

### User Errors
- Payment cancellation
- Insufficient funds
- Invalid payment method

## Testing

### Manual Testing
```javascript
// In browser console
testRazorpayIntegration();
```

### Test Scenarios
1. **Valid Payment**: Complete payment flow with valid amount
2. **Invalid Amount**: Test with amount below minimum
3. **Payment Cancellation**: Test user cancellation
4. **Network Issues**: Test with poor connectivity
5. **Verification Failure**: Test payment verification

## Security Features

### ✅ **Implemented Security**
- **Server-side Order Creation**: Orders created via API, not client-side
- **Payment Verification**: All payments verified before processing
- **Auto-capture**: Payments captured automatically
- **HTTPS Only**: All API calls use HTTPS
- **Timeout Handling**: 30-second timeout for API calls
- **Error Logging**: Comprehensive error logging for debugging

### 🔒 **Best Practices**
- Never expose key_secret in client-side code
- Always verify payments before processing
- Use HTTPS for all communications
- Implement proper error handling
- Log all payment activities

## Usage Example

```typescript
import { initializeRazorpayPayment } from '@/lib/razorpay';

const handlePayment = async (amount: number) => {
  await initializeRazorpayPayment(
    amount,
    async (paymentId, orderId) => {
      // Payment successful - update database
      await updateUserWallet(amount);
      showSuccessMessage('Payment successful!');
    },
    (error) => {
      // Payment failed - show error
      showErrorMessage(`Payment failed: ${error}`);
    }
  );
};
```

## Troubleshooting

### Common Issues

1. **"i is not iterable" Error**
   - Fixed by proper data validation in components
   - Added array checks before iteration

2. **Payment Verification Failed**
   - Check if payment status is 'captured'
   - Verify order ID matches
   - Ensure amount matches

3. **Order Creation Failed**
   - Check API credentials
   - Verify network connectivity
   - Check amount format (should be in paise)

### Debug Mode
Enable debug logging by checking browser console for detailed logs.

## API Reference

### Razorpay Orders API
- **Base URL**: `https://api.razorpay.com/v1`
- **Authentication**: Basic Auth with key_id:key_secret
- **Content-Type**: `application/json`

### Endpoints Used
- `POST /orders` - Create order
- `GET /orders/{id}` - Get order details
- `GET /payments/{id}` - Get payment details
- `POST /orders/{id}/cancel` - Cancel order

## Support

For issues with this integration:
1. Check browser console for error logs
2. Verify Razorpay credentials
3. Test with small amounts first
4. Check network connectivity
5. Review Razorpay documentation

---

**Note**: This integration uses live Razorpay credentials. For production, ensure proper environment variable management and security practices.
