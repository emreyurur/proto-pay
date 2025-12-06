import { useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import suiLogo from '../assets/sui-logo.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Clock, 
  Users, 
  ExternalLink, 
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Wallet,
  ArrowUpRight
} from 'lucide-react';

interface DashboardProps {
  walletConnected: boolean;
  walletAddress: string;
  onViewEscrow: (escrowId: string) => void;
}

interface BatchTransaction {
  id: string;
  totalValue: string;
  token: string;
  recipients: number;
  status: string;
  createdAt: string;
}

interface EscrowData {
  id: string;
  assetType: string;
  amount: string;
  counterparty: string;
  condition: string;
  unlockTime?: string;
  createdAt: string;
  isCreator: boolean;
  isRecipient: boolean;
  nftId?: string;
}

export function Dashboard({ walletConnected, walletAddress, onViewEscrow }: DashboardProps) {
  const suiClient = useSuiClient();
  const [batches, setBatches] = useState<BatchTransaction[]>([]);
  const [escrows, setEscrows] = useState<EscrowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEscrows, setIsLoadingEscrows] = useState(true);
  const packageId = import.meta.env.VITE_PACKAGE_ID;

  useEffect(() => {
    // Reset states when wallet changes
    setBatches([]);
    setEscrows([]);
    
    const fetchTransactions = async () => {
      if (!walletConnected || !walletAddress || !packageId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      // Add small delay to ensure wallet is fully connected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const result = await suiClient.queryTransactionBlocks({
          filter: {
            FromAddress: walletAddress,
          },
          options: {
            showEvents: true,
            showEffects: true,
            showInput: true,
          },
          order: "descending",
          limit: 20,
        });

        const platformBatches = result.data
          .map((tx) => {
            // Find the BatchTokenEvent
            const batchEvent = tx.events?.find((e) => 
              e.type.startsWith(`${packageId}::batch::BatchTokenEvent`)
            );

            if (!batchEvent) return null;

            // Extract generic type for Token (e.g. 0x...::sui::SUI)
            const tokenTypeMatch = batchEvent.type.match(/<(.+)>/);
            const tokenType = tokenTypeMatch ? tokenTypeMatch[1] : 'Unknown';
            const tokenSymbol = tokenType.split('::').pop() || 'Unknown';

            const parsedJson = batchEvent.parsedJson as any;
            
            // Determine decimals
            let decimals = 9;
            if (tokenSymbol === 'USDC') decimals = 6;
            
            const totalVal = (Number(parsedJson.total_amount) / Math.pow(10, decimals)).toLocaleString(undefined, {
              maximumFractionDigits: 4
            });

            return {
              id: tx.digest,
              totalValue: totalVal,
              token: tokenSymbol,
              recipients: Number(parsedJson.recipient_count),
              status: tx.effects?.status.status === 'success' ? 'executed' : 'failed',
              createdAt: new Date(Number(tx.timestampMs)).toISOString(),
            };
          })
          .filter((b): b is BatchTransaction => b !== null);

        setBatches(platformBatches);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchEscrows = async () => {
      if (!walletConnected || !walletAddress || !packageId) {
        setIsLoadingEscrows(false);
        return;
      }

      setIsLoadingEscrows(true);
      
      // Add small delay to ensure wallet is fully connected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const escrowData: EscrowData[] = [];
        const seenEscrowIds = new Set<string>(); // Prevent duplicates
        const potentialEscrows: any[] = [];

        // STRATEGY 1: Fetch by FromAddress (Creator - Reliable)
        console.log('Fetching creator transactions...');
        const creatorTxs = await suiClient.queryTransactionBlocks({
          filter: { FromAddress: walletAddress },
          options: { showEvents: true, showEffects: true },
          order: "descending",
          limit: 50,
        });

        for (const tx of creatorTxs.data) {
          if (tx.events) {
            potentialEscrows.push(...tx.events.filter(e => 
              e.type.includes(`${packageId}::escrow::CoinLockEvent`) || 
              e.type.includes(`${packageId}::escrow::NftLockEvent`)
            ).map(e => ({ ...e, timestampMs: tx.timestampMs })));
          }
        }

        // STRATEGY 2: Fetch by Module Events (Recipient - Broader search)
        console.log('Fetching module events for recipient...');
        try {
          const moduleEvents = await suiClient.queryEvents({
            query: { MoveEventModule: { package: packageId, module: 'escrow' } },
            order: "descending",
            limit: 50,
          });
          
          potentialEscrows.push(...moduleEvents.data);
        } catch (err) {
          console.warn("Module event query failed, falling back to recent txs", err);
        }

        // Process all found events
        const currentAddr = walletAddress.toLowerCase();
        const relevantEvents = potentialEscrows.filter((event) => {
          const data = event.parsedJson as any;
          const creator = String(data.creator).toLowerCase();
          const recipient = String(data.recipient).toLowerCase();
          // We want events where we are creator OR recipient
          return creator === currentAddr || recipient === currentAddr;
        });

        // Check if escrows are still active (object exists)
        if (relevantEvents.length > 0) {
          const objectIds = relevantEvents.map((e) => (e.parsedJson as any).escrow_id);
          const uniqueObjectIds = [...new Set(objectIds)]; // Deduplicate IDs for query
          
          // Fetch objects in chunks of 50
          const chunkedIds = [];
          for (let i = 0; i < uniqueObjectIds.length; i += 50) {
            chunkedIds.push(uniqueObjectIds.slice(i, i + 50));
          }

          const activeObjectIds = new Set<string>();
          
          for (const chunk of chunkedIds) {
            const objects = await suiClient.multiGetObjects({
              ids: chunk,
              options: { showOwner: true }
            });
            
            objects.forEach((obj) => {
              if (obj.data && !obj.error) {
                activeObjectIds.add(obj.data.objectId);
              }
            });
          }

          // Build final list
          for (const event of relevantEvents) {
            const data = event.parsedJson as any;
            
            // Skip if object no longer exists (claimed/deleted)
            if (!activeObjectIds.has(data.escrow_id)) continue;
            
            if (seenEscrowIds.has(data.escrow_id)) continue;
            seenEscrowIds.add(data.escrow_id);

            const isCoinEvent = event.type.includes('CoinLockEvent');
            const isNftEvent = event.type.includes('NftLockEvent');
            
            let assetType = 'Unknown';
            let amount = '1';
            let nftId = undefined;

            if (isCoinEvent) {
              const tokenMatch = event.type.match(/<([^,]+),/);
              const tokenType = tokenMatch ? tokenMatch[1].split('::').pop() : 'Unknown';
              assetType = tokenType || 'Token';
              
              let decimals = 9;
              if (assetType === 'USDC') decimals = 6;
              
              amount = (Number(data.amount) / Math.pow(10, decimals)).toLocaleString(undefined, {
                maximumFractionDigits: 4
              });
            } else if (isNftEvent) {
              const nftTypeMatch = event.type.match(/<([^,]+),/);
              const nftType = nftTypeMatch ? nftTypeMatch[1].split('::').pop() : 'NFT';
              assetType = nftType || 'NFT';
              nftId = data.nft_id;
            }

            const recipientAddr = String(data.recipient).toLowerCase();
            const isRecipient = recipientAddr === currentAddr;
            const isCreator = String(data.creator).toLowerCase() === currentAddr;

            escrowData.push({
              id: data.escrow_id,
              assetType,
              amount,
              counterparty: isCreator ? data.recipient : data.creator,
              condition: Number(data.unlock_time) > 0 ? 'Time-Lock' : 'Recipient Approval',
              unlockTime: Number(data.unlock_time) > 0 ? new Date(Number(data.unlock_time)).toISOString() : undefined,
              createdAt: new Date(Number(event.timestampMs)).toISOString(),
              isCreator,
              isRecipient,
              nftId,
            });
          }
        }
        
        setEscrows(escrowData);
      } catch (error) {
        console.error("Error fetching escrows:", error);
      } finally {
        setIsLoadingEscrows(false);
      }
    };

    fetchTransactions();
    fetchEscrows();
  }, [walletConnected, walletAddress, packageId, suiClient]);

  if (!walletConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-brrom-blue-600 to-cyan-600 shadow-lg shadow-blue-500/20">
          <Wallet className="h-10 w-10 text-white" />
        </div>
        <h2 className="mb-3 text-2xl font-bold text-white">Connect Your Wallet</h2>
        <p className="max-w-md text-base text-gray-400">
          Connect your wallet to view and manage your active batches and escrows on the Sui blockchain.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { 
        label: 'Pending', 
        className: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
        icon: Loader2 
      },
      locked: { 
        label: 'Locked', 
        className: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        icon: Clock 
      },
      executed: { 
        label: 'Executed', 
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
        icon: CheckCircle2 
      },
      failed: {
        label: 'Failed',
        className: 'bg-red-500/20 text-red-300 border-red-500/50',
        icon: XCircle
      }
    };
    const conf = config[status as keyof typeof config] || config.pending;
    const Icon = conf.icon;
    return (
      <Badge variant="outline" className={`gap-1.5 border ${conf.className}`}>
        <Icon className="h-3 w-3" />
        {conf.label}
      </Badge>
    );
  };

  const viewOnExplorer = (objectId: string) => {
    window.open(`https://testnet.suivision.xyz/txblock/${objectId}`, '_blank');
  };

  return (
    <div className="space-y-10">
      {/* Active Batches Section */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">Recent Batches</h2>
            <p className="text-base text-gray-400">
              Your recent batch transactions on the platform
            </p>
          </div>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />}
        </div>

        {batches.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-8 text-center">
            <p className="text-gray-400">No batch transactions found for this wallet on the platform.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => (
              <Card key={batch.id} className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-slate-600/50 transition-all">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
                          <Shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-white">Batch Transaction</CardTitle>
                          <CardDescription className="text-sm text-gray-400">
                            {new Date(batch.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CardDescription className="font-mono text-sm text-gray-500 break-all">
                          {batch.id}
                        </CardDescription>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewOnExplorer(batch.id)}
                          className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                    <div>
                      <p className="mb-1.5 text-sm text-gray-400">Token</p>
                      <div className="flex items-center gap-2">
                        {batch.token === 'SUI' && <img src={suiLogo} alt="SUI" className="h-5 w-5" />}
                        <p className="text-lg font-medium text-white">{batch.token}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm text-gray-400">Total Value</p>
                      <p className="text-lg font-medium text-white">{batch.totalValue}</p>
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm text-gray-400">Recipients</p>
                      <p className="flex items-center gap-1.5 text-lg font-medium text-white">
                        <Users className="h-4 w-4 text-cyan-400" />
                        {batch.recipients}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Active Escrows Section */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">Active Escrows</h2>
            <p className="text-base text-gray-400">
              Assets held in secure escrow with conditional release
            </p>
          </div>
          {isLoadingEscrows && <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />}
        </div>

        {escrows.length === 0 && !isLoadingEscrows ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-8 text-center">
            <p className="text-gray-400">No active escrows found for this wallet.</p>
          </div>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {escrows.map((escrow) => (
            <Card key={escrow.id} className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-slate-600/50 transition-all">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                        {escrow.assetType === 'SUI' && <img src={suiLogo} alt="SUI" className="h-5 w-5" />}
                        {escrow.nftId ? 'NFT Escrow' : `$${escrow.assetType} Escrow`}
                      </CardTitle>
                      <CardDescription className="font-mono text-sm text-gray-400">
                        {escrow.id.slice(0, 10)}...
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => viewOnExplorer(escrow.id)}
                    className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Locked Amount - Prominent Display */}
                <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 p-4 shadow-lg shadow-purple-500/10">
                  <p className="mb-2 text-sbg-linear-to-brt-purple-300">Locked Amount</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-white">{escrow.amount}</p>
                    <div className="flex items-center gap-1">
                      {escrow.assetType === 'SUI' && <img src={suiLogo} alt="SUI" className="h-4 w-4" />}
                      <span className="text-lg font-semibold text-purple-300">${escrow.assetType}</span>
                    </div>
                  </div>
                </div>
                
                {/* Details Grid */}
                <div className="space-y-3">
                  <div className="rounded-lg bg-slate-700/50 border border-slate-600/50 p-3">
                    <p className="mb-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Receiver</p>
                    <p className="font-mono text-sm text-white break-all">{escrow.counterparty}</p>
                  </div>
                  
                  <div className="rounded-lg bg-slate-700/50 border border-slate-600/50 p-3">
                    <p className="mb-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Release Condition</p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                        <Clock className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <p className="text-sm font-medium text-white">{escrow.condition}</p>
                    </div>
                  </div>
                </div>

                {/* Status and Action */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-700/50 border border-slate-600/50 p-3">
                    <span className="text-sm font-medium text-gray-300">Status</span>
                    <Badge variant="outline" className="gap-1.5 border-amber-500/50 bg-amber-500/20 text-amber-300 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      Awaiting Approval
                    </Badge>
                  </div>
                  
                  {escrow.unlockTime && (
                    <div className="flex items-center justify-between rounded-lg bg-blue-500/20 border border-blue-500/30 p-3">
                      <span className="text-sm font-medium text-blue-300">Unlock Date</span>
                      <span className="text-sm font-semibold text-white">
                        {new Date(escrow.unlockTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  
                 {/* Debug: Show button conditions */}
                 {/* 
                 {console.log('Button render check:', {
                    id: escrow.id,
                    isRecipient: escrow.isRecipient,
                    condition: escrow.condition,
                    shouldShow: escrow.isRecipient && escrow.condition === 'Recipient Approval'
                 })}
                 */}
                  
                  {escrow.isRecipient && escrow.condition === 'Recipient Approval' && (
                    <Button
                      onClick={() => onViewEscrow?.(escrow.id)}
                      className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/25 font-semibold text-white"
                      size="lg"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Review & Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </section>
    </div>
  );
}
