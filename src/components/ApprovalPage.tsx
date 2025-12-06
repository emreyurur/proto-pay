import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  UserCheck,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  Zap,
  Copy
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';

interface EscrowDetails {
  id: string;
  assetType: string;
  fullAssetType: string;
  paymentType: string;
  fullPaymentType: string;
  amount: string;
  price: string;
  rawPrice: string;
  sender: string;
  receiver: string;
  condition: string;
  unlockTime: number;
  createdAt: string;
  nftId?: string;
}

interface ApprovalPageProps {
  escrowId: string;
  walletAddress: string;
  onBack: () => void;
}

export function ApprovalPage({ escrowId, walletAddress, onBack }: ApprovalPageProps) {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [transactionDigest, setTransactionDigest] = useState('');
  const [escrow, setEscrow] = useState<EscrowDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  const packageId = import.meta.env.VITE_PACKAGE_ID;

  useEffect(() => {
    const fetchEscrowDetails = async () => {
      if (!escrowId || !packageId) return;

      setIsLoading(true);
      try {
        // Query events directly from the module to find the specific escrow
        const moduleEvents = await suiClient.queryEvents({
          query: { MoveEventModule: { package: packageId, module: 'escrow' } },
          order: "descending",
          limit: 50,
        });

        let foundEvent = null;
        let isNft = false;

        // Search for the event matching our escrowId
        for (const event of moduleEvents.data) {
          const data = event.parsedJson as any;
          if (data.escrow_id === escrowId) {
            foundEvent = event;
            isNft = event.type.includes('NftLockEvent');
            break;
          }
        }

        if (foundEvent) {
          const data = foundEvent.parsedJson as any;
          
          // Extract types
          const typeMatch = foundEvent.type.match(/<([^,]+),\s*([^>]+)>/);
          const assetTypeFull = typeMatch ? typeMatch[1] : 'Unknown';
          const paymentTypeFull = typeMatch ? typeMatch[2] : 'Unknown';
          
          const assetSymbol = assetTypeFull.split('::').pop() || 'Unknown';
          const paymentSymbol = paymentTypeFull.split('::').pop() || 'Unknown';
          
          let decimals = 9;
          if (assetSymbol === 'USDC') decimals = 6;
          
          let amount = '1';
          if (!isNft) {
             amount = (Number(data.amount) / Math.pow(10, decimals)).toLocaleString(undefined, {
                maximumFractionDigits: 4
              });
          }

          const price = (Number(data.price) / Math.pow(10, 9)).toLocaleString(undefined, {
            maximumFractionDigits: 4
          });

          setEscrow({
            id: data.escrow_id,
            assetType: assetSymbol,
            fullAssetType: assetTypeFull,
            paymentType: paymentSymbol,
            fullPaymentType: paymentTypeFull,
            amount,
            price,
            rawPrice: data.price,
            sender: data.creator,
            receiver: data.recipient,
            condition: Number(data.unlock_time) > 0 ? 'Time-Lock' : 'Recipient Approval',
            unlockTime: Number(data.unlock_time),
            createdAt: new Date(Number(foundEvent.timestampMs)).toISOString(),
            nftId: isNft ? data.nft_id : undefined
          });
        } else {
          setError('Escrow details not found. It may have been claimed or is too old.');
        }
      } catch (err) {
        console.error("Error fetching escrow details:", err);
        setError('Failed to load escrow details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEscrowDetails();
  }, [escrowId, packageId, suiClient]);

  const handleApprove = async () => {
    if (!escrow || !packageId) return;

    setIsApproving(true);
    setError('');
    
    try {
      const txb = new Transaction();
      
      // Use the full types captured from the event
      const coinType = escrow.fullAssetType;
      const paymentCoinType = escrow.fullPaymentType;
      
      let paymentCoin;
      const price = BigInt(escrow.rawPrice);

      if (paymentCoinType === '0x2::sui::SUI') {
        // For SUI payments, split from gas
        const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(price)]);
        paymentCoin = coin;
      } else {
        // For other tokens, get coins, merge if needed, then split
        const paymentCoins = await suiClient.getCoins({
          owner: walletAddress,
          coinType: paymentCoinType,
        });

        if (!paymentCoins.data || paymentCoins.data.length === 0) {
          throw new Error(`No ${escrow.paymentType} coins found in wallet`);
        }

        const primaryCoin = txb.object(paymentCoins.data[0].coinObjectId);
        
        if (paymentCoins.data.length > 1) {
          txb.mergeCoins(primaryCoin, paymentCoins.data.slice(1).map(c => txb.object(c.coinObjectId)));
        }

        const [coin] = txb.splitCoins(primaryCoin, [txb.pure.u64(price)]);
        paymentCoin = coin;
      }
      
      // Determine if we are claiming a Coin or an NFT
      if (escrow.nftId) {
        // Claim NFT
        txb.moveCall({
          target: `${packageId}::escrow::claim_nft`,
          typeArguments: [coinType, paymentCoinType],
          arguments: [
            txb.object(escrow.id), // escrow object
            paymentCoin, // payment coin
            txb.object('0x6'), // Sui system clock
          ],
        });
      } else {
        // Claim Coin
        txb.moveCall({
          target: `${packageId}::escrow::claim_coin`,
          typeArguments: [coinType, paymentCoinType],
          arguments: [
            txb.object(escrow.id), // escrow object
            paymentCoin, // payment coin
            txb.object('0x6'), // Sui system clock
          ],
        });
      }
      
      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: (result) => {
            console.log('Claim transaction successful:', result);
            setTransactionDigest(result.digest);
            setApproved(true);
            setIsApproving(false);
          },
          onError: (error) => {
            console.error('Claim transaction failed:', error);
            setError(`Transaction failed: ${error.message}`);
            setIsApproving(false);
          },
        }
      );
    } catch (err: any) {
      console.error('Error preparing claim transaction:', err);
      setError(err.message || 'Failed to prepare transaction');
      setIsApproving(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const viewOnExplorer = (objectId: string) => {
    window.open(`https://suiexplorer.com/object/${objectId}`, '_blank');
  };

  if (approved && escrow) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-emerald-500/30 bg-slate-900 shadow-lg shadow-emerald-500/20">
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-500/50"
              >
                <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
              </motion.div>
            </div>
            <CardTitle className="text-center text-2xl text-emerald-400">
              Funds Released Successfully
            </CardTitle>
            <CardDescription className="text-center text-slate-300">
              The escrow has been completed and assets transferred to your wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-emerald-500/30 bg-emerald-950/30">
              <Shield className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-sm text-slate-200">
                <div className="mb-2 font-semibold">Transaction Completed</div>
                <div className="break-all rounded bg-emerald-950/50 p-3 font-mono text-xs text-emerald-300 border border-emerald-500/20">
                  {escrow.amount} ${escrow.assetType} transferred to your wallet
                </div>
              </AlertDescription>
            </Alert>

            {transactionDigest && (
              <Alert className="border-emerald-500/30 bg-emerald-950/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <AlertDescription className="text-sm text-slate-200">
                  <div className="mb-2 font-semibold">Transaction Digest</div>
                  <a
                    href={`https://suiscan.xyz/testnet/tx/${transactionDigest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all rounded bg-emerald-950/50 p-3 font-mono text-xs text-emerald-300 hover:bg-emerald-900/50 transition-colors underline border border-emerald-500/20"
                  >
                    View on SuiScan: {transactionDigest}
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button 
                variant="outline"
                onClick={onBack}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button 
                onClick={() => viewOnExplorer(escrow.id)}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Button 
          variant="ghost"
          onClick={onBack}
          className="mb-6 gap-2 text-gray-300 hover:text-white hover:bg-slate-700/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Card className="border-slate-700/50 bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-500"></div>
            </div>
            <p className="text-gray-400">Loading escrow details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="mx-auto max-w-3xl">
        <Button 
          variant="ghost"
          onClick={onBack}
          className="mb-6 gap-2 text-gray-300 hover:text-white hover:bg-slate-700/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <Card className="border-red-500/30 bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
            <p className="text-red-400 mb-2">Failed to load escrow</p>
            <p className="text-gray-400 text-sm">{error || 'Escrow not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button 
        variant="ghost"
        onClick={onBack}
        className="mb-6 gap-2 text-gray-300 hover:text-white hover:bg-slate-700/50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="space-y-6">
        {error && (
          <Alert className="border-red-500/30 bg-red-950/30">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-sm text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Escrow Details */}
        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-6 w-6 text-purple-400" />
                  Escrow Approval Required
                </CardTitle>
                <CardDescription className="mt-2 text-gray-400">
                  Review the escrow details and approve the release of funds
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/20 text-amber-300">
                <Clock className="mr-1.5 h-3 w-3" />
                Pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Escrow Object ID */}
            <div className="rounded-lg border border-slate-600/50 bg-slate-700/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">Escrow Object ID</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => viewOnExplorer(escrow.id)}
                  className="h-6 gap-1 px-2 text-xs text-cyan-400 hover:bg-slate-600/50 hover:text-cyan-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Explorer
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="flex-1 break-all font-mono text-xs text-white">{escrow.id}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyAddress(escrow.id)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Asset Details */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-white">
                Asset Details
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-4">
                  <p className="mb-2 text-xs text-gray-400">Asset Type</p>
                  <p className="text-lg text-white">${escrow.assetType}</p>
                </div>
                
                <div className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-4">
                  <p className="mb-2 text-xs text-gray-400">Amount</p>
                  <p className="text-lg text-white">{escrow.amount}</p>
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="space-y-4 border-t border-slate-600 pt-6">
              <h3 className="text-white">Transaction Parties</h3>
              
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs text-gray-400">Sender (Escrow Creator)</p>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-700/50 p-3">
                    <p className="flex-1 break-all font-mono text-xs text-gray-300">{escrow.sender}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyAddress(escrow.sender)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-gray-400">Receiver (You)</p>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 p-3">
                    <p className="flex-1 break-all font-mono text-xs text-emerald-300">{escrow.receiver}</p>
                    <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/30 text-emerald-300">
                      Your Wallet
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Release Condition */}
            <div className="space-y-3 border-t border-slate-600 pt-6">
              <h3 className="text-white">Release Condition</h3>
              
              <div className="rounded-lg border border-blue-500/50 bg-blue-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-500/30">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-white">{escrow.condition}</p>
                    <p className="text-sm text-blue-200">
                      You must approve this transaction for the funds to be released to your wallet
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-center justify-between border-t border-slate-600 pt-4 text-sm text-gray-400">
              <span>Created</span>
              <span>{new Date(escrow.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="w-full gap-3 bg-gradient-to-r from-blue-600 to-cyan-600 py-6 shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700 text-white"
              size="lg"
            >
              {isApproving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Shield className="h-6 w-6" />
                  </motion.div>
                  Signing Transaction...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-6 w-6" />
                  Approve and Release Funds via Slush Wallet
                </>
              )}
            </Button>

            <p className="mt-4 text-center text-xs text-gray-400">
              You will be prompted to sign this transaction in your Slush Wallet
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
