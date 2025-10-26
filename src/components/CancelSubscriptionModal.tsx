// components/CancelSubscriptionModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../lib/supabase';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  subscriptionType: 'monthly' | 'annual' | 'trial';
  onSuccess: () => void;
}

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  companyId,
  subscriptionType,
  onSuccess
}: CancelSubscriptionModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [step, setStep] = useState<'reason' | 'confirm'>('reason');

  if (!isOpen) return null;

  const reasons = [
    { value: 'too_expensive', label: 'Too expensive' },
    { value: 'not_using', label: 'Not using the product' },
    { value: 'missing_features', label: 'Missing features I need' },
    { value: 'found_alternative', label: 'Found a better alternative' },
    { value: 'temporary', label: 'Temporary - will be back' },
    { value: 'other', label: 'Other reason' }
  ];

  const handleCancel = async () => {
    if (!reason) {
      alert('Please select a reason for cancellation');
      return;
    }

    setCancelling(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Different function for trial vs subscription cancellation
      const functionName = subscriptionType === 'trial' ? 'cancel-trial' : 'cancel-subscription';
      
      const response = await supabase.functions.invoke(functionName, {
  body: { 
    companyId,
    reason,
    feedback
  },
  headers: {
    Authorization: `Bearer ${session?.access_token}`
  }
});

if (response.error) {
  throw new Error(response.error.message || `Failed to cancel ${subscriptionType === 'trial' ? 'trial' : 'subscription'}`);
}

// Check if account was locked (second cancellation)
if (response.data?.accountLocked) {
  alert('Your subscription has been cancelled and your account has been locked immediately. You will need to subscribe again to regain access.');
  onSuccess();
  onClose();
  return;
}

// Show success message based on subscription type
if (subscriptionType === 'trial') {
  alert('Your trial has been cancelled and your account has been locked.');
} else if (subscriptionType === 'annual') {
  alert('Your subscription has been cancelled and your account has been locked immediately. You will need to subscribe again to regain access.');
} else {
  // First monthly cancellation - show how many days they have
  const daysRemaining = response.data?.days_remaining || 30;
  alert(`Your subscription has been cancelled. You will continue to have access for ${daysRemaining} days.`);
}

onSuccess();
onClose();

    } catch (error) {
      console.error('Cancellation error:', error);
      alert(error instanceof Error ? error.message : `Failed to cancel ${subscriptionType === 'trial' ? 'trial' : 'subscription'}`);
    } finally {
      setCancelling(false);
    }
  };

  const resetModal = () => {
    setStep('reason');
    setReason('');
    setFeedback('');
    onClose();
  };

  const modalTitle = subscriptionType === 'trial' ? 'Cancel Trial' : 'Cancel Subscription';
  const confirmTitle = subscriptionType === 'trial' ? 'Confirm Trial Cancellation' : 'Confirm Cancellation';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-[#1a1625] border border-white/10 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:border-white/20 transition-all duration-300">
        <CardHeader className="relative">
          <button
            onClick={resetModal}
            className="absolute right-4 top-4 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <CardTitle className="text-xl text-white">
            {step === 'reason' ? modalTitle : confirmTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'reason' ? (
            <div className="space-y-4">
              <p className="text-gray-300">
                We're sorry to see you go. Please let us know why you're cancelling:
              </p>
              
              <div className="space-y-2">
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center space-x-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">{r.label}</span>
                  </label>
                ))}
              </div>

              {reason === 'other' && (
                <textarea
                  placeholder="Please tell us more..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400"
                  rows={3}
                />
              )}

              <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
                <p className="text-amber-300 text-sm">
                  <strong>What happens when you cancel:</strong>
                </p>
                <ul className="mt-2 text-gray-300 text-sm space-y-1">
                  {subscriptionType === 'trial' ? (
                    <>
                      <li>• Your account will be locked immediately</li>
                      <li>• You'll lose access to all features</li>
                      <li>• Your data will be preserved for 30 days</li>
                      <li>• You can subscribe anytime to regain access</li>
                    </>
                  ) : subscriptionType === 'annual' ? (
  <>
    <li>• Your account will be locked immediately</li>
    <li>• No refunds for unused time</li>
    <li>• Your data will be preserved for 30 days</li>
    <li>• You'll need to start a new subscription to regain access</li>
  </>
                  ) : (
                    <>
                      <li>• You'll keep access for 30 days</li>
                      <li>• No more monthly charges</li>
                      <li>• Your data will be preserved</li>
                      <li>• You can reactivate anytime</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={resetModal}
                  variant="outline"
                  className="flex-1 text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-200"
                >
                  {subscriptionType === 'trial' ? 'Keep Trial' : 'Keep Subscription'}
                </Button>
                <Button
                  onClick={() => setStep('confirm')}
                  disabled={!reason}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                <p className="text-red-300 font-semibold">
                  Are you absolutely sure?
                </p>
                <p className="text-gray-300 text-sm mt-2">
                  {subscriptionType === 'trial' 
                    ? 'Your account will be locked immediately and you will lose access to all features.'
                    : 'This action cannot be undone. You will need to subscribe again to regain access after your current period ends.'}
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Cancellation reason:</p>
                <p className="text-white mt-1">
                  {reasons.find(r => r.value === reason)?.label}
                </p>
                {feedback && (
                  <>
                    <p className="text-gray-400 text-sm mt-3">Additional feedback:</p>
                    <p className="text-white mt-1">{feedback}</p>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep('reason')}
                  variant="outline"
                  disabled={cancelling}
                  className="flex-1 text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {cancelling ? 'Cancelling...' : (subscriptionType === 'trial' ? 'Cancel Trial' : 'Cancel Subscription')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}