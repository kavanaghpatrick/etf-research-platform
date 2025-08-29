'use client';

import React, { useState, useCallback } from 'react';
import { 
  ChatBubbleLeftEllipsisIcon, 
  XMarkIcon, 
  FaceSmileIcon,
  FaceFrownIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  BugAntIcon,
  LightBulbIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  rating: number;
  message: string;
  page: string;
  timestamp: number;
  userAgent: string;
  sessionId: string;
}

interface UserFeedbackSystemProps {
  onSubmitFeedback?: (feedback: FeedbackData) => void;
  className?: string;
}

export default function UserFeedbackSystem({ 
  onSubmitFeedback, 
  className = '' 
}: UserFeedbackSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'rating' | 'details' | 'success'>('rating');
  const [rating, setRating] = useState<number>(0);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'improvement' | 'general'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRatingClick = useCallback((selectedRating: number) => {
    setRating(selectedRating);
    setStep('details');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    
    const feedbackData: FeedbackData = {
      type: feedbackType,
      rating,
      message: message.trim(),
      page: window.location.pathname,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: sessionStorage.getItem('sessionId') || 'anonymous'
    };

    try {
      // Send to custom handler if provided
      if (onSubmitFeedback) {
        await onSubmitFeedback(feedbackData);
      }

      // Send to feedback endpoint
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      setStep('success');
      
      // Close after success
      setTimeout(() => {
        setIsOpen(false);
        setStep('rating');
        setRating(0);
        setMessage('');
        setFeedbackType('general');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [feedbackType, rating, message, onSubmitFeedback]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setStep('rating');
    setRating(0);
    setMessage('');
    setFeedbackType('general');
  }, []);

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <BugAntIcon className="h-5 w-5 text-red-500" />;
      case 'feature':
        return <LightBulbIcon className="h-5 w-5 text-yellow-500" />;
      case 'improvement':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRatingEmoji = (ratingValue: number) => {
    if (ratingValue >= 4) return '😊';
    if (ratingValue >= 3) return '😐';
    return '😞';
  };

  return (
    <div className={className}>
      {/* Feedback Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        aria-label="Provide feedback"
      >
        <ChatBubbleLeftEllipsisIcon className="h-6 w-6" />
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {step === 'rating' && 'How was your experience?'}
                {step === 'details' && 'Tell us more'}
                {step === 'success' && 'Thank you!'}
              </h3>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {step === 'rating' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Rate your experience with the portfolio simulation
                  </p>
                  
                  {/* Rating Stars */}
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRatingClick(star)}
                        className={`text-2xl transition-colors ${
                          star <= rating ? 'text-yellow-400' : 'text-gray-300'
                        } hover:text-yellow-400`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <button
                      onClick={() => {
                        setRating(5);
                        setFeedbackType('general');
                        setStep('details');
                      }}
                      className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <HandThumbUpIcon className="h-5 w-5 text-green-500" />
                      <span className="text-sm">It's great!</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setRating(2);
                        setFeedbackType('bug');
                        setStep('details');
                      }}
                      className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <HandThumbDownIcon className="h-5 w-5 text-red-500" />
                      <span className="text-sm">Report Issue</span>
                    </button>
                  </div>
                </div>
              )}

              {step === 'details' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">{getRatingEmoji(rating)}</div>
                    <p className="text-sm text-gray-600">
                      Rating: {rating}/5 stars
                    </p>
                  </div>

                  {/* Feedback Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Feedback Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'bug', label: 'Bug Report' },
                        { value: 'feature', label: 'Feature Request' },
                        { value: 'improvement', label: 'Improvement' },
                        { value: 'general', label: 'General' }
                      ].map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setFeedbackType(type.value as any)}
                          className={`flex items-center space-x-2 p-2 text-sm rounded-lg border ${
                            feedbackType === type.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {getFeedbackTypeIcon(type.value)}
                          <span>{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about your experience..."
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isSubmitting}
                    className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !message.trim() || isSubmitting
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center space-y-4">
                  <div className="text-4xl">✅</div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Feedback Submitted!
                    </h4>
                    <p className="text-sm text-gray-600">
                      Thank you for helping us improve the portfolio simulation experience.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}