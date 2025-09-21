import React, { useState, useEffect } from 'react';
import { CreditCard, User, DollarSign, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import Head from 'next/head';

export default function StandalonePOS() {
  const [urlParams, setUrlParams] = useState(null);
  const [playerIdFromUrl, setPlayerIdFromUrl] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [gameUrl, setGameUrl] = useState('');
  const [creditPackages, setCreditPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize URL parameters on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setUrlParams(params);
      const playerId = params.get('playerId') || params.get('player') || params.get('userId');
      setPlayerIdFromUrl(playerId);
      
      const gameUrlParam = params.get('gameUrl') || params.get('returnUrl');
      const referrerUrl = document.referrer;
      setGameUrl(gameUrlParam || referrerUrl || 'about:blank');
    }
  }, []);

  // Load credit packages and authenticate player
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Load credit packages
        const packagesResponse = await fetch('/api/credit-packages');
        if (packagesResponse.ok) {
          const packages = await packagesResponse.json();
          setCreditPackages(packages);
        }

        // Authenticate player if ID provided
        if (playerIdFromUrl) {
          const playerResponse = await fetch(`/api/players/${playerIdFromUrl}`);
          if (playerResponse.ok) {
            const player = await playerResponse.json();
            setCurrentPlayer(player);
            setMessage(`Welcome back, ${player.username}!`);
          } else {
            setMessage('Player not found. Please check your player ID.');
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setMessage('Error loading system. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    if (playerIdFromUrl !== null) {
      initializeData();
    } else {
      setLoading(false);
    }
  }, [playerIdFromUrl]);

  // Process payment
  const processPayment = async () => {
    if (!currentPlayer || !selectedPackage) {
      setMessage('Please select a credit package');
      return;
    }

    setProcessing(true);
    const package_ = creditPackages.find(p => p.id === selectedPackage);
    
    try {
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          packageId: selectedPackage,
          amount: package_.price,
          credits: package_.credits,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update player credits locally
        const newCredits = parseFloat(currentPlayer.credits) + parseFloat(package_.credits);
        setCurrentPlayer(prev => ({ ...prev, credits: newCredits }));

        setMessage(`Payment successful! ${package_.credits} credits added. New balance: ${newCredits} credits`);
        
        // Reset form
        setSelectedPackage('');
        
        // Auto-redirect back to game after 3 seconds
        setTimeout(() => {
          returnToGame();
        }, 3000);
        
      } else {
        setMessage(result.message || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setMessage('Payment processing error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const returnToGame = () => {
    if (gameUrl && gameUrl !== 'about:blank') {
      try {
        const updatedUrl = new URL(gameUrl);
        updatedUrl.searchParams.set('creditsUpdated', 'true');
        updatedUrl.searchParams.set('playerId', currentPlayer?.id || '');
        window.location.href = updatedUrl.toString();
      } catch (error) {
        window.location.href = gameUrl;
      }
    } else {
      if (window.opener) {
        window.close();
      } else {
        setMessage('Payment completed! Please return to your game.');
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Game Credits Store</title>
        <meta name="description" content="Purchase game credits securely" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600">
              Game Credits Store
            </h1>
            {gameUrl && gameUrl !== 'about:blank' && (
              <button
                onClick={returnToGame}
                className="flex items-center px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Game
              </button>
            )}
          </div>

          {/* Player Info */}
          {currentPlayer ? (
            <div className="mb-8 p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="flex items-center mb-2">
                <User className="mr-2 text-green-600" />
                <span className="font-semibold text-green-800">Player Authenticated</span>
              </div>
              <p><strong>Username:</strong> {currentPlayer.username}</p>
              <p><strong>Current Credits:</strong> {parseFloat(currentPlayer.credits || 0).toFixed(2)}</p>
            </div>
          ) : (
            <div className="mb-8 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <div className="flex items-center mb-2">
                <AlertCircle className="mr-2 text-yellow-600" />
                <span className="font-semibold text-yellow-800">Player Authentication Required</span>
              </div>
              <p>Please access this page from your game or provide a valid player ID.</p>
              <p className="text-sm text-gray-600 mt-2">
                URL format: {typeof window !== 'undefined' ? window.location.origin : ''}?playerId=YOUR_PLAYER_ID
              </p>
            </div>
          )}

          {/* Credit Package Selection */}
          {currentPlayer && creditPackages.length > 0 && (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <DollarSign className="mr-2" /> Quick Credits - $5 Minimum
                </h2>
                <p className="text-gray-600 mb-4">1:1 ratio - $1 = 1 credit</p>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {creditPackages.map(package_ => (
                    <div 
                      key={package_.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedPackage === package_.id 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedPackage(package_.id)}
                    >
                      <h3 className="font-bold text-lg">{package_.name}</h3>
                      <p className="text-2xl font-bold text-green-600">${parseFloat(package_.price).toFixed(2)}</p>
                      <p className="text-blue-600 font-semibold">{parseFloat(package_.credits).toFixed(0)} Credits</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Process Payment Button */}
              <div className="text-center mb-6">
                <button
                  onClick={processPayment}
                  disabled={!selectedPackage || processing}
                  className={`px-8 py-3 rounded-lg font-semibold text-white transition-all text-lg ${
                    (!selectedPackage || processing)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing Payment...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <CreditCard className="mr-2" /> 
                      Purchase {selectedPackage && creditPackages.find(p => p.id === selectedPackage)?.name}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Status Message */}
          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('successful') || message.includes('Welcome')
                ? 'bg-green-50 border border-green-200 text-green-800'
                : message.includes('failed') || message.includes('error')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            }`}>
              <div className="flex items-center">
                {message.includes('successful') || message.includes('Welcome') ? (
                  <Check className="mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="mr-2 flex-shrink-0" />
                )}
                {message}
              </div>
            </div>
          )}

          {/* Integration Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
            <h3 className="font-semibold text-blue-800 mb-2">Integration Instructions:</h3>
            <div className="text-blue-700 text-sm space-y-2">
              <p><strong>For Game Integration:</strong></p>
              <p>Create a "Buy Credits" button in your game that opens:</p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs block mt-1">
                {typeof window !== 'undefined' ? window.location.origin : 'YOUR_DOMAIN'}?playerId=PLAYER_ID&gameUrl=GAME_URL
              </code>
              <p className="mt-2"><strong>To check credits in game:</strong></p>
              <p>Make API call to: <code className="bg-blue-100 px-1 rounded">/api/players/PLAYER_ID</code></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
