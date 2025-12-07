import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Alert, AlertDescription } from '../ui/alert';
import { TokenSelector, type TokenType } from './TokenSelector';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import suiLogo from '../assets/sui-logo.png';
import yetiImage from '../assets/yeti1.jpg';
import { 
  Lock, 
  Clock, 
  UserCheck, 
  Shield, 
  Calendar,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';

interface EscrowCreateProps {
  walletAddress: string;
  prefilledReceiver?: string;
}

type ReleaseCondition = 'recipient' | 'timelock';
type AssetCategory = 'token' | 'nft';

export function EscrowCreate({ walletAddress, prefilledReceiver = '' }: EscrowCreateProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const packageId = import.meta.env.VITE_PACKAGE_ID || '';

  const [assetCategory, setAssetCategory] = useState<AssetCategory>('token');
  const [assetType, setAssetType] = useState<TokenType>('SUI');
  const [amount, setAmount] = useState('');
  const [nftObjectId, setNftObjectId] = useState('');
  const [receiver, setReceiver] = useState(prefilledReceiver);
  const [releaseCondition, setReleaseCondition] = useState<ReleaseCondition>('recipient');
  const [unlockTime, setUnlockTime] = useState('');
  const [escrowCreated, setEscrowCreated] = useState(false);
  const [escrowObjectId, setEscrowObjectId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createEscrow = async () => {
    if (!walletAddress || !packageId) return;
    setIsCreating(true);

    try {
      const txb = new Transaction();
      const paymentCoinType = '0x2::sui::SUI'; // Default payment type for the contract generic
      
      // Calculate unlock time in ms
      const unlockTimestamp = releaseCondition === 'timelock' && unlockTime 
        ? new Date(unlockTime).getTime() 
        : 0; // 0 means immediate/recipient approval only

      if (assetCategory === 'token') {
        // 1. Determine Coin Type
        let coinType = '0x2::sui::SUI';
        if (assetType === 'USDC') {
          coinType = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
        } else if (assetType === 'OTHER') {
           // Handle custom token if needed, for now default to SUI or alert
        }

        // 2. Prepare Coin
        const decimals = assetType === 'USDC' ? 6 : 9;
        const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

        const coins = await suiClient.getCoins({ owner: walletAddress, coinType });
        if (coins.data.length === 0) throw new Error(`No ${assetType} coins found`);

        let coinToLock;
        
        if (coinType === '0x2::sui::SUI') {
            // For SUI, use splitCoins from gas
            [coinToLock] = txb.splitCoins(txb.gas, [amountInSmallestUnit]);
        } else {
            // For other tokens, merge and split
            const primaryCoin = txb.object(coins.data[0].coinObjectId);
            if (coins.data.length > 1) {
                txb.mergeCoins(primaryCoin, coins.data.slice(1).map(c => txb.object(c.coinObjectId)));
            }
            [coinToLock] = txb.splitCoins(primaryCoin, [amountInSmallestUnit]);
        }

        // 3. Call lock_coin
        txb.moveCall({
          target: `${packageId}::escrow::lock_coin`,
          typeArguments: [coinType, paymentCoinType],
          arguments: [
            coinToLock,
            txb.pure.address(receiver),
            txb.pure.u64(0), // Price is 0 for standard escrow
            txb.pure.u64(unlockTimestamp),
          ],
        });

      } else {
        // NFT Logic
        if (!nftObjectId) throw new Error("NFT Object ID required");
        
        // Fetch NFT object to get its type
        const nftObj = await suiClient.getObject({
            id: nftObjectId,
            options: { showType: true }
        });
        
        if (!nftObj.data || !nftObj.data.type) throw new Error("NFT not found or type unknown");
        const nftType = nftObj.data.type;

        txb.moveCall({
            target: `${packageId}::escrow::lock_nft`,
            typeArguments: [nftType, paymentCoinType],
            arguments: [
                txb.object(nftObjectId),
                txb.pure.address(receiver),
                txb.pure.u64(0), // Price 0
                txb.pure.u64(unlockTimestamp),
            ]
        });
      }

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async (result) => {
            console.log("Escrow created:", result);
            
            try {
              // Query the transaction to get events
              const txDetails = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: { showEvents: true }
              });
              
              // Extract escrow_id from CoinLockEvent or NftLockEvent
              const lockEvent = txDetails.events?.find((e: any) => 
                e.type.includes('::escrow::CoinLockEvent') || 
                e.type.includes('::escrow::NftLockEvent')
              );
              
              if (lockEvent && lockEvent.parsedJson) {
                const eventData = lockEvent.parsedJson as any;
                setEscrowObjectId(eventData.escrow_id);
              } else {
                // Fallback to digest if event not found
                setEscrowObjectId(result.digest);
              }
            } catch (error) {
              console.error("Error fetching transaction details:", error);
              setEscrowObjectId(result.digest);
            }
            
            setEscrowCreated(true);
            setIsCreating(false);
          },
          onError: (err) => {
            console.error(err);
            alert("Failed to create escrow: " + err.message);
            setIsCreating(false);
          }
        }
      );

    } catch (error: any) {
      console.error(error);
      alert(error.message);
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setEscrowCreated(false);
    setAmount('');
    setNftObjectId('');
    setReceiver('');
    setUnlockTime('');
  };

  const viewOnExplorer = (objectId: string) => {
    window.open(`https://suiexplorer.com/object/${objectId}`, '_blank');
  };

  if (escrowCreated) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              Escrow Created Successfully
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your assets have been locked in a secure escrow on the Sui blockchain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-emerald-500/50 bg-emerald-500/20">
              <Shield className="h-4 w-4 text-emerald-300" />
              <AlertDescription className="text-sm text-emerald-200">
                <div className="mb-2">Escrow Object ID:</div>
                <div className="flex items-center justify-between gap-2 break-all rounded bg-emerald-500/30 border border-emerald-500/50 p-3 font-mono text-xs text-white">
                  <span>{escrowObjectId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => viewOnExplorer(escrowObjectId)}
                    className="h-6 w-6 flex-shrink-0 p-0 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4 rounded-lg border border-slate-600/50 bg-slate-700/50 p-4">
              <h3 className="flex items-center gap-2 text-white">
                <Lock className="h-5 w-5 text-purple-400" />
                Escrow Details
              </h3>
              
              <div className="grid gap-4">
                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Asset Category</p>
                  <p className="text-white">{assetCategory === 'token' ? 'Token (Fungible)' : 'NFT (Non-Fungible)'}</p>
                </div>
                
                {assetCategory === 'token' ? (
                  <>
                    <div>
                      <p className="mb-1.5 text-xs text-gray-400">Token</p>
                      <p className="text-white">${assetType}</p>
                    </div>
                    
                    <div>
                      <p className="mb-1.5 text-xs text-gray-400">Amount</p>
                      <p className="font-mono text-sm text-white">{amount}</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="mb-1.5 text-xs text-gray-400">NFT Object ID</p>
                    <p className="font-mono text-xs text-gray-300 break-all">{nftObjectId}</p>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Receiver</p>
                  <p className="font-mono text-sm text-gray-300">{receiver}</p>
                </div>

                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Release Condition</p>
                  <p className="text-white">
                    {releaseCondition === 'recipient' && 'Recipient Approval Required'}
                    {releaseCondition === 'timelock' && `Time-Lock until ${new Date(unlockTime).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button 
                variant="outline"
                onClick={resetForm}
                className="w-full border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Create Another
              </Button>
              <Button 
                onClick={() => viewOnExplorer(escrowObjectId)}
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/25 text-white"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Asset Selection */}
      <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="text-white">Asset to Lock</CardTitle>
          <CardDescription className="text-gray-400">
            Choose the type of asset you want to place in escrow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Asset Category Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Asset Category</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => setAssetCategory('token')}
                className={`group relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                  assetCategory === 'token'
                    ? 'border-cyan-500 bg-slate-900 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-700 bg-slate-900 hover:border-cyan-500/50 hover:shadow-md'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                  assetCategory === 'token' 
                    ? ' from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30' 
                    : 'bg-slate-800 group-hover:bg-slate-700'
                }`}>
                  <img src={suiLogo} alt="Token" className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex-1">
                  <p className={`mb-1.5 text-base font-semibold ${assetCategory === 'token' ? 'text-cyan-300' : 'text-slate-100'}`}>
                    Token (Fungible)
                  </p>
                  <p className={`text-sm leading-relaxed ${assetCategory === 'token' ? 'text-cyan-400/80' : 'text-slate-400'}`}>
                    Lock a specific amount of tokens
                  </p>
                </div>
                {assetCategory === 'token' && (
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 shadow-lg">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setAssetCategory('nft')}
                className={`group relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                  assetCategory === 'nft'
                    ? 'border-purple-500 bg-slate-900 shadow-lg shadow-purple-500/20'
                    : 'border-slate-700 bg-slate-900 hover:border-purple-500/50 hover:shadow-md'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                  assetCategory === 'nft' 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30' 
                    : 'bg-slate-800 group-hover:bg-slate-700'
                }`}>
                  <img src={yetiImage} alt="NFT" className="h-8 w-8 rounded-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className={`mb-1.5 text-base font-semibold ${assetCategory === 'nft' ? 'text-purple-300' : 'text-slate-100'}`}>
                    NFT (Non-Fungible)
                  </p>
                  <p className={`text-sm leading-relaxed ${assetCategory === 'nft' ? 'text-purple-400/80' : 'text-slate-400'}`}>
                    Lock a unique digital asset
                  </p>
                </div>
                {assetCategory === 'nft' && (
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 shadow-lg">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Token-specific fields */}
          {assetCategory === 'token' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="token-select">Token Type</Label>
                <TokenSelector value={assetType} onChange={setAssetType} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-400 focus:bg-slate-700/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </>
          )}

          {/* NFT-specific fields */}
          {assetCategory === 'nft' && (
            <div className="space-y-2">
              <Label htmlFor="nft-object-id">NFT Object ID</Label>
              <Input
                id="nft-object-id"
                value={nftObjectId}
                onChange={(e) => setNftObjectId(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-400 focus:bg-slate-700/50"
              />
              <p className="text-xs text-gray-400">
                The unique Sui object ID of the NFT you want to lock in escrow
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="receiver">Receiver Address</Label>
            <Input
              id="receiver"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="0x..."
              className="font-mono text-sm border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-400 focus:bg-slate-700/50"
            />
            <p className="text-xs text-gray-400">
              The address that will receive the escrowed assets upon release
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Release Conditions */}
      <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Lock className="h-5 w-5 text-purple-400" />
            Release Condition
          </CardTitle>
          <CardDescription className="text-gray-400">
            Set the condition that must be met to release the escrowed assets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={releaseCondition} onValueChange={(v) => setReleaseCondition(v as ReleaseCondition)}>
            {/* Recipient Approval */}
            <div className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
              releaseCondition === 'recipient'
                ? 'border-cyan-500 bg-cyan-500/20'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="recipient" id="recipient" className="mt-1" />
                <Label htmlFor="recipient" className="flex-1 cursor-pointer">
                  <div className="mb-2 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-cyan-400" />
                    <span className="text-white">Recipient Approval</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Requires the receiver to sign and approve the release of escrowed assets
                  </p>
                </Label>
              </div>
            </div>

            {/* Time-Lock */}
            <div className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
              releaseCondition === 'timelock'
                ? 'border-cyan-500 bg-cyan-500/20'
                : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
            }`}>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="timelock" id="timelock" className="mt-1" />
                <Label htmlFor="timelock" className="flex-1 cursor-pointer">
                  <div className="mb-2 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-400" />
                    <span className="text-white">Time-Lock Only</span>
                  </div>
                  <p className="mb-3 text-sm text-gray-300">
                    Assets are automatically releasable after a specific date and time
                  </p>
                  {releaseCondition === 'timelock' && (
                    <div className="space-y-2 border-t border-slate-600 pt-3">
                      <Label htmlFor="unlock-time" className="flex items-center gap-2 text-xs text-gray-300">
                        <Calendar className="h-3 w-3" />
                        Unlock Date & Time
                      </Label>
                      <Input
                        id="unlock-time"
                        type="datetime-local"
                        value={unlockTime}
                        onChange={(e) => setUnlockTime(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-slate-600 bg-slate-700/50 text-white focus:bg-slate-700/50"
                      />
                      {unlockTime && (
                        <div className="mt-3 rounded-lg border border-blue-500/50 bg-blue-500/20 p-3">
                          <p className="text-xs text-blue-200">
                            <span className="font-semibold">Lock Duration:</span>{' '}
                            {Math.ceil((new Date(unlockTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Label>
              </div>
            </div>

          </RadioGroup>         

          {/* Create Button */}
          <Button 
            onClick={createEscrow}
            disabled={
              isCreating ||
              !receiver ||
              (assetCategory === 'token' && !amount) ||
              (assetCategory === 'nft' && !nftObjectId) ||
              (releaseCondition === 'timelock' && !unlockTime)
            }
            className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 py-6 shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            <Lock className="h-5 w-5" />
            {isCreating ? 'Creating Escrow...' : 'Create Escrow via Slush Wallet'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
