import { useState } from 'react';
import { TokenSelector, type TokenType } from './TokenSelector';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { 
  UserPlus, 
  Users, 
  Edit2, 
  Trash2, 
  Copy, 
  Check,
  Send,
  Search,
  X,
  ArrowRight,
  BookUser,
  Lock,
  Loader2
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  address: string;
  note?: string;
  createdAt: string;
}

interface AddressBookProps {
  onSendToContact: (contact: Contact, type: 'batch' | 'escrow') => void;
}

export function AddressBook({ onSendToContact }: AddressBookProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address || '';
  
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem('sui-proto-contacts');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedContactForSend, setSelectedContactForSend] = useState<Contact | null>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState<TokenType>('SUI');
  const [isSending, setIsSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const contactsPerPage = 4;

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    note: ''
  });

  const saveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem('sui-proto-contacts', JSON.stringify(newContacts));
  };

  const handleAddContact = () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      return;
    }

    const newContact: Contact = {
      id: Date.now().toString(),
      name: formData.name,
      address: formData.address,
      note: formData.note,
      createdAt: new Date().toISOString()
    };
    saveContacts([...contacts, newContact]);
    setFormData({ name: '', address: '', note: '' });
  };

  const handleSaveEdit = () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      return;
    }

    const updatedContacts = contacts.map(c => 
      c.id === editingId 
        ? { ...c, name: formData.name, address: formData.address, note: formData.note }
        : c
    );
    saveContacts(updatedContacts);
    setEditingId(null);
    setFormData({ name: '', address: '', note: '' });
  };

  const handleEditContact = (contact: Contact) => {
    setFormData({
      name: contact.name,
      address: contact.address,
      note: contact.note || ''
    });
    setEditingId(contact.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', address: '', note: '' });
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      saveContacts(contacts.filter(c => c.id !== id));
    }
  };

  const handleCopyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenSendModal = (contact: Contact) => {
    setSelectedContactForSend(contact);
    setSendAmount('');
    setSendToken('SUI');
    setSendModalOpen(true);
  };

  const handleCloseSendModal = () => {
    setSendModalOpen(false);
    setSelectedContactForSend(null);
    setSendAmount('');
  };

  const handleSendTransaction = async () => {
    if (!selectedContactForSend || !sendAmount || !walletAddress) return;
    
    setIsSending(true);
    
    try {
      const txb = new Transaction();
      
      // Determine coin type
      let coinType = '0x2::sui::SUI';
      let decimals = 9;
      
      if (sendToken === 'USDC') {
        coinType = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
        decimals = 6;
      }
      
      // Convert amount to smallest unit
      const amountInSmallestUnit = BigInt(Math.floor(parseFloat(sendAmount) * Math.pow(10, decimals)));
      
      // Get coins
      const coins = await suiClient.getCoins({ owner: walletAddress, coinType });
      if (coins.data.length === 0) {
        throw new Error(`No ${sendToken} coins found in wallet`);
      }
      
      let coinToSend;
      
      if (coinType === '0x2::sui::SUI') {
        // For SUI, split from gas
        [coinToSend] = txb.splitCoins(txb.gas, [amountInSmallestUnit]);
      } else {
        // For other tokens, merge and split
        const primaryCoin = txb.object(coins.data[0].coinObjectId);
        if (coins.data.length > 1) {
          txb.mergeCoins(primaryCoin, coins.data.slice(1).map(c => txb.object(c.coinObjectId)));
        }
        [coinToSend] = txb.splitCoins(primaryCoin, [amountInSmallestUnit]);
      }
      
      // Transfer to recipient
      txb.transferObjects([coinToSend], selectedContactForSend.address);
      
      signAndExecute(
        { transaction: txb },
        {
          onSuccess: (result) => {
            console.log('Payment sent:', result);
            alert(`Successfully sent ${sendAmount} ${sendToken} to ${selectedContactForSend.name}!`);
            handleCloseSendModal();
            setIsSending(false);
          },
          onError: (err) => {
            console.error(err);
            alert('Failed to send payment: ' + err.message);
            setIsSending(false);
          }
        }
      );
      
    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message);
      setIsSending(false);
    }
  };

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);
  const startIndex = (currentPage - 1) * contactsPerPage;
  const endIndex = startIndex + contactsPerPage;
  const currentContacts = filteredContacts.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg">
            <BookUser className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100">Address Book</h1>
        </div>
        <p className="text-slate-400 ml-14">Manage your contacts and send payments</p>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Add/Edit Form */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/50 shadow-lg">
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            {editingId ? 'Edit Contact' : 'Add Contact'}
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contact name"
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-slate-700/60 bg-slate-700/50 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Wallet Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="0x..."
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-slate-700/60 bg-slate-700/50 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Note (Optional)</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Add a note..."
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-slate-700/60 bg-slate-700/50 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {editingId ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-slate-800 border-2 border-slate-700/60 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddContact}
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Contact
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Contact List */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Contacts ({filteredContacts.length})
            </h2>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border-2 border-slate-700/60 bg-slate-700/50 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>

          {/* Contact List */}
          <div className="space-y-3 min-h-[600px]">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  {searchQuery ? 'No contacts found' : 'No contacts yet. Add your first contact!'}
                </p>
              </div>
            ) : (
              currentContacts.map(contact => (
                <div
                  key={contact.id}
                  className="bg-slate-800/50 border-2 border-slate-700/60 rounded-2xl p-4 hover:border-cyan-500/30 transition-all shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-100 mb-1">{contact.name}</h3>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-slate-400 font-mono truncate block">
                          {contact.address.slice(0, 20)}...{contact.address.slice(-8)}
                        </code>
                        <button
                          onClick={() => handleCopyAddress(contact.id, contact.address)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                          {copiedId === contact.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {contact.note && (
                        <p className="text-xs text-slate-500 mt-1">{contact.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenSendModal(contact)}
                      className="flex-1 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                    <button
                      onClick={() => onSendToContact(contact, 'escrow')}
                      className="flex-1 py-1.5 bg-purple-500/10 text-purple-400 border-2 border-purple-500/30 text-xs font-medium rounded-xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Escrow
                    </button>
                    <button
                      onClick={() => handleEditContact(contact)}
                      className="p-1.5 bg-slate-700/50 border-2 border-slate-700/60 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-1.5 bg-slate-700/50 border-2 border-slate-700/60 text-slate-400 rounded-xl hover:bg-slate-700 hover:text-red-400 hover:border-red-500/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {filteredContacts.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-700/60">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border-2 border-slate-700/60 text-slate-300 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-800 border-2 border-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border-2 border-slate-700/60 text-slate-300 text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Send Modal */}
      {sendModalOpen && selectedContactForSend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                Send Payment
              </h2>
              <button
                onClick={handleCloseSendModal}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Recipient */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Recipient</label>
                <div className="bg-slate-800/50 border-2 border-slate-700/60 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-100 mb-1">{selectedContactForSend.name}</p>
                  <code className="text-xs text-slate-400 font-mono break-all">
                    {selectedContactForSend.address}
                  </code>
                </div>
              </div>

              {/* Token Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Token</label>
                <TokenSelector value={sendToken} onChange={setSendToken} />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Amount</label>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 text-lg rounded-xl border-2 border-slate-700/60 bg-slate-700/50 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCloseSendModal}
                  className="flex-1 py-2.5 bg-slate-800 border-2 border-slate-700/60 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTransaction}
                  disabled={!sendAmount || parseFloat(sendAmount) <= 0 || isSending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Payment
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
