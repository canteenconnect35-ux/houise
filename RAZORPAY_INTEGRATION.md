# Razorpay Integration for Tambola Tron

## Overview
This document describes the Razorpay payment integration implemented in the Tambola Tron application for wallet top-up functionality.

## Features Implemented

### 1. Wallet Top-up with Razorpay
- Users can add money to their wallet using Razorpay payment gateway
- Minimum amount: ₹10
- Maximum amount: ₹10,000
- Real-time wallet balance update after successful payment
- Transaction history tracking

### 2. Payment Flow
1. User clicks "Add Money" button in the wallet section
2. A dialog opens asking for the amount
3. User enters amount and clicks "Pay with Razorpay"
4. Razorpay payment modal opens
5. User completes payment
6. On successful payment:
   - Wallet balance is updated in Supabase
   - Transaction record is created
   - User sees success notification
   - Dialog closes and wallet refreshes

### 3. Error Handling
- Input validation (amount limits)
- Payment failure handling
- Network error handling
- Database update error handling

## Technical Implementation

### Files Modified/Created
- `src/lib/razorpay.ts` - Razorpay utility functions
- `src/pages/User.tsx` - Updated with wallet top-up functionality

### Key Functions
- `loadRazorpayScript()` - Dynamically loads Razorpay checkout script
- `initializeRazorpayPayment()` - Initializes Razorpay payment modal directly
- `addMoneyToWallet()` - Main function handling the payment flow

### Razorpay Configuration
- **Key ID**: `rzp_live_HJl9NwyBSY9rwV`
- **Key Secret**: `1FlerafMmqHMw466ccsDxrhp`
- **Currency**: INR
- **Payment Capture**: Automatic

## Testing

### Test Mode
The integration is currently set up for testing. For production use:
1. Implement proper order creation on backend
2. Add webhook handling for payment verification
3. Use production Razorpay keys
4. Add payment signature verification

### Test Cards (if using test mode)
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

## Security Considerations

### Current Implementation
- Client-side order creation (for testing only)
- Direct wallet updates after payment

### Production Recommendations
1. Move order creation to backend
2. Implement webhook verification
3. Add payment signature verification
4. Use environment variables for keys
5. Implement proper error logging

## Database Schema

### Tables Used
- `users` - Wallet balance storage
- `transactions` - Payment history tracking

### Transaction Types
- `credit` - Money added to wallet
- `debit` - Money withdrawn from wallet

## Usage Instructions

1. Navigate to the User page
2. Click on the "Wallet" tab in bottom navigation
3. Click "Add Money" button
4. Enter desired amount (₹10 - ₹10,000)
5. Click "Pay with Razorpay"
6. Complete payment in Razorpay modal
7. Wallet will be updated automatically

## Future Enhancements

1. **Backend Integration**
   - Move order creation to backend API
   - Implement webhook handling
   - Add payment verification

2. **Additional Features**
   - Payment history with Razorpay transaction IDs
   - Refund functionality
   - Payment analytics
   - Multiple payment methods

3. **Security Improvements**
   - Environment variable configuration
   - Payment signature verification
   - Rate limiting
   - Audit logging

## Troubleshooting

### Common Issues
1. **Script not loading**: Check internet connection
2. **Payment modal not opening**: Check browser console for errors
3. **Wallet not updating**: Check Supabase connection and permissions
4. **Order creation failing**: Verify Razorpay key configuration

### Debug Mode
The integration includes console logging for debugging. Check browser console for:
- Order creation logs
- Payment success/failure logs
- Database update logs
- Error messages

## Support
For issues related to Razorpay integration, check:
1. Browser console for error messages
2. Network tab for API call failures
3. Supabase logs for database errors
4. Razorpay dashboard for payment status
