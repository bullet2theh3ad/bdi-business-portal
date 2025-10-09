'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, DollarSign, Trash2 } from 'lucide-react';

export interface PaymentLineItem {
  paymentNumber: number;
  paymentDate: string;
  amount: number;
  notes: string;
  isPaid?: boolean;
}

interface PaymentScheduleSectionProps {
  paymentLineItems: PaymentLineItem[];
  onAdd: () => void;
  onUpdate: (index: number, field: keyof PaymentLineItem, value: any) => void;
  onRemove: (index: number) => void;
  totalPaid: number;
}

export function PaymentScheduleSection({
  paymentLineItems,
  onAdd,
  onUpdate,
  onRemove,
  totalPaid,
}: PaymentScheduleSectionProps) {
  
  const getPaymentCardBackground = (payment: PaymentLineItem) => {
    const today = new Date();
    const paymentDate = new Date(payment.paymentDate);
    
    if (payment.isPaid) {
      return 'bg-white border-green-200';
    } else if (paymentDate >= today) {
      return 'bg-yellow-50 border-yellow-300';
    } else {
      return 'bg-red-50 border-red-300';
    }
  };

  return (
    <div className="space-y-4 border-t pt-6 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Schedule</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="text-sm"
        >
          + Add Payment
        </Button>
      </div>

      {paymentLineItems.map((payment, index) => (
        <div
          key={index}
          className={`border-2 rounded-lg p-4 transition-colors ${getPaymentCardBackground(payment)}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Payment Number */}
            <div className="md:col-span-2">
              <Label className="text-xs">Payment #</Label>
              <Input
                type="number"
                value={payment.paymentNumber}
                onChange={(e) => onUpdate(index, 'paymentNumber', parseInt(e.target.value))}
                className="h-9"
              />
            </div>

            {/* Payment Date */}
            <div className="md:col-span-3">
              <Label className="text-xs">Payment Date *</Label>
              <Input
                type="date"
                value={payment.paymentDate}
                onChange={(e) => onUpdate(index, 'paymentDate', e.target.value)}
                required
                className="h-9"
              />
            </div>

            {/* Amount */}
            <div className="md:col-span-2">
              <Label className="text-xs">Amount ($) *</Label>
              <Input
                type="number"
                step="0.01"
                value={payment.amount}
                onChange={(e) => onUpdate(index, 'amount', parseFloat(e.target.value) || 0)}
                required
                className="h-9 text-green-600 font-semibold"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-3">
              <Label className="text-xs">Notes</Label>
              <Input
                type="text"
                value={payment.notes}
                onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                placeholder="e.g., 50% of tooling"
                className="h-9"
              />
            </div>

            {/* Actions */}
            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                variant={payment.isPaid ? 'default' : 'outline'}
                onClick={() => onUpdate(index, 'isPaid', !payment.isPaid)}
                className={`flex-1 h-9 ${
                  payment.isPaid
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'border-gray-300'
                }`}
              >
                {payment.isPaid ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Paid
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-1" />
                    To Pay
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onRemove(index)}
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {paymentLineItems.length > 0 && (
        <div className="flex items-center justify-center mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onAdd}
            className="border-2 border-dashed border-green-400 text-green-600 hover:bg-green-50"
          >
            + Add Another Payment
          </Button>
        </div>
      )}

      {paymentLineItems.length > 0 && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-green-900">Total Paid:</span>
            <span className="text-2xl font-bold text-green-600">
              ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

