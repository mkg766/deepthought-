# The 2D Story Method

Static site and Vercel Functions for a ₹129 Razorpay checkout.

## Configure Vercel

1. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as encrypted environment variables in the Vercel project settings. Create and test with a Razorpay **test** key first; switch to live keys only after testing. The supplied key is a live key, so do not use it for test transactions. Do not put credentials in `index.html`, source control, or a public `.env` file.
2. Add the finished PDF at `private/the-2d-story-method.pdf`. The build publishes only `public/`; the download function bundles the PDF privately and releases it only with a valid, unexpired payment token.
3. Import the project into Vercel. The configured build command prepares `public/`, which is the output directory.
4. Test a successful payment and a failed payment with Razorpay test credentials before changing the environment variables to live credentials.

The order amount is fixed on the server at 12,900 paise (₹129). The payment verification function checks the Razorpay signature and confirms the amount, order and currency with Razorpay. Authorized payments are captured server-side before a download token is issued. Tokens expire after 24 hours.

Checkout intentionally refuses to create an order until the PDF and Razorpay environment variables are configured. The site does not collect card or UPI details itself.

## Local checks

Run `npm test` for payment helper tests and `npm run build` to prepare the static output.
