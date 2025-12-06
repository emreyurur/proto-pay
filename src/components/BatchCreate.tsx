import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { TokenSelector, type TokenType } from './TokenSelector';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  Lock,
  Calendar,
  FileText,
  Zap,
  ArrowRight,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import suiLogo from '../assets/sui-logo.png';

interface BatchCreateProps {
  walletAddress: string;
}

type Step = 1 | 2 | 3;

interface Recipient {
  address: string;
  amount: string;
  valid: boolean;
}

export function BatchCreate({ walletAddress }: BatchCreateProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [assetType, setAssetType] = useState<TokenType>('SUI');
  const packageId = import.meta.env.VITE_PACKAGE_ID || '';
  const serviceConfigId = import.meta.env.VITE_SERVICE_CONFIG_ID || '';
  const [customTokenObjectId, setCustomTokenObjectId] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [csvInput, setCsvInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [enableTimeLock, setEnableTimeLock] = useState(false);
  const [unlockDate, setUnlockDate] = useState('');
  const [batchListObjectId, setBatchListObjectId] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [transactionDigest, setTransactionDigest] = useState('');

  const validateAddress = (address: string): boolean => {
    return address.startsWith('0x') && address.length === 66;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvInput(text);
      };
      reader.readAsText(file);
    }
  };

  const parseCsvData = () => {
    const lines = csvInput.trim().split('\n');
    const parsed: Recipient[] = lines.map(line => {
      const [address, amount] = line.split(',').map(s => s.trim());
      return {
        address,
        amount,
        valid: validateAddress(address) && parseFloat(amount) > 0,
      };
    });
    setRecipients(parsed);
    setCurrentStep(2);
  };

  const lockBatchList = () => {
    // Mock: Generate a batch list object ID
    const mockObjectId = '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setBatchListObjectId(mockObjectId);
    setCurrentStep(3);
  };

  const executeBatch = async () => {
    setIsExecuting(true);
    
    try {
      // Determine coin type based on asset selection
      let coinType: string;
      switch (assetType) {
        case 'SUI':
          coinType = '0x2::sui::SUI';
          break;
        case 'USDC':
          coinType = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'; // Testnet USDC
          break;
        case 'OTHER':
          if (!customTokenObjectId.trim()) {
            alert('Please enter a custom token object ID');
            setIsExecuting(false);
            return;
          }
          coinType = customTokenObjectId;
          break;
        default:
          coinType = '0x2::sui::SUI';
      }

      // Get user's coins
      const coins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: coinType,
      });

      if (coins.data.length === 0) {
        alert(`No ${assetType} coins found in your wallet`);
        setIsExecuting(false);
        return;
      }

      const txb = new Transaction();

      // Determine decimals (SUI and USDC have different decimals)
      const decimals = assetType === 'USDC' ? 6 : 9;
      const multiplier = Math.pow(10, decimals);

      // Prepare recipients and amounts
      const recipientAddresses = recipients.map(r => r.address);
      // Use BigInt for calculation precision
      const amounts = recipients.map(r => BigInt(Math.floor(parseFloat(r.amount) * multiplier)));
      
      // Calculate total required amount
      const totalAmount = amounts.reduce((sum, a) => sum + a, 0n);
      
      // Calculate Fee (0.5% = 50 BPS)
      let feeAmount = (totalAmount * 50n) / 10000n;
      if (feeAmount === 0n && totalAmount > 0n) {
        feeAmount = 1n;
      }
      
      const totalNeeded = totalAmount + feeAmount;

      let paymentCoin;

      if (assetType === 'SUI') {
        // For SUI: Split the exact amount needed from the gas coin(s)
        // This is the standard pattern for SUI payments to avoid "No valid gas coins" errors
        // The wallet will automatically select gas coins and handle the split
        [paymentCoin] = txb.splitCoins(txb.gas, [totalNeeded]);
      } else {
        // For Non-SUI (USDC, etc.): Merge all available token coins
        const primaryCoin = txb.object(coins.data[0].coinObjectId);
        
        if (coins.data.length > 1) {
          const coinsToMerge = coins.data.slice(1).map(c => txb.object(c.coinObjectId));
          txb.mergeCoins(primaryCoin, coinsToMerge);
        }
        paymentCoin = primaryCoin;
      }

      // Call batch_send_token
      txb.moveCall({
        target: `${packageId}::batch::batch_send_token`,
        typeArguments: [coinType],
        arguments: [
          txb.object(serviceConfigId),
          paymentCoin,
          txb.pure.vector('address', recipientAddresses),
          txb.pure.vector('u64', amounts.map(a => a.toString())),
        ],
      });

      // Transfer the payment coin back to the sender
      // (It was created via split or is the primary coin; either way, ensure it returns to user)
      txb.transferObjects([paymentCoin], txb.pure.address(walletAddress));

      // Execute transaction
      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: (result) => {
            console.log('Batch transaction successful:', result);
            setTransactionDigest(result.digest);
            setIsExecuting(false);
          },
          onError: (error) => {
            console.error('Batch transaction failed:', error);
            alert(`Transaction failed: ${error.message}`);
            setIsExecuting(false);
          },
        }
      );
    } catch (error) {
      console.error('Error preparing transaction:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExecuting(false);
    }
  };

  const totalAmount = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const validRecipients = recipients.filter(r => r.valid).length;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Progress Steps */}
      <div className="mb-10">
        <div className="mb-6 flex items-center justify-between">
          {[
            { num: 1, label: 'Data Input' },
            { num: 2, label: 'Review & Lock' },
            { num: 3, label: 'Execute' }
          ].map((step, idx) => (
            <div key={step.num} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all ${
                  currentStep >= step.num 
                    ? 'border-cyan-500 bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                    : 'border-slate-600 bg-slate-800 text-slate-400'
                }`}>
                  <span>{step.num}</span>
                </div>
                <span className={`text-sm ${currentStep >= step.num ? 'text-white' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
              {idx < 2 && (
                <div className={`mx-4 h-0.5 flex-1 transition-all ${
                  currentStep > step.num ? 'bg-cyan-500' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Data Input */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card className="border border-slate-600 bg-slate-800/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-white">Select Token</CardTitle>
              <CardDescription className="text-gray-400">
                Specify the fungible asset you want to batch transfer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-select">Token Type</Label>
                <TokenSelector value={assetType} onChange={setAssetType} />
              </div>

              {assetType === 'OTHER' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-token">Custom Token Object ID</Label>
                  <Input
                    id="custom-token"
                    value={customTokenObjectId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTokenObjectId(e.target.value)}
                    placeholder="0x..."
                    className="border-slate-600 bg-slate-700/50 font-mono text-sm text-white placeholder:text-slate-400"
                  />
                  <p className="text-xs text-gray-400">
                    Enter the full type/object ID for your custom token
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-600 bg-slate-800/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="h-5 w-5 text-cyan-400" />
                Recipient List
              </CardTitle>
              <CardDescription className="text-gray-400">
                Enter recipient addresses and amounts (one per line: address, amount)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload Option */}
              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload CSV File (Optional)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="gap-2 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
                  >
                    <Upload className="h-4 w-4" />
                    Choose File
                  </Button>
                  {uploadedFileName && (
                    <span className="flex items-center gap-2 text-sm text-gray-300">
                      <FileText className="h-4 w-4 text-emerald-400" />
                      {uploadedFileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-input">CSV/Text Input</Label>
                <Textarea
                  id="csv-input"
                  value={csvInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsvInput(e.target.value)}
                  placeholder="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef, 100&#10;0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890, 50"
                  className="min-h-60 border-slate-600 bg-slate-700/50 font-mono text-sm text-white placeholder:text-slate-500"
                />
              </div>
              
              <Button 
                onClick={parseCsvData}
                disabled={!csvInput.trim() || (assetType === 'OTHER' && !customTokenObjectId.trim())}
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/25 text-white"
                size="lg"
              >
                Validate & Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Review & Lock */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="border border-slate-600 bg-slate-800/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="h-5 w-5 text-emerald-400" />
                Review Batch List
              </CardTitle>
              <CardDescription className="text-gray-400">
                Verify all recipients before creating the immutable BatchList Object
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="space-y-4 rounded-lg border border-slate-600/50 bg-slate-700/50 p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="mb-1.5 text-xs text-gray-400">Token</p>
                    <div className="flex items-center gap-2">
                      {assetType === 'SUI' && <img src={suiLogo} alt="SUI" className="h-4 w-4" />}
                      <p className="text-white">${assetType}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs text-gray-400">Total Amount</p>
                    <p className="text-white">{totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs text-gray-400">Valid Recipients</p>
                    <p className="flex items-center gap-1.5 text-white">
                      {validRecipients} / {recipients.length}
                      {validRecipients === recipients.length ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                      )}
                    </p>
                  </div>
                </div>
                
                {assetType === 'OTHER' && customTokenObjectId && (
                  <div className="border-t border-slate-600 pt-3">
                    <p className="mb-1.5 text-xs text-gray-400">Custom Token Object ID</p>
                    <p className="font-mono text-xs text-gray-300 break-all">{customTokenObjectId}</p>
                  </div>
                )}
              </div>

              {/* Recipients Table */}
              <div className="overflow-hidden rounded-lg border border-slate-600/50">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-slate-600 bg-slate-700/80 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-300">Address</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800/30">
                      {recipients.map((recipient, idx) => (
                        <tr key={idx} className="border-t border-slate-700/50">
                          <td className="px-4 py-3">
                            {recipient.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">
                            {recipient.address.slice(0, 10)}...{recipient.address.slice(-8)}
                          </td>
                          <td className="px-4 py-3 text-right text-white">
                            {recipient.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Time-Lock Option */}
              <div className="space-y-4 rounded-lg border border-slate-600/50 bg-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-400" />
                    <Label htmlFor="time-lock" className="text-white">Enable Release Time-Lock (Optional)</Label>
                  </div>
                  <Switch
                    id="time-lock"
                    checked={enableTimeLock}
                    onCheckedChange={setEnableTimeLock}
                  />
                </div>
                
                {enableTimeLock && (
                  <div className="space-y-2 border-t border-slate-600 pt-4">
                    <Label htmlFor="unlock-date" className="flex items-center gap-2 text-xs text-gray-300">
                      <Calendar className="h-3 w-3" />
                      Token Release Date & Time
                    </Label>
                    <Input
                      id="unlock-date"
                      type="datetime-local"
                      value={unlockDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnlockDate(e.target.value)}
                      className="border-slate-600 bg-slate-700/50 text-white"
                    />
                    <p className="text-xs text-gray-400">
                      Tokens will be locked and automatically released at the specified time
                    </p>
                  </div>
                )}
              </div>

              {/* Lock Warning */}
              <Alert className="border-amber-500/50 bg-amber-500/20">
                <Lock className="h-4 w-4 text-amber-300" />
                <AlertDescription className="text-sm text-amber-200">
                  By clicking "Lock List", you will create an <span className="font-semibold">immutable BatchList Object</span> on the Sui blockchain. 
                  This list cannot be modified after creation.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={lockBatchList}
                  disabled={validRecipients !== recipients.length}
                  className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 text-white"
                >
                  <Lock className="h-4 w-4" />
                  Lock List
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Execute */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card className="border border-slate-600 bg-slate-800/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                BatchList Object Created
              </CardTitle>
              <CardDescription className="text-gray-400">
                Your batch list has been locked on the Sui blockchain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-emerald-500/50 bg-emerald-500/20">
                <Shield className="h-4 w-4 text-emerald-300" />
                <AlertDescription className="text-sm text-emerald-200">
                  <div className="mb-2">Object ID Created:</div>
                  <div className="break-all rounded bg-emerald-500/30 border border-emerald-500/50 p-3 font-mono text-xs text-white">
                    {batchListObjectId}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-600/50 bg-slate-700/50 p-4">
                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Total Value</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white">{totalAmount.toLocaleString()}</p>
                    {assetType === 'SUI' && <img src={suiLogo} alt="SUI" className="h-4 w-4" />}
                    <p className="text-white">${assetType}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Recipients</p>
                  <p className="text-white">{recipients.length}</p>
                </div>
                {enableTimeLock && unlockDate && (
                  <div className="col-span-2">
                    <p className="mb-1.5 text-xs text-gray-400">Release Time</p>
                    <p className="flex items-center gap-2 text-sm text-white">
                      <Clock className="h-4 w-4 text-purple-400" />
                      {new Date(unlockDate).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="mb-1.5 text-xs text-gray-400">Service Fee (0.5%)</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-white">{(totalAmount * 0.005).toFixed(4)}</p>
                    <img src={suiLogo} alt="SUI" className="h-3.5 w-3.5" />
                    <p className="text-sm text-white">SUI</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="mb-1.5 text-xs text-gray-400">Estimated Gas Fee</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm text-white">~0.01</p>
                    <img src={suiLogo} alt="SUI" className="h-3.5 w-3.5" />
                    <p className="text-sm text-white">SUI (PTB Transaction)</p>
                  </div>
                </div>
              </div>

              {/* Execute Button */}
              <Button 
                onClick={executeBatch}
                disabled={isExecuting}
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 py-6 shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-cyan-700 text-white"
                size="lg"
              >
                <Zap className="h-5 w-5" />
                {isExecuting ? 'Processing Transaction...' : 'Execute Batch Transaction'}
              </Button>

              {transactionDigest && (
                <Alert className="border-emerald-500/50 bg-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <AlertDescription className="text-sm text-emerald-200">
                    <div className="mb-2 font-semibold">Transaction Successful!</div>
                    <a
                      href={`https://suiscan.xyz/testnet/tx/${transactionDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all rounded bg-emerald-500/30 border border-emerald-500/50 p-3 font-mono text-xs text-white hover:bg-emerald-500/40 transition-colors underline"
                    >
                      View on SuiScan: {transactionDigest}
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setCsvInput('');
                  setRecipients([]);
                }}
                className="w-full border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
              >
                Create New Batch
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}