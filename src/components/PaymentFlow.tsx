// Payment Flow Component
// Complete payment processing with Stripe Elements

import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { paymentService } from '@/lib/payment-service';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  amount: number;
  campaignId?: string;
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
}

function CheckoutForm({ amount, campaignId, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/payment/success',
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('Payment successful!');
        onSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      setMessage(err.message);
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Payment Amount</Label>
        <div className="text-3xl font-bold text-gray-900 mt-2">
          ${amount.toFixed(2)}
        </div>
      </div>

      <PaymentElement />

      {message && (
        <Alert variant={message.includes('successful') ? 'default' : 'destructive'}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full"
        size="lg"
      >
        {processing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </Button>
    </form>
  );
}

export default function PaymentFlow() {
  const [amount, setAmount] = useState(100);
  const [campaignId, setCampaignId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState({ available: 0, pending: 0, currency: 'usd' });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new-payment');

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      const [methods, txs, bal] = await Promise.all([
        paymentService.listPaymentMethods().catch(() => []),
        paymentService.getTransactionHistory(20).catch(() => []),
        paymentService.getBalance().catch(() => ({ available: 0, pending: 0, currency: 'usd' })),
      ]);

      setPaymentMethods(methods || []);
      setTransactions(txs || []);
      setBalance(bal || { available: 0, pending: 0, currency: 'usd' });
    } catch (error) {
      console.error('Failed to load payment data:', error);
      // Set defaults on error
      setPaymentMethods([]);
      setTransactions([]);
      setBalance({ available: 0, pending: 0, currency: 'usd' });
    }
  };

  const handleCreatePayment = async () => {
    try {
      setLoading(true);
      const intent = await paymentService.createPaymentIntent(amount, 'usd', {
        campaignId: campaignId || undefined,
      });

      if (intent.clientSecret) {
        setClientSecret(intent.clientSecret);
        setActiveTab('checkout');
      }
    } catch (error: any) {
      console.error('Failed to create payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    console.log('Payment successful:', transactionId);
    await loadPaymentData();
    setClientSecret('');
    setActiveTab('history');
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Center</h1>
          <p className="text-gray-600">Manage payments, subscriptions, and transactions</p>
        </div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(balance?.available || 0).toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(balance?.pending || 0).toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">Processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <CreditCard className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentMethods.length}</div>
              <p className="text-xs text-gray-500 mt-1">Saved cards</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="new-payment">New Payment</TabsTrigger>
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          </TabsList>

          {/* New Payment Tab */}
          <TabsContent value="new-payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Payment</CardTitle>
                <CardDescription>Enter payment details to proceed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    min="1"
                    step="0.01"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="campaignId">Campaign ID (Optional)</Label>
                  <Input
                    id="campaignId"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    placeholder="Enter campaign ID"
                    className="mt-2"
                  />
                </div>

                <Button
                  onClick={handleCreatePayment}
                  disabled={loading || amount <= 0}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Creating...' : 'Continue to Checkout'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checkout Tab */}
          <TabsContent value="checkout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Complete Payment</CardTitle>
                <CardDescription>Enter your payment information</CardDescription>
              </CardHeader>
              <CardContent>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={options}>
                    <CheckoutForm
                      amount={amount}
                      campaignId={campaignId}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                ) : (
                  <Alert>
                    <AlertDescription>
                      Please create a payment first from the "New Payment" tab
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transaction History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>View all your payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(Array.isArray(transactions) ? transactions : []).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.id}</TableCell>
                      <TableCell>
                        <Badge variant={
                          tx.status === 'succeeded' ? 'default' :
                          tx.status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>${(tx.amount / 100).toFixed(2)}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>{new Date(tx.created).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="methods" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Payment Methods</CardTitle>
                <CardDescription>Manage your payment methods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(Array.isArray(paymentMethods) ? paymentMethods : []).map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{method.card.brand.toUpperCase()} •••• {method.card.last4}</p>
                          <p className="text-sm text-gray-500">Expires {method.card.exp_month}/{method.card.exp_year}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">Remove</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}