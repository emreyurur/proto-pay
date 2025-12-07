# ProtoPay

**Next generation batch transactions and trustless escrow management on Sui Network**

ProtoPay is a modern Web3 application built on the Sui blockchain that enables secure batch payments, conditional escrow services, and time-locked asset releases. With a focus on user experience and security, ProtoPay provides a seamless interface for managing complex payment workflows.

## ✨ Features

### 🔄 Batch Payments
- Send tokens to multiple recipients in a single transaction
- CSV file import support for bulk payments
- Support for SUI and USDC tokens
- Significant gas fee savings compared to individual transactions

### 🔒 Conditional Escrow
- Lock tokens or NFTs with customizable release conditions
- Recipient approval-based release
- Time-lock mechanisms for scheduled releases
- Fully on-chain security with smart contract enforcement

### ⏰ Time-Lock Release
- Schedule token releases for future dates
- Perfect for vesting schedules and recurring payments
- Automated execution upon time condition fulfillment

### 📇 Address Book
- Save frequently used wallet addresses
- Quick contact management
- Direct payment integration
- Local storage for privacy

## 🛠️ Tech Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Blockchain Integration**: Sui Blockchain (Testnet/Mainnet)
  - `@mysten/dapp-kit` - Wallet connection and transaction signing
  - `@mysten/sui` - Sui SDK for blockchain interactions
- **UI Components**: 
  - Radix UI primitives
  - Tailwind CSS for styling
  - Lucide React icons
  - Framer Motion for animations
- **State Management**: React Query (@tanstack/react-query)
- **Form Handling**: React Hook Form

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Sui-compatible wallet (e.g., Sui Wallet, Slush Wallet)

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd proto-pay

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
VITE_PACKAGE_ID=<your_sui_package_id>
```

Replace `<your_sui_package_id>` with your deployed smart contract package ID on Sui.

### Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Lint

```bash
# Run ESLint
npm run lint
```

## 📁 Project Structure

```
proto-pay/
├── src/
│   ├── components/
│   │   ├── AddressBook.tsx      # Contact management
│   │   ├── ApprovalPage.tsx     # Escrow approval interface
│   │   ├── BatchCreate.tsx      # Batch payment creation
│   │   ├── Dashboard.tsx        # User dashboard
│   │   ├── EscrowCreate.tsx     # Escrow creation interface
│   │   ├── LandingPage.tsx      # Marketing landing page
│   │   └── TokenSelector.tsx    # Token selection component
│   ├── ui/                      # Reusable UI components (Radix UI)
│   ├── assets/                  # Images and static assets
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── public/                      # Static assets
├── .env                         # Environment variables
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎯 Key Features Explained

### Batch Payments
Create and execute multiple token transfers in a single transaction. Upload a CSV file with recipient addresses and amounts, or manually add recipients through the interface.

### Escrow System
The escrow system supports two types of assets:
- **Fungible Tokens**: Lock a specific amount of SUI or USDC
- **Non-Fungible Tokens (NFTs)**: Lock unique digital assets

Release conditions include:
- **Recipient Approval**: Requires the receiver to sign and approve release
- **Time-Lock**: Assets automatically become releasable after a specific date/time

### Address Book
Manage your frequently used contacts with an intuitive interface. Send payments directly from your saved contacts with real blockchain transaction execution.

## 🔐 Security

- All transactions are executed on-chain with full transparency
- Smart contract enforcement ensures trustless operations
- No third-party custody of funds
- User wallets maintain full control of assets until transaction execution

## 🌐 Blockchain Network

ProtoPay supports both Sui Testnet and Mainnet. Configure your preferred network through the wallet connection interface.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Sui Documentation](https://docs.sui.io/)
- [Mysten Labs](https://mystenlabs.com/)
- [Sui Explorer](https://suiexplorer.com/)

## 💡 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Built with ❤️ on Sui Network
