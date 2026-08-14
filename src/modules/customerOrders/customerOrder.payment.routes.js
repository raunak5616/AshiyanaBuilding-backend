import { Router } from 'express';
import crypto from 'crypto';
import { CustomerOrder } from '../../models/customerOrder.model.js';
import { env } from '../../config/env.config.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// GET /pay/:orderId - Renders standard Razorpay Checkout page
router.get(
  '/:orderId',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { redirect_url } = req.query; // Redirect target on completion

    const order = await CustomerOrder.findById(orderId).populate('customerUserId');
    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.paymentMethod !== 'online') {
      return res.status(400).send('<h3>Error: This order is not configured for online payment.</h3>');
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).send('<h3>This order is already paid.</h3>');
    }

    const fallbackRedirect = redirect_url || `${env.CLIENT_URL}/orders`;
    const customerName = order.shippingAddress.receiverName || 'Valued Customer';
    const customerPhone = order.shippingAddress.phone || '';

    // Render payment HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Payment - Ashiyana Building Materials</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      color: #1e293b;
    }
    .card {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #f59e0b;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 1.5rem auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 { margin-bottom: 0.5rem; font-weight: 800; }
    p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
    .btn {
      background: #f59e0b;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: bold;
      cursor: pointer;
      margin-top: 1rem;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="loader">
      <div class="spinner"></div>
      <h2>Redirecting to Payment Gateway</h2>
      <p>Please do not close this window or press the back button...</p>
    </div>
    <div id="error-box" style="display: none;">
      <h2 style="color: #ef4444;">Payment Error</h2>
      <p id="error-message">Something went wrong. Please try again.</p>
      <button class="btn" onclick="retryPayment()">Retry Payment</button>
    </div>
  </div>

  <script>
    function showError(msg) {
      document.getElementById('loader').style.display = 'none';
      const errBox = document.getElementById('error-box');
      errBox.style.display = 'block';
      document.getElementById('error-message').innerText = msg;
    }

    try {
      if (typeof Razorpay === 'undefined') {
        throw new Error("Razorpay SDK is not loaded. Please check your internet connection.");
      }

      const options = {
        key: ${JSON.stringify(env.RAZORPAY_KEY_ID)},
        amount: ${order.grandTotal},
        currency: "INR",
        name: "Ashiyana Building Materials",
        description: ${JSON.stringify("Order Payment: " + order.orderNumber)},
        order_id: ${JSON.stringify(order.razorpayOrderId || "")},
        handler: function (response) {
          verifyPayment(response);
        },
        prefill: {
          name: ${JSON.stringify(customerName)},
          contact: ${JSON.stringify(customerPhone)}
        },
        theme: {
          color: "#f59e0b"
        },
        modal: {
          ondismiss: function() {
            window.location.href = ${JSON.stringify(fallbackRedirect)} + "?status=cancelled&orderNumber=" + ${JSON.stringify(order.orderNumber)};
          }
        }
      };

      const rzp = new Razorpay(options);

      function startPayment() {
        try {
          rzp.open();
        } catch (e) {
          showError("Razorpay open failed: " + e.message);
        }
      }

      rzp.on('payment.failed', function (response){
        showError(response.error.description || "Payment failed.");
      });

      function retryPayment() {
        document.getElementById('error-box').style.display = 'none';
        document.getElementById('loader').style.display = 'block';
        startPayment();
      }

      function verifyPayment(paymentDetails) {
        document.getElementById('loader').style.display = 'block';
        document.getElementById('error-box').style.display = 'none';

        fetch('/api/v1/orders/pay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: ${JSON.stringify(order._id)},
            razorpay_payment_id: paymentDetails.razorpay_payment_id,
            razorpay_order_id: paymentDetails.razorpay_order_id,
            razorpay_signature: paymentDetails.razorpay_signature
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            window.location.href = ${JSON.stringify(fallbackRedirect)} + "?status=success&orderNumber=" + ${JSON.stringify(order.orderNumber)};
          } else {
            showError(data.message || "Payment verification failed.");
          }
        })
        .catch(err => {
          showError("Network error. Verification failed.");
        });
      }

      // Launch payment immediately and fallback to events
      startPayment();
      document.addEventListener("DOMContentLoaded", startPayment);
      window.onload = startPayment;
    } catch (err) {
      showError(err.message);
    }
  </script>
</body>
</html>
    `;

    return res.status(200).send(html);
  })
);

// POST /pay/verify - Verifies Razorpay signatures
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      throw ApiError.badRequest('Missing payment details for verification', 'PAYMENT_MISSING_DETAILS');
    }

    const order = await CustomerOrder.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    // Verify signature using crypto
    const generated_signature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      throw ApiError.badRequest('Payment verification signature mismatch', 'PAYMENT_VERIFICATION_FAILED');
    }

    // Update payment details on order
    order.paymentStatus = 'paid';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    return res.status(200).json(new ApiResponse(200, 'Payment verified successfully', order));
  })
);

export default router;
