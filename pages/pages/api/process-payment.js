import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { playerId, packageId, amount, credits } = req.body;

  if (!playerId || !packageId || !amount || !credits) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('is_active', true)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    // Get package info
    const { data: package_, error: packageError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (packageError || !package_) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Validate amounts match
    if (parseFloat(package_.price) !== parseFloat(amount) || parseFloat(package_.credits) !== parseFloat(credits)) {
      return res.status(400).json({ message: 'Amount mismatch' });
    }

    // For demo purposes, simulate payment processing
    const paymentSuccessful = Math.random() > 0.1; // 90% success rate

    const transactionId = uuidv4();
    const newCredits = parseFloat(player.credits) + parseFloat(credits);

    if (paymentSuccessful) {
      // Record transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          player_id: playerId,
          package_id: packageId,
          amount: amount,
          credits_purchased: credits,
          payment_method: 'demo_payment',
          status: 'completed',
          completed_at: new Date().toISOString()
        });

      if (transactionError) {
        console.error('Transaction error:', transactionError);
        return res.status(500).json({ message: 'Transaction recording failed' });
      }

      // Update player credits
      const { error: updateError } = await supabase
        .from('players')
        .update({ 
          credits: newCredits,
          total_spent: parseFloat(player.total_spent || 0) + parseFloat(amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', playerId);

      if (updateError) {
        console.error('Player update error:', updateError);
        return res.status(500).json({ message: 'Player update failed' });
      }

      // Record credit history
      const { error: historyError } = await supabase
        .from('credit_history')
        .insert({
          player_id: playerId,
          transaction_id: transactionId,
          credits_change: credits,
          credits_before: player.credits,
          credits_after: newCredits,
          change_type: 'purchase',
          description: `Purchased ${package_.name}`
        });

      res.status(200).json({ 
        success: true, 
        message: 'Payment successful',
        newCredits: newCredits,
        transactionId: transactionId
      });
    } else {
      // Record failed transaction
      const { error: failedTransactionError } = await supabase
        .from('transactions')
        .insert({
          id: transactionId,
          player_id: playerId,
          package_id: packageId,
          amount: amount,
          credits_purchased: credits,
          payment_method: 'demo_payment',
          status: 'failed'
        });

      res.status(400).json({ 
        success: false, 
        message: 'Payment failed. Please try again.' 
      });
    }

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ message: 'Payment processing error' });
  }
}
