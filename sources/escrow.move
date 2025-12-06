module project_x_move::escrow;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;

// Hata Kodları
const ENotReadyYet: u64 = 0;
const ENotRecipient: u64 = 1;
const EInsufficientPayment: u64 = 2;

// ================= EVENT YAPILARI =================
// Bu eventler sayesinde Frontend "Kim ne sattı, ne zaman satıldı" diye dinleyebilir.

/// Coin kilitlendiğinde (Satışa konduğunda) atılır
public struct CoinLockEvent<phantom T, phantom PaymentCoin> has copy, drop {
    escrow_id: ID,
    creator: address,
    recipient: address,
    amount: u64,
    price: u64,
    unlock_time: u64,
}

/// Coin satın alındığında atılır
public struct CoinClaimEvent<phantom T, phantom PaymentCoin> has copy, drop {
    escrow_id: ID,
    claimer: address,
    amount: u64,
    price: u64,
}

/// NFT kilitlendiğinde atılır
public struct NftLockEvent<phantom T, phantom PaymentCoin> has copy, drop {
    escrow_id: ID,
    nft_id: ID, // Satılan NFT'nin ID'si
    creator: address,
    recipient: address,
    price: u64,
    unlock_time: u64,
}

/// NFT satın alındığında atılır
public struct NftClaimEvent<phantom T, phantom PaymentCoin> has copy, drop {
    escrow_id: ID,
    nft_id: ID,
    claimer: address,
    price: u64,
}

// ================= COIN ESCROW (SATIŞ) =================

public struct CoinEscrow<phantom T, phantom PaymentCoin> has key {
    id: UID,
    balance: Balance<T>,
    creator: address,
    recipient: address,
    price: u64,
    unlock_time: u64,
}

public entry fun lock_coin<T, PaymentCoin>(
    coin: Coin<T>,
    recipient: address,
    price: u64,
    unlock_time: u64,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&coin); // Event için miktarı saklıyoruz
    let balance = coin::into_balance(coin);
    let sender = tx_context::sender(ctx);

    // 1. ID'yi burada oluşturuyoruz ki Event içinde kullanabilelim
    let id = object::new(ctx);
    let escrow_id = object::uid_to_inner(&id);

    let escrow = CoinEscrow<T, PaymentCoin> {
        id, // Oluşturduğumuz ID'yi buraya veriyoruz
        balance,
        creator: sender,
        recipient,
        price,
        unlock_time,
    };

    // 2. Event Emit (Objeyi paylaşmadan hemen önce veya sonra ama ID elimizdeyken)
    event::emit(CoinLockEvent<T, PaymentCoin> {
        escrow_id,
        creator: sender,
        recipient,
        amount,
        price,
        unlock_time,
    });

    transfer::share_object(escrow);
}

public entry fun claim_coin<T, PaymentCoin>(
    escrow: CoinEscrow<T, PaymentCoin>,
    mut payment: Coin<PaymentCoin>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == escrow.recipient, ENotRecipient);
    assert!(clock::timestamp_ms(clock) >= escrow.unlock_time, ENotReadyYet);
    assert!(coin::value(&payment) >= escrow.price, EInsufficientPayment);

    // Objeyi parçalıyoruz
    let CoinEscrow { id, balance, creator, recipient: _, price, unlock_time: _ } = escrow;

    // Silmeden önce ID'yi alalım (Loglama için)
    let escrow_id = object::uid_to_inner(&id);
    let amount = balance::value(&balance);

    object::delete(id);

    // Ödeme işlemleri
    let paid = coin::split(&mut payment, price, ctx);
    transfer::public_transfer(paid, creator);
    transfer::public_transfer(payment, tx_context::sender(ctx)); // Para üstü

    // Ürün teslimi
    let coin_product = coin::from_balance(balance, ctx);
    transfer::public_transfer(coin_product, tx_context::sender(ctx));

    // 3. Başarılı işlem Event'i
    event::emit(CoinClaimEvent<T, PaymentCoin> {
        escrow_id,
        claimer: tx_context::sender(ctx),
        amount,
        price,
    });
}

// ================= NFT ESCROW (SATIŞ) =================

public struct NftEscrow<T: key + store, phantom PaymentCoin> has key {
    id: UID,
    item: T,
    creator: address,
    recipient: address,
    price: u64,
    unlock_time: u64,
}

public entry fun lock_nft<T: key + store, PaymentCoin>(
    item: T,
    recipient: address,
    price: u64,
    unlock_time: u64,
    ctx: &mut TxContext,
) {
    let nft_id = object::id(&item); // NFT objenin içine girmeden ID'sini alıyoruz
    let sender = tx_context::sender(ctx);

    let id = object::new(ctx);
    let escrow_id = object::uid_to_inner(&id);

    let escrow = NftEscrow<T, PaymentCoin> {
        id,
        item,
        creator: sender,
        recipient,
        price,
        unlock_time,
    };

    event::emit(NftLockEvent<T, PaymentCoin> {
        escrow_id,
        nft_id,
        creator: sender,
        recipient,
        price,
        unlock_time,
    });

    transfer::share_object(escrow);
}

public entry fun claim_nft<T: key + store, PaymentCoin>(
    escrow: NftEscrow<T, PaymentCoin>,
    mut payment: Coin<PaymentCoin>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == escrow.recipient, ENotRecipient);
    assert!(clock::timestamp_ms(clock) >= escrow.unlock_time, ENotReadyYet);
    assert!(coin::value(&payment) >= escrow.price, EInsufficientPayment);

    let NftEscrow { id, item, creator, recipient: _, price, unlock_time: _ } = escrow;

    let escrow_id = object::uid_to_inner(&id);
    let nft_id = object::id(&item); // NFT teslim edilmeden ID'sini alalım

    object::delete(id);

    // Ödeme
    let paid = coin::split(&mut payment, price, ctx);
    transfer::public_transfer(paid, creator);
    transfer::public_transfer(payment, tx_context::sender(ctx));

    // Teslimat
    transfer::public_transfer(item, tx_context::sender(ctx));

    event::emit(NftClaimEvent<T, PaymentCoin> {
        escrow_id,
        nft_id,
        claimer: tx_context::sender(ctx),
        price,
    });
}
